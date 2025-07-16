// Comprehensive Swarm Coordination Client for Supabase
// Created: 2025-07-14
// Purpose: Type-safe client for swarm relationship operations

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  SwarmNetwork,
  SwarmSession,
  SwarmAgent,
  SwarmTask,
  SwarmMemory,
  CoordinationEvent,
  PerformanceMetric,
  SwarmHealth,
  SwarmNetworkInsert,
  SwarmNetworkUpdate,
  SwarmSessionInsert,
  SwarmSessionUpdate,
  SwarmAgentInsert,
  SwarmAgentUpdate,
  SwarmTaskInsert,
  SwarmTaskUpdate,
  SwarmMemoryInsert,
  SwarmMemoryUpdate,
  CoordinationEventInsert,
  PerformanceMetricInsert,
  SwarmHealthInsert,
  SwarmHealthUpdate,
  PaginatedResponse,
  SwarmQueryConfig,
  SwarmOperationResult,
  SwarmRealtimeConfig,
  SwarmDashboardMetrics,
  CoordinationGraph,
  SwarmPerformanceChart,
  SwarmTimelineEvent
} from './swarm-coordination-types';

export class SwarmCoordinationClient {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // =============================================================================
  // NETWORK OPERATIONS
  // =============================================================================

  async createNetwork(network: SwarmNetworkInsert): Promise<SwarmOperationResult<SwarmNetwork>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_networks')
        .insert(network)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getNetworks(config?: SwarmQueryConfig): Promise<SwarmOperationResult<PaginatedResponse<SwarmNetwork>>> {
    try {
      let query = this.supabase.from('swarm_networks').select('*', { count: 'exact' });

      if (config?.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (config?.sortBy) {
        query = query.order(config.sortBy, { ascending: config.sortOrder === 'asc' });
      }

      if (config?.limit) {
        query = query.limit(config.limit);
      }

      if (config?.offset) {
        query = query.range(config.offset, config.offset + (config.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / (config?.limit || 10));

      return {
        success: true,
        data: {
          data: data || [],
          count: count || 0,
          page: Math.floor((config?.offset || 0) / (config?.limit || 10)) + 1,
          per_page: config?.limit || 10,
          total_pages: totalPages
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateNetwork(id: string, updates: SwarmNetworkUpdate): Promise<SwarmOperationResult<SwarmNetwork>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_networks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deleteNetwork(id: string): Promise<SwarmOperationResult<void>> {
    try {
      const { error } = await this.supabase
        .from('swarm_networks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // SESSION OPERATIONS
  // =============================================================================

  async createSession(session: SwarmSessionInsert): Promise<SwarmOperationResult<SwarmSession>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_sessions')
        .insert(session)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getSessions(config?: SwarmQueryConfig): Promise<SwarmOperationResult<PaginatedResponse<SwarmSession>>> {
    try {
      let query = this.supabase.from('swarm_sessions').select('*', { count: 'exact' });

      if (config?.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          data: data || [],
          count: count || 0,
          page: 1,
          per_page: config?.limit || 10,
          total_pages: Math.ceil((count || 0) / (config?.limit || 10))
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateSession(id: string, updates: SwarmSessionUpdate): Promise<SwarmOperationResult<SwarmSession>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // AGENT OPERATIONS
  // =============================================================================

  async spawnAgent(agent: SwarmAgentInsert): Promise<SwarmOperationResult<SwarmAgent>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_agents')
        .insert(agent)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getAgents(config?: SwarmQueryConfig): Promise<SwarmOperationResult<PaginatedResponse<SwarmAgent>>> {
    try {
      let query = this.supabase.from('swarm_agents').select('*', { count: 'exact' });

      if (config?.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          data: data || [],
          count: count || 0,
          page: 1,
          per_page: config?.limit || 10,
          total_pages: Math.ceil((count || 0) / (config?.limit || 10))
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateAgent(id: string, updates: SwarmAgentUpdate): Promise<SwarmOperationResult<SwarmAgent>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_agents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateAgentHeartbeat(agentId: string): Promise<SwarmOperationResult<SwarmAgent>> {
    return this.updateAgent(agentId, { last_heartbeat: new Date().toISOString() });
  }

  // =============================================================================
  // TASK OPERATIONS
  // =============================================================================

  async createTask(task: SwarmTaskInsert): Promise<SwarmOperationResult<SwarmTask>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_tasks')
        .insert(task)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getTasks(config?: SwarmQueryConfig): Promise<SwarmOperationResult<PaginatedResponse<SwarmTask>>> {
    try {
      let query = this.supabase.from('swarm_tasks').select('*', { count: 'exact' });

      if (config?.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          data: data || [],
          count: count || 0,
          page: 1,
          per_page: config?.limit || 10,
          total_pages: Math.ceil((count || 0) / (config?.limit || 10))
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updateTask(id: string, updates: SwarmTaskUpdate): Promise<SwarmOperationResult<SwarmTask>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // MEMORY OPERATIONS
  // =============================================================================

  async storeMemory(memory: SwarmMemoryInsert): Promise<SwarmOperationResult<SwarmMemory>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_memory')
        .upsert(memory, { onConflict: 'key,namespace,session_id' })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async retrieveMemory(key: string, namespace: string, sessionId?: string): Promise<SwarmOperationResult<SwarmMemory>> {
    try {
      let query = this.supabase
        .from('swarm_memory')
        .select('*')
        .eq('key', key)
        .eq('namespace', namespace);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query.single();

      if (error) throw error;

      // Update access count and last accessed
      await this.supabase
        .from('swarm_memory')
        .update({
          access_count: data.access_count + 1,
          last_accessed: new Date().toISOString()
        })
        .eq('id', data.id);

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async searchMemory(pattern: string, namespace?: string): Promise<SwarmOperationResult<SwarmMemory[]>> {
    try {
      let query = this.supabase
        .from('swarm_memory')
        .select('*')
        .or(`key.ilike.%${pattern}%,value->>description.ilike.%${pattern}%`);

      if (namespace) {
        query = query.eq('namespace', namespace);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // COORDINATION EVENTS
  // =============================================================================

  async sendCoordinationEvent(event: CoordinationEventInsert): Promise<SwarmOperationResult<CoordinationEvent>> {
    try {
      const { data, error } = await this.supabase
        .from('coordination_events')
        .insert(event)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getCoordinationEvents(config?: SwarmQueryConfig): Promise<SwarmOperationResult<PaginatedResponse<CoordinationEvent>>> {
    try {
      let query = this.supabase.from('coordination_events').select('*', { count: 'exact' });

      if (config?.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          data: data || [],
          count: count || 0,
          page: 1,
          per_page: config?.limit || 10,
          total_pages: Math.ceil((count || 0) / (config?.limit || 10))
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // PERFORMANCE METRICS
  // =============================================================================

  async recordMetric(metric: PerformanceMetricInsert): Promise<SwarmOperationResult<PerformanceMetric>> {
    try {
      const { data, error } = await this.supabase
        .from('performance_metrics')
        .insert({ ...metric, timestamp: new Date().toISOString() })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getMetrics(config?: SwarmQueryConfig): Promise<SwarmOperationResult<PaginatedResponse<PerformanceMetric>>> {
    try {
      let query = this.supabase.from('performance_metrics').select('*', { count: 'exact' });

      if (config?.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      query = query.order('timestamp', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          data: data || [],
          count: count || 0,
          page: 1,
          per_page: config?.limit || 10,
          total_pages: Math.ceil((count || 0) / (config?.limit || 10))
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // HEALTH MONITORING
  // =============================================================================

  async updateAgentHealth(health: SwarmHealthInsert): Promise<SwarmOperationResult<SwarmHealth>> {
    try {
      const { data, error } = await this.supabase
        .from('swarm_health')
        .upsert(
          { ...health, last_check: new Date().toISOString() },
          { onConflict: 'agent_id' }
        )
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getHealthStatus(config?: SwarmQueryConfig): Promise<SwarmOperationResult<PaginatedResponse<SwarmHealth>>> {
    try {
      let query = this.supabase.from('swarm_health').select('*', { count: 'exact' });

      if (config?.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          data: data || [],
          count: count || 0,
          page: 1,
          per_page: config?.limit || 10,
          total_pages: Math.ceil((count || 0) / (config?.limit || 10))
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // DASHBOARD ANALYTICS
  // =============================================================================

  async getDashboardMetrics(): Promise<SwarmOperationResult<SwarmDashboardMetrics>> {
    try {
      const [
        networksResult,
        sessionsResult,
        agentsResult,
        tasksResult,
        healthResult
      ] = await Promise.all([
        this.supabase.from('swarm_networks').select('*', { count: 'exact', head: true }),
        this.supabase.from('swarm_sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        this.supabase.from('swarm_agents').select('*', { count: 'exact', head: true }),
        this.supabase.from('swarm_tasks').select('*', { count: 'exact', head: true }),
        this.supabase.from('swarm_health').select('health_score').gte('last_check', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      ]);

      const activeAgentsResult = await this.supabase
        .from('swarm_agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const completedTasksResult = await this.supabase
        .from('swarm_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      const metrics: SwarmDashboardMetrics = {
        total_networks: networksResult.count || 0,
        active_sessions: sessionsResult.count || 0,
        total_agents: agentsResult.count || 0,
        active_agents: activeAgentsResult.count || 0,
        total_tasks: tasksResult.count || 0,
        completed_tasks: completedTasksResult.count || 0,
        avg_efficiency: 0,
        system_health: 0
      };

      // Calculate averages
      if (metrics.total_tasks > 0) {
        metrics.avg_efficiency = metrics.completed_tasks / metrics.total_tasks;
      }

      if (healthResult.data) {
        const healthScores = healthResult.data.map((h: any) => h.health_score);
        metrics.system_health = healthScores.reduce((sum: number, score: number) => sum + score, 0) / healthScores.length;
      }

      return { success: true, data: metrics };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getPerformanceChart(
    metricType: string,
    timeRange: string = '24h'
  ): Promise<SwarmOperationResult<SwarmPerformanceChart>> {
    try {
      const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('performance_metrics')
        .select('timestamp, value, agent_id')
        .eq('metric_type', metricType)
        .gte('timestamp', startTime)
        .order('timestamp');

      if (error) throw error;

      // Group by hour and calculate averages
      const hourlyData: Record<string, { sum: number; count: number }> = {};
      
      data?.forEach((metric) => {
        const hour = new Date(metric.timestamp).toISOString().substring(0, 13);
        if (!hourlyData[hour]) {
          hourlyData[hour] = { sum: 0, count: 0 };
        }
        hourlyData[hour].sum += metric.value;
        hourlyData[hour].count += 1;
      });

      const labels = Object.keys(hourlyData).sort();
      const values = labels.map(hour => hourlyData[hour].sum / hourlyData[hour].count);

      return {
        success: true,
        data: {
          labels,
          datasets: [{
            label: metricType,
            data: values,
            color: '#3b82f6'
          }]
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // =============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================================================

  subscribeToSwarmUpdates(
    config: SwarmRealtimeConfig,
    callback: (event: any) => void
  ) {
    const subscriptions: any[] = [];

    if (config.enableSessions) {
      const sessionSub = this.supabase
        .channel('swarm_sessions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'swarm_sessions' }, callback)
        .subscribe();
      subscriptions.push(sessionSub);
    }

    if (config.enableAgents) {
      const agentSub = this.supabase
        .channel('swarm_agents')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'swarm_agents' }, callback)
        .subscribe();
      subscriptions.push(agentSub);
    }

    if (config.enableTasks) {
      const taskSub = this.supabase
        .channel('swarm_tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'swarm_tasks' }, callback)
        .subscribe();
      subscriptions.push(taskSub);
    }

    if (config.enableEvents) {
      const eventSub = this.supabase
        .channel('coordination_events')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'coordination_events' }, callback)
        .subscribe();
      subscriptions.push(eventSub);
    }

    if (config.enableMetrics) {
      const metricSub = this.supabase
        .channel('performance_metrics')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_metrics' }, callback)
        .subscribe();
      subscriptions.push(metricSub);
    }

    if (config.enableHealth) {
      const healthSub = this.supabase
        .channel('swarm_health')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'swarm_health' }, callback)
        .subscribe();
      subscriptions.push(healthSub);
    }

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }

  // =============================================================================
  // CLEANUP OPERATIONS
  // =============================================================================

  async cleanupExpiredMemory(): Promise<SwarmOperationResult<void>> {
    try {
      const { error } = await this.supabase.rpc('cleanup_expired_memory');

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async archiveOldSessions(daysOld: number = 30): Promise<SwarmOperationResult<void>> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await this.supabase
        .from('swarm_sessions')
        .update({ status: 'completed' })
        .lt('started_at', cutoffDate)
        .in('status', ['active', 'paused']);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export default SwarmCoordinationClient;