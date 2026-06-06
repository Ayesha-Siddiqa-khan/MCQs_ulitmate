"""Extraction service: turn an uploaded file's bytes into plain text."""
from __future__ import annotations

from app.services.extraction.csv_extractor import extract_csv
from app.services.extraction.docx_extractor import extract_docx
from app.services.extraction.json_extractor import extract_json
from app.services.extraction.pdf_extractor import PDFExtractionResult, extract_pdf
from app.services.extraction.text_extractor import extract_markdown, extract_text

__all__ = [
    "PDFExtractionResult",
    "extract_csv",
    "extract_docx",
    "extract_json",
    "extract_markdown",
    "extract_pdf",
    "extract_text",
]
