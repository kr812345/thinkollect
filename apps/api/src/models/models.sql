-- Thinkollect database schema (reference copy).
-- The authoritative migration lives in /supabase/migration.sql.
--
-- Auth is custom (backend-signed JWTs); Supabase provides Postgres +
-- pgvector only. The backend connects with the service role key.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,              -- argon2 hash
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thoughts (
    id UUID PRIMARY KEY,                            -- Client-generated UUID
    user_id UUID NOT NULL REFERENCES users(id),
    client_id TEXT NOT NULL,                        -- Device identifier
    content TEXT NOT NULL CHECK (char_length(content) > 0),
    tags TEXT[] DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL,               -- Original offline capture timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- Last modification (drives sync)
    deleted_at TIMESTAMPTZ,                         -- Soft delete timestamp
    embedding vector(384),                          -- all-MiniLM-L6-v2 embedding
    insight TEXT,                                   -- Mentor-style LLM comment
    insight_updated_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thoughts_user_captured
    ON thoughts(user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_thoughts_user_updated
    ON thoughts(user_id, updated_at);

-- RLS enabled with no policies: only the service role (backend) can access.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- Semantic search over a single user's non-deleted thoughts.
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
