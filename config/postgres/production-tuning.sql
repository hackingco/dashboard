-- PostgreSQL production tuning for Langfuse and Swarm coordination
-- This script optimizes PostgreSQL for production workloads

-- Memory Settings
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '1536MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Connection Settings
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET superuser_reserved_connections = 3;

-- Checkpoint Settings
ALTER SYSTEM SET checkpoint_timeout = '15min';
ALTER SYSTEM SET max_wal_size = '2GB';
ALTER SYSTEM SET min_wal_size = '80MB';

-- Logging Settings
ALTER SYSTEM SET log_destination = 'stderr';
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = 'log';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = 1440;  -- 1 day
ALTER SYSTEM SET log_rotation_size = 100000;  -- 100MB
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log slow queries (1s+)
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_statement = 'mod';  -- Log data-modifying statements
ALTER SYSTEM SET log_temp_files = 10240;  -- Log temp files > 10MB

-- Performance Settings
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 3;
ALTER SYSTEM SET autovacuum_naptime = 60;  -- 1 minute
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET track_io_timing = on;

-- Security Settings
ALTER SYSTEM SET ssl = off;  -- Handled by Docker network
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Langfuse specific optimizations
-- Create indexes for common Langfuse queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_timestamp 
  ON traces(timestamp DESC) WHERE timestamp IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_trace_id 
  ON observations(trace_id) WHERE trace_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scores_trace_id 
  ON scores(trace_id) WHERE trace_id IS NOT NULL;

-- Swarm coordination optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swarm_coordination_created_at 
  ON swarm_coordination(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_swarm_coordination_metadata_gin 
  ON swarm_coordination USING gin(metadata);

-- Create materialized view for swarm metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS swarm_metrics_summary AS
SELECT 
    swarm_id,
    COUNT(DISTINCT agent_id) as agent_count,
    COUNT(*) as total_actions,
    MAX(created_at) as last_activity,
    jsonb_object_agg(agent_id, COUNT(*)) as agent_activity
FROM swarm_coordination 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY swarm_id;

CREATE UNIQUE INDEX ON swarm_metrics_summary(swarm_id);

-- Function to refresh metrics (called by cron or trigger)
CREATE OR REPLACE FUNCTION refresh_swarm_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY swarm_metrics_summary;
END;
$$ LANGUAGE plpgsql;

-- Auto-refresh metrics every 5 minutes
-- Note: This requires pg_cron extension in production
-- SELECT cron.schedule('refresh-swarm-metrics', '*/5 * * * *', 'SELECT refresh_swarm_metrics();');

-- Create function for swarm health monitoring
CREATE OR REPLACE FUNCTION swarm_health_check(swarm_id_param text)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'swarm_id', swarm_id_param,
        'status', CASE 
            WHEN MAX(created_at) > NOW() - INTERVAL '5 minutes' THEN 'active'
            WHEN MAX(created_at) > NOW() - INTERVAL '1 hour' THEN 'idle'
            ELSE 'inactive'
        END,
        'agent_count', COUNT(DISTINCT agent_id),
        'last_activity', MAX(created_at),
        'total_actions_24h', COUNT(*)
    ) INTO result
    FROM swarm_coordination 
    WHERE swarm_id = swarm_id_param 
      AND created_at > NOW() - INTERVAL '24 hours';
    
    RETURN COALESCE(result, '{"status": "not_found"}'::json);
END;
$$ LANGUAGE plpgsql;

-- Create function for agent performance metrics
CREATE OR REPLACE FUNCTION agent_performance_metrics(agent_id_param text, hours_back int DEFAULT 24)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'agent_id', agent_id_param,
        'actions_count', COUNT(*),
        'first_action', MIN(created_at),
        'last_action', MAX(created_at),
        'avg_actions_per_hour', ROUND(COUNT(*)::decimal / GREATEST(EXTRACT(epoch FROM (MAX(created_at) - MIN(created_at))) / 3600, 1), 2),
        'metadata_summary', json_agg(DISTINCT metadata->'action') FILTER (WHERE metadata ? 'action')
    ) INTO result
    FROM swarm_coordination 
    WHERE agent_id = agent_id_param 
      AND created_at > NOW() - (hours_back || ' hours')::interval;
    
    RETURN COALESCE(result, '{"status": "no_data"}'::json);
END;
$$ LANGUAGE plpgsql;

-- Apply configuration
SELECT pg_reload_conf();

-- Log the tuning application
INSERT INTO swarm_coordination (swarm_id, agent_id, session_id, metadata)
VALUES ('system', 'postgres-tuning', 'production-init', json_build_object(
    'action', 'production_tuning_applied',
    'timestamp', NOW(),
    'settings_applied', json_build_object(
        'shared_buffers', '512MB',
        'effective_cache_size', '1536MB',
        'max_connections', 200,
        'checkpoint_timeout', '15min'
    )
));

COMMIT;