/**
 * Supabase Client Configuration for Swarm Dashboard
 * Provides database connectivity for persistent swarm data and analytics
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Client-side Supabase client (browser/client components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Server-side Supabase client with service role (for API routes/server actions)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Database table types for type safety
export interface SwarmTrace {
  id: string
  session_id: string
  trace_name: string
  trace_data: any
  status: 'success' | 'error' | 'pending' | 'running'
  duration_ms: number
  created_at: string
  updated_at: string
  metadata?: any
}

export interface SwarmAgent {
  id: string
  name: string
  type: string
  status: 'active' | 'idle' | 'error' | 'offline'
  current_task?: string
  tasks_completed: number
  average_response_time: number
  memory_usage: number
  cpu_usage: number
  last_activity: string
  swarm_id: string
  created_at: string
  updated_at: string
  metadata?: any
}

export interface SwarmSession {
  id: string
  session_name: string
  description?: string
  total_traces: number
  active_traces: number
  total_agents: number
  active_agents: number
  start_time: string
  end_time?: string
  status: 'active' | 'completed' | 'error'
  metadata?: any
  created_at: string
  updated_at: string
}

export interface SwarmMetrics {
  id: string
  session_id: string
  metric_type: string
  metric_value: number
  metric_data: any
  timestamp: string
  created_at: string
}

// Utility functions for database operations
export class SwarmDatabase {
  
  // Trace operations
  static async insertTrace(trace: Omit<SwarmTrace, 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('swarm_traces')
      .insert(trace)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getTraces(sessionId?: string, limit: number = 50) {
    let query = supabase
      .from('swarm_traces')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async updateTrace(id: string, updates: Partial<SwarmTrace>) {
    const { data, error } = await supabase
      .from('swarm_traces')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Agent operations
  static async insertAgent(agent: Omit<SwarmAgent, 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('swarm_agents')
      .insert(agent)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getAgents(swarmId?: string) {
    let query = supabase
      .from('swarm_agents')
      .select('*')
      .order('last_activity', { ascending: false })
    
    if (swarmId) {
      query = query.eq('swarm_id', swarmId)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async updateAgent(id: string, updates: Partial<SwarmAgent>) {
    const { data, error } = await supabase
      .from('swarm_agents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Session operations
  static async createSession(session: Omit<SwarmSession, 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('swarm_sessions')
      .insert(session)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getSessions(limit: number = 20) {
    const { data, error } = await supabase
      .from('swarm_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data
  }

  static async updateSession(id: string, updates: Partial<SwarmSession>) {
    const { data, error } = await supabase
      .from('swarm_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  // Metrics operations
  static async insertMetrics(metrics: Omit<SwarmMetrics, 'created_at'>) {
    const { data, error } = await supabase
      .from('swarm_metrics')
      .insert(metrics)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async getMetrics(sessionId: string, metricType?: string, limit: number = 100) {
    let query = supabase
      .from('swarm_metrics')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(limit)
    
    if (metricType) {
      query = query.eq('metric_type', metricType)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  }

  // Real-time subscriptions
  static subscribeToTraces(sessionId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`traces-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swarm_traces',
          filter: `session_id=eq.${sessionId}`,
        },
        callback
      )
      .subscribe()
  }

  static subscribeToAgents(swarmId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`agents-${swarmId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swarm_agents',
          filter: `swarm_id=eq.${swarmId}`,
        },
        callback
      )
      .subscribe()
  }

  static subscribeToMetrics(sessionId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`metrics-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'swarm_metrics',
          filter: `session_id=eq.${sessionId}`,
        },
        callback
      )
      .subscribe()
  }
}

export default supabase