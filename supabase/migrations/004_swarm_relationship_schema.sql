-- Comprehensive Swarm Relationship Schema
-- Created: 2025-07-14
-- Purpose: Map swarm relationships, sessions, agents, tasks, and memory coordination

-- =============================================================================
-- SWARM NETWORKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS swarm_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    topology swarm_topology_enum NOT NULL DEFAULT 'hierarchical',
    max_agents INTEGER NOT NULL DEFAULT 8,
    strategy swarm_strategy_enum NOT NULL DEFAULT 'adaptive',
    status swarm_network_status_enum NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    coordination_config JSONB DEFAULT '{
        "consensus_threshold": 0.6,
        "heartbeat_interval": 30,
        "max_response_time": 5000,
        "auto_scale": true,
        "load_balancing": true
    }'::jsonb
);

-- =============================================================================
-- SWARM SESSIONS TABLE  
-- =============================================================================
CREATE TABLE IF NOT EXISTS swarm_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swarm_id TEXT NOT NULL,
    swarm_name TEXT NOT NULL,
    network_id UUID REFERENCES swarm_networks(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    queen_type TEXT NOT NULL DEFAULT 'strategic',
    worker_count INTEGER NOT NULL DEFAULT 4,
    consensus_algorithm TEXT NOT NULL DEFAULT 'majority',
    status session_status_enum NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    namespace TEXT NOT NULL DEFAULT 'default',
    configuration JSONB DEFAULT '{}'::jsonb,
    metrics JSONB DEFAULT '{
        "tasks_completed": 0,
        "avg_response_time": 0,
        "efficiency_score": 0,
        "coordination_events": 0
    }'::jsonb
);

-- =============================================================================
-- SWARM AGENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS swarm_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL UNIQUE,
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    network_id UUID REFERENCES swarm_networks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type agent_type_enum NOT NULL,
    capabilities TEXT[] DEFAULT '{}',
    status agent_status_enum NOT NULL DEFAULT 'active',
    spawned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    performance_score DECIMAL(5,4) DEFAULT 0.0,
    load_factor DECIMAL(5,4) DEFAULT 0.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    coordination_state JSONB DEFAULT '{
        "current_task": null,
        "queue_depth": 0,
        "coordination_level": "individual",
        "last_coordination": null
    }'::jsonb
);

-- =============================================================================
-- AGENT RELATIONSHIPS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
    target_agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
    relationship_type relationship_type_enum NOT NULL,
    strength DECIMAL(3,2) DEFAULT 1.0 CHECK (strength >= 0.0 AND strength <= 1.0),
    coordination_frequency INTEGER DEFAULT 0,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(source_agent_id, target_agent_id, relationship_type)
);

-- =============================================================================
-- SWARM TASKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS swarm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT NOT NULL,
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    network_id UUID REFERENCES swarm_networks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    strategy execution_strategy_enum NOT NULL DEFAULT 'adaptive',
    priority task_priority_enum NOT NULL DEFAULT 'medium',
    status task_status_enum NOT NULL DEFAULT 'pending',
    assigned_agents UUID[] DEFAULT '{}',
    dependencies UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    progress DECIMAL(5,2) DEFAULT 0.0 CHECK (progress >= 0.0 AND progress <= 100.0),
    result JSONB,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- NEURAL PATTERNS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS neural_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
    pattern_type cognitive_pattern_enum NOT NULL,
    training_session_id TEXT,
    effectiveness_score DECIMAL(5,4) DEFAULT 0.0,
    learning_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- SWARM MEMORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS swarm_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    namespace TEXT NOT NULL DEFAULT 'default',
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES swarm_agents(id) ON DELETE SET NULL,
    access_level memory_access_enum NOT NULL DEFAULT 'shared',
    ttl_seconds INTEGER,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(key, namespace, session_id)
);

-- =============================================================================
-- COORDINATION EVENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS coordination_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    network_id UUID REFERENCES swarm_networks(id) ON DELETE CASCADE,
    source_agent_id UUID REFERENCES swarm_agents(id) ON DELETE SET NULL,
    target_agent_id UUID REFERENCES swarm_agents(id) ON DELETE SET NULL,
    event_type coordination_event_enum NOT NULL,
    priority event_priority_enum NOT NULL DEFAULT 'normal',
    message JSONB NOT NULL,
    status event_status_enum NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    response JSONB,
    correlation_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- PERFORMANCE METRICS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    network_id UUID REFERENCES swarm_networks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
    task_id UUID REFERENCES swarm_tasks(id) ON DELETE SET NULL,
    metric_type performance_metric_enum NOT NULL,
    value DECIMAL(15,6) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'count',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- SWARM HEALTH TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS swarm_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    network_id UUID REFERENCES swarm_networks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
    health_score DECIMAL(5,4) NOT NULL CHECK (health_score >= 0.0 AND health_score <= 1.0),
    status health_status_enum NOT NULL DEFAULT 'healthy',
    last_check TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issues TEXT[],
    diagnostics JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- CUSTOM TYPES (ENUMS)
-- =============================================================================

-- Swarm topology types
CREATE TYPE swarm_topology_enum AS ENUM (
    'mesh', 'hierarchical', 'ring', 'star', 'hybrid'
);

-- Swarm strategy types  
CREATE TYPE swarm_strategy_enum AS ENUM (
    'balanced', 'specialized', 'adaptive', 'performance', 'efficiency'
);

-- Network status
CREATE TYPE swarm_network_status_enum AS ENUM (
    'active', 'inactive', 'scaling', 'maintenance', 'error'
);

-- Session status
CREATE TYPE session_status_enum AS ENUM (
    'active', 'paused', 'completed', 'failed', 'terminated'
);

-- Agent types
CREATE TYPE agent_type_enum AS ENUM (
    'coordinator', 'researcher', 'coder', 'analyst', 'tester', 
    'optimizer', 'architect', 'reviewer', 'monitor', 'specialist'
);

-- Agent status
CREATE TYPE agent_status_enum AS ENUM (
    'active', 'idle', 'busy', 'offline', 'error', 'terminated'
);

-- Relationship types
CREATE TYPE relationship_type_enum AS ENUM (
    'coordination', 'collaboration', 'supervision', 'delegation', 
    'knowledge_sharing', 'resource_sharing'
);

-- Execution strategies
CREATE TYPE execution_strategy_enum AS ENUM (
    'parallel', 'sequential', 'adaptive', 'balanced', 'priority_based'
);

-- Task priorities
CREATE TYPE task_priority_enum AS ENUM (
    'low', 'medium', 'high', 'critical', 'urgent'
);

-- Task status
CREATE TYPE task_status_enum AS ENUM (
    'pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled'
);

-- Cognitive patterns
CREATE TYPE cognitive_pattern_enum AS ENUM (
    'convergent', 'divergent', 'lateral', 'systems', 'critical', 'adaptive'
);

-- Memory access levels
CREATE TYPE memory_access_enum AS ENUM (
    'private', 'shared', 'public', 'restricted'
);

-- Coordination event types
CREATE TYPE coordination_event_enum AS ENUM (
    'message', 'task_assignment', 'status_update', 'heartbeat', 
    'coordination_request', 'resource_request', 'emergency'
);

-- Event priorities
CREATE TYPE event_priority_enum AS ENUM (
    'low', 'normal', 'high', 'urgent', 'critical'
);

-- Event status
CREATE TYPE event_status_enum AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'expired'
);

-- Performance metric types
CREATE TYPE performance_metric_enum AS ENUM (
    'response_time', 'throughput', 'efficiency', 'resource_usage',
    'coordination_latency', 'task_completion_rate', 'error_rate'
);

-- Health status
CREATE TYPE health_status_enum AS ENUM (
    'healthy', 'warning', 'critical', 'offline', 'recovering'
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Swarm networks indexes
CREATE INDEX IF NOT EXISTS idx_swarm_networks_status ON swarm_networks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_networks_topology ON swarm_networks(topology);
CREATE INDEX IF NOT EXISTS idx_swarm_networks_created_at ON swarm_networks(created_at);

-- Swarm sessions indexes
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_swarm_id ON swarm_sessions(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_network_id ON swarm_sessions(network_id);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_status ON swarm_sessions(status);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_namespace ON swarm_sessions(namespace);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_started_at ON swarm_sessions(started_at);

-- Swarm agents indexes
CREATE INDEX IF NOT EXISTS idx_swarm_agents_agent_id ON swarm_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_session_id ON swarm_agents(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_network_id ON swarm_agents(network_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_type ON swarm_agents(type);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_status ON swarm_agents(status);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_performance ON swarm_agents(performance_score);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_heartbeat ON swarm_agents(last_heartbeat);

-- Agent relationships indexes
CREATE INDEX IF NOT EXISTS idx_agent_relationships_source ON agent_relationships(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_target ON agent_relationships(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_type ON agent_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_strength ON agent_relationships(strength);

-- Swarm tasks indexes
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_task_id ON swarm_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_session_id ON swarm_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_network_id ON swarm_tasks(network_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status ON swarm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_priority ON swarm_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_created_at ON swarm_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_assigned_agents ON swarm_tasks USING GIN(assigned_agents);

-- Neural patterns indexes
CREATE INDEX IF NOT EXISTS idx_neural_patterns_agent_id ON neural_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_neural_patterns_type ON neural_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_neural_patterns_effectiveness ON neural_patterns(effectiveness_score);

-- Swarm memory indexes
CREATE INDEX IF NOT EXISTS idx_swarm_memory_key_namespace ON swarm_memory(key, namespace);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_session_id ON swarm_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_agent_id ON swarm_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_access_level ON swarm_memory(access_level);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_expires_at ON swarm_memory(expires_at);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_created_at ON swarm_memory(created_at);

-- Coordination events indexes
CREATE INDEX IF NOT EXISTS idx_coordination_events_session_id ON coordination_events(session_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_network_id ON coordination_events(network_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_source_agent ON coordination_events(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_target_agent ON coordination_events(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_type ON coordination_events(event_type);
CREATE INDEX IF NOT EXISTS idx_coordination_events_priority ON coordination_events(priority);
CREATE INDEX IF NOT EXISTS idx_coordination_events_status ON coordination_events(status);
CREATE INDEX IF NOT EXISTS idx_coordination_events_created_at ON coordination_events(created_at);
CREATE INDEX IF NOT EXISTS idx_coordination_events_correlation ON coordination_events(correlation_id);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_network_id ON performance_metrics(network_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_id ON performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_task_id ON performance_metrics(task_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);

-- Swarm health indexes
CREATE INDEX IF NOT EXISTS idx_swarm_health_session_id ON swarm_health(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_health_network_id ON swarm_health(network_id);
CREATE INDEX IF NOT EXISTS idx_swarm_health_agent_id ON swarm_health(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_health_score ON swarm_health(health_score);
CREATE INDEX IF NOT EXISTS idx_swarm_health_status ON swarm_health(status);
CREATE INDEX IF NOT EXISTS idx_swarm_health_last_check ON swarm_health(last_check);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_swarm_networks_updated_at BEFORE UPDATE ON swarm_networks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_neural_patterns_updated_at BEFORE UPDATE ON neural_patterns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarm_memory_updated_at BEFORE UPDATE ON swarm_memory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TTL cleanup function for swarm memory
CREATE OR REPLACE FUNCTION cleanup_expired_memory()
RETURNS void AS $$
BEGIN
    DELETE FROM swarm_memory 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- REAL-TIME SUBSCRIPTIONS SETUP
-- =============================================================================

-- Enable real-time for coordination
ALTER PUBLICATION supabase_realtime ADD TABLE swarm_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE swarm_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE swarm_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE coordination_events;
ALTER PUBLICATION supabase_realtime ADD TABLE performance_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE swarm_health;

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Calculate network health score
CREATE OR REPLACE FUNCTION calculate_network_health(network_uuid UUID)
RETURNS DECIMAL(5,4) AS $$
DECLARE
    avg_health DECIMAL(5,4);
BEGIN
    SELECT COALESCE(AVG(health_score), 0.0)
    INTO avg_health
    FROM swarm_health sh
    JOIN swarm_agents sa ON sh.agent_id = sa.id
    WHERE sa.network_id = network_uuid
    AND sh.last_check > NOW() - INTERVAL '5 minutes';
    
    RETURN LEAST(1.0, GREATEST(0.0, avg_health));
END;
$$ LANGUAGE plpgsql;

-- Get active agent count for network
CREATE OR REPLACE FUNCTION get_active_agent_count(network_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM swarm_agents
        WHERE network_id = network_uuid
        AND status = 'active'
        AND last_heartbeat > NOW() - INTERVAL '2 minutes'
    );
END;
$$ LANGUAGE plpgsql;

-- Calculate coordination efficiency
CREATE OR REPLACE FUNCTION calculate_coordination_efficiency(session_uuid UUID)
RETURNS DECIMAL(5,4) AS $$
DECLARE
    efficiency DECIMAL(5,4);
BEGIN
    SELECT COALESCE(
        (COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / 
         NULLIF(COUNT(*), 0)), 0.0
    )
    INTO efficiency
    FROM coordination_events
    WHERE session_id = session_uuid
    AND created_at > NOW() - INTERVAL '1 hour';
    
    RETURN LEAST(1.0, GREATEST(0.0, efficiency));
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE swarm_networks IS 'Central hub for swarm coordination with topology and strategy management';
COMMENT ON TABLE swarm_sessions IS 'Individual swarm instances with objectives and coordination algorithms';
COMMENT ON TABLE swarm_agents IS 'Individual intelligence units with capabilities and performance tracking';
COMMENT ON TABLE agent_relationships IS 'Coordination connections between agents with strength metrics';
COMMENT ON TABLE swarm_tasks IS 'Task management with orchestration and dependency tracking';
COMMENT ON TABLE neural_patterns IS 'Learning patterns and cognitive strategies for agents';
COMMENT ON TABLE swarm_memory IS 'Persistent memory bank with TTL and access control';
COMMENT ON TABLE coordination_events IS 'Real-time inter-agent messaging and coordination system';
COMMENT ON TABLE performance_metrics IS 'Comprehensive analytics and efficiency tracking';
COMMENT ON TABLE swarm_health IS 'Health monitoring with diagnostics and alerting';