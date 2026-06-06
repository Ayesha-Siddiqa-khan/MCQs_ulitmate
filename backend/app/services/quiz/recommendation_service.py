"""Dashboard recommendation helpers."""
from __future__ import annotations

from collections import Counter
from typing import Any

from app.schemas.mistakes import MistakeFilter, MistakeRecommendation


def build_recommendations(mistakes: list[dict[str, Any]]) -> list[MistakeRecommendation]:
    """Given current mistake rows (with `question` joined), suggest next practice sets."""
    recs: list[MistakeRecommendation] = []
    if not mistakes:
        return recs

    needs = [m for m in mistakes if m.get("mastery_status") in ("new_mistake", "needs_practice")]
    if needs:
        recs.append(
            MistakeRecommendation(
                label="Fix your latest mistakes",
                reason=f"{len(needs)} question(s) need attention",
                count=len(needs),
                filter=MistakeFilter(only_unmastered=True, session_type="mistakes_unmastered"),
            )
        )

    topic_counter: Counter[str] = Counter()
    for m in mistakes:
        q = m.get("question") or {}
        t = (q.get("topic") or q.get("chapter") or q.get("subject") or "").strip()
        if t and m.get("mastery_status") != "mastered":
            topic_counter[t] += 1

    for topic, count in topic_counter.most_common(2):
        if count < 2:
            continue
        recs.append(
            MistakeRecommendation(
                label=f"Drill weak topic: {topic}",
                reason=f"{count} unmastered questions in this topic",
                count=count,
                filter=MistakeFilter(topic=topic, only_unmastered=True, session_type="mistakes_by_chapter"),
            )
        )

    repeated = [m for m in mistakes if m.get("wrong_count", 0) >= 2]
    if repeated:
        recs.append(
            MistakeRecommendation(
                label="Repeated mistakes",
                reason=f"{len(repeated)} question(s) you missed more than once",
                count=len(repeated),
                filter=MistakeFilter(only_repeated=True, session_type="mistakes_repeated"),
            )
        )

    return recs
