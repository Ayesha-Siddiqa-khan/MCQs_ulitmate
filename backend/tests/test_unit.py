"""Pure-unit tests for parsing and scoring (no Supabase required)."""
from __future__ import annotations

from fastapi import status

from app.api.routes.auth import _signup_error_response
from app.api.routes.materials import _clean_extracted_text
from app.schemas.common import MasteryStatus
from app.services.extraction.mcq_parser import extract_existing_mcqs
from app.services.quiz.mistake_service import update_mistake_bank
from app.services.quiz.scoring_service import is_correct, score_attempt


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, db: _FakeDb):
        self.db = db
        self.operation = ""
        self.payload = None

    def select(self, *_args):
        self.operation = "select"
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, *_args):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        if self.operation == "select":
            return self.db.existing_response
        if self.operation == "insert":
            self.db.inserts.append(self.payload)
            return _FakeResponse([self.payload])
        if self.operation == "update":
            self.db.updates.append(self.payload)
            return _FakeResponse([self.payload])
        raise AssertionError(f"unexpected operation {self.operation}")


class _FakeDb:
    def __init__(self, existing_response):
        self.existing_response = existing_response
        self.inserts = []
        self.updates = []

    def table(self, name: str):
        assert name == "mistake_bank"
        return _FakeTable(self)


def test_scoring_basic() -> None:
    items = [
        ("A", "A"),  # correct
        ("B", "A"),  # wrong
        (None, "A"),  # unanswered
        ("c", "C"),  # correct (case-insensitive)
    ]
    b = score_attempt(items)
    assert b.correct == 2
    assert b.incorrect == 1
    assert b.unanswered == 1
    assert b.total == 4
    assert b.percentage == 50.0


def test_is_correct_handles_no_key() -> None:
    assert is_correct("A", None) is None
    assert is_correct(None, "A") is None
    assert is_correct("B", "B") is True
    assert is_correct(" b ", "B") is True
    assert is_correct("A", "B") is False


def test_clean_extracted_text_removes_nul_bytes() -> None:
    assert _clean_extracted_text("A\x00B\nC") == "AB\nC"


def test_mistake_bank_creates_first_wrong_when_maybe_single_returns_none() -> None:
    db = _FakeDb(existing_response=None)

    update_mistake_bank(
        db=db,  # type: ignore[arg-type]
        user_id="user-1",
        question_id="question-1",
        question_attempt_id="attempt-1",
        is_correct=False,
    )

    assert db.updates == []
    assert len(db.inserts) == 1
    assert db.inserts[0]["mastery_status"] == MasteryStatus.new_mistake.value
    assert db.inserts[0]["wrong_count"] == 1
    assert db.inserts[0]["latest_attempt_id"] == "attempt-1"


def test_mistake_bank_updates_existing_wrong() -> None:
    db = _FakeDb(
        existing_response=_FakeResponse(
            {
                "id": "mistake-1",
                "wrong_count": 1,
                "correct_after_wrong_count": 0,
                "mastery_status": MasteryStatus.new_mistake.value,
            }
        )
    )

    update_mistake_bank(
        db=db,  # type: ignore[arg-type]
        user_id="user-1",
        question_id="question-1",
        question_attempt_id="attempt-2",
        is_correct=False,
    )

    assert db.inserts == []
    assert len(db.updates) == 1
    assert db.updates[0]["mastery_status"] == MasteryStatus.needs_practice.value
    assert db.updates[0]["wrong_count"] == 2
    assert db.updates[0]["correct_after_wrong_count"] == 0


def test_mcq_parser_basic() -> None:
    text = """
1. What is the capital of France?
A) Berlin
B) Paris
C) Madrid
D) Rome
Answer: B

2. Photosynthesis occurs in which organelle?
(A) Mitochondria
(B) Chloroplast
(C) Nucleus
(D) Ribosome
Ans: B
""".strip()
    qs = extract_existing_mcqs(text)
    assert len(qs) == 2
    assert qs[0].question_text.lower().startswith("what is the capital")
    assert {o.key for o in qs[0].options} == {"A", "B", "C", "D"}
    assert qs[0].correct_answer == "B"
    assert qs[1].correct_answer == "B"


def test_mcq_parser_handles_number_on_own_line_and_key_at_end() -> None:
    text = """
CS201 MCQs Practice
1.
A program is best defined as:
A) A random set of computer words
B) A precise sequence of steps to solve a problem
C) Only a hardware device
D) Only a document

2.
Programming helps develop which skill the most?
A) Only drawing skill
B) Analytical and problem-solving skill
C) Only typing speed
D) Only memory power

Answer Key with Simple Explanations
1. B) A precise sequence of steps to solve a problem
 Explanation: A program is a clear sequence of instructions.
2. B) Analytical and problem-solving skill
 Explanation: Programming requires breaking problems into steps and solving them
logically.
""".strip()
    qs = extract_existing_mcqs(text)
    assert len(qs) == 2
    assert qs[0].question_text == "A program is best defined as:"
    assert qs[0].correct_answer == "B"
    assert qs[0].explanation == "A program is a clear sequence of instructions."
    assert qs[1].correct_answer == "B"
    assert qs[1].explanation == "Programming requires breaking problems into steps and solving them logically."


def test_mcq_parser_handles_chapter_wise_vertical_answer_key() -> None:
    text = """
Chapter 1
1. First chapter question one?
A. Choice A
B. Choice B
C. Choice C
D. Choice D
2. First chapter question two?
A. Choice A
B. Choice B
C. Choice C
D. Choice D

Chapter 2 - Algebra
1. Second chapter question one?
A. Choice A
B. Choice B
C. Choice C
D. Choice D
2. Missing answer key question?
A. Choice A
B. Choice B
C. Choice C
D. Choice D

Answer Key
Answers are placed chapter-wise for quick checking.
Chapter 1
Q
Ans
1
B
2
C
Chapter 2 - Algebra
Q
Ans
1
D
2
-
""".strip()
    qs = extract_existing_mcqs(text)
    assert len(qs) == 4
    assert [q.chapter for q in qs] == ["Chapter 1", "Chapter 1", "Chapter 2 - Algebra", "Chapter 2 - Algebra"]
    assert [q.correct_answer for q in qs] == ["B", "C", "D", None]


def test_mcq_parser_drops_garbage() -> None:
    text = "just a paragraph with no questions at all."
    assert extract_existing_mcqs(text) == []


def test_mcq_parser_detects_answer_sheet_heading() -> None:
    text = """
1. What is 2+2?
A. 3
B. 4
C. 5
D. 6

2. What is 3+3?
A. 5
B. 6
C. 7
D. 8

Answer Sheet
1. B
2. B
""".strip()
    qs = extract_existing_mcqs(text)
    assert len(qs) == 2
    assert qs[0].correct_answer == "B"
    assert qs[1].correct_answer == "B"


def test_mcq_parser_detects_answers_heading() -> None:
    text = """
1. Capital of France?
A. London
B. Paris
C. Berlin
D. Madrid

Answers
1. B
""".strip()
    qs = extract_existing_mcqs(text)
    assert len(qs) == 1
    assert qs[0].correct_answer == "B"


def test_mcq_parser_detects_correct_answers_heading() -> None:
    text = """
1. Color of sky?
A. Green
B. Red
C. Blue
D. Yellow

Correct Answers
1. C
""".strip()
    qs = extract_existing_mcqs(text)
    assert len(qs) == 1
    assert qs[0].correct_answer == "C"


def test_signup_error_response_handles_invalid_email() -> None:
    code, message = _signup_error_response(Exception('Email address "abc@gmail.com" is invalid'))
    assert code == status.HTTP_400_BAD_REQUEST
    assert message == "Use a valid email address that can receive confirmation email."


def test_signup_error_response_handles_rate_limit() -> None:
    code, message = _signup_error_response(Exception("email rate limit exceeded"))
    assert code == status.HTTP_429_TOO_MANY_REQUESTS
    assert message == "Signup email limit reached. Wait before trying again, or configure Supabase SMTP."
