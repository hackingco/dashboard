-- Initialize Swarm Core Database
-- This script sets up the base database structure for Claude Flow

-- Create core databases if they don't exist
SELECT 'CREATE DATABASE swarm_core' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'swarm_core')\gexec
SELECT 'CREATE DATABASE langfuse' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'langfuse')\gexec
SELECT 'CREATE DATABASE grafana' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'grafana')\gexec

-- Connect to swarm_core database
\c swarm_core;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create core tables for swarm coordination
CREATE TABLE IF NOT EXISTS swarm_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swarm_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    agent_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    capabilities JSONB,
    metadata JSONB,
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swarm_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_agent_id UUID REFERENCES swarm_agents(id) ON DELETE SET NULL,
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    task_data JSONB,
    result_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swarm_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_key VARCHAR(500) NOT NULL,
    memory_value JSONB,
    memory_type VARCHAR(100) DEFAULT 'general',
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(memory_key, session_id)
);

CREATE TABLE IF NOT EXISTS swarm_coordination (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coordination_id VARCHAR(255) UNIQUE NOT NULL,
    topology VARCHAR(50) DEFAULT 'mesh',
    max_agents INTEGER DEFAULT 10,
    coordination_data JSONB,
    status VARCHAR(50) DEFAULT 'active',
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swarm_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC,
    metric_type VARCHAR(100),
    tags JSONB,
    session_id UUID REFERENCES swarm_sessions(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_session_id ON swarm_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_expires_at ON swarm_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_swarm_agents_agent_id ON swarm_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_status ON swarm_agents(status);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_session_id ON swarm_agents(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_last_heartbeat ON swarm_agents(last_heartbeat);

CREATE INDEX IF NOT EXISTS idx_swarm_tasks_task_id ON swarm_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status ON swarm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_session_id ON swarm_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_assigned_agent_id ON swarm_tasks(assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_swarm_memory_key_session ON swarm_memory(memory_key, session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_expires_at ON swarm_memory(expires_at);
CREATE INDEX IF NOT EXISTS idx_swarm_memory_type ON swarm_memory(memory_type);

CREATE INDEX IF NOT EXISTS idx_swarm_coordination_session_id ON swarm_coordination(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_coordination_status ON swarm_coordination(status);

CREATE INDEX IF NOT EXISTS idx_swarm_metrics_session_agent ON swarm_metrics(session_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_metrics_recorded_at ON swarm_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_swarm_metrics_name ON swarm_metrics(metric_name);

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_swarm_sessions_updated_at 
    BEFORE UPDATE ON swarm_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarm_agents_updated_at 
    BEFORE UPDATE ON swarm_agents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarm_tasks_updated_at 
    BEFORE UPDATE ON swarm_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarm_memory_updated_at 
    BEFORE UPDATE ON swarm_memory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarm_coordination_updated_at 
    BEFORE UPDATE ON swarm_coordination 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW active_agents AS
SELECT 
    a.*,
    s.session_id as session_identifier,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.last_heartbeat)) as seconds_since_heartbeat
FROM swarm_agents a
JOIN swarm_sessions s ON a.session_id = s.id
WHERE a.status = 'active' 
AND s.expires_at > CURRENT_TIMESTAMP;

CREATE OR REPLACE VIEW pending_tasks AS
SELECT 
    t.*,
    s.session_id as session_identifier,
    a.agent_id,
    a.agent_type
FROM swarm_tasks t
JOIN swarm_sessions s ON t.session_id = s.id
LEFT JOIN swarm_agents a ON t.assigned_agent_id = a.id
WHERE t.status = 'pending'
ORDER BY 
    CASE t.priority 
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
    END,
    t.created_at;

-- Create function for cleanup of expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete expired sessions and cascade to related data
    DELETE FROM swarm_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete expired memory entries
    DELETE FROM swarm_memory WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete old metrics (keep last 30 days)
    DELETE FROM swarm_metrics WHERE recorded_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to application user
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'swarm_app') THEN
        CREATE ROLE swarm_app WITH LOGIN PASSWORD 'swarm_app_password';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE swarm_core TO swarm_app;
GRANT USAGE ON SCHEMA public TO swarm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO swarm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO swarm_app;
GRANT EXECUTE ON FUNCTION cleanup_expired_data() TO swarm_app;

-- Insert initial coordination record
INSERT INTO swarm_coordination (coordination_id, topology, max_agents, status, coordination_data)
VALUES (
    'default-coordination',
    'mesh',
    20,
    'active',
    '{"created_by": "init_script", "version": "1.0", "features": ["memory", "agents", "tasks"]}'::jsonb
) ON CONFLICT (coordination_id) DO NOTHING;