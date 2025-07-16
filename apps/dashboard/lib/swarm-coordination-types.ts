// Comprehensive TypeScript Types for Swarm Coordination
// Generated: 2025-07-14
// Purpose: Type-safe interfaces for Supabase swarm relationship schema

// =============================================================================
// ENUM TYPES
// =============================================================================

export type SwarmTopologyEnum = 
  | 'mesh' 
  | 'hierarchical' 
  | 'ring' 
  | 'star' 
  | 'hybrid';

export type SwarmStrategyEnum = 
  | 'balanced' 
  | 'specialized' 
  | 'adaptive' 
  | 'performance' 
  | 'efficiency';

export type SwarmNetworkStatusEnum = 
  | 'active' 
  | 'inactive' 
  | 'scaling' 
  | 'maintenance' 
  | 'error';

export type SessionStatusEnum = 
  | 'active' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'terminated';

export type AgentTypeEnum = 
  | 'coordinator' 
  | 'researcher' 
  | 'coder' 
  | 'analyst' 
  | 'tester' 
  | 'optimizer' 
  | 'architect' 
  | 'reviewer' 
  | 'monitor' 
  | 'specialist';

export type AgentStatusEnum = 
  | 'active' 
  | 'idle' 
  | 'busy' 
  | 'offline' 
  | 'error' 
  | 'terminated';

export type RelationshipTypeEnum = 
  | 'coordination' 
  | 'collaboration' 
  | 'supervision' 
  | 'delegation' 
  | 'knowledge_sharing' 
  | 'resource_sharing';

export type ExecutionStrategyEnum = 
  | 'parallel' 
  | 'sequential' 
  | 'adaptive' 
  | 'balanced' 
  | 'priority_based';

export type TaskPriorityEnum = 
  | 'low' 
  | 'medium' 
  | 'high' 
  | 'critical' 
  | 'urgent';

export type TaskStatusEnum = 
  | 'pending' 
  | 'assigned' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type CognitivePatternEnum = 
  | 'convergent' 
  | 'divergent' 
  | 'lateral' 
  | 'systems' 
  | 'critical' 
  | 'adaptive';

export type MemoryAccessEnum = 
  | 'private' 
  | 'shared' 
  | 'public' 
  | 'restricted';

export type CoordinationEventEnum = 
  | 'message' 
  | 'task_assignment' 
  | 'status_update' 
  | 'heartbeat' 
  | 'coordination_request' 
  | 'resource_request' 
  | 'emergency';

export type EventPriorityEnum = 
  | 'low' 
  | 'normal' 
  | 'high' 
  | 'urgent' 
  | 'critical';

export type EventStatusEnum = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'expired';

export type PerformanceMetricEnum = 
  | 'response_time' 
  | 'throughput' 
  | 'efficiency' 
  | 'resource_usage' 
  | 'coordination_latency' 
  | 'task_completion_rate' 
  | 'error_rate';

export type HealthStatusEnum = 
  | 'healthy' 
  | 'warning' 
  | 'critical' 
  | 'offline' 
  | 'recovering';

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

export interface CoordinationConfig {
  consensus_threshold: number;
  heartbeat_interval: number;
  max_response_time: number;
  auto_scale: boolean;
  load_balancing: boolean;
}

export interface SessionMetrics {
  tasks_completed: number;
  avg_response_time: number;
  efficiency_score: number;
  coordination_events: number;
}

export interface CoordinationState {
  current_task: string | null;
  queue_depth: number;
  coordination_level: 'individual' | 'team' | 'swarm';
  last_coordination: string | null;
}

// =============================================================================
// DATABASE TABLE INTERFACES
// =============================================================================

export interface SwarmNetwork {
  id: string;
  name: string;
  description?: string;
  topology: SwarmTopologyEnum;
  max_agents: number;
  strategy: SwarmStrategyEnum;
  status: SwarmNetworkStatusEnum;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  coordination_config: CoordinationConfig;
}

export interface SwarmSession {
  id: string;
  swarm_id: string;
  swarm_name: string;
  network_id?: string;
  objective: string;
  queen_type: string;
  worker_count: number;
  consensus_algorithm: string;
  status: SessionStatusEnum;
  started_at: string;
  ended_at?: string;
  namespace: string;
  configuration: Record<string, any>;
  metrics: SessionMetrics;
}

export interface SwarmAgent {
  id: string;
  agent_id: string;
  session_id?: string;
  network_id?: string;
  name: string;
  type: AgentTypeEnum;
  capabilities: string[];
  status: AgentStatusEnum;
  spawned_at: string;
  last_heartbeat?: string;
  performance_score: number;
  load_factor: number;
  metadata: Record<string, any>;
  coordination_state: CoordinationState;
}

export interface AgentRelationship {
  id: string;
  source_agent_id?: string;
  target_agent_id?: string;
  relationship_type: RelationshipTypeEnum;
  strength: number;
  coordination_frequency: number;
  last_interaction?: string;
  created_at: string;
  metadata: Record<string, any>;
}

export interface SwarmTask {
  id: string;
  task_id: string;
  session_id?: string;
  network_id?: string;
  title: string;
  description?: string;
  strategy: ExecutionStrategyEnum;
  priority: TaskPriorityEnum;
  status: TaskStatusEnum;
  assigned_agents: string[];
  dependencies: string[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: number;
  result?: Record<string, any>;
  metadata: Record<string, any>;
}

export interface NeuralPattern {
  id: string;
  agent_id?: string;
  pattern_type: CognitivePatternEnum;
  training_session_id?: string;
  effectiveness_score: number;
  learning_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface SwarmMemory {
  id: string;
  key: string;
  value: Record<string, any>;
  namespace: string;
  session_id?: string;
  agent_id?: string;
  access_level: MemoryAccessEnum;
  ttl_seconds?: number;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  access_count: number;
  last_accessed?: string;
  metadata: Record<string, any>;
}

export interface CoordinationEvent {
  id: string;
  session_id?: string;
  network_id?: string;
  source_agent_id?: string;
  target_agent_id?: string;
  event_type: CoordinationEventEnum;
  priority: EventPriorityEnum;
  message: Record<string, any>;
  status: EventStatusEnum;
  created_at: string;
  processed_at?: string;
  response?: Record<string, any>;
  correlation_id?: string;
  metadata: Record<string, any>;
}

export interface PerformanceMetric {
  id: string;
  session_id?: string;
  network_id?: string;
  agent_id?: string;
  task_id?: string;
  metric_type: PerformanceMetricEnum;
  value: number;
  unit: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface SwarmHealth {
  id: string;
  session_id?: string;
  network_id?: string;
  agent_id?: string;
  health_score: number;
  status: HealthStatusEnum;
  last_check: string;
  issues?: string[];
  diagnostics: Record<string, any>;
  metadata: Record<string, any>;
}

// =============================================================================
// INSERT/UPDATE INTERFACES
// =============================================================================

export type SwarmNetworkInsert = Omit<SwarmNetwork, 'id' | 'created_at' | 'updated_at'>;
export type SwarmNetworkUpdate = Partial<Omit<SwarmNetwork, 'id' | 'created_at' | 'updated_at'>>;

export type SwarmSessionInsert = Omit<SwarmSession, 'id' | 'started_at'>;
export type SwarmSessionUpdate = Partial<Omit<SwarmSession, 'id' | 'started_at'>>;

export type SwarmAgentInsert = Omit<SwarmAgent, 'id' | 'spawned_at'>;
export type SwarmAgentUpdate = Partial<Omit<SwarmAgent, 'id' | 'spawned_at'>>;

export type AgentRelationshipInsert = Omit<AgentRelationship, 'id' | 'created_at'>;
export type AgentRelationshipUpdate = Partial<Omit<AgentRelationship, 'id' | 'created_at'>>;

export type SwarmTaskInsert = Omit<SwarmTask, 'id' | 'created_at'>;
export type SwarmTaskUpdate = Partial<Omit<SwarmTask, 'id' | 'created_at'>>;

export type NeuralPatternInsert = Omit<NeuralPattern, 'id' | 'created_at' | 'updated_at'>;
export type NeuralPatternUpdate = Partial<Omit<NeuralPattern, 'id' | 'created_at' | 'updated_at'>>;

export type SwarmMemoryInsert = Omit<SwarmMemory, 'id' | 'created_at' | 'updated_at'>;
export type SwarmMemoryUpdate = Partial<Omit<SwarmMemory, 'id' | 'created_at' | 'updated_at'>>;

export type CoordinationEventInsert = Omit<CoordinationEvent, 'id' | 'created_at'>;
export type CoordinationEventUpdate = Partial<Omit<CoordinationEvent, 'id' | 'created_at'>>;

export type PerformanceMetricInsert = Omit<PerformanceMetric, 'id' | 'timestamp'>;

export type SwarmHealthInsert = Omit<SwarmHealth, 'id' | 'last_check'>;
export type SwarmHealthUpdate = Partial<Omit<SwarmHealth, 'id' | 'last_check'>>;

// =============================================================================
// ENHANCED INTERFACES WITH COMPUTED FIELDS
// =============================================================================

export interface SwarmNetworkWithStats extends SwarmNetwork {
  active_agents: number;
  total_sessions: number;
  health_score: number;
  avg_efficiency: number;
}

export interface SwarmSessionWithMetrics extends SwarmSession {
  agent_count: number;
  task_count: number;
  completion_rate: number;
  avg_response_time: number;
  network?: SwarmNetwork;
}

export interface SwarmAgentWithPerformance extends SwarmAgent {
  recent_tasks: number;
  avg_efficiency: number;
  coordination_count: number;
  health_status: HealthStatusEnum;
  session?: SwarmSession;
  relationships?: AgentRelationship[];
}

export interface SwarmTaskWithDetails extends SwarmTask {
  agent_details: SwarmAgent[];
  dependency_details: SwarmTask[];
  execution_time?: number;
  efficiency_score?: number;
}

// =============================================================================
// API RESPONSE INTERFACES
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SwarmCoordinationResponse {
  networks: SwarmNetworkWithStats[];
  sessions: SwarmSessionWithMetrics[];
  agents: SwarmAgentWithPerformance[];
  tasks: SwarmTaskWithDetails[];
  metrics: PerformanceMetric[];
  health: SwarmHealth[];
}

export interface CoordinationGraphNode {
  id: string;
  label: string;
  type: 'network' | 'session' | 'agent' | 'task';
  status: string;
  metadata: Record<string, any>;
}

export interface CoordinationGraphEdge {
  source: string;
  target: string;
  type: RelationshipTypeEnum;
  strength: number;
  metadata: Record<string, any>;
}

export interface CoordinationGraph {
  nodes: CoordinationGraphNode[];
  edges: CoordinationGraphEdge[];
  metadata: Record<string, any>;
}

// =============================================================================
// REAL-TIME SUBSCRIPTION INTERFACES
// =============================================================================

export interface RealtimeEvent<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: T;
  timestamp: string;
}

export interface SwarmRealtimeSubscription {
  networks: RealtimeEvent<SwarmNetwork>[];
  sessions: RealtimeEvent<SwarmSession>[];
  agents: RealtimeEvent<SwarmAgent>[];
  tasks: RealtimeEvent<SwarmTask>[];
  events: RealtimeEvent<CoordinationEvent>[];
  metrics: RealtimeEvent<PerformanceMetric>[];
  health: RealtimeEvent<SwarmHealth>[];
}

// =============================================================================
// DASHBOARD INTERFACES
// =============================================================================

export interface SwarmDashboardMetrics {
  total_networks: number;
  active_sessions: number;
  total_agents: number;
  active_agents: number;
  total_tasks: number;
  completed_tasks: number;
  avg_efficiency: number;
  system_health: number;
}

export interface SwarmTimelineEvent {
  id: string;
  timestamp: string;
  type: 'session_start' | 'agent_spawn' | 'task_complete' | 'coordination_event';
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export interface SwarmPerformanceChart {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

// =============================================================================
// HOOK CONFIGURATION INTERFACES
// =============================================================================

export interface SwarmRealtimeConfig {
  networkId?: string;
  sessionId?: string;
  agentId?: string;
  enableNetworks?: boolean;
  enableSessions?: boolean;
  enableAgents?: boolean;
  enableTasks?: boolean;
  enableEvents?: boolean;
  enableMetrics?: boolean;
  enableHealth?: boolean;
}

export interface SwarmQueryConfig {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  include?: string[];
}

export interface SwarmOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type SwarmEntityType = 'network' | 'session' | 'agent' | 'task' | 'memory' | 'event' | 'metric' | 'health';

export type SwarmEntityUnion = 
  | SwarmNetwork 
  | SwarmSession 
  | SwarmAgent 
  | SwarmTask 
  | SwarmMemory 
  | CoordinationEvent 
  | PerformanceMetric 
  | SwarmHealth;

export type SwarmEntityInsertUnion = 
  | SwarmNetworkInsert 
  | SwarmSessionInsert 
  | SwarmAgentInsert 
  | SwarmTaskInsert 
  | SwarmMemoryInsert 
  | CoordinationEventInsert 
  | PerformanceMetricInsert 
  | SwarmHealthInsert;

export type SwarmEntityUpdateUnion = 
  | SwarmNetworkUpdate 
  | SwarmSessionUpdate 
  | SwarmAgentUpdate 
  | SwarmTaskUpdate 
  | SwarmMemoryUpdate 
  | CoordinationEventUpdate 
  | SwarmHealthUpdate;