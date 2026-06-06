"""PDF text extraction with `pypdf`.

This is intentionally simple. If a PDF is image-only (scanned), pypdf returns
empty strings per page and we surface a clear warning so the UI can show
"This file may require OCR." OCR itself is intentionally out of scope for the
vertical slice (see TODO at bottom).
"""
from __future__ import annotations

from dataclasses import dataclass

from pypdf import PdfReader


@dataclass
class PDFExtractionResult:
    text: str
    page_count: int
    warning: str | None = None


def extract_pdf(data: bytes) -> PDFExtractionResult:
    from io import BytesIO

    reader = PdfReader(BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        parts.append(t)
    text = "\n\n".join(p.strip() for p in parts if p and p.strip())
    warning: str | None = None
    if not text.strip():
        warning = "This file may require OCR \u2014 no extractable text was found."
    elif len(text) < 200 and len(reader.pages) > 1:
        warning = "Extracted text looks very short. OCR may improve results."
    return PDFExtractionResult(text=text, page_count=len(reader.pages), warning=warning)


# TODO: integrate an OCR fallback (tesseract / cloud vision) when warning is set.
