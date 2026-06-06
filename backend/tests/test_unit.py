"""Pure-unit tests for parsing and scoring (no Supabase required)."""
from __future__ import annotations

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


def test_mcq_parser_drops_garbage() -> None:
    text = "just a paragraph with no questions at all."
    assert extract_existing_mcqs(text) == []
