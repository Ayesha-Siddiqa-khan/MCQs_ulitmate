"""Thin wrappers around the Supabase Python client.

Two flavours:
  - ``supabase_user_client(access_token)``: respects Row Level Security as the
    authenticated student. Use for every per-user operation.
  - ``supabase_admin_client()``: uses the service-role key. Use sparingly for
    bootstrap or for reads that must bypass RLS.
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import HTTPException, status
from supabase import Client, create_client

from app.core.config import Settings, get_settings
from app.core.security import CurrentUserDep


@lru_cache
def _admin_client() -> Client:
    s = get_settings()
    if not (s.supabase_url and s.supabase_service_role_key):
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin client")
    return create_client(s.supabase_url, s.supabase_service_role_key)


def supabase_admin_client() -> Client:
    return _admin_client()


def supabase_user_client(access_token: str, settings: Settings | None = None) -> Client:
    s = settings or get_settings()
    if not (s.supabase_url and s.supabase_anon_key):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL / SUPABASE_ANON_KEY missing on server",
        )
    client = create_client(s.supabase_url, s.supabase_anon_key)
    # PostgREST + Storage need the user JWT so RLS sees auth.uid()
    client.postgrest.auth(access_token)
    try:
        client.storage._client.headers["Authorization"] = f"Bearer {access_token}"  # type: ignore[attr-defined]
    except Exception:
        pass
    return client


def get_user_client(user: CurrentUserDep) -> Client:
    return supabase_user_client(user.access_token)
