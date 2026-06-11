"""Heuristic parser for solved MCQ PDFs / text.

This is mode 1 of the generator. It does NOT call an LLM. It scans for
patterns like:

    1. Question text here?
    A) option one
    B) option two
    C) option three
    D) option four
    Answer: B

It also supports inline options on one line:

    1. Question text here?
    A) option one B) option two C) option three D) option four
    Ans: B) option two

Real-world MCQ books vary wildly. This parser handles the most common shapes
and returns a list of GeneratedQuestion (with `source_type == 'extracted'`).
Anything it cannot parse confidently is dropped rather than guessed.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.common import GeneratedQuestion, Option

# Allow both numeric ("1.", "1)") and roman/letter starts.
_Q_START = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,3})[.)]\s*(.*)$", re.MULTILINE)
_OPTION_LINE = re.compile(r"^\s*\(?([A-Da-d])[).:\-]\s*(.+)$")
_ANSWER_LINE = re.compile(
    r"^\s*(?:Answer|Ans|Correct(?:\s+Answer)?)\s*[:\-]?\s*\(?([A-Da-d])\)?\s*\.?\s*(?:.*)$",
    re.IGNORECASE,
)
_INLINE_ANSWER_LINE = re.compile(
    r"^\s*(?:Answer|Ans|Correct(?:\s+Answer)?)\s*[:\-]?\s*\(?([A-Da-d])\)?[).:\-]?\s*(.*?)\s*$",
    re.IGNORECASE,
)
_ANSWER_KEY_HEADING = re.compile(
    r"(?im)^\s*(?:complete\s+)?(?:answer(?:\s+(?:key|sheet|section|list))\b|correct\s+answers?\b|solution\s+key\b|answers\b|answer\s*$)"
)
_ANSWER_KEY_ENTRY = re.compile(r"^\s*(\d{1,3})[.)]\s*\(?([A-Da-d])\)?[).:\-]?\s*(.*)$")
_ANSWER_KEY_VERTICAL_NUMBER = re.compile(r"^\d{1,3}$")
_ANSWER_KEY_VERTICAL_ANSWER = re.compile(r"^[A-Da-d]$")
_ANSWER_KEY_HEADER_CELL = re.compile(r"^(?:Q|Ans)$", re.IGNORECASE)
_EXPLANATION_PREFIX = re.compile(r"^\s*Explanation\s*[:\-]?\s*(.*)$", re.IGNORECASE)
_CHAPTER_HEADING = re.compile(r"^\s*(Chapter\s+\d+(?:\s*-\s*.+)?)\s*$", re.IGNORECASE)
_SECTION_HEADING = re.compile(
    r"^\s*(?:Section\s+[A-Z](?:\s*:\s*MCQs?)?(?:\s*\(([^)]+)\))?)\s*$",
    re.IGNORECASE,
)
_PAGE_NOISE = re.compile(r"^\s*(?:Page\s+\d+|CS201\s+MCQs\s+Practice.*)\s*$", re.IGNORECASE)

# Regex to split inline options on a single line.
# Matches patterns like: A) Solid, B) Liquid, (C) Gas, D - Plasma, E: Plasma
_INLINE_OPTION_PATTERN = re.compile(
    r"\(?([A-Da-d])\s*[).:\-]\s*"
)


def _split_inline_options(line: str) -> list[Option]:
    """Split a line containing multiple inline options into a list of Option objects.

    Supports formats like:
        A) Solid B) Liquid C) Gas D) Plasma
        (A) Solid (B) Liquid (C) Gas (D) Plasma
        A - Solid B - Liquid C - Gas D - Plasma
        A: Solid B: Liquid C: Gas D: Plasma
        A. Solid B. Liquid C. Gas D. Plasma
    """
    parts = _INLINE_OPTION_PATTERN.split(line)
    # split returns: ['text_before', 'A', 'text_after_A', 'B', ...]
    if len(parts) < 3:
        return []

    options: list[Option] = []
    # parts[0] is text before the first option marker (usually empty or whitespace)
    # Then alternating: letter, text for that option
    for i in range(1, len(parts), 2):
        letter = parts[i].upper()
        text = parts[i + 1].strip() if i + 1 < len(parts) else ""
        # Clean trailing option markers that may have been captured
        text = re.sub(r"\s+\(?[A-Da-d]\s*[).:\-].*$", "", text).strip()
        if letter in {"A", "B", "C", "D"} and text:
            options.append(Option(key=letter, text=text))
    return options


def _extract_inline_answer(line: str) -> tuple[str, str]:
    """Extract the answer letter and optional answer text from an inline answer line.

    Returns (letter, text). If no text after the letter, text is empty.
    Examples:
        'Ans: A) Solid' -> ('A', 'Solid')
        'Ans: A' -> ('A', '')
        'Answer: B' -> ('B', '')
        'Correct Answer: C' -> ('C', '')
    """
    m = _INLINE_ANSWER_LINE.match(line)
    if not m:
        return "", ""
    letter = m.group(1).upper()
    text = m.group(2).strip()
    # Clean trailing punctuation or option markers from text
    text = re.sub(r"\s*[).:\-]\s*$", "", text).strip()
    return letter, text


def _extract_section_title(line: str) -> str | None:
    """Extract the topic/title from a section heading like 'Section A: MCQs (Phase Changes & Gas Laws)'.

    Returns the parenthetical content if present, otherwise None.
    """
    m = _SECTION_HEADING.match(line)
    if not m:
        return None
    return m.group(1).strip() if m.group(1) else None


@dataclass
class _ParsedQuestion:
    number: int
    chapter: str | None
    question_text: str
    options: list[Option]
    correct_answer: str | None = None


@dataclass
class _AnswerKeyItem:
    answer: str
    explanation: str | None = None


def extract_existing_mcqs(text: str) -> list[GeneratedQuestion]:
    """Extract MCQs from text. Returns questions with or without answers.

    Questions without an answer key are returned with correct_answer=None
    so the caller can offer practice-without-grading or manual answer entry.
    """
    if not text or not text.strip():
        return []

    question_text, key_text = _split_answer_key(text)
    answer_key = _parse_answer_key(key_text)
    parsed_questions = _parse_questions(question_text)

    questions: list[GeneratedQuestion] = []
    for parsed in parsed_questions:
        key_item = answer_key.get((_chapter_key(parsed.chapter), parsed.number)) or answer_key.get((None, parsed.number))
        correct_answer = parsed.correct_answer or (key_item.answer if key_item else None)
        questions.append(
            GeneratedQuestion(
                question_text=parsed.question_text,
                options=parsed.options,
                correct_answer=correct_answer,
                explanation=key_item.explanation if key_item else None,
                chapter=parsed.chapter,
            )
        )
    return questions


@dataclass
class ExtractionResult:
    """Extraction output with questions and answer-coverage stats."""
    questions: list[GeneratedQuestion]
    total: int
    with_answers: int
    without_answers: int
    has_answer_key: bool


def extract_existing_mcqs_with_stats(text: str) -> ExtractionResult:
    """Extract MCQs and return stats about answer coverage."""
    questions = extract_existing_mcqs(text)
    with_answers = sum(1 for q in questions if q.correct_answer is not None)
    return ExtractionResult(
        questions=questions,
        total=len(questions),
        with_answers=with_answers,
        without_answers=len(questions) - with_answers,
        has_answer_key=with_answers > 0,
    )


@dataclass
class ExtractionPreview:
    total_detected: int
    with_answers: int
    without_answers: int
    with_explanations: int
    duplicates: int


def preview_mcqs(text: str) -> ExtractionPreview:
    """Count all detected MCQs including those without answers (for preview)."""
    if not text or not text.strip():
        return ExtractionPreview(0, 0, 0, 0, 0)

    question_text, key_text = _split_answer_key(text)
    answer_key = _parse_answer_key(key_text)
    parsed_questions = _parse_questions(question_text)

    total = len(parsed_questions)
    with_answers = 0
    without_answers = 0
    with_explanations = 0

    for parsed in parsed_questions:
        key_item = answer_key.get((_chapter_key(parsed.chapter), parsed.number)) or answer_key.get((None, parsed.number))
        has_answer = parsed.correct_answer is not None or (key_item is not None)
        if has_answer:
            with_answers += 1
        else:
            without_answers += 1
        if key_item and key_item.explanation:
            with_explanations += 1

    # Count duplicates by normalized question text
    seen: dict[str, int] = {}
    for parsed in parsed_questions:
        normalized = parsed.question_text.strip().lower()
        seen[normalized] = seen.get(normalized, 0) + 1
    duplicates = sum(1 for count in seen.values() if count > 1)

    return ExtractionPreview(
        total_detected=total,
        with_answers=with_answers,
        without_answers=without_answers,
        with_explanations=with_explanations,
        duplicates=duplicates,
    )


def _split_answer_key(text: str) -> tuple[str, str]:
    match = _ANSWER_KEY_HEADING.search(text)
    if not match:
        return text, ""
    return text[: match.start()], text[match.start() :]


def _parse_questions(text: str) -> list[_ParsedQuestion]:
    lines = text.splitlines()
    questions: list[_ParsedQuestion] = []

    current_q: list[str] | None = None
    current_number: int | None = None
    current_chapter: str | None = None
    current_section_title: str | None = None
    options: list[Option] = []
    answer: str | None = None

    def flush() -> None:
        nonlocal current_q, current_number, options, answer
        if current_q is not None and current_number is not None and options:
            qtext = " ".join(s.strip() for s in current_q if s.strip()).strip()
            if qtext and len(options) >= 2:
                questions.append(
                    _ParsedQuestion(
                        number=current_number,
                        chapter=current_section_title or current_chapter,
                        question_text=qtext,
                        options=options,
                        correct_answer=answer.upper() if answer else None,
                    )
                )
        current_q = None
        current_number = None
        options = []
        answer = None

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line.strip():
            continue

        # Check for section headings like "Section A: MCQs (Phase Changes & Gas Laws)"
        section_title = _extract_section_title(line)
        if section_title:
            flush()
            current_section_title = section_title
            continue

        chapter = _normalise_chapter(line)
        if chapter:
            flush()
            current_chapter = chapter
            current_section_title = None
            continue

        m_q = _Q_START.match(line)
        if m_q:
            flush()
            current_number = int(m_q.group(1))
            current_q = [m_q.group(2).strip()]
            continue

        # Check for inline answer lines like "Ans: A) Solid" or "Answer: B"
        # This must be checked BEFORE option parsing since Ans lines contain option-like patterns
        letter, answer_text = _extract_inline_answer(line)
        if letter:
            answer = letter
            continue

        m_a = _ANSWER_LINE.match(line)
        if m_a:
            answer = m_a.group(1).upper()
            continue

        m_o = _OPTION_LINE.match(line)
        if m_o and current_q is not None:
            options.append(Option(key=m_o.group(1).upper(), text=m_o.group(2).strip()))
            continue

        # Check for inline options on a single line (e.g. "A) Solid B) Liquid C) Gas D) Plasma")
        if current_q is not None and not options:
            inline_opts = _split_inline_options(line)
            if len(inline_opts) >= 2:
                options.extend(inline_opts)
                continue

        if _PAGE_NOISE.match(line):
            continue

        if current_q is not None and not options:
            # Continuation of the question stem
            current_q.append(line.strip())
            continue

        if current_q is not None and options:
            # Continuation of a wrapped option line from PDF extraction.
            last = options[-1]
            last.text = f"{last.text} {line.strip()}".strip()

    flush()
    return questions


def _normalise_chapter(text: str) -> str | None:
    match = _CHAPTER_HEADING.match(text)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group(1).strip())


def _chapter_key(chapter: str | None) -> str | None:
    if not chapter:
        return None
    return re.sub(r"\s+", " ", chapter.strip()).casefold()


def _parse_answer_key(text: str) -> dict[tuple[str | None, int], _AnswerKeyItem]:
    if not text.strip():
        return {}

    answers: dict[tuple[str | None, int], _AnswerKeyItem] = {}
    current_chapter: str | None = None
    entry_chapter: str | None = None
    current_number: int | None = None
    current_answer: str | None = None
    explanation_parts: list[str] = []
    pending_vertical_number: int | None = None

    def store(chapter: str | None, number: int, answer: str, explanation: str | None = None) -> None:
        if answer.upper() not in {"A", "B", "C", "D"}:
            return
        answers[(_chapter_key(chapter), number)] = _AnswerKeyItem(
            answer=answer.upper(),
            explanation=explanation,
        )

    def flush() -> None:
        nonlocal entry_chapter, current_number, current_answer, explanation_parts
        if current_number is not None and current_answer:
            explanation = " ".join(part.strip() for part in explanation_parts if part.strip()).strip()
            store(entry_chapter, current_number, current_answer, explanation or None)
        entry_chapter = None
        current_number = None
        current_answer = None
        explanation_parts = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or _PAGE_NOISE.match(line) or _ANSWER_KEY_HEADING.match(line):
            continue

        chapter = _normalise_chapter(line)
        if chapter:
            flush()
            current_chapter = chapter
            pending_vertical_number = None
            continue

        if _ANSWER_KEY_HEADER_CELL.match(line):
            continue

        entry = _ANSWER_KEY_ENTRY.match(line)
        if entry:
            flush()
            entry_chapter = current_chapter
            current_number = int(entry.group(1))
            current_answer = entry.group(2).upper()
            explanation_parts = []
            remainder = entry.group(3).strip()
            if remainder.lower().startswith("explanation"):
                maybe_explanation = _EXPLANATION_PREFIX.match(remainder)
                if maybe_explanation and maybe_explanation.group(1).strip():
                    explanation_parts.append(maybe_explanation.group(1).strip())
            continue

        if _ANSWER_KEY_VERTICAL_NUMBER.match(line):
            flush()
            pending_vertical_number = int(line)
            continue

        if pending_vertical_number is not None:
            if _ANSWER_KEY_VERTICAL_ANSWER.match(line):
                store(current_chapter, pending_vertical_number, line)
            pending_vertical_number = None
            continue

        explanation = _EXPLANATION_PREFIX.match(line)
        if explanation and current_number is not None:
            if explanation.group(1).strip():
                explanation_parts.append(explanation.group(1).strip())
            continue

        if current_number is not None and explanation_parts and line[:1].islower():
            explanation_parts.append(line)

    flush()
    return answers
