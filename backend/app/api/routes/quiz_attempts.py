"""Quiz attempt endpoints: start, submit, get-result."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.common import Option, QuizMode
from app.schemas.quiz import (
    QuestionPublic,
    QuestionResult,
    QuizResult,
    StartQuizRequest,
    StartQuizResponse,
    SubmitQuizRequest,
    TopicBreakdown,
)
from app.services.quiz.mistake_service import process_attempt_updates
from app.services.quiz.scoring_service import group_by_label, is_correct, score_attempt

router = APIRouter(prefix="/quiz-attempts", tags=["quiz-attempts"])


def _row_to_public(q: dict) -> QuestionPublic:
    opts = [Option(**o) for o in (q.get("options_json") or []) if isinstance(o, dict)]
    return QuestionPublic(
        id=q["id"],
        position=q.get("position", 0),
        question_text=q["question_text"],
        options=opts,
    )


@router.post("/start", response_model=StartQuizResponse, status_code=201)
async def start_attempt(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: StartQuizRequest,
) -> StartQuizResponse:
    qset = (
        db.table("question_sets")
        .select("id, total_questions")
        .eq("id", payload.question_set_id)
        .maybe_single()
        .execute()
    ).data
    if qset is None:
        raise HTTPException(status_code=404, detail="question set not found")

    questions = (
        db.table("questions")
        .select("id, position, question_text, options_json")
        .eq("question_set_id", payload.question_set_id)
        .order("position")
        .execute()
    ).data or []
    if not questions:
        raise HTTPException(status_code=400, detail="question set has no questions")

    attempt = (
        db.table("quiz_attempts")
        .insert(
            {
                "user_id": user.id,
                "question_set_id": payload.question_set_id,
                "mode": payload.mode.value,
                "total_questions": len(questions),
            }
        )
        .execute()
        .data[0]
    )

    return StartQuizResponse(
        attempt_id=attempt["id"],
        question_set_id=payload.question_set_id,
        mode=QuizMode(attempt["mode"]),
        started_at=attempt["started_at"],
        questions=[_row_to_public(q) for q in questions],
    )


@router.post("/{attempt_id}/submit", response_model=QuizResult)
async def submit_attempt(
    attempt_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: SubmitQuizRequest,
) -> QuizResult:
    attempt = (
        db.table("quiz_attempts")
        .select("*")
        .eq("id", attempt_id)
        .maybe_single()
        .execute()
    ).data
    if attempt is None:
        raise HTTPException(status_code=404, detail="attempt not found")
    if attempt.get("is_submitted"):
        raise HTTPException(status_code=409, detail="attempt already submitted")

    questions = (
        db.table("questions")
        .select("*")
        .eq("question_set_id", attempt["question_set_id"])
        .order("position")
        .execute()
    ).data or []
    qmap = {q["id"]: q for q in questions}

    # Persist one row per answered (or skipped) question.
    answer_lookup = {a.question_id: a for a in payload.answers}
    rows_to_insert: list[dict] = []
    for q in questions:
        a = answer_lookup.get(q["id"])
        selected = a.selected_answer if a else None
        marked = bool(a.is_marked) if a else False
        time_spent = int(a.time_spent_seconds) if a else 0
        correct_value = q.get("correct_answer")
        verdict = is_correct(selected, correct_value)
        rows_to_insert.append(
            {
                "user_id": user.id,
                "quiz_attempt_id": attempt_id,
                "question_id": q["id"],
                "selected_answer": selected,
                "correct_answer": correct_value,
                "is_correct": verdict,
                "is_marked": marked,
                "time_spent_seconds": time_spent,
            }
        )

    inserted = db.table("question_attempts").insert(rows_to_insert).execute().data or []
    breakdown = score_attempt([(r["selected_answer"], r["correct_answer"]) for r in rows_to_insert])

    submitted_at = datetime.now(UTC).isoformat()
    db.table("quiz_attempts").update(
        {
            "score": breakdown.correct,
            "total_questions": breakdown.total,
            "percentage": breakdown.percentage,
            "time_spent_seconds": payload.time_spent_seconds,
            "is_submitted": True,
            "submitted_at": submitted_at,
        }
    ).eq("id", attempt_id).execute()

    # Mistake bank updates run AFTER answers are persisted so we can attach IDs.
    process_attempt_updates(db, user.id, inserted)

    return _build_result(attempt_id, attempt["question_set_id"], breakdown, qmap, inserted, submitted_at)


@router.get("/{attempt_id}/result", response_model=QuizResult)
async def get_result(
    attempt_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> QuizResult:
    attempt = (
        db.table("quiz_attempts")
        .select("*")
        .eq("id", attempt_id)
        .maybe_single()
        .execute()
    ).data
    if attempt is None:
        raise HTTPException(status_code=404, detail="attempt not found")

    qattempts = (
        db.table("question_attempts")
        .select("*")
        .eq("quiz_attempt_id", attempt_id)
        .execute()
    ).data or []
    questions = (
        db.table("questions")
        .select("*")
        .eq("question_set_id", attempt["question_set_id"])
        .order("position")
        .execute()
    ).data or []
    qmap = {q["id"]: q for q in questions}
    breakdown = score_attempt([(r["selected_answer"], r["correct_answer"]) for r in qattempts])
    return _build_result(attempt_id, attempt["question_set_id"], breakdown, qmap, qattempts, attempt.get("submitted_at"))


def _build_result(
    attempt_id: str,
    question_set_id: str,
    breakdown,
    qmap: dict[str, dict],
    qattempts: list[dict],
    submitted_at,
) -> QuizResult:
    from app.api.routes.question_sets import _row_to_question

    per_question: list[QuestionResult] = []
    label_rows_topic = []
    label_rows_difficulty = []

    for a in qattempts:
        q = qmap.get(a["question_id"])
        if q is None:
            continue
        per_question.append(
            QuestionResult(
                question=_row_to_question(q),
                selected_answer=a.get("selected_answer"),
                is_correct=a.get("is_correct"),
                is_marked=a.get("is_marked") or False,
                time_spent_seconds=a.get("time_spent_seconds") or 0,
            )
        )
        label_rows_topic.append({"topic": q.get("topic") or q.get("chapter") or q.get("subject"), "is_correct": a.get("is_correct")})
        label_rows_difficulty.append({"difficulty": q.get("difficulty"), "is_correct": a.get("is_correct")})

    topic_breakdown = [TopicBreakdown(**b) for b in group_by_label(label_rows_topic, "topic")]
    diff_breakdown = [TopicBreakdown(**b) for b in group_by_label(label_rows_difficulty, "difficulty")]

    return QuizResult(
        attempt_id=attempt_id,
        question_set_id=question_set_id,
        score=breakdown.correct,
        total_questions=breakdown.total,
        correct=breakdown.correct,
        incorrect=breakdown.incorrect,
        unanswered=breakdown.unanswered,
        percentage=breakdown.percentage,
        time_spent_seconds=sum(a.get("time_spent_seconds") or 0 for a in qattempts),
        submitted_at=submitted_at,
        questions=per_question,
        topic_breakdown=topic_breakdown,
        difficulty_breakdown=diff_breakdown,
    )
