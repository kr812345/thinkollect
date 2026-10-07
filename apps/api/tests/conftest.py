"""Test fixtures: hermetic fakes for Supabase and the embedding model.

No network, database, or model weights are needed to run this suite.
"""
import hashlib
import math
import os
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

# Environment must be set before the app (and its settings) are imported.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-tests-only-32bytes!")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "0")  # disabled unless a test enables it
os.environ.setdefault("CHAT_RATE_LIMIT_PER_MINUTE", "0")
os.environ.setdefault("LLM_API_KEY", "test-llm-key")
os.environ.setdefault("LLM_MODEL", "test-model")

import pytest
from fastapi.testclient import TestClient

from main import app
from src.core.supabase import get_supabase
from src.services import embedding as embedding_module
from src.services import insight as insight_module
from src.services import llm as llm_module


# ---------------------------------------------------------------- fake time
def _parse_ts(value) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


# ----------------------------------------------------------- fake embedding
def _text_vector(text: str) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return [b / 255.0 for b in digest] * 12  # 32 * 12 = 384 dimensions


def fake_embed_texts(texts: list[str]) -> list[list[float]]:
    return [_text_vector(t) for t in texts]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ------------------------------------------------------------ fake supabase
class FakeQuery:
    """Minimal chained query builder mirroring the supabase-py API surface
    used by the controllers: select/eq/gt/in_/order/upsert/execute."""

    def __init__(self, table: dict[str, dict]) -> None:
        self._table = table
        self._filters: list = []
        self._order_col: str | None = None
        self._columns: list[str] | None = None
        self._pending_upsert: list[dict] | None = None
        self._pending_insert: list[dict] | None = None
        self._pending_update: dict | None = None

    def select(self, columns: str):
        self._columns = [c.strip() for c in columns.split(",")]
        return self

    def eq(self, column, value):
        self._filters.append(lambda row: row.get(column) == value)
        return self

    def gt(self, column, value):
        self._filters.append(
            lambda row: _parse_ts(row[column]) > _parse_ts(value)
        )
        return self

    def in_(self, column, values):
        values = set(values)
        self._filters.append(lambda row: row.get(column) in values)
        return self

    def order(self, column):
        self._order_col = column
        return self

    def upsert(self, rows: list[dict], on_conflict: str | None = None):
        self._pending_upsert = [dict(r) for r in rows]
        return self

    def insert(self, rows):
        if isinstance(rows, dict):
            rows = [rows]
        self._pending_insert = [dict(r) for r in rows]
        return self

    def update(self, values: dict):
        self._pending_update = dict(values)
        return self

    def execute(self):
        if self._pending_upsert is not None:
            for row in self._pending_upsert:
                existing = self._table.get(row["id"], {})
                self._table[row["id"]] = {**existing, **row}
            return SimpleNamespace(data=self._pending_upsert)
        if self._pending_update is not None:
            updated = []
            for row in self._table.values():
                if all(f(row) for f in self._filters):
                    row.update(self._pending_update)
                    updated.append(dict(row))
            return SimpleNamespace(data=updated)
        if self._pending_insert is not None:
            for row in self._pending_insert:
                if row["id"] in self._table:
                    raise Exception(f"duplicate key value violates primary key: {row['id']}")
                row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                self._table[row["id"]] = row
            return SimpleNamespace(data=self._pending_insert)
        rows = [r for r in self._table.values() if all(f(r) for f in self._filters)]
        if self._order_col:
            rows.sort(key=lambda r: _parse_ts(r[self._order_col]))
        if self._columns:
            rows = [{k: r.get(k) for k in self._columns} for r in rows]
        else:
            rows = [dict(r) for r in rows]
        return SimpleNamespace(data=rows)


class FakeSupabase:
    def __init__(self) -> None:
        self.tables: dict[str, dict[str, dict]] = {"thoughts": {}, "users": {}}
        self.rpc_calls: list[dict] = []

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self.tables[name])

    def rpc(self, name: str, params: dict):
        assert name == "match_thoughts", f"unexpected rpc {name}"
        self.rpc_calls.append(params)
        query_vector = params["query_embedding"]
        results = []
        for row in self.tables["thoughts"].values():
            if row["user_id"] != params["p_user_id"]:
                continue
            if row.get("deleted_at") is not None or row.get("embedding") is None:
                continue
            results.append(
                {
                    "id": row["id"],
                    "content": row["content"],
                    "similarity": _cosine(query_vector, row["embedding"]),
                    "captured_at": row["captured_at"],
                }
            )
        results.sort(key=lambda r: r["similarity"], reverse=True)
        data = results[: params["match_count"]]
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=data))


# ---------------------------------------------------------------- fixtures
@pytest.fixture
def fake_supabase() -> FakeSupabase:
    return FakeSupabase()


def fake_mentor_comment(content: str) -> str:
    return f"Mentor note on: {content[:80]}"


def fake_llm_generate(prompt: str, system: str, **kwargs) -> str:
    return "A short answer grounded in your notebook."


@pytest.fixture
def client(fake_supabase, monkeypatch):
    monkeypatch.setattr(embedding_module, "embed_texts", fake_embed_texts)
    monkeypatch.setattr(
        embedding_module, "embed_text", lambda t: fake_embed_texts([t])[0]
    )
    monkeypatch.setattr(insight_module, "mentor_comment", fake_mentor_comment)
    monkeypatch.setattr(llm_module, "generate", fake_llm_generate)
    app.dependency_overrides[get_supabase] = lambda: fake_supabase
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ----------------------------------------------------------------- helpers
def signup(client: TestClient, email: str, password: str = "password123") -> dict:
    response = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def make_thought(
    thought_id: str | None = None,
    content: str = "a thought",
    updated_at: str = "2024-01-01T12:00:00Z",
    deleted_at: str | None = None,
    tags: list[str] | None = None,
) -> dict:
    return {
        "id": thought_id or str(uuid.uuid4()),
        "client_id": "device-1",
        "content": content,
        "tags": tags if tags is not None else ["idea"],
        "captured_at": "2024-01-01T12:00:00Z",
        "updated_at": updated_at,
        "deleted_at": deleted_at,
    }
