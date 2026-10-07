"""Request/response schemas for the data sync and search APIs."""
from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

MAX_CONTENT_LENGTH = 10_000
MAX_TAGS = 20
MAX_TAG_LENGTH = 50
MAX_SYNC_BATCH = 500
MAX_QUERY_LENGTH = 1_000
MAX_SEARCH_LIMIT = 50


def _ensure_aware(value: datetime) -> datetime:
    """Treat naive timestamps as UTC instead of rejecting mobile clients."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class ThoughtSyncItem(BaseModel):
    id: UUID
    client_id: str = Field(min_length=1, max_length=128)
    content: str = Field(min_length=1, max_length=MAX_CONTENT_LENGTH)
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS)
    captured_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: list[str]) -> list[str]:
        cleaned = []
        for tag in tags:
            tag = tag.strip()
            if not tag:
                raise ValueError("tags must not contain empty strings")
            if len(tag) > MAX_TAG_LENGTH:
                raise ValueError(
                    f"tags must be at most {MAX_TAG_LENGTH} characters"
                )
            cleaned.append(tag)
        return cleaned

    @field_validator("captured_at", "updated_at", "deleted_at")
    @classmethod
    def ensure_timezone(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return _ensure_aware(value)


class SyncPushRequest(BaseModel):
    thoughts: list[ThoughtSyncItem] = Field(max_length=MAX_SYNC_BATCH)


class SyncPushResponse(BaseModel):
    status: str = "success"
    synced_count: int
    # Items skipped because a newer version already exists on the server
    # or the id belongs to a different user.
    skipped_count: int = 0


class ThoughtOut(BaseModel):
    id: UUID
    content: str
    tags: list[str] = Field(default_factory=list)
    captured_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    insight: str | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=MAX_QUERY_LENGTH)
    limit: int = Field(default=10, ge=1, le=MAX_SEARCH_LIMIT)

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be blank")
        return value


class SearchResult(BaseModel):
    id: UUID
    content: str
    similarity: float
    captured_at: datetime


MAX_GRAPH_NODES = 200
MAX_CHAT_MESSAGE = 2_000
MAX_CHAT_HISTORY = 20


class GraphNode(BaseModel):
    id: UUID
    content: str
    insight: str | None = None
    captured_at: datetime


class GraphEdge(BaseModel):
    source: UUID
    target: UUID
    similarity: float


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ChatHistoryItem(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE)
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=MAX_CHAT_HISTORY)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message must not be blank")
        return value


class ChatSource(BaseModel):
    id: UUID
    content: str
    similarity: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource] = Field(default_factory=list)
