"""JWT validation + Fernet encryption helpers."""
from __future__ import annotations

import base64
import hashlib
from typing import Annotated

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import Settings, get_settings


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


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    token = creds.credentials
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured on the server",
        )
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False},  # supabase audience varies; we accept any
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"invalid token: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token missing subject")

    return CurrentUser(id=sub, email=payload.get("email"), access_token=token)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
