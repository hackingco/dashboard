/**
 * TypeScript type definitions for Supabase database schema
 * Generated for the Swarm Dashboard backend architecture
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      swarm_sessions: {
        Row: {
          id: string
          session_name: string
          description: string | null
          total_traces: number
          active_traces: number
          total_agents: number
          active_agents: number
          start_time: string
          end_time: string | null
          status: 'active' | 'completed' | 'error'
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_name: string
          description?: string | null
          total_traces?: number
          active_traces?: number
          total_agents?: number
          active_agents?: number
          start_time: string
          end_time?: string | null
          status?: 'active' | 'completed' | 'error'
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_name?: string
          description?: string | null
          total_traces?: number
          active_traces?: number
          total_agents?: number
          active_agents?: number
          start_time?: string
          end_time?: string | null
          status?: 'active' | 'completed' | 'error'
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      swarm_traces: {
        Row: {
          id: string
          session_id: string
          trace_name: string
          trace_data: Json
          status: 'success' | 'error' | 'pending' | 'running'
          duration_ms: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          trace_name: string
          trace_data?: Json
          status?: 'success' | 'error' | 'pending' | 'running'
          duration_ms?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          trace_name?: string
          trace_data?: Json
          status?: 'success' | 'error' | 'pending' | 'running'
          duration_ms?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swarm_traces_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "swarm_sessions"
            referencedColumns: ["id"]
          }
        ]
      }
      swarm_agents: {
        Row: {
          id: string
          name: string
          type: string
          status: 'active' | 'idle' | 'error' | 'offline'
          current_task: string | null
          tasks_completed: number
          average_response_time: number
          memory_usage: number
          cpu_usage: number
          last_activity: string
          swarm_id: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          status?: 'active' | 'idle' | 'error' | 'offline'
          current_task?: string | null
          tasks_completed?: number
          average_response_time?: number
          memory_usage?: number
          cpu_usage?: number
          last_activity?: string
          swarm_id: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          status?: 'active' | 'idle' | 'error' | 'offline'
          current_task?: string | null
          tasks_completed?: number
          average_response_time?: number
          memory_usage?: number
          cpu_usage?: number
          last_activity?: string
          swarm_id?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      swarm_metrics: {
        Row: {
          id: string
          session_id: string
          metric_type: string
          metric_value: number
          metric_data: Json
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          metric_type: string
          metric_value: number
          metric_data?: Json
          timestamp: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          metric_type?: string
          metric_value?: number
          metric_data?: Json
          timestamp?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swarm_metrics_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "swarm_sessions"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_session_owner: {
        Args: {
          session_uuid: string
        }
        Returns: boolean
      }
      is_agent_manager: {
        Args: {
          agent_uuid: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Enhanced type definitions for frontend use
export interface SwarmSession extends Database['public']['Tables']['swarm_sessions']['Row'] {
  // Computed fields
  duration?: number
  traceStats?: {
    total: number
    success: number
    error: number
    running: number
    pending: number
  }
  agentStats?: {
    total: number
    active: number
    idle: number
    error: number
    offline: number
  }
  performance?: {
    avgResponseTime: number
    throughput: number
    errorRate: number
    uptime: number
  }
}

export interface SwarmTrace extends Database['public']['Tables']['swarm_traces']['Row'] {
  // Computed fields
  swarm_sessions?: Pick<SwarmSession, 'session_name' | 'status'>
  // Langfuse compatibility fields
  name?: string
  sessionId?: string
  userId?: string
  timestamp?: Date
  duration?: number
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalCost?: number
  input?: any
  output?: any
  tags?: string[]
  scores?: Record<string, number>
  memoryUsage?: number
  cpuUsage?: number
  agentId?: string
  swarmId?: string
}

export interface SwarmAgent extends Database['public']['Tables']['swarm_agents']['Row'] {
  // Computed fields
  uptime?: number
  efficiency?: number
  loadFactor?: number
}

export interface SwarmMetrics extends Database['public']['Tables']['swarm_metrics']['Row'] {
  // No additional fields needed
}

// Real-time subscription types
export interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
  errors: any[]
}

export interface SwarmRealtimeEvent {
  traces?: RealtimePayload<SwarmTrace>
  agents?: RealtimePayload<SwarmAgent>
  sessions?: RealtimePayload<SwarmSession>
  metrics?: RealtimePayload<SwarmMetrics>
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  count?: number
  timestamp?: string
}

export interface TracesApiResponse extends ApiResponse {
  traces: SwarmTrace[]
  real_time?: boolean
}

export interface AgentsApiResponse extends ApiResponse {
  agents: SwarmAgent[]
  metrics?: {
    totalAgents: number
    activeAgents: number
    idleAgents: number
    errorAgents: number
    totalTasks: number
    averageResponseTime: number
    totalMemoryUsage: number
    totalCpuUsage: number
    averageEfficiency: number
  }
}

export interface SessionsApiResponse extends ApiResponse {
  sessions: SwarmSession[]
}

export interface MetricsApiResponse extends ApiResponse {
  metrics: any[]
  summary?: Record<string, any>
  systemMetrics?: {
    timestamp: string
    system: Record<string, number>
    performance: Record<string, number>
    health: Record<string, number>
  }
  timeRange?: string
  aggregation?: string
}

// Hook types
export interface UseRealtimeSwarmOptions {
  sessionId?: string
  swarmId?: string
  enableTraces?: boolean
  enableAgents?: boolean
  enableMetrics?: boolean
  enableSessions?: boolean
  maxItems?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export interface SwarmRealtimeData {
  traces: SwarmTrace[]
  agents: SwarmAgent[]
  sessions: SwarmSession[]
  metrics: SwarmMetrics[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  subscriptionStatus: {
    traces: boolean
    agents: boolean
    sessions: boolean
    metrics: boolean
  }
}

export interface SwarmMetricsAggregated {
  totalTraces: number
  activeTraces: number
  totalAgents: number
  activeAgents: number
  averageResponseTime: number
  errorRate: number
  throughput: number
  systemHealth: number
}