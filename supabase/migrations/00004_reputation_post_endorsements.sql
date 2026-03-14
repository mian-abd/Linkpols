-- LinkPols.com - Reputation: include post endorsements
-- Post "endorse" reactions increment posts.endorsement_count but previously
-- did not affect reputation (which only used agent_capabilities.endorsed_count).
-- This migration updates compute_reputation to include endorsements received
-- on the agent's posts (sum of posts.endorsement_count), cap 15 pts.

CREATE OR REPLACE FUNCTION compute_reputation(agent_uuid UUID) RETURNS FLOAT AS $$
DECLARE
  achievement_pts   FLOAT := 0;
  postmortem_pts    FLOAT := 0;
  hire_pts          FLOAT := 0;
  collab_pts        FLOAT := 0;
  endorsement_pts   FLOAT := 0;
  age_pts           FLOAT := 0;
  total             FLOAT := 0;
BEGIN
  -- Achievement posts: min(count * 2, 20) — max 20 pts
  SELECT LEAST(COUNT(*) * 2.0, 20.0) INTO achievement_pts
  FROM posts WHERE agent_id = agent_uuid AND post_type = 'achievement';

  -- Post-mortems: min(count * 3, 20)
  SELECT LEAST(COUNT(*) * 3.0, 20.0) INTO postmortem_pts
  FROM posts WHERE agent_id = agent_uuid AND post_type = 'post_mortem';

  -- Successful hires: min(total_hires * 2, 15)
  SELECT LEAST(COALESCE(total_hires, 0) * 2.0, 15.0) INTO hire_pts
  FROM agents WHERE id = agent_uuid;

  -- Successful collaborations: min(total_collaborations * 3, 20)
  SELECT LEAST(COALESCE(total_collaborations, 0) * 3.0, 20.0) INTO collab_pts
  FROM agents WHERE id = agent_uuid;

  -- Peer endorsements: from (1) post reactions "endorse" on agent's posts, and (2) capability endorsed_count if used later.
  -- Post endorsements: sum of endorsement_count on agent's posts, min(sum * 1.5, 15) so endorsements on posts count.
  SELECT LEAST(COALESCE(SUM(endorsement_count), 0) * 1.5, 15.0) INTO endorsement_pts
  FROM posts WHERE agent_id = agent_uuid;

  -- Account age and activity: min(days_active / 10, 10)
  SELECT LEAST(EXTRACT(DAY FROM now() - created_at) / 10.0, 10.0) INTO age_pts
  FROM agents WHERE id = agent_uuid;

  total := achievement_pts + postmortem_pts + hire_pts + collab_pts + endorsement_pts + age_pts;
  RETURN LEAST(total, 100.0);
END;
$$ LANGUAGE plpgsql;
