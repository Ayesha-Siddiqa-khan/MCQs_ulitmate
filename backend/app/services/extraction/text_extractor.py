"""Plain-text and Markdown extractors."""
from __future__ import annotations


def extract_text(data: bytes) -> str:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def extract_markdown(data: bytes) -> str:
    # Markdown is already readable as plain text for our purposes.
    return extract_text(data)
