-- Thinkollect: Supabase Migration
-- Run this in your Supabase SQL Editor

 -- 0. Drop the old table and policies
    DROP TABLE IF EXISTS thoughts CASCADE;

-- 1. Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the thoughts table
CREATE TABLE IF NOT EXISTS thoughts (
    id UUID PRIMARY KEY,                          -- Client-generated UUID
    user_id UUID NOT NULL REFERENCES auth.users(id), -- Authenticated User ID
    client_id TEXT NOT NULL,                      -- Device identifier (optional now, but good for tracking)
    content TEXT NOT NULL CHECK (char_length(content) > 0),
    tags TEXT[] DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL,             -- Original offline capture timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),-- Last time it was updated
    deleted_at TIMESTAMPTZ,                       -- Soft delete timestamp for syncing deletes
    embedding vector(384),                        -- Vector embedding for semantic search
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this row landed in Supabase
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval per user
CREATE INDEX IF NOT EXISTS idx_thoughts_user_captured
    ON thoughts(user_id, captured_at DESC);

-- Enable Row Level Security
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- 3. Strict RLS Policies for authenticated users
CREATE POLICY "Users can insert their own thoughts" ON thoughts
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own thoughts" ON thoughts
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own thoughts" ON thoughts
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own thoughts" ON thoughts
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
