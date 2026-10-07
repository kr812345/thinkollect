"""Supabase client management.

The client is created lazily so importing modules never requires credentials
(tests inject a fake client via FastAPI dependency overrides).
"""
from fastapi import HTTPException, status
from supabase import Client, create_client

from src.core.config import get_settings

_client: Client | None = None


def get_supabase() -> Client:
    """FastAPI dependency returning the shared Supabase client."""
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.supabase_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase is not configured on the server.",
            )
        _client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _client
