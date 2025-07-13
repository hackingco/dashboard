/**
 * SwarmTracer - Specialized tracer for agent actions and coordination
 * Provides enhanced tracing capabilities for Claude Flow swarm operations
 */

import { EventEmitter } from 'events';
import { LangfuseWrapper } from './index';

export interface SwarmAction {
  actionType: 'spawn' | 'task' | 'coordinate' | 'communicate' | 'complete' | 'error';
  agentId: string;
  agentRole: string;
  swarmId: string;
  taskId?: string;
  parentAgentId?: string;
  payload?: any;
  timestamp: number;
}

export interface SwarmCoordinationEvent {
  eventType: 'agent_spawned' | 'task_assigned' | 'task_completed' | 'coordination_sync' | 'memory_shared';
  swarmId: string;
  source: string;
  target?: string;
  data: any;
  timestamp: number;
}

export interface SwarmMetrics {
  swarmId: string;
  activeAgents: number;
  completedTasks: number;
  pendingTasks: number;
  totalTokens: number;
  totalCost: number;
  efficiency: number;
  avgResponseTime: number;
}

export class SwarmTracer extends EventEmitter {
  private wrapper: LangfuseWrapper;
  private swarmTraces: Map<string, string> = new Map(); // swarmId -> traceId
  private agentSpans: Map<string, string> = new Map(); // agentId -> spanId
  private taskSpans: Map<string, string> = new Map(); // taskId -> spanId
  private coordinationQueue: SwarmCoordinationEvent[] = [];
  private metricsCache: Map<string, SwarmMetrics> = new Map();

  constructor(wrapper: LangfuseWrapper) {
    super();
    this.wrapper = wrapper;
    this.startCoordinationProcessor();
  }

  /**
   * Start a new swarm trace
   */
  async startSwarmTrace(
    swarmId: string,
    topology: string,
    maxAgents: number,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    const traceId = await this.wrapper.preHook({
      hookType: 'swarm_init',
      swarmId,
      metadata: {
        topology,
        maxAgents,
        startTime: new Date().toISOString(),
        ...metadata
      }
    });

    if (traceId) {
      this.swarmTraces.set(swarmId, traceId);
      this.emit('swarm_started', { swarmId, traceId, topology, maxAgents });
    }

    return traceId;
  }

  /**
   * Trace agent spawn action
   */
  async traceAgentSpawn(
    action: SwarmAction,
    capabilities?: string[]
  ): Promise<void> {
    const swarmTraceId = this.swarmTraces.get(action.swarmId);
    if (!swarmTraceId) return;

    const spanId = await this.wrapper.createSpan(
      swarmTraceId,
      `agent_spawn_${action.agentRole}`,
      {
        agentId: action.agentId,
        agentRole: action.agentRole,
        capabilities,
        parentAgent: action.parentAgentId
      },
      {
        actionType: action.actionType,
        swarmId: action.swarmId,
        timestamp: action.timestamp
      }
    );

    if (spanId) {
      this.agentSpans.set(action.agentId, spanId);
      this.recordCoordinationEvent({
        eventType: 'agent_spawned',
        swarmId: action.swarmId,
        source: action.parentAgentId || 'orchestrator',
        target: action.agentId,
        data: { agentRole: action.agentRole, capabilities },
        timestamp: action.timestamp
      });
    }
  }

  /**
   * Trace task assignment
   */
  async traceTaskAssignment(
    taskId: string,
    agentId: string,
    swarmId: string,
    taskDescription: string,
    priority?: string
  ): Promise<void> {
    const swarmTraceId = this.swarmTraces.get(swarmId);
    if (!swarmTraceId) return;

    const spanId = await this.wrapper.createSpan(
      swarmTraceId,
      `task_${taskId}`,
      {
        taskId,
        agentId,
        taskDescription,
        priority,
        assignedAt: new Date().toISOString()
      },
      {
        swarmId,
        taskType: 'assignment'
      }
    );

    if (spanId) {
      this.taskSpans.set(taskId, spanId);
      this.recordCoordinationEvent({
        eventType: 'task_assigned',
        swarmId,
        source: 'orchestrator',
        target: agentId,
        data: { taskId, taskDescription, priority },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Trace agent communication
   */
  async traceAgentCommunication(
    fromAgent: string,
    toAgent: string,
    swarmId: string,
    messageType: string,
    payload: any
  ): Promise<void> {
    const swarmTraceId = this.swarmTraces.get(swarmId);
    if (!swarmTraceId) return;

    await this.wrapper.createSpan(
      swarmTraceId,
      `communication_${messageType}`,
      {
        fromAgent,
        toAgent,
        messageType,
        payload: JSON.stringify(payload).substring(0, 1000) // Truncate large payloads
      },
      {
        swarmId,
        communicationType: messageType
      }
    );

    this.recordCoordinationEvent({
      eventType: 'coordination_sync',
      swarmId,
      source: fromAgent,
      target: toAgent,
      data: { messageType, payloadSize: JSON.stringify(payload).length },
      timestamp: Date.now()
    });
  }

  /**
   * Trace task completion
   */
  async traceTaskCompletion(
    taskId: string,
    agentId: string,
    swarmId: string,
    result: any,
    tokenUsage?: { input: number; output: number; total?: number }
  ): Promise<void> {
    const spanId = this.taskSpans.get(taskId);
    if (!spanId) return;

    await this.wrapper.endSpan(
      spanId,
      {
        status: 'completed',
        result: JSON.stringify(result).substring(0, 1000),
        completedBy: agentId,
        completedAt: new Date().toISOString()
      },
      {
        swarmId,
        taskId,
        tokenUsage
      }
    );

    this.taskSpans.delete(taskId);
    this.updateSwarmMetrics(swarmId, { completedTask: true, tokenUsage });

    this.recordCoordinationEvent({
      eventType: 'task_completed',
      swarmId,
      source: agentId,
      data: { taskId, success: true },
      timestamp: Date.now()
    });
  }

  /**
   * Trace error in swarm operation
   */
  async traceSwarmError(
    swarmId: string,
    agentId: string,
    error: Error,
    context: Record<string, any>
  ): Promise<void> {
    const swarmTraceId = this.swarmTraces.get(swarmId);
    if (!swarmTraceId) return;

    await this.wrapper.errorHook(
      swarmTraceId,
      error,
      {
        swarmId,
        agentId,
        errorContext: context,
        timestamp: new Date().toISOString()
      }
    );

    this.emit('swarm_error', { swarmId, agentId, error, context });
  }

  /**
   * Complete swarm trace
   */
  async completeSwarmTrace(
    swarmId: string,
    summary: Record<string, any>
  ): Promise<void> {
    const traceId = this.swarmTraces.get(swarmId);
    if (!traceId) return;

    const metrics = this.metricsCache.get(swarmId) || this.createDefaultMetrics(swarmId);

    await this.wrapper.postHook(
      traceId,
      {
        status: 'completed',
        summary,
        metrics,
        completedAt: new Date().toISOString()
      },
      {
        input: metrics.totalTokens,
        output: 0,
        total: metrics.totalTokens
      },
      {
        swarmId,
        finalMetrics: metrics
      }
    );

    // Clean up
    this.swarmTraces.delete(swarmId);
    this.metricsCache.delete(swarmId);
    
    // Clean up any remaining agent spans
    for (const [agentId, spanId] of this.agentSpans.entries()) {
      if (agentId.includes(swarmId)) {
        await this.wrapper.endSpan(spanId, { status: 'swarm_completed' });
        this.agentSpans.delete(agentId);
      }
    }

    this.emit('swarm_completed', { swarmId, metrics, summary });
  }

  /**
   * Get real-time swarm metrics
   */
  getSwarmMetrics(swarmId: string): SwarmMetrics | null {
    return this.metricsCache.get(swarmId) || null;
  }

  /**
   * Record coordination event for later processing
   */
  private recordCoordinationEvent(event: SwarmCoordinationEvent): void {
    this.coordinationQueue.push(event);
    this.emit('coordination_event', event);
  }

  /**
   * Process coordination events in batches
   */
  private startCoordinationProcessor(): void {
    setInterval(() => {
      if (this.coordinationQueue.length === 0) return;

      const events = this.coordinationQueue.splice(0, 100); // Process up to 100 events
      this.processCoordinationBatch(events);
    }, 5000); // Every 5 seconds
  }

  /**
   * Process a batch of coordination events
   */
  private async processCoordinationBatch(events: SwarmCoordinationEvent[]): Promise<void> {
    // Group events by swarm
    const eventsBySwarm = events.reduce((acc, event) => {
      if (!acc[event.swarmId]) acc[event.swarmId] = [];
      acc[event.swarmId].push(event);
      return acc;
    }, {} as Record<string, SwarmCoordinationEvent[]>);

    // Process each swarm's events
    for (const [swarmId, swarmEvents] of Object.entries(eventsBySwarm)) {
      const traceId = this.swarmTraces.get(swarmId);
      if (!traceId) continue;

      // Create a coordination summary span
      const spanId = await this.wrapper.createSpan(
        traceId,
        'coordination_batch',
        {
          eventCount: swarmEvents.length,
          eventTypes: [...new Set(swarmEvents.map(e => e.eventType))],
          timeRange: {
            start: Math.min(...swarmEvents.map(e => e.timestamp)),
            end: Math.max(...swarmEvents.map(e => e.timestamp))
          }
        },
        {
          swarmId,
          batchProcessing: true
        }
      );

      if (spanId) {
        // Store coordination data in memory for cross-agent access
        await this.storeCoordinationData(swarmId, swarmEvents);
        
        await this.wrapper.endSpan(
          spanId,
          {
            processed: swarmEvents.length,
            stored: true
          }
        );
      }
    }
  }

  /**
   * Store coordination data in SQLite memory
   */
  private async storeCoordinationData(
    swarmId: string,
    events: SwarmCoordinationEvent[]
  ): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      for (const event of events) {
        const memoryKey = `swarm/coordination/${swarmId}/${event.eventType}/${event.timestamp}`;
        const eventData = {
          ...event,
          processedAt: Date.now()
        };
        
        const query = `sqlite3 .swarm/memory.db "INSERT OR REPLACE INTO memory_entries (key, value, namespace, metadata) VALUES ('${memoryKey}', '${JSON.stringify(eventData).replace(/'/g, "''")}', 'swarm_coordination', '${JSON.stringify({ swarmId, eventType: event.eventType })}')"`;
        execSync(query);
      }
    } catch (error) {
      console.warn('Failed to store coordination data:', error);
    }
  }

  /**
   * Update swarm metrics
   */
  private updateSwarmMetrics(
    swarmId: string,
    update: {
      completedTask?: boolean;
      tokenUsage?: { input: number; output: number; total?: number };
      agentAdded?: boolean;
      agentRemoved?: boolean;
    }
  ): void {
    const metrics = this.metricsCache.get(swarmId) || this.createDefaultMetrics(swarmId);

    if (update.completedTask) {
      metrics.completedTasks++;
      metrics.pendingTasks = Math.max(0, metrics.pendingTasks - 1);
    }

    if (update.tokenUsage) {
      metrics.totalTokens += update.tokenUsage.total || (update.tokenUsage.input + update.tokenUsage.output);
      metrics.totalCost = this.estimateCost(metrics.totalTokens);
    }

    if (update.agentAdded) {
      metrics.activeAgents++;
    }

    if (update.agentRemoved) {
      metrics.activeAgents = Math.max(0, metrics.activeAgents - 1);
    }

    // Calculate efficiency
    if (metrics.completedTasks > 0 && metrics.totalCost > 0) {
      metrics.efficiency = metrics.completedTasks / metrics.totalCost;
    }

    this.metricsCache.set(swarmId, metrics);
  }

  /**
   * Create default metrics object
   */
  private createDefaultMetrics(swarmId: string): SwarmMetrics {
    return {
      swarmId,
      activeAgents: 0,
      completedTasks: 0,
      pendingTasks: 0,
      totalTokens: 0,
      totalCost: 0,
      efficiency: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Estimate cost based on total tokens
   */
  private estimateCost(totalTokens: number): number {
    // Claude Sonnet pricing: $3/1M input, $15/1M output
    // Assuming 30% input, 70% output ratio
    const inputTokens = totalTokens * 0.3;
    const outputTokens = totalTokens * 0.7;
    return (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
  }

  /**
   * Get all active swarms
   */
  getActiveSwarms(): string[] {
    return Array.from(this.swarmTraces.keys());
  }

  /**
   * Get coordination history for a swarm
   */
  async getCoordinationHistory(swarmId: string): Promise<SwarmCoordinationEvent[]> {
    try {
      const { execSync } = require('child_process');
      
      const query = `sqlite3 .swarm/memory.db "SELECT value FROM memory_entries WHERE namespace = 'swarm_coordination' AND key LIKE '%${swarmId}%' ORDER BY key"`;
      const result = execSync(query, { encoding: 'utf8' }).trim();
      
      if (!result) return [];
      
      return result.split('\n').map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean) as SwarmCoordinationEvent[];
    } catch (error) {
      console.warn('Failed to get coordination history:', error);
      return [];
    }
  }
}

// Export singleton instance that wraps the main langfuseWrapper
export function createSwarmTracer(wrapper: LangfuseWrapper): SwarmTracer {
  return new SwarmTracer(wrapper);
}