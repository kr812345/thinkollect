"""Mentor insight generation on sync push/pull."""
from src.services import insight as insight_module

from .conftest import auth_headers, make_thought, signup


def test_push_stores_mentor_insight(client, fake_supabase):
    user = signup(client, "insight@example.com")
    thought = make_thought(content="Ship a weekly idea newsletter")
    response = client.post(
        "/api/thoughts/sync",
        json={"thoughts": [thought]},
        headers=auth_headers(user["token"]),
    )
    assert response.status_code == 200
    stored = fake_supabase.tables["thoughts"][thought["id"]]
    assert stored["insight"] == "Mentor note on: Ship a weekly idea newsletter"
    assert stored["insight_updated_at"]


def test_pull_includes_insight(client):
    user = signup(client, "pull-insight@example.com")
    thought = make_thought(content="Build a tiny CLI for notes")
    client.post(
        "/api/thoughts/sync",
        json={"thoughts": [thought]},
        headers=auth_headers(user["token"]),
    )
    rows = client.get("/api/thoughts/sync", headers=auth_headers(user["token"])).json()
    assert rows[0]["insight"].startswith("Mentor note on:")


def test_soft_delete_clears_insight(client, fake_supabase):
    user = signup(client, "clear-insight@example.com")
    thought_id = make_thought(content="alive")["id"]
    client.post(
        "/api/thoughts/sync",
        json={"thoughts": [make_thought(thought_id, content="alive")]},
        headers=auth_headers(user["token"]),
    )
    deleted = make_thought(
        thought_id, content="alive", updated_at="2024-02-01T00:00:00Z",
        deleted_at="2024-02-01T00:00:00Z",
    )
    client.post(
        "/api/thoughts/sync",
        json={"thoughts": [deleted]},
        headers=auth_headers(user["token"]),
    )
    assert fake_supabase.tables["thoughts"][thought_id]["insight"] is None


def test_sync_succeeds_when_llm_fails(client, fake_supabase, monkeypatch):
    monkeypatch.setattr(insight_module, "mentor_comment", lambda _c: None)
    user = signup(client, "no-llm@example.com")
    thought = make_thought()
    response = client.post(
        "/api/thoughts/sync",
        json={"thoughts": [thought]},
        headers=auth_headers(user["token"]),
    )
    assert response.status_code == 200
    assert response.json()["synced_count"] == 1
    assert fake_supabase.tables["thoughts"][thought["id"]].get("insight") is None
