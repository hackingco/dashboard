-- PostgreSQL initialization script for Langfuse
-- This script creates the necessary user and database for Langfuse

-- Create langfuse user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'langfuse') THEN
      CREATE USER langfuse WITH PASSWORD 'langfuse_password';
   END IF;
END
$do$;

-- Create langfuse database if not exists
SELECT 'CREATE DATABASE langfuse OWNER langfuse'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'langfuse')\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE langfuse TO langfuse;

-- Connect to langfuse database and set up extensions
\c langfuse

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO langfuse;
GRANT CREATE ON SCHEMA public TO langfuse;