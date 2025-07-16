-- Create Langfuse Database
-- This script prepares the langfuse database for Langfuse service

-- Connect to langfuse database
\c langfuse;

-- Enable required extensions for Langfuse
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create langfuse application user
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'langfuse') THEN
        CREATE ROLE langfuse WITH LOGIN PASSWORD 'langfuse_password';
    END IF;
END
$$;

-- Grant permissions to langfuse user
GRANT CONNECT ON DATABASE langfuse TO langfuse;
GRANT USAGE ON SCHEMA public TO langfuse;
GRANT CREATE ON SCHEMA public TO langfuse;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO langfuse;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO langfuse;

-- Create initial configuration table for Claude Flow integration
CREATE TABLE IF NOT EXISTS claude_flow_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Claude Flow integration configuration
INSERT INTO claude_flow_config (config_key, config_value) VALUES
('swarm_integration', '{"enabled": true, "trace_swarm_agents": true, "batch_size": 1000}'),
('performance_settings', '{"cache_ttl": 3600, "flush_interval": 5000, "max_batch_size": 1000}'),
('feature_flags', '{"experimental_features": true, "real_time_tracing": true, "agent_coordination": true}')
ON CONFLICT (config_key) DO NOTHING;