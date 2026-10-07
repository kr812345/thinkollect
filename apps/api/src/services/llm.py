"""OpenAI-compatible chat completions client.

Works with OpenAI, Groq, OpenRouter, local Ollama, or any compatible proxy.
All calls are synchronous and time-bounded; callers must treat failures as
soft (insights) or map them to HTTP 503 (chat).
"""
import logging

import httpx

from src.core.config import get_settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when the LLM provider is unavailable or returns a bad response."""


def generate(
    prompt: str,
    system: str,
    *,
    max_tokens: int = 220,
    temperature: float = 0.6,
) -> str:
    settings = get_settings()
    if not settings.llm_configured:
        raise LLMError("LLM is not configured.")

    url = settings.LLM_BASE_URL.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    try:
        response = httpx.post(
            url,
            json=payload,
            headers=headers,
            timeout=settings.LLM_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPError as exc:
        logger.warning("LLM request failed: %s", exc)
        raise LLMError("LLM request failed.") from exc
    except ValueError as exc:
        raise LLMError("LLM returned invalid JSON.") from exc

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMError("LLM returned an unexpected payload.") from exc

    text = (text or "").strip()
    if not text:
        raise LLMError("LLM returned an empty completion.")
    return text
