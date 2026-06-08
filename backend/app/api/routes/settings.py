"""Per-user settings: AI provider, API key, defaults."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from supabase import Client

from app.core.config import Settings, get_settings
from app.core.security import CurrentUserDep, encrypt_secret
from app.db.supabase_client import get_user_client
from app.schemas.common import AIProvider, Difficulty
from app.schemas.settings import DeleteStudentDataResponse, UpdateSettingsRequest, UserSettingsOut
from app.services.study_data_cleanup import delete_all_study_data

router = APIRouter(prefix="/settings", tags=["settings"])


def _row_to_out(row: dict | None) -> UserSettingsOut:
    if row is None:
        return UserSettingsOut(
            ai_provider=AIProvider.none,
            ai_model=None,
            has_api_key=False,
            default_difficulty=Difficulty.medium,
            questions_per_quiz=10,
        )
    return UserSettingsOut(
        ai_provider=AIProvider(row.get("ai_provider") or "none"),
        ai_model=row.get("ai_model"),
        has_api_key=bool(row.get("ai_api_key_encrypted")),
        default_difficulty=Difficulty(row.get("default_difficulty") or "medium"),
        questions_per_quiz=row.get("questions_per_quiz") or 10,
    )


@router.get("", response_model=UserSettingsOut)
async def get_settings_endpoint(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> UserSettingsOut:
    res = (
        db.table("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    return _row_to_out(res.data)


@router.put("", response_model=UserSettingsOut)
async def update_settings(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    payload: UpdateSettingsRequest,
) -> UserSettingsOut:
    patch: dict = {}
    if payload.ai_provider is not None:
        patch["ai_provider"] = payload.ai_provider.value
    if payload.ai_model is not None:
        patch["ai_model"] = payload.ai_model
    if payload.default_difficulty is not None:
        patch["default_difficulty"] = payload.default_difficulty.value
    if payload.questions_per_quiz is not None:
        patch["questions_per_quiz"] = payload.questions_per_quiz
    if payload.clear_api_key:
        patch["ai_api_key_encrypted"] = None
    elif payload.ai_api_key:
        patch["ai_api_key_encrypted"] = encrypt_secret(payload.ai_api_key, settings)

    if patch:
        db.table("user_settings").upsert(
            {"user_id": user.id, **patch}, on_conflict="user_id"
        ).execute()

    res = db.table("user_settings").select("*").eq("user_id", user.id).maybe_single().execute()
    return _row_to_out(res.data)


@router.delete("/student-data", response_model=DeleteStudentDataResponse)
async def delete_student_data(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DeleteStudentDataResponse:
    cleanup = delete_all_study_data(db, user.id)

    storage_removed = 0
    warning: str | None = None
    if cleanup.storage_paths:
        try:
            for start in range(0, len(cleanup.storage_paths), 100):
                batch = cleanup.storage_paths[start : start + 100]
                db.storage.from_(settings.supabase_storage_bucket).remove(batch)
                storage_removed += len(batch)
        except Exception as exc:
            warning = f"Database rows were deleted, but some stored files may remain: {exc}"

    return DeleteStudentDataResponse(
        deleted=cleanup.deleted,
        storage_paths_removed=storage_removed,
        warning=warning,
    )
