"""Quiz attempt endpoints: start, submit, get-result, report PDF."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from supabase import Client

from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.common import Option, QuizMode
from app.schemas.quiz import (
    QuestionPublic,
    QuestionResult,
    QuizAttemptDetail,
    QuizResult,
    StartQuizRequest,
    StartQuizResponse,
    SubmitQuizRequest,
    TopicBreakdown,
)
from app.services.pdf.report_generator import generate_quiz_report
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
        subject=q.get("subject"),
        chapter=q.get("chapter"),
        topic=q.get("topic"),
        difficulty=q.get("difficulty"),
    )


def _filter_questions(
    questions: list[dict],
    chapter: str | None,
    topic: str | None,
) -> list[dict]:
    chapter_value = (chapter or "").strip()
    topic_value = (topic or "").strip()
    filtered = questions
    if chapter_value:
        filtered = [q for q in filtered if (q.get("chapter") or "").strip() == chapter_value]
    if topic_value:
        filtered = [q for q in filtered if (q.get("topic") or "").strip() == topic_value]
    return filtered


def _load_selected_attempt_questions(db: Client, attempt: dict) -> tuple[list[dict], list[dict]]:
    qattempts = (
        db.table("question_attempts")
        .select("*")
        .eq("quiz_attempt_id", attempt["id"])
        .order("created_at")
        .execute()
    ).data or []

    if qattempts:
        ids = [r["question_id"] for r in qattempts]
        questions = db.table("questions").select("*").in_("id", ids).execute().data or []
        order_by_id = {question_id: i for i, question_id in enumerate(ids)}
        questions.sort(key=lambda q: order_by_id.get(q["id"], len(order_by_id)))
    else:
        questions = (
            db.table("questions")
            .select("*")
            .eq("question_set_id", attempt["question_set_id"])
            .order("position")
            .execute()
        ).data or []
        questions.sort(key=lambda q: int(q.get("position") or 0))
    return questions, qattempts


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
        .select("id, position, question_text, options_json, correct_answer, subject, chapter, topic, difficulty")
        .eq("question_set_id", payload.question_set_id)
        .order("position")
        .execute()
    ).data or []
    if not questions:
        raise HTTPException(status_code=400, detail="question set has no questions")

    filtered_questions = _filter_questions(questions, payload.chapter, payload.topic)
    if not filtered_questions:
        raise HTTPException(status_code=400, detail="no questions match this chapter or topic filter")

    selected_count = payload.question_count or len(filtered_questions)
    if selected_count < 1:
        raise HTTPException(status_code=400, detail="question count must be greater than 0")
    if selected_count > len(filtered_questions):
        raise HTTPException(
            status_code=400,
            detail=f"question count cannot exceed the {len(filtered_questions)} matching questions",
        )
    selected_questions = filtered_questions[:selected_count]

    attempt = (
        db.table("quiz_attempts")
        .insert(
            {
                "user_id": user.id,
                "question_set_id": payload.question_set_id,
                "mode": payload.mode.value,
                "total_questions": len(selected_questions),
            }
        )
        .execute()
        .data[0]
    )

    db.table("question_attempts").insert(
        [
            {
                "user_id": user.id,
                "quiz_attempt_id": attempt["id"],
                "question_id": q["id"],
                "selected_answer": None,
                "correct_answer": q.get("correct_answer"),
                "is_correct": None,
                "is_marked": False,
                "time_spent_seconds": 0,
            }
            for q in selected_questions
        ]
    ).execute()

    return StartQuizResponse(
        attempt_id=attempt["id"],
        question_set_id=payload.question_set_id,
        mode=QuizMode(attempt["mode"]),
        started_at=attempt["started_at"],
        questions=[_row_to_public(q) for q in selected_questions],
    )


@router.get("/{attempt_id}", response_model=QuizAttemptDetail)
async def get_attempt(
    attempt_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> QuizAttemptDetail:
    attempt = (
        db.table("quiz_attempts")
        .select("*")
        .eq("id", attempt_id)
        .maybe_single()
        .execute()
    ).data
    if attempt is None:
        raise HTTPException(status_code=404, detail="attempt not found")

    questions, _ = _load_selected_attempt_questions(db, attempt)
    return QuizAttemptDetail(
        attempt_id=attempt["id"],
        question_set_id=attempt["question_set_id"],
        mode=QuizMode(attempt["mode"]),
        total_questions=attempt.get("total_questions") or len(questions),
        is_submitted=bool(attempt.get("is_submitted")),
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

    questions, existing_attempt_rows = _load_selected_attempt_questions(db, attempt)
    qmap = {q["id"]: q for q in questions}
    if not qmap:
        raise HTTPException(status_code=400, detail="question set has no questions")

    # Persist one row per answered (or skipped) question.
    answer_lookup = {a.question_id: a for a in payload.answers}
    unknown_ids = sorted(set(answer_lookup) - set(qmap))
    if unknown_ids:
        raise HTTPException(
            status_code=400,
            detail="Submitted answers include questions that are not part of this quiz.",
        )

    rows_to_insert: list[dict] = []
    for q in questions:
        a = answer_lookup.get(q["id"])
        selected = (a.selected_answer or "").strip() if a else None
        if selected == "":
            selected = None
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

    if existing_attempt_rows:
        existing_by_question = {r["question_id"]: r for r in existing_attempt_rows}
        for row in rows_to_insert:
            existing = existing_by_question.get(row["question_id"])
            if existing is None:
                db.table("question_attempts").insert(row).execute()
                continue
            db.table("question_attempts").update(
                {
                    "selected_answer": row["selected_answer"],
                    "correct_answer": row["correct_answer"],
                    "is_correct": row["is_correct"],
                    "is_marked": row["is_marked"],
                    "time_spent_seconds": row["time_spent_seconds"],
                }
            ).eq("id", existing["id"]).execute()
        inserted = (
            db.table("question_attempts")
            .select("*")
            .eq("quiz_attempt_id", attempt_id)
            .order("created_at")
            .execute()
        ).data or []
    else:
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
        .order("created_at")
        .execute()
    ).data or []
    questions, _ = _load_selected_attempt_questions(db, attempt)
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


@router.get("/{attempt_id}/report.pdf")
async def download_report(
    attempt_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> Response:
    """Generate and return a PDF report for a completed quiz attempt."""
    attempt = (
        db.table("quiz_attempts")
        .select("*")
        .eq("id", attempt_id)
        .maybe_single()
        .execute()
    ).data
    if attempt is None:
        raise HTTPException(status_code=404, detail="attempt not found")
    if attempt.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="not authorized to access this report")
    if not attempt.get("is_submitted"):
        raise HTTPException(status_code=400, detail="quiz attempt has not been submitted yet")

    qattempts = (
        db.table("question_attempts")
        .select("*")
        .eq("quiz_attempt_id", attempt_id)
        .order("created_at")
        .execute()
    ).data or []
    questions, _ = _load_selected_attempt_questions(db, attempt)
    qmap = {q["id"]: q for q in questions}
    breakdown = score_attempt([(r["selected_answer"], r["correct_answer"]) for r in qattempts])

    result = _build_result(attempt_id, attempt["question_set_id"], breakdown, qmap, qattempts, attempt.get("submitted_at"))

    qset = (
        db.table("question_sets")
        .select("id, title, material_id")
        .eq("id", attempt["question_set_id"])
        .maybe_single()
        .execute()
    ).data

    material = None
    if qset and qset.get("material_id"):
        material = (
            db.table("learning_materials")
            .select("id, title")
            .eq("id", qset["material_id"])
            .maybe_single()
            .execute()
        ).data

    mistake_rows = (
        db.table("question_attempts")
        .select("id, question_id, selected_answer, correct_answer, is_correct")
        .eq("quiz_attempt_id", attempt_id)
        .eq("is_correct", False)
        .execute()
    ).data or []

    mistakes = []
    for mr in mistake_rows:
        q = qmap.get(mr["question_id"])
        if q is None:
            continue
        mb = (
            db.table("mistake_bank")
            .select("mastery_status")
            .eq("user_id", user.id)
            .eq("question_id", mr["question_id"])
            .maybe_single()
            .execute()
        ).data
        mistakes.append({
            "selected_answer": mr.get("selected_answer"),
            "correct_answer": mr.get("correct_answer"),
            "mastery_status": mb.get("mastery_status") if mb else None,
            "question": {
                "question_text": q.get("question_text", ""),
                "correct_answer": q.get("correct_answer"),
                "explanation": q.get("explanation"),
            },
        })

    result_dict = result.model_dump()
    result_dict["mode"] = attempt.get("mode", "practice")

    pdf_bytes = generate_quiz_report(
        result=result_dict,
        question_set=qset,
        material=material,
        user_email=user.email,
        mistakes=mistakes if mistakes else None,
    )

    safe_title = (qset.get("title") or "quiz-result").replace(" ", "-")[:50]
    filename = f"MCQ-Mentor-{safe_title}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
