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
    # The storage client is built lazily on first .storage access; it copies
    # `client.options.headers` into its own per-request Headers. If we leave
    # the anon-key Authorization there, storage uploads will be sent as the
    # anon role and hit "new row violates row-level security policy" on the
    # user-scoped storage.objects policy. Setting it on options.headers
    # BEFORE any .storage access is the supported way to fix this.
    client.options.headers["Authorization"] = f"Bearer {access_token}"
    # PostgREST is a separate httpx session; it needs the same header set
    # through its own auth() helper.
    client.postgrest.auth(access_token)
    return client


def get_user_client(user: CurrentUserDep) -> Client:
    return supabase_user_client(user.access_token)
