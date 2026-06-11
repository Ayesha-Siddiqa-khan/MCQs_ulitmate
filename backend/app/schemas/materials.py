"""Request / response shapes for materials."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import MaterialFileType, MaterialStatus


class PasteTextRequest(BaseModel):
    title: str = Field(default="", max_length=200)
    text: str = Field(min_length=1)
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None
    exam_type: str | None = None
    notes: str | None = None


class MaterialOut(BaseModel):
    id: str
    title: str
    original_file_name: str | None = None
    file_type: MaterialFileType
    storage_path: str | None = None
    extracted_text: str | None = None
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None
    exam_type: str | None = None
    status: MaterialStatus
    storage_mode: str = "saved"
    expires_at: datetime | None = None
    size_bytes: int | None = None
    page_count: int | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class MaterialListOut(BaseModel):
    """Lightweight material representation for list endpoints (no extracted_text)."""
    id: str
    title: str
    original_file_name: str | None = None
    file_type: MaterialFileType
    subject: str | None = None
    chapter: str | None = None
    topic: str | None = None
    exam_type: str | None = None
    status: MaterialStatus
    storage_mode: str = "saved"
    expires_at: datetime | None = None
    size_bytes: int | None = None
    page_count: int | None = None
    created_at: datetime | None = None


class PaginatedMaterials(BaseModel):
    """Paginated list of materials."""
    items: list[MaterialListOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class ExtractTextResponse(BaseModel):
    material_id: str
    text: str
    page_count: int | None = None
    warning: str | None = None  # e.g. "This file may require OCR"


class ExtractPreviewResponse(BaseModel):
    material_id: str
    total_detected: int
    with_answers: int
    without_answers: int
    with_explanations: int
    duplicates: int
    confidence: str  # "high", "medium", "low", "none"
    warnings: list[str] = []
    answer_sources: dict[str, int] = {}  # e.g. {"explicit_answer_key": 5, "bold_format": 3, "missing": 2}
    ocr_used: bool = False
    source_type: str = "text_pdf"  # "text_pdf", "image_based_pdf", "mixed_pdf"


class MaterialUsageResponse(BaseModel):
    used: int
    limit: int
    remaining: int


class DeleteMaterialResponse(BaseModel):
    material_id: str
    deleted: dict[str, int]
    storage_paths_removed: int = 0
    warning: str | None = None


class SaveTemporaryRequest(BaseModel):
    save_mode: str = "save_material"  # "save_material", "save_mistakes_only", "discard"


class SaveTemporaryResponse(BaseModel):
    material_id: str
    action: str  # "saved", "mistakes_saved", "discarded"
    message: str
