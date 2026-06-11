"""Material upload / paste / extract endpoints."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from supabase import Client

from app.core.config import Settings, get_settings
from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.materials import (
    DeleteMaterialResponse,
    ExtractPreviewResponse,
    ExtractTextResponse,
    MaterialListOut,
    MaterialOut,
    MaterialUsageResponse,
    PaginatedMaterials,
    PasteTextRequest,
    SaveTemporaryRequest,
    SaveTemporaryResponse,
)
from app.services.extraction import (
    extract_csv,
    extract_docx,
    extract_json,
    extract_markdown,
    extract_pdf,
    extract_text,
)
from app.services.study_data_cleanup import delete_material_tree

router = APIRouter(prefix="/materials", tags=["materials"])

_ALLOWED = {"pdf", "txt", "md", "docx", "csv", "json"}


def _max_bytes(settings: Settings) -> int:
    return settings.max_upload_mb * 1024 * 1024


def _material_limit_message(settings: Settings) -> str:
    return (
        f"You have reached the {settings.max_materials_per_user}-material limit. "
        "Delete an older material before uploading a new one."
    )


def _ext_of(name: str) -> str:
    return (os.path.splitext(name)[1] or "").lower().lstrip(".")


def _file_type_from_ext(ext: str) -> str:
    return ext if ext in _ALLOWED else "txt"


def _material_count(db: Client, user_id: str) -> int:
    res = (
        db.table("learning_materials")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("storage_mode", "saved")
        .execute()
    )
    return res.count or 0


def _enforce_material_limit(db: Client, user_id: str, settings: Settings) -> None:
    if _material_count(db, user_id) >= settings.max_materials_per_user:
        raise HTTPException(status_code=409, detail=_material_limit_message(settings))


def _remove_storage_paths(db: Client, settings: Settings, paths: list[str]) -> tuple[int, str | None]:
    removed = 0
    warning: str | None = None
    if not paths:
        return removed, warning
    try:
        for start in range(0, len(paths), 100):
            batch = paths[start : start + 100]
            db.storage.from_(settings.supabase_storage_bucket).remove(batch)
            removed += len(batch)
    except Exception as exc:
        warning = f"Database rows were deleted, but some stored files may remain: {exc}"
    return removed, warning


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
    storage_mode: Annotated[str, Form()] = "saved",
) -> MaterialOut:
    max_bytes = _max_bytes(settings)

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"file is larger than {settings.max_upload_mb} MB",
        )

    filename = file.filename or "upload.bin"
    ext = _ext_of(filename)
    if ext not in _ALLOWED:
        raise HTTPException(status_code=415, detail=f"unsupported file type: .{ext}")

    is_temporary = storage_mode == "temporary"
    if not is_temporary:
        _enforce_material_limit(db, user.id, settings)

    file_type = _file_type_from_ext(ext)
    now = datetime.now(timezone.utc)
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
                "storage_mode": "temporary" if is_temporary else "saved",
                "expires_at": (now + timedelta(hours=24)).isoformat() if is_temporary else None,
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
    settings: Annotated[Settings, Depends(get_settings)],
    payload: PasteTextRequest,
    storage_mode: str = "saved",
) -> MaterialOut:
    is_temporary = storage_mode == "temporary"
    if not is_temporary:
        _enforce_material_limit(db, user.id, settings)

    now = datetime.now(timezone.utc)
    insert = (
        db.table("learning_materials")
        .insert(
            {
                "user_id": user.id,
                "title": (payload.title.strip() or f"Untitled practice - {now.strftime('%b %d, %Y')}")[:200],
                "file_type": "pasted",
                "extracted_text": payload.text,
                "subject": payload.subject,
                "chapter": payload.chapter,
                "topic": payload.topic,
                "exam_type": payload.exam_type,
                "notes": payload.notes,
                "size_bytes": len(payload.text.encode("utf-8")),
                "status": "extracted",
                "storage_mode": "temporary" if is_temporary else "saved",
                "expires_at": (now + timedelta(hours=24)).isoformat() if is_temporary else None,
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


def _clean_extracted_text(text: str) -> str:
    # Postgres text fields cannot store NUL bytes; some PDF extractors emit them.
    return text.replace("\x00", "")


@router.post("/{material_id}/extract-text", response_model=ExtractTextResponse)
async def extract_material_text(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ExtractTextResponse:
    row = (
        db.table("learning_materials")
        .select("id, file_type, storage_path, extracted_text, status")
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
    cleaned_text = _clean_extracted_text(text)
    if cleaned_text != text:
        cleanup_warning = "Removed unsupported NUL characters from extracted text."
        warning = f"{warning} {cleanup_warning}" if warning else cleanup_warning
        text = cleaned_text
    status = "extracted" if text and text.strip() else "failed"
    db.table("learning_materials").update(
        {"extracted_text": text, "status": status, "page_count": page_count}
    ).eq("id", material_id).execute()

    return ExtractTextResponse(material_id=material_id, text=text, page_count=page_count, warning=warning)


@router.post("/{material_id}/extract-preview", response_model=ExtractPreviewResponse)
async def extract_preview(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ExtractPreviewResponse:
    """Return MCQ detection stats without persisting a question set."""
    from app.services.extraction.mcq_parser import preview_mcqs

    row = (
        db.table("learning_materials")
        .select("id, file_type, extracted_text")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    ).data
    if row is None:
        raise HTTPException(status_code=404, detail="material not found")

    text = (row.get("extracted_text") or "").strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="material has no extracted text yet. Run extract-text first.",
        )

    stats = preview_mcqs(text)

    confidence = "high"
    warnings: list[str] = []
    if stats.total_detected == 0:
        confidence = "none"
        warnings.append("No MCQs detected. The file may have an unusual format.")
    elif stats.without_answers > 0 and stats.with_answers == 0:
        confidence = "low"
        warnings.append(
            "MCQs detected, but no answer key or inline answers were found. "
            "Questions were detected but answers are missing."
        )
    elif stats.without_answers > 0:
        confidence = "medium"
        warnings.append(
            f"{stats.without_answers} question(s) have no detected answer. "
            "You may need to provide answers manually or use AI generation."
        )
    if stats.duplicates > 0:
        confidence = "low" if confidence != "none" else confidence
        warnings.append(f"{stats.duplicates} duplicate question(s) detected.")

    # Check for bold/url-based answers that may need review
    answer_sources = getattr(stats, 'answer_sources', {})
    bold_count = answer_sources.get('bold_format', 0) + answer_sources.get('url_marker', 0)
    if bold_count > 0:
        if confidence == "high":
            confidence = "medium"
        warnings.append(
            f"{bold_count} answer(s) were identified from formatting (bold/dark text or URL markers). "
            "Please review these answers before starting auto-graded practice."
        )

    return ExtractPreviewResponse(
        material_id=material_id,
        total_detected=stats.total_detected,
        with_answers=stats.with_answers,
        without_answers=stats.without_answers,
        with_explanations=stats.with_explanations,
        duplicates=stats.duplicates,
        confidence=confidence,
        warnings=warnings,
        answer_sources=answer_sources,
    )


@router.get("", response_model=PaginatedMaterials)
async def list_materials(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    page: int = 1,
    page_size: int = 20,
) -> PaginatedMaterials:
    """List user's materials with pagination. Excludes extracted_text for performance."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    offset = (page - 1) * page_size

    # Auto-cleanup expired temporary materials
    _cleanup_expired_temporaries(db, settings, user.id)

    # Get total count
    count_res = (
        db.table("learning_materials")
        .select("id", count="exact")
        .eq("user_id", user.id)
        .execute()
    )
    total = count_res.count or 0
    total_pages = max(1, (total + page_size - 1) // page_size)

    # Fetch page of materials WITHOUT extracted_text
    res = (
        db.table("learning_materials")
        .select("id, title, original_file_name, file_type, subject, chapter, topic, exam_type, status, storage_mode, expires_at, size_bytes, page_count, created_at")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    items = [MaterialListOut(**row) for row in (res.data or [])]
    return PaginatedMaterials(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/usage", response_model=MaterialUsageResponse)
async def material_usage(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> MaterialUsageResponse:
    used = _material_count(db, user.id)
    limit = settings.max_materials_per_user
    return MaterialUsageResponse(
        used=used,
        limit=limit,
        remaining=max(0, limit - used),
    )


@router.get("/{material_id}", response_model=MaterialOut)
async def get_material(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> MaterialOut:
    res = (
        db.table("learning_materials")
        .select("id, title, original_file_name, file_type, storage_path, extracted_text, subject, chapter, topic, exam_type, status, storage_mode, size_bytes, page_count, notes, created_at, updated_at")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="not found")
    return MaterialOut(**res.data)


@router.delete("/{material_id}", response_model=DeleteMaterialResponse)
async def delete_material(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DeleteMaterialResponse:
    cleanup = delete_material_tree(db, user.id, material_id)
    if cleanup is None:
        raise HTTPException(status_code=404, detail="material not found")
    removed, warning = _remove_storage_paths(db, settings, cleanup.storage_paths)
    return DeleteMaterialResponse(
        material_id=material_id,
        deleted=cleanup.deleted,
        storage_paths_removed=removed,
        warning=warning,
    )


@router.post("/{material_id}/save-temporary", response_model=SaveTemporaryResponse)
async def save_temporary_material(
    material_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    payload: SaveTemporaryRequest,
) -> SaveTemporaryResponse:
    """Convert a temporary material to saved, or save only mistakes."""
    row = (
        db.table("learning_materials")
        .select("id, storage_mode")
        .eq("id", material_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    ).data
    if row is None:
        raise HTTPException(status_code=404, detail="material not found")

    if row.get("storage_mode") != "temporary":
        raise HTTPException(status_code=400, detail="material is not temporary")

    if payload.save_mode == "save_material":
        # Check material limit before saving
        _enforce_material_limit(db, user.id, settings)
        db.table("learning_materials").update(
            {"storage_mode": "saved", "expires_at": None}
        ).eq("id", material_id).execute()
        return SaveTemporaryResponse(
            material_id=material_id,
            action="saved",
            message="Material and results saved to your library.",
        )

    if payload.save_mode == "save_mistakes_only":
        # Keep the material temporary but save mistake records
        # The mistakes are already in mistake_bank from quiz submission
        return SaveTemporaryResponse(
            material_id=material_id,
            action="mistakes_saved",
            message="Mistakes saved. Material will be discarded.",
        )

    # discard
    cleanup = delete_material_tree(db, user.id, material_id)
    if cleanup is None:
        raise HTTPException(status_code=404, detail="material not found")
    removed, warning = _remove_storage_paths(db, settings, cleanup.storage_paths)
    return SaveTemporaryResponse(
        material_id=material_id,
        action="discarded",
        message="Temporary session discarded. All data removed.",
    )


def _cleanup_expired_temporaries(db: Client, settings: Settings, user_id: str) -> int:
    """Delete temporary materials past their expires_at. Returns count cleaned."""
    now = datetime.now(timezone.utc).isoformat()
    expired = (
        db.table("learning_materials")
        .select("id")
        .eq("user_id", user_id)
        .eq("storage_mode", "temporary")
        .not_.is_("expires_at", "null")
        .lt("expires_at", now)
        .execute()
    ).data
    if not expired:
        return 0
    count = 0
    for row in expired:
        cleanup = delete_material_tree(db, user_id, row["id"])
        if cleanup:
            _remove_storage_paths(db, settings, cleanup.storage_paths)
            count += 1
    return count


@router.delete("/cleanup-temporary")
async def cleanup_expired_temporary_materials(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """Delete all expired temporary materials for the current user."""
    count = _cleanup_expired_temporaries(db, settings, user.id)
    return {"cleaned": count}
