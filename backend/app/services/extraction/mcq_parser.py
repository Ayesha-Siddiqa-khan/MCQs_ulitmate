"""Heuristic parser for solved MCQ PDFs / text.

Supports multiple MCQ formats:
- Numbered questions (1. or 1))
- Question No: headers with marks
- A/B/C/D options and ► bullet options
- Explicit answer keys (Answer: A, Ans: B, answer sheet at end)
- Bold/dark formatted correct answers (via font metadata)
- URL markers indicating bold/dark text
- Inline options on a single line
- Chapter/section headings
- Explanation paragraphs after options

Any format it cannot parse confidently is dropped rather than guessed.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.schemas.common import GeneratedQuestion, Option

# --- Regex patterns ---

# Question starts: "1. Question text", "Question No: 19 ( M - 1 ) ."
_Q_START = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,3})[.)]\s*(.*)$", re.MULTILINE)
_Q_NO_HEADER = re.compile(
    r"^\s*Question\s+No\s*:\s*(\d{1,3})\s*(?:\(\s*M\s*[-‐]\s*(\d+)\s*\))?\s*[.:\-]?\s*(.*)$",
    re.IGNORECASE,
)

# Options: "A) text", "(A) text", "A. text", "A - text", "A: text", "► text"
_OPTION_LINE = re.compile(r"^\s*\(?([A-Ga-g])[).:\-]\s*(.+)$")
_OPTION_BULLET = re.compile(r"^\s*[►▸▹◆●]\s*(.+)$")

# Answer patterns
_ANSWER_LINE = re.compile(
    r"(?:^|\s)(?:Answer|Ans|Key|Correct)\s*[:=\-]\s*([A-Ga-g])\b",
    re.IGNORECASE,
)
_INLINE_ANSWER_LINE = re.compile(
    r"^\s*(?:Answer|Ans|Correct(?:\s+Answer)?)\s*[:\-]?\s*\(?([A-Ga-g])\)?[).:\-]?\s*(.*?)\s*$",
    re.IGNORECASE,
)

# Answer key patterns
_ANSWER_KEY_HEADING = re.compile(
    r"(?im)^\s*(?:complete\s+)?(?:answer(?:\s+(?:key|sheet|section|list))\s*[:]*\s*$|correct\s+answers?\s*[:]*\s*$|solution\s+key\s*[:]*\s*$|answers?\s*[:]*\s*$)"
)
_ANSWER_KEY_ENTRY = re.compile(r"^\s*(\d{1,3})[.)]\s*\(?([A-Ga-g])\)?[).:\-]?\s*(.*)$")
_ANSWER_KEY_VERTICAL_NUMBER = re.compile(r"^\d{1,3}$")
_ANSWER_KEY_VERTICAL_ANSWER = re.compile(r"^[A-Ga-g]$")
_ANSWER_KEY_HEADER_CELL = re.compile(r"^(?:Q|Ans)$", re.IGNORECASE)

# Explanation patterns
_EXPLANATION_PREFIX = re.compile(r"^\s*Explanation\s*[:\-]?\s*(.*)$", re.IGNORECASE)

# Section/chapter headings
_CHAPTER_HEADING = re.compile(r"^\s*(Chapter\s*:?\s*\d+(?:\s*-\s*.+)?)\s*$", re.IGNORECASE)
_SECTION_HEADING = re.compile(
    r"^\s*(?:Section\s+[A-Z](?:\s*:\s*MCQs?)?(?:\s*\(([^)]+)\))?)\s*$",
    re.IGNORECASE,
)

# Noise
_PAGE_NOISE = re.compile(r"^\s*(?:Page\s+\d+|CS201\s+MCQs\s+Practice.*)\s*$", re.IGNORECASE)
_URL_MARKER = re.compile(r"\(?\s*https?://[^\s)]+\s*\)?", re.IGNORECASE)

# Inline option splitting
_INLINE_OPTION_PATTERN = re.compile(
    r"\(?([A-Ga-g])\s*[).:\-]\s*"
)


def _split_inline_options(line: str) -> list[Option]:
    """Split a line containing multiple inline options."""
    parts = _INLINE_OPTION_PATTERN.split(line)
    if len(parts) < 3:
        return []

    options: list[Option] = []
    for i in range(1, len(parts), 2):
        letter = parts[i].upper()
        text = parts[i + 1].strip() if i + 1 < len(parts) else ""
        text = re.sub(r"\s+\(?[A-Ga-g]\s*[).:\-].*$", "", text).strip()
        if letter in {"A", "B", "C", "D", "E", "F", "G"} and text:
            options.append(Option(key=letter, text=text))
    return options


def _extract_inline_answer(line: str) -> tuple[str, str]:
    """Extract answer from inline answer lines."""
    m = _INLINE_ANSWER_LINE.match(line)
    if not m:
        return "", ""
    letter = m.group(1).upper()
    text = m.group(2).strip()
    text = re.sub(r"\s*[).:\-]\s*$", "", text).strip()
    return letter, text


def _extract_section_title(line: str) -> str | None:
    """Extract topic from section heading."""
    m = _SECTION_HEADING.match(line)
    if not m:
        return None
    return m.group(1).strip() if m.group(1) else None


def _clean_url_markers(text: str) -> str:
    """Remove URL markers from option text."""
    return _URL_MARKER.sub("", text).strip()


def _has_url_marker(text: str) -> bool:
    """Check if text contains URL markers."""
    return bool(_URL_MARKER.search(text))


@dataclass
class _ParsedQuestion:
    number: int
    chapter: str | None
    question_text: str
    options: list[Option]
    correct_answer: str | None = None
    explanation: str | None = None
    answer_source: str = "missing"
    bold_option_key: str | None = None
    url_option_key: str | None = None


@dataclass
class _AnswerKeyItem:
    answer: str
    explanation: str | None = None


@dataclass
class BoldDetectionResult:
    """Result of bold/dark text detection for a question."""
    option_bold_flags: dict[str, bool] = field(default_factory=dict)
    option_url_flags: dict[str, bool] = field(default_factory=dict)
    detected_bold_key: str | None = None
    detected_url_key: str | None = None


def _detect_bold_from_rich_lines(
    question_text: str,
    option_texts: dict[str, str],
    rich_lines_for_page: list,
    question_y: float | None = None,
) -> BoldDetectionResult:
    """Detect bold options from rich text lines with font metadata.

    Args:
        question_text: The question text for context
        option_texts: Dict mapping option key to option text
        rich_lines_for_page: List of RichTextLine objects for the page
        question_y: Approximate Y position of the question

    Returns:
        BoldDetectionResult with bold/url detection info
    """
    result = BoldDetectionResult()

    if not rich_lines_for_page or not option_texts:
        return result

    # For each option, check if any of its text appears bold in the rich lines
    for key, opt_text in option_texts.items():
        cleaned = _clean_url_markers(opt_text).lower()
        if not cleaned:
            continue

        bold_found = False
        url_found = False

        for rl in rich_lines_for_page:
            line_text = rl.text.lower()
            # Check if this line contains the option text
            if cleaned in line_text or rl.text.strip().lower() == opt_text.strip().lower():
                # Check for bold
                if rl.has_bold and rl.bold_ratio > 0.5:
                    bold_found = True
                # Check for URL marker
                if _has_url_marker(rl.text):
                    url_found = True

        result.option_bold_flags[key] = bold_found
        result.option_url_flags[key] = url_found

    # Determine which option is the bold one (if exactly one)
    bold_keys = [k for k, v in result.option_bold_flags.items() if v]
    if len(bold_keys) == 1:
        result.detected_bold_key = bold_keys[0]

    # Determine which option has URL marker (if exactly one)
    url_keys = [k for k, v in result.option_url_flags.items() if v]
    if len(url_keys) == 1:
        result.detected_url_key = url_keys[0]

    return result


def extract_existing_mcqs(text: str) -> list[GeneratedQuestion]:
    """Extract MCQs from text. Returns questions with or without answers."""
    if not text or not text.strip():
        return []

    question_text, key_text = _split_answer_key(text)
    answer_key = _parse_answer_key(key_text)
    parsed_questions = _parse_questions(question_text)

    questions: list[GeneratedQuestion] = []
    for parsed in parsed_questions:
        key_item = answer_key.get((_chapter_key(parsed.chapter), parsed.number)) or answer_key.get((None, parsed.number))
        correct_answer = parsed.correct_answer or (key_item.answer if key_item else None)
        explanation = parsed.explanation or (key_item.explanation if key_item else None)

        # Determine answer source
        answer_source = parsed.answer_source
        if correct_answer and answer_source == "missing":
            if key_item:
                answer_source = "explicit_answer_key"
            elif parsed.bold_option_key:
                answer_source = "bold_format"
            elif parsed.url_option_key:
                answer_source = "url_marker"

        questions.append(
            GeneratedQuestion(
                question_text=parsed.question_text,
                options=parsed.options,
                correct_answer=correct_answer,
                explanation=explanation,
                chapter=parsed.chapter,
            )
        )
    return questions


def extract_existing_mcqs_with_rich_text(
    text: str,
    rich_lines: list[RichTextLine] | None = None,
) -> list[GeneratedQuestion]:
    """Extract MCQs with optional bold detection from rich text metadata.

    When rich_lines (from pymupdf) are provided, bold/dark option detection
    is applied to identify correct answers from formatting.
    """
    if not text or not text.strip():
        return []

    question_text, key_text = _split_answer_key(text)
    answer_key = _parse_answer_key(key_text)
    parsed_questions = _parse_questions(question_text)

    # First pass: look up answers from answer key
    for parsed in parsed_questions:
        key_item = answer_key.get((_chapter_key(parsed.chapter), parsed.number)) or answer_key.get((None, parsed.number))
        if key_item:
            parsed.correct_answer = key_item.answer
            parsed.answer_source = "explicit_answer_key"
            if key_item.explanation:
                parsed.explanation = key_item.explanation

    # Second pass: apply bold detection only to questions without answers
    if rich_lines:
        _apply_bold_detection(parsed_questions, rich_lines)

    questions: list[GeneratedQuestion] = []
    for parsed in parsed_questions:
        # Determine final answer source
        answer_source = parsed.answer_source
        if parsed.correct_answer and answer_source == "missing":
            if parsed.bold_option_key:
                answer_source = "bold_format"
            elif parsed.url_option_key:
                answer_source = "url_marker"

        questions.append(
            GeneratedQuestion(
                question_text=parsed.question_text,
                options=parsed.options,
                correct_answer=parsed.correct_answer,
                explanation=parsed.explanation,
                chapter=parsed.chapter,
            )
        )
    return questions


def _apply_bold_detection(
    parsed_questions: list[_ParsedQuestion],
    rich_lines: list[RichTextLine],
) -> None:
    """Apply bold detection to parsed questions using rich text metadata."""
    if not rich_lines:
        return

    # Group rich_lines by page (approximate — all lines passed in are from same extraction)
    # For now, use all rich_lines for all questions (best effort)
    all_rich_lines = rich_lines

    for parsed in parsed_questions:
        if len(parsed.options) < 2:
            continue

        # Skip if already has answer from key or inline
        if parsed.correct_answer:
            continue

        option_texts = {opt.key: opt.text for opt in parsed.options}
        bold_result = _detect_bold_from_rich_lines(
            question_text=parsed.question_text,
            option_texts=option_texts,
            rich_lines_for_page=all_rich_lines,
        )

        # Use bold detection result
        if bold_result.detected_bold_key:
            parsed.bold_option_key = bold_result.detected_bold_key
            parsed.answer_source = "bold_format"
        elif bold_result.detected_url_key:
            parsed.url_option_key = bold_result.detected_url_key
            parsed.answer_source = "url_marker"


@dataclass
class ExtractionResult:
    """Extraction output with questions and answer-coverage stats."""
    questions: list[GeneratedQuestion]
    total: int
    with_answers: int
    without_answers: int
    has_answer_key: bool
    answer_sources: dict[str, int] = field(default_factory=dict)


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
    answer_sources: dict[str, int] = field(default_factory=dict)


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


def preview_mcqs_with_rich_text(
    text: str,
    rich_lines: list[RichTextLine] | None = None,
) -> ExtractionPreview:
    """Preview MCQs with optional bold detection for answer coverage."""
    if not text or not text.strip():
        return ExtractionPreview(0, 0, 0, 0, 0)

    question_text, key_text = _split_answer_key(text)
    answer_key = _parse_answer_key(key_text)
    parsed_questions = _parse_questions(question_text)

    # First pass: look up answers from answer key
    for parsed in parsed_questions:
        key_item = answer_key.get((_chapter_key(parsed.chapter), parsed.number)) or answer_key.get((None, parsed.number))
        if key_item:
            parsed.correct_answer = key_item.answer
            parsed.answer_source = "explicit_answer_key"

    # Second pass: apply bold detection only to questions without answers
    if rich_lines:
        _apply_bold_detection(parsed_questions, rich_lines)

    total = len(parsed_questions)
    with_answers = 0
    without_answers = 0
    with_explanations = 0
    answer_sources: dict[str, int] = {}

    for parsed in parsed_questions:
        has_answer = parsed.correct_answer is not None or parsed.bold_option_key is not None or parsed.url_option_key is not None
        if has_answer:
            with_answers += 1
        else:
            without_answers += 1

        # Track answer sources
        if parsed.correct_answer:
            src = parsed.answer_source
            answer_sources[src] = answer_sources.get(src, 0) + 1

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
        answer_sources=answer_sources,
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
    explanation_parts: list[str] = []
    collecting_explanation = False
    pending_bullet_options: list[str] = []

    def flush() -> None:
        nonlocal current_q, current_number, options, answer, explanation_parts, collecting_explanation, pending_bullet_options
        if current_q is not None and current_number is not None and options:
            qtext = " ".join(s.strip() for s in current_q if s.strip()).strip()
            if qtext and len(options) >= 2:
                explanation = " ".join(explanation_parts).strip() if explanation_parts else None
                qtext = _clean_url_markers(qtext)
                questions.append(
                    _ParsedQuestion(
                        number=current_number,
                        chapter=current_section_title or current_chapter,
                        question_text=qtext,
                        options=options,
                        correct_answer=answer.upper() if answer else None,
                        explanation=explanation,
                    )
                )
        current_q = None
        current_number = None
        options = []
        answer = None
        explanation_parts = []
        collecting_explanation = False
        pending_bullet_options = []

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line.strip():
            # Empty line may signal end of explanation
            if collecting_explanation and explanation_parts:
                collecting_explanation = False
            continue

        # Check for section headings
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

        # Check for Question No: header format
        m_qno = _Q_NO_HEADER.match(line)
        if m_qno:
            flush()
            current_number = int(m_qno.group(1))
            qtext_after = m_qno.group(3).strip() if m_qno.group(3) else ""
            qtext_after = _clean_url_markers(qtext_after)
            current_q = [qtext_after] if qtext_after else []
            collecting_explanation = False
            continue

        # Check for standard numbered question
        m_q = _Q_START.match(line)
        if m_q:
            flush()
            current_number = int(m_q.group(1))
            current_q = [m_q.group(2).strip()]
            collecting_explanation = False
            continue

        # If we're collecting explanation, keep adding lines
        if collecting_explanation and current_q is not None:
            explanation_parts.append(line.strip())
            continue

        # Check for explanation prefix
        m_expl = _EXPLANATION_PREFIX.match(line)
        if m_expl and current_q is not None:
            collecting_explanation = True
            if m_expl.group(1).strip():
                explanation_parts.append(m_expl.group(1).strip())
            continue

        # Check for inline answer lines
        letter, answer_text = _extract_inline_answer(line)
        if letter:
            answer = letter
            collecting_explanation = False
            continue

        m_a = _ANSWER_LINE.match(line)
        if m_a:
            answer = m_a.group(1).upper()
            collecting_explanation = False
            continue

        # Check for ► bullet options
        m_bullet = _OPTION_BULLET.match(line)
        if m_bullet and current_q is not None:
            collecting_explanation = False
            opt_text = _clean_url_markers(m_bullet.group(1).strip())
            if opt_text:
                pending_bullet_options.append(opt_text)
                # Map to letter based on position
                idx = len(pending_bullet_options) - 1
                if idx < 7:  # A-G
                    key = chr(ord("A") + idx)
                    options.append(Option(key=key, text=opt_text))
            continue

        # Check for inline options on a single line
        if current_q is not None and not options:
            option_marker_count = len(re.findall(r"(?:^|\s)\(?[A-Ga-g]\s*[).:\-]", line))
            if option_marker_count >= 2:
                inline_opts = _split_inline_options(line)
                if len(inline_opts) >= 2:
                    options.extend(inline_opts)
                    collecting_explanation = False
                    continue

        # Check for standard lettered options
        m_o = _OPTION_LINE.match(line)
        if m_o and current_q is not None:
            collecting_explanation = False
            options.append(Option(key=m_o.group(1).upper(), text=m_o.group(2).strip()))
            continue

        if _PAGE_NOISE.match(line):
            continue

        # Continuation of question stem (before options)
        if current_q is not None and not options:
            current_q.append(line.strip())
            continue

        # Continuation of wrapped option line
        if current_q is not None and options:
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
        if answer.upper() not in {"A", "B", "C", "D", "E", "F", "G"}:
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
