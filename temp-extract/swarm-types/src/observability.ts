// Enhanced types for state sync and observability architecture

export interface MachineState {
  id: string;
  swarm_id: string;
  worker_id: string | null;
  machine_id: string;
  status: 'initializing' | 'running' | 'stopped' | 'failed' | 'destroyed';
  region: string;
  fly_app_name: string;
  config: Record<string, any>;
  metrics: Record<string, any>;
  private_ip: string | null;
  public_ip: string | null;
  internal_port: number;
  cpu_count: number;
  memory_mb: number;
  disk_gb: number;
  langfuse_trace_id: string | null;
  trustgraph_node_id: string | null;
  last_heartbeat: string | null;
  last_health_check: string | null;
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  // provisioned_at: string | null; // Removed to fix type error
  started_at: string | null;
  stopped_at: string | null;
  destroyed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StateSyncEvent {
  id: string;
  machine_state_id: string;
  swarm_id: string;
  event_type: 'status_change' | 'metrics_update' | 'config_change' | 'heartbeat' | 'machine_created';
  old_state: Record<string, any> | null;
  new_state: Record<string, any>;
  delta: Record<string, any>;
  source: 'system' | 'fly_api' | 'worker' | 'dashboard' | 'trigger';
  correlation_id: string | null;
  metadata: Record<string, any>;
  broadcast_attempted: boolean;
  broadcast_success: boolean;
  broadcast_at: string | null;
  broadcast_clients: number;
  created_at: string;
}

export interface WSBroadcastChannel {
  id: string;
  channel_name: string;
  swarm_id: string | null;
  channel_type: 'swarm_updates' | 'machine_states' | 'task_progress' | 'system_events';
  auto_subscribe: boolean;
  message_retention_hours: number;
  active_subscribers: number;
  total_messages_sent: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LangfuseFlySpan {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  operation_type: string;
  fly_app_name: string | null;
  machine_id: string | null;
  swarm_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  request_payload: Record<string, any> | null;
  response_payload: Record<string, any> | null;
  api_calls_count: number;
  tokens_consumed: number;
  estimated_cost: number;
  error_message: string | null;
  error_code: string | null;
  status: 'success' | 'error' | 'timeout' | 'in_progress';
  metadata: Record<string, any>;
  created_at: string;
}

export interface TrustGraphWSNode {
  id: string;
  swarm_id: string;
  node_id: string;
  node_type: 'swarm' | 'worker' | 'task' | 'api' | 'dependency';
  node_label: string;
  ws_event_type: string;
  ws_channel: string;
  ws_payload: Record<string, any>;
  parent_node_id: string | null;
  triggering_event_id: string | null;
  status: 'pending' | 'emitted' | 'failed';
  emitted_at: string | null;
  processing_time_ms: number | null;
  subscribers_reached: number;
  correlation_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ObservabilityCorrelation {
  id: string;
  correlation_id: string;
  swarm_id: string | null;
  machine_state_id: string | null;
  task_id: string | null;
  langfuse_trace_id: string | null;
  langfuse_span_id: string | null;
  trustgraph_node_id: string | null;
  operation_type: string;
  operation_status: 'in_progress' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  total_duration_ms: number | null;
  total_api_calls: number;
  total_tokens: number;
  total_cost: number;
  created_at: string;
}

export interface RealtimeStateDelta {
  event_type: 'state_change' | 'machine_created' | 'machine_destroyed';
  machine_id: string;
  swarm_id: string;
  old_status?: string;
  new_status?: string;
  changes: Record<string, any>;
  timestamp: string;
}

export interface SwarmHealthMetrics {
  swarm_id: string;
  total_machines: number;
  healthy_machines: number;
  unhealthy_machines: number;
  unknown_machines: number;
  average_heartbeat_delay: number;
  total_state_changes_last_hour: number;
  total_api_calls_last_hour: number;
  health_score: number; // 0-100
}

export interface ObservabilitySession {
  session_id: string;
  swarm_id: string;
  correlation_id: string;
  operation_type: string;
  started_at: Date;
  completed_at?: Date;
  status: 'active' | 'completed' | 'failed';
  langfuse_trace_id: string;
  trustgraph_nodes: string[];
  machine_states: string[];
  fly_operations: string[];
  metrics: {
    total_duration_ms?: number;
    api_calls_count: number;
    tokens_consumed: number;
    cost_total: number;
    broadcasts_sent: number;
    state_changes: number;
  };
}

export interface FlyAPIMetrics {
  operation: string;
  duration_ms: number;
  tokens_consumed: number;
  cost: number;
  success: boolean;
  error?: string;
  machine_id?: string;
  app_name?: string;
}

export interface TrustGraphNode {
  id: string;
  type: 'swarm' | 'worker' | 'task' | 'api' | 'dependency' | 'ws_broadcast' | 'machine';
  label: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface TrustGraphEdge {
  id?: string;
  source: string;
  target: string;
  label: string;
  type?: 'depends_on' | 'executes' | 'triggers' | 'creates' | 'calls';
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface WSBroadcastNode extends TrustGraphNode {
  ws_event_type: string;
  ws_channel: string;
  ws_payload: Record<string, any>;
  correlation_id?: string;
  subscribers_reached?: number;
}

export interface DAGAnalysis {
  nodes: number;
  edges: number;
  hasCycles: boolean;
  criticalPath: string[];
  parallelizableGroups: string[][];
  executionOrder: string[];
  wsBroadcastNodes?: number;
  broadcastChannels?: string[];
  correlationChains?: Array<{
    correlation_id: string;
    node_count: number;
    event_types: string[];
  }>;
}

export interface ObservabilityContext {
  trace_id: string;
  span_id: string;
  correlation_id: string;
  swarm_id?: string;
  machine_id?: string;
  operation_type: string;
}

export interface StateChangeEvent {
  type: 'machine_state' | 'task_status' | 'swarm_health' | 'api_call' | 'broadcast';
  source: string;
  swarm_id: string;
  correlation_id: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface ObservabilityMetrics {
  session_count: number;
  active_sessions: number;
  total_api_calls: number;
  total_tokens: number;
  total_cost: number;
  average_session_duration: number;
  success_rate: number;
  top_operations: Array<{ operation: string; count: number; avg_duration: number }>;
  realtime_connections: number;
  trustgraph_nodes: number;
  langfuse_traces: number;
}

export interface MachineStateMonitoring {
  id: string;
  machine_id: string;
  swarm_id: string;
  swarm_name: string;
  status: string;
  region: string;
  health_status: string;
  last_heartbeat: string | null;
  cpu_count: number;
  memory_mb: number;
  private_ip: string | null;
  langfuse_trace_id: string | null;
  trustgraph_node_id: string | null;
  state_changes_last_hour: number;
  seconds_since_heartbeat: number | null;
  seconds_since_health_check: number | null;
  api_calls_last_hour: number;
  created_at: string;
  updated_at: string;
}

export interface SwarmVisualizationData {
  nodes: Array<TrustGraphNode & { x?: number; y?: number; category?: string }>;
  edges: TrustGraphEdge[];
  stats: {
    totalNodes: number;
    wsBroadcastNodes: number;
    apiCallNodes: number;
    taskNodes: number;
    correlationChains: number;
  };
}

export interface ComprehensiveSwarmData {
  sessions: ObservabilitySession[];
  trustgraph: SwarmVisualizationData;
  machine_states: MachineState[];
  langfuse_metrics: any;
  realtime_status: boolean;
  health_metrics: SwarmHealthMetrics | null;
  recent_events: StateSyncEvent[];
  active_subscriptions: string[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    correlation_id: string;
    timestamp: string;
    duration_ms: number;
  };
}

// WebSocket message types
export interface WSMessage {
  type: 'state_change' | 'machine_update' | 'task_progress' | 'error' | 'ping';
  channel: string;
  payload: any;
  correlation_id?: string;
  timestamp: string;
}

// Configuration types
export interface ObservabilityConfig {
  langfuse: {
    enabled: boolean;
    public_key?: string;
    secret_key?: string;
    host?: string;
  };
  trustgraph: {
    enabled: boolean;
    api_key?: string;
    api_url?: string;
  };
  supabase: {
    url: string;
    service_role_key: string;
    realtime_enabled: boolean;
  };
  fly: {
    api_token: string;
    observability_enabled: boolean;
  };
  monitoring: {
    health_check_interval_ms: number;
    metrics_collection_interval_ms: number;
    max_session_retention: number;
    max_metrics_retention: number;
  };
}

// Export all types
export * from './index'; // Re-export existing types