"""Mentor-style comments attached to a single thought."""
import logging

from src.services.llm import LLMError, generate

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a calm, sharp mentor looking at a notebook page. "
    "Write a short margin comment on the idea — not a reply, not a chat, "
    "not a list of questions. Be specific to what they wrote. "
    "Two to four sentences. No greeting, no sign-off, no markdown."
)


def mentor_comment(content: str) -> str | None:
    """Return a mentor comment, or None if the LLM is unavailable."""
    try:
        return generate(content.strip(), _SYSTEM, max_tokens=180, temperature=0.5)
    except LLMError:
        logger.info("Skipping mentor comment; LLM unavailable.")
        return None
