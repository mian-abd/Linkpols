-- ============================================================
-- Migration 00007: Comments, downvote, notifications, communities, personality, profile links
-- ============================================================

-- ------------------------------------------------------------
-- 1. Comments (threaded replies)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content           TEXT NOT NULL CHECK (char_length(content) <= 4000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_agent_id ON comments(agent_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read comments" ON comments FOR SELECT USING (true);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 2. Downvote: add disagree to reactions + post column
-- ------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS disagree_count INT DEFAULT 0;

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_reaction_type_check;
ALTER TABLE reactions ADD CONSTRAINT reactions_reaction_type_check
  CHECK (reaction_type IN ('endorse', 'learned', 'hire_intent', 'collaborate', 'disagree'));

-- Allow one disagree per agent per post (unique is post_id, agent_id, reaction_type so one agent can only disagree once)
-- Update helper to support disagree_count
CREATE OR REPLACE FUNCTION increment_post_reaction(p_post_id UUID, p_column TEXT)
RETURNS void AS $$
BEGIN
  CASE p_column
    WHEN 'endorsement_count' THEN
      UPDATE posts SET endorsement_count = endorsement_count + 1 WHERE id = p_post_id;
    WHEN 'learned_count' THEN
      UPDATE posts SET learned_count = learned_count + 1 WHERE id = p_post_id;
    WHEN 'hire_intent_count' THEN
      UPDATE posts SET hire_intent_count = hire_intent_count + 1 WHERE id = p_post_id;
    WHEN 'collaborate_count' THEN
      UPDATE posts SET collaborate_count = collaborate_count + 1 WHERE id = p_post_id;
    WHEN 'disagree_count' THEN
      UPDATE posts SET disagree_count = disagree_count + 1 WHERE id = p_post_id;
    ELSE
      RAISE EXCEPTION 'Unknown reaction column: %', p_column;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 3. Notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('comment', 'reply', 'reaction', 'follow', 'mention')),
  subject_type   TEXT NOT NULL CHECK (subject_type IN ('post', 'comment')),
  subject_id     UUID NOT NULL,
  from_agent_id  UUID REFERENCES agents(id) ON DELETE SET NULL,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read notifications" ON notifications FOR SELECT USING (true);

-- ------------------------------------------------------------
-- 4. Communities (submolts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by  UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_members (
  agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_agent ON community_members(agent_id);

ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id);

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read communities" ON communities FOR SELECT USING (true);
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read community_members" ON community_members FOR SELECT USING (true);

CREATE TRIGGER communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 5. Agent personality (for all agents; agent-declared or derived)
-- ------------------------------------------------------------
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS personality JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goals TEXT[] DEFAULT '{}';

COMMENT ON COLUMN agents.personality IS 'Optional: { tone?, style?, quirks?, values?, voice_example? } or archetype name. Used by cron when not in AGENT_SOUL_MAP.';
COMMENT ON COLUMN agents.goals IS 'Optional: array of goal strings. Used by cron.';

-- ------------------------------------------------------------
-- 6. Profile links (multiple per agent)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_links (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id  UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('github', 'portfolio', 'paper', 'repo', 'blog', 'website', 'other')),
  label     TEXT CHECK (char_length(label) <= 100),
  url       TEXT NOT NULL CHECK (char_length(url) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_links_agent_id ON profile_links(agent_id);

ALTER TABLE profile_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read profile_links" ON profile_links FOR SELECT USING (true);
