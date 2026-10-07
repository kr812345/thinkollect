"""Authentication primitives: JWT issuing/validation and current-user lookup.

The backend signs its own JWTs (HS256) — Supabase is used purely as a
database, not as an auth provider.
"""
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import Client

from src.core.config import get_settings
from src.core.supabase import get_supabase

_bearer_scheme = HTTPBearer(
    auto_error=False,
    description="Access token issued by this backend",
)

USERS_TABLE = "users"


class CurrentUser(BaseModel):
    id: str
    email: str
    created_at: str | None = None


def _unauthorized(detail: str = "Invalid or expired token.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def create_access_token(user_id: str) -> str:
    """Sign a JWT for the given user id."""
    settings = get_settings()
    if not settings.JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on the server.",
        )
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.TOKEN_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _decode_access_token(token: str) -> str:
    """Validate a JWT and return its subject (user id)."""
    settings = get_settings()
    if not settings.JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on the server.",
        )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.PyJWTError:
        raise _unauthorized()
    subject = payload.get("sub")
    if not subject:
        raise _unauthorized()
    return str(subject)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> CurrentUser:
    """FastAPI dependency: require a valid bearer token, return its user.

    The user row is loaded on every request so deleted/disabled accounts
    lose access immediately, even before their token expires.
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Missing bearer token.")

    user_id = _decode_access_token(credentials.credentials)

    try:
        response = (
            supabase.table(USERS_TABLE)
            .select("id, email, created_at")
            .eq("id", user_id)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable.",
        )

    rows = response.data or []
    if not rows:
        raise _unauthorized()
    row = rows[0]
    return CurrentUser(
        id=str(row["id"]),
        email=row.get("email", ""),
        created_at=str(row.get("created_at", "") or "") or None,
    )
