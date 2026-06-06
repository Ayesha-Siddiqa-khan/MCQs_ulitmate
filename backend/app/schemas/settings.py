"""User settings (AI provider + key) shapes."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import AIProvider, Difficulty


class UserSettingsOut(BaseModel):
    ai_provider: AIProvider
    ai_model: str | None = None
    has_api_key: bool
    default_difficulty: Difficulty
    questions_per_quiz: int


class UpdateSettingsRequest(BaseModel):
    ai_provider: AIProvider | None = None
    ai_model: str | None = None
    ai_api_key: str | None = Field(default=None, description="Plain key; encrypted server-side then discarded.")
    default_difficulty: Difficulty | None = None
    questions_per_quiz: int | None = Field(default=None, ge=1, le=100)
    clear_api_key: bool = False
