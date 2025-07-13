-- PostgreSQL initialization script for Langfuse
-- This script sets up the initial database configuration for Langfuse

-- Create the langfuse database if it doesn't exist
-- (Note: This is handled by POSTGRES_DB env var, but keeping for completeness)

-- Set timezone
SET timezone = 'UTC';

-- Create extensions that might be needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create a user for application monitoring (optional)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'langfuse_monitor') THEN
        CREATE ROLE langfuse_monitor WITH LOGIN PASSWORD 'monitor_password';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE langfuse TO langfuse_monitor;
GRANT USAGE ON SCHEMA public TO langfuse_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO langfuse_monitor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO langfuse_monitor;

-- Create a table for swarm coordination metadata (if needed)
CREATE TABLE IF NOT EXISTS swarm_coordination (
    id SERIAL PRIMARY KEY,
    swarm_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_swarm_coordination_swarm_id ON swarm_coordination(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_coordination_agent_id ON swarm_coordination(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_coordination_session_id ON swarm_coordination(session_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp update
CREATE TRIGGER update_swarm_coordination_updated_at
    BEFORE UPDATE ON swarm_coordination
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Log successful initialization
INSERT INTO swarm_coordination (swarm_id, agent_id, session_id, metadata)
VALUES ('system', 'postgres-init', 'init-session', '{"action": "database_initialized", "timestamp": "' || NOW() || '"}')
ON CONFLICT DO NOTHING;