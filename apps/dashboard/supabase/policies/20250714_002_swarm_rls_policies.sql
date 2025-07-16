-- =====================================================================================
-- Enhanced Row Level Security (RLS) Policies for Swarm Relationship Schema
-- Version: 20250714_002
-- Author: Schema Developer Agent
-- Description: Comprehensive RLS policies for swarm coordination and observability
-- =====================================================================================

-- =====================================================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================================================

ALTER TABLE public.swarm_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swarm_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_orchestration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neural_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swarm_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;

-- =====================================================================================
-- DROP EXISTING POLICIES (IF ANY)
-- =====================================================================================

DROP POLICY IF EXISTS "swarm_networks_select_policy" ON public.swarm_networks;
DROP POLICY IF EXISTS "swarm_networks_insert_policy" ON public.swarm_networks;
DROP POLICY IF EXISTS "swarm_networks_update_policy" ON public.swarm_networks;
DROP POLICY IF EXISTS "swarm_networks_delete_policy" ON public.swarm_networks;

-- =====================================================================================
-- SWARM NETWORKS POLICIES
-- =====================================================================================

-- Read access for authenticated users (owner or org member)
CREATE POLICY "swarm_networks_select_policy" ON public.swarm_networks
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            created_by = auth.uid() OR
            organization_id IN (
                SELECT organization_id FROM public.user_profiles 
                WHERE id = auth.uid()
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert access for authenticated users
CREATE POLICY "swarm_networks_insert_policy" ON public.swarm_networks
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            created_by = auth.uid() OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Update access for network owners and service role
CREATE POLICY "swarm_networks_update_policy" ON public.swarm_networks
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            created_by = auth.uid() OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Delete access for network owners and service role
CREATE POLICY "swarm_networks_delete_policy" ON public.swarm_networks
    FOR DELETE USING (
        auth.role() = 'authenticated' AND (
            created_by = auth.uid() OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Service role bypass for networks
CREATE POLICY "swarm_networks_service_bypass" ON public.swarm_networks
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Demo access for anonymous users
CREATE POLICY "swarm_networks_demo_access" ON public.swarm_networks
    FOR SELECT USING (
        auth.role() = 'anon' AND 
        metadata->>'demo' = 'true'
    );

-- =====================================================================================
-- SWARM AGENTS POLICIES
-- =====================================================================================

-- Read access based on network ownership
CREATE POLICY "swarm_agents_select_policy" ON public.swarm_agents
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    n.organization_id IN (
                        SELECT organization_id FROM public.user_profiles 
                        WHERE id = auth.uid()
                    )
                )
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert access based on network ownership
CREATE POLICY "swarm_agents_insert_policy" ON public.swarm_agents
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Update access based on network ownership
CREATE POLICY "swarm_agents_update_policy" ON public.swarm_agents
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Delete access based on network ownership
CREATE POLICY "swarm_agents_delete_policy" ON public.swarm_agents
    FOR DELETE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Service role bypass for agents
CREATE POLICY "swarm_agents_service_bypass" ON public.swarm_agents
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Demo access for anonymous users
CREATE POLICY "swarm_agents_demo_access" ON public.swarm_agents
    FOR SELECT USING (
        auth.role() = 'anon' AND 
        EXISTS (
            SELECT 1 FROM public.swarm_networks n 
            WHERE n.id = network_id AND n.metadata->>'demo' = 'true'
        )
    );

-- =====================================================================================
-- AGENT RELATIONSHIPS POLICIES
-- =====================================================================================

-- Read access based on agent ownership
CREATE POLICY "agent_relationships_select_policy" ON public.agent_relationships
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_agents sa
                JOIN public.swarm_networks sn ON sa.network_id = sn.id
                WHERE sa.id IN (source_agent_id, target_agent_id) AND (
                    sn.created_by = auth.uid() OR
                    sn.organization_id IN (
                        SELECT organization_id FROM public.user_profiles 
                        WHERE id = auth.uid()
                    )
                )
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert/Update/Delete based on network ownership
CREATE POLICY "agent_relationships_modify_policy" ON public.agent_relationships
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_agents sa
                JOIN public.swarm_networks sn ON sa.network_id = sn.id
                WHERE sa.id IN (source_agent_id, target_agent_id) AND (
                    sn.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Service role bypass
CREATE POLICY "agent_relationships_service_bypass" ON public.agent_relationships
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================================
-- TASK ORCHESTRATION POLICIES
-- =====================================================================================

-- Read access based on network ownership
CREATE POLICY "task_orchestration_select_policy" ON public.task_orchestration
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    n.organization_id IN (
                        SELECT organization_id FROM public.user_profiles 
                        WHERE id = auth.uid()
                    )
                )
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert/Update/Delete based on network ownership
CREATE POLICY "task_orchestration_modify_policy" ON public.task_orchestration
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Service role bypass
CREATE POLICY "task_orchestration_service_bypass" ON public.task_orchestration
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================================
-- NEURAL PATTERNS POLICIES
-- =====================================================================================

-- Read access for all authenticated users (patterns can be shared)
CREATE POLICY "neural_patterns_select_policy" ON public.neural_patterns
    FOR SELECT USING (
        auth.role() = 'authenticated' OR
        auth.jwt()->>'role' = 'service_role'
    );

-- Modify access based on network ownership
CREATE POLICY "neural_patterns_modify_policy" ON public.neural_patterns
    FOR ALL USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Service role bypass
CREATE POLICY "neural_patterns_service_bypass" ON public.neural_patterns
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================================
-- SWARM MEMORY POLICIES
-- =====================================================================================

-- Read access based on network ownership and memory type
CREATE POLICY "swarm_memory_select_policy" ON public.swarm_memory
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    n.organization_id IN (
                        SELECT organization_id FROM public.user_profiles 
                        WHERE id = auth.uid()
                    )
                )
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert access based on network ownership
CREATE POLICY "swarm_memory_insert_policy" ON public.swarm_memory
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Update access based on network ownership or memory creator
CREATE POLICY "swarm_memory_update_policy" ON public.swarm_memory
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            ) OR
            created_by_agent_id IN (
                SELECT id FROM public.swarm_agents sa
                JOIN public.swarm_networks sn ON sa.network_id = sn.id
                WHERE sn.created_by = auth.uid()
            )
        )
    );

-- Delete access based on network ownership
CREATE POLICY "swarm_memory_delete_policy" ON public.swarm_memory
    FOR DELETE USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    auth.jwt()->>'role' = 'service_role'
                )
            )
        )
    );

-- Service role bypass
CREATE POLICY "swarm_memory_service_bypass" ON public.swarm_memory
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================================
-- COORDINATION EVENTS POLICIES
-- =====================================================================================

-- Read access based on network ownership
CREATE POLICY "coordination_events_select_policy" ON public.coordination_events
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    n.organization_id IN (
                        SELECT organization_id FROM public.user_profiles 
                        WHERE id = auth.uid()
                    )
                )
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert access for authenticated users and service role
CREATE POLICY "coordination_events_insert_policy" ON public.coordination_events
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' OR
        auth.jwt()->>'role' = 'service_role'
    );

-- No direct update/delete for events (append-only log)
CREATE POLICY "coordination_events_no_modify" ON public.coordination_events
    FOR UPDATE USING (false);

CREATE POLICY "coordination_events_no_delete" ON public.coordination_events
    FOR DELETE USING (false);

-- Service role bypass
CREATE POLICY "coordination_events_service_bypass" ON public.coordination_events
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================================
-- PERFORMANCE METRICS POLICIES
-- =====================================================================================

-- Read access based on network ownership
CREATE POLICY "performance_metrics_select_policy" ON public.performance_metrics
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    n.organization_id IN (
                        SELECT organization_id FROM public.user_profiles 
                        WHERE id = auth.uid()
                    )
                )
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert access for authenticated users and service role
CREATE POLICY "performance_metrics_insert_policy" ON public.performance_metrics
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' OR
        auth.jwt()->>'role' = 'service_role'
    );

-- No direct update/delete for metrics (append-only)
CREATE POLICY "performance_metrics_no_modify" ON public.performance_metrics
    FOR UPDATE USING (false);

CREATE POLICY "performance_metrics_no_delete" ON public.performance_metrics
    FOR DELETE USING (false);

-- Service role bypass
CREATE POLICY "performance_metrics_service_bypass" ON public.performance_metrics
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================================
-- HEALTH CHECKS POLICIES
-- =====================================================================================

-- Read access based on network ownership
CREATE POLICY "health_checks_select_policy" ON public.health_checks
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.swarm_networks n 
                WHERE n.id = network_id AND (
                    n.created_by = auth.uid() OR
                    n.organization_id IN (
                        SELECT organization_id FROM public.user_profiles 
                        WHERE id = auth.uid()
                    )
                )
            ) OR
            auth.jwt()->>'role' = 'service_role'
        )
    );

-- Insert access for authenticated users and service role
CREATE POLICY "health_checks_insert_policy" ON public.health_checks
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' OR
        auth.jwt()->>'role' = 'service_role'
    );

-- No direct update/delete for health checks (monitoring data)
CREATE POLICY "health_checks_no_modify" ON public.health_checks
    FOR UPDATE USING (false);

CREATE POLICY "health_checks_no_delete" ON public.health_checks
    FOR DELETE USING (false);

-- Service role bypass
CREATE POLICY "health_checks_service_bypass" ON public.health_checks
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================================================
-- ENHANCED SECURITY FUNCTIONS
-- =====================================================================================

-- Function to check network ownership
CREATE OR REPLACE FUNCTION public.is_network_owner(network_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.swarm_networks 
        WHERE id = network_uuid AND (
            created_by = auth.uid() OR
            organization_id IN (
                SELECT organization_id FROM public.user_profiles 
                WHERE id = auth.uid()
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check agent access
CREATE OR REPLACE FUNCTION public.can_access_agent(agent_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.swarm_agents sa
        JOIN public.swarm_networks sn ON sa.network_id = sn.id
        WHERE sa.id = agent_uuid AND (
            sn.created_by = auth.uid() OR
            sn.organization_id IN (
                SELECT organization_id FROM public.user_profiles 
                WHERE id = auth.uid()
            )
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate memory access permissions
CREATE OR REPLACE FUNCTION public.can_access_memory(network_uuid UUID, memory_namespace TEXT DEFAULT 'default')
RETURNS BOOLEAN AS $$
BEGIN
    -- Check network ownership
    IF NOT public.is_network_owner(network_uuid) THEN
        RETURN FALSE;
    END IF;
    
    -- Additional namespace-specific permissions can be added here
    -- For now, network ownership grants access to all namespaces
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- GRANT PERMISSIONS
-- =====================================================================================

-- Grant basic permissions to authenticated users
GRANT SELECT ON public.swarm_networks TO authenticated;
GRANT SELECT ON public.swarm_agents TO authenticated;
GRANT SELECT ON public.agent_relationships TO authenticated;
GRANT SELECT ON public.task_orchestration TO authenticated;
GRANT SELECT ON public.neural_patterns TO authenticated;
GRANT SELECT ON public.swarm_memory TO authenticated;
GRANT SELECT ON public.coordination_events TO authenticated;
GRANT SELECT ON public.performance_metrics TO authenticated;
GRANT SELECT ON public.health_checks TO authenticated;

-- Grant insert permissions for data collection
GRANT INSERT ON public.coordination_events TO authenticated;
GRANT INSERT ON public.performance_metrics TO authenticated;
GRANT INSERT ON public.health_checks TO authenticated;

-- Grant limited select permissions for anonymous users (demo data only)
GRANT SELECT ON public.swarm_networks TO anon;
GRANT SELECT ON public.swarm_agents TO anon;

-- Grant all permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =====================================================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================================================

COMMENT ON POLICY "swarm_networks_select_policy" ON public.swarm_networks IS 'Allows users to read their own networks and org networks';
COMMENT ON POLICY "swarm_agents_select_policy" ON public.swarm_agents IS 'Allows users to read agents from their networks';
COMMENT ON POLICY "swarm_memory_select_policy" ON public.swarm_memory IS 'Allows users to read memory from their networks';
COMMENT ON POLICY "coordination_events_insert_policy" ON public.coordination_events IS 'Allows authenticated users to log coordination events';
COMMENT ON POLICY "performance_metrics_insert_policy" ON public.performance_metrics IS 'Allows authenticated users to log performance metrics';

-- Enable real-time subscriptions for monitoring tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.swarm_networks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.swarm_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coordination_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.health_checks;