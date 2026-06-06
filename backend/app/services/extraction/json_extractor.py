"""JSON extractor: pretty-prints JSON so the LLM has structure to read."""
from __future__ import annotations

import json

from app.services.extraction.text_extractor import extract_text


def extract_json(data: bytes) -> str:
    raw = extract_text(data)
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return raw
    return json.dumps(obj, indent=2, ensure_ascii=False)
