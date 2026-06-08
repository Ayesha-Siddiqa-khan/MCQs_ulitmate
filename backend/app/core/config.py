"""Centralized settings loaded from environment variables.

All values come from environment variables (or backend/.env, which pydantic
loads automatically). Frontend-only NEXT_PUBLIC_* values must never appear
here; the browser never reads anything in this file.
"""
from __future__ import annotations

import logging
import os
import warnings
from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger("mcq-mentor.config")

# Resolve env files relative to this file (backend/app/core/) so behaviour is
# independent of the working directory uvicorn is launched from.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_DEFAULT_ENV_FILES = (_BACKEND_DIR / ".env", _BACKEND_DIR.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv("BACKEND_ENV_FILE", str(_DEFAULT_ENV_FILES[0])),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App -----------------------------------------------------------------
    app_env: str = Field(default="development", validation_alias="APP_ENV")

    # ---- Supabase (server-side ONLY) -----------------------------------------
    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_anon_key: str = Field(default="", validation_alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    # The Supabase project's JWT signing secret. Also accept a generic
    # JWT_SECRET for documentation parity with the architecture spec.
    supabase_jwt_secret: str = Field(default="", validation_alias="SUPABASE_JWT_SECRET")
    jwt_secret: str = Field(default="", validation_alias="JWT_SECRET")
    supabase_storage_bucket: str = Field(default="materials", validation_alias="SUPABASE_STORAGE_BUCKET")

    # ---- Server --------------------------------------------------------------
    backend_host: str = Field(default="0.0.0.0", validation_alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, validation_alias="BACKEND_PORT")
    # Accept either BACKEND_CORS_ORIGINS (legacy) or ALLOWED_ORIGINS (new).
    backend_cors_origins: str = Field(
        default="http://localhost:3000",
        validation_alias="BACKEND_CORS_ORIGINS",
    )
    allowed_origins: str | None = Field(default=None, validation_alias="ALLOWED_ORIGINS")

    # ---- Optional direct Postgres -------------------------------------------
    database_url: str = Field(default="", validation_alias="DATABASE_URL")

    # ---- Encryption (Fernet-compatible key, optional). If empty, derived from JWT secret.
    encryption_key: str = Field(default="", validation_alias="ENCRYPTION_KEY")

    # ---- Upload limits -------------------------------------------------------
    max_upload_mb: int = Field(default=50, validation_alias="MAX_UPLOAD_MB")
    max_materials_per_user: int = Field(default=5, validation_alias="MAX_MATERIALS_PER_USER")

    # ---- Fallback AI keys (only used if a student hasn't configured their own) ----
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", validation_alias="ANTHROPIC_API_KEY")
    google_api_key: str = Field(default="", validation_alias="GOOGLE_API_KEY")

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.allowed_origins or self.backend_cors_origins
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("prod", "production")

    @model_validator(mode="after")
    def _fail_fast_on_missing_secrets(self) -> "Settings":
        # Treat JWT_SECRET as an alias for SUPABASE_JWT_SECRET.
        if self.jwt_secret and not self.supabase_jwt_secret:
            self.supabase_jwt_secret = self.jwt_secret

        missing: list[str] = []
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        # Note: Supabase Cloud issues ES256 JWTs; we verify them with the
        # project's JWKS endpoint, so SUPABASE_JWT_SECRET is no longer
        # strictly required for token validation.  It's only needed if the
        # project ever falls back to legacy HS256 tokens.
        if not self.supabase_anon_key:
            missing.append("SUPABASE_ANON_KEY")
        if not self.supabase_service_role_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")

        if not missing:
            return self

        msg = (
            "backend/.env is missing required values: " + ", ".join(missing) + ". "
            "Copy backend/.env.example to backend/.env and fill in the values from "
            "Supabase Dashboard -> Project Settings -> API. NEVER put these in the "
            "frontend (they would be exposed to the browser via NEXT_PUBLIC_)."
        )
        if self.is_production:
            # Hard fail in production.
            raise RuntimeError(msg)
        # Loud warning in development so the developer can still poke around.
        warnings.warn(msg, stacklevel=2)
        log.warning(msg)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
