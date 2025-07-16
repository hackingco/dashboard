-- PostgreSQL initialization script for Swarm services
-- Built by Builder-2 Agent for Enterprise Swarm Platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create swarm database schema
\c swarm;

-- Swarm agents table
CREATE TABLE IF NOT EXISTS swarm_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'idle',
    capabilities JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Swarm tasks table
CREATE TABLE IF NOT EXISTS swarm_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    assigned_agent_id UUID REFERENCES swarm_agents(id),
    result JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Swarm coordination table
CREATE TABLE IF NOT EXISTS swarm_coordination (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL,
    agent_id UUID REFERENCES swarm_agents(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Langfuse traces table
CREATE TABLE IF NOT EXISTS langfuse_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    name VARCHAR(255),
    user_id VARCHAR(255),
    input JSONB,
    output JSONB,
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    release VARCHAR(100),
    version VARCHAR(100),
    public BOOLEAN DEFAULT FALSE,
    bookmarked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Langfuse observations table
CREATE TABLE IF NOT EXISTS langfuse_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(255) NOT NULL,
    parent_observation_id UUID,
    type VARCHAR(50) NOT NULL, -- 'SPAN', 'GENERATION', 'EVENT'
    name VARCHAR(255),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    completion_start_time TIMESTAMP WITH TIME ZONE,
    model VARCHAR(255),
    model_parameters JSONB,
    input JSONB,
    output JSONB,
    usage JSONB,
    level VARCHAR(20), -- 'DEBUG', 'DEFAULT', 'WARNING', 'ERROR'
    status_message TEXT,
    version VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    metric_unit VARCHAR(50),
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_swarm_agents_status ON swarm_agents(status);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_type ON swarm_agents(type);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_last_ping ON swarm_agents(last_ping);

CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status ON swarm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_priority ON swarm_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_assigned_agent ON swarm_tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_created_at ON swarm_tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_swarm_coordination_session ON swarm_coordination(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_coordination_agent ON swarm_coordination(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_coordination_event_type ON swarm_coordination(event_type);
CREATE INDEX IF NOT EXISTS idx_swarm_coordination_created_at ON swarm_coordination(created_at);

CREATE INDEX IF NOT EXISTS idx_langfuse_traces_trace_id ON langfuse_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_langfuse_traces_session_id ON langfuse_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_langfuse_traces_created_at ON langfuse_traces(created_at);

CREATE INDEX IF NOT EXISTS idx_langfuse_observations_trace_id ON langfuse_observations(trace_id);
CREATE INDEX IF NOT EXISTS idx_langfuse_observations_parent_id ON langfuse_observations(parent_observation_id);
CREATE INDEX IF NOT EXISTS idx_langfuse_observations_type ON langfuse_observations(type);
CREATE INDEX IF NOT EXISTS idx_langfuse_observations_start_time ON langfuse_observations(start_time);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_service ON performance_metrics(service_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_swarm_agents_updated_at BEFORE UPDATE ON swarm_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_swarm_tasks_updated_at BEFORE UPDATE ON swarm_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_langfuse_traces_updated_at BEFORE UPDATE ON langfuse_traces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_langfuse_observations_updated_at BEFORE UPDATE ON langfuse_observations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO swarm_agents (name, type, status, capabilities) VALUES
('Manager-Agent', 'manager', 'active', '["coordination", "task_distribution", "monitoring"]'),
('Worker-Agent-1', 'worker', 'idle', '["task_execution", "data_processing"]'),
('Worker-Agent-2', 'worker', 'idle', '["task_execution", "computation"]')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO swarm;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO swarm;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO swarm;

-- Create a read-only user for monitoring
CREATE USER swarm_readonly WITH PASSWORD 'readonly123';
GRANT CONNECT ON DATABASE swarm TO swarm_readonly;
GRANT USAGE ON SCHEMA public TO swarm_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO swarm_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO swarm_readonly;