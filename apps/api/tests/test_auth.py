"""Contract, validation, and security tests for /api/auth/*."""
from datetime import datetime, timedelta, timezone

import jwt

from src.core.config import get_settings
from src.core.rate_limit import _limiter

from .conftest import auth_headers, signup


# ------------------------------------------------------------------ signup
def test_signup_success_matches_contract(client):
    response = client.post(
        "/api/auth/signup",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert body["user"]["email"] == "user@example.com"
    assert body["user"]["id"]
    assert isinstance(body["token"], str) and body["token"]


def test_signup_invalid_email_rejected(client):
    response = client.post(
        "/api/auth/signup", json={"email": "not-an-email", "password": "password123"}
    )
    assert response.status_code == 422


def test_signup_short_password_rejected(client):
    response = client.post(
        "/api/auth/signup", json={"email": "user@example.com", "password": "short"}
    )
    assert response.status_code == 422


def test_signup_missing_fields_rejected(client):
    assert client.post("/api/auth/signup", json={}).status_code == 422
    assert (
        client.post("/api/auth/signup", json={"email": "u@example.com"}).status_code
        == 422
    )


def test_signup_duplicate_email_conflict(client):
    signup(client, "dupe@example.com")
    response = client.post(
        "/api/auth/signup",
        json={"email": "dupe@example.com", "password": "password123"},
    )
    assert response.status_code == 409


def test_signup_password_not_echoed(client):
    response = client.post(
        "/api/auth/signup",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert "securepassword123" not in response.text


# ------------------------------------------------------------------- login
def test_login_success_matches_contract(client):
    signup(client, "user@example.com", "securepassword123")
    response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["user"]["email"] == "user@example.com"
    assert isinstance(body["token"], str) and body["token"]


def test_login_wrong_password_unauthorized(client):
    signup(client, "user@example.com", "securepassword123")
    response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_login_unknown_email_same_error(client):
    """No user-enumeration: unknown email yields the same 401 as a bad password."""
    response = client.post(
        "/api/auth/login",
        json={"email": "ghost@example.com", "password": "whatever123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


def test_login_invalid_email_rejected(client):
    response = client.post(
        "/api/auth/login", json={"email": "nope", "password": "password123"}
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------- me
def test_me_returns_profile(client):
    user = signup(client, "me@example.com")
    response = client.get("/api/auth/me", headers=auth_headers(user["token"]))
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user["user"]["id"]
    assert body["email"] == "me@example.com"
    assert "created_at" in body


def test_me_without_token_unauthorized(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.headers.get("www-authenticate") == "Bearer"


def test_me_with_garbage_token_unauthorized(client):
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401


def test_me_with_wrong_scheme_unauthorized(client):
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Basic abc123"}
    )
    assert response.status_code == 401


def test_me_with_expired_token_unauthorized(client):
    user = signup(client, "expired@example.com")
    expired = jwt.encode(
        {
            "sub": user["user"]["id"],
            "iat": datetime.now(timezone.utc) - timedelta(days=10),
            "exp": datetime.now(timezone.utc) - timedelta(days=9),
        },
        get_settings().JWT_SECRET,
        algorithm="HS256",
    )
    response = client.get("/api/auth/me", headers=auth_headers(expired))
    assert response.status_code == 401


def test_me_with_tampered_token_unauthorized(client):
    user = signup(client, "tampered@example.com")
    forged = jwt.encode(
        {"sub": user["user"]["id"]}, "wrong-secret", algorithm="HS256"
    )
    response = client.get("/api/auth/me", headers=auth_headers(forged))
    assert response.status_code == 401


def test_me_with_deleted_user_unauthorized(client, fake_supabase):
    """Tokens of deleted users stop working immediately."""
    user = signup(client, "gone@example.com")
    fake_supabase.tables["users"].clear()
    response = client.get("/api/auth/me", headers=auth_headers(user["token"]))
    assert response.status_code == 401


# -------------------------------------------------------- email normalization
def test_email_is_case_insensitive(client):
    signup(client, "User@Example.COM", "securepassword123")
    response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert response.status_code == 200


def test_duplicate_email_different_case_conflict(client):
    signup(client, "user@example.com")
    response = client.post(
        "/api/auth/signup",
        json={"email": "USER@example.com", "password": "password123"},
    )
    assert response.status_code == 409


# -------------------------------------------------------------- rate limit
def test_auth_endpoints_are_rate_limited(client, monkeypatch):
    _limiter._hits.clear()
    monkeypatch.setattr(get_settings(), "RATE_LIMIT_PER_MINUTE", 3)
    try:
        for _ in range(3):
            response = client.post(
                "/api/auth/login",
                json={"email": "a@example.com", "password": "password123"},
            )
            assert response.status_code == 401
        response = client.post(
            "/api/auth/login",
            json={"email": "a@example.com", "password": "password123"},
        )
        assert response.status_code == 429
    finally:
        _limiter._hits.clear()
