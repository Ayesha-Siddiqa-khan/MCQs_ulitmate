"""Parse the 9th Math MCQ PDF into structured JSON.

Format quirks (vs the existing mcq_parser):
- 17 chapters, each restarting question numbering at 1
- Answer key is a 2-col table per chapter, header "Q / Ans" with up to 5 columns per row
- Per-line answer rows like "1\\nB\\n2\\nC" instead of "1. B"
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(r"F:\Mobile apps projects\MCQs_ulitmate")
TEXT_PATH = ROOT / ".tmp" / "pdf_text.txt"
OUT_PATH = ROOT / ".tmp" / "parsed_mcqs.json"


def find_answer_key_split(text: str) -> int:
    m = re.search(r"(?im)^\s*Answer\s+Key\s*$", text)
    if not m:
        raise SystemExit("no Answer Key heading found")
    return m.start()


def chapter_spans(section: str) -> dict[int, tuple[int, int]]:
    """Return {chapter_num: (start, end)} within section."""
    starts: list[tuple[int, int]] = []
    for m in re.finditer(r"(?im)^\s*Chapter\s+(\d+)\b[^\n]*$", section, re.MULTILINE):
        starts.append((int(m.group(1)), m.end()))
    starts.sort(key=lambda x: x[1])
    out: dict[int, tuple[int, int]] = {}
    for i, (n, s) in enumerate(starts):
        e = starts[i + 1][1] if i + 1 < len(starts) else len(section)
        out[n] = (s, e)
    return out


def parse_answer_key(chapter_text: str) -> dict[int, str]:
    """Parse the Q/Ans table for one chapter. Lines: header 'Q Ans Q Ans...', then (num, ans) pairs."""
    lines = [ln.strip() for ln in chapter_text.splitlines() if ln.strip()]
    # Drop chapter header if present
    lines = [ln for ln in lines if not re.match(r"(?i)^Chapter\s+\d+", ln)]
    # Drop any "Answers are placed..." boilerplate
    lines = [ln for ln in lines if "Answers are placed" not in ln]
    # The header rows are exactly the lines that contain only "Q" and "Ans" tokens.
    out: dict[int, str] = {}
    i = 0
    # Skip the 2 header rows: 'Q\\nAns\\nQ\\nAns...' style, OR a single row 'Q Ans Q Ans ...'
    # In the PDF it's the form: Q\\nAns\\nQ\\nAns\\nQ\\nAns\\nQ\\nAns\\nQ\\nAns
    # so the first 10 lines are header tokens. More robust: skip leading tokens that are 'Q' or 'Ans'.
    while i < len(lines) and lines[i] in ("Q", "Ans"):
        i += 1
    # Now remaining lines are alternating: num, letter, num, letter, ...
    pending_num: int | None = None
    for ln in lines[i:]:
        if pending_num is None:
            m = re.match(r"^(\d{1,3})$", ln)
            if m:
                pending_num = int(m.group(1))
            continue
        if ln in {"A", "B", "C", "D", "-"}:
            if ln != "-":
                out[pending_num] = ln
            pending_num = None
            continue
        # Unexpected: reset and try to recover
        m = re.match(r"^(\d{1,3})$", ln)
        if m:
            pending_num = int(m.group(1))
        else:
            pending_num = None
    return out


# --- Question parsing (per chapter) ---

_Q_START = re.compile(r"^\s*(\d{1,3})[.)]\s*(.*)$")
_OPT_LINE = re.compile(r"^\s*\(?([A-Da-d])[).:\-]\s*(.+)$")
_PAGE_NOISE = re.compile(r"^\s*Page\s+\d+\s*$", re.IGNORECASE)
_DOC_NOISE = re.compile(
    r"^\s*(?:9th\s+Mathematics|Clean\s+single-?column|Answer\s+key\s+at\s+the\s+end)\s*$",
    re.IGNORECASE,
)


def parse_questions(chapter_text: str) -> list[tuple[int, str, list[tuple[str, str]]]]:
    """Return [(qnum, qtext, [(opt_key, opt_text), ...]), ...]"""
    questions: list[tuple[int, str, list[tuple[str, str]]]] = []
    current_num: int | None = None
    current_text: list[str] = []
    current_opts: list[tuple[str, str]] = []

    def flush() -> None:
        nonlocal current_num, current_text, current_opts
        if current_num is not None and current_opts:
            qtext = " ".join(s.strip() for s in current_text if s.strip()).strip()
            if qtext:
                questions.append((current_num, qtext, current_opts))
        current_num = None
        current_text = []
        current_opts = []

    for raw in chapter_text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if _PAGE_NOISE.match(line) or _DOC_NOISE.match(line):
            continue
        if re.match(r"(?i)^\s*Chapter\s+\d+", line):
            continue
        m = _Q_START.match(line)
        if m:
            flush()
            current_num = int(m.group(1))
            rest = m.group(2).strip()
            if rest:
                current_text = [rest]
            else:
                current_text = []
            current_opts = []
            continue
        m = _OPT_LINE.match(line)
        if m and current_num is not None:
            current_opts.append((m.group(1).upper(), m.group(2).strip()))
            continue
        if current_num is not None and not current_opts:
            current_text.append(line.strip())
        elif current_num is not None and current_opts:
            last_k, last_t = current_opts[-1]
            current_opts[-1] = (last_k, f"{last_t} {line.strip()}".strip())
    flush()
    return questions


def clean_question_text(t: str) -> str:
    """Strip stray matrix-bracket noise from pypdf extraction."""
    # Collapse runs of "[ ]", "| |" etc that the PDF extractor emits for matrix elements.
    t = re.sub(r"\[\s*\]\s*\|\s*\|\s*\[\s*\]", " ", t)
    t = re.sub(r"^\s*\[\s*\]\s*", "", t)
    t = re.sub(r"\s*\[\s*\]\s*$", "", t)
    t = re.sub(r"\s*\|\s*\|\s*", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def clean_option_text(t: str) -> str:
    return clean_question_text(t)


def main() -> None:
    text = TEXT_PATH.read_text(encoding="utf-8")
    ak_pos = find_answer_key_split(text)
    questions_section = text[:ak_pos]
    answers_section = text[ak_pos:]

    qs_spans = chapter_spans(questions_section)
    ak_spans = chapter_spans(answers_section)

    all_out: list[dict] = []
    for n in sorted(qs_spans.keys()):
        qs_start, qs_end = qs_spans[n]
        qs_text = questions_section[qs_start:qs_end]
        ak_text = answers_section[ak_spans[n][0] : ak_spans[n][1]] if n in ak_spans else ""
        answers = parse_answer_key(ak_text)
        parsed = parse_questions(qs_text)
        matched = 0
        for qnum, qtext, opts in parsed:
            correct = answers.get(qnum)
            if not correct:
                continue
            qtext_clean = clean_question_text(qtext)
            opts_clean = [(k, clean_option_text(t)) for k, t in opts]
            if len(opts_clean) < 2 or not qtext_clean:
                continue
            all_out.append(
                {
                    "chapter": n,
                    "position": qnum,
                    "question_text": qtext_clean,
                    "options": [{"key": k, "text": t} for k, t in opts_clean],
                    "correct_answer": correct,
                }
            )
            matched += 1
        print(f"Chapter {n:>2}: parsed {len(parsed):>2} questions, matched {matched:>2} with answers", file=sys.stderr)

    print(f"TOTAL: {len(all_out)} questions", file=sys.stderr)
    OUT_PATH.write_text(json.dumps(all_out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
