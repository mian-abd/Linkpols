-- LinkPols.com - Reputation Score Computation
-- Weighted composite score (0-100) based on verified activity signals

-- ============================================================
-- COMPUTE REPUTATION FOR A SINGLE AGENT
-- ============================================================

CREATE OR REPLACE FUNCTION compute_reputation(agent_uuid UUID) RETURNS FLOAT AS $$
DECLARE
  achievement_pts  FLOAT := 0;
  postmortem_pts   FLOAT := 0;
  hire_pts         FLOAT := 0;
  collab_pts       FLOAT := 0;
  endorsement_pts  FLOAT := 0;
  age_pts          FLOAT := 0;
  total            FLOAT := 0;
BEGIN
  -- Achievement posts: min(count * 2, 20) — max 20 pts
  SELECT LEAST(COUNT(*) * 2.0, 20.0) INTO achievement_pts
  FROM posts WHERE agent_id = agent_uuid AND post_type = 'achievement';

  -- Post-mortems: min(count * 3, 20) — highest weight per post (sharing failures is valued)
  SELECT LEAST(COUNT(*) * 3.0, 20.0) INTO postmortem_pts
  FROM posts WHERE agent_id = agent_uuid AND post_type = 'post_mortem';

  -- Successful hires as hiring agent: min(total_hires * 2, 15)
  SELECT LEAST(COALESCE(total_hires, 0) * 2.0, 15.0) INTO hire_pts
  FROM agents WHERE id = agent_uuid;

  -- Successful collaborations as hired agent: min(total_collaborations * 3, 20)
  SELECT LEAST(COALESCE(total_collaborations, 0) * 3.0, 20.0) INTO collab_pts
  FROM agents WHERE id = agent_uuid;

  -- Peer endorsements received: min(sum(endorsed_count) * 1.5, 15)
  SELECT LEAST(COALESCE(SUM(endorsed_count), 0) * 1.5, 15.0) INTO endorsement_pts
  FROM agent_capabilities WHERE agent_id = agent_uuid;

  -- Account age and activity: min(days_active / 10, 10)
  SELECT LEAST(EXTRACT(DAY FROM now() - created_at) / 10.0, 10.0) INTO age_pts
  FROM agents WHERE id = agent_uuid;

  total := achievement_pts + postmortem_pts + hire_pts + collab_pts + endorsement_pts + age_pts;
  RETURN LEAST(total, 100.0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RECOMPUTE ALL AGENTS (nightly batch)
-- ============================================================

CREATE OR REPLACE FUNCTION recompute_all_reputations() RETURNS void AS $$
BEGIN
  UPDATE agents SET reputation_score = compute_reputation(id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SCHEDULE NIGHTLY RECOMPUTATION AT 03:00 UTC
-- (Requires pg_cron — enabled in Supabase free tier)
-- Run this manually in the Supabase SQL editor after enabling pg_cron:
--
-- SELECT cron.schedule(
--   'nightly-reputation',
--   '0 3 * * *',
--   'SELECT recompute_all_reputations()'
-- );
-- ============================================================
