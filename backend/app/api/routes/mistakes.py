"""Mistake-bank and mistake-practice endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.common import MasteryStatus, QuestionSetMode, QuizMode
from app.schemas.mistakes import (
    DeleteMistakesResponse,
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


@router.delete("/all", response_model=DeleteMistakesResponse)
async def clear_all_mistakes(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> DeleteMistakesResponse:
    rows = db.table("mistake_bank").select("id").eq("user_id", user.id).execute().data or []
    if rows:
        db.table("mistake_bank").delete().eq("user_id", user.id).execute()
    return DeleteMistakesResponse(deleted=len(rows), status=None)


@router.delete("", response_model=DeleteMistakesResponse)
async def clear_mistakes_by_status(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    status: Annotated[MasteryStatus | None, Query()] = None,
) -> DeleteMistakesResponse:
    if status is None:
        raise HTTPException(status_code=400, detail="status query parameter is required")
    rows = (
        db.table("mistake_bank")
        .select("id")
        .eq("user_id", user.id)
        .eq("mastery_status", status.value)
        .execute()
        .data
        or []
    )
    if rows:
        db.table("mistake_bank").delete().eq("user_id", user.id).eq("mastery_status", status.value).execute()
    return DeleteMistakesResponse(deleted=len(rows), status=status)


@router.delete("/{mistake_id}", response_model=DeleteMistakesResponse)
async def delete_mistake(
    mistake_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> DeleteMistakesResponse:
    row = (
        db.table("mistake_bank")
        .select("id")
        .eq("user_id", user.id)
        .eq("id", mistake_id)
        .maybe_single()
        .execute()
        .data
    )
    if row is None:
        raise HTTPException(status_code=404, detail="mistake not found")
    db.table("mistake_bank").delete().eq("user_id", user.id).eq("id", mistake_id).execute()
    return DeleteMistakesResponse(deleted=1, status=None)


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

    # Build an ephemeral question_set for navigation, then attach the original
    # mistake question IDs to the attempt. This keeps mastery updates tied to
    # the real mistake_bank rows instead of cloned question IDs.
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

    db.table("question_attempts").insert(
        [
            {
                "user_id": user.id,
                "quiz_attempt_id": attempt["id"],
                "question_id": r["question"]["id"],
                "selected_answer": None,
                "correct_answer": r["question"].get("correct_answer"),
                "is_correct": None,
                "is_marked": False,
                "time_spent_seconds": 0,
            }
            for r in rows
        ]
    ).execute()

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
