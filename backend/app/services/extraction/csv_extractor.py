"""CSV extractor: produces a markdown-style table the LLM can read."""
from __future__ import annotations

import csv
from io import StringIO

from app.services.extraction.text_extractor import extract_text


def extract_csv(data: bytes, max_rows: int = 1000) -> str:
    raw = extract_text(data)
    reader = csv.reader(StringIO(raw))
    rows = []
    for i, row in enumerate(reader):
        if i >= max_rows:
            rows.append([f"... ({i + 1}+ rows truncated)"])
            break
        rows.append(row)
    if not rows:
        return ""
    out: list[str] = []
    header = rows[0]
    out.append(" | ".join(header))
    out.append(" | ".join("---" for _ in header))
    for r in rows[1:]:
        out.append(" | ".join(r))
    return "\n".join(out)
