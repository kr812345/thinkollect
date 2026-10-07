"""Application configuration loaded from environment variables / .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Supabase (used as Postgres + pgvector store only, NOT Supabase Auth) ---
    # The service role key is required: the backend writes on behalf of users
    # and must bypass RLS (user scoping is enforced in application code).
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # --- Auth (custom JWT, signed by this backend) ---
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    TOKEN_EXPIRY_MINUTES: int = 60 * 24 * 7  # 7 days

    # --- Embeddings ---
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # --- LLM (OpenAI-compatible: OpenAI, Groq, OpenRouter, Ollama, ...) ---
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TIMEOUT_SECONDS: float = 20.0

    # --- Security ---
    # Comma-separated list of allowed CORS origins ("*" only for local dev).
    CORS_ORIGINS: str = "*"
    # Max auth attempts (signup/login) per IP per minute. 0 disables limiting.
    RATE_LIMIT_PER_MINUTE: int = 10
    # Max chat messages per user per minute. 0 disables limiting.
    CHAT_RATE_LIMIT_PER_MINUTE: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_ROLE_KEY)

    @property
    def llm_configured(self) -> bool:
        return bool(self.LLM_API_KEY and self.LLM_MODEL)


@lru_cache
def get_settings() -> Settings:
    return Settings()
