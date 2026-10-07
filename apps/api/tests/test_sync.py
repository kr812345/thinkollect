"""Contract, validation, and security tests for /api/thoughts/sync."""
import uuid

from .conftest import auth_headers, make_thought, signup


def _push(client, token, thoughts):
    return client.post(
        "/api/thoughts/sync", json={"thoughts": thoughts}, headers=auth_headers(token)
    )


def _pull(client, token, params=None):
    return client.get("/api/thoughts/sync", params=params, headers=auth_headers(token))


# ------------------------------------------------------------ auth required
def test_pull_requires_auth(client):
    assert client.get("/api/thoughts/sync").status_code == 401


def test_push_requires_auth(client):
    response = client.post("/api/thoughts/sync", json={"thoughts": []})
    assert response.status_code == 401


# --------------------------------------------------------------------- push
def test_push_success_matches_contract(client):
    user = signup(client, "push@example.com")
    response = _push(client, user["token"], [make_thought()])
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert body["synced_count"] == 1


def test_push_empty_batch_ok(client):
    user = signup(client, "empty@example.com")
    response = _push(client, user["token"], [])
    assert response.status_code == 200
    assert response.json()["synced_count"] == 0


def test_push_generates_embedding(client, fake_supabase):
    user = signup(client, "embed@example.com")
    thought = make_thought()
    _push(client, user["token"], [thought])
    stored = fake_supabase.tables["thoughts"][thought["id"]]
    assert stored["embedding"] is not None
    assert len(stored["embedding"]) == 384


def test_push_soft_delete_stores_null_embedding(client, fake_supabase):
    user = signup(client, "del@example.com")
    thought = make_thought(deleted_at="2024-01-02T08:00:00Z")
    response = _push(client, user["token"], [thought])
    assert response.json()["synced_count"] == 1
    stored = fake_supabase.tables["thoughts"][thought["id"]]
    assert stored["deleted_at"] is not None
    assert stored["embedding"] is None


def test_push_last_write_wins(client, fake_supabase):
    user = signup(client, "lww@example.com")
    thought_id = str(uuid.uuid4())

    newer = make_thought(thought_id, content="newer", updated_at="2024-01-02T00:00:00Z")
    assert _push(client, user["token"], [newer]).json()["synced_count"] == 1

    # An older update for the same id must be skipped, not applied.
    older = make_thought(thought_id, content="older", updated_at="2024-01-01T00:00:00Z")
    response = _push(client, user["token"], [older])
    body = response.json()
    assert body["synced_count"] == 0
    assert body["skipped_count"] == 1
    assert fake_supabase.tables["thoughts"][thought_id]["content"] == "newer"


def test_push_cannot_hijack_other_users_thought(client, fake_supabase):
    owner = signup(client, "owner@example.com")
    attacker = signup(client, "attacker@example.com")
    thought_id = str(uuid.uuid4())

    _push(client, owner["token"], [make_thought(thought_id, content="owner's thought")])

    # Attacker reuses the victim's thought id with a NEWER timestamp.
    evil = make_thought(thought_id, content="hijacked", updated_at="2025-01-01T00:00:00Z")
    response = _push(client, attacker["token"], [evil])
    assert response.json()["synced_count"] == 0
    stored = fake_supabase.tables["thoughts"][thought_id]
    assert stored["content"] == "owner's thought"
    owner_id = owner["user"]["id"]
    assert stored["user_id"] == owner_id


# ------------------------------------------------------------ push validation
def test_push_invalid_uuid_rejected(client):
    user = signup(client, "v1@example.com")
    bad = make_thought()
    bad["id"] = "not-a-uuid"
    assert _push(client, user["token"], [bad]).status_code == 422


def test_push_empty_content_rejected(client):
    user = signup(client, "v2@example.com")
    bad = make_thought(content="")
    assert _push(client, user["token"], [bad]).status_code == 422


def test_push_oversized_content_rejected(client):
    user = signup(client, "v3@example.com")
    bad = make_thought(content="x" * 10_001)
    assert _push(client, user["token"], [bad]).status_code == 422


def test_push_too_many_tags_rejected(client):
    user = signup(client, "v4@example.com")
    bad = make_thought(tags=[f"tag{i}" for i in range(21)])
    assert _push(client, user["token"], [bad]).status_code == 422


def test_push_oversized_tag_rejected(client):
    user = signup(client, "v5@example.com")
    bad = make_thought(tags=["x" * 51])
    assert _push(client, user["token"], [bad]).status_code == 422


def test_push_oversized_batch_rejected(client):
    user = signup(client, "v6@example.com")
    batch = [make_thought() for _ in range(501)]
    assert _push(client, user["token"], batch).status_code == 422


def test_push_missing_timestamps_rejected(client):
    user = signup(client, "v7@example.com")
    bad = make_thought()
    del bad["captured_at"]
    assert _push(client, user["token"], [bad]).status_code == 422


def test_push_malformed_json_rejected(client):
    user = signup(client, "v8@example.com")
    response = client.post(
        "/api/thoughts/sync",
        content=b"{not json",
        headers={**auth_headers(user["token"]), "Content-Type": "application/json"},
    )
    assert response.status_code == 422


# --------------------------------------------------------------------- pull
def test_pull_empty(client):
    user = signup(client, "pull-empty@example.com")
    response = _pull(client, user["token"])
    assert response.status_code == 200
    assert response.json() == []


def test_pull_returns_contract_shape(client):
    user = signup(client, "pull@example.com")
    thought = make_thought(tags=["idea", "work"])
    _push(client, user["token"], [thought])

    response = _pull(client, user["token"])
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    row = rows[0]
    assert row["id"] == thought["id"]
    assert row["content"] == thought["content"]
    assert row["tags"] == ["idea", "work"]
    assert "captured_at" in row and "updated_at" in row
    assert row["deleted_at"] is None


def test_pull_includes_soft_deleted(client):
    user = signup(client, "pull-del@example.com")
    thought = make_thought(deleted_at="2024-01-02T08:00:00Z")
    _push(client, user["token"], [thought])
    rows = _pull(client, user["token"]).json()
    assert len(rows) == 1
    assert rows[0]["deleted_at"] is not None


def test_pull_with_last_sync_filters(client, fake_supabase):
    user = signup(client, "incremental@example.com")
    old = make_thought(content="old", updated_at="2024-01-01T00:00:00Z")
    new = make_thought(content="new", updated_at="2024-02-01T00:00:00Z")
    _push(client, user["token"], [old, new])
    # Align insight timestamps so the filter is driven by updated_at only.
    for row in fake_supabase.tables["thoughts"].values():
        row["insight_updated_at"] = row["updated_at"]

    rows = _pull(client, user["token"], params={"last_sync": "2024-01-15T00:00:00Z"}).json()
    assert [r["content"] for r in rows] == ["new"]


def test_pull_invalid_last_sync_rejected(client):
    user = signup(client, "badparam@example.com")
    response = _pull(client, user["token"], params={"last_sync": "not-a-date"})
    assert response.status_code == 422


def test_pull_only_returns_own_thoughts(client):
    user_a = signup(client, "a@example.com")
    user_b = signup(client, "b@example.com")
    _push(client, user_a["token"], [make_thought(content="A's secret")])

    assert _pull(client, user_b["token"]).json() == []
    assert len(_pull(client, user_a["token"]).json()) == 1
