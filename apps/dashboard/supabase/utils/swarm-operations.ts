/**
 * =====================================================================================
 * Swarm Operations Utility Functions
 * Version: 20250714_004
 * Author: Schema Developer Agent
 * Description: Comprehensive utility functions for swarm coordination and operations
 * =====================================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  SwarmDatabase, 
  SwarmNetwork, 
  SwarmAgent, 
  AgentRelationship,
  TaskOrchestration,
  SwarmMemory,
  CoordinationEventRow,
  PerformanceMetricRow,
  HealthCheckRow,
  NeuralPattern,
  SwarmNetworkInsert,
  SwarmAgentInsert,
  Json
} from '../types/swarm-relationship-types';

// =====================================================================================
// CLIENT CONFIGURATION
// =====================================================================================

export interface SwarmOperationsConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableRealtime?: boolean;
  defaultTimeout?: number;
  retryAttempts?: number;
}

export class SwarmOperations {
  private client: SupabaseClient<SwarmDatabase>;
  private config: SwarmOperationsConfig;

  constructor(config: SwarmOperationsConfig) {
    this.config = {
      enableRealtime: true,
      defaultTimeout: 30000,
      retryAttempts: 3,
      ...config
    };

    this.client = createClient<SwarmDatabase>(
      config.supabaseUrl,
      config.supabaseKey,
      {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      }
    );
  }

  // =====================================================================================
  // SWARM NETWORK OPERATIONS
  // =====================================================================================

  /**
   * Create a new swarm network
   */
  async createNetwork(networkData: SwarmNetworkInsert): Promise<SwarmNetwork> {
    const { data, error } = await this.client
      .from('swarm_networks')
      .insert(networkData)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create network: ${error.message}`);
    return data;
  }

  /**
   * Get swarm network by ID with optional relations
   */
  async getNetwork(
    networkId: string, 
    options: {
      includeAgents?: boolean;
      includeTasks?: boolean;
      includeStats?: boolean;
    } = {}
  ): Promise<SwarmNetwork | null> {
    let query = this.client
      .from('swarm_networks')
      .select('*')
      .eq('id', networkId)
      .single();

    const { data: network, error } = await query;
    if (error || !network) return null;

    const enrichedNetwork: SwarmNetwork = { ...network };

    // Fetch agents if requested
    if (options.includeAgents) {
      const { data: agents } = await this.client
        .from('swarm_agents')
        .select('*')
        .eq('network_id', networkId);
      
      enrichedNetwork.agents = agents || [];
      enrichedNetwork.agent_stats = this.calculateAgentStats(agents || []);
    }

    // Fetch tasks if requested
    if (options.includeTasks) {
      const { data: tasks } = await this.client
        .from('task_orchestration')
        .select('*')
        .eq('network_id', networkId);
      
      enrichedNetwork.tasks = tasks || [];
      enrichedNetwork.task_stats = this.calculateTaskStats(tasks || []);
    }

    // Calculate performance stats if requested
    if (options.includeStats) {
      enrichedNetwork.performance_stats = await this.calculateNetworkPerformanceStats(networkId);
      enrichedNetwork.health_score = await this.calculateNetworkHealthScore(networkId);
    }

    return enrichedNetwork;
  }

  /**
   * List all networks with pagination and filtering
   */
  async listNetworks(options: {
    page?: number;
    limit?: number;
    status?: string[];
    topology?: string[];
    userId?: string;
    organizationId?: string;
  } = {}): Promise<{ networks: SwarmNetwork[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let query = this.client
      .from('swarm_networks')
      .select('*', { count: 'exact' });

    // Apply filters
    if (options.status?.length) {
      query = query.in('status', options.status);
    }
    if (options.topology?.length) {
      query = query.in('topology', options.topology);
    }
    if (options.userId) {
      query = query.eq('created_by', options.userId);
    }
    if (options.organizationId) {
      query = query.eq('organization_id', options.organizationId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to list networks: ${error.message}`);

    return {
      networks: data || [],
      total: count || 0
    };
  }

  /**
   * Update network configuration
   */
  async updateNetwork(networkId: string, updates: Partial<SwarmNetwork>): Promise<SwarmNetwork> {
    const { data, error } = await this.client
      .from('swarm_networks')
      .update(updates)
      .eq('id', networkId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update network: ${error.message}`);
    return data;
  }

  /**
   * Delete network and all related data
   */
  async deleteNetwork(networkId: string): Promise<void> {
    const { error } = await this.client
      .from('swarm_networks')
      .delete()
      .eq('id', networkId);

    if (error) throw new Error(`Failed to delete network: ${error.message}`);
  }

  // =====================================================================================
  // SWARM AGENT OPERATIONS
  // =====================================================================================

  /**
   * Spawn a new agent in the network
   */
  async spawnAgent(agentData: SwarmAgentInsert): Promise<SwarmAgent> {
    const { data, error } = await this.client
      .from('swarm_agents')
      .insert({
        ...agentData,
        status: 'spawning',
        last_activity: new Date().toISOString(),
        last_heartbeat: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to spawn agent: ${error.message}`);

    // Log the spawn event
    await this.logCoordinationEvent({
      network_id: agentData.network_id,
      agent_id: data.id,
      event_type: 'agent_spawn',
      event_category: 'lifecycle',
      event_data: { agent_type: agentData.type, agent_name: agentData.name },
      severity: 'info'
    });

    return data;
  }

  /**
   * Get agent with relationships and performance data
   */
  async getAgent(
    agentId: string,
    options: {
      includeRelationships?: boolean;
      includePerformance?: boolean;
      includeNetwork?: boolean;
    } = {}
  ): Promise<SwarmAgent | null> {
    const { data: agent, error } = await this.client
      .from('swarm_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error || !agent) return null;

    const enrichedAgent: SwarmAgent = { ...agent };

    // Fetch relationships if requested
    if (options.includeRelationships) {
      const { data: relationships } = await this.client
        .from('agent_relationships')
        .select('*, source_agent:swarm_agents!source_agent_id(*), target_agent:swarm_agents!target_agent_id(*)')
        .or(`source_agent_id.eq.${agentId},target_agent_id.eq.${agentId}`);
      
      enrichedAgent.relationships = relationships || [];
    }

    // Fetch network info if requested
    if (options.includeNetwork) {
      const { data: network } = await this.client
        .from('swarm_networks')
        .select('id, name, topology, status')
        .eq('id', agent.network_id)
        .single();
      
      enrichedAgent.network = network || undefined;
    }

    // Calculate performance metrics if requested
    if (options.includePerformance) {
      enrichedAgent.uptime = await this.calculateAgentUptime(agentId);
      enrichedAgent.task_success_rate = await this.calculateAgentSuccessRate(agentId);
      enrichedAgent.health_status = await this.getAgentHealthStatus(agentId);
    }

    return enrichedAgent;
  }

  /**
   * Update agent status and metrics
   */
  async updateAgent(agentId: string, updates: Partial<SwarmAgent>): Promise<SwarmAgent> {
    const { data, error } = await this.client
      .from('swarm_agents')
      .update({
        ...updates,
        last_activity: new Date().toISOString()
      })
      .eq('id', agentId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update agent: ${error.message}`);

    // Log status change if status was updated
    if (updates.status) {
      await this.logCoordinationEvent({
        network_id: data.network_id,
        agent_id: agentId,
        event_type: 'agent_status_change',
        event_category: 'lifecycle',
        event_data: { 
          new_status: updates.status,
          previous_status: data.status
        },
        severity: 'info'
      });
    }

    return data;
  }

  /**
   * Send heartbeat for agent
   */
  async sendHeartbeat(agentId: string, metrics?: {
    memory_usage?: number;
    cpu_usage?: number;
    current_task?: string;
  }): Promise<void> {
    const updates: any = {
      last_heartbeat: new Date().toISOString(),
      last_activity: new Date().toISOString()
    };

    if (metrics?.memory_usage !== undefined) updates.memory_usage = metrics.memory_usage;
    if (metrics?.cpu_usage !== undefined) updates.cpu_usage = metrics.cpu_usage;
    if (metrics?.current_task !== undefined) updates.current_task = metrics.current_task;

    await this.updateAgent(agentId, updates);
  }

  // =====================================================================================
  // TASK ORCHESTRATION OPERATIONS
  // =====================================================================================

  /**
   * Create and orchestrate a new task
   */
  async orchestrateTask(taskData: Omit<TaskOrchestrationRow, 'id' | 'created_at' | 'updated_at'>): Promise<TaskOrchestration> {
    const { data, error } = await this.client
      .from('task_orchestration')
      .insert(taskData)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to orchestrate task: ${error.message}`);

    // Log task creation
    await this.logCoordinationEvent({
      network_id: taskData.network_id,
      event_type: 'task_orchestrated',
      event_category: 'task',
      event_data: {
        task_name: taskData.task_name,
        strategy: taskData.strategy,
        priority: taskData.priority,
        assigned_agents: taskData.assigned_agents
      },
      severity: 'info'
    });

    return data;
  }

  /**
   * Assign agents to task
   */
  async assignAgentsToTask(taskId: string, agentIds: string[]): Promise<TaskOrchestration> {
    const { data, error } = await this.client
      .from('task_orchestration')
      .update({
        assigned_agents: agentIds,
        status: agentIds.length > 0 ? 'running' : 'pending',
        started_at: agentIds.length > 0 ? new Date().toISOString() : null
      })
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to assign agents to task: ${error.message}`);

    // Update assigned agents' current task
    if (agentIds.length > 0) {
      await this.client
        .from('swarm_agents')
        .update({ 
          current_task: data.task_name,
          status: 'busy'
        })
        .in('id', agentIds);
    }

    return data;
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(
    taskId: string, 
    progress: number, 
    output?: Json,
    error_details?: string
  ): Promise<TaskOrchestration> {
    const updates: any = {
      progress_percentage: Math.min(100, Math.max(0, progress))
    };

    if (output) updates.output_data = output;
    if (error_details) updates.error_details = error_details;

    // Mark as completed if progress is 100%
    if (progress >= 100) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await this.client
      .from('task_orchestration')
      .update(updates)
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update task progress: ${error.message}`);

    // Free up agents if task is completed
    if (progress >= 100 && data.assigned_agents?.length) {
      await this.client
        .from('swarm_agents')
        .update({ 
          current_task: null,
          status: 'idle',
          tasks_completed: this.client.rpc('increment_tasks_completed')
        })
        .in('id', data.assigned_agents);
    }

    return data;
  }

  // =====================================================================================
  // MEMORY OPERATIONS
  // =====================================================================================

  /**
   * Store memory in swarm memory bank
   */
  async storeMemory(memoryData: {
    network_id: string;
    memory_key: string;
    memory_value: Json;
    memory_namespace?: string;
    memory_type?: string;
    ttl_seconds?: number;
    priority?: number;
    tags?: string[];
    created_by_agent_id?: string;
  }): Promise<SwarmMemory> {
    const { data, error } = await this.client
      .from('swarm_memory')
      .upsert({
        ...memoryData,
        memory_namespace: memoryData.memory_namespace || 'default',
        memory_type: memoryData.memory_type || 'general',
        priority: memoryData.priority || 0,
        tags: memoryData.tags || []
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to store memory: ${error.message}`);
    return data;
  }

  /**
   * Retrieve memory from swarm memory bank
   */
  async retrieveMemory(
    networkId: string,
    memoryKey: string,
    namespace: string = 'default'
  ): Promise<SwarmMemory | null> {
    const { data, error } = await this.client
      .from('swarm_memory')
      .select('*')
      .eq('network_id', networkId)
      .eq('memory_key', memoryKey)
      .eq('memory_namespace', namespace)
      .single();

    if (error) return null;

    // Increment access count
    await this.client
      .from('swarm_memory')
      .update({ access_count: data.access_count + 1 })
      .eq('id', data.id);

    return data;
  }

  /**
   * Search memory by pattern or tags
   */
  async searchMemory(
    networkId: string,
    options: {
      pattern?: string;
      namespace?: string;
      memory_type?: string;
      tags?: string[];
      limit?: number;
    } = {}
  ): Promise<SwarmMemory[]> {
    let query = this.client
      .from('swarm_memory')
      .select('*')
      .eq('network_id', networkId);

    if (options.pattern) {
      query = query.ilike('memory_key', `%${options.pattern}%`);
    }
    if (options.namespace) {
      query = query.eq('memory_namespace', options.namespace);
    }
    if (options.memory_type) {
      query = query.eq('memory_type', options.memory_type);
    }
    if (options.tags?.length) {
      query = query.contains('tags', options.tags);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`Failed to search memory: ${error.message}`);

    return data || [];
  }

  // =====================================================================================
  // COORDINATION EVENTS
  // =====================================================================================

  /**
   * Log coordination event
   */
  async logCoordinationEvent(eventData: Omit<CoordinationEventRow, 'id' | 'created_at'>): Promise<void> {
    const { error } = await this.client
      .from('coordination_events')
      .insert({
        ...eventData,
        metadata: eventData.metadata || {}
      });

    if (error) {
      console.error('Failed to log coordination event:', error.message);
      // Don't throw error for logging failures to avoid cascading issues
    }
  }

  /**
   * Get coordination events with filtering
   */
  async getCoordinationEvents(
    networkId: string,
    options: {
      agent_id?: string;
      event_category?: string;
      severity?: string;
      since?: Date;
      limit?: number;
    } = {}
  ): Promise<CoordinationEventRow[]> {
    let query = this.client
      .from('coordination_events')
      .select('*')
      .eq('network_id', networkId);

    if (options.agent_id) {
      query = query.eq('agent_id', options.agent_id);
    }
    if (options.event_category) {
      query = query.eq('event_category', options.event_category);
    }
    if (options.severity) {
      query = query.eq('severity', options.severity);
    }
    if (options.since) {
      query = query.gte('created_at', options.since.toISOString());
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get coordination events: ${error.message}`);

    return data || [];
  }

  // =====================================================================================
  // PERFORMANCE METRICS
  // =====================================================================================

  /**
   * Record performance metric
   */
  async recordMetric(metricData: Omit<PerformanceMetricRow, 'id' | 'created_at'>): Promise<void> {
    const { error } = await this.client
      .from('performance_metrics')
      .insert({
        ...metricData,
        tags: metricData.tags || {},
        metadata: metricData.metadata || {}
      });

    if (error) {
      console.error('Failed to record performance metric:', error.message);
    }
  }

  /**
   * Get aggregated performance metrics
   */
  async getPerformanceMetrics(
    networkId: string,
    options: {
      agent_id?: string;
      metric_category?: string;
      metric_name?: string;
      since?: Date;
      aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
      time_window?: string; // e.g., '1h', '24h', '7d'
    } = {}
  ): Promise<PerformanceMetricRow[]> {
    let query = this.client
      .from('performance_metrics')
      .select('*')
      .eq('network_id', networkId);

    if (options.agent_id) {
      query = query.eq('agent_id', options.agent_id);
    }
    if (options.metric_category) {
      query = query.eq('metric_category', options.metric_category);
    }
    if (options.metric_name) {
      query = query.eq('metric_name', options.metric_name);
    }
    if (options.since) {
      query = query.gte('created_at', options.since.toISOString());
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get performance metrics: ${error.message}`);

    return data || [];
  }

  // =====================================================================================
  // HEALTH MONITORING
  // =====================================================================================

  /**
   * Record health check
   */
  async recordHealthCheck(healthData: Omit<HealthCheckRow, 'id' | 'created_at'>): Promise<void> {
    const { error } = await this.client
      .from('health_checks')
      .insert({
        ...healthData,
        check_data: healthData.check_data || {},
        threshold_values: healthData.threshold_values || {},
        remediation_actions: healthData.remediation_actions || {},
        metadata: healthData.metadata || {}
      });

    if (error) {
      console.error('Failed to record health check:', error.message);
    }
  }

  /**
   * Get latest health status for network
   */
  async getNetworkHealthStatus(networkId: string): Promise<{
    overall_status: string;
    agent_health: Record<string, string>;
    recent_issues: HealthCheckRow[];
  }> {
    const { data: healthChecks, error } = await this.client
      .from('health_checks')
      .select('*')
      .eq('network_id', networkId)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get health status: ${error.message}`);

    const recentIssues = (healthChecks || []).filter(check => 
      check.status === 'warning' || check.status === 'error' || check.status === 'critical'
    );

    const agentHealth: Record<string, string> = {};
    const agentHealthMap = new Map<string, string>();

    (healthChecks || []).forEach(check => {
      if (check.agent_id && !agentHealthMap.has(check.agent_id)) {
        agentHealthMap.set(check.agent_id, check.status);
      }
    });

    agentHealthMap.forEach((status, agentId) => {
      agentHealth[agentId] = status;
    });

    // Determine overall status
    let overall_status = 'healthy';
    if (recentIssues.some(issue => issue.status === 'critical')) {
      overall_status = 'critical';
    } else if (recentIssues.some(issue => issue.status === 'error')) {
      overall_status = 'error';
    } else if (recentIssues.some(issue => issue.status === 'warning')) {
      overall_status = 'warning';
    }

    return {
      overall_status,
      agent_health: agentHealth,
      recent_issues: recentIssues.slice(0, 10) // Last 10 issues
    };
  }

  // =====================================================================================
  // UTILITY METHODS
  // =====================================================================================

  private calculateAgentStats(agents: SwarmAgent[]) {
    const stats = {
      total: agents.length,
      active: 0,
      idle: 0,
      busy: 0,
      error: 0,
      offline: 0,
      by_type: {} as Record<string, number>
    };

    agents.forEach(agent => {
      stats[agent.status as keyof typeof stats]++;
      stats.by_type[agent.type] = (stats.by_type[agent.type] || 0) + 1;
    });

    return stats;
  }

  private calculateTaskStats(tasks: TaskOrchestration[]) {
    const stats = {
      total: tasks.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      avg_duration: 0,
      success_rate: 0
    };

    let totalDuration = 0;
    let completedCount = 0;

    tasks.forEach(task => {
      stats[task.status as keyof typeof stats]++;
      
      if (task.status === 'completed' && task.actual_duration) {
        totalDuration += task.actual_duration;
        completedCount++;
      }
    });

    if (completedCount > 0) {
      stats.avg_duration = totalDuration / completedCount;
      stats.success_rate = stats.completed / (stats.completed + stats.failed);
    }

    return stats;
  }

  private async calculateNetworkPerformanceStats(networkId: string) {
    // This would typically involve complex queries - simplified for example
    const { data: metrics } = await this.client
      .from('performance_metrics')
      .select('metric_name, metric_value')
      .eq('network_id', networkId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const stats = {
      avg_response_time: 0,
      total_memory_usage: 0,
      total_cpu_usage: 0,
      avg_efficiency: 0,
      throughput: 0,
      error_rate: 0,
      uptime: 0
    };

    // Process metrics to calculate aggregated stats
    // This is a simplified example - real implementation would be more sophisticated

    return stats;
  }

  private async calculateNetworkHealthScore(networkId: string): Promise<number> {
    const healthStatus = await this.getNetworkHealthStatus(networkId);
    
    // Simple health score calculation based on recent issues
    const criticalCount = healthStatus.recent_issues.filter(i => i.status === 'critical').length;
    const errorCount = healthStatus.recent_issues.filter(i => i.status === 'error').length;
    const warningCount = healthStatus.recent_issues.filter(i => i.status === 'warning').length;

    let score = 100;
    score -= criticalCount * 20;
    score -= errorCount * 10;
    score -= warningCount * 5;

    return Math.max(0, score);
  }

  private async calculateAgentUptime(agentId: string): Promise<number> {
    // Calculate uptime based on heartbeats and activity
    const { data: agent } = await this.client
      .from('swarm_agents')
      .select('created_at, last_heartbeat')
      .eq('id', agentId)
      .single();

    if (!agent) return 0;

    const totalTime = Date.now() - new Date(agent.created_at).getTime();
    const lastHeartbeat = new Date(agent.last_heartbeat).getTime();
    const timeSinceHeartbeat = Date.now() - lastHeartbeat;

    // Simple uptime calculation - if last heartbeat was within 5 minutes, consider active
    const isCurrentlyActive = timeSinceHeartbeat < 5 * 60 * 1000;
    
    // This is simplified - real implementation would track historical uptime
    return isCurrentlyActive ? Math.min(100, (totalTime / (24 * 60 * 60 * 1000)) * 100) : 0;
  }

  private async calculateAgentSuccessRate(agentId: string): Promise<number> {
    const { data: agent } = await this.client
      .from('swarm_agents')
      .select('tasks_completed, tasks_failed')
      .eq('id', agentId)
      .single();

    if (!agent || agent.tasks_completed === 0) return 0;

    return agent.tasks_completed / (agent.tasks_completed + agent.tasks_failed);
  }

  private async getAgentHealthStatus(agentId: string): Promise<'healthy' | 'warning' | 'error' | 'critical'> {
    const { data: healthChecks } = await this.client
      .from('health_checks')
      .select('status')
      .eq('agent_id', agentId)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    return healthChecks?.[0]?.status || 'healthy';
  }

  // =====================================================================================
  // REAL-TIME SUBSCRIPTIONS
  // =====================================================================================

  /**
   * Subscribe to network events
   */
  subscribeToNetworkEvents(
    networkId: string,
    callbacks: {
      onNetworkChange?: (payload: any) => void;
      onAgentChange?: (payload: any) => void;
      onTaskChange?: (payload: any) => void;
      onEventLog?: (payload: any) => void;
      onMetricUpdate?: (payload: any) => void;
      onHealthUpdate?: (payload: any) => void;
    }
  ) {
    const subscriptions: any[] = [];

    if (callbacks.onNetworkChange) {
      subscriptions.push(
        this.client
          .channel(`network:${networkId}`)
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'swarm_networks',
              filter: `id=eq.${networkId}`
            }, 
            callbacks.onNetworkChange
          )
          .subscribe()
      );
    }

    if (callbacks.onAgentChange) {
      subscriptions.push(
        this.client
          .channel(`agents:${networkId}`)
          .on('postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'swarm_agents',
              filter: `network_id=eq.${networkId}`
            },
            callbacks.onAgentChange
          )
          .subscribe()
      );
    }

    if (callbacks.onTaskChange) {
      subscriptions.push(
        this.client
          .channel(`tasks:${networkId}`)
          .on('postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'task_orchestration',
              filter: `network_id=eq.${networkId}`
            },
            callbacks.onTaskChange
          )
          .subscribe()
      );
    }

    if (callbacks.onEventLog) {
      subscriptions.push(
        this.client
          .channel(`events:${networkId}`)
          .on('postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'coordination_events',
              filter: `network_id=eq.${networkId}`
            },
            callbacks.onEventLog
          )
          .subscribe()
      );
    }

    if (callbacks.onMetricUpdate) {
      subscriptions.push(
        this.client
          .channel(`metrics:${networkId}`)
          .on('postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'performance_metrics',
              filter: `network_id=eq.${networkId}`
            },
            callbacks.onMetricUpdate
          )
          .subscribe()
      );
    }

    if (callbacks.onHealthUpdate) {
      subscriptions.push(
        this.client
          .channel(`health:${networkId}`)
          .on('postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'health_checks',
              filter: `network_id=eq.${networkId}`
            },
            callbacks.onHealthUpdate
          )
          .subscribe()
      );
    }

    return {
      unsubscribe: () => {
        subscriptions.forEach(sub => {
          this.client.removeChannel(sub);
        });
      }
    };
  }
}