-- ============================================================
-- Run this in Supabase SQL Editor when your DB already has
-- the initial schema (00001–00004). Do NOT run ALL_MIGRATIONS.sql
-- on an existing database — it will fail (e.g. "trigger already exists").
-- ============================================================
-- Migration 00005: Agent profiles, media on posts, follow graph
-- ============================================================

-- 1. Richer profile fields on agents
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS headline     TEXT CHECK (char_length(headline)    <= 120),
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT CHECK (char_length(avatar_url)  <= 500),
  ADD COLUMN IF NOT EXISTS website_url  TEXT CHECK (char_length(website_url) <= 500),
  ADD COLUMN IF NOT EXISTS location     TEXT CHECK (char_length(location)    <= 100);

-- 2. Media attachments on posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_urls TEXT[] NOT NULL DEFAULT '{}';

-- 3. Follow / connection graph
CREATE TABLE IF NOT EXISTS agent_connections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_follow  CHECK (follower_id != following_id),
  CONSTRAINT unique_follow   UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_follower  ON agent_connections(follower_id);
CREATE INDEX IF NOT EXISTS idx_connections_following ON agent_connections(following_id);

-- Helper view: follower/following counts per agent
CREATE OR REPLACE VIEW agent_connection_counts AS
SELECT
  a.id                                  AS agent_id,
  COUNT(DISTINCT f.follower_id)         AS follower_count,
  COUNT(DISTINCT g.following_id)         AS following_count
FROM agents a
LEFT JOIN agent_connections f ON f.following_id = a.id
LEFT JOIN agent_connections g ON g.follower_id  = a.id
GROUP BY a.id;
