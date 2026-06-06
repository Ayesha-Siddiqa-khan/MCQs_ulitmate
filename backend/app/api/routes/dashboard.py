"""Dashboard endpoints."""
from __future__ import annotations

from collections import Counter
from typing import Annotated

from fastapi import APIRouter, Depends
from supabase import Client

from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.dashboard import DashboardSummary, RecentAttempt, RecentMaterial

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> DashboardSummary:
    attempts = (
        db.table("quiz_attempts")
        .select("id, question_set_id, score, total_questions, percentage, submitted_at, is_submitted")
        .eq("is_submitted", True)
        .order("submitted_at", desc=True)
        .limit(50)
        .execute()
    ).data or []

    submitted = [a for a in attempts if a.get("submitted_at")]
    pcts = [float(a.get("percentage") or 0) for a in submitted]
    avg = round(sum(pcts) / len(pcts), 2) if pcts else 0.0

    # Recent uploads
    mats = (
        db.table("learning_materials")
        .select("id, title, file_type, created_at")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    ).data or []

    # Recent attempts (need title via question_set)
    recent: list[RecentAttempt] = []
    set_ids = list({a["question_set_id"] for a in submitted[:5]})
    title_map: dict[str, str] = {}
    if set_ids:
        sets = db.table("question_sets").select("id, title").in_("id", set_ids).execute().data or []
        title_map = {s["id"]: s["title"] for s in sets}
    for a in submitted[:5]:
        recent.append(
            RecentAttempt(
                id=a["id"],
                question_set_id=a["question_set_id"],
                title=title_map.get(a["question_set_id"]),
                score=a.get("score") or 0,
                total_questions=a.get("total_questions") or 0,
                percentage=float(a.get("percentage") or 0),
                submitted_at=a.get("submitted_at"),
            )
        )

    # Mistakes summary
    mistakes = (
        db.table("mistake_bank")
        .select("id, mastery_status, question_id")
        .execute()
    ).data or []
    mastered = sum(1 for m in mistakes if m.get("mastery_status") == "mastered")
    total_wrong = len([m for m in mistakes if m.get("mastery_status") != "mastered"])

    # Weak topics
    weak_topic_ids = [m["question_id"] for m in mistakes if m.get("mastery_status") in ("new_mistake", "needs_practice")]
    weak_topics: list[str] = []
    if weak_topic_ids:
        rows = (
            db.table("questions")
            .select("topic, chapter, subject")
            .in_("id", weak_topic_ids)
            .execute()
        ).data or []
        topic_counter: Counter[str] = Counter()
        for r in rows:
            t = (r.get("topic") or r.get("chapter") or r.get("subject") or "").strip()
            if t:
                topic_counter[t] += 1
        weak_topics = [t for t, _ in topic_counter.most_common(5)]

    # Continue-practice: most recent unfinished attempt
    unfinished = (
        db.table("quiz_attempts")
        .select("id")
        .eq("is_submitted", False)
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    continue_id = unfinished[0]["id"] if unfinished else None

    return DashboardSummary(
        total_quizzes=len(submitted),
        average_score=avg,
        accuracy_trend=list(reversed(pcts[:10])),
        total_wrong_questions=total_wrong,
        mastered_mistakes=mastered,
        weak_topics=weak_topics,
        recent_uploads=[RecentMaterial(**m) for m in mats],
        recent_attempts=recent,
        continue_practice_attempt_id=continue_id,
    )
