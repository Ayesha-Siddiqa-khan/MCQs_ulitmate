"""Mistake bank updates triggered after a quiz is submitted.

Mastery transitions:
  new_mistake     -> first wrong answer recorded
  needs_practice  -> wrong again (any subsequent wrong)
  improving       -> correct after >=1 wrong (and correct_after_wrong_count == 1)
  mastered        -> correct_after_wrong_count >= 2 in non-consecutive sessions

We rely on RLS: the supplied client must already be authenticated as the user.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from app.schemas.common import MasteryStatus

_MASTERY_THRESHOLD = 2  # correct answers (after the first wrong) to reach mastery


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def update_mistake_bank(
    db: Client,
    user_id: str,
    question_id: str,
    question_attempt_id: str,
    is_correct: bool | None,
) -> None:
    """Idempotent upsert that walks the mastery state machine.

    Called once per (quiz attempt, question) right after a quiz is submitted.
    Unanswered questions (is_correct is None) do not modify the bank.
    """
    if is_correct is None:
        return

    existing = (
        db.table("mistake_bank")
        .select("*")
        .eq("user_id", user_id)
        .eq("question_id", question_id)
        .maybe_single()
        .execute()
    ).data

    now = _now_iso()

    if is_correct is False:
        # Wrong answer -> create or bump
        if existing is None:
            db.table("mistake_bank").insert(
                {
                    "user_id": user_id,
                    "question_id": question_id,
                    "first_wrong_attempt_id": question_attempt_id,
                    "latest_attempt_id": question_attempt_id,
                    "wrong_count": 1,
                    "correct_after_wrong_count": 0,
                    "mastery_status": MasteryStatus.new_mistake.value,
                    "last_practiced_at": now,
                }
            ).execute()
            return

        if existing["mastery_status"] in (MasteryStatus.improving.value, MasteryStatus.mastered.value) or existing["wrong_count"] >= 1:
            new_status = MasteryStatus.needs_practice.value
        else:
            new_status = MasteryStatus.new_mistake.value
        db.table("mistake_bank").update(
            {
                "wrong_count": existing["wrong_count"] + 1,
                "correct_after_wrong_count": 0,
                "latest_attempt_id": question_attempt_id,
                "mastery_status": new_status,
                "last_practiced_at": now,
            }
        ).eq("id", existing["id"]).execute()
        return

    # is_correct is True
    if existing is None:
        # First-time correct on a question that was never wrong: nothing to track.
        return

    correct_after = existing["correct_after_wrong_count"] + 1
    if correct_after >= _MASTERY_THRESHOLD:
        new_status = MasteryStatus.mastered.value
    else:
        new_status = MasteryStatus.improving.value

    db.table("mistake_bank").update(
        {
            "correct_after_wrong_count": correct_after,
            "latest_attempt_id": question_attempt_id,
            "mastery_status": new_status,
            "last_practiced_at": now,
        }
    ).eq("id", existing["id"]).execute()


def process_attempt_updates(
    db: Client,
    user_id: str,
    attempts: list[dict[str, Any]],
) -> None:
    """attempts: rows from `question_attempts` for the just-submitted quiz."""
    for a in attempts:
        update_mistake_bank(
            db=db,
            user_id=user_id,
            question_id=a["question_id"],
            question_attempt_id=a["id"],
            is_correct=a.get("is_correct"),
        )
