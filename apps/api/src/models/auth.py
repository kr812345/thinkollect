"""Request/response schemas for the authentication API."""
from pydantic import BaseModel, EmailStr, Field, field_validator

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def _normalize_email(email: str) -> str:
    return email.strip().lower()


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
    )

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class AuthUser(BaseModel):
    id: str
    email: str


class AuthResponse(BaseModel):
    status: str = "success"
    user: AuthUser
    # Null when Supabase requires email confirmation before a session exists.
    token: str | None = None


class UserProfile(BaseModel):
    id: str
    email: str
    created_at: str | None = None
