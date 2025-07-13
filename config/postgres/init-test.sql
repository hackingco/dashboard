-- PostgreSQL initialization script for Test Environment
-- This script sets up a clean database for Langfuse testing

-- Set timezone
SET timezone = 'UTC';

-- Create extensions that Langfuse needs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create the langfuse database user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'langfuse') THEN
        CREATE ROLE langfuse WITH LOGIN PASSWORD 'langfuse_secret';
    END IF;
END
$$;

-- Grant necessary permissions to langfuse user
GRANT ALL PRIVILEGES ON DATABASE langfuse TO langfuse;
ALTER USER langfuse CREATEDB;

-- Create a monitoring user for health checks
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'langfuse_monitor') THEN
        CREATE ROLE langfuse_monitor WITH LOGIN PASSWORD 'monitor_password';
    END IF;
END
$$;

-- Grant read-only access for monitoring
GRANT CONNECT ON DATABASE langfuse TO langfuse_monitor;
GRANT USAGE ON SCHEMA public TO langfuse_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO langfuse_monitor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO langfuse_monitor;

-- Create a coordination table for swarm testing
CREATE TABLE IF NOT EXISTS swarm_test_coordination (
    id SERIAL PRIMARY KEY,
    swarm_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    test_session VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient testing
CREATE INDEX IF NOT EXISTS idx_test_coordination_swarm_id ON swarm_test_coordination(swarm_id);
CREATE INDEX IF NOT EXISTS idx_test_coordination_agent_id ON swarm_test_coordination(agent_id);
CREATE INDEX IF NOT EXISTS idx_test_coordination_session ON swarm_test_coordination(test_session);
CREATE INDEX IF NOT EXISTS idx_test_coordination_created_at ON swarm_test_coordination(created_at);

-- Log successful test database initialization
INSERT INTO swarm_test_coordination (swarm_id, agent_id, test_session, event_type, event_data)
VALUES (
    'test-system', 
    'postgres-init', 
    'test-init-session',
    'database_initialized',
    json_build_object(
        'action', 'test_database_initialized',
        'timestamp', NOW(),
        'version', '1.0.0',
        'purpose', 'langfuse_wrapper_testing'
    )
);

-- Create a function to clean test data
CREATE OR REPLACE FUNCTION clean_test_data(test_session_prefix VARCHAR DEFAULT 'test-%')
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM swarm_test_coordination 
    WHERE test_session LIKE test_session_prefix;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for test cleanup
GRANT EXECUTE ON FUNCTION clean_test_data(VARCHAR) TO langfuse;
GRANT EXECUTE ON FUNCTION clean_test_data(VARCHAR) TO langfuse_monitor;