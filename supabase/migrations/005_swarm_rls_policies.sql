-- Row Level Security Policies for Swarm Relationship Schema
-- Created: 2025-07-14
-- Purpose: Comprehensive security policies for swarm coordination

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE swarm_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordination_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_health ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECURITY FUNCTIONS
-- =============================================================================

-- Function to check if user has access to network
CREATE OR REPLACE FUNCTION has_network_access(network_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Service role has full access
    IF current_setting('role') = 'service_role' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- For now, authenticated users have access to all networks
    -- This can be extended with organization-based access control
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to session
CREATE OR REPLACE FUNCTION has_session_access(session_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Service role has full access
    IF current_setting('role') = 'service_role' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- For now, authenticated users have access to all sessions
    -- This can be extended with user ownership or organization-based access
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check memory access level
CREATE OR REPLACE FUNCTION can_access_memory(memory_access_level TEXT, agent_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Service role has full access
    IF current_setting('role') = 'service_role' THEN
        RETURN TRUE;
    END IF;
    
    -- Public memory is accessible to all authenticated users
    IF memory_access_level = 'public' AND auth.uid() IS NOT NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Shared memory is accessible to authenticated users
    IF memory_access_level = 'shared' AND auth.uid() IS NOT NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Private memory requires agent ownership (simplified for now)
    IF memory_access_level = 'private' AND auth.uid() IS NOT NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SWARM NETWORKS POLICIES
-- =============================================================================

-- Allow authenticated users to view networks they have access to
CREATE POLICY "Users can view accessible networks" ON swarm_networks
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND has_network_access(id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on networks" ON swarm_networks
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow authenticated users to create networks
CREATE POLICY "Authenticated users can create networks" ON swarm_networks
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update networks they have access to
CREATE POLICY "Users can update accessible networks" ON swarm_networks
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND has_network_access(id)
    );

-- =============================================================================
-- SWARM SESSIONS POLICIES
-- =============================================================================

-- Allow authenticated users to view sessions they have access to
CREATE POLICY "Users can view accessible sessions" ON swarm_sessions
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND has_session_access(id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on sessions" ON swarm_sessions
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow authenticated users to create sessions
CREATE POLICY "Authenticated users can create sessions" ON swarm_sessions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update sessions they have access to
CREATE POLICY "Users can update accessible sessions" ON swarm_sessions
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND has_session_access(id)
    );

-- =============================================================================
-- SWARM AGENTS POLICIES
-- =============================================================================

-- Allow authenticated users to view agents in accessible sessions
CREATE POLICY "Users can view agents in accessible sessions" ON swarm_agents
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on agents" ON swarm_agents
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create agents in accessible sessions
CREATE POLICY "Users can create agents in accessible sessions" ON swarm_agents
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow users to update agents in accessible sessions
CREATE POLICY "Users can update agents in accessible sessions" ON swarm_agents
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- =============================================================================
-- AGENT RELATIONSHIPS POLICIES
-- =============================================================================

-- Allow authenticated users to view relationships for accessible agents
CREATE POLICY "Users can view accessible agent relationships" ON agent_relationships
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND 
        EXISTS (
            SELECT 1 FROM swarm_agents sa
            WHERE sa.id = source_agent_id AND has_session_access(sa.session_id)
        )
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on relationships" ON agent_relationships
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create relationships for accessible agents
CREATE POLICY "Users can create relationships for accessible agents" ON agent_relationships
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND 
        EXISTS (
            SELECT 1 FROM swarm_agents sa
            WHERE sa.id = source_agent_id AND has_session_access(sa.session_id)
        )
    );

-- =============================================================================
-- SWARM TASKS POLICIES
-- =============================================================================

-- Allow authenticated users to view tasks in accessible sessions
CREATE POLICY "Users can view tasks in accessible sessions" ON swarm_tasks
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on tasks" ON swarm_tasks
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create tasks in accessible sessions
CREATE POLICY "Users can create tasks in accessible sessions" ON swarm_tasks
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow users to update tasks in accessible sessions
CREATE POLICY "Users can update tasks in accessible sessions" ON swarm_tasks
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- =============================================================================
-- NEURAL PATTERNS POLICIES
-- =============================================================================

-- Allow authenticated users to view neural patterns for accessible agents
CREATE POLICY "Users can view neural patterns for accessible agents" ON neural_patterns
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND 
        EXISTS (
            SELECT 1 FROM swarm_agents sa
            WHERE sa.id = agent_id AND has_session_access(sa.session_id)
        )
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on neural patterns" ON neural_patterns
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create neural patterns for accessible agents
CREATE POLICY "Users can create neural patterns for accessible agents" ON neural_patterns
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND 
        EXISTS (
            SELECT 1 FROM swarm_agents sa
            WHERE sa.id = agent_id AND has_session_access(sa.session_id)
        )
    );

-- =============================================================================
-- SWARM MEMORY POLICIES
-- =============================================================================

-- Allow users to view memory based on access level
CREATE POLICY "Users can view accessible memory" ON swarm_memory
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND 
        has_session_access(session_id) AND
        can_access_memory(access_level::TEXT, agent_id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on memory" ON swarm_memory
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create memory in accessible sessions
CREATE POLICY "Users can create memory in accessible sessions" ON swarm_memory
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow users to update their own memory entries
CREATE POLICY "Users can update accessible memory" ON swarm_memory
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND 
        has_session_access(session_id) AND
        can_access_memory(access_level::TEXT, agent_id)
    );

-- =============================================================================
-- COORDINATION EVENTS POLICIES
-- =============================================================================

-- Allow authenticated users to view coordination events in accessible sessions
CREATE POLICY "Users can view coordination events in accessible sessions" ON coordination_events
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on coordination events" ON coordination_events
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create coordination events in accessible sessions
CREATE POLICY "Users can create coordination events in accessible sessions" ON coordination_events
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow users to update coordination events in accessible sessions
CREATE POLICY "Users can update coordination events in accessible sessions" ON coordination_events
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- =============================================================================
-- PERFORMANCE METRICS POLICIES
-- =============================================================================

-- Allow authenticated users to view performance metrics in accessible sessions
CREATE POLICY "Users can view performance metrics in accessible sessions" ON performance_metrics
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on performance metrics" ON performance_metrics
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create performance metrics in accessible sessions
CREATE POLICY "Users can create performance metrics in accessible sessions" ON performance_metrics
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- =============================================================================
-- SWARM HEALTH POLICIES
-- =============================================================================

-- Allow authenticated users to view health data in accessible sessions
CREATE POLICY "Users can view health data in accessible sessions" ON swarm_health
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow service role to perform all operations
CREATE POLICY "Service role full access on health data" ON swarm_health
    FOR ALL USING (current_setting('role') = 'service_role');

-- Allow users to create health data in accessible sessions
CREATE POLICY "Users can create health data in accessible sessions" ON swarm_health
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- Allow users to update health data in accessible sessions
CREATE POLICY "Users can update health data in accessible sessions" ON swarm_health
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND has_session_access(session_id)
    );

-- =============================================================================
-- DEMO ACCESS POLICIES (For unauthenticated users)
-- =============================================================================

-- Allow anonymous users to view demo networks
CREATE POLICY "Anonymous users can view demo networks" ON swarm_networks
    FOR SELECT USING (
        metadata->>'demo' = 'true'
    );

-- Allow anonymous users to view demo sessions
CREATE POLICY "Anonymous users can view demo sessions" ON swarm_sessions
    FOR SELECT USING (
        configuration->>'demo' = 'true'
    );

-- Allow anonymous users to view demo agents
CREATE POLICY "Anonymous users can view demo agents" ON swarm_agents
    FOR SELECT USING (
        metadata->>'demo' = 'true'
    );

-- =============================================================================
-- SECURITY AUDIT TRIGGERS
-- =============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id UUID,
    role_name TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_security_events()
RETURNS TRIGGER AS $$
BEGIN
    -- Log sensitive operations
    IF TG_TABLE_NAME IN ('swarm_memory', 'coordination_events', 'neural_patterns') THEN
        INSERT INTO security_audit_log (
            table_name, 
            operation, 
            user_id, 
            role_name,
            old_values, 
            new_values
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            auth.uid(),
            current_setting('role'),
            CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
            CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_swarm_memory AFTER INSERT OR UPDATE OR DELETE ON swarm_memory
    FOR EACH ROW EXECUTE FUNCTION audit_security_events();

CREATE TRIGGER audit_coordination_events AFTER INSERT OR UPDATE OR DELETE ON coordination_events
    FOR EACH ROW EXECUTE FUNCTION audit_security_events();

CREATE TRIGGER audit_neural_patterns AFTER INSERT OR UPDATE OR DELETE ON neural_patterns
    FOR EACH ROW EXECUTE FUNCTION audit_security_events();

-- =============================================================================
-- RATE LIMITING
-- =============================================================================

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    agent_id UUID,
    action TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    window_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 minute'
);

-- Rate limiting function
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_agent_id UUID,
    p_action TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
BEGIN
    -- Clean up expired windows
    DELETE FROM rate_limits WHERE window_end < NOW();
    
    -- Get current count for this user/agent/action
    SELECT COALESCE(SUM(count), 0)
    INTO current_count
    FROM rate_limits
    WHERE (user_id = p_user_id OR agent_id = p_agent_id)
    AND action = p_action
    AND window_end > NOW();
    
    -- Check if limit is exceeded
    IF current_count >= p_limit THEN
        RETURN FALSE;
    END IF;
    
    -- Increment counter
    INSERT INTO rate_limits (user_id, agent_id, action)
    VALUES (p_user_id, p_agent_id, p_action)
    ON CONFLICT DO NOTHING;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON FUNCTION has_network_access IS 'Checks if user has access to a specific swarm network';
COMMENT ON FUNCTION has_session_access IS 'Checks if user has access to a specific swarm session';
COMMENT ON FUNCTION can_access_memory IS 'Checks memory access permissions based on access level';
COMMENT ON FUNCTION check_rate_limit IS 'Rate limiting function to prevent abuse (default 100/minute)';
COMMENT ON TABLE security_audit_log IS 'Audit trail for sensitive security operations';
COMMENT ON TABLE rate_limits IS 'Rate limiting tracking for coordination events';