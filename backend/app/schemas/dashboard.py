"""Dashboard shapes."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_quizzes: int
    average_score: float
    accuracy_trend: list[float]
    total_wrong_questions: int
    mastered_mistakes: int
    weak_topics: list[str]
    recent_uploads: list[RecentMaterial]
    recent_attempts: list[RecentAttempt]
    continue_practice_attempt_id: str | None = None


class RecentMaterial(BaseModel):
    id: str
    title: str
    file_type: str
    created_at: datetime | None = None


class RecentAttempt(BaseModel):
    id: str
    question_set_id: str
    title: str | None = None
    score: int
    total_questions: int
    percentage: float
    submitted_at: datetime | None = None


DashboardSummary.model_rebuild()
