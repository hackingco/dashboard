-- Enhanced Row Level Security (RLS) Policies for Swarm Dashboard
-- Run this after the main schema to setup security for production

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all access to swarm_sessions" ON public.swarm_sessions;
DROP POLICY IF EXISTS "Allow all access to swarm_traces" ON public.swarm_traces;
DROP POLICY IF EXISTS "Allow all access to swarm_agents" ON public.swarm_agents;
DROP POLICY IF EXISTS "Allow all access to swarm_metrics" ON public.swarm_metrics;

-- Enhanced Session Policies
CREATE POLICY "Enable read access for authenticated users on sessions" ON public.swarm_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users on sessions" ON public.swarm_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for session owners" ON public.swarm_sessions
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      metadata->>'user_id' = auth.uid()::text OR
      metadata->>'created_by' = auth.uid()::text OR
      auth.jwt()->>'role' = 'service_role'
    )
  );

-- Enhanced Trace Policies
CREATE POLICY "Enable read access for authenticated users on traces" ON public.swarm_traces
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND (
        s.metadata->>'user_id' = auth.uid()::text OR
        s.metadata->>'created_by' = auth.uid()::text OR
        auth.jwt()->>'role' = 'service_role'
      )
    )
  );

CREATE POLICY "Enable insert for authenticated users on traces" ON public.swarm_traces
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND (
        s.metadata->>'user_id' = auth.uid()::text OR
        s.metadata->>'created_by' = auth.uid()::text OR
        auth.jwt()->>'role' = 'service_role'
      )
    )
  );

CREATE POLICY "Enable update for trace owners" ON public.swarm_traces
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND (
        s.metadata->>'user_id' = auth.uid()::text OR
        s.metadata->>'created_by' = auth.uid()::text OR
        auth.jwt()->>'role' = 'service_role'
      )
    )
  );

-- Enhanced Agent Policies
CREATE POLICY "Enable read access for authenticated users on agents" ON public.swarm_agents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users on agents" ON public.swarm_agents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for agent managers" ON public.swarm_agents
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND (
      metadata->>'manager_id' = auth.uid()::text OR
      metadata->>'created_by' = auth.uid()::text OR
      auth.jwt()->>'role' = 'service_role'
    )
  );

-- Enhanced Metrics Policies
CREATE POLICY "Enable read access for authenticated users on metrics" ON public.swarm_metrics
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND (
        s.metadata->>'user_id' = auth.uid()::text OR
        s.metadata->>'created_by' = auth.uid()::text OR
        auth.jwt()->>'role' = 'service_role'
      )
    )
  );

CREATE POLICY "Enable insert for authenticated users on metrics" ON public.swarm_metrics
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND (
        s.metadata->>'user_id' = auth.uid()::text OR
        s.metadata->>'created_by' = auth.uid()::text OR
        auth.jwt()->>'role' = 'service_role'
      )
    )
  );

-- Service Role Bypass Policies (for API routes using service key)
CREATE POLICY "Allow service role full access to sessions" ON public.swarm_sessions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Allow service role full access to traces" ON public.swarm_traces
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Allow service role full access to agents" ON public.swarm_agents
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Allow service role full access to metrics" ON public.swarm_metrics
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Anonymous access for demo purposes (remove in production)
CREATE POLICY "Allow anonymous read for demo sessions" ON public.swarm_sessions
  FOR SELECT USING (
    auth.role() = 'anon' AND 
    metadata->>'demo' = 'true'
  );

CREATE POLICY "Allow anonymous read for demo traces" ON public.swarm_traces
  FOR SELECT USING (
    auth.role() = 'anon' AND 
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND s.metadata->>'demo' = 'true'
    )
  );

CREATE POLICY "Allow anonymous read for demo agents" ON public.swarm_agents
  FOR SELECT USING (
    auth.role() = 'anon' AND 
    metadata->>'demo' = 'true'
  );

CREATE POLICY "Allow anonymous read for demo metrics" ON public.swarm_metrics
  FOR SELECT USING (
    auth.role() = 'anon' AND 
    EXISTS (
      SELECT 1 FROM public.swarm_sessions s 
      WHERE s.id = session_id AND s.metadata->>'demo' = 'true'
    )
  );

-- Create security functions
CREATE OR REPLACE FUNCTION public.is_session_owner(session_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.swarm_sessions 
    WHERE id = session_uuid AND (
      metadata->>'user_id' = auth.uid()::text OR
      metadata->>'created_by' = auth.uid()::text
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_agent_manager(agent_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.swarm_agents 
    WHERE id = agent_uuid AND (
      metadata->>'manager_id' = auth.uid()::text OR
      metadata->>'created_by' = auth.uid()::text
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Real-time publication setup
CREATE PUBLICATION supabase_realtime FOR TABLE public.swarm_sessions, public.swarm_traces, public.swarm_agents, public.swarm_metrics;

-- Enable real-time for tables
ALTER TABLE public.swarm_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.swarm_traces REPLICA IDENTITY FULL;
ALTER TABLE public.swarm_agents REPLICA IDENTITY FULL;
ALTER TABLE public.swarm_metrics REPLICA IDENTITY FULL;

-- Create indexes for better real-time performance
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_user_id ON public.swarm_sessions USING GIN ((metadata->>'user_id'));
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_demo ON public.swarm_sessions ((metadata->>'demo'));
CREATE INDEX IF NOT EXISTS idx_swarm_agents_manager_id ON public.swarm_agents USING GIN ((metadata->>'manager_id'));
CREATE INDEX IF NOT EXISTS idx_swarm_agents_demo ON public.swarm_agents ((metadata->>'demo'));

-- Grant realtime permissions
GRANT SELECT ON public.swarm_sessions TO anon, authenticated;
GRANT SELECT ON public.swarm_traces TO anon, authenticated;
GRANT SELECT ON public.swarm_agents TO anon, authenticated;
GRANT SELECT ON public.swarm_metrics TO anon, authenticated;

-- Comments for documentation
COMMENT ON POLICY "Enable read access for authenticated users on sessions" ON public.swarm_sessions IS 'Allows authenticated users to read sessions';
COMMENT ON POLICY "Enable read access for authenticated users on traces" ON public.swarm_traces IS 'Allows authenticated users to read traces for sessions they own';
COMMENT ON POLICY "Allow anonymous read for demo sessions" ON public.swarm_sessions IS 'Demo access for unauthenticated users - remove in production';

-- Example of setting up a demo session (run this to test)
INSERT INTO public.swarm_sessions (id, session_name, description, start_time, status, metadata) VALUES
  ('550e8400-e29b-41d4-a716-446655440010', 'Public Demo Session', 'Publicly accessible demo session for testing', now(), 'active', '{"demo": "true", "public": true}')
ON CONFLICT (id) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = now();