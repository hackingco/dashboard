-- Clean PostgreSQL initialization for Langfuse Testing
-- This script sets up only what Langfuse needs without interfering with migrations

-- Set timezone
SET timezone = 'UTC';

-- Create extensions that Langfuse might need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Ensure the langfuse user exists and has proper permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'langfuse') THEN
        CREATE ROLE langfuse WITH LOGIN PASSWORD 'langfuse_secret';
    END IF;
END
$$;

-- Grant all privileges to langfuse user
GRANT ALL PRIVILEGES ON DATABASE langfuse TO langfuse;
ALTER USER langfuse CREATEDB;
ALTER USER langfuse SUPERUSER;

-- Create a monitoring user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'langfuse_monitor') THEN
        CREATE ROLE langfuse_monitor WITH LOGIN PASSWORD 'monitor_password';
    END IF;
END
$$;

-- Grant read access for monitoring
GRANT CONNECT ON DATABASE langfuse TO langfuse_monitor;
GRANT USAGE ON SCHEMA public TO langfuse_monitor;