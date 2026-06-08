"""Public configuration endpoints (upload limits, etc.)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/upload-limits")
async def upload_limits(
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    return {
        "max_upload_mb": settings.max_upload_mb,
        "max_materials_per_user": settings.max_materials_per_user,
        "allowed_extensions": ["pdf", "docx", "txt", "md", "csv", "json"],
    }
