"""Business logic for authentication against our own users table."""
import logging
import uuid

from fastapi import HTTPException, status
from supabase import Client

from src.core.password_hashing import hash_password, verify_password
from src.core.security import USERS_TABLE, create_access_token
from src.models.auth import AuthResponse, AuthUser, LoginRequest, SignupRequest

logger = logging.getLogger(__name__)


def _db_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Database error.",
    )


def register(supabase: Client, payload: SignupRequest) -> AuthResponse:
    email = payload.email  # already normalized (stripped + lowercased)

    try:
        existing = (
            supabase.table(USERS_TABLE)
            .select("id")
            .eq("email", email)
            .execute()
        )
    except Exception:
        logger.exception("User lookup failed during signup")
        raise _db_error()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists. Please log in.",
        )

    user_id = str(uuid.uuid4())
    try:
        supabase.table(USERS_TABLE).insert(
            {
                "id": user_id,
                "email": email,
                "hashed_password": hash_password(payload.password),
            }
        ).execute()
    except Exception:
        logger.exception("User insert failed during signup")
        raise _db_error()

    return AuthResponse(
        user=AuthUser(id=user_id, email=email),
        token=create_access_token(user_id),
    )


def login(supabase: Client, payload: LoginRequest) -> AuthResponse:
    email = payload.email

    try:
        response = (
            supabase.table(USERS_TABLE)
            .select("id, email, hashed_password")
            .eq("email", email)
            .execute()
        )
    except Exception:
        logger.exception("User lookup failed during login")
        raise _db_error()

    rows = response.data or []
    user = rows[0] if rows else None

    # Deliberately vague: do not reveal whether the email exists.
    if user is None or not verify_password(
        payload.password, user.get("hashed_password", "")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_id = str(user["id"])
    return AuthResponse(
        user=AuthUser(id=user_id, email=user["email"]),
        token=create_access_token(user_id),
    )
