-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Swarms table
CREATE TABLE swarms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    purpose TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'initializing',
    worker_count INTEGER DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{}',
    fly_app_name VARCHAR(255) UNIQUE,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    organization_id UUID
);

-- Workers table
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'general',
    status VARCHAR(50) NOT NULL DEFAULT 'idle',
    machine_id VARCHAR(255),
    last_heartbeat TIMESTAMPTZ,
    config JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    input JSONB,
    output JSONB,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs table
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL,
    source VARCHAR(255),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics table for time-series data
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    tags JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates table for swarm templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_swarms_created_at ON swarms(created_at DESC);
CREATE INDEX idx_workers_swarm_id ON workers(swarm_id);
CREATE INDEX idx_workers_status ON workers(status);
CREATE INDEX idx_tasks_swarm_id ON tasks(swarm_id);
CREATE INDEX idx_tasks_worker_id ON tasks(worker_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_logs_swarm_id ON logs(swarm_id);
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_metrics_swarm_id ON metrics(swarm_id);
CREATE INDEX idx_metrics_created_at ON metrics(created_at DESC);

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to relevant tables
CREATE TRIGGER update_swarms_updated_at BEFORE UPDATE ON swarms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE swarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (to be customized based on auth strategy)
-- For now, allow all authenticated users to read their organization's data
CREATE POLICY "Users can view their organization's swarms" ON swarms
    FOR SELECT USING (true); -- Will be updated with proper auth

CREATE POLICY "Users can create swarms" ON swarms
    FOR INSERT WITH CHECK (true); -- Will be updated with proper auth

CREATE POLICY "Users can update their swarms" ON swarms
    FOR UPDATE USING (true); -- Will be updated with proper auth

-- Similar policies for other tables
CREATE POLICY "View workers" ON workers FOR SELECT USING (true);
CREATE POLICY "View tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "View logs" ON logs FOR SELECT USING (true);
CREATE POLICY "View metrics" ON metrics FOR SELECT USING (true);
CREATE POLICY "View public templates" ON templates FOR SELECT USING (is_public = true);

-- Create views for common queries
CREATE VIEW swarm_stats AS
SELECT 
    s.id,
    s.name,
    s.status,
    s.worker_count,
    COUNT(DISTINCT w.id) as active_workers,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending') as pending_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'failed') as failed_tasks,
    AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) FILTER (WHERE t.status = 'completed') as avg_task_duration
FROM swarms s
LEFT JOIN workers w ON s.id = w.swarm_id AND w.status = 'active'
LEFT JOIN tasks t ON s.id = t.swarm_id
GROUP BY s.id, s.name, s.status, s.worker_count;

-- Create function to get recent activity
CREATE OR REPLACE FUNCTION get_recent_activity(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    id UUID,
    type VARCHAR,
    description TEXT,
    swarm_id UUID,
    swarm_name VARCHAR,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        -- New swarms
        SELECT 
            s.id,
            'swarm_created'::VARCHAR as type,
            ('Swarm "' || s.name || '" created')::TEXT as description,
            s.id as swarm_id,
            s.name as swarm_name,
            s.created_at
        FROM swarms s
        
        UNION ALL
        
        -- Completed tasks
        SELECT 
            t.id,
            'task_completed'::VARCHAR as type,
            ('Task "' || t.type || '" completed')::TEXT as description,
            t.swarm_id,
            s.name as swarm_name,
            t.completed_at as created_at
        FROM tasks t
        JOIN swarms s ON t.swarm_id = s.id
        WHERE t.status = 'completed' AND t.completed_at IS NOT NULL
        
        UNION ALL
        
        -- Failed tasks
        SELECT 
            t.id,
            'task_failed'::VARCHAR as type,
            ('Task "' || t.type || '" failed: ' || COALESCE(t.error, 'Unknown error'))::TEXT as description,
            t.swarm_id,
            s.name as swarm_name,
            t.updated_at as created_at
        FROM tasks t
        JOIN swarms s ON t.swarm_id = s.id
        WHERE t.status = 'failed'
    ) AS activities
    ORDER BY created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;