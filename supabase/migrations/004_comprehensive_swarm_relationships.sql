-- Comprehensive Swarm Relationship Schema
-- This migration extends the existing schema to map swarm relationships, sessions, 
-- agents, tasks, and memory coordination for real-time collaboration

-- Enable additional extensions for advanced features
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==========================================
-- CORE SWARM RELATIONSHIP TABLES
-- ==========================================

-- Swarm Topologies table - Define swarm network structures
CREATE TABLE IF NOT EXISTS public.swarm_topologies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES public.swarms(id) ON DELETE CASCADE,
    topology_type TEXT NOT NULL CHECK (topology_type IN ('mesh', 'hierarchical', 'ring', 'star')),
    max_agents INTEGER NOT NULL DEFAULT 8,
    strategy TEXT NOT NULL CHECK (strategy IN ('balanced', 'specialized', 'adaptive', 'parallel', 'sequential')),
    coordination_rules JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(swarm_id, topology_type)
);

-- Agent Types Enhancement - Define specialized agent capabilities
CREATE TABLE IF NOT EXISTS public.agent_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist')),
    capabilities TEXT[] DEFAULT '{}',
    required_memory_mb INTEGER DEFAULT 512,
    cpu_requirements JSONB DEFAULT '{}',
    coordination_protocols JSONB DEFAULT '{}',
    neural_patterns JSONB DEFAULT '{}',
    description TEXT,
    is_system_type BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Workers table with agent relationships
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS agent_type_id UUID REFERENCES public.agent_types(id);
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES public.workers(id);
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS coordination_state JSONB DEFAULT '{}';
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS neural_weights JSONB DEFAULT '{}';
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS memory_capacity_mb INTEGER DEFAULT 512;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS current_memory_usage_mb INTEGER DEFAULT 0;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS performance_score REAL DEFAULT 0.0;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS specialization_tags TEXT[] DEFAULT '{}';

-- ==========================================
-- SESSION AND COORDINATION TABLES
-- ==========================================

-- Swarm Sessions - Track coordination sessions across agents
CREATE TABLE IF NOT EXISTS public.swarm_coordination_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES public.swarms(id) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('development', 'research', 'analysis', 'testing', 'deployment', 'coordination', 'training')),
    orchestration_strategy TEXT NOT NULL CHECK (orchestration_strategy IN ('parallel', 'sequential', 'adaptive', 'balanced')),
    participant_agents UUID[] DEFAULT '{}',
    coordination_graph JSONB DEFAULT '{}', -- Agent relationship graph
    memory_namespace TEXT NOT NULL DEFAULT 'default',
    session_state TEXT NOT NULL DEFAULT 'initializing' CHECK (session_state IN ('initializing', 'active', 'paused', 'completed', 'failed', 'archived')),
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    performance_metrics JSONB DEFAULT '{}',
    coordination_efficiency REAL DEFAULT 0.0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Relationships - Map agent hierarchies and coordination
CREATE TABLE IF NOT EXISTS public.agent_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_agent_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    child_agent_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('coordination', 'supervision', 'collaboration', 'specialization', 'backup')),
    strength REAL DEFAULT 1.0 CHECK (strength >= 0.0 AND strength <= 1.0),
    coordination_protocol JSONB DEFAULT '{}',
    communication_frequency INTEGER DEFAULT 60, -- seconds
    last_communication TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(parent_agent_id, child_agent_id, relationship_type)
);

-- ==========================================
-- TASK ORCHESTRATION AND COORDINATION
-- ==========================================

-- Task Dependencies - Define task relationships and execution order
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('hard', 'soft', 'parallel', 'conditional')),
    condition JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(task_id, dependency_task_id)
);

-- Task Orchestration - Coordinate task execution across agents
CREATE TABLE IF NOT EXISTS public.task_orchestrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.swarm_coordination_sessions(id) ON DELETE CASCADE,
    orchestration_name TEXT NOT NULL,
    execution_plan JSONB NOT NULL,
    assigned_agents UUID[] DEFAULT '{}',
    current_phase TEXT,
    total_phases INTEGER DEFAULT 1,
    parallel_execution BOOLEAN DEFAULT false,
    auto_recovery BOOLEAN DEFAULT true,
    timeout_seconds INTEGER DEFAULT 3600,
    progress_percentage REAL DEFAULT 0.0,
    orchestration_state TEXT NOT NULL DEFAULT 'pending' CHECK (orchestration_state IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    results JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- MEMORY AND KNOWLEDGE COORDINATION
-- ==========================================

-- Shared Memory Store - Cross-agent memory coordination
CREATE TABLE IF NOT EXISTS public.swarm_memory_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES public.swarms(id) ON DELETE CASCADE,
    namespace TEXT NOT NULL DEFAULT 'default',
    memory_key TEXT NOT NULL,
    memory_value JSONB NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('context', 'decision', 'learning', 'coordination', 'template', 'pattern')),
    owner_agent_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    shared_with_agents UUID[] DEFAULT '{}',
    access_level TEXT NOT NULL DEFAULT 'private' CHECK (access_level IN ('private', 'shared', 'public')),
    ttl_seconds INTEGER, -- Time to live
    expires_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(swarm_id, namespace, memory_key)
);

-- Memory Access Log - Track memory usage across agents
CREATE TABLE IF NOT EXISTS public.memory_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_store_id UUID NOT NULL REFERENCES public.swarm_memory_store(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'delete', 'share')),
    access_result TEXT NOT NULL CHECK (access_result IN ('success', 'denied', 'not_found', 'expired')),
    context JSONB DEFAULT '{}',
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- NEURAL COORDINATION AND LEARNING
-- ==========================================

-- Neural Training Sessions - Track agent learning
CREATE TABLE IF NOT EXISTS public.neural_training_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    training_type TEXT NOT NULL CHECK (training_type IN ('coordination', 'optimization', 'prediction', 'pattern_recognition', 'adaptation')),
    training_data JSONB NOT NULL,
    neural_pattern TEXT NOT NULL CHECK (neural_pattern IN ('convergent', 'divergent', 'lateral', 'systems', 'critical', 'adaptive')),
    epochs INTEGER DEFAULT 10,
    learning_rate REAL DEFAULT 0.001,
    performance_before REAL DEFAULT 0.0,
    performance_after REAL DEFAULT 0.0,
    improvement_percentage REAL DEFAULT 0.0,
    weights_before JSONB DEFAULT '{}',
    weights_after JSONB DEFAULT '{}',
    training_metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Transfer Log - Track learning sharing between agents
CREATE TABLE IF NOT EXISTS public.knowledge_transfer_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_agent_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    target_agent_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    knowledge_domain TEXT NOT NULL,
    knowledge_content JSONB NOT NULL,
    transfer_method TEXT NOT NULL CHECK (transfer_method IN ('direct', 'gradual', 'adaptive', 'pattern_based')),
    success_rate REAL DEFAULT 0.0,
    integration_score REAL DEFAULT 0.0,
    performance_impact REAL DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    transferred_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- REAL-TIME COORDINATION TABLES
-- ==========================================

-- Agent Heartbeats - Real-time agent status tracking
CREATE TABLE IF NOT EXISTS public.agent_heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'idle', 'busy', 'error', 'offline', 'starting', 'stopping')),
    current_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    cpu_usage REAL DEFAULT 0.0,
    memory_usage REAL DEFAULT 0.0,
    coordination_load REAL DEFAULT 0.0,
    response_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_communication TIMESTAMPTZ DEFAULT NOW(),
    health_score REAL DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    heartbeat_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coordination Events - Real-time coordination messaging
CREATE TABLE IF NOT EXISTS public.coordination_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES public.swarms(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.swarm_coordination_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('agent_spawn', 'agent_stop', 'task_start', 'task_complete', 'coordination_update', 'memory_update', 'error', 'system_alert')),
    source_agent_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    target_agents UUID[] DEFAULT '{}',
    event_data JSONB NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    requires_response BOOLEAN DEFAULT false,
    response_data JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PERFORMANCE AND ANALYTICS TABLES
-- ==========================================

-- Swarm Performance Snapshots - Track overall swarm efficiency
CREATE TABLE IF NOT EXISTS public.swarm_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES public.swarms(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.swarm_coordination_sessions(id) ON DELETE CASCADE,
    
    -- Agent metrics
    total_agents INTEGER DEFAULT 0,
    active_agents INTEGER DEFAULT 0,
    avg_agent_performance REAL DEFAULT 0.0,
    coordination_efficiency REAL DEFAULT 0.0,
    
    -- Task metrics
    tasks_completed_per_hour REAL DEFAULT 0.0,
    avg_task_completion_time REAL DEFAULT 0.0,
    task_success_rate REAL DEFAULT 0.0,
    
    -- System metrics
    memory_utilization REAL DEFAULT 0.0,
    cpu_utilization REAL DEFAULT 0.0,
    network_efficiency REAL DEFAULT 0.0,
    
    -- Coordination metrics
    communication_frequency REAL DEFAULT 0.0,
    coordination_overhead REAL DEFAULT 0.0,
    decision_latency REAL DEFAULT 0.0,
    
    -- Learning metrics
    learning_rate REAL DEFAULT 0.0,
    knowledge_sharing_rate REAL DEFAULT 0.0,
    adaptation_speed REAL DEFAULT 0.0,
    
    snapshot_metadata JSONB DEFAULT '{}',
    snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Swarm Topologies indexes
CREATE INDEX IF NOT EXISTS idx_swarm_topologies_swarm_id ON public.swarm_topologies(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_topologies_type ON public.swarm_topologies(topology_type);
CREATE INDEX IF NOT EXISTS idx_swarm_topologies_active ON public.swarm_topologies(is_active);

-- Agent Types indexes
CREATE INDEX IF NOT EXISTS idx_agent_types_category ON public.agent_types(category);
CREATE INDEX IF NOT EXISTS idx_agent_types_system ON public.agent_types(is_system_type);

-- Workers enhanced indexes
CREATE INDEX IF NOT EXISTS idx_workers_agent_type ON public.workers(agent_type_id);
CREATE INDEX IF NOT EXISTS idx_workers_parent_agent ON public.workers(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_workers_performance ON public.workers(performance_score DESC);

-- Coordination Sessions indexes
CREATE INDEX IF NOT EXISTS idx_coordination_sessions_swarm_id ON public.swarm_coordination_sessions(swarm_id);
CREATE INDEX IF NOT EXISTS idx_coordination_sessions_type ON public.swarm_coordination_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_coordination_sessions_state ON public.swarm_coordination_sessions(session_state);
CREATE INDEX IF NOT EXISTS idx_coordination_sessions_started ON public.swarm_coordination_sessions(started_at DESC);

-- Agent Relationships indexes
CREATE INDEX IF NOT EXISTS idx_agent_relationships_parent ON public.agent_relationships(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_child ON public.agent_relationships(child_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_type ON public.agent_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_active ON public.agent_relationships(is_active);

-- Task Dependencies indexes
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_dependency ON public.task_dependencies(dependency_task_id);

-- Task Orchestrations indexes
CREATE INDEX IF NOT EXISTS idx_task_orchestrations_session ON public.task_orchestrations(session_id);
CREATE INDEX IF NOT EXISTS idx_task_orchestrations_state ON public.task_orchestrations(orchestration_state);

-- Memory Store indexes
CREATE INDEX IF NOT EXISTS idx_memory_store_swarm_namespace ON public.swarm_memory_store(swarm_id, namespace);
CREATE INDEX IF NOT EXISTS idx_memory_store_key ON public.swarm_memory_store(memory_key);
CREATE INDEX IF NOT EXISTS idx_memory_store_type ON public.swarm_memory_store(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_store_owner ON public.swarm_memory_store(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_store_expires ON public.swarm_memory_store(expires_at);
CREATE INDEX IF NOT EXISTS idx_memory_store_tags ON public.swarm_memory_store USING GIN(tags);

-- Memory Access Log indexes
CREATE INDEX IF NOT EXISTS idx_memory_access_memory_id ON public.memory_access_log(memory_store_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_agent_id ON public.memory_access_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_access_time ON public.memory_access_log(accessed_at DESC);

-- Neural Training indexes
CREATE INDEX IF NOT EXISTS idx_neural_training_agent ON public.neural_training_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_neural_training_type ON public.neural_training_sessions(training_type);
CREATE INDEX IF NOT EXISTS idx_neural_training_pattern ON public.neural_training_sessions(neural_pattern);

-- Knowledge Transfer indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_transfer_source ON public.knowledge_transfer_log(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_transfer_target ON public.knowledge_transfer_log(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_transfer_domain ON public.knowledge_transfer_log(knowledge_domain);

-- Heartbeats indexes (with automatic cleanup in mind)
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_agent ON public.agent_heartbeats(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_time ON public.agent_heartbeats(heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_status ON public.agent_heartbeats(status);

-- Coordination Events indexes
CREATE INDEX IF NOT EXISTS idx_coordination_events_swarm ON public.coordination_events(swarm_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_session ON public.coordination_events(session_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_type ON public.coordination_events(event_type);
CREATE INDEX IF NOT EXISTS idx_coordination_events_source ON public.coordination_events(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_priority ON public.coordination_events(priority);
CREATE INDEX IF NOT EXISTS idx_coordination_events_processed ON public.coordination_events(processed);
CREATE INDEX IF NOT EXISTS idx_coordination_events_time ON public.coordination_events(created_at DESC);

-- Performance Snapshots indexes
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_swarm ON public.swarm_performance_snapshots(swarm_id);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_session ON public.swarm_performance_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_time ON public.swarm_performance_snapshots(snapshot_at DESC);

-- ==========================================
-- UPDATED TIMESTAMP TRIGGERS
-- ==========================================

CREATE TRIGGER update_swarm_topologies_updated_at 
    BEFORE UPDATE ON public.swarm_topologies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_types_updated_at 
    BEFORE UPDATE ON public.agent_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_coordination_sessions_updated_at 
    BEFORE UPDATE ON public.swarm_coordination_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_relationships_updated_at 
    BEFORE UPDATE ON public.agent_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_task_orchestrations_updated_at 
    BEFORE UPDATE ON public.task_orchestrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_memory_store_updated_at 
    BEFORE UPDATE ON public.swarm_memory_store
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all new tables
ALTER TABLE public.swarm_topologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swarm_coordination_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_orchestrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swarm_memory_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neural_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_transfer_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swarm_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (to be customized based on specific auth requirements)
CREATE POLICY "Allow authenticated users to view swarm topologies" ON public.swarm_topologies
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view agent types" ON public.agent_types
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage coordination sessions" ON public.swarm_coordination_sessions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view relationships" ON public.agent_relationships
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view task dependencies" ON public.task_dependencies
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view orchestrations" ON public.task_orchestrations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage memory" ON public.swarm_memory_store
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view memory access" ON public.memory_access_log
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view neural training" ON public.neural_training_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view knowledge transfer" ON public.knowledge_transfer_log
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view heartbeats" ON public.agent_heartbeats
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage coordination events" ON public.coordination_events
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view performance snapshots" ON public.swarm_performance_snapshots
    FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- ADVANCED FUNCTIONS FOR COORDINATION
-- ==========================================

-- Function to calculate swarm coordination efficiency
CREATE OR REPLACE FUNCTION public.calculate_coordination_efficiency(p_swarm_id UUID)
RETURNS REAL AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
    avg_response_time REAL;
    communication_overhead REAL;
    efficiency_score REAL;
BEGIN
    -- Get task completion stats
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_tasks, completed_tasks
    FROM public.tasks
    WHERE swarm_id = p_swarm_id
    AND created_at >= NOW() - INTERVAL '1 hour';

    -- Get average response time
    SELECT AVG(average_response_time)
    INTO avg_response_time
    FROM public.workers
    WHERE swarm_id = (SELECT name FROM public.swarms WHERE id = p_swarm_id)
    AND status = 'active';

    -- Calculate coordination overhead (simplified)
    SELECT COUNT(*) * 0.1 -- Simplified calculation
    INTO communication_overhead
    FROM public.coordination_events
    WHERE swarm_id = p_swarm_id
    AND created_at >= NOW() - INTERVAL '1 hour';

    -- Calculate efficiency (0-1 scale)
    efficiency_score := CASE
        WHEN total_tasks = 0 THEN 0
        ELSE (completed_tasks::REAL / total_tasks) * 
             (1000.0 / GREATEST(avg_response_time, 100)) * 
             (1.0 / GREATEST(communication_overhead, 1))
    END;

    RETURN LEAST(efficiency_score, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to get agent coordination graph
CREATE OR REPLACE FUNCTION public.get_agent_coordination_graph(p_swarm_id UUID)
RETURNS JSONB AS $$
DECLARE
    graph_data JSONB;
BEGIN
    WITH agent_nodes AS (
        SELECT jsonb_build_object(
            'id', w.id,
            'name', w.name,
            'type', w.type,
            'status', w.status,
            'performance_score', w.performance_score
        ) as node
        FROM public.workers w
        WHERE w.swarm_id = (SELECT name FROM public.swarms WHERE id = p_swarm_id)
    ),
    relationship_edges AS (
        SELECT jsonb_build_object(
            'source', ar.parent_agent_id,
            'target', ar.child_agent_id,
            'type', ar.relationship_type,
            'strength', ar.strength
        ) as edge
        FROM public.agent_relationships ar
        WHERE ar.is_active = true
        AND (ar.parent_agent_id IN (SELECT w.id FROM public.workers w WHERE w.swarm_id = (SELECT name FROM public.swarms WHERE id = p_swarm_id))
             OR ar.child_agent_id IN (SELECT w.id FROM public.workers w WHERE w.swarm_id = (SELECT name FROM public.swarms WHERE id = p_swarm_id)))
    )
    SELECT jsonb_build_object(
        'nodes', (SELECT jsonb_agg(node) FROM agent_nodes),
        'edges', (SELECT jsonb_agg(edge) FROM relationship_edges)
    ) INTO graph_data;

    RETURN graph_data;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-cleanup expired data
CREATE OR REPLACE FUNCTION public.cleanup_swarm_data()
RETURNS INTEGER AS $$
DECLARE
    total_cleaned INTEGER := 0;
    cleaned_count INTEGER;
BEGIN
    -- Clean up old heartbeats (keep only last 24 hours)
    DELETE FROM public.agent_heartbeats 
    WHERE heartbeat_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    total_cleaned := total_cleaned + cleaned_count;

    -- Clean up processed coordination events (keep only last 7 days)
    DELETE FROM public.coordination_events 
    WHERE processed = true AND created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    total_cleaned := total_cleaned + cleaned_count;

    -- Clean up expired memory entries
    DELETE FROM public.swarm_memory_store 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    total_cleaned := total_cleaned + cleaned_count;

    -- Clean up old memory access logs (keep only last 30 days)
    DELETE FROM public.memory_access_log 
    WHERE accessed_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    total_cleaned := total_cleaned + cleaned_count;

    RETURN total_cleaned;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- REAL-TIME SUBSCRIPTION SETUP
-- ==========================================

-- Enable real-time for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.coordination_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_heartbeats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.swarm_coordination_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.swarm_memory_store;

-- ==========================================
-- INSERT DEFAULT DATA
-- ==========================================

-- Insert default agent types
INSERT INTO public.agent_types (name, category, capabilities, description, is_system_type) VALUES
    ('Coordinator', 'coordinator', ARRAY['task_orchestration', 'agent_management', 'decision_making'], 'Central coordination agent for swarm management', true),
    ('Researcher', 'researcher', ARRAY['data_analysis', 'information_gathering', 'pattern_recognition'], 'Specialized in research and information analysis', true),
    ('Coder', 'coder', ARRAY['code_generation', 'debugging', 'testing', 'refactoring'], 'Software development and coding tasks', true),
    ('Analyst', 'analyst', ARRAY['data_analysis', 'performance_monitoring', 'optimization'], 'Data analysis and performance optimization', true),
    ('Architect', 'architect', ARRAY['system_design', 'architecture_planning', 'scalability'], 'System architecture and design planning', true),
    ('Tester', 'tester', ARRAY['test_automation', 'quality_assurance', 'validation'], 'Testing and quality assurance specialist', true),
    ('Reviewer', 'reviewer', ARRAY['code_review', 'quality_control', 'compliance'], 'Code review and quality control', true),
    ('Optimizer', 'optimizer', ARRAY['performance_tuning', 'resource_optimization', 'efficiency'], 'Performance and resource optimization', true),
    ('Documenter', 'documenter', ARRAY['documentation', 'technical_writing', 'knowledge_management'], 'Documentation and knowledge management', true),
    ('Monitor', 'monitor', ARRAY['system_monitoring', 'alerting', 'health_checks'], 'System monitoring and health tracking', true)
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.swarm_topologies IS 'Defines swarm network structures and coordination strategies';
COMMENT ON TABLE public.agent_types IS 'Catalog of available agent types with their capabilities';
COMMENT ON TABLE public.swarm_coordination_sessions IS 'Tracks coordination sessions across multiple agents';
COMMENT ON TABLE public.agent_relationships IS 'Maps hierarchical and coordination relationships between agents';
COMMENT ON TABLE public.task_dependencies IS 'Defines dependencies and execution order for tasks';
COMMENT ON TABLE public.task_orchestrations IS 'Coordinates complex task execution across multiple agents';
COMMENT ON TABLE public.swarm_memory_store IS 'Shared memory system for cross-agent coordination';
COMMENT ON TABLE public.memory_access_log IS 'Audit log for memory access and sharing operations';
COMMENT ON TABLE public.neural_training_sessions IS 'Tracks neural network training for agent learning';
COMMENT ON TABLE public.knowledge_transfer_log IS 'Logs knowledge sharing between agents';
COMMENT ON TABLE public.agent_heartbeats IS 'Real-time status tracking for active agents';
COMMENT ON TABLE public.coordination_events IS 'Real-time coordination messaging system';
COMMENT ON TABLE public.swarm_performance_snapshots IS 'Performance analytics and efficiency tracking';