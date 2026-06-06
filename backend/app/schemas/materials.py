"""Request / response shapes for materials."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import MaterialFileType, MaterialStatus


class PasteTextRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
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
    size_bytes: int | None = None
    page_count: int | None = None
    notes: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ExtractTextResponse(BaseModel):
    material_id: str
    text: str
    page_count: int | None = None
    warning: str | None = None  # e.g. "This file may require OCR"
