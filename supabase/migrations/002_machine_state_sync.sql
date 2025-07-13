-- Enhanced Machine State Sync and Observability Schema
-- Migration: 002_machine_state_sync.sql

-- Machine States table for Fly.io machine persistence
CREATE TABLE machine_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
    machine_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Core machine state
    status VARCHAR(50) NOT NULL DEFAULT 'initializing', -- initializing, running, stopped, failed, destroyed
    region VARCHAR(10) NOT NULL,
    fly_app_name VARCHAR(255) NOT NULL,
    
    -- Machine configuration and metadata
    config JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{}',
    
    -- Network and connection info
    private_ip INET,
    public_ip INET,
    internal_port INTEGER DEFAULT 3000,
    
    -- Resource allocation
    cpu_count INTEGER DEFAULT 1,
    memory_mb INTEGER DEFAULT 256,
    disk_gb INTEGER DEFAULT 1,
    
    -- Observability integration
    langfuse_trace_id VARCHAR(255),
    trustgraph_node_id UUID,
    
    -- State tracking
    last_heartbeat TIMESTAMPTZ,
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(20) DEFAULT 'unknown', -- healthy, unhealthy, unknown
    
    -- Lifecycle timestamps
    provisioned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    destroyed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- State sync events for delta tracking
CREATE TABLE state_sync_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_state_id UUID NOT NULL REFERENCES machine_states(id) ON DELETE CASCADE,
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- status_change, metrics_update, config_change, heartbeat
    
    -- Delta information
    old_state JSONB,
    new_state JSONB,
    delta JSONB, -- Computed diff between old and new state
    
    -- Event source and metadata
    source VARCHAR(50) NOT NULL DEFAULT 'system', -- system, fly_api, worker, dashboard
    correlation_id UUID,
    metadata JSONB DEFAULT '{}',
    
    -- WebSocket broadcast tracking
    broadcast_attempted BOOLEAN DEFAULT false,
    broadcast_success BOOLEAN DEFAULT false,
    broadcast_at TIMESTAMPTZ,
    broadcast_clients INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WebSocket broadcast channels for real-time updates
CREATE TABLE ws_broadcast_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_name VARCHAR(255) NOT NULL UNIQUE,
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    
    -- Channel configuration
    channel_type VARCHAR(50) NOT NULL, -- swarm_updates, machine_states, task_progress, system_events
    auto_subscribe BOOLEAN DEFAULT true,
    message_retention_hours INTEGER DEFAULT 24,
    
    -- Subscription tracking
    active_subscribers INTEGER DEFAULT 0,
    total_messages_sent BIGINT DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Langfuse span metadata for Fly API tracing
CREATE TABLE langfuse_fly_spans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(255) NOT NULL,
    span_id VARCHAR(255) NOT NULL UNIQUE,
    parent_span_id VARCHAR(255),
    
    -- Span details
    operation_type VARCHAR(100) NOT NULL, -- create_machine, scale_swarm, get_status, etc.
    fly_app_name VARCHAR(255),
    machine_id VARCHAR(255),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    
    -- Performance metrics
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Request/Response data
    request_payload JSONB,
    response_payload JSONB,
    
    -- Token and cost tracking
    api_calls_count INTEGER DEFAULT 1,
    tokens_consumed INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10,6) DEFAULT 0,
    
    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(50),
    status VARCHAR(20) DEFAULT 'success', -- success, error, timeout
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TrustGraph node emissions for WebSocket events
CREATE TABLE trustgraph_ws_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    
    -- TrustGraph node details
    node_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(50) NOT NULL, -- ws_broadcast, state_sync, api_call, user_action
    node_label VARCHAR(255) NOT NULL,
    
    -- WebSocket event details
    ws_event_type VARCHAR(50) NOT NULL, -- machine_update, swarm_scale, task_complete, error
    ws_channel VARCHAR(255) NOT NULL,
    ws_payload JSONB NOT NULL,
    
    -- Edge relationships
    parent_node_id VARCHAR(255),
    triggering_event_id UUID REFERENCES state_sync_events(id),
    
    -- Execution tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, emitted, failed
    emitted_at TIMESTAMPTZ,
    
    -- Performance metrics
    processing_time_ms INTEGER,
    subscribers_reached INTEGER DEFAULT 0,
    
    -- Metadata and correlation
    correlation_id UUID,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Observability correlation table
CREATE TABLE observability_correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    correlation_id UUID NOT NULL UNIQUE,
    
    -- Core entity references
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    machine_state_id UUID REFERENCES machine_states(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- Observability tool references
    langfuse_trace_id VARCHAR(255),
    langfuse_span_id VARCHAR(255),
    trustgraph_node_id VARCHAR(255),
    
    -- Event context
    operation_type VARCHAR(100) NOT NULL,
    operation_status VARCHAR(20) DEFAULT 'in_progress',
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    total_duration_ms INTEGER,
    
    -- Metrics aggregation
    total_api_calls INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_machine_states_swarm_id ON machine_states(swarm_id);
CREATE INDEX idx_machine_states_machine_id ON machine_states(machine_id);
CREATE INDEX idx_machine_states_status ON machine_states(status);
CREATE INDEX idx_machine_states_region ON machine_states(region);
CREATE INDEX idx_machine_states_last_heartbeat ON machine_states(last_heartbeat);

CREATE INDEX idx_state_sync_events_machine_state_id ON state_sync_events(machine_state_id);
CREATE INDEX idx_state_sync_events_swarm_id ON state_sync_events(swarm_id);
CREATE INDEX idx_state_sync_events_event_type ON state_sync_events(event_type);
CREATE INDEX idx_state_sync_events_created_at ON state_sync_events(created_at DESC);
CREATE INDEX idx_state_sync_events_correlation_id ON state_sync_events(correlation_id);

CREATE INDEX idx_ws_broadcast_channels_channel_name ON ws_broadcast_channels(channel_name);
CREATE INDEX idx_ws_broadcast_channels_swarm_id ON ws_broadcast_channels(swarm_id);
CREATE INDEX idx_ws_broadcast_channels_channel_type ON ws_broadcast_channels(channel_type);

CREATE INDEX idx_langfuse_fly_spans_trace_id ON langfuse_fly_spans(trace_id);
CREATE INDEX idx_langfuse_fly_spans_span_id ON langfuse_fly_spans(span_id);
CREATE INDEX idx_langfuse_fly_spans_swarm_id ON langfuse_fly_spans(swarm_id);
CREATE INDEX idx_langfuse_fly_spans_operation_type ON langfuse_fly_spans(operation_type);
CREATE INDEX idx_langfuse_fly_spans_start_time ON langfuse_fly_spans(start_time DESC);

CREATE INDEX idx_trustgraph_ws_nodes_swarm_id ON trustgraph_ws_nodes(swarm_id);
CREATE INDEX idx_trustgraph_ws_nodes_node_id ON trustgraph_ws_nodes(node_id);
CREATE INDEX idx_trustgraph_ws_nodes_ws_event_type ON trustgraph_ws_nodes(ws_event_type);
CREATE INDEX idx_trustgraph_ws_nodes_status ON trustgraph_ws_nodes(status);
CREATE INDEX idx_trustgraph_ws_nodes_correlation_id ON trustgraph_ws_nodes(correlation_id);

CREATE INDEX idx_observability_correlations_correlation_id ON observability_correlations(correlation_id);
CREATE INDEX idx_observability_correlations_swarm_id ON observability_correlations(swarm_id);
CREATE INDEX idx_observability_correlations_operation_type ON observability_correlations(operation_type);

-- Update timestamp triggers
CREATE TRIGGER update_machine_states_updated_at BEFORE UPDATE ON machine_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ws_broadcast_channels_updated_at BEFORE UPDATE ON ws_broadcast_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Supabase Realtime triggers for delta forwarding
CREATE OR REPLACE FUNCTION notify_state_sync_delta()
RETURNS TRIGGER AS $$
DECLARE
    delta_payload JSONB;
    channel_name TEXT;
BEGIN
    -- Compute delta between old and new states
    IF TG_OP = 'UPDATE' THEN
        -- Calculate the actual diff between old and new state
        delta_payload := jsonb_build_object(
            'event_type', 'state_change',
            'machine_id', NEW.machine_id,
            'swarm_id', NEW.swarm_id,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'changes', jsonb_build_object(
                'status', CASE WHEN OLD.status != NEW.status THEN 
                    jsonb_build_object('from', OLD.status, 'to', NEW.status) 
                END,
                'metrics', CASE WHEN OLD.metrics != NEW.metrics THEN 
                    jsonb_build_object('from', OLD.metrics, 'to', NEW.metrics) 
                END,
                'health_status', CASE WHEN OLD.health_status != NEW.health_status THEN 
                    jsonb_build_object('from', OLD.health_status, 'to', NEW.health_status) 
                END,
                'last_heartbeat', CASE WHEN OLD.last_heartbeat != NEW.last_heartbeat THEN 
                    jsonb_build_object('from', OLD.last_heartbeat, 'to', NEW.last_heartbeat) 
                END
            ),
            'timestamp', NOW()
        );
        
        -- Create state sync event record
        INSERT INTO state_sync_events (
            machine_state_id, 
            swarm_id, 
            event_type, 
            old_state, 
            new_state, 
            delta,
            source
        ) VALUES (
            NEW.id,
            NEW.swarm_id,
            'status_change',
            to_jsonb(OLD),
            to_jsonb(NEW),
            delta_payload,
            'trigger'
        );
        
    ELSIF TG_OP = 'INSERT' THEN
        delta_payload := jsonb_build_object(
            'event_type', 'machine_created',
            'machine_id', NEW.machine_id,
            'swarm_id', NEW.swarm_id,
            'status', NEW.status,
            'region', NEW.region,
            'timestamp', NOW()
        );
        
        -- Create state sync event record
        INSERT INTO state_sync_events (
            machine_state_id, 
            swarm_id, 
            event_type, 
            new_state, 
            delta,
            source
        ) VALUES (
            NEW.id,
            NEW.swarm_id,
            'machine_created',
            to_jsonb(NEW),
            delta_payload,
            'trigger'
        );
    END IF;
    
    -- Determine WebSocket channel
    channel_name := 'swarm:' || NEW.swarm_id || ':machine_states';
    
    -- Send WebSocket notification
    PERFORM pg_notify(channel_name, delta_payload::text);
    
    -- Also send to global machine states channel
    PERFORM pg_notify('machine_states', delta_payload::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for machine state changes
CREATE TRIGGER machine_state_delta_trigger
    AFTER INSERT OR UPDATE ON machine_states
    FOR EACH ROW
    EXECUTE FUNCTION notify_state_sync_delta();

-- Function to emit TrustGraph nodes for WebSocket broadcasts
CREATE OR REPLACE FUNCTION emit_trustgraph_ws_node(
    p_swarm_id UUID,
    p_node_type VARCHAR(50),
    p_ws_event_type VARCHAR(50),
    p_ws_channel VARCHAR(255),
    p_ws_payload JSONB,
    p_correlation_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    node_uuid UUID;
    trustgraph_node_id VARCHAR(255);
BEGIN
    node_uuid := uuid_generate_v4();
    trustgraph_node_id := 'ws_' || node_uuid::text;
    
    INSERT INTO trustgraph_ws_nodes (
        id,
        swarm_id,
        node_id,
        node_type,
        node_label,
        ws_event_type,
        ws_channel,
        ws_payload,
        correlation_id,
        status
    ) VALUES (
        node_uuid,
        p_swarm_id,
        trustgraph_node_id,
        p_node_type,
        'WS Broadcast: ' || p_ws_event_type,
        p_ws_event_type,
        p_ws_channel,
        p_ws_payload,
        p_correlation_id,
        'emitted'
    );
    
    -- Update emission timestamp
    UPDATE trustgraph_ws_nodes 
    SET emitted_at = NOW() 
    WHERE id = node_uuid;
    
    RETURN node_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to wrap Fly API calls with Langfuse spans
CREATE OR REPLACE FUNCTION create_langfuse_fly_span(
    p_trace_id VARCHAR(255),
    p_operation_type VARCHAR(100),
    p_fly_app_name VARCHAR(255),
    p_machine_id VARCHAR(255) DEFAULT NULL,
    p_swarm_id UUID DEFAULT NULL,
    p_request_payload JSONB DEFAULT NULL
)
RETURNS VARCHAR(255) AS $$
DECLARE
    span_id VARCHAR(255);
BEGIN
    span_id := 'span_fly_' || extract(epoch from now()) || '_' || substring(md5(random()::text), 1, 8);
    
    INSERT INTO langfuse_fly_spans (
        trace_id,
        span_id,
        operation_type,
        fly_app_name,
        machine_id,
        swarm_id,
        start_time,
        request_payload,
        status
    ) VALUES (
        p_trace_id,
        span_id,
        p_operation_type,
        p_fly_app_name,
        p_machine_id,
        p_swarm_id,
        NOW(),
        p_request_payload,
        'in_progress'
    );
    
    RETURN span_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete Langfuse span with response data
CREATE OR REPLACE FUNCTION complete_langfuse_fly_span(
    p_span_id VARCHAR(255),
    p_response_payload JSONB DEFAULT NULL,
    p_tokens_consumed INTEGER DEFAULT 0,
    p_error_message TEXT DEFAULT NULL,
    p_error_code VARCHAR(50) DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    start_time_val TIMESTAMPTZ;
    duration_val INTEGER;
    cost_val DECIMAL(10,6);
BEGIN
    -- Get start time for duration calculation
    SELECT start_time INTO start_time_val 
    FROM langfuse_fly_spans 
    WHERE span_id = p_span_id;
    
    duration_val := EXTRACT(EPOCH FROM (NOW() - start_time_val)) * 1000;
    
    -- Calculate estimated cost (simple model: $0.001 per API call + token costs)
    cost_val := 0.001 + (p_tokens_consumed * 0.00001);
    
    UPDATE langfuse_fly_spans SET
        end_time = NOW(),
        duration_ms = duration_val,
        response_payload = p_response_payload,
        tokens_consumed = p_tokens_consumed,
        estimated_cost = cost_val,
        error_message = p_error_message,
        error_code = p_error_code,
        status = CASE 
            WHEN p_error_message IS NOT NULL THEN 'error'
            ELSE 'success'
        END
    WHERE span_id = p_span_id;
END;
$$ LANGUAGE plpgsql;

-- Enhanced view for machine state monitoring
CREATE VIEW machine_state_monitoring AS
SELECT 
    ms.id,
    ms.machine_id,
    ms.swarm_id,
    s.name as swarm_name,
    ms.status,
    ms.region,
    ms.health_status,
    ms.last_heartbeat,
    ms.cpu_count,
    ms.memory_mb,
    ms.private_ip,
    ms.langfuse_trace_id,
    ms.trustgraph_node_id,
    
    -- Recent state changes
    (
        SELECT COUNT(*) 
        FROM state_sync_events sse 
        WHERE sse.machine_state_id = ms.id 
        AND sse.created_at > NOW() - INTERVAL '1 hour'
    ) as state_changes_last_hour,
    
    -- Health check timing
    EXTRACT(EPOCH FROM (NOW() - ms.last_heartbeat)) as seconds_since_heartbeat,
    EXTRACT(EPOCH FROM (NOW() - ms.last_health_check)) as seconds_since_health_check,
    
    -- Observability data
    (
        SELECT COUNT(*) 
        FROM langfuse_fly_spans lfs 
        WHERE lfs.machine_id = ms.machine_id 
        AND lfs.start_time > NOW() - INTERVAL '1 hour'
    ) as api_calls_last_hour,
    
    ms.created_at,
    ms.updated_at
FROM machine_states ms
JOIN swarms s ON ms.swarm_id = s.id;

-- Function to get real-time swarm health
CREATE OR REPLACE FUNCTION get_swarm_health_realtime(p_swarm_id UUID)
RETURNS TABLE (
    swarm_id UUID,
    total_machines INTEGER,
    healthy_machines INTEGER,
    unhealthy_machines INTEGER,
    unknown_machines INTEGER,
    average_heartbeat_delay NUMERIC,
    total_state_changes_last_hour BIGINT,
    total_api_calls_last_hour BIGINT,
    health_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_swarm_id,
        COUNT(*)::INTEGER as total_machines,
        COUNT(CASE WHEN health_status = 'healthy' THEN 1 END)::INTEGER as healthy_machines,
        COUNT(CASE WHEN health_status = 'unhealthy' THEN 1 END)::INTEGER as unhealthy_machines,
        COUNT(CASE WHEN health_status = 'unknown' THEN 1 END)::INTEGER as unknown_machines,
        AVG(EXTRACT(EPOCH FROM (NOW() - last_heartbeat)))::NUMERIC as average_heartbeat_delay,
        
        (SELECT COUNT(*) 
         FROM state_sync_events sse 
         JOIN machine_states ms2 ON sse.machine_state_id = ms2.id
         WHERE ms2.swarm_id = p_swarm_id 
         AND sse.created_at > NOW() - INTERVAL '1 hour') as total_state_changes_last_hour,
         
        (SELECT COUNT(*) 
         FROM langfuse_fly_spans lfs 
         WHERE lfs.swarm_id = p_swarm_id 
         AND lfs.start_time > NOW() - INTERVAL '1 hour') as total_api_calls_last_hour,
         
        -- Health score (0-100)
        CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE (COUNT(CASE WHEN health_status = 'healthy' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100)
        END as health_score
        
    FROM machine_states ms
    WHERE ms.swarm_id = p_swarm_id
    GROUP BY p_swarm_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security policies for new tables
ALTER TABLE machine_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ws_broadcast_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE langfuse_fly_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE trustgraph_ws_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_correlations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (to be customized based on auth strategy)
CREATE POLICY "View machine states" ON machine_states FOR SELECT USING (true);
CREATE POLICY "Update machine states" ON machine_states FOR UPDATE USING (true);
CREATE POLICY "Insert machine states" ON machine_states FOR INSERT WITH CHECK (true);

CREATE POLICY "View state sync events" ON state_sync_events FOR SELECT USING (true);
CREATE POLICY "Insert state sync events" ON state_sync_events FOR INSERT WITH CHECK (true);

CREATE POLICY "View ws channels" ON ws_broadcast_channels FOR SELECT USING (true);
CREATE POLICY "Update ws channels" ON ws_broadcast_channels FOR UPDATE USING (true);

CREATE POLICY "View langfuse spans" ON langfuse_fly_spans FOR SELECT USING (true);
CREATE POLICY "Insert langfuse spans" ON langfuse_fly_spans FOR INSERT WITH CHECK (true);
CREATE POLICY "Update langfuse spans" ON langfuse_fly_spans FOR UPDATE USING (true);

CREATE POLICY "View trustgraph nodes" ON trustgraph_ws_nodes FOR SELECT USING (true);
CREATE POLICY "Insert trustgraph nodes" ON trustgraph_ws_nodes FOR INSERT WITH CHECK (true);

CREATE POLICY "View observability correlations" ON observability_correlations FOR SELECT USING (true);
CREATE POLICY "Insert observability correlations" ON observability_correlations FOR INSERT WITH CHECK (true);
CREATE POLICY "Update observability correlations" ON observability_correlations FOR UPDATE USING (true);