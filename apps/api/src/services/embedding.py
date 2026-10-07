"""Sentence-embedding service.

The model is loaded lazily on first use so importing this module is cheap
and tests can run without downloading model weights.
"""
import logging
import threading

from src.core.config import get_settings

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()


def _load_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from sentence_transformers import SentenceTransformer

                model_name = get_settings().EMBEDDING_MODEL
                logger.info("Loading embedding model %s ...", model_name)
                _model = SentenceTransformer(model_name)
                logger.info("Embedding model loaded.")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts into 384-dim vectors."""
    if not texts:
        return []
    vectors = _load_model().encode(texts)
    return vectors.tolist()


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]
