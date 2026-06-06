"""Pure scoring helpers (no I/O)."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass


@dataclass
class ScoreBreakdown:
    correct: int
    incorrect: int
    unanswered: int
    total: int
    percentage: float


def normalize(answer: str | None) -> str:
    return (answer or "").strip().upper()


def is_correct(selected: str | None, correct: str | None) -> bool | None:
    if selected is None or selected == "":
        return None  # unanswered
    if correct is None:
        return None  # no answer key available
    return normalize(selected) == normalize(correct)


def score_attempt(items: list[tuple[str | None, str | None]]) -> ScoreBreakdown:
    correct = incorrect = unanswered = 0
    for selected, key in items:
        res = is_correct(selected, key)
        if res is True:
            correct += 1
        elif res is False:
            incorrect += 1
        else:
            unanswered += 1
    total = len(items)
    pct = (correct / total * 100.0) if total else 0.0
    return ScoreBreakdown(correct=correct, incorrect=incorrect, unanswered=unanswered, total=total, percentage=round(pct, 2))


def group_by_label(rows: list[dict], label_field: str) -> list[dict]:
    """rows: [{label, is_correct}]  -> [{label, correct, total}, ...]"""
    bucket: dict[str, list[bool | None]] = defaultdict(list)
    for r in rows:
        label = (r.get(label_field) or "(uncategorised)").strip() or "(uncategorised)"
        bucket[label].append(r.get("is_correct"))
    out = []
    for label, values in bucket.items():
        total = len(values)
        correct = sum(1 for v in values if v is True)
        out.append({"label": label, "correct": correct, "total": total})
    out.sort(key=lambda x: (-x["total"], x["label"]))
    return out
