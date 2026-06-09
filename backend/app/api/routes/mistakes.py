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
    MistakeListOut,
    MistakeOut,
    MistakeRecommendation,
    PaginatedMistakes,
    StartPracticeResponse,
)
from app.services.quiz.recommendation_service import build_recommendations

router = APIRouter(prefix="/mistakes", tags=["mistakes"])


@router.get("", response_model=PaginatedMistakes)
async def list_mistakes(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    only_unmastered: bool = True,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedMistakes:
    """List user's mistakes with pagination. Returns lightweight question summaries."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    offset = (page - 1) * page_size

    # Get total count
    count_q = db.table("mistake_bank").select("id", count="exact")
    if only_unmastered:
        count_q = count_q.neq("mastery_status", "mastered")
    count_res = count_q.execute()
    total = count_res.count or 0
    total_pages = max(1, (total + page_size - 1) // page_size)

    # Get summary counts for all statuses
    all_counts_res = (
        db.table("mistake_bank")
        .select("id, mastery_status")
        .execute()
    ).data or []
    counts: dict[str, int] = {
        "new_mistake": 0,
        "needs_practice": 0,
        "improving": 0,
        "mastered": 0,
        "total": len(all_counts_res),
    }
    for r in all_counts_res:
        status = r.get("mastery_status", "new_mistake")
        if status in counts:
            counts[status] += 1

    # Fetch mistakes with lightweight question data (only text, subject, chapter, topic, difficulty)
    q = (
        db.table("mistake_bank")
        .select("id, question_id, wrong_count, correct_after_wrong_count, mastery_status, last_practiced_at, created_at, question:questions(id, question_text, subject, chapter, topic, difficulty)")
        .order("updated_at", desc=True)
    )
    if only_unmastered:
        q = q.neq("mastery_status", "mastered")
    res = q.range(offset, offset + page_size - 1).execute()

    items: list[MistakeListOut] = []
    for r in res.data or []:
        question_row = r.pop("question", None)
        items.append(
            MistakeListOut(
                id=r["id"],
                question_id=r["question_id"],
                wrong_count=r["wrong_count"],
                correct_after_wrong_count=r["correct_after_wrong_count"],
                mastery_status=r["mastery_status"],
                last_practiced_at=r.get("last_practiced_at"),
                created_at=r.get("created_at"),
                question_text=question_row.get("question_text") if question_row else None,
                subject=question_row.get("subject") if question_row else None,
                chapter=question_row.get("chapter") if question_row else None,
                topic=question_row.get("topic") if question_row else None,
                difficulty=question_row.get("difficulty") if question_row else None,
            )
        )

    return PaginatedMistakes(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        counts=counts,
    )


@router.get("/recommendations", response_model=list[MistakeRecommendation])
async def recommendations(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> list[MistakeRecommendation]:
    # Only fetch lightweight question data for recommendations
    res = (
        db.table("mistake_bank")
        .select("id, question_id, mastery_status, wrong_count, question:questions(subject, chapter, topic, difficulty)")
        .neq("mastery_status", "mastered")
        .limit(100)
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

    q = db.table("mistake_bank").select("id, question_id, mastery_status, wrong_count, question:questions(id, question_text, options_json, correct_answer, subject, chapter, topic, difficulty)")
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
