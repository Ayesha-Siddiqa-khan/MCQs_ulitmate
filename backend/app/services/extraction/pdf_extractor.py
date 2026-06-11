"""PDF text extraction with font metadata for bold detection.

Uses pymupdf (fitz) for rich text extraction that preserves font information,
enabling detection of bold/dark formatted text in MCQ PDFs.
Falls back to pypdf if pymupdf is unavailable.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TextSpan:
    """A span of text with font metadata."""
    text: str
    font: str
    size: float
    flags: int
    is_bold: bool = False
    is_italic: bool = False
    bbox: tuple[float, float, float, float] = (0, 0, 0, 0)


@dataclass
class RichTextLine:
    """A line of text composed of spans."""
    spans: list[TextSpan]
    y: float = 0.0

    @property
    def text(self) -> str:
        return "".join(s.text for s in self.spans)

    @property
    def has_bold(self) -> bool:
        return any(s.is_bold for s in self.spans)

    @property
    def bold_ratio(self) -> float:
        """Fraction of characters that are bold."""
        if not self.spans:
            return 0.0
        total = sum(len(s.text) for s in self.spans)
        if total == 0:
            return 0.0
        bold_chars = sum(len(s.text) for s in self.spans if s.is_bold)
        return bold_chars / total


@dataclass
class RichPDFExtractionResult:
    """PDF extraction result with rich formatting metadata."""
    text: str
    page_count: int
    rich_lines: list[list[RichTextLine]] = field(default_factory=list)
    warning: str | None = None
    has_rich_data: bool = False


def _fitz_flags_to_bold(flags: int) -> bool:
    """Check if pymupdf font flags indicate bold (bit 4)."""
    return bool(flags & (1 << 4))


def _fitz_flags_to_italic(flags: int) -> bool:
    """Check if pymupdf font flags indicate italic (bit 5)."""
    return bool(flags & (1 << 5))


def extract_pdf_rich(data: bytes) -> RichPDFExtractionResult:
    """Extract text with font metadata using pymupdf.

    Returns rich text data that preserves bold/italic information,
    enabling detection of visually emphasized answers.
    """
    try:
        import fitz
    except ImportError:
        return _extract_pdf_fallback(data)

    from io import BytesIO

    doc = fitz.open(stream=BytesIO(data), filetype="pdf")
    page_count = len(doc)
    all_rich_lines: list[list[RichTextLine]] = []
    parts: list[str] = []

    for page in doc:
        page_lines: list[RichTextLine] = []
        try:
            text_dict = page.get_text("dict")
            for block in text_dict.get("blocks", []):
                if block.get("type") != 0:  # text block
                    continue
                for line in block.get("lines", []):
                    spans = []
                    for span in line.get("spans", []):
                        flags = span.get("flags", 0)
                        ts = TextSpan(
                            text=span.get("text", ""),
                            font=span.get("font", ""),
                            size=span.get("size", 0),
                            flags=flags,
                            is_bold=_fitz_flags_to_bold(flags),
                            is_italic=_fitz_flags_to_italic(flags),
                            bbox=tuple(span.get("bbox", (0, 0, 0, 0))),
                        )
                        spans.append(ts)
                    if spans:
                        rl = RichTextLine(
                            spans=spans,
                            y=line.get("bbox", [0, 0, 0, 0])[1],
                        )
                        page_lines.append(rl)
                        parts.append(rl.text)
        except Exception:
            pass

        all_rich_lines.append(page_lines)

    doc.close()
    text = "\n\n".join(p.strip() for p in parts if p and p.strip())
    warning = None
    if not text.strip():
        warning = "This file may require OCR \u2014 no extractable text was found."
    elif len(text) < 200 and page_count > 1:
        warning = "Extracted text looks very short. OCR may improve results."

    return RichPDFExtractionResult(
        text=text,
        page_count=page_count,
        rich_lines=all_rich_lines,
        warning=warning,
        has_rich_data=bool(all_rich_lines),
    )


def _extract_pdf_fallback(data: bytes) -> RichPDFExtractionResult:
    """Fallback to pypdf when pymupdf is not available."""
    from pypdf import PdfReader
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
    warning = None
    if not text.strip():
        warning = "This file may require OCR \u2014 no extractable text was found."
    elif len(text) < 200 and len(reader.pages) > 1:
        warning = "Extracted text looks very short. OCR may improve results."
    return RichPDFExtractionResult(
        text=text,
        page_count=len(reader.pages),
        warning=warning,
        has_rich_data=False,
    )


def extract_pdf(data: bytes) -> PDFExtractionResult:
    """Legacy interface: extract plain text only."""
    from dataclasses import dataclass

    result = extract_pdf_rich(data)
    return PDFExtractionResult(text=result.text, page_count=result.page_count, warning=result.warning)


@dataclass
class PDFExtractionResult:
    """Legacy plain-text extraction result."""
    text: str
    page_count: int
    warning: str | None = None
