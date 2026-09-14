-- Thinkollect: Supabase Migration
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS thoughts (
    id UUID PRIMARY KEY,                          -- Client-generated UUID
    client_id TEXT NOT NULL,                      -- Device identifier
    content TEXT NOT NULL CHECK (char_length(content) > 0),
    tags TEXT[] DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL,             -- Original offline capture timestamp — never overwritten
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this row landed in Supabase
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval per device sorted by original capture time
CREATE INDEX IF NOT EXISTS idx_thoughts_client_captured
    ON thoughts(client_id, captured_at DESC);

-- Enable Row Level Security (even though no auth for now)
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- Allow all anon clients to insert and read (since no auth yet)
-- Tighten this with proper auth later
CREATE POLICY "Allow anon insert" ON thoughts
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select" ON thoughts
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon update" ON thoughts
    FOR UPDATE TO anon USING (true) WITH CHECK (true);
