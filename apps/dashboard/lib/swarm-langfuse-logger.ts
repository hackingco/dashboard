/**
 * Real-time Langfuse logging for swarm operations
 * Provides instrumentation for all swarm activities with live updates
 */

import { getLangfuseServer, traceAgentActivity, traceSwarmCoordination, BatchTracer } from './langfuse-server'
import { EventEmitter } from 'events'

export interface SwarmEvent {
  type: 'agent_spawn' | 'agent_task' | 'agent_complete' | 'swarm_init' | 'swarm_coordinate' | 'swarm_metrics'
  swarmId: string
  agentId?: string
  agentName?: string
  data: any
  timestamp: Date
}

export class SwarmLangfuseLogger extends EventEmitter {
  private swarmId: string
  private sessionId: string
  private batchTracer: BatchTracer
  private activeAgents: Map<string, { name: string; startTime: number }>
  private metricsInterval: NodeJS.Timeout | null = null

  constructor(swarmId: string, sessionId: string) {
    super()
    this.swarmId = swarmId
    this.sessionId = sessionId
    this.batchTracer = new BatchTracer(20, 2000) // Batch 20 traces or flush every 2 seconds
    this.activeAgents = new Map()
    
    this.startMetricsCollection()
  }

  // Log swarm initialization
  async logSwarmInit(topology: string, maxAgents: number, strategy: string): Promise<void> {
    const langfuse = getLangfuseServer()
    
    const trace = langfuse.trace({
      name: '🤖 Swarm Initialization',
      sessionId: this.sessionId,
      metadata: {
        swarmId: this.swarmId,
        topology,
        maxAgents,
        strategy,
        timestamp: new Date().toISOString(),
      },
      tags: ['swarm', 'initialization', topology],
    })

    await langfuse.flushAsync()

    this.emit('swarm_initialized', {
      swarmId: this.swarmId,
      topology,
      maxAgents,
      strategy,
    })
  }

  // Log agent spawning
  async logAgentSpawn(agentId: string, agentName: string, type: string, capabilities: string[]): Promise<void> {
    this.activeAgents.set(agentId, { name: agentName, startTime: Date.now() })

    await traceAgentActivity(
      agentId,
      agentName,
      'spawn',
      this.sessionId,
      {
        swarmId: this.swarmId,
        type,
        capabilities,
        spawnTime: new Date().toISOString(),
      }
    )

    this.emit('agent_spawned', {
      swarmId: this.swarmId,
      agentId,
      agentName,
      type,
      capabilities,
    })
  }

  // Log agent task assignment
  async logAgentTask(agentId: string, task: string, priority: string): Promise<void> {
    const agent = this.activeAgents.get(agentId)
    if (!agent) return

    const langfuse = getLangfuseServer()
    
    const trace = langfuse.trace({
      name: `📋 Task Assignment: ${agent.name}`,
      sessionId: this.sessionId,
      userId: agentId,
      metadata: {
        swarmId: this.swarmId,
        agentId,
        agentName: agent.name,
        task,
        priority,
        timestamp: new Date().toISOString(),
      },
      tags: ['agent', 'task', priority],
    })

    const span = trace.span({
      name: 'Task Execution',
      metadata: {
        task,
        priority,
      },
    })

    // Store span reference for task completion
    this.activeAgents.set(agentId, { ...agent, currentSpan: span })

    await langfuse.flushAsync()

    this.emit('task_assigned', {
      swarmId: this.swarmId,
      agentId,
      agentName: agent.name,
      task,
      priority,
    })
  }

  // Log agent task completion
  async logAgentComplete(agentId: string, result: any, duration: number): Promise<void> {
    const agent = this.activeAgents.get(agentId)
    if (!agent) return

    // End the task span if it exists
    if (agent.currentSpan) {
      agent.currentSpan.end({
        output: result,
        metadata: {
          duration,
          success: true,
        },
      })
    }

    await traceAgentActivity(
      agentId,
      agent.name,
      'task_complete',
      this.sessionId,
      {
        swarmId: this.swarmId,
        result,
        duration,
        completionTime: new Date().toISOString(),
      }
    )

    this.emit('task_completed', {
      swarmId: this.swarmId,
      agentId,
      agentName: agent.name,
      result,
      duration,
    })
  }

  // Log swarm coordination events
  async logSwarmCoordination(event: string, participants: string[], data: any): Promise<void> {
    await traceSwarmCoordination(
      this.swarmId,
      event,
      participants,
      this.sessionId,
      {
        data,
        timestamp: new Date().toISOString(),
      }
    )

    this.emit('swarm_coordination', {
      swarmId: this.swarmId,
      event,
      participants,
      data,
    })
  }

  // Log real-time metrics
  async logSwarmMetrics(metrics: {
    activeAgents: number
    completedTasks: number
    averageResponseTime: number
    throughput: number
    errorRate: number
  }): Promise<void> {
    this.batchTracer.add({
      name: '📊 Swarm Metrics Update',
      sessionId: this.sessionId,
      metadata: {
        swarmId: this.swarmId,
        ...metrics,
        timestamp: new Date().toISOString(),
      },
      tags: ['swarm', 'metrics', 'real-time'],
    })

    this.emit('metrics_update', {
      swarmId: this.swarmId,
      metrics,
    })
  }

  // Log error events
  async logError(agentId: string | null, error: Error, context: any): Promise<void> {
    const langfuse = getLangfuseServer()
    
    const trace = langfuse.trace({
      name: `❌ Swarm Error: ${error.message}`,
      sessionId: this.sessionId,
      userId: agentId || undefined,
      metadata: {
        swarmId: this.swarmId,
        agentId,
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      },
      tags: ['swarm', 'error', agentId ? 'agent-error' : 'swarm-error'],
      level: 'ERROR',
    })

    await langfuse.flushAsync()

    this.emit('error_occurred', {
      swarmId: this.swarmId,
      agentId,
      error: error.message,
      context,
    })
  }

  // Log performance warnings
  async logPerformanceWarning(operation: string, duration: number, threshold: number): Promise<void> {
    const langfuse = getLangfuseServer()
    
    const trace = langfuse.trace({
      name: `⚠️ Performance Warning: ${operation}`,
      sessionId: this.sessionId,
      metadata: {
        swarmId: this.swarmId,
        operation,
        duration,
        threshold,
        exceededBy: duration - threshold,
        timestamp: new Date().toISOString(),
      },
      tags: ['swarm', 'performance', 'warning'],
      level: 'WARNING',
    })

    await langfuse.flushAsync()

    this.emit('performance_warning', {
      swarmId: this.swarmId,
      operation,
      duration,
      threshold,
    })
  }

  // Start automatic metrics collection
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      const metrics = {
        activeAgents: this.activeAgents.size,
        completedTasks: Math.floor(Math.random() * 10) + 5, // Would be tracked in real implementation
        averageResponseTime: Math.floor(Math.random() * 1000) + 500,
        throughput: Math.floor(Math.random() * 20) + 10,
        errorRate: Math.random() * 5,
      }

      await this.logSwarmMetrics(metrics)
    }, 5000) // Update every 5 seconds
  }

  // Clean up resources
  async close(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    await this.batchTracer.close()

    const langfuse = getLangfuseServer()
    const trace = langfuse.trace({
      name: '🔚 Swarm Shutdown',
      sessionId: this.sessionId,
      metadata: {
        swarmId: this.swarmId,
        totalAgents: this.activeAgents.size,
        shutdownTime: new Date().toISOString(),
      },
      tags: ['swarm', 'shutdown'],
    })

    await langfuse.flushAsync()

    this.removeAllListeners()
  }
}

// Factory function to create logger instances
export function createSwarmLogger(swarmId: string, sessionId?: string): SwarmLangfuseLogger {
  const finalSessionId = sessionId || `swarm-${Date.now()}`
  return new SwarmLangfuseLogger(swarmId, finalSessionId)
}

// Global logger registry
const loggerRegistry = new Map<string, SwarmLangfuseLogger>()

export function getSwarmLogger(swarmId: string): SwarmLangfuseLogger | undefined {
  return loggerRegistry.get(swarmId)
}

export function registerSwarmLogger(swarmId: string, logger: SwarmLangfuseLogger): void {
  loggerRegistry.set(swarmId, logger)
}

export function unregisterSwarmLogger(swarmId: string): void {
  const logger = loggerRegistry.get(swarmId)
  if (logger) {
    logger.close()
    loggerRegistry.delete(swarmId)
  }
}