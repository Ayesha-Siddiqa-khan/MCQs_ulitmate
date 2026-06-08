"""Quiz lifecycle pydantic shapes."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import QuizMode
from app.schemas.questions import QuestionOut, QuestionPublic


class StartQuizRequest(BaseModel):
    question_set_id: str
    mode: QuizMode = QuizMode.practice
    question_count: int | None = Field(default=None, ge=1)
    chapter: str | None = None
    topic: str | None = None


class StartQuizResponse(BaseModel):
    attempt_id: str
    question_set_id: str
    mode: QuizMode
    questions: list[QuestionPublic]
    started_at: datetime


class QuizAttemptDetail(BaseModel):
    attempt_id: str
    question_set_id: str
    mode: QuizMode
    total_questions: int
    is_submitted: bool
    questions: list[QuestionPublic]
    started_at: datetime


class AnswerRequest(BaseModel):
    question_id: str
    selected_answer: str | None = None
    is_marked: bool = False
    time_spent_seconds: int = Field(default=0, ge=0, le=86400)


class SubmitQuizRequest(BaseModel):
    answers: list[AnswerRequest] = []
    time_spent_seconds: int = Field(default=0, ge=0, le=86400)


class QuestionResult(BaseModel):
    question: QuestionOut
    selected_answer: str | None
    is_correct: bool | None
    is_marked: bool
    time_spent_seconds: int


class TopicBreakdown(BaseModel):
    label: str
    correct: int
    total: int


class QuizResult(BaseModel):
    attempt_id: str
    question_set_id: str
    score: int
    total_questions: int
    correct: int
    incorrect: int
    unanswered: int
    percentage: float
    time_spent_seconds: int
    submitted_at: datetime | None
    questions: list[QuestionResult]
    topic_breakdown: list[TopicBreakdown] = []
    difficulty_breakdown: list[TopicBreakdown] = []
