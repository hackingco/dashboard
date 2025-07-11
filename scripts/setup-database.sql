-- Swarm Orchestrator Database Schema
-- For Supabase or PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Swarms table
CREATE TABLE swarms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('initializing', 'running', 'stopped', 'error')),
    worker_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    config JSONB DEFAULT '{
        "maxWorkers": 10,
        "taskTimeout": 300000,
        "retryLimit": 3
    }'::jsonb,
    metrics JSONB DEFAULT '{
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "averageTaskTime": 0
    }'::jsonb,
    error TEXT
);

-- Workers table
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    machine_id VARCHAR(255) NOT NULL,
    state VARCHAR(50) NOT NULL CHECK (state IN ('started', 'stopped', 'created', 'destroyed')),
    region VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    metrics JSONB,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    payload JSONB NOT NULL,
    result JSONB,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events table for audit trail
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_swarms_status ON swarms(status);
CREATE INDEX idx_swarms_created_at ON swarms(created_at);

CREATE INDEX idx_workers_swarm_id ON workers(swarm_id);
CREATE INDEX idx_workers_state ON workers(state);
CREATE INDEX idx_workers_last_heartbeat ON workers(last_heartbeat);

CREATE INDEX idx_tasks_swarm_id ON tasks(swarm_id);
CREATE INDEX idx_tasks_worker_id ON tasks(worker_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

CREATE INDEX idx_events_swarm_id ON events(swarm_id);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_type ON events(type);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_swarms_updated_at BEFORE UPDATE ON swarms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (for Supabase)
ALTER TABLE swarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (adjust based on your auth strategy)
-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to swarms" ON swarms
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to workers" ON workers
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to tasks" ON tasks
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to events" ON events
    FOR SELECT USING (true);

-- Views for common queries
CREATE VIEW active_swarms AS
    SELECT * FROM swarms WHERE status IN ('running', 'initializing');

CREATE VIEW active_workers AS
    SELECT w.*, s.name as swarm_name 
    FROM workers w
    JOIN swarms s ON w.swarm_id = s.id
    WHERE w.state = 'started';

CREATE VIEW recent_tasks AS
    SELECT t.*, s.name as swarm_name, w.machine_id as worker_machine_id
    FROM tasks t
    JOIN swarms s ON t.swarm_id = s.id
    LEFT JOIN workers w ON t.worker_id = w.id
    WHERE t.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY t.created_at DESC;