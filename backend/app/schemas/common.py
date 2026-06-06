"""Shared pydantic models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MaterialFileType(str, Enum):
    pdf = "pdf"
    txt = "txt"
    md = "md"
    docx = "docx"
    csv = "csv"
    json = "json"
    pasted = "pasted"


class MaterialStatus(str, Enum):
    uploaded = "uploaded"
    extracted = "extracted"
    failed = "failed"
    manual = "manual"


class QuestionSetMode(str, Enum):
    extract_existing = "extract_existing"
    generate_mcq = "generate_mcq"
    generate_short = "generate_short"


class QuestionSource(str, Enum):
    extracted = "extracted"
    ai_generated = "ai_generated"
    manual = "manual"


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuizMode(str, Enum):
    practice = "practice"
    exam = "exam"
    mistakes = "mistakes"


class MasteryStatus(str, Enum):
    new_mistake = "new_mistake"
    needs_practice = "needs_practice"
    improving = "improving"
    mastered = "mastered"


class AIProvider(str, Enum):
    openai = "openai"
    anthropic = "anthropic"
    google = "google"
    none = "none"


class Option(BaseModel):
    key: str = Field(min_length=1, max_length=4)
    text: str


class GeneratedQuestion(BaseModel):
    """Output of the generator services, before persistence."""
    model_config = ConfigDict(extra="ignore")

    question_text: str
    options: list[Option] = []
    correct_answer: str | None = None
    explanation: str | None = None
    key_points: str | None = None
    difficulty: Difficulty | None = None
    topic: str | None = None
    chapter: str | None = None
    source_chunk: str | None = None


class TimestampedModel(BaseModel):
    id: str
    created_at: datetime | None = None


class APIError(BaseModel):
    detail: str
    code: str | None = None
    extra: dict[str, Any] | None = None
