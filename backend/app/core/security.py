"""JWT validation + Fernet encryption helpers.

Token sources, in priority order:
  1. `Authorization: Bearer <jwt>` header (works for any caller).
  2. `mcq_access_token` HttpOnly cookie set by /api/auth/{login,signup}.
     This is what the browser sends automatically.

Verification strategy:
  Supabase Cloud issues ES256 tokens signed with a per-project EC key.
  The public key is published at:
    <SUPABASE_URL>/auth/v1/.well-known/jwks.json
  We fetch and cache that JWKS, then verify the token's signature using
  the `kid` from the JWT header.  This avoids needing the legacy
  SUPABASE_JWT_SECRET and works whether the project is brand-new or old.
"""
from __future__ import annotations

import base64
import hashlib
import threading
import time
from typing import Annotated, Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import Settings, get_settings

ACCESS_COOKIE_NAME = "mcq_access_token"

# JWKS cache (process-local).  Re-fetched when expired or when the
# incoming token's `kid` is unknown (key rotation).
_jwks_lock = threading.Lock()
_jwks_cache: dict[str, Any] = {"keys": [], "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 300


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    access_token: str


_bearer = HTTPBearer(auto_error=False)


def _derive_fernet_key(settings: Settings) -> bytes:
    if settings.encryption_key:
        raw = settings.encryption_key.encode("utf-8")
        # Already valid Fernet?
        if len(raw) == 44 and raw.endswith(b"="):
            return raw
    seed = (settings.encryption_key or settings.supabase_jwt_secret or "mcq-mentor-dev").encode("utf-8")
    return base64.urlsafe_b64encode(hashlib.sha256(seed).digest())


def encrypt_secret(value: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    f = Fernet(_derive_fernet_key(settings))
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    f = Fernet(_derive_fernet_key(settings))
    try:
        return f.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("invalid encrypted value") from exc


def _fetch_jwks(supabase_url: str, force: bool = False) -> list[dict[str, Any]]:
    """Fetch the project's JWKS, caching for 5 minutes."""
    with _jwks_lock:
        now = time.time()
        if not force and (now - _jwks_cache["fetched_at"]) < _JWKS_TTL_SECONDS and _jwks_cache["keys"]:
            return _jwks_cache["keys"]
        url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        try:
            r = httpx.get(url, timeout=5.0)
            r.raise_for_status()
            keys = r.json().get("keys", [])
        except Exception as exc:  # pragma: no cover - network
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"failed to fetch Supabase JWKS: {exc}",
            ) from exc
        _jwks_cache["keys"] = keys
        _jwks_cache["fetched_at"] = now
        return keys


def _decode_token(token: str, settings: Settings) -> CurrentUser:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not configured on the server",
        )

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token header: {exc}") from exc

    alg = header.get("alg")
    kid = header.get("kid")

    try:
        if alg and alg.startswith("ES") and kid:
            keys = _fetch_jwks(settings.supabase_url)
            jwk = next((k for k in keys if k.get("kid") == kid), None)
            if jwk is None:
                # Maybe the project rotated keys; refetch once.
                keys = _fetch_jwks(settings.supabase_url, force=True)
                jwk = next((k for k in keys if k.get("kid") == kid), None)
            if jwk is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"unknown signing key (kid={kid})",
                )
            payload = jwt.decode(
                token,
                jwk,
                algorithms=[alg],
                audience="authenticated",
                options={"verify_aud": False},
            )
        elif alg == "HS256" and settings.supabase_jwt_secret:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": False},
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"unsupported token alg={alg!r} (no JWKS key match)",
            )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token missing subject")

    return CurrentUser(id=sub, email=payload.get("email"), access_token=token)


def _cookie_or_bearer_token(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    cookie_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE_NAME),
) -> str | None:
    if creds and creds.credentials:
        return creds.credentials
    return cookie_token


async def get_current_user(
    token: Annotated[str | None, Depends(_cookie_or_bearer_token)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    return _decode_token(token, settings)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
