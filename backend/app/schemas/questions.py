"""Request / response shapes for question sets and questions."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import Difficulty, Option, QuestionSetMode, QuestionSource


class GenerateMCQRequest(BaseModel):
    material_id: str
    title: str | None = None
    count: int = Field(default=10, ge=1, le=50)
    difficulty: Difficulty = Difficulty.medium
    mode: QuestionSetMode = QuestionSetMode.generate_mcq
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None


class ExtractExistingMCQsRequest(BaseModel):
    material_id: str
    title: str | None = None


class QuestionOut(BaseModel):
    id: str
    question_set_id: str
    material_id: str | None = None
    position: int
    question_text: str
    options: list[Option] = []
    correct_answer: str | None = None
    explanation: str | None = None
    key_points: str | None = None
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None
    difficulty: Difficulty | None = None
    source_type: QuestionSource
    created_at: datetime | None = None


class QuestionPublic(BaseModel):
    """Question shape sent to the student during a quiz (no correct_answer / explanation)."""
    id: str
    position: int
    question_text: str
    options: list[Option] = []


class QuestionSetOut(BaseModel):
    id: str
    material_id: str | None = None
    title: str
    mode: QuestionSetMode
    total_questions: int
    difficulty: Difficulty | None = None
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None
    created_at: datetime | None = None


class QuestionSetDetail(QuestionSetOut):
    questions: list[QuestionOut] = []
