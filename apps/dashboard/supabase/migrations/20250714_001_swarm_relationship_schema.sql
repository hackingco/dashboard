-- =====================================================================================
-- Swarm Relationship Schema Migration for Enhanced Dashboard
-- Version: 20250714_001
-- Author: Schema Developer Agent
-- Description: Complete swarm relationship schema with observability integration
-- =====================================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =====================================================================================
-- CORE SWARM RELATIONSHIP TABLES
-- =====================================================================================

-- Swarm Networks table - Central coordination hub
CREATE TABLE IF NOT EXISTS public.swarm_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    topology VARCHAR(50) NOT NULL CHECK (topology IN ('mesh', 'hierarchical', 'ring', 'star')),
    strategy VARCHAR(50) NOT NULL DEFAULT 'adaptive' CHECK (strategy IN ('balanced', 'specialized', 'adaptive')),
    max_agents INTEGER NOT NULL DEFAULT 8,
    current_agents INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'initializing' CHECK (status IN ('initializing', 'active', 'scaling', 'paused', 'error', 'terminated')),
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID
);

-- Swarm Agents table - Individual intelligence units
CREATE TABLE IF NOT EXISTS public.swarm_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES public.swarm_networks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL CHECK (type IN ('coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist')),
    status VARCHAR(50) NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'busy', 'error', 'offline', 'spawning')),
    capabilities JSONB DEFAULT '[]',
    current_task TEXT,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    average_response_time REAL DEFAULT 0,
    memory_usage REAL DEFAULT 0,
    cpu_usage REAL DEFAULT 0,
    efficiency_score REAL DEFAULT 0,
    coordination_weight REAL DEFAULT 1.0,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    spawn_config JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Relationships table - Coordination connections
CREATE TABLE IF NOT EXISTS public.agent_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_agent_id UUID NOT NULL REFERENCES public.swarm_agents(id) ON DELETE CASCADE,
    target_agent_id UUID NOT NULL REFERENCES public.swarm_agents(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('coordination', 'supervision', 'collaboration', 'dependency', 'conflict', 'backup')),
    strength REAL DEFAULT 1.0 CHECK (strength >= 0 AND strength <= 1),
    communication_protocol VARCHAR(50) DEFAULT 'hooks',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'broken', 'terminated')),
    metrics JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_agent_id, target_agent_id, relationship_type)
);

-- Task Orchestration table
CREATE TABLE IF NOT EXISTS public.task_orchestration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES public.swarm_networks(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    strategy VARCHAR(50) NOT NULL DEFAULT 'adaptive' CHECK (strategy IN ('parallel', 'sequential', 'adaptive', 'balanced')),
    priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    assigned_agents UUID[] DEFAULT '{}',
    dependencies UUID[] DEFAULT '{}',
    max_parallel_agents INTEGER DEFAULT 3,
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    progress_percentage REAL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    estimated_duration INTEGER, -- in seconds
    actual_duration INTEGER, -- in seconds
    error_details TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Neural Patterns table - Learning and adaptation
CREATE TABLE IF NOT EXISTS public.neural_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES public.swarm_networks(id) ON DELETE CASCADE,
    pattern_type VARCHAR(100) NOT NULL CHECK (pattern_type IN ('convergent', 'divergent', 'lateral', 'systems', 'critical', 'adaptive', 'coordination', 'optimization', 'prediction')),
    pattern_data JSONB NOT NULL DEFAULT '{}',
    effectiveness_score REAL DEFAULT 0 CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
    usage_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 1),
    training_data JSONB DEFAULT '{}',
    model_version VARCHAR(50) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    learned_from_task_id UUID REFERENCES public.task_orchestration(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Swarm Memory Bank - Persistent coordination memory
CREATE TABLE IF NOT EXISTS public.swarm_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES public.swarm_networks(id) ON DELETE CASCADE,
    memory_key VARCHAR(255) NOT NULL,
    memory_namespace VARCHAR(100) NOT NULL DEFAULT 'default',
    memory_value JSONB NOT NULL,
    memory_type VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (memory_type IN ('general', 'coordination', 'task', 'performance', 'learning', 'error', 'config')),
    access_count INTEGER DEFAULT 0,
    ttl_seconds INTEGER, -- Time to live in seconds
    expires_at TIMESTAMPTZ,
    priority INTEGER DEFAULT 0,
    is_encrypted BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    created_by_agent_id UUID REFERENCES public.swarm_agents(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(network_id, memory_namespace, memory_key)
);

-- =====================================================================================
-- OBSERVABILITY AND MONITORING TABLES
-- =====================================================================================

-- Real-time Coordination Events
CREATE TABLE IF NOT EXISTS public.coordination_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES public.swarm_networks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.swarm_agents(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL DEFAULT 'coordination' CHECK (event_category IN ('coordination', 'communication', 'task', 'error', 'performance', 'lifecycle')),
    event_data JSONB NOT NULL DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    source VARCHAR(100),
    target VARCHAR(100),
    correlation_id UUID,
    trace_id UUID,
    span_id UUID,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Metrics Aggregation
CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES public.swarm_networks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.swarm_agents(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL DEFAULT 'performance' CHECK (metric_category IN ('performance', 'efficiency', 'coordination', 'resource', 'quality', 'throughput')),
    metric_value NUMERIC NOT NULL,
    unit VARCHAR(50),
    aggregation_type VARCHAR(20) DEFAULT 'instant' CHECK (aggregation_type IN ('instant', 'avg', 'sum', 'min', 'max', 'count')),
    time_window_seconds INTEGER DEFAULT 0,
    tags JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health Monitoring
CREATE TABLE IF NOT EXISTS public.health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    network_id UUID NOT NULL REFERENCES public.swarm_networks(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.swarm_agents(id) ON DELETE SET NULL,
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('heartbeat', 'resource', 'connectivity', 'performance', 'coordination', 'task_capacity')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'error', 'critical', 'unknown')),
    check_data JSONB DEFAULT '{}',
    error_message TEXT,
    response_time_ms INTEGER,
    threshold_values JSONB DEFAULT '{}',
    remediation_actions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- PERFORMANCE INDEXES
-- =====================================================================================

-- Swarm Networks indexes
CREATE INDEX IF NOT EXISTS idx_swarm_networks_status ON public.swarm_networks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_networks_topology ON public.swarm_networks(topology);
CREATE INDEX IF NOT EXISTS idx_swarm_networks_created_at ON public.swarm_networks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swarm_networks_org_id ON public.swarm_networks(organization_id);

-- Swarm Agents indexes
CREATE INDEX IF NOT EXISTS idx_swarm_agents_network_id ON public.swarm_agents(network_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_status ON public.swarm_agents(status);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_type ON public.swarm_agents(type);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_activity ON public.swarm_agents(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_heartbeat ON public.swarm_agents(last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_capabilities ON public.swarm_agents USING GIN (capabilities);

-- Agent Relationships indexes
CREATE INDEX IF NOT EXISTS idx_agent_relationships_source ON public.agent_relationships(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_target ON public.agent_relationships(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_type ON public.agent_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_agent_relationships_status ON public.agent_relationships(status);

-- Task Orchestration indexes
CREATE INDEX IF NOT EXISTS idx_task_orchestration_network_id ON public.task_orchestration(network_id);
CREATE INDEX IF NOT EXISTS idx_task_orchestration_status ON public.task_orchestration(status);
CREATE INDEX IF NOT EXISTS idx_task_orchestration_priority ON public.task_orchestration(priority);
CREATE INDEX IF NOT EXISTS idx_task_orchestration_assigned_agents ON public.task_orchestration USING GIN (assigned_agents);
CREATE INDEX IF NOT EXISTS idx_task_orchestration_created_at ON public.task_orchestration(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_orchestration_deadline ON public.task_orchestration(deadline);

-- Neural Patterns indexes
CREATE INDEX IF NOT EXISTS idx_neural_patterns_network_id ON public.neural_patterns(network_id);
CREATE INDEX IF NOT EXISTS idx_neural_patterns_type ON public.neural_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_neural_patterns_effectiveness ON public.neural_patterns(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_neural_patterns_active ON public.neural_patterns(is_active);

-- Swarm Memory indexes
CREATE INDEX IF NOT EXISTS idx_swarm_memory_network_id ON public.swarm_memory(network_id);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_namespace ON public.swarm_memory(memory_namespace);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_key ON public.swarm_memory(memory_key);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_type ON public.swarm_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_expires_at ON public.swarm_memory(expires_at);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_tags ON public.swarm_memory USING GIN (tags);

-- Coordination Events indexes
CREATE INDEX IF NOT EXISTS idx_coordination_events_network_id ON public.coordination_events(network_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_agent_id ON public.coordination_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_type ON public.coordination_events(event_type);
CREATE INDEX IF NOT EXISTS idx_coordination_events_category ON public.coordination_events(event_category);
CREATE INDEX IF NOT EXISTS idx_coordination_events_created_at ON public.coordination_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coordination_events_correlation ON public.coordination_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_coordination_events_trace_id ON public.coordination_events(trace_id);

-- Performance Metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_network_id ON public.performance_metrics(network_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_id ON public.performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON public.performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_category ON public.performance_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);

-- Health Checks indexes
CREATE INDEX IF NOT EXISTS idx_health_checks_network_id ON public.health_checks(network_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_agent_id ON public.health_checks(agent_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_type ON public.health_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON public.health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_created_at ON public.health_checks(created_at DESC);

-- =====================================================================================
-- TRIGGER FUNCTIONS AND AUTOMATION
-- =====================================================================================

-- Updated timestamp trigger (reuse existing function)
CREATE TRIGGER update_swarm_networks_updated_at BEFORE UPDATE ON public.swarm_networks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_swarm_agents_updated_at BEFORE UPDATE ON public.swarm_agents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_agent_relationships_updated_at BEFORE UPDATE ON public.agent_relationships
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_task_orchestration_updated_at BEFORE UPDATE ON public.task_orchestration
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_neural_patterns_updated_at BEFORE UPDATE ON public.neural_patterns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_swarm_memory_updated_at BEFORE UPDATE ON public.swarm_memory
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-cleanup trigger for expired memory
CREATE OR REPLACE FUNCTION public.cleanup_expired_memory()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.swarm_memory 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- TTL management trigger for memory
CREATE OR REPLACE FUNCTION public.manage_memory_ttl()
RETURNS TRIGGER AS $$
BEGIN
    -- Set expires_at if ttl_seconds is provided
    IF NEW.ttl_seconds IS NOT NULL THEN
        NEW.expires_at = NOW() + (NEW.ttl_seconds || ' seconds')::INTERVAL;
    END IF;
    
    -- Increment access count on updates
    IF TG_OP = 'UPDATE' AND OLD.memory_value IS DISTINCT FROM NEW.memory_value THEN
        NEW.access_count = OLD.access_count + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manage_swarm_memory_ttl BEFORE INSERT OR UPDATE ON public.swarm_memory
    FOR EACH ROW EXECUTE FUNCTION public.manage_memory_ttl();

-- Network agent count management
CREATE OR REPLACE FUNCTION public.update_network_agent_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.swarm_networks 
        SET current_agents = current_agents + 1 
        WHERE id = NEW.network_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.swarm_networks 
        SET current_agents = GREATEST(current_agents - 1, 0) 
        WHERE id = OLD.network_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_network_agent_count_trigger
    AFTER INSERT OR DELETE ON public.swarm_agents
    FOR EACH ROW EXECUTE FUNCTION public.update_network_agent_count();

-- Comments for documentation
COMMENT ON TABLE public.swarm_networks IS 'Central coordination hub for swarm intelligence networks';
COMMENT ON TABLE public.swarm_agents IS 'Individual intelligent agents within swarm networks';
COMMENT ON TABLE public.agent_relationships IS 'Coordination relationships between agents';
COMMENT ON TABLE public.task_orchestration IS 'Task management and orchestration across swarm networks';
COMMENT ON TABLE public.neural_patterns IS 'Learning patterns and adaptation algorithms';
COMMENT ON TABLE public.swarm_memory IS 'Persistent memory bank for swarm coordination';
COMMENT ON TABLE public.coordination_events IS 'Real-time coordination and communication events';
COMMENT ON TABLE public.performance_metrics IS 'Performance metrics aggregation for monitoring';
COMMENT ON TABLE public.health_checks IS 'Health monitoring and system diagnostics';