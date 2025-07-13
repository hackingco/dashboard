-- Migration: Add deployment monitoring and observability tables
-- Purpose: Support automated deployment monitoring, health checks, and rollback capabilities

-- Deployment metrics table for tracking deployment performance
CREATE TABLE IF NOT EXISTS deployment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL UNIQUE,
    service_name TEXT NOT NULL,
    version TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'production',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    final_status TEXT CHECK (final_status IN ('deploying', 'healthy', 'degraded', 'failed', 'rolled_back')),
    total_health_checks INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.0,
    error_count INTEGER DEFAULT 0,
    rollback_triggered BOOLEAN DEFAULT FALSE,
    rollback_reason TEXT,
    github_run_id TEXT,
    commit_hash TEXT,
    metrics_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Observability correlations table for cross-service tracking
CREATE TABLE IF NOT EXISTS observability_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT NOT NULL UNIQUE,
    swarm_id TEXT NOT NULL,
    langfuse_trace_id TEXT,
    operation_type TEXT NOT NULL,
    operation_status TEXT DEFAULT 'in_progress' CHECK (operation_status IN ('in_progress', 'completed', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_duration_ms INTEGER,
    total_api_calls INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health check results table for detailed health monitoring
CREATE TABLE IF NOT EXISTS health_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL,
    endpoint_name TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    response_details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployment alerts table for tracking alerts and notifications
CREATE TABLE IF NOT EXISTS deployment_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('health_check', 'performance', 'error_rate', 'rollback')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metric_name TEXT,
    current_value DECIMAL(12,4),
    threshold_value DECIMAL(12,4),
    action_required TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Machine state sync table for Fly.io machine tracking
CREATE TABLE IF NOT EXISTS machine_state_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    swarm_id TEXT,
    region TEXT NOT NULL,
    state TEXT NOT NULL,
    cpus INTEGER,
    memory_mb INTEGER,
    disk_size_gb INTEGER,
    private_ip INET,
    image_ref TEXT,
    instance_id TEXT,
    host_status TEXT,
    checks JSONB DEFAULT '[]',
    events JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Create unique constraint on machine_id
    CONSTRAINT unique_machine_id UNIQUE(machine_id)
);

-- Rollback history table for tracking rollback events
CREATE TABLE IF NOT EXISTS rollback_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    rollback_type TEXT NOT NULL CHECK (rollback_type IN ('automatic', 'manual')),
    triggered_by TEXT, -- user_id or 'system' for automatic
    reason TEXT NOT NULL,
    source_version TEXT,
    target_version TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    rollback_duration_ms INTEGER,
    verification_passed BOOLEAN DEFAULT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deployment_metrics_deployment_id ON deployment_metrics(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_metrics_service_env ON deployment_metrics(service_name, environment);
CREATE INDEX IF NOT EXISTS idx_deployment_metrics_status ON deployment_metrics(final_status);
CREATE INDEX IF NOT EXISTS idx_deployment_metrics_started_at ON deployment_metrics(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_observability_correlations_correlation_id ON observability_correlations(correlation_id);
CREATE INDEX IF NOT EXISTS idx_observability_correlations_swarm_id ON observability_correlations(swarm_id);
CREATE INDEX IF NOT EXISTS idx_observability_correlations_operation_type ON observability_correlations(operation_type);
CREATE INDEX IF NOT EXISTS idx_observability_correlations_status ON observability_correlations(operation_status);

CREATE INDEX IF NOT EXISTS idx_health_check_results_deployment_id ON health_check_results(deployment_id);
CREATE INDEX IF NOT EXISTS idx_health_check_results_timestamp ON health_check_results(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_check_results_success ON health_check_results(success);

CREATE INDEX IF NOT EXISTS idx_deployment_alerts_deployment_id ON deployment_alerts(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_alerts_severity ON deployment_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_deployment_alerts_acknowledged ON deployment_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_deployment_alerts_resolved ON deployment_alerts(resolved);

CREATE INDEX IF NOT EXISTS idx_machine_state_sync_machine_id ON machine_state_sync(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_state_sync_app_name ON machine_state_sync(app_name);
CREATE INDEX IF NOT EXISTS idx_machine_state_sync_swarm_id ON machine_state_sync(swarm_id);
CREATE INDEX IF NOT EXISTS idx_machine_state_sync_state ON machine_state_sync(state);
CREATE INDEX IF NOT EXISTS idx_machine_state_sync_last_updated ON machine_state_sync(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_rollback_history_deployment_id ON rollback_history(deployment_id);
CREATE INDEX IF NOT EXISTS idx_rollback_history_service_name ON rollback_history(service_name);
CREATE INDEX IF NOT EXISTS idx_rollback_history_rollback_type ON rollback_history(rollback_type);
CREATE INDEX IF NOT EXISTS idx_rollback_history_success ON rollback_history(success);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_deployment_metrics_updated_at BEFORE UPDATE ON deployment_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_observability_correlations_updated_at BEFORE UPDATE ON observability_correlations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies for secure access
ALTER TABLE deployment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_state_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollback_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own data
CREATE POLICY "Users can read deployment metrics" ON deployment_metrics
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert deployment metrics" ON deployment_metrics
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update deployment metrics" ON deployment_metrics
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read observability correlations" ON observability_correlations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert observability correlations" ON observability_correlations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update observability correlations" ON observability_correlations
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read health check results" ON health_check_results
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert health check results" ON health_check_results
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read deployment alerts" ON deployment_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert deployment alerts" ON deployment_alerts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update deployment alerts" ON deployment_alerts
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read machine state sync" ON machine_state_sync
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert machine state sync" ON machine_state_sync
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update machine state sync" ON machine_state_sync
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read rollback history" ON rollback_history
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert rollback history" ON rollback_history
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create views for common queries
CREATE OR REPLACE VIEW deployment_summary AS
SELECT 
    dm.deployment_id,
    dm.service_name,
    dm.version,
    dm.environment,
    dm.started_at,
    dm.completed_at,
    dm.final_status,
    dm.success_rate,
    dm.error_count,
    dm.rollback_triggered,
    dm.rollback_reason,
    COUNT(hcr.id) as total_health_checks_detailed,
    AVG(hcr.response_time_ms) as avg_response_time_ms,
    COUNT(da.id) as total_alerts,
    COUNT(CASE WHEN da.severity = 'critical' THEN 1 END) as critical_alerts,
    COUNT(rh.id) as rollback_attempts
FROM deployment_metrics dm
LEFT JOIN health_check_results hcr ON dm.deployment_id = hcr.deployment_id
LEFT JOIN deployment_alerts da ON dm.deployment_id = da.deployment_id
LEFT JOIN rollback_history rh ON dm.deployment_id = rh.deployment_id
GROUP BY dm.id, dm.deployment_id, dm.service_name, dm.version, dm.environment, 
         dm.started_at, dm.completed_at, dm.final_status, dm.success_rate, 
         dm.error_count, dm.rollback_triggered, dm.rollback_reason;

-- Create function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_deployment_data(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
    
    -- Delete old health check results
    DELETE FROM health_check_results WHERE created_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old deployment metrics (keep if deployment is recent or had issues)
    DELETE FROM deployment_metrics 
    WHERE started_at < cutoff_date 
    AND final_status IN ('healthy', 'completed')
    AND rollback_triggered = FALSE;
    
    -- Delete old observability correlations
    DELETE FROM observability_correlations 
    WHERE started_at < cutoff_date 
    AND operation_status = 'completed';
    
    -- Keep deployment alerts and rollback history for longer retention
    DELETE FROM deployment_alerts 
    WHERE created_at < (NOW() - (retention_days * 2 || ' days')::INTERVAL)
    AND resolved = TRUE;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Insert initial configuration data if needed
INSERT INTO deployment_metrics (deployment_id, service_name, version, environment, final_status, metrics_data)
VALUES 
    ('init-deployment', 'manager', '1.0.0', 'production', 'healthy', '{"note": "Initial deployment record"}')
ON CONFLICT (deployment_id) DO NOTHING;

-- Create notification function for real-time updates
CREATE OR REPLACE FUNCTION notify_deployment_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify about deployment status changes
    IF TG_OP = 'UPDATE' AND OLD.final_status IS DISTINCT FROM NEW.final_status THEN
        PERFORM pg_notify(
            'deployment_status_change',
            json_build_object(
                'deployment_id', NEW.deployment_id,
                'service_name', NEW.service_name,
                'old_status', OLD.final_status,
                'new_status', NEW.final_status,
                'rollback_triggered', NEW.rollback_triggered
            )::text
        );
    END IF;
    
    -- Notify about new deployments
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify(
            'deployment_started',
            json_build_object(
                'deployment_id', NEW.deployment_id,
                'service_name', NEW.service_name,
                'version', NEW.version,
                'environment', NEW.environment
            )::text
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for real-time notifications
CREATE TRIGGER deployment_change_notification
    AFTER INSERT OR UPDATE ON deployment_metrics
    FOR EACH ROW EXECUTE FUNCTION notify_deployment_change();

-- Create alert notification function
CREATE OR REPLACE FUNCTION notify_deployment_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.severity IN ('warning', 'critical') THEN
        PERFORM pg_notify(
            'deployment_alert',
            json_build_object(
                'deployment_id', NEW.deployment_id,
                'alert_type', NEW.alert_type,
                'severity', NEW.severity,
                'message', NEW.message,
                'metric_name', NEW.metric_name,
                'current_value', NEW.current_value,
                'threshold_value', NEW.threshold_value
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deployment_alert_notification
    AFTER INSERT ON deployment_alerts
    FOR EACH ROW EXECUTE FUNCTION notify_deployment_alert();

-- Add comments for documentation
COMMENT ON TABLE deployment_metrics IS 'Tracks deployment performance metrics and status for automated monitoring';
COMMENT ON TABLE observability_correlations IS 'Correlates observability data across Langfuse, TrustGraph, and Supabase Realtime';
COMMENT ON TABLE health_check_results IS 'Stores detailed health check results for each deployment';
COMMENT ON TABLE deployment_alerts IS 'Tracks alerts generated during deployment monitoring';
COMMENT ON TABLE machine_state_sync IS 'Syncs Fly.io machine states with Supabase for real-time tracking';
COMMENT ON TABLE rollback_history IS 'Tracks rollback events and their outcomes';
COMMENT ON VIEW deployment_summary IS 'Provides aggregated deployment metrics and status summary';
COMMENT ON FUNCTION cleanup_old_deployment_data IS 'Cleans up old deployment monitoring data based on retention policy';