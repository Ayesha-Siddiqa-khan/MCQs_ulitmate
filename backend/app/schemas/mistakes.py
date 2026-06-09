"""Mistake bank + practice session shapes."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Difficulty, MasteryStatus
from app.schemas.questions import QuestionOut


class MistakeOut(BaseModel):
    id: str
    question_id: str
    wrong_count: int
    correct_after_wrong_count: int
    mastery_status: MasteryStatus
    last_practiced_at: datetime | None
    created_at: datetime | None
    question: QuestionOut | None = None


class MistakeFilter(BaseModel):
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None
    difficulty: Difficulty | None = None
    only_unmastered: bool = True
    only_repeated: bool = False
    limit: int = Field(default=10, ge=1, le=50)
    session_type: Literal[
        "mistakes_all",
        "mistakes_by_subject",
        "mistakes_by_chapter",
        "mistakes_by_difficulty",
        "mistakes_repeated",
        "mistakes_unmastered",
    ] = "mistakes_all"


class StartPracticeResponse(BaseModel):
    practice_session_id: str
    quiz_attempt_id: str
    question_set_id: str
    total_questions: int


class MistakeRecommendation(BaseModel):
    label: str
    reason: str
    count: int
    filter: MistakeFilter


class DeleteMistakesResponse(BaseModel):
    deleted: int
    status: MasteryStatus | None = None


class MistakeListOut(BaseModel):
    """Lightweight mistake representation for list endpoints."""
    id: str
    question_id: str
    wrong_count: int
    correct_after_wrong_count: int
    mastery_status: MasteryStatus
    last_practiced_at: datetime | None
    created_at: datetime | None
    # Question summary (not full question object)
    question_text: str | None = None
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None
    difficulty: str | None = None


class PaginatedMistakes(BaseModel):
    """Paginated list of mistakes."""
    items: list[MistakeListOut]
    total: int
    page: int
    page_size: int
    total_pages: int
    # Summary counts
    counts: dict[str, int]
