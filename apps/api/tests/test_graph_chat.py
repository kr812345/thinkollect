"""Mind-map graph and RAG chat tests."""
from src.services import llm as llm_module
from src.services.llm import LLMError

from .conftest import auth_headers, make_thought, signup


def _push(client, token, thoughts):
    return client.post(
        "/api/thoughts/sync",
        json={"thoughts": thoughts},
        headers=auth_headers(token),
    )


def test_graph_requires_auth(client):
    assert client.get("/api/thoughts/graph").status_code == 401


def test_chat_requires_auth(client):
    assert client.post("/api/thoughts/chat", json={"message": "hi"}).status_code == 401


def test_graph_empty(client):
    user = signup(client, "empty-graph@example.com")
    response = client.get("/api/thoughts/graph", headers=auth_headers(user["token"]))
    assert response.status_code == 200
    assert response.json() == {"nodes": [], "edges": []}


def test_graph_scoped_to_user_and_excludes_deleted(client):
    user_a = signup(client, "ga@example.com")
    user_b = signup(client, "gb@example.com")
    _push(client, user_a["token"], [make_thought(content="A marketing idea")])
    _push(client, user_b["token"], [make_thought(content="B private idea")])
    deleted = make_thought(content="gone", deleted_at="2024-02-01T00:00:00Z")
    _push(client, user_a["token"], [deleted])

    graph = client.get(
        "/api/thoughts/graph", headers=auth_headers(user_a["token"])
    ).json()
    contents = [n["content"] for n in graph["nodes"]]
    assert contents == ["A marketing idea"]
    assert all(n["id"] for n in graph["nodes"])


def test_graph_builds_edges_between_similar_thoughts(client):
    user = signup(client, "edges@example.com")
    _push(
        client,
        user["token"],
        [
            make_thought(content="content marketing on twitter"),
            make_thought(content="content marketing on twitter again"),
            make_thought(content="unrelated gardening notes"),
        ],
    )
    graph = client.get("/api/thoughts/graph", headers=auth_headers(user["token"])).json()
    assert len(graph["nodes"]) == 3
    assert len(graph["edges"]) >= 1
    node_ids = {n["id"] for n in graph["nodes"]}
    for edge in graph["edges"]:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids
        assert edge["source"] != edge["target"]
        assert 0 <= edge["similarity"] <= 1


def test_chat_uses_own_thoughts_and_returns_sources(client):
    user = signup(client, "chat@example.com")
    thought = make_thought(content="We should do more content marketing on Twitter")
    _push(client, user["token"], [thought])

    response = client.post(
        "/api/thoughts/chat",
        json={"message": "What did I think about marketing?"},
        headers=auth_headers(user["token"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer"]
    assert body["sources"][0]["id"] == thought["id"]


def test_chat_empty_notebook(client):
    user = signup(client, "empty-chat@example.com")
    response = client.post(
        "/api/thoughts/chat",
        json={"message": "What should I work on?"},
        headers=auth_headers(user["token"]),
    )
    assert response.status_code == 200
    assert "dump" in response.json()["answer"].lower()
    assert response.json()["sources"] == []


def test_chat_llm_down_is_503(client, monkeypatch):
    user = signup(client, "llm-down@example.com")
    _push(client, user["token"], [make_thought(content="an idea")])
    monkeypatch.setattr(
        llm_module, "generate", lambda *a, **k: (_ for _ in ()).throw(LLMError("down"))
    )
    response = client.post(
        "/api/thoughts/chat",
        json={"message": "summarize my ideas"},
        headers=auth_headers(user["token"]),
    )
    assert response.status_code == 503


def test_chat_validation(client):
    user = signup(client, "chat-val@example.com")
    headers = auth_headers(user["token"])
    assert (
        client.post("/api/thoughts/chat", json={"message": "  "}, headers=headers).status_code
        == 422
    )
    assert (
        client.post("/api/thoughts/chat", json={"message": ""}, headers=headers).status_code
        == 422
    )
    assert (
        client.post(
            "/api/thoughts/chat",
            json={"message": "ok", "history": [{"role": "system", "content": "nope"}]},
            headers=headers,
        ).status_code
        == 422
    )


def test_chat_does_not_see_other_users_thoughts(client, fake_supabase):
    user_a = signup(client, "ca@example.com")
    user_b = signup(client, "cb@example.com")
    _push(client, user_b["token"], [make_thought(content="B's secret marketing plan")])
    response = client.post(
        "/api/thoughts/chat",
        json={"message": "marketing"},
        headers=auth_headers(user_a["token"]),
    )
    assert response.status_code == 200
    assert response.json()["sources"] == []
    assert fake_supabase.rpc_calls[-1]["p_user_id"] == user_a["user"]["id"]
