"""Contract, validation, and security tests for /api/thoughts/search."""
from .conftest import auth_headers, make_thought, signup


def _search(client, token, query="ideas", limit=10):
    return client.post(
        "/api/thoughts/search",
        json={"query": query, "limit": limit},
        headers=auth_headers(token),
    )


def test_search_requires_auth(client):
    response = client.post("/api/thoughts/search", json={"query": "x", "limit": 5})
    assert response.status_code == 401


def test_search_success_matches_contract(client):
    user = signup(client, "search@example.com")
    client.post(
        "/api/thoughts/sync",
        json={"thoughts": [make_thought(content="content marketing on Twitter")]},
        headers=auth_headers(user["token"]),
    )

    response = _search(client, user["token"], query="marketing")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    result = results[0]
    assert result["content"] == "content marketing on Twitter"
    assert isinstance(result["similarity"], float)
    assert "id" in result and "captured_at" in result


def test_search_limit_is_respected(client):
    user = signup(client, "limit@example.com")
    thoughts = [make_thought(content=f"thought number {i}") for i in range(5)]
    client.post(
        "/api/thoughts/sync",
        json={"thoughts": thoughts},
        headers=auth_headers(user["token"]),
    )
    response = _search(client, user["token"], limit=2)
    assert len(response.json()) == 2


def test_search_excludes_soft_deleted(client):
    user = signup(client, "search-del@example.com")
    deleted = make_thought(content="deleted thought", deleted_at="2024-01-02T00:00:00Z")
    client.post(
        "/api/thoughts/sync",
        json={"thoughts": [deleted]},
        headers=auth_headers(user["token"]),
    )
    assert _search(client, user["token"], query="deleted").json() == []


def test_search_only_searches_own_thoughts(client, fake_supabase):
    user_a = signup(client, "sa@example.com")
    user_b = signup(client, "sb@example.com")
    client.post(
        "/api/thoughts/sync",
        json={"thoughts": [make_thought(content="B's private marketing idea")]},
        headers=auth_headers(user_b["token"]),
    )

    assert _search(client, user_a["token"], query="marketing").json() == []
    # And the RPC was scoped to user A's id.
    assert fake_supabase.rpc_calls[-1]["p_user_id"] == user_a["user"]["id"]


# ---------------------------------------------------------------- validation
def test_search_blank_query_rejected(client):
    user = signup(client, "q1@example.com")
    assert _search(client, user["token"], query="   ").status_code == 422


def test_search_empty_query_rejected(client):
    user = signup(client, "q2@example.com")
    assert _search(client, user["token"], query="").status_code == 422


def test_search_limit_bounds_enforced(client):
    user = signup(client, "q3@example.com")
    assert _search(client, user["token"], limit=0).status_code == 422
    assert _search(client, user["token"], limit=51).status_code == 422


def test_search_missing_query_rejected(client):
    user = signup(client, "q4@example.com")
    response = client.post(
        "/api/thoughts/search", json={"limit": 5}, headers=auth_headers(user["token"])
    )
    assert response.status_code == 422
