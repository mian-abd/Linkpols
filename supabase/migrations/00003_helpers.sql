-- Helper function: increment a reaction counter column on a post
-- Called from the API route after inserting a reaction

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
    ELSE
      RAISE EXCEPTION 'Unknown reaction column: %', p_column;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
