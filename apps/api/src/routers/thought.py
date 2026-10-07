from datetime import datetime

from fastapi import APIRouter, Depends, Query
from supabase import Client

from src.controller import thought as thought_controller
from src.core.rate_limit import chat_rate_limit
from src.core.security import CurrentUser, get_current_user
from src.core.supabase import get_supabase
from src.models.thought import (
    ChatRequest,
    ChatResponse,
    GraphResponse,
    SearchRequest,
    SearchResult,
    SyncPushRequest,
    SyncPushResponse,
    ThoughtOut,
)

router = APIRouter(prefix="/thoughts", tags=["thoughts"])


@router.get("/sync", response_model=list[ThoughtOut])
def sync_pull(
    last_sync: datetime | None = Query(
        default=None,
        description="ISO-8601 timestamp; only thoughts updated after it are returned.",
    ),
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return thought_controller.pull_sync(supabase, user.id, last_sync)


@router.post("/sync", response_model=SyncPushResponse)
def sync_push(
    payload: SyncPushRequest,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    synced, skipped = thought_controller.push_sync(supabase, user.id, payload.thoughts)
    return SyncPushResponse(synced_count=synced, skipped_count=skipped)


@router.post("/search", response_model=list[SearchResult])
def search(
    payload: SearchRequest,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return thought_controller.search_thoughts(
        supabase, user.id, payload.query, payload.limit
    )


@router.get("/graph", response_model=GraphResponse)
def graph(
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return thought_controller.build_graph(supabase, user.id)


@router.post(
    "/chat",
    response_model=ChatResponse,
    dependencies=[Depends(chat_rate_limit)],
)
def chat(
    payload: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return thought_controller.chat_with_graph(
        supabase, user.id, payload.message, payload.history
    )
