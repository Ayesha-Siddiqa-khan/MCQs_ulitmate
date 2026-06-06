"""Build a ProviderConfig for a given user, honoring per-user settings first."""
from __future__ import annotations

from fastapi import HTTPException
from supabase import Client

from app.core.config import Settings
from app.core.security import decrypt_secret
from app.schemas.common import AIProvider
from app.services.generation.providers import ProviderConfig


def resolve_provider(user_id: str, db: Client, settings: Settings) -> ProviderConfig:
    """Returns a ProviderConfig or raises HTTP 400 with a clear message."""
    res = (
        db.table("user_settings")
        .select("ai_provider, ai_model, ai_api_key_encrypted")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    row = res.data or {}
    provider_raw = row.get("ai_provider") or "none"
    try:
        provider = AIProvider(provider_raw)
    except ValueError:
        provider = AIProvider.none

    api_key: str | None = None
    enc = row.get("ai_api_key_encrypted")
    if enc:
        try:
            api_key = decrypt_secret(enc, settings)
        except ValueError:
            api_key = None

    # Fall back to server-side env keys if the student didn't bring their own.
    if not api_key:
        api_key = {
            AIProvider.openai: settings.openai_api_key,
            AIProvider.anthropic: settings.anthropic_api_key,
            AIProvider.google: settings.google_api_key,
        }.get(provider, "")

    if provider is AIProvider.none or not api_key:
        raise HTTPException(
            status_code=400,
            detail=(
                "AI generation is not configured. Open Settings and choose a provider "
                "(OpenAI, Anthropic, or Google) and paste your API key."
            ),
        )

    return ProviderConfig(provider=provider, api_key=api_key, model=row.get("ai_model"))
