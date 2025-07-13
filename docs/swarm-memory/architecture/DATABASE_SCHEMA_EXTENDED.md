# Extended Database Schema for Hive Mind Orchestrator

## Additional Tables for Integration Features

### Claude-Flow Integration Tables

#### claude_flow_hives
```sql
CREATE TABLE claude_flow_hives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    queen_id UUID REFERENCES workers(id),
    queen_type VARCHAR(50) NOT NULL CHECK (queen_type IN ('strategic', 'tactical', 'operational')),
    consensus_algorithm VARCHAR(50) NOT NULL CHECK (consensus_algorithm IN ('majority', 'unanimous', 'weighted')),
    worker_distribution JSONB NOT NULL DEFAULT '{}',
    objective TEXT NOT NULL,
    memory_persistence BOOLEAN DEFAULT true,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claude_flow_hives_swarm_id ON claude_flow_hives(swarm_id);
CREATE INDEX idx_claude_flow_hives_status ON claude_flow_hives(status);
```

#### claude_flow_decisions
```sql
CREATE TABLE claude_flow_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES claude_flow_hives(id) ON DELETE CASCADE,
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    decision_type VARCHAR(100) NOT NULL,
    context JSONB NOT NULL,
    decision JSONB NOT NULL,
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    reasoning TEXT,
    consensus_data JSONB, -- voting results, dissenting opinions
    created_by UUID REFERENCES workers(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claude_flow_decisions_hive_id ON claude_flow_decisions(hive_id);
CREATE INDEX idx_claude_flow_decisions_type ON claude_flow_decisions(decision_type);
CREATE INDEX idx_claude_flow_decisions_created_at ON claude_flow_decisions(created_at DESC);
```

#### claude_flow_memory
```sql
CREATE TABLE claude_flow_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES claude_flow_hives(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    category VARCHAR(100),
    importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hive_id, key)
);

CREATE INDEX idx_claude_flow_memory_hive_key ON claude_flow_memory(hive_id, key);
CREATE INDEX idx_claude_flow_memory_category ON claude_flow_memory(category);
CREATE INDEX idx_claude_flow_memory_importance ON claude_flow_memory(importance DESC);
```

### TrustGraph Integration Tables

#### trust_graph_dags
```sql
CREATE TABLE trust_graph_dags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_nodes INTEGER DEFAULT 0,
    completed_nodes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trust_graph_dags_swarm_id ON trust_graph_dags(swarm_id);
CREATE INDEX idx_trust_graph_dags_status ON trust_graph_dags(status);
```

#### trust_graph_nodes
```sql
CREATE TABLE trust_graph_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dag_id UUID NOT NULL REFERENCES trust_graph_dags(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id),
    node_type VARCHAR(50) NOT NULL CHECK (node_type IN ('task', 'decision', 'checkpoint', 'gateway')),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    data JSONB,
    metadata JSONB, -- execution stats, resource requirements
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trust_graph_nodes_dag_id ON trust_graph_nodes(dag_id);
CREATE INDEX idx_trust_graph_nodes_status ON trust_graph_nodes(status);
CREATE INDEX idx_trust_graph_nodes_task_id ON trust_graph_nodes(task_id);
```

#### trust_graph_edges
```sql
CREATE TABLE trust_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dag_id UUID NOT NULL REFERENCES trust_graph_dags(id) ON DELETE CASCADE,
    from_node_id UUID NOT NULL REFERENCES trust_graph_nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES trust_graph_nodes(id) ON DELETE CASCADE,
    edge_type VARCHAR(50) DEFAULT 'dependency',
    weight FLOAT DEFAULT 1.0,
    conditions JSONB, -- conditional execution rules
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_node_id, to_node_id)
);

CREATE INDEX idx_trust_graph_edges_dag_id ON trust_graph_edges(dag_id);
CREATE INDEX idx_trust_graph_edges_from_node ON trust_graph_edges(from_node_id);
CREATE INDEX idx_trust_graph_edges_to_node ON trust_graph_edges(to_node_id);
```

### Langfuse Integration Tables

#### langfuse_traces
```sql
CREATE TABLE langfuse_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(255) UNIQUE NOT NULL,
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    user_id UUID,
    name VARCHAR(255),
    metadata JSONB,
    tags TEXT[],
    release VARCHAR(100),
    version VARCHAR(50),
    public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_langfuse_traces_trace_id ON langfuse_traces(trace_id);
CREATE INDEX idx_langfuse_traces_swarm_id ON langfuse_traces(swarm_id);
CREATE INDEX idx_langfuse_traces_session_id ON langfuse_traces(session_id);
CREATE INDEX idx_langfuse_traces_created_at ON langfuse_traces(created_at DESC);
```

#### langfuse_spans
```sql
CREATE TABLE langfuse_spans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    span_id VARCHAR(255) UNIQUE NOT NULL,
    trace_id VARCHAR(255) NOT NULL REFERENCES langfuse_traces(trace_id) ON DELETE CASCADE,
    parent_span_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'llm', 'tool', 'chain', 'agent'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    status VARCHAR(50),
    status_message TEXT,
    input JSONB,
    output JSONB,
    metadata JSONB,
    model VARCHAR(100),
    model_parameters JSONB,
    usage JSONB, -- token counts, costs
    level VARCHAR(20) DEFAULT 'DEFAULT',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_langfuse_spans_trace_id ON langfuse_spans(trace_id);
CREATE INDEX idx_langfuse_spans_parent_span_id ON langfuse_spans(parent_span_id);
CREATE INDEX idx_langfuse_spans_type ON langfuse_spans(type);
CREATE INDEX idx_langfuse_spans_start_time ON langfuse_spans(start_time DESC);
```

#### langfuse_generations
```sql
CREATE TABLE langfuse_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(255) REFERENCES langfuse_traces(trace_id) ON DELETE CASCADE,
    span_id VARCHAR(255) REFERENCES langfuse_spans(span_id) ON DELETE CASCADE,
    name VARCHAR(255),
    model VARCHAR(100) NOT NULL,
    model_parameters JSONB,
    prompt JSONB,
    completion TEXT,
    usage JSONB NOT NULL, -- prompt_tokens, completion_tokens, total_tokens
    cost NUMERIC(10, 6),
    latency_ms INTEGER,
    finish_reason VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_langfuse_generations_trace_id ON langfuse_generations(trace_id);
CREATE INDEX idx_langfuse_generations_model ON langfuse_generations(model);
CREATE INDEX idx_langfuse_generations_created_at ON langfuse_generations(created_at DESC);
```

### Hive Communication Tables

#### hive_messages
```sql
CREATE TABLE hive_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
    hive_id UUID REFERENCES claude_flow_hives(id) ON DELETE CASCADE,
    from_worker_id UUID REFERENCES workers(id),
    to_worker_ids UUID[],
    broadcast BOOLEAN DEFAULT false,
    type VARCHAR(50) NOT NULL CHECK (type IN ('command', 'query', 'response', 'event', 'consensus')),
    action VARCHAR(100) NOT NULL,
    payload JSONB,
    correlation_id UUID,
    priority INTEGER DEFAULT 0,
    ttl INTEGER, -- time to live in seconds
    acknowledged_by UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hive_messages_swarm_id ON hive_messages(swarm_id);
CREATE INDEX idx_hive_messages_from_worker ON hive_messages(from_worker_id);
CREATE INDEX idx_hive_messages_correlation_id ON hive_messages(correlation_id);
CREATE INDEX idx_hive_messages_created_at ON hive_messages(created_at DESC);
```

#### hive_consensus_proposals
```sql
CREATE TABLE hive_consensus_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES claude_flow_hives(id) ON DELETE CASCADE,
    proposed_by UUID NOT NULL REFERENCES workers(id),
    proposal_type VARCHAR(100) NOT NULL,
    proposal JSONB NOT NULL,
    votes JSONB DEFAULT '{}', -- worker_id -> vote details
    vote_count INTEGER DEFAULT 0,
    votes_required INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'voting',
    result JSONB,
    voting_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_hive_consensus_proposals_hive_id ON hive_consensus_proposals(hive_id);
CREATE INDEX idx_hive_consensus_proposals_status ON hive_consensus_proposals(status);
CREATE INDEX idx_hive_consensus_proposals_voting_deadline ON hive_consensus_proposals(voting_deadline);
```

### Performance & Analytics Tables

#### swarm_performance_snapshots
```sql
CREATE TABLE swarm_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    snapshot_time TIMESTAMPTZ NOT NULL,
    metrics JSONB NOT NULL, -- comprehensive performance metrics
    analysis JSONB, -- AI-generated insights
    recommendations JSONB[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_swarm_performance_snapshots_swarm_id ON swarm_performance_snapshots(swarm_id);
CREATE INDEX idx_swarm_performance_snapshots_time ON swarm_performance_snapshots(snapshot_time DESC);
```

#### task_execution_analytics
```sql
CREATE TABLE task_execution_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id),
    execution_time_ms INTEGER,
    queue_time_ms INTEGER,
    resource_usage JSONB, -- cpu, memory, network
    cost_estimate NUMERIC(10, 6),
    quality_score FLOAT,
    error_count INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_execution_analytics_task_id ON task_execution_analytics(task_id);
CREATE INDEX idx_task_execution_analytics_worker_id ON task_execution_analytics(worker_id);
```

### Audit & Compliance Tables

#### audit_logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### Views for Analytics

#### swarm_health_view
```sql
CREATE VIEW swarm_health_view AS
SELECT 
    s.id,
    s.name,
    s.status,
    s.worker_count,
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'active') as active_workers,
    COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'error') as error_workers,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending') as pending_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'active') as active_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed' AND t.completed_at > NOW() - INTERVAL '1 hour') as recent_completed,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'failed' AND t.updated_at > NOW() - INTERVAL '1 hour') as recent_failed,
    AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) FILTER (WHERE t.status = 'completed') as avg_task_duration_seconds,
    MAX(w.last_heartbeat) as last_worker_heartbeat,
    s.created_at,
    s.updated_at
FROM swarms s
LEFT JOIN workers w ON s.id = w.swarm_id
LEFT JOIN tasks t ON s.id = t.swarm_id
GROUP BY s.id, s.name, s.status, s.worker_count, s.created_at, s.updated_at;
```

#### worker_performance_view
```sql
CREATE VIEW worker_performance_view AS
SELECT 
    w.id,
    w.swarm_id,
    w.name,
    w.type,
    w.status,
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed') as completed_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'failed') as failed_tasks,
    AVG(EXTRACT(EPOCH FROM (t.completed_at - t.started_at))) FILTER (WHERE t.status = 'completed') as avg_task_duration,
    SUM(COALESCE((w.metrics->>'cpu')::FLOAT, 0)) / NULLIF(COUNT(DISTINCT m.id), 0) as avg_cpu_usage,
    SUM(COALESCE((w.metrics->>'memory')::FLOAT, 0)) / NULLIF(COUNT(DISTINCT m.id), 0) as avg_memory_usage,
    w.last_heartbeat,
    w.created_at
FROM workers w
LEFT JOIN tasks t ON w.id = t.worker_id
LEFT JOIN metrics m ON w.id = m.worker_id
GROUP BY w.id, w.swarm_id, w.name, w.type, w.status, w.last_heartbeat, w.created_at;
```

#### claude_flow_decision_analytics
```sql
CREATE VIEW claude_flow_decision_analytics AS
SELECT 
    cf.hive_id,
    cf.decision_type,
    COUNT(*) as decision_count,
    AVG(cf.confidence) as avg_confidence,
    MIN(cf.confidence) as min_confidence,
    MAX(cf.confidence) as max_confidence,
    COUNT(*) FILTER (WHERE cf.confidence > 0.8) as high_confidence_count,
    COUNT(*) FILTER (WHERE cf.confidence < 0.5) as low_confidence_count,
    DATE_TRUNC('hour', cf.created_at) as decision_hour
FROM claude_flow_decisions cf
GROUP BY cf.hive_id, cf.decision_type, DATE_TRUNC('hour', cf.created_at);
```

### Functions for Complex Queries

#### get_swarm_dependency_graph
```sql
CREATE OR REPLACE FUNCTION get_swarm_dependency_graph(swarm_id_param UUID)
RETURNS TABLE (
    node_id UUID,
    node_name VARCHAR,
    node_type VARCHAR,
    dependencies UUID[],
    dependent_count INTEGER,
    depth INTEGER
) AS $$
WITH RECURSIVE dependency_tree AS (
    -- Base case: nodes with no dependencies
    SELECT 
        n.id,
        n.name,
        n.node_type,
        ARRAY[]::UUID[] as dependencies,
        0 as depth
    FROM trust_graph_nodes n
    WHERE n.id NOT IN (SELECT DISTINCT to_node_id FROM trust_graph_edges)
        AND EXISTS (SELECT 1 FROM trust_graph_dags d WHERE d.id = n.dag_id AND d.swarm_id = swarm_id_param)
    
    UNION ALL
    
    -- Recursive case
    SELECT 
        n.id,
        n.name,
        n.node_type,
        ARRAY_AGG(e.from_node_id) as dependencies,
        dt.depth + 1
    FROM trust_graph_nodes n
    JOIN trust_graph_edges e ON n.id = e.to_node_id
    JOIN dependency_tree dt ON e.from_node_id = dt.id
    WHERE EXISTS (SELECT 1 FROM trust_graph_dags d WHERE d.id = n.dag_id AND d.swarm_id = swarm_id_param)
    GROUP BY n.id, n.name, n.node_type, dt.depth
)
SELECT 
    dt.id as node_id,
    dt.name as node_name,
    dt.node_type,
    dt.dependencies,
    COUNT(e.id) as dependent_count,
    dt.depth
FROM dependency_tree dt
LEFT JOIN trust_graph_edges e ON dt.id = e.from_node_id
GROUP BY dt.id, dt.name, dt.node_type, dt.dependencies, dt.depth
ORDER BY dt.depth, dt.name;
$$ LANGUAGE plpgsql;
```

#### calculate_swarm_cost
```sql
CREATE OR REPLACE FUNCTION calculate_swarm_cost(
    swarm_id_param UUID,
    start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_cost NUMERIC,
    worker_cost NUMERIC,
    llm_cost NUMERIC,
    storage_cost NUMERIC,
    network_cost NUMERIC,
    cost_breakdown JSONB
) AS $$
DECLARE
    worker_hours NUMERIC;
    llm_tokens BIGINT;
    storage_gb_hours NUMERIC;
    network_gb NUMERIC;
BEGIN
    -- Calculate worker hours
    SELECT SUM(EXTRACT(EPOCH FROM (
        LEAST(w.updated_at, end_time) - GREATEST(w.created_at, start_time)
    )) / 3600) INTO worker_hours
    FROM workers w
    WHERE w.swarm_id = swarm_id_param
        AND w.created_at < end_time
        AND (w.updated_at IS NULL OR w.updated_at > start_time);
    
    -- Calculate LLM tokens from Langfuse data
    SELECT SUM((lg.usage->>'total_tokens')::BIGINT) INTO llm_tokens
    FROM langfuse_generations lg
    JOIN langfuse_traces lt ON lg.trace_id = lt.trace_id
    WHERE lt.swarm_id = swarm_id_param
        AND lg.created_at BETWEEN start_time AND end_time;
    
    -- Estimate storage and network (simplified)
    storage_gb_hours := worker_hours * 0.5; -- 0.5 GB per worker
    network_gb := llm_tokens / 1000000.0; -- rough estimate
    
    RETURN QUERY
    SELECT 
        (worker_hours * 0.10 + -- $0.10 per worker hour
         llm_tokens * 0.00003 + -- $0.03 per 1K tokens
         storage_gb_hours * 0.023 + -- $0.023 per GB-hour
         network_gb * 0.02) as total_cost, -- $0.02 per GB
        worker_hours * 0.10 as worker_cost,
        llm_tokens * 0.00003 as llm_cost,
        storage_gb_hours * 0.023 as storage_cost,
        network_gb * 0.02 as network_cost,
        jsonb_build_object(
            'worker_hours', worker_hours,
            'llm_tokens', llm_tokens,
            'storage_gb_hours', storage_gb_hours,
            'network_gb', network_gb,
            'period_days', EXTRACT(DAY FROM end_time - start_time)
        ) as cost_breakdown;
END;
$$ LANGUAGE plpgsql;
```