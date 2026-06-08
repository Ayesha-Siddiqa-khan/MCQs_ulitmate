"""Auth routes — backend talks to Supabase Auth; the frontend never sees
Supabase credentials or the Supabase JS SDK.

Flow:
  - Frontend calls POST /api/auth/{signup,login,logout} with JSON body.
  - Backend talks to Supabase via the supabase-py client (server-only
    env vars: SUPABASE_URL + SUPABASE_ANON_KEY).
  - On success the backend sets HttpOnly cookies
    (mcq_access_token, mcq_refresh_token) on its own response.
  - The browser forwards those cookies back on subsequent calls to the
    backend (api-client uses credentials: "include"). The backend
    validates them in app.core.security.get_current_user.
  - GET /api/auth/me returns the current user or 401.
"""
from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status  # noqa: F401
from pydantic import BaseModel, Field
from supabase import Client, create_client

from app.core.config import Settings, get_settings
from app.core.security import CurrentUserDep

log = logging.getLogger("mcq-mentor.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# Cookie names used to carry the Supabase session to the browser.
# They are HttpOnly + SameSite=Lax so the browser sends them on every
# same-site / cross-site (GET) request to this backend, but JS can't read
# them (defence in depth — frontend still uses Authorization header too
# for non-browser callers).
ACCESS_COOKIE = "mcq_access_token"
REFRESH_COOKIE = "mcq_refresh_token"


class SignupBody(BaseModel):
    # Plain str to avoid the pydantic[email] extra dependency. The
    # frontend already validates with zod; we do a simple sanity check.
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class LoginBody(SignupBody):
    remember_me: bool = False


class AuthResponse(BaseModel):
    id: str
    email: str | None = None


def _scoped_client(settings: Settings) -> Client:
    if not (settings.supabase_url and settings.supabase_anon_key):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase is not configured on the server (SUPABASE_URL / SUPABASE_ANON_KEY).",
        )
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def _signup_error_response(exc: Exception) -> tuple[int, str]:
    message = str(exc).strip()
    lower = message.lower()

    if "rate limit" in lower:
        return status.HTTP_429_TOO_MANY_REQUESTS, (
            "Signup email limit reached. Wait before trying again, or configure Supabase SMTP."
        )
    if "email address" in lower and "invalid" in lower:
        return status.HTTP_400_BAD_REQUEST, "Use a valid email address that can receive confirmation email."
    if "password" in lower:
        return status.HTTP_400_BAD_REQUEST, message
    if "user already registered" in lower:
        return status.HTTP_400_BAD_REQUEST, "This email may already have an account. Try logging in instead."
    return status.HTTP_400_BAD_REQUEST, "Could not create account."


def _set_session_cookies(
    response: Response,
    session: dict[str, Any] | None,
    remember_me: bool = True,
) -> None:
    """Mirror the Supabase session onto HttpOnly cookies."""
    if not session:
        return
    access = session.get("access_token")
    refresh = session.get("refresh_token")
    common = {
        "httponly": True,
        "samesite": "lax",
        "secure": False,  # set True behind HTTPS in production via env if you want
        "path": "/",
    }
    access_options = {"max_age": 60 * 60} if remember_me else {}
    refresh_options = {"max_age": 60 * 60 * 24 * 7} if remember_me else {}
    if access:
        response.set_cookie(ACCESS_COOKIE, access, **access_options, **common)
    if refresh:
        response.set_cookie(REFRESH_COOKIE, refresh, **refresh_options, **common)


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")


@router.post("/signup", response_model=AuthResponse)
async def signup(
    body: SignupBody,
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    sb = _scoped_client(settings)
    try:
        res = sb.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as exc:  # pragma: no cover - upstream errors
        log.warning("supabase signup error: %s", exc)
        status_code, detail = _signup_error_response(exc)
        raise HTTPException(status_code=status_code, detail=detail) from exc

    session = getattr(res, "session", None)
    user = getattr(res, "user", None)
    if session is None:
        # Supabase returns no session when email confirmation is required.
        # We still report success: the user must confirm via email.
        return AuthResponse(id="", email=body.email)

    _set_session_cookies(response, session.model_dump() if hasattr(session, "model_dump") else session)
    return AuthResponse(id=user.id, email=user.email)


@router.post("/login", response_model=AuthResponse)
async def login(
    body: LoginBody,
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    sb = _scoped_client(settings)
    try:
        res = sb.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as exc:
        log.info("supabase login failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid email or password.") from exc

    user = getattr(res, "user", None)
    session = getattr(res, "session", None)
    if user is None or session is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    _set_session_cookies(
        response,
        session.model_dump() if hasattr(session, "model_dump") else session,
        remember_me=body.remember_me,
    )
    return AuthResponse(id=user.id, email=user.email)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    _clear_session_cookies(response)
    # Best-effort server-side sign-out; ignore failures so the client is
    # never blocked by a Supabase outage.
    try:
        sb = _scoped_client(settings)
        sb.auth.sign_out()
    except Exception:
        pass
    return Response(status_code=204)


@router.get("/me", response_model=AuthResponse)
async def me(user: CurrentUserDep) -> AuthResponse:
    return AuthResponse(id=user.id, email=user.email)


# Optional helper: allow server actions / middleware to forward the
# access_token cookie explicitly when the FastAPI request is initiated
# server-side (e.g. by Next.js, where the browser cookie is in a
# different origin). Routers elsewhere depend on
# get_current_user; this dependency just exposes the raw cookie.
# (Currently unused — get_current_user already reads the cookie.)
def _access_token_cookie_dep(
    cookie_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
) -> str | None:
    return cookie_token
