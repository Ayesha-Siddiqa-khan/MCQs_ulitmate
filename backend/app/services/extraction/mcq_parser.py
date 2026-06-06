"""Heuristic parser for solved MCQ PDFs / text.

This is mode 1 of the generator. It does NOT call an LLM. It scans for
patterns like:

    1. Question text here?
    A) option one
    B) option two
    C) option three
    D) option four
    Answer: B

Real-world MCQ books vary wildly. This parser handles the most common shapes
and returns a list of GeneratedQuestion (with `source_type == 'extracted'`).
Anything it cannot parse confidently is dropped rather than guessed.
"""
from __future__ import annotations

import re

from app.schemas.common import GeneratedQuestion, Option

# Allow both numeric ("1.", "1)") and roman/letter starts.
_Q_START = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,3})[.)]\s+(.*)", re.MULTILINE)
_OPTION_LINE = re.compile(r"^\s*\(?([A-Da-d])[).:\-]\s*(.+)$")
_ANSWER_LINE = re.compile(
    r"^\s*(?:Answer|Ans|Correct(?:\s+Answer)?)\s*[:\-]?\s*\(?([A-Da-d])\)?\s*\.?\s*$",
    re.IGNORECASE,
)


def extract_existing_mcqs(text: str) -> list[GeneratedQuestion]:
    if not text or not text.strip():
        return []

    lines = text.splitlines()
    questions: list[GeneratedQuestion] = []

    current_q: list[str] | None = None
    options: list[Option] = []
    answer: str | None = None

    def flush() -> None:
        nonlocal current_q, options, answer
        if current_q and options:
            qtext = " ".join(s.strip() for s in current_q if s.strip()).strip()
            if qtext and len(options) >= 2:
                questions.append(
                    GeneratedQuestion(
                        question_text=qtext,
                        options=options,
                        correct_answer=(answer.upper() if answer else None),
                    )
                )
        current_q = None
        options = []
        answer = None

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line.strip():
            continue

        m_q = _Q_START.match(line)
        if m_q:
            flush()
            current_q = [m_q.group(2).strip()]
            continue

        m_a = _ANSWER_LINE.match(line)
        if m_a:
            answer = m_a.group(1).upper()
            continue

        m_o = _OPTION_LINE.match(line)
        if m_o and current_q is not None:
            options.append(Option(key=m_o.group(1).upper(), text=m_o.group(2).strip()))
            continue

        if current_q is not None and not options:
            # Continuation of the question stem
            current_q.append(line.strip())

    flush()
    return questions
