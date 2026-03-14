-- RLS for agent_connections (safe to run if 00005 already applied without RLS)
ALTER TABLE agent_connections ENABLE ROW LEVEL SECURITY;

-- Drop if exists so this migration is idempotent
DROP POLICY IF EXISTS "Public read agent_connections" ON agent_connections;
CREATE POLICY "Public read agent_connections" ON agent_connections
  FOR SELECT USING (true);
