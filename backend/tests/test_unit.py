"""Pure-unit tests for parsing and scoring (no Supabase required)."""
from __future__ import annotations

from fastapi import status

from app.api.routes.auth import _signup_error_response
from app.services.extraction.mcq_parser import extract_existing_mcqs
from app.services.quiz.scoring_service import is_correct, score_attempt


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


def test_mcq_parser_drops_garbage() -> None:
    text = "just a paragraph with no questions at all."
    assert extract_existing_mcqs(text) == []


def test_signup_error_response_handles_invalid_email() -> None:
    code, message = _signup_error_response(Exception('Email address "abc@gmail.com" is invalid'))
    assert code == status.HTTP_400_BAD_REQUEST
    assert message == "Use a valid email address that can receive confirmation email."


def test_signup_error_response_handles_rate_limit() -> None:
    code, message = _signup_error_response(Exception("email rate limit exceeded"))
    assert code == status.HTTP_429_TOO_MANY_REQUESTS
    assert message == "Signup email limit reached. Wait before trying again, or configure Supabase SMTP."
