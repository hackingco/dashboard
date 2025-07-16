/**
 * Enhanced TypeScript definitions for comprehensive swarm relationship schema
 * Extends the base supabase-types.ts with new coordination and relationship tables
 */

import { Database } from './supabase-types';

// Re-export base types
export * from './supabase-types';

// Enhanced Database interface with new tables
export interface EnhancedDatabase extends Database {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      // ==========================================
      // SWARM TOPOLOGY AND RELATIONSHIPS
      // ==========================================
      
      swarm_topologies: {
        Row: {
          id: string
          swarm_id: string
          topology_type: 'mesh' | 'hierarchical' | 'ring' | 'star'
          max_agents: number
          strategy: 'balanced' | 'specialized' | 'adaptive' | 'parallel' | 'sequential'
          coordination_rules: Json
          performance_metrics: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          swarm_id: string
          topology_type: 'mesh' | 'hierarchical' | 'ring' | 'star'
          max_agents?: number
          strategy: 'balanced' | 'specialized' | 'adaptive' | 'parallel' | 'sequential'
          coordination_rules?: Json
          performance_metrics?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string
          topology_type?: 'mesh' | 'hierarchical' | 'ring' | 'star'
          max_agents?: number
          strategy?: 'balanced' | 'specialized' | 'adaptive' | 'parallel' | 'sequential'
          coordination_rules?: Json
          performance_metrics?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swarm_topologies_swarm_id_fkey"
            columns: ["swarm_id"]
            referencedRelation: "swarms"
            referencedColumns: ["id"]
          }
        ]
      }

      agent_types: {
        Row: {
          id: string
          name: string
          category: 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist'
          capabilities: string[]
          required_memory_mb: number
          cpu_requirements: Json
          coordination_protocols: Json
          neural_patterns: Json
          description: string | null
          is_system_type: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist'
          capabilities?: string[]
          required_memory_mb?: number
          cpu_requirements?: Json
          coordination_protocols?: Json
          neural_patterns?: Json
          description?: string | null
          is_system_type?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist'
          capabilities?: string[]
          required_memory_mb?: number
          cpu_requirements?: Json
          coordination_protocols?: Json
          neural_patterns?: Json
          description?: string | null
          is_system_type?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // ==========================================
      // COORDINATION SESSIONS
      // ==========================================

      swarm_coordination_sessions: {
        Row: {
          id: string
          swarm_id: string
          session_name: string
          session_type: 'development' | 'research' | 'analysis' | 'testing' | 'deployment' | 'coordination' | 'training'
          orchestration_strategy: 'parallel' | 'sequential' | 'adaptive' | 'balanced'
          participant_agents: string[]
          coordination_graph: Json
          memory_namespace: string
          session_state: 'initializing' | 'active' | 'paused' | 'completed' | 'failed' | 'archived'
          total_tasks: number
          completed_tasks: number
          failed_tasks: number
          performance_metrics: Json
          coordination_efficiency: number
          started_at: string
          ended_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          swarm_id: string
          session_name: string
          session_type: 'development' | 'research' | 'analysis' | 'testing' | 'deployment' | 'coordination' | 'training'
          orchestration_strategy: 'parallel' | 'sequential' | 'adaptive' | 'balanced'
          participant_agents?: string[]
          coordination_graph?: Json
          memory_namespace?: string
          session_state?: 'initializing' | 'active' | 'paused' | 'completed' | 'failed' | 'archived'
          total_tasks?: number
          completed_tasks?: number
          failed_tasks?: number
          performance_metrics?: Json
          coordination_efficiency?: number
          started_at?: string
          ended_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string
          session_name?: string
          session_type?: 'development' | 'research' | 'analysis' | 'testing' | 'deployment' | 'coordination' | 'training'
          orchestration_strategy?: 'parallel' | 'sequential' | 'adaptive' | 'balanced'
          participant_agents?: string[]
          coordination_graph?: Json
          memory_namespace?: string
          session_state?: 'initializing' | 'active' | 'paused' | 'completed' | 'failed' | 'archived'
          total_tasks?: number
          completed_tasks?: number
          failed_tasks?: number
          performance_metrics?: Json
          coordination_efficiency?: number
          started_at?: string
          ended_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swarm_coordination_sessions_swarm_id_fkey"
            columns: ["swarm_id"]
            referencedRelation: "swarms"
            referencedColumns: ["id"]
          }
        ]
      }

      agent_relationships: {
        Row: {
          id: string
          parent_agent_id: string
          child_agent_id: string
          relationship_type: 'coordination' | 'supervision' | 'collaboration' | 'specialization' | 'backup'
          strength: number
          coordination_protocol: Json
          communication_frequency: number
          last_communication: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_agent_id: string
          child_agent_id: string
          relationship_type: 'coordination' | 'supervision' | 'collaboration' | 'specialization' | 'backup'
          strength?: number
          coordination_protocol?: Json
          communication_frequency?: number
          last_communication?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_agent_id?: string
          child_agent_id?: string
          relationship_type?: 'coordination' | 'supervision' | 'collaboration' | 'specialization' | 'backup'
          strength?: number
          coordination_protocol?: Json
          communication_frequency?: number
          last_communication?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_relationships_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_relationships_child_agent_id_fkey"
            columns: ["child_agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          }
        ]
      }

      // ==========================================
      // TASK ORCHESTRATION
      // ==========================================

      task_dependencies: {
        Row: {
          id: string
          task_id: string
          dependency_task_id: string
          dependency_type: 'hard' | 'soft' | 'parallel' | 'conditional'
          condition: Json
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          dependency_task_id: string
          dependency_type: 'hard' | 'soft' | 'parallel' | 'conditional'
          condition?: Json
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          dependency_task_id?: string
          dependency_type?: 'hard' | 'soft' | 'parallel' | 'conditional'
          condition?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_dependency_task_id_fkey"
            columns: ["dependency_task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }

      task_orchestrations: {
        Row: {
          id: string
          session_id: string
          orchestration_name: string
          execution_plan: Json
          assigned_agents: string[]
          current_phase: string | null
          total_phases: number
          parallel_execution: boolean
          auto_recovery: boolean
          timeout_seconds: number
          progress_percentage: number
          orchestration_state: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
          results: Json
          performance_metrics: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          orchestration_name: string
          execution_plan: Json
          assigned_agents?: string[]
          current_phase?: string | null
          total_phases?: number
          parallel_execution?: boolean
          auto_recovery?: boolean
          timeout_seconds?: number
          progress_percentage?: number
          orchestration_state?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
          results?: Json
          performance_metrics?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          orchestration_name?: string
          execution_plan?: Json
          assigned_agents?: string[]
          current_phase?: string | null
          total_phases?: number
          parallel_execution?: boolean
          auto_recovery?: boolean
          timeout_seconds?: number
          progress_percentage?: number
          orchestration_state?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
          results?: Json
          performance_metrics?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_orchestrations_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "swarm_coordination_sessions"
            referencedColumns: ["id"]
          }
        ]
      }

      // ==========================================
      // MEMORY AND KNOWLEDGE
      // ==========================================

      swarm_memory_store: {
        Row: {
          id: string
          swarm_id: string
          namespace: string
          memory_key: string
          memory_value: Json
          memory_type: 'context' | 'decision' | 'learning' | 'coordination' | 'template' | 'pattern'
          owner_agent_id: string | null
          shared_with_agents: string[]
          access_level: 'private' | 'shared' | 'public'
          ttl_seconds: number | null
          expires_at: string | null
          version: number
          tags: string[]
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          swarm_id: string
          namespace?: string
          memory_key: string
          memory_value: Json
          memory_type: 'context' | 'decision' | 'learning' | 'coordination' | 'template' | 'pattern'
          owner_agent_id?: string | null
          shared_with_agents?: string[]
          access_level?: 'private' | 'shared' | 'public'
          ttl_seconds?: number | null
          expires_at?: string | null
          version?: number
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string
          namespace?: string
          memory_key?: string
          memory_value?: Json
          memory_type?: 'context' | 'decision' | 'learning' | 'coordination' | 'template' | 'pattern'
          owner_agent_id?: string | null
          shared_with_agents?: string[]
          access_level?: 'private' | 'shared' | 'public'
          ttl_seconds?: number | null
          expires_at?: string | null
          version?: number
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swarm_memory_store_swarm_id_fkey"
            columns: ["swarm_id"]
            referencedRelation: "swarms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swarm_memory_store_owner_agent_id_fkey"
            columns: ["owner_agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          }
        ]
      }

      memory_access_log: {
        Row: {
          id: string
          memory_store_id: string
          agent_id: string
          access_type: 'read' | 'write' | 'delete' | 'share'
          access_result: 'success' | 'denied' | 'not_found' | 'expired'
          context: Json
          accessed_at: string
        }
        Insert: {
          id?: string
          memory_store_id: string
          agent_id: string
          access_type: 'read' | 'write' | 'delete' | 'share'
          access_result: 'success' | 'denied' | 'not_found' | 'expired'
          context?: Json
          accessed_at?: string
        }
        Update: {
          id?: string
          memory_store_id?: string
          agent_id?: string
          access_type?: 'read' | 'write' | 'delete' | 'share'
          access_result?: 'success' | 'denied' | 'not_found' | 'expired'
          context?: Json
          accessed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_access_log_memory_store_id_fkey"
            columns: ["memory_store_id"]
            referencedRelation: "swarm_memory_store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_access_log_agent_id_fkey"
            columns: ["agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          }
        ]
      }

      // ==========================================
      // NEURAL AND LEARNING
      // ==========================================

      neural_training_sessions: {
        Row: {
          id: string
          agent_id: string
          training_type: 'coordination' | 'optimization' | 'prediction' | 'pattern_recognition' | 'adaptation'
          training_data: Json
          neural_pattern: 'convergent' | 'divergent' | 'lateral' | 'systems' | 'critical' | 'adaptive'
          epochs: number
          learning_rate: number
          performance_before: number
          performance_after: number
          improvement_percentage: number
          weights_before: Json
          weights_after: Json
          training_metadata: Json
          started_at: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          training_type: 'coordination' | 'optimization' | 'prediction' | 'pattern_recognition' | 'adaptation'
          training_data: Json
          neural_pattern: 'convergent' | 'divergent' | 'lateral' | 'systems' | 'critical' | 'adaptive'
          epochs?: number
          learning_rate?: number
          performance_before?: number
          performance_after?: number
          improvement_percentage?: number
          weights_before?: Json
          weights_after?: Json
          training_metadata?: Json
          started_at?: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          training_type?: 'coordination' | 'optimization' | 'prediction' | 'pattern_recognition' | 'adaptation'
          training_data?: Json
          neural_pattern?: 'convergent' | 'divergent' | 'lateral' | 'systems' | 'critical' | 'adaptive'
          epochs?: number
          learning_rate?: number
          performance_before?: number
          performance_after?: number
          improvement_percentage?: number
          weights_before?: Json
          weights_after?: Json
          training_metadata?: Json
          started_at?: string
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "neural_training_sessions_agent_id_fkey"
            columns: ["agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          }
        ]
      }

      knowledge_transfer_log: {
        Row: {
          id: string
          source_agent_id: string
          target_agent_id: string
          knowledge_domain: string
          knowledge_content: Json
          transfer_method: 'direct' | 'gradual' | 'adaptive' | 'pattern_based'
          success_rate: number
          integration_score: number
          performance_impact: number
          metadata: Json
          transferred_at: string
        }
        Insert: {
          id?: string
          source_agent_id: string
          target_agent_id: string
          knowledge_domain: string
          knowledge_content: Json
          transfer_method: 'direct' | 'gradual' | 'adaptive' | 'pattern_based'
          success_rate?: number
          integration_score?: number
          performance_impact?: number
          metadata?: Json
          transferred_at?: string
        }
        Update: {
          id?: string
          source_agent_id?: string
          target_agent_id?: string
          knowledge_domain?: string
          knowledge_content?: Json
          transfer_method?: 'direct' | 'gradual' | 'adaptive' | 'pattern_based'
          success_rate?: number
          integration_score?: number
          performance_impact?: number
          metadata?: Json
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_transfer_log_source_agent_id_fkey"
            columns: ["source_agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_transfer_log_target_agent_id_fkey"
            columns: ["target_agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          }
        ]
      }

      // ==========================================
      // REAL-TIME COORDINATION
      // ==========================================

      agent_heartbeats: {
        Row: {
          id: string
          agent_id: string
          status: 'active' | 'idle' | 'busy' | 'error' | 'offline' | 'starting' | 'stopping'
          current_task_id: string | null
          cpu_usage: number
          memory_usage: number
          coordination_load: number
          response_time_ms: number
          error_count: number
          last_communication: string
          health_score: number
          metadata: Json
          heartbeat_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          status: 'active' | 'idle' | 'busy' | 'error' | 'offline' | 'starting' | 'stopping'
          current_task_id?: string | null
          cpu_usage?: number
          memory_usage?: number
          coordination_load?: number
          response_time_ms?: number
          error_count?: number
          last_communication?: string
          health_score?: number
          metadata?: Json
          heartbeat_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          status?: 'active' | 'idle' | 'busy' | 'error' | 'offline' | 'starting' | 'stopping'
          current_task_id?: string | null
          cpu_usage?: number
          memory_usage?: number
          coordination_load?: number
          response_time_ms?: number
          error_count?: number
          last_communication?: string
          health_score?: number
          metadata?: Json
          heartbeat_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_heartbeats_agent_id_fkey"
            columns: ["agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_heartbeats_current_task_id_fkey"
            columns: ["current_task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }

      coordination_events: {
        Row: {
          id: string
          swarm_id: string
          session_id: string | null
          event_type: 'agent_spawn' | 'agent_stop' | 'task_start' | 'task_complete' | 'coordination_update' | 'memory_update' | 'error' | 'system_alert'
          source_agent_id: string | null
          target_agents: string[]
          event_data: Json
          priority: 'low' | 'normal' | 'high' | 'critical'
          requires_response: boolean
          response_data: Json
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          swarm_id: string
          session_id?: string | null
          event_type: 'agent_spawn' | 'agent_stop' | 'task_start' | 'task_complete' | 'coordination_update' | 'memory_update' | 'error' | 'system_alert'
          source_agent_id?: string | null
          target_agents?: string[]
          event_data: Json
          priority?: 'low' | 'normal' | 'high' | 'critical'
          requires_response?: boolean
          response_data?: Json
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string
          session_id?: string | null
          event_type?: 'agent_spawn' | 'agent_stop' | 'task_start' | 'task_complete' | 'coordination_update' | 'memory_update' | 'error' | 'system_alert'
          source_agent_id?: string | null
          target_agents?: string[]
          event_data?: Json
          priority?: 'low' | 'normal' | 'high' | 'critical'
          requires_response?: boolean
          response_data?: Json
          processed?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordination_events_swarm_id_fkey"
            columns: ["swarm_id"]
            referencedRelation: "swarms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordination_events_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "swarm_coordination_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordination_events_source_agent_id_fkey"
            columns: ["source_agent_id"]
            referencedRelation: "workers"
            referencedColumns: ["id"]
          }
        ]
      }

      // ==========================================
      // PERFORMANCE ANALYTICS
      // ==========================================

      swarm_performance_snapshots: {
        Row: {
          id: string
          swarm_id: string
          session_id: string | null
          total_agents: number
          active_agents: number
          avg_agent_performance: number
          coordination_efficiency: number
          tasks_completed_per_hour: number
          avg_task_completion_time: number
          task_success_rate: number
          memory_utilization: number
          cpu_utilization: number
          network_efficiency: number
          communication_frequency: number
          coordination_overhead: number
          decision_latency: number
          learning_rate: number
          knowledge_sharing_rate: number
          adaptation_speed: number
          snapshot_metadata: Json
          snapshot_at: string
        }
        Insert: {
          id?: string
          swarm_id: string
          session_id?: string | null
          total_agents?: number
          active_agents?: number
          avg_agent_performance?: number
          coordination_efficiency?: number
          tasks_completed_per_hour?: number
          avg_task_completion_time?: number
          task_success_rate?: number
          memory_utilization?: number
          cpu_utilization?: number
          network_efficiency?: number
          communication_frequency?: number
          coordination_overhead?: number
          decision_latency?: number
          learning_rate?: number
          knowledge_sharing_rate?: number
          adaptation_speed?: number
          snapshot_metadata?: Json
          snapshot_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string
          session_id?: string | null
          total_agents?: number
          active_agents?: number
          avg_agent_performance?: number
          coordination_efficiency?: number
          tasks_completed_per_hour?: number
          avg_task_completion_time?: number
          task_success_rate?: number
          memory_utilization?: number
          cpu_utilization?: number
          network_efficiency?: number
          communication_frequency?: number
          coordination_overhead?: number
          decision_latency?: number
          learning_rate?: number
          knowledge_sharing_rate?: number
          adaptation_speed?: number
          snapshot_metadata?: Json
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swarm_performance_snapshots_swarm_id_fkey"
            columns: ["swarm_id"]
            referencedRelation: "swarms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swarm_performance_snapshots_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "swarm_coordination_sessions"
            referencedColumns: ["id"]
          }
        ]
      }
    }

    Functions: Database['public']['Functions'] & {
      calculate_coordination_efficiency: {
        Args: {
          p_swarm_id: string
        }
        Returns: number
      }
      get_agent_coordination_graph: {
        Args: {
          p_swarm_id: string
        }
        Returns: Json
      }
      cleanup_swarm_data: {
        Args: {}
        Returns: number
      }
    }
  }
}

// ==========================================
// ENHANCED TYPE DEFINITIONS
// ==========================================

export interface SwarmTopology extends EnhancedDatabase['public']['Tables']['swarm_topologies']['Row'] {
  swarm?: {
    name: string
    status: string
  }
  agentCount?: number
  performanceScore?: number
}

export interface AgentType extends EnhancedDatabase['public']['Tables']['agent_types']['Row'] {
  activeInstances?: number
  averagePerformance?: number
}

export interface EnhancedWorker extends Database['public']['Tables']['workers']['Row'] {
  agent_type_id?: string | null
  parent_agent_id?: string | null
  coordination_state?: Json
  neural_weights?: Json
  memory_capacity_mb?: number
  current_memory_usage_mb?: number
  performance_score?: number
  specialization_tags?: string[]
  
  // Relationships
  agent_type?: AgentType
  parent_agent?: EnhancedWorker
  child_agents?: EnhancedWorker[]
  relationships?: AgentRelationship[]
  current_heartbeat?: AgentHeartbeat
}

export interface CoordinationSession extends EnhancedDatabase['public']['Tables']['swarm_coordination_sessions']['Row'] {
  swarm?: {
    name: string
    status: string
  }
  participantAgentDetails?: EnhancedWorker[]
  orchestrations?: TaskOrchestration[]
  efficiencyScore?: number
  duration?: number
}

export interface AgentRelationship extends EnhancedDatabase['public']['Tables']['agent_relationships']['Row'] {
  parent_agent?: EnhancedWorker
  child_agent?: EnhancedWorker
  communicationHealthy?: boolean
  effectivenessScore?: number
}

export interface TaskDependency extends EnhancedDatabase['public']['Tables']['task_dependencies']['Row'] {
  task?: Database['public']['Tables']['tasks']['Row']
  dependency_task?: Database['public']['Tables']['tasks']['Row']
  isSatisfied?: boolean
}

export interface TaskOrchestration extends EnhancedDatabase['public']['Tables']['task_orchestrations']['Row'] {
  session?: CoordinationSession
  assignedAgentDetails?: EnhancedWorker[]
  dependentTasks?: Database['public']['Tables']['tasks']['Row'][]
  progressDetails?: {
    currentStep: string
    totalSteps: number
    timeRemaining?: number
    bottlenecks?: string[]
  }
}

export interface SwarmMemory extends EnhancedDatabase['public']['Tables']['swarm_memory_store']['Row'] {
  owner_agent?: EnhancedWorker
  shared_agents?: EnhancedWorker[]
  access_history?: MemoryAccess[]
  isExpired?: boolean
  usageFrequency?: number
}

export interface MemoryAccess extends EnhancedDatabase['public']['Tables']['memory_access_log']['Row'] {
  memory_store?: SwarmMemory
  agent?: EnhancedWorker
}

export interface NeuralTrainingSession extends EnhancedDatabase['public']['Tables']['neural_training_sessions']['Row'] {
  agent?: EnhancedWorker
  isRunning?: boolean
  progressPercentage?: number
  improvementTrend?: number
}

export interface KnowledgeTransfer extends EnhancedDatabase['public']['Tables']['knowledge_transfer_log']['Row'] {
  source_agent?: EnhancedWorker
  target_agent?: EnhancedWorker
  transferEffectiveness?: number
}

export interface AgentHeartbeat extends EnhancedDatabase['public']['Tables']['agent_heartbeats']['Row'] {
  agent?: EnhancedWorker
  current_task?: Database['public']['Tables']['tasks']['Row']
  isHealthy?: boolean
  responseTimeCategory?: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface CoordinationEvent extends EnhancedDatabase['public']['Tables']['coordination_events']['Row'] {
  swarm?: {
    name: string
    status: string
  }
  session?: CoordinationSession
  source_agent?: EnhancedWorker
  target_agent_details?: EnhancedWorker[]
  isUrgent?: boolean
  responseRequired?: boolean
}

export interface PerformanceSnapshot extends EnhancedDatabase['public']['Tables']['swarm_performance_snapshots']['Row'] {
  swarm?: {
    name: string
    status: string
  }
  session?: CoordinationSession
  overallHealth?: 'excellent' | 'good' | 'fair' | 'poor'
  trendDirection?: 'improving' | 'stable' | 'declining'
  bottlenecks?: string[]
  recommendations?: string[]
}

// ==========================================
// COORDINATION GRAPH TYPES
// ==========================================

export interface CoordinationGraphNode {
  id: string
  name: string
  type: string
  status: string
  performance_score: number
  position?: { x: number; y: number }
  metadata?: Record<string, any>
}

export interface CoordinationGraphEdge {
  source: string
  target: string
  type: string
  strength: number
  bandwidth?: number
  latency?: number
  metadata?: Record<string, any>
}

export interface CoordinationGraph {
  nodes: CoordinationGraphNode[]
  edges: CoordinationGraphEdge[]
  metrics?: {
    density: number
    avgPathLength: number
    clustering: number
    efficiency: number
  }
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface SwarmCoordinationApiResponse {
  sessions: CoordinationSession[]
  topologies: SwarmTopology[]
  agents: EnhancedWorker[]
  relationships: AgentRelationship[]
  events: CoordinationEvent[]
  performance: PerformanceSnapshot[]
  coordinationGraph?: CoordinationGraph
  realTimeMetrics?: {
    activeAgents: number
    activeSessions: number
    coordinationEfficiency: number
    systemHealth: number
    messageFrequency: number
  }
}

// ==========================================
// HOOK TYPES FOR REAL-TIME COORDINATION
// ==========================================

export interface UseSwarmCoordinationOptions {
  swarmId?: string
  sessionId?: string
  enableRealTime?: boolean
  enableHeartbeats?: boolean
  enableEvents?: boolean
  enableMemoryUpdates?: boolean
  enablePerformanceTracking?: boolean
  refreshInterval?: number
  maxEvents?: number
}

export interface SwarmCoordinationData {
  sessions: CoordinationSession[]
  agents: EnhancedWorker[]
  relationships: AgentRelationship[]
  events: CoordinationEvent[]
  heartbeats: AgentHeartbeat[]
  memory: SwarmMemory[]
  performance: PerformanceSnapshot[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  coordinationGraph: CoordinationGraph | null
  realTimeMetrics: {
    coordination_efficiency: number
    system_health: number
    active_agents: number
    message_frequency: number
    memory_utilization: number
    cpu_utilization: number
  }
}

// Type for database connection with enhanced schema
export type SupabaseClientEnhanced = ReturnType<typeof createClient<EnhancedDatabase>>

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]