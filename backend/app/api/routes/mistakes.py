"""Mistake-bank and mistake-practice endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.common import QuestionSetMode, QuizMode
from app.schemas.mistakes import (
    MistakeFilter,
    MistakeOut,
    MistakeRecommendation,
    StartPracticeResponse,
)
from app.services.quiz.recommendation_service import build_recommendations

router = APIRouter(prefix="/mistakes", tags=["mistakes"])


@router.get("", response_model=list[MistakeOut])
async def list_mistakes(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    only_unmastered: bool = True,
) -> list[MistakeOut]:
    q = (
        db.table("mistake_bank")
        .select("*, question:questions(*)")
        .order("updated_at", desc=True)
    )
    if only_unmastered:
        q = q.neq("mastery_status", "mastered")
    res = q.execute()
    out: list[MistakeOut] = []
    for r in res.data or []:
        question_row = r.pop("question", None)
        question = None
        if question_row:
            from app.api.routes.question_sets import _row_to_question

            question = _row_to_question(question_row)
        out.append(MistakeOut(**r, question=question))
    return out


@router.get("/recommendations", response_model=list[MistakeRecommendation])
async def recommendations(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> list[MistakeRecommendation]:
    res = (
        db.table("mistake_bank")
        .select("*, question:questions(*)")
        .neq("mastery_status", "mastered")
        .execute()
    )
    return build_recommendations(res.data or [])


@router.post("/practice-session", response_model=StartPracticeResponse, status_code=201)
async def start_mistake_practice(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: MistakeFilter,
) -> StartPracticeResponse:
    """Builds an ad-hoc question_set + quiz_attempt out of the student's mistakes."""

    q = db.table("mistake_bank").select("*, question:questions(*)")
    if payload.only_unmastered:
        q = q.neq("mastery_status", "mastered")
    if payload.only_repeated:
        q = q.gte("wrong_count", 2)
    res = q.limit(payload.limit * 3).execute()  # over-fetch, then filter in python
    rows = res.data or []

    def keep(row: dict) -> bool:
        question = row.get("question") or {}
        if payload.subject and (question.get("subject") or "") != payload.subject:
            return False
        if payload.chapter and (question.get("chapter") or "") != payload.chapter:
            return False
        if payload.topic and (question.get("topic") or "") != payload.topic:
            return False
        return not (
            payload.difficulty
            and (question.get("difficulty") or "") != payload.difficulty.value
        )

    rows = [r for r in rows if r.get("question") and keep(r)][: payload.limit]
    if not rows:
        raise HTTPException(status_code=404, detail="no mistakes match this filter")

    # Build an ephemeral question_set whose questions reference the existing ones.
    qset = (
        db.table("question_sets")
        .insert(
            {
                "user_id": user.id,
                "title": "Mistake practice",
                "mode": QuestionSetMode.generate_mcq.value,
                "total_questions": len(rows),
            }
        )
        .execute()
        .data[0]
    )

    # Clone the existing question rows into the new set so the quiz pipeline is uniform.
    clones = []
    for i, r in enumerate(rows):
        q_src = r["question"]
        clones.append(
            {
                "user_id": user.id,
                "question_set_id": qset["id"],
                "material_id": q_src.get("material_id"),
                "position": i,
                "question_text": q_src["question_text"],
                "options_json": q_src.get("options_json") or [],
                "correct_answer": q_src.get("correct_answer"),
                "explanation": q_src.get("explanation"),
                "key_points": q_src.get("key_points"),
                "subject": q_src.get("subject"),
                "chapter": q_src.get("chapter"),
                "topic": q_src.get("topic"),
                "difficulty": q_src.get("difficulty"),
                "source_type": q_src.get("source_type") or "ai_generated",
                "source_chunk": q_src.get("source_chunk"),
            }
        )
    db.table("questions").insert(clones).execute()

    attempt = (
        db.table("quiz_attempts")
        .insert(
            {
                "user_id": user.id,
                "question_set_id": qset["id"],
                "mode": QuizMode.mistakes.value,
                "total_questions": len(rows),
            }
        )
        .execute()
        .data[0]
    )

    practice = (
        db.table("practice_sessions")
        .insert(
            {
                "user_id": user.id,
                "session_type": payload.session_type,
                "filter_json": payload.model_dump(mode="json"),
                "quiz_attempt_id": attempt["id"],
                "total_questions": len(rows),
            }
        )
        .execute()
        .data[0]
    )

    return StartPracticeResponse(
        practice_session_id=practice["id"],
        quiz_attempt_id=attempt["id"],
        question_set_id=qset["id"],
        total_questions=len(rows),
    )
