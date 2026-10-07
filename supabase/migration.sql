-- Thinkollect: Supabase Migration
-- Run this in your Supabase SQL Editor
--
-- NOTE: Auth is handled by the custom FastAPI backend (own users table +
-- backend-signed JWTs). Supabase Auth is NOT used; Supabase provides
-- Postgres + pgvector only. The backend connects with the service role key.

-- 0. Drop the old table and policies
DROP TABLE IF EXISTS thoughts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Custom users table (managed by the backend, passwords are argon2 hashes)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create the thoughts table
CREATE TABLE IF NOT EXISTS thoughts (
    id UUID PRIMARY KEY,                          -- Client-generated UUID
    user_id UUID NOT NULL REFERENCES users(id),
    client_id TEXT NOT NULL,                      -- Device identifier
    content TEXT NOT NULL CHECK (char_length(content) > 0),
    tags TEXT[] DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL,             -- Original offline capture timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),-- Last time it was updated
    deleted_at TIMESTAMPTZ,                       -- Soft delete timestamp for syncing deletes
    embedding vector(384),                        -- Vector embedding for semantic search
    insight TEXT,                                 -- Mentor-style LLM comment
    insight_updated_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this row landed in Supabase
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval per user
CREATE INDEX IF NOT EXISTS idx_thoughts_user_captured
    ON thoughts(user_id, captured_at DESC);

-- Index to make incremental sync (updated_at > last_sync) fast
CREATE INDEX IF NOT EXISTS idx_thoughts_user_updated
    ON thoughts(user_id, updated_at);

-- 4. Row Level Security: enabled with NO policies.
-- Only the backend (service role key) may touch these tables; the service
-- role bypasses RLS. All anon/authenticated access is denied by default.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- 5. Semantic search function used by the backend via RPC.
-- The backend connects with the service role key (RLS bypassed), so the
-- user filter is applied explicitly inside the function.
CREATE OR REPLACE FUNCTION match_thoughts(
    query_embedding vector(384),
    match_count INT,
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT,
    captured_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
    SELECT
        t.id,
        t.content,
        1 - (t.embedding <=> query_embedding) AS similarity,
        t.captured_at
    FROM thoughts t
    WHERE t.user_id = p_user_id
      AND t.deleted_at IS NULL
      AND t.embedding IS NOT NULL
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
$$;
