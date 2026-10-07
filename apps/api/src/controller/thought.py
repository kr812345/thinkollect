"""Business logic for thought sync, search, mind-map graph, and RAG chat.

Security note: the backend uses the Supabase service role key, which bypasses
Row Level Security. Every query below MUST therefore be explicitly scoped to
the authenticated user's id.
"""
import logging
import math
from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import Client

from src.models.thought import (
    MAX_GRAPH_NODES,
    ChatHistoryItem,
    ChatResponse,
    ChatSource,
    GraphEdge,
    GraphNode,
    GraphResponse,
    SearchResult,
    ThoughtOut,
    ThoughtSyncItem,
)
from src.services import embedding
from src.services import insight as insight_service
from src.services import llm as llm_service
from src.services.llm import LLMError

logger = logging.getLogger(__name__)

THOUGHTS_TABLE = "thoughts"
MATCH_THOUGHTS_RPC = "match_thoughts"

_SELECT_COLUMNS = "id, content, tags, captured_at, updated_at, deleted_at, insight"
_GRAPH_COLUMNS = "id, content, insight, captured_at, embedding, deleted_at"

_CHAT_SYSTEM = (
    "You are a calm thinking partner with access to the user's idea notebook. "
    "Answer from the provided thoughts. Refer to ideas by their gist, not IDs. "
    "If the thoughts do not contain enough to answer, say so briefly. "
    "Be concise. No markdown headings."
)


def _parse_ts(value) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _row_to_thought(row: dict) -> ThoughtOut:
    return ThoughtOut(**{**row, "tags": row.get("tags") or []})


def _is_newer_than(row: dict, last_sync: datetime) -> bool:
    if _parse_ts(row["updated_at"]) > last_sync:
        return True
    insight_ts = row.get("insight_updated_at")
    if insight_ts:
        return _parse_ts(insight_ts) > last_sync
    return False


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def pull_sync(
    supabase: Client, user_id: str, last_sync: datetime | None
) -> list[ThoughtOut]:
    """Fetch the user's thoughts changed since `last_sync` (or all of them)."""
    query = (
        supabase.table(THOUGHTS_TABLE)
        .select(_SELECT_COLUMNS + ", insight_updated_at")
        .eq("user_id", user_id)
    )
    query = query.order("updated_at")

    try:
        response = query.execute()
    except Exception:
        logger.exception("Sync pull failed for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch thoughts.",
        )

    rows = response.data or []
    if last_sync is not None:
        rows = [row for row in rows if _is_newer_than(row, last_sync)]
    return [_row_to_thought(row) for row in rows]


def _write_insights(supabase: Client, items: list[ThoughtSyncItem]) -> None:
    """Best-effort mentor comments. Sync must not fail if the LLM is down."""
    for item in items:
        if item.deleted_at is not None:
            continue
        comment = insight_service.mentor_comment(item.content)
        if not comment:
            continue
        try:
            supabase.table(THOUGHTS_TABLE).update(
                {
                    "insight": comment,
                    "insight_updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", str(item.id)).execute()
        except Exception:
            logger.exception("Failed to store insight for thought %s", item.id)


def push_sync(
    supabase: Client, user_id: str, items: list[ThoughtSyncItem]
) -> tuple[int, int]:
    """Upsert local changes with last-write-wins conflict resolution.

    Returns (synced_count, skipped_count). Items are skipped when the server
    already holds a newer version, or when the id belongs to another user
    (client-generated UUIDs cannot be allowed to hijack other users' rows).
    """
    if not items:
        return 0, 0

    incoming_ids = [str(item.id) for item in items]
    try:
        existing_res = (
            supabase.table(THOUGHTS_TABLE)
            .select("id, user_id, updated_at, insight, content")
            .in_("id", incoming_ids)
            .execute()
        )
    except Exception:
        logger.exception("Sync push pre-fetch failed for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not sync thoughts.",
        )

    existing = {row["id"]: row for row in (existing_res.data or [])}

    accepted: list[ThoughtSyncItem] = []
    skipped = 0
    for item in items:
        row = existing.get(str(item.id))
        if row is not None:
            if row["user_id"] != user_id:
                logger.warning(
                    "User %s tried to overwrite thought %s owned by another user",
                    user_id,
                    item.id,
                )
                skipped += 1
                continue
            if _parse_ts(row["updated_at"]) >= item.updated_at:
                skipped += 1  # server version is newer or identical
                continue
        accepted.append(item)

    if not accepted:
        return 0, skipped

    live_items = [item for item in accepted if item.deleted_at is None]
    embeddings: list[list[float] | None] = []
    if live_items:
        try:
            embeddings = embedding.embed_texts([i.content for i in live_items])
        except Exception:
            logger.exception("Embedding generation failed; storing without vectors")
            embeddings = [None] * len(live_items)

    embedding_iter = iter(embeddings)
    rows = []
    for item in accepted:
        prior = existing.get(str(item.id))
        content_changed = prior is None or prior.get("content") != item.content
        keep_insight = (
            None
            if item.deleted_at is not None or content_changed
            else prior.get("insight")
        )
        rows.append(
            {
                "id": str(item.id),
                "user_id": user_id,
                "client_id": item.client_id,
                "content": item.content,
                "tags": item.tags,
                "captured_at": item.captured_at.isoformat(),
                "updated_at": item.updated_at.isoformat(),
                "deleted_at": item.deleted_at.isoformat() if item.deleted_at else None,
                "embedding": next(embedding_iter) if item.deleted_at is None else None,
                "insight": keep_insight,
            }
        )

    try:
        supabase.table(THOUGHTS_TABLE).upsert(rows, on_conflict="id").execute()
    except Exception:
        logger.exception("Sync push upsert failed for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not sync thoughts.",
        )

    need_insight = [
        item
        for item in accepted
        if item.deleted_at is None
        and (
            existing.get(str(item.id)) is None
            or existing[str(item.id)].get("content") != item.content
            or not existing[str(item.id)].get("insight")
        )
    ]
    _write_insights(supabase, need_insight)

    return len(rows), skipped


def search_thoughts(
    supabase: Client, user_id: str, query: str, limit: int
) -> list[SearchResult]:
    """Semantic (vector similarity) search over the user's own thoughts."""
    try:
        query_vector = embedding.embed_text(query)
    except Exception:
        logger.exception("Query embedding failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Search is temporarily unavailable.",
        )

    try:
        response = supabase.rpc(
            MATCH_THOUGHTS_RPC,
            {
                "query_embedding": query_vector,
                "match_count": limit,
                "p_user_id": user_id,
            },
        ).execute()
    except Exception:
        logger.exception("match_thoughts RPC failed for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Search failed.",
        )

    return [SearchResult(**row) for row in (response.data or [])]


def _load_live_thoughts(supabase: Client, user_id: str) -> list[dict]:
    try:
        response = (
            supabase.table(THOUGHTS_TABLE)
            .select(_GRAPH_COLUMNS)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to load thoughts for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not load thoughts.",
        )
    rows = []
    for row in response.data or []:
        if row.get("deleted_at") is not None:
            continue
        if not row.get("embedding"):
            continue
        rows.append(row)
    rows.sort(key=lambda r: _parse_ts(r["captured_at"]), reverse=True)
    return rows[:MAX_GRAPH_NODES]


def build_graph(
    supabase: Client,
    user_id: str,
    *,
    neighbors: int = 3,
    min_similarity: float = 0.35,
) -> GraphResponse:
    rows = _load_live_thoughts(supabase, user_id)
    nodes = [
        GraphNode(
            id=row["id"],
            content=row["content"],
            insight=row.get("insight"),
            captured_at=row["captured_at"],
        )
        for row in rows
    ]

    edges: list[GraphEdge] = []
    seen: set[tuple[str, str]] = set()
    for i, left in enumerate(rows):
        scored: list[tuple[float, dict]] = []
        for j, right in enumerate(rows):
            if i == j:
                continue
            score = _cosine(left["embedding"], right["embedding"])
            if score >= min_similarity:
                scored.append((score, right))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        for score, right in scored[:neighbors]:
            a, b = sorted((str(left["id"]), str(right["id"])))
            if (a, b) in seen:
                continue
            seen.add((a, b))
            edges.append(GraphEdge(source=a, target=b, similarity=round(score, 4)))

    return GraphResponse(nodes=nodes, edges=edges)


def chat_with_graph(
    supabase: Client,
    user_id: str,
    message: str,
    history: list[ChatHistoryItem],
) -> ChatResponse:
    hits = search_thoughts(supabase, user_id, message, limit=8)
    if not hits:
        return ChatResponse(
            answer="I don't have any of your ideas to draw from yet. Dump a few thoughts first.",
            sources=[],
        )

    graph = build_graph(supabase, user_id, neighbors=2, min_similarity=0.3)
    neighbor_ids: set[str] = set()
    hit_ids = {str(h.id) for h in hits}
    for edge in graph.edges:
        src, tgt = str(edge.source), str(edge.target)
        if src in hit_ids:
            neighbor_ids.add(tgt)
        if tgt in hit_ids:
            neighbor_ids.add(src)

    extras = [
        node
        for node in graph.nodes
        if str(node.id) in neighbor_ids and str(node.id) not in hit_ids
    ][:6]

    context_bits = []
    for hit in hits:
        context_bits.append(f"- ({hit.id}) {hit.content}")
    for extra in extras:
        context_bits.append(f"- ({extra.id}) {extra.content}")

    history_text = ""
    if history:
        lines = [f"{item.role}: {item.content}" for item in history[-10:]]
        history_text = "Recent conversation:\n" + "\n".join(lines) + "\n\n"

    prompt = (
        f"{history_text}"
        f"Related thoughts from the user's notebook:\n"
        f"{chr(10).join(context_bits)}\n\n"
        f"User: {message}"
    )

    try:
        answer = llm_service.generate(prompt, _CHAT_SYSTEM, max_tokens=400, temperature=0.4)
    except LLMError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat is temporarily unavailable.",
        )

    return ChatResponse(
        answer=answer,
        sources=[
            ChatSource(id=hit.id, content=hit.content, similarity=hit.similarity)
            for hit in hits
        ],
    )
