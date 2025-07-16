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
      swarms: {
        Row: {
          id: string
          name: string
          purpose: string | null
          status: string
          worker_count: number
          config: Json
          metrics: Json
          fly_app_name: string | null
          error: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          name: string
          purpose?: string | null
          status?: string
          worker_count?: number
          config?: Json
          metrics?: Json
          fly_app_name?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          purpose?: string | null
          status?: string
          worker_count?: number
          config?: Json
          metrics?: Json
          fly_app_name?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          organization_id?: string | null
        }
      }
      workers: {
        Row: {
          id: string
          swarm_id: string
          name: string
          type: string
          status: string
          machine_id: string | null
          last_heartbeat: string | null
          config: Json
          metrics: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          swarm_id: string
          name: string
          type?: string
          status?: string
          machine_id?: string | null
          last_heartbeat?: string | null
          config?: Json
          metrics?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string
          name?: string
          type?: string
          status?: string
          machine_id?: string | null
          last_heartbeat?: string | null
          config?: Json
          metrics?: Json
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          swarm_id: string
          worker_id: string | null
          type: string
          status: string
          priority: number
          input: Json | null
          output: Json | null
          error: string | null
          retry_count: number
          max_retries: number
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          swarm_id: string
          worker_id?: string | null
          type: string
          status?: string
          priority?: number
          input?: Json | null
          output?: Json | null
          error?: string | null
          retry_count?: number
          max_retries?: number
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string
          worker_id?: string | null
          type?: string
          status?: string
          priority?: number
          input?: Json | null
          output?: Json | null
          error?: string | null
          retry_count?: number
          max_retries?: number
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      logs: {
        Row: {
          id: string
          swarm_id: string | null
          worker_id: string | null
          task_id: string | null
          level: string
          source: string | null
          message: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          swarm_id?: string | null
          worker_id?: string | null
          task_id?: string | null
          level: string
          source?: string | null
          message: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string | null
          worker_id?: string | null
          task_id?: string | null
          level?: string
          source?: string | null
          message?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      metrics: {
        Row: {
          id: string
          swarm_id: string | null
          worker_id: string | null
          metric_name: string
          metric_value: number
          tags: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          swarm_id?: string | null
          worker_id?: string | null
          metric_name: string
          metric_value: number
          tags?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          swarm_id?: string | null
          worker_id?: string | null
          metric_name?: string
          metric_value?: number
          tags?: Json | null
          created_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string | null
          config: Json
          is_public: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: string | null
          config: Json
          is_public?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string | null
          config?: Json
          is_public?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      swarm_stats: {
        Row: {
          id: string | null
          name: string | null
          status: string | null
          worker_count: number | null
          active_workers: number | null
          pending_tasks: number | null
          completed_tasks: number | null
          failed_tasks: number | null
          avg_task_duration: number | null
        }
      }
    }
    Functions: {
      get_recent_activity: {
        Args: {
          limit_count?: number
        }
        Returns: {
          id: string
          type: string
          description: string
          swarm_id: string
          swarm_name: string
          created_at: string
        }[]
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