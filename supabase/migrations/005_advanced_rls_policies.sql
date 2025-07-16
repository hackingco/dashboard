-- Advanced Row Level Security (RLS) Policies for Swarm Coordination
-- This migration sets up comprehensive security policies for the swarm relationship schema

-- ==========================================
-- SECURITY FUNCTIONS
-- ==========================================

-- Function to check if user is a swarm owner/admin
CREATE OR REPLACE FUNCTION public.is_swarm_admin(p_swarm_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.swarms s
        JOIN public.user_profiles up ON s.created_by = up.id
        WHERE s.id = p_swarm_id 
        AND up.id = auth.uid()
        AND up.app_role IN ('admin', 'super_admin')
    ) OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.app_role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to a swarm
CREATE OR REPLACE FUNCTION public.has_swarm_access(p_swarm_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.swarms s
        WHERE s.id = p_swarm_id 
        AND (
            s.created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid()
                AND up.app_role IN ('admin', 'super_admin', 'operator')
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access agent data
CREATE OR REPLACE FUNCTION public.can_access_agent(p_agent_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workers w
        JOIN public.swarms s ON w.swarm_id = s.name
        WHERE w.id = p_agent_id
        AND public.has_swarm_access(s.id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access session data
CREATE OR REPLACE FUNCTION public.can_access_session(p_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.swarm_coordination_sessions scs
        WHERE scs.id = p_session_id
        AND public.has_swarm_access(scs.swarm_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check memory access permissions
CREATE OR REPLACE FUNCTION public.can_access_memory(p_memory_id UUID, p_access_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    memory_record RECORD;
    user_agent_id UUID;
BEGIN
    -- Get memory record
    SELECT * INTO memory_record
    FROM public.swarm_memory_store
    WHERE id = p_memory_id;
    
    -- Check if memory exists and user has swarm access
    IF NOT FOUND OR NOT public.has_swarm_access(memory_record.swarm_id) THEN
        RETURN FALSE;
    END IF;
    
    -- For public access level, allow read access
    IF memory_record.access_level = 'public' AND p_access_type = 'read' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is the owner
    IF memory_record.owner_agent_id IS NOT NULL THEN
        SELECT id INTO user_agent_id
        FROM public.workers
        WHERE swarm_id = (SELECT name FROM public.swarms WHERE id = memory_record.swarm_id)
        AND metadata->>'user_id' = auth.uid()::TEXT
        LIMIT 1;
        
        IF user_agent_id = memory_record.owner_agent_id THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Check if memory is shared with user's agents
    IF memory_record.access_level = 'shared' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.workers w
            WHERE w.swarm_id = (SELECT name FROM public.swarms WHERE id = memory_record.swarm_id)
            AND w.metadata->>'user_id' = auth.uid()::TEXT
            AND w.id = ANY(memory_record.shared_with_agents)
        );
    END IF;
    
    -- Fallback to swarm admin check
    RETURN public.is_swarm_admin(memory_record.swarm_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- SWARM TOPOLOGIES POLICIES
-- ==========================================

CREATE POLICY "Users can view swarm topologies" ON public.swarm_topologies
    FOR SELECT USING (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "Swarm admins can manage topologies" ON public.swarm_topologies
    FOR ALL USING (
        public.is_swarm_admin(swarm_id)
    );

-- ==========================================
-- AGENT TYPES POLICIES
-- ==========================================

-- Agent types are generally readable by authenticated users
CREATE POLICY "Authenticated users can view agent types" ON public.agent_types
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only super admins can modify system agent types
CREATE POLICY "Super admins can manage system agent types" ON public.agent_types
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND app_role = 'super_admin'
        )
    );

-- Users can create custom (non-system) agent types
CREATE POLICY "Users can create custom agent types" ON public.agent_types
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND NOT is_system_type
    );

-- ==========================================
-- COORDINATION SESSIONS POLICIES
-- ==========================================

CREATE POLICY "Users can view accessible coordination sessions" ON public.swarm_coordination_sessions
    FOR SELECT USING (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "Users can create coordination sessions" ON public.swarm_coordination_sessions
    FOR INSERT WITH CHECK (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "Session creators can update sessions" ON public.swarm_coordination_sessions
    FOR UPDATE USING (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "Swarm admins can delete sessions" ON public.swarm_coordination_sessions
    FOR DELETE USING (
        public.is_swarm_admin(swarm_id)
    );

-- ==========================================
-- AGENT RELATIONSHIPS POLICIES
-- ==========================================

CREATE POLICY "Users can view agent relationships" ON public.agent_relationships
    FOR SELECT USING (
        public.can_access_agent(parent_agent_id) AND 
        public.can_access_agent(child_agent_id)
    );

CREATE POLICY "Users can manage agent relationships" ON public.agent_relationships
    FOR ALL USING (
        public.can_access_agent(parent_agent_id) AND 
        public.can_access_agent(child_agent_id)
    );

-- ==========================================
-- TASK DEPENDENCIES POLICIES
-- ==========================================

CREATE POLICY "Users can view task dependencies" ON public.task_dependencies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.swarms s ON t.swarm_id = s.id
            WHERE t.id = task_id
            AND public.has_swarm_access(s.id)
        )
    );

CREATE POLICY "Users can manage task dependencies" ON public.task_dependencies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.swarms s ON t.swarm_id = s.id
            WHERE t.id = task_id
            AND public.has_swarm_access(s.id)
        )
    );

-- ==========================================
-- TASK ORCHESTRATIONS POLICIES
-- ==========================================

CREATE POLICY "Users can view task orchestrations" ON public.task_orchestrations
    FOR SELECT USING (
        public.can_access_session(session_id)
    );

CREATE POLICY "Users can manage task orchestrations" ON public.task_orchestrations
    FOR ALL USING (
        public.can_access_session(session_id)
    );

-- ==========================================
-- MEMORY STORE POLICIES
-- ==========================================

CREATE POLICY "Users can read accessible memory" ON public.swarm_memory_store
    FOR SELECT USING (
        public.can_access_memory(id, 'read')
    );

CREATE POLICY "Users can write accessible memory" ON public.swarm_memory_store
    FOR INSERT WITH CHECK (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "Memory owners can update memory" ON public.swarm_memory_store
    FOR UPDATE USING (
        public.can_access_memory(id, 'write')
    );

CREATE POLICY "Memory owners can delete memory" ON public.swarm_memory_store
    FOR DELETE USING (
        public.can_access_memory(id, 'delete')
    );

-- ==========================================
-- MEMORY ACCESS LOG POLICIES
-- ==========================================

CREATE POLICY "Users can view memory access logs" ON public.memory_access_log
    FOR SELECT USING (
        public.can_access_agent(agent_id) OR
        EXISTS (
            SELECT 1 FROM public.swarm_memory_store sms
            WHERE sms.id = memory_store_id
            AND public.can_access_memory(sms.id, 'read')
        )
    );

CREATE POLICY "System can log memory access" ON public.memory_access_log
    FOR INSERT WITH CHECK (
        public.can_access_agent(agent_id)
    );

-- ==========================================
-- NEURAL TRAINING POLICIES
-- ==========================================

CREATE POLICY "Users can view neural training sessions" ON public.neural_training_sessions
    FOR SELECT USING (
        public.can_access_agent(agent_id)
    );

CREATE POLICY "Users can manage neural training" ON public.neural_training_sessions
    FOR ALL USING (
        public.can_access_agent(agent_id)
    );

-- ==========================================
-- KNOWLEDGE TRANSFER POLICIES
-- ==========================================

CREATE POLICY "Users can view knowledge transfers" ON public.knowledge_transfer_log
    FOR SELECT USING (
        public.can_access_agent(source_agent_id) OR
        public.can_access_agent(target_agent_id)
    );

CREATE POLICY "Users can log knowledge transfers" ON public.knowledge_transfer_log
    FOR INSERT WITH CHECK (
        public.can_access_agent(source_agent_id) AND
        public.can_access_agent(target_agent_id)
    );

-- ==========================================
-- HEARTBEAT POLICIES
-- ==========================================

CREATE POLICY "Users can view agent heartbeats" ON public.agent_heartbeats
    FOR SELECT USING (
        public.can_access_agent(agent_id)
    );

CREATE POLICY "Agents can report heartbeats" ON public.agent_heartbeats
    FOR INSERT WITH CHECK (
        public.can_access_agent(agent_id)
    );

CREATE POLICY "Agents can update heartbeats" ON public.agent_heartbeats
    FOR UPDATE USING (
        public.can_access_agent(agent_id)
    );

-- Auto-cleanup old heartbeats (DELETE policy)
CREATE POLICY "System can cleanup old heartbeats" ON public.agent_heartbeats
    FOR DELETE USING (
        heartbeat_at < NOW() - INTERVAL '24 hours'
    );

-- ==========================================
-- COORDINATION EVENTS POLICIES
-- ==========================================

CREATE POLICY "Users can view coordination events" ON public.coordination_events
    FOR SELECT USING (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "Agents can create coordination events" ON public.coordination_events
    FOR INSERT WITH CHECK (
        public.has_swarm_access(swarm_id) AND
        (source_agent_id IS NULL OR public.can_access_agent(source_agent_id))
    );

CREATE POLICY "Agents can update coordination events" ON public.coordination_events
    FOR UPDATE USING (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "System can cleanup processed events" ON public.coordination_events
    FOR DELETE USING (
        processed = true AND created_at < NOW() - INTERVAL '7 days'
    );

-- ==========================================
-- PERFORMANCE SNAPSHOTS POLICIES
-- ==========================================

CREATE POLICY "Users can view performance snapshots" ON public.swarm_performance_snapshots
    FOR SELECT USING (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "System can create performance snapshots" ON public.swarm_performance_snapshots
    FOR INSERT WITH CHECK (
        public.has_swarm_access(swarm_id)
    );

CREATE POLICY "Admins can manage performance snapshots" ON public.swarm_performance_snapshots
    FOR ALL USING (
        public.is_swarm_admin(swarm_id)
    );

-- ==========================================
-- ADDITIONAL SECURITY MEASURES
-- ==========================================

-- Create a function to audit sensitive operations
CREATE OR REPLACE FUNCTION public.audit_swarm_operation()
RETURNS TRIGGER AS $$
BEGIN
    -- Log sensitive operations to audit_logs
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource,
        resource_id,
        old_values,
        new_values,
        metadata
    ) VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', NOW()
        )
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_swarm_topologies
    AFTER INSERT OR UPDATE OR DELETE ON public.swarm_topologies
    FOR EACH ROW EXECUTE FUNCTION public.audit_swarm_operation();

CREATE TRIGGER audit_coordination_sessions
    AFTER INSERT OR UPDATE OR DELETE ON public.swarm_coordination_sessions
    FOR EACH ROW EXECUTE FUNCTION public.audit_swarm_operation();

CREATE TRIGGER audit_memory_store
    AFTER INSERT OR UPDATE OR DELETE ON public.swarm_memory_store
    FOR EACH ROW EXECUTE FUNCTION public.audit_swarm_operation();

CREATE TRIGGER audit_neural_training
    AFTER INSERT OR UPDATE OR DELETE ON public.neural_training_sessions
    FOR EACH ROW EXECUTE FUNCTION public.audit_swarm_operation();

-- Create rate limiting for coordination events
CREATE OR REPLACE FUNCTION public.rate_limit_coordination_events()
RETURNS TRIGGER AS $$
DECLARE
    event_count INTEGER;
BEGIN
    -- Count events from the same source in the last minute
    SELECT COUNT(*) INTO event_count
    FROM public.coordination_events
    WHERE source_agent_id = NEW.source_agent_id
    AND created_at > NOW() - INTERVAL '1 minute';
    
    -- Limit to 100 events per minute per agent
    IF event_count > 100 THEN
        RAISE EXCEPTION 'Rate limit exceeded: too many coordination events from agent %', NEW.source_agent_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rate_limit_coordination_events_trigger
    BEFORE INSERT ON public.coordination_events
    FOR EACH ROW EXECUTE FUNCTION public.rate_limit_coordination_events();

-- Create memory cleanup trigger
CREATE OR REPLACE FUNCTION public.cleanup_expired_memory()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-delete expired memory entries
    DELETE FROM public.swarm_memory_store
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run memory cleanup periodically (this would typically be done via pg_cron or external scheduler)
-- For now, we'll trigger it on new memory inserts
CREATE TRIGGER cleanup_expired_memory_trigger
    AFTER INSERT ON public.swarm_memory_store
    FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_expired_memory();

-- ==========================================
-- PERFORMANCE OPTIMIZATIONS FOR SECURITY
-- ==========================================

-- Create indexes on security-related columns
CREATE INDEX IF NOT EXISTS idx_swarms_created_by ON public.swarms(created_by);
CREATE INDEX IF NOT EXISTS idx_workers_metadata_user_id ON public.workers USING GIN((metadata->>'user_id'));
CREATE INDEX IF NOT EXISTS idx_memory_store_owner_access ON public.swarm_memory_store(owner_agent_id, access_level);
CREATE INDEX IF NOT EXISTS idx_coordination_events_source_created ON public.coordination_events(source_agent_id, created_at);

-- ==========================================
-- SECURITY VIEWS FOR COMMON QUERIES
-- ==========================================

-- View for user's accessible swarms
CREATE OR REPLACE VIEW public.user_accessible_swarms AS
SELECT s.*
FROM public.swarms s
WHERE public.has_swarm_access(s.id);

-- View for user's agents across all swarms
CREATE OR REPLACE VIEW public.user_agents AS
SELECT w.*
FROM public.workers w
JOIN public.swarms s ON w.swarm_id = s.name
WHERE public.has_swarm_access(s.id);

-- View for user's coordination sessions
CREATE OR REPLACE VIEW public.user_coordination_sessions AS
SELECT scs.*
FROM public.swarm_coordination_sessions scs
WHERE public.has_swarm_access(scs.swarm_id);

-- View for user's accessible memory
CREATE OR REPLACE VIEW public.user_accessible_memory AS
SELECT sms.*
FROM public.swarm_memory_store sms
WHERE public.can_access_memory(sms.id, 'read');

-- ==========================================
-- GRANT PERMISSIONS FOR SECURITY FUNCTIONS
-- ==========================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION public.is_swarm_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_swarm_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_agent(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_memory(UUID, TEXT) TO authenticated;

-- Grant access to security views
GRANT SELECT ON public.user_accessible_swarms TO authenticated;
GRANT SELECT ON public.user_agents TO authenticated;
GRANT SELECT ON public.user_coordination_sessions TO authenticated;
GRANT SELECT ON public.user_accessible_memory TO authenticated;

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON FUNCTION public.is_swarm_admin(UUID) IS 'Check if the current user is an admin for the specified swarm';
COMMENT ON FUNCTION public.has_swarm_access(UUID) IS 'Check if the current user has access to the specified swarm';
COMMENT ON FUNCTION public.can_access_agent(UUID) IS 'Check if the current user can access the specified agent';
COMMENT ON FUNCTION public.can_access_session(UUID) IS 'Check if the current user can access the specified coordination session';
COMMENT ON FUNCTION public.can_access_memory(UUID, TEXT) IS 'Check if the current user can access memory with specified access type';

COMMENT ON VIEW public.user_accessible_swarms IS 'All swarms accessible to the current user';
COMMENT ON VIEW public.user_agents IS 'All agents accessible to the current user across all swarms';
COMMENT ON VIEW public.user_coordination_sessions IS 'All coordination sessions accessible to the current user';
COMMENT ON VIEW public.user_accessible_memory IS 'All memory entries accessible to the current user';