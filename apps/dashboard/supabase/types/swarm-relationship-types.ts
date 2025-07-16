/**
 * =====================================================================================
 * Swarm Relationship Schema TypeScript Definitions
 * Version: 20250714_003
 * Author: Schema Developer Agent
 * Description: Comprehensive type definitions for swarm coordination and observability
 * =====================================================================================
 */

import { Database } from '../../../lib/supabase-types';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// =====================================================================================
// CORE SWARM RELATIONSHIP TYPES
// =====================================================================================

export interface SwarmNetworkRow {
  id: string
  name: string
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star'
  strategy: 'balanced' | 'specialized' | 'adaptive'
  max_agents: number
  current_agents: number
  status: 'initializing' | 'active' | 'scaling' | 'paused' | 'error' | 'terminated'
  description: string | null
  config: Json
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
  organization_id: string | null
}

export interface SwarmNetworkInsert {
  id?: string
  name: string
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star'
  strategy?: 'balanced' | 'specialized' | 'adaptive'
  max_agents?: number
  current_agents?: number
  status?: 'initializing' | 'active' | 'scaling' | 'paused' | 'error' | 'terminated'
  description?: string | null
  config?: Json
  metadata?: Json
  created_at?: string
  updated_at?: string
  created_by?: string | null
  organization_id?: string | null
}

export interface SwarmNetworkUpdate {
  id?: string
  name?: string
  topology?: 'mesh' | 'hierarchical' | 'ring' | 'star'
  strategy?: 'balanced' | 'specialized' | 'adaptive'
  max_agents?: number
  current_agents?: number
  status?: 'initializing' | 'active' | 'scaling' | 'paused' | 'error' | 'terminated'
  description?: string | null
  config?: Json
  metadata?: Json
  created_at?: string
  updated_at?: string
  created_by?: string | null
  organization_id?: string | null
}

export interface SwarmAgentRow {
  id: string
  network_id: string
  name: string
  type: 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist'
  status: 'active' | 'idle' | 'busy' | 'error' | 'offline' | 'spawning'
  capabilities: Json
  current_task: string | null
  tasks_completed: number
  tasks_failed: number
  average_response_time: number
  memory_usage: number
  cpu_usage: number
  efficiency_score: number
  coordination_weight: number
  last_activity: string
  last_heartbeat: string
  spawn_config: Json
  performance_metrics: Json
  metadata: Json
  created_at: string
  updated_at: string
}

export interface SwarmAgentInsert {
  id?: string
  network_id: string
  name: string
  type: 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist'
  status?: 'active' | 'idle' | 'busy' | 'error' | 'offline' | 'spawning'
  capabilities?: Json
  current_task?: string | null
  tasks_completed?: number
  tasks_failed?: number
  average_response_time?: number
  memory_usage?: number
  cpu_usage?: number
  efficiency_score?: number
  coordination_weight?: number
  last_activity?: string
  last_heartbeat?: string
  spawn_config?: Json
  performance_metrics?: Json
  metadata?: Json
  created_at?: string
  updated_at?: string
}

export interface SwarmAgentUpdate {
  id?: string
  network_id?: string
  name?: string
  type?: 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist'
  status?: 'active' | 'idle' | 'busy' | 'error' | 'offline' | 'spawning'
  capabilities?: Json
  current_task?: string | null
  tasks_completed?: number
  tasks_failed?: number
  average_response_time?: number
  memory_usage?: number
  cpu_usage?: number
  efficiency_score?: number
  coordination_weight?: number
  last_activity?: string
  last_heartbeat?: string
  spawn_config?: Json
  performance_metrics?: Json
  metadata?: Json
  created_at?: string
  updated_at?: string
}

export interface AgentRelationshipRow {
  id: string
  source_agent_id: string
  target_agent_id: string
  relationship_type: 'coordination' | 'supervision' | 'collaboration' | 'dependency' | 'conflict' | 'backup'
  strength: number
  communication_protocol: string
  status: 'active' | 'paused' | 'broken' | 'terminated'
  metrics: Json
  metadata: Json
  created_at: string
  updated_at: string
}

export interface TaskOrchestrationRow {
  id: string
  network_id: string
  task_name: string
  description: string | null
  strategy: 'parallel' | 'sequential' | 'adaptive' | 'balanced'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  assigned_agents: string[]
  dependencies: string[]
  max_parallel_agents: number
  input_data: Json
  output_data: Json
  progress_percentage: number
  estimated_duration: number | null
  actual_duration: number | null
  error_details: string | null
  retry_count: number
  max_retries: number
  started_at: string | null
  completed_at: string | null
  deadline: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export interface NeuralPatternRow {
  id: string
  network_id: string
  pattern_type: 'convergent' | 'divergent' | 'lateral' | 'systems' | 'critical' | 'adaptive' | 'coordination' | 'optimization' | 'prediction'
  pattern_data: Json
  effectiveness_score: number
  usage_count: number
  success_rate: number
  training_data: Json
  model_version: string
  is_active: boolean
  learned_from_task_id: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export interface SwarmMemoryRow {
  id: string
  network_id: string
  memory_key: string
  memory_namespace: string
  memory_value: Json
  memory_type: 'general' | 'coordination' | 'task' | 'performance' | 'learning' | 'error' | 'config'
  access_count: number
  ttl_seconds: number | null
  expires_at: string | null
  priority: number
  is_encrypted: boolean
  tags: string[]
  created_by_agent_id: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

// =====================================================================================
// OBSERVABILITY AND MONITORING TYPES
// =====================================================================================

export interface CoordinationEventRow {
  id: string
  network_id: string
  agent_id: string | null
  event_type: string
  event_category: 'coordination' | 'communication' | 'task' | 'error' | 'performance' | 'lifecycle'
  event_data: Json
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  source: string | null
  target: string | null
  correlation_id: string | null
  trace_id: string | null
  span_id: string | null
  duration_ms: number | null
  metadata: Json
  created_at: string
}

export interface PerformanceMetricRow {
  id: string
  network_id: string
  agent_id: string | null
  metric_name: string
  metric_category: 'performance' | 'efficiency' | 'coordination' | 'resource' | 'quality' | 'throughput'
  metric_value: number
  unit: string | null
  aggregation_type: 'instant' | 'avg' | 'sum' | 'min' | 'max' | 'count'
  time_window_seconds: number
  tags: Json
  metadata: Json
  created_at: string
}

export interface HealthCheckRow {
  id: string
  network_id: string
  agent_id: string | null
  check_type: 'heartbeat' | 'resource' | 'connectivity' | 'performance' | 'coordination' | 'task_capacity'
  status: 'healthy' | 'warning' | 'error' | 'critical' | 'unknown'
  check_data: Json
  error_message: string | null
  response_time_ms: number | null
  threshold_values: Json
  remediation_actions: Json
  metadata: Json
  created_at: string
}

// =====================================================================================
// ENHANCED INTERFACE TYPES
// =====================================================================================

export interface SwarmNetwork extends SwarmNetworkRow {
  // Computed fields
  agents?: SwarmAgent[]
  tasks?: TaskOrchestration[]
  duration?: number
  efficiency?: number
  load_factor?: number
  health_score?: number
  coordination_quality?: number
  
  // Statistics
  agent_stats?: {
    total: number
    active: number
    idle: number
    busy: number
    error: number
    offline: number
    by_type: Record<string, number>
  }
  
  task_stats?: {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
    avg_duration: number
    success_rate: number
  }
  
  performance_stats?: {
    avg_response_time: number
    total_memory_usage: number
    total_cpu_usage: number
    avg_efficiency: number
    throughput: number
    error_rate: number
    uptime: number
  }
  
  neural_stats?: {
    active_patterns: number
    avg_effectiveness: number
    learning_rate: number
    adaptation_speed: number
  }
}

export interface SwarmAgent extends SwarmAgentRow {
  // Computed fields
  network?: Pick<SwarmNetwork, 'id' | 'name' | 'topology' | 'status'>
  relationships?: AgentRelationship[]
  current_tasks?: TaskOrchestration[]
  
  // Performance metrics
  uptime?: number
  task_success_rate?: number
  coordination_effectiveness?: number
  resource_efficiency?: number
  response_reliability?: number
  
  // Health indicators
  health_status?: 'healthy' | 'warning' | 'error' | 'critical'
  connectivity_score?: number
  performance_trend?: 'improving' | 'stable' | 'declining'
}

export interface AgentRelationship extends AgentRelationshipRow {
  source_agent?: Pick<SwarmAgent, 'id' | 'name' | 'type' | 'status'>
  target_agent?: Pick<SwarmAgent, 'id' | 'name' | 'type' | 'status'>
  
  // Computed metrics
  communication_frequency?: number
  collaboration_success_rate?: number
  conflict_resolution_time?: number
  trust_score?: number
}

export interface TaskOrchestration extends TaskOrchestrationRow {
  network?: Pick<SwarmNetwork, 'id' | 'name' | 'status'>
  assigned_agent_details?: Pick<SwarmAgent, 'id' | 'name' | 'type' | 'status'>[]
  
  // Computed fields
  duration?: number
  efficiency_score?: number
  resource_utilization?: number
  coordination_overhead?: number
  blockers?: string[]
  critical_path?: string[]
}

export interface NeuralPattern extends NeuralPatternRow {
  network?: Pick<SwarmNetwork, 'id' | 'name'>
  learned_from_task?: Pick<TaskOrchestration, 'id' | 'task_name' | 'status'>
  
  // Computed metrics
  adaptation_rate?: number
  learning_velocity?: number
  pattern_stability?: number
  cross_network_applicability?: number
}

export interface SwarmMemory extends SwarmMemoryRow {
  network?: Pick<SwarmNetwork, 'id' | 'name'>
  created_by_agent?: Pick<SwarmAgent, 'id' | 'name' | 'type'>
  
  // Computed fields
  usage_frequency?: number
  memory_importance?: number
  retrieval_speed?: number
  data_freshness?: number
}

// =====================================================================================
// API RESPONSE TYPES
// =====================================================================================

export interface SwarmApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  count?: number
  timestamp?: string
  metadata?: Json
  pagination?: {
    page: number
    limit: number
    total: number
    has_more: boolean
  }
}

export interface SwarmNetworksResponse extends SwarmApiResponse {
  networks: SwarmNetwork[]
  summary?: {
    total_networks: number
    active_networks: number
    total_agents: number
    active_agents: number
    total_tasks: number
    running_tasks: number
    system_health: number
  }
}

export interface SwarmAgentsResponse extends SwarmApiResponse {
  agents: SwarmAgent[]
  network_summary?: {
    network_id: string
    network_name: string
    topology: string
    agent_distribution: Record<string, number>
    coordination_health: number
  }
}

export interface TaskOrchestrationResponse extends SwarmApiResponse {
  tasks: TaskOrchestration[]
  execution_summary?: {
    total_tasks: number
    success_rate: number
    avg_duration: number
    resource_efficiency: number
    coordination_overhead: number
  }
}

export interface CoordinationEventsResponse extends SwarmApiResponse {
  events: CoordinationEventRow[]
  event_summary?: {
    total_events: number
    by_severity: Record<string, number>
    by_category: Record<string, number>
    error_rate: number
    avg_duration: number
  }
}

export interface PerformanceMetricsResponse extends SwarmApiResponse {
  metrics: PerformanceMetricRow[]
  aggregated_metrics?: {
    system_performance: Record<string, number>
    agent_performance: Record<string, number>
    network_performance: Record<string, number>
    time_series: Array<{
      timestamp: string
      metrics: Record<string, number>
    }>
  }
}

// =====================================================================================
// REAL-TIME SUBSCRIPTION TYPES
// =====================================================================================

export interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
  errors: any[]
  timestamp: string
}

export interface SwarmRealtimeEvent {
  networks?: RealtimePayload<SwarmNetwork>
  agents?: RealtimePayload<SwarmAgent>
  relationships?: RealtimePayload<AgentRelationship>
  tasks?: RealtimePayload<TaskOrchestration>
  events?: RealtimePayload<CoordinationEventRow>
  metrics?: RealtimePayload<PerformanceMetricRow>
  health?: RealtimePayload<HealthCheckRow>
  memory?: RealtimePayload<SwarmMemory>
  patterns?: RealtimePayload<NeuralPattern>
}

export interface SwarmRealtimeData {
  networks: SwarmNetwork[]
  agents: SwarmAgent[]
  relationships: AgentRelationship[]
  tasks: TaskOrchestration[]
  events: CoordinationEventRow[]
  metrics: PerformanceMetricRow[]
  health_checks: HealthCheckRow[]
  memory_bank: SwarmMemory[]
  neural_patterns: NeuralPattern[]
  
  // Connection status
  is_connected: boolean
  is_loading: boolean
  error: string | null
  last_update: Date | null
  
  // Subscription status
  subscription_status: {
    networks: boolean
    agents: boolean
    relationships: boolean
    tasks: boolean
    events: boolean
    metrics: boolean
    health: boolean
    memory: boolean
    patterns: boolean
  }
}

// =====================================================================================
// HOOK CONFIGURATION TYPES
// =====================================================================================

export interface UseSwarmRealtimeOptions {
  network_id?: string
  agent_id?: string
  enable_networks?: boolean
  enable_agents?: boolean
  enable_relationships?: boolean
  enable_tasks?: boolean
  enable_events?: boolean
  enable_metrics?: boolean
  enable_health?: boolean
  enable_memory?: boolean
  enable_patterns?: boolean
  max_items?: number
  auto_refresh?: boolean
  refresh_interval?: number
  real_time_filters?: {
    severity?: string[]
    event_category?: string[]
    metric_category?: string[]
    agent_types?: string[]
    task_status?: string[]
  }
}

// =====================================================================================
// UTILITY TYPES
// =====================================================================================

export type SwarmTopologyType = SwarmNetworkRow['topology']
export type SwarmStrategyType = SwarmNetworkRow['strategy']
export type SwarmStatusType = SwarmNetworkRow['status']
export type AgentType = SwarmAgentRow['type']
export type AgentStatusType = SwarmAgentRow['status']
export type RelationshipType = AgentRelationshipRow['relationship_type']
export type TaskStrategyType = TaskOrchestrationRow['strategy']
export type TaskPriorityType = TaskOrchestrationRow['priority']
export type TaskStatusType = TaskOrchestrationRow['status']
export type NeuralPatternType = NeuralPatternRow['pattern_type']
export type MemoryType = SwarmMemoryRow['memory_type']
export type EventSeverityType = CoordinationEventRow['severity']
export type EventCategoryType = CoordinationEventRow['event_category']
export type MetricCategoryType = PerformanceMetricRow['metric_category']
export type HealthStatusType = HealthCheckRow['status']
export type CheckType = HealthCheckRow['check_type']

// =====================================================================================
// EXTENDED DATABASE INTERFACE
// =====================================================================================

export interface SwarmDatabase extends Database {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      swarm_networks: {
        Row: SwarmNetworkRow
        Insert: SwarmNetworkInsert
        Update: SwarmNetworkUpdate
        Relationships: []
      }
      swarm_agents: {
        Row: SwarmAgentRow
        Insert: SwarmAgentInsert
        Update: SwarmAgentUpdate
        Relationships: [
          {
            foreignKeyName: "swarm_agents_network_id_fkey"
            columns: ["network_id"]
            referencedRelation: "swarm_networks"
            referencedColumns: ["id"]
          }
        ]
      }
      agent_relationships: {
        Row: AgentRelationshipRow
        Insert: Omit<AgentRelationshipRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AgentRelationshipRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "agent_relationships_source_agent_id_fkey"
            columns: ["source_agent_id"]
            referencedRelation: "swarm_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_relationships_target_agent_id_fkey"
            columns: ["target_agent_id"]
            referencedRelation: "swarm_agents"
            referencedColumns: ["id"]
          }
        ]
      }
      task_orchestration: {
        Row: TaskOrchestrationRow
        Insert: Omit<TaskOrchestrationRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TaskOrchestrationRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "task_orchestration_network_id_fkey"
            columns: ["network_id"]
            referencedRelation: "swarm_networks"
            referencedColumns: ["id"]
          }
        ]
      }
      neural_patterns: {
        Row: NeuralPatternRow
        Insert: Omit<NeuralPatternRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NeuralPatternRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "neural_patterns_network_id_fkey"
            columns: ["network_id"]
            referencedRelation: "swarm_networks"
            referencedColumns: ["id"]
          }
        ]
      }
      swarm_memory: {
        Row: SwarmMemoryRow
        Insert: Omit<SwarmMemoryRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SwarmMemoryRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: "swarm_memory_network_id_fkey"
            columns: ["network_id"]
            referencedRelation: "swarm_networks"
            referencedColumns: ["id"]
          }
        ]
      }
      coordination_events: {
        Row: CoordinationEventRow
        Insert: Omit<CoordinationEventRow, 'id' | 'created_at'>
        Update: never // Events are immutable
        Relationships: [
          {
            foreignKeyName: "coordination_events_network_id_fkey"
            columns: ["network_id"]
            referencedRelation: "swarm_networks"
            referencedColumns: ["id"]
          }
        ]
      }
      performance_metrics: {
        Row: PerformanceMetricRow
        Insert: Omit<PerformanceMetricRow, 'id' | 'created_at'>
        Update: never // Metrics are immutable
        Relationships: [
          {
            foreignKeyName: "performance_metrics_network_id_fkey"
            columns: ["network_id"]
            referencedRelation: "swarm_networks"
            referencedColumns: ["id"]
          }
        ]
      }
      health_checks: {
        Row: HealthCheckRow
        Insert: Omit<HealthCheckRow, 'id' | 'created_at'>
        Update: never // Health checks are immutable
        Relationships: [
          {
            foreignKeyName: "health_checks_network_id_fkey"
            columns: ["network_id"]
            referencedRelation: "swarm_networks"
            referencedColumns: ["id"]
          }
        ]
      }
    }
  }
}