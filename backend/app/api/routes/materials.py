"""Material upload / paste / extract endpoints."""
from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from supabase import Client

from app.core.config import Settings, get_settings
from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.materials import ExtractTextResponse, MaterialOut, PasteTextRequest
from app.services.extraction import (
    extract_csv,
    extract_docx,
    extract_json,
    extract_markdown,
    extract_pdf,
    extract_text,
)

router = APIRouter(prefix="/materials", tags=["materials"])

_ALLOWED = {"pdf", "txt", "md", "docx", "csv", "json"}
_MAX_BYTES = 50 * 1024 * 1024


def _ext_of(name: str) -> str:
    return (os.path.splitext(name)[1] or "").lower().lstrip(".")


def _file_type_from_ext(ext: str) -> str:
    return ext if ext in _ALLOWED else "txt"


@router.post("/upload", response_model=MaterialOut, status_code=201)
async def upload_material(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    file: Annotated[UploadFile, File(...)],
    title: Annotated[str | None, Form()] = None,
    subject: Annotated[str | None, Form()] = None,
    chapter: Annotated[str | None, Form()] = None,
    topic: Annotated[str | None, Form()] = None,
    exam_type: Annotated[str | None, Form()] = None,
) -> MaterialOut:
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="file is larger than 50 MB")

    filename = file.filename or "upload.bin"
    ext = _ext_of(filename)
    if ext not in _ALLOWED:
        raise HTTPException(status_code=415, detail=f"unsupported file type: .{ext}")

    file_type = _file_type_from_ext(ext)
    insert = (
        db.table("learning_materials")
        .insert(
            {
                "user_id": user.id,
                "title": (title or os.path.splitext(filename)[0])[:200],
                "original_file_name": filename,
                "file_type": file_type,
                "subject": subject,
                "chapter": chapter,
                "topic": topic,
                "exam_type": exam_type,
                "size_bytes": len(data),
                "status": "uploaded",
            }
        )
        .execute()
    )
    if not insert.data:
        raise HTTPException(status_code=500, detail="failed to create material row")
    row = insert.data[0]
    material_id = row["id"]

    storage_path = f"{user.id}/{material_id}/{filename}"
    try:
        db.storage.from_(settings.supabase_storage_bucket).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
        )
    except Exception as exc:  # pragma: no cover - upstream errors
        # roll back the row so we don't leave orphans
        db.table("learning_materials").delete().eq("id", material_id).execute()
        raise HTTPException(status_code=502, detail=f"storage upload failed: {exc}") from exc

    db.table("learning_materials").update({"storage_path": storage_path}).eq("id", material_id).execute()
    row["storage_path"] = storage_path
    return MaterialOut(**row)


@router.post("/paste-text", response_model=MaterialOut, status_code=201)
async def paste_text(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: PasteTextRequest,
) -> MaterialOut:
    insert = (
        db.table("learning_materials")
        .insert(
            {
                "user_id": user.id,
                "title": payload.title[:200],
                "file_type": "pasted",
                "extracted_text": payload.text,
                "subject": payload.subject,
                "chapter": payload.chapter,
                "topic": payload.topic,
                "exam_type": payload.exam_type,
                "notes": payload.notes,
                "size_bytes": len(payload.text.encode("utf-8")),
                "status": "extracted",
            }
        )
        .execute()
    )
    if not insert.data:
        raise HTTPException(status_code=500, detail="failed to create material")
    return MaterialOut(**insert.data[0])


def _extract_for(file_type: str, data: bytes) -> tuple[str, str | None, int | None]:
    """Returns (text, warning, page_count)."""
    if file_type == "pdf":
        result = extract_pdf(data)
        return result.text, result.warning, result.page_count
    if file_type == "docx":
        return extract_docx(data), None, None
    if file_type == "csv":
        return extract_csv(data), None, None
    if file_type == "json":
        return extract_json(data), None, None
    if file_type == "md":
        return extract_markdown(data), None, None
    return extract_text(data), None, None


@router.post("/{material_id}/extract-text", response_model=ExtractTextResponse)
async def extract_material_text(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ExtractTextResponse:
    row = (
        db.table("learning_materials")
        .select("*")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    ).data
    if row is None:
        raise HTTPException(status_code=404, detail="material not found")

    # Already-pasted materials don't need re-extraction.
    if row["file_type"] == "pasted" and row.get("extracted_text"):
        return ExtractTextResponse(material_id=material_id, text=row["extracted_text"])

    storage_path = row.get("storage_path")
    if not storage_path:
        raise HTTPException(status_code=400, detail="material has no stored file")

    try:
        data = db.storage.from_(settings.supabase_storage_bucket).download(storage_path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"storage download failed: {exc}") from exc

    text, warning, page_count = _extract_for(row["file_type"], data)
    status = "extracted" if text and text.strip() else "failed"
    db.table("learning_materials").update(
        {"extracted_text": text, "status": status, "page_count": page_count}
    ).eq("id", material_id).execute()

    return ExtractTextResponse(material_id=material_id, text=text, page_count=page_count, warning=warning)


@router.get("", response_model=list[MaterialOut])
async def list_materials(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> list[MaterialOut]:
    res = (
        db.table("learning_materials")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return [MaterialOut(**row) for row in (res.data or [])]


@router.get("/{material_id}", response_model=MaterialOut)
async def get_material(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> MaterialOut:
    res = (
        db.table("learning_materials")
        .select("*")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="not found")
    return MaterialOut(**res.data)


@router.delete("/{material_id}", status_code=204)
async def delete_material(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    row = (
        db.table("learning_materials")
        .select("storage_path")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        return None
    sp = row.get("storage_path")
    if sp:
        try:
            db.storage.from_(settings.supabase_storage_bucket).remove([sp])
        except Exception:
            pass  # don't block deletion if storage cleanup fails
    db.table("learning_materials").delete().eq("id", material_id).execute()
    return None
