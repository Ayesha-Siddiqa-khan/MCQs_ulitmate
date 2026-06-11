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
    detection_signals: list[str] = field(default_factory=list)
    confidence: str = "low"


@dataclass
class _AnswerKeyItem:
    answer: str
    explanation: str | None = None


@dataclass
class BoldDetectionResult:
    """Result of bold/dark text detection for a question."""
    option_bold_flags: dict[str, bool] = field(default_factory=dict)
    option_url_flags: dict[str, bool] = field(default_factory=dict)
    option_visual_scores: dict[str, int] = field(default_factory=dict)
    option_signals: dict[str, list[str]] = field(default_factory=dict)
    detected_bold_key: str | None = None
    detected_url_key: str | None = None
    detected_answer_source: str | None = None
    confidence: str = "low"


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

    # Pre-filter: only consider lines that look like option lines
    _OPTION_LINE_RE = re.compile(
        r"^\s*[►▸▹◆●]\s*|[A-Ga-g]\s*[).:\-]\s*|\([A-Ga-g]\)\s*",
    )

    # Find the question text in rich lines to scope matching
    q_lower = question_text.lower().strip()[:40]  # first 40 chars for matching
    q_start_idx = 0
    q_end_idx = len(rich_lines_for_page)

    for i, rl in enumerate(rich_lines_for_page):
        if q_lower and q_lower in rl.text.lower():
            q_start_idx = i
            break

    # Find next question header to limit scope
    _Q_HEADER_RE = re.compile(r"question\s+no\s*:\s*\d+", re.IGNORECASE)
    for i in range(q_start_idx + 1, len(rich_lines_for_page)):
        if _Q_HEADER_RE.match(rich_lines_for_page[i].text.strip()):
            q_end_idx = i
            break

    # Only consider lines within the question's scope
    scoped_lines = rich_lines_for_page[q_start_idx:q_end_idx]

    option_rich_lines = []
    for rl in scoped_lines:
        text = rl.text.strip()
        if not text:
            continue
        if _OPTION_LINE_RE.match(text) or len(text) < 60:
            option_rich_lines.append(rl)

    # For each option, calculate visual score and detect signals
    for key, opt_text in option_texts.items():
        cleaned = _clean_url_markers(opt_text).lower().strip()
        if not cleaned:
            continue

        bold_found = False
        url_found = False
        visual_score = 0
        signals: list[str] = []

        for rl in option_rich_lines:
            line_text_lower = rl.text.lower()

            # Check if this line contains the option text
            if cleaned not in line_text_lower and rl.text.strip().lower() != opt_text.strip().lower():
                continue

            # Check individual bold spans
            for span in rl.spans:
                span_text = _clean_url_markers(span.text).lower().strip()
                if cleaned in span_text:
                    if span.is_bold:
                        bold_found = True
                        visual_score += 3
                        signals.append("bold_font")
                    # Check font size (larger = more emphasis)
                    if span.size and span.size > 12:
                        visual_score += 1
                        signals.append("larger_font")
                    # Check for underline (flags bit 0)
                    if span.flags & (1 << 0):
                        visual_score += 2
                        signals.append("underline")

            # Check for URL marker (weak signal)
            if _has_url_marker(rl.text):
                url_found = True
                visual_score += 1
                signals.append("url_marker")

        result.option_bold_flags[key] = bold_found
        result.option_url_flags[key] = url_found
        result.option_visual_scores[key] = visual_score
        result.option_signals[key] = signals

    # Determine the best answer based on visual scores
    if result.option_visual_scores:
        max_score = max(result.option_visual_scores.values())
        best_keys = [k for k, v in result.option_visual_scores.items() if v == max_score]

        if max_score > 0 and len(best_keys) == 1:
            best_key = best_keys[0]
            if result.option_bold_flags.get(best_key):
                result.detected_bold_key = best_key
                result.detected_answer_source = "bold_format"
                result.confidence = "high" if max_score >= 3 else "medium"
            elif result.option_url_flags.get(best_key):
                result.detected_url_key = best_key
                result.detected_answer_source = "url_marker"
                result.confidence = "medium"
            else:
                result.detected_answer_source = "format_uncertain"
                result.confidence = "low"
        elif max_score > 0:
            # Multiple options with same score - uncertain
            result.detected_answer_source = "format_uncertain"
            result.confidence = "low"

    # Determine URL marker if exactly one
    url_keys = [k for k, v in result.option_url_flags.items() if v]
    if len(url_keys) == 1 and not result.detected_bold_key:
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
    rich_lines: list[list[RichTextLine]] | list[RichTextLine] | None = None,
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
    rich_lines: list[list[RichTextLine]] | list[RichTextLine],
) -> None:
    """Apply bold detection to parsed questions using rich text metadata."""
    if not rich_lines:
        return

    # Flatten per-page rich_lines into a single list
    all_rich_lines: list[RichTextLine] = []
    for item in rich_lines:
        if isinstance(item, list):
            all_rich_lines.extend(item)
        else:
            all_rich_lines.append(item)

    if not all_rich_lines:
        return

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
            parsed.correct_answer = bold_result.detected_bold_key
            parsed.answer_source = bold_result.detected_answer_source or "bold_format"
            parsed.detection_signals = bold_result.option_signals.get(bold_result.detected_bold_key, [])
            parsed.confidence = bold_result.confidence
        elif bold_result.detected_url_key:
            parsed.url_option_key = bold_result.detected_url_key
            parsed.correct_answer = bold_result.detected_url_key
            parsed.answer_source = bold_result.detected_answer_source or "url_marker"
            parsed.detection_signals = bold_result.option_signals.get(bold_result.detected_url_key, [])
            parsed.confidence = bold_result.confidence
        elif bold_result.detected_answer_source == "format_uncertain":
            parsed.answer_source = "format_uncertain"
            parsed.confidence = "low"


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
    rich_lines: list[list[RichTextLine]] | list[RichTextLine] | None = None,
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


def preview_ocr_mcqs(text: str) -> ExtractionPreview:
    """Preview MCQs from OCR-extracted scanned PDF text."""
    questions = parse_ocr_mcqs(text)

    total = len(questions)
    with_answers = sum(1 for q in questions if q.correct_answer is not None)
    without_answers = total - with_answers
    with_explanations = 0

    # Count duplicates
    seen: dict[str, int] = {}
    for q in questions:
        normalized = q.options[0].text.strip().lower() if q.options else ""
        seen[normalized] = seen.get(normalized, 0) + 1
    duplicates = sum(1 for count in seen.values() if count > 1)

    answer_sources = {"ocr_detected": with_answers}

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

        # Continuation of wrapped option line — only for first option (to handle wraps)
        # After 2+ options, don't append to avoid capturing explanation text
        if current_q is not None and len(options) == 1:
            last = options[-1]
            stripped = line.strip()
            is_continuation = (
                len(stripped) < 40
                and not stripped.startswith(("http", "www", "http://", "https://"))
                and not re.match(r"^\d+[.)]", stripped)
                and not re.match(r"^Question\s+No", stripped, re.IGNORECASE)
                and "?" not in stripped
                and "------" not in stripped
                and not _EXPLANATION_PREFIX.match(stripped)
                and len(stripped.split()) <= 4
            )
            if is_continuation:
                last.text = f"{last.text} {stripped}".strip()

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


# --- OCR/Scanned PDF MCQ Parser ---

# Question header: "|Question No : 1 of 26 Marks: 1 (Budgeted Time 1 Min)"
# OCR may misread digits (e.g. "8" as "&"), so we allow common misreads
_OCR_QUESTION_HEADER = re.compile(
    r"Question\s+No\s*[:\.]?\s*(\d+|[&§])\s+of\s+(\d+)\s+Marks\s*:\s*(\d+)\s*\((?:Budgeted\s+Time\s+)?(\d+)\s*(?:Min|Minute)",
    re.IGNORECASE,
)

# Broader header match to catch questions even when digits are misread
_OCR_QUESTION_HEADER_LOOSE = re.compile(
    r"Question\s+No\s*[:\.]?\s*(\d+|[&§])\s+of\s+(\d+)\s+Marks",
    re.IGNORECASE,
)

# Map common OCR misreads of digits back to the actual digit
_OCR_DIGIT_MAP = {"&": "8", "§": "9", "O": "0", "o": "0", "l": "1", "I": "1"}

# MCQ indicator: "Please select your correct option"
_OCR_MCQ_MARKER = re.compile(r"Please\s+select\s+your\s+correct\s+option", re.IGNORECASE)

# Long-answer indicator: "Please click here to Add Answer"
_OCR_LONG_ANSWER_MARKER = re.compile(r"Please\s+click\s+here\s+to\s+Add\s+Answer", re.IGNORECASE)

# Correct marker (various OCR spellings)
_CORRECT_MARKER = re.compile(r"\b[Cc][Oo]?[Rr]?[Rr]?[Ee]?[Cc]?[Tt]\b")

# Noise lines to skip
_OCR_NOISE = re.compile(
    r"^\s*(?:Made\s+By|Whade\s+By|Wade\s+By|made\s+By|Uagqar|Ueagqar|Waqar|Wagar|Siddhu|S Us|Siddha|S ak|Ssiddhu|S ae)\b",
    re.IGNORECASE,
)

# OCR noise patterns to filter from option text
_OCR_OPTION_NOISE = re.compile(
    r"(?:^[©®™±×÷a]{1,3}\s*(?:ar|ara|ct)?\s*$|^\d{1,2}$|^[^a-zA-Z0-9]{2,}$|^\s*$|^c\s*a\s*$|^-\s*i\s*$)"
)

# Common OCR misreads of option noise
_OCR_GARBAGE = re.compile(
    r"^(?:[a]\s*$|[©®]\s*(?:ar|ara)?\s*$|\d{1,2}\s*$|_[\s_]*$|[\s_]*$|c\s*a\s*$|-\s*i\s*$)"
)


@dataclass
class OcrParsedQuestion:
    """A question parsed from OCR text of a scanned PDF."""
    question_number: int
    total_questions: int
    marks: int
    question_text: str
    options: list[Option]
    correct_answer: str | None = None
    answer_source: str = "missing"
    confidence: str = "low"
    is_mcq: bool = True
    page_number: int | None = None


def parse_ocr_mcqs(text: str) -> list[OcrParsedQuestion]:
    """Parse MCQs from OCR text of scanned/image-based PDFs.

    Supports the format:
        Question No : X of Y Marks: Z (Budgeted Time N Min)
        Question text...
        Answer ( Please select your correct option )
        Option 1
        correct
        Option 2
        ...
        Made By: ...

    Returns list of OcrParsedQuestion with correct_answer detected
    from "correct" markers when possible.
    """
    if not text or not text.strip():
        return []

    lines = text.split("\n")
    questions: list[OcrParsedQuestion] = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Check for question header
        m = _OCR_QUESTION_HEADER.search(line)
        if not m:
            i += 1
            continue

        q_num_str = m.group(1)
        # Map OCR misreads of digits
        q_num_str = _OCR_DIGIT_MAP.get(q_num_str, q_num_str)
        try:
            q_num = int(q_num_str)
        except ValueError:
            i += 1
            continue
        total = int(m.group(2))
        marks = int(m.group(3))

        # Collect question body lines (until we hit the answer section)
        i += 1
        question_lines: list[str] = []
        while i < len(lines):
            ln = lines[i].strip()
            if not ln:
                i += 1
                continue
            # Check for answer section marker
            if _OCR_MCQ_MARKER.search(ln) or _OCR_LONG_ANSWER_MARKER.search(ln):
                break
            # Skip noise
            if _OCR_NOISE.match(ln):
                i += 1
                continue
            question_lines.append(ln)
            i += 1

        question_text = " ".join(question_lines).strip()
        # Clean up common OCR artifacts
        question_text = re.sub(r"\s*=\s*$", "", question_text)
        question_text = re.sub(r"^\s*['\"]", "", question_text)

        # Check if this is an MCQ or long-answer question
        is_mcq = True
        if i < len(lines) and _OCR_LONG_ANSWER_MARKER.search(lines[i].strip()):
            is_mcq = False

        # Skip the answer marker line
        if i < len(lines) and (_OCR_MCQ_MARKER.search(lines[i].strip()) or _OCR_LONG_ANSWER_MARKER.search(lines[i].strip())):
            i += 1

        # Parse options (only for MCQs)
        options: list[Option] = []
        correct_idx: int | None = None

        if is_mcq:
            # Collect raw lines between answer marker and next question
            raw_lines: list[str] = []
            while i < len(lines):
                ln = lines[i].strip()
                i += 1
                if _OCR_QUESTION_HEADER.search(ln):
                    i -= 1
                    break
                if _OCR_NOISE.match(ln):
                    continue
                if not ln:
                    continue
                # Skip answer section artifacts
                if ln.startswith(("Answer", "lanswer", "lAnswer", "Ce SE", "a | CS")):
                    continue
                raw_lines.append(ln)

            # Single pass: collect options and detect correct marker
            option_lines: list[str] = []
            correct_line_idx: int | None = None

            for idx, ln in enumerate(raw_lines):
                stripped = ln.strip()

                # ALWAYS check for correct marker first — even on noise lines
                if _CORRECT_MARKER.search(stripped):
                    cleaned = _CORRECT_MARKER.sub("", stripped).strip()
                    cleaned = re.sub(r"^[.·•_\-\s]+", "", cleaned).strip()
                    cleaned = re.sub(r"\b(?:Wade|Made|Whade|Uagqar|Ueagqar|Waqar|Wagar|Siddhu|S Us|Siddha)\b.*$", "", cleaned, flags=re.IGNORECASE).strip()
                    cleaned = re.sub(r"^c\s*a\s*$", "", cleaned).strip()
                    cleaned = re.sub(r"^-\s*i\s*$", "", cleaned).strip()
                    if not cleaned or len(cleaned) <= 3:
                        # Pure correct marker — marks previous option
                        if option_lines:
                            correct_line_idx = len(option_lines) - 1
                        continue
                    # "correct" is embedded with real option text — keep cleaned text
                    stripped = cleaned

                # Skip noise lines
                if _OCR_NOISE.match(stripped):
                    continue
                # Skip single chars, numbers, radio symbols
                if len(stripped) <= 2:
                    continue
                if _OCR_OPTION_NOISE.match(stripped):
                    continue
                if _OCR_GARBAGE.match(stripped):
                    continue
                if re.match(r"^[^a-zA-Z0-9]+$", stripped):
                    continue
                if _OCR_QUESTION_HEADER_LOOSE.search(stripped):
                    continue
                if stripped.startswith(("Answer", "lanswer", "lAnswer", "Ce SE", "a | CS")):
                    continue

                option_lines.append(stripped)

            # Map to A/B/C/D
            keys = ["A", "B", "C", "D", "E", "F", "G"]
            for idx, text in enumerate(option_lines):
                if idx < len(keys):
                    options.append(Option(key=keys[idx], text=text))

            if correct_line_idx is not None and correct_line_idx < len(options):
                correct_idx = correct_line_idx

        correct_answer = None
        answer_source = "missing"
        confidence = "low"

        if correct_idx is not None and correct_idx < len(options):
            correct_answer = options[correct_idx].key
            answer_source = "visual_correct_marker"
            confidence = "high"
        elif is_mcq and options:
            answer_source = "format_uncertain"
            confidence = "low"

        questions.append(OcrParsedQuestion(
            question_number=q_num,
            total_questions=total,
            marks=marks,
            question_text=question_text,
            options=options,
            correct_answer=correct_answer,
            answer_source=answer_source,
            confidence=confidence,
            is_mcq=is_mcq,
        ))

    return questions


def extract_ocr_mcqs_as_generated(text: str) -> list[GeneratedQuestion]:
    """Parse OCR MCQs and return as GeneratedQuestion objects for API compatibility."""
    parsed = parse_ocr_mcqs(text)
    questions: list[GeneratedQuestion] = []
    for p in parsed:
        if not p.is_mcq:
            continue  # Skip long-answer questions
        if len(p.options) < 2:
            continue  # Need at least 2 options
        # Clean up option text — remove remaining OCR artifacts
        clean_options: list[Option] = []
        for opt in p.options:
            t = opt.text.strip()
            # Skip options that are clearly noise
            if re.match(r"^[^a-zA-Z0-9]{1,3}$", t):
                continue
            if len(t) <= 1:
                continue
            clean_options.append(Option(key=opt.key, text=t))
        if len(clean_options) < 2:
            continue
        # Re-key options A, B, C, D after filtering
        keys = ["A", "B", "C", "D", "E", "F", "G"]
        final_options = []
        correct_key = None
        for idx, opt in enumerate(clean_options):
            if idx < len(keys):
                new_key = keys[idx]
                final_options.append(Option(key=new_key, text=opt.text))
                if p.correct_answer and opt.key == p.correct_answer:
                    correct_key = new_key
        questions.append(GeneratedQuestion(
            question_text=p.question_text,
            options=final_options,
            correct_answer=correct_key,
            explanation=None,
            chapter=None,
        ))
    return questions
