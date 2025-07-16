/**
 * Swarm Tracer for Claude Flow
 * Instruments swarm operations, coordination, and distributed task execution
 */

import { traceManager } from './trace-manager.js';
import { tracingConfig } from '../config/tracing-config.js';
import logger from '../utils/logger.js';

export class SwarmTracer {
  constructor() {
    this.config = tracingConfig;
    this.traceManager = traceManager;
    this.activeSwarms = new Map();
    this.coordinationEvents = new Map();
  }

  /**
   * Trace swarm initialization
   */
  async traceSwarmInit(swarmConfig, context = {}) {
    if (!this.config.isEnabled('swarm')) {
      return this.createMockTrace('swarm_init', swarmConfig);
    }

    try {
      const swarmId = swarmConfig.id || `swarm-${Date.now()}`;
      
      const trace = await this.traceManager.createTrace({
        name: 'swarm.initialize',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'swarm_init',
          swarm_id: swarmId,
          swarm_topology: swarmConfig.topology,
          swarm_strategy: swarmConfig.strategy,
          max_agents: swarmConfig.maxAgents,
          initialization_phase: 'start',
          claude_flow_component: 'swarm-orchestrator'
        },
        input: {
          config: swarmConfig,
          context: this.sanitizeContext(context)
        },
        tags: ['swarm', 'initialization', swarmConfig.topology, swarmConfig.strategy]
      });

      // Create topology setup span
      const topologySpan = await this.traceManager.createSpan(trace.id, {
        name: 'topology.setup',
        metadata: {
          topology_type: swarmConfig.topology,
          setup_phase: 'structure',
          node_count: swarmConfig.maxAgents
        },
        input: {
          topology: swarmConfig.topology,
          maxAgents: swarmConfig.maxAgents
        }
      });

      // Create coordination initialization span
      const coordinationSpan = await this.traceManager.createSpan(trace.id, {
        name: 'coordination.init',
        metadata: {
          coordination_phase: 'bootstrap',
          strategy: swarmConfig.strategy,
          sync_mechanism: 'memory-based'
        },
        input: {
          strategy: swarmConfig.strategy,
          enabledComponents: this.getEnabledComponents()
        }
      });

      // Create agent preparation span
      const agentSpan = await this.traceManager.createSpan(trace.id, {
        name: 'agents.prepare',
        metadata: {
          preparation_phase: 'resource_allocation',
          agent_slots: swarmConfig.maxAgents,
          agent_types: swarmConfig.agentTypes || []
        },
        input: {
          maxAgents: swarmConfig.maxAgents,
          agentTypes: swarmConfig.agentTypes
        }
      });

      // Store swarm trace reference
      this.activeSwarms.set(swarmId, {
        trace,
        config: swarmConfig,
        startTime: Date.now(),
        agents: new Map(),
        tasks: new Map()
      });

      return {
        trace,
        swarmId,
        spans: {
          topology: topologySpan,
          coordination: coordinationSpan,
          agents: agentSpan
        }
      };
    } catch (error) {
      logger.error('Failed to trace swarm initialization:', error.message);
      return this.createMockTrace('swarm_init', swarmConfig);
    }
  }

  /**
   * Trace coordination events
   */
  async traceCoordinationEvent(event, context = {}) {
    if (!this.config.isEnabled('swarm')) {
      return this.createMockTrace('coordination_event', event);
    }

    try {
      const swarmData = this.activeSwarms.get(event.swarmId);
      const parentTrace = swarmData?.trace;

      const trace = await this.traceManager.createTrace({
        name: 'swarm.coordination',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'coordination_event',
          swarm_id: event.swarmId,
          event_type: event.type,
          event_source: event.source,
          participants: event.participants || [],
          participant_count: (event.participants || []).length,
          coordination_state: event.state,
          parent_trace_id: parentTrace?.id,
          claude_flow_component: 'swarm-coordinator'
        },
        input: {
          event: this.sanitizeEvent(event),
          context: this.sanitizeContext(context)
        },
        tags: ['swarm', 'coordination', event.type, event.state || 'active']
      });

      // Create event processing span
      const processingSpan = await this.traceManager.createSpan(trace.id, {
        name: 'event.processing',
        metadata: {
          processing_phase: 'coordination',
          event_type: event.type,
          requires_consensus: event.requiresConsensus || false
        },
        input: {
          eventType: event.type,
          participants: event.participants?.length || 0
        }
      });

      // Create synchronization span if needed
      let syncSpan = null;
      if (event.requiresSync) {
        syncSpan = await this.traceManager.createSpan(trace.id, {
          name: 'coordination.sync',
          metadata: {
            sync_phase: 'participant_alignment',
            sync_mechanism: event.syncMechanism || 'memory-based',
            timeout_ms: event.syncTimeout || 30000
          },
          input: {
            participants: event.participants,
            syncMechanism: event.syncMechanism
          }
        });
      }

      // Store coordination event
      this.coordinationEvents.set(trace.id, {
        trace,
        event,
        startTime: Date.now(),
        participants: event.participants || []
      });

      return {
        trace,
        spans: {
          processing: processingSpan,
          sync: syncSpan
        }
      };
    } catch (error) {
      logger.error('Failed to trace coordination event:', error.message);
      return this.createMockTrace('coordination_event', event);
    }
  }

  /**
   * Trace agent spawning within swarm
   */
  async traceAgentSpawn(agentConfig, swarmId, context = {}) {
    if (!this.config.isEnabled('swarm') || !this.config.shouldTraceAgent(agentConfig.id)) {
      return this.createMockTrace('agent_spawn', agentConfig);
    }

    try {
      const swarmData = this.activeSwarms.get(swarmId);
      const parentTrace = swarmData?.trace;

      const trace = await this.traceManager.createTrace({
        name: 'swarm.agent.spawn',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'agent_spawn',
          swarm_id: swarmId,
          agent_id: agentConfig.id,
          agent_type: agentConfig.type,
          agent_role: agentConfig.role,
          agent_capabilities: agentConfig.capabilities || [],
          spawn_phase: 'initialization',
          parent_trace_id: parentTrace?.id,
          claude_flow_component: 'swarm-agent-manager'
        },
        input: {
          agentConfig: this.sanitizeAgentConfig(agentConfig),
          swarmContext: { swarmId, topology: swarmData?.config?.topology }
        },
        tags: ['swarm', 'agent', 'spawn', agentConfig.type, agentConfig.role]
      });

      // Create lifecycle span
      const lifecycleSpan = await this.traceManager.createSpan(trace.id, {
        name: 'agent.lifecycle',
        metadata: {
          lifecycle_phase: 'creation',
          agent_type: agentConfig.type,
          resource_requirements: agentConfig.resources || {}
        },
        input: {
          agentId: agentConfig.id,
          agentType: agentConfig.type,
          capabilities: agentConfig.capabilities
        }
      });

      // Create capability initialization span
      const capabilitySpan = await this.traceManager.createSpan(trace.id, {
        name: 'agent.capabilities',
        metadata: {
          capability_phase: 'initialization',
          capability_count: (agentConfig.capabilities || []).length,
          specialized_for: agentConfig.specialization || 'general'
        },
        input: {
          capabilities: agentConfig.capabilities,
          specialization: agentConfig.specialization
        }
      });

      // Store agent in swarm data
      if (swarmData) {
        swarmData.agents.set(agentConfig.id, {
          trace,
          config: agentConfig,
          spawnTime: Date.now(),
          status: 'initializing'
        });
      }

      return {
        trace,
        spans: {
          lifecycle: lifecycleSpan,
          capabilities: capabilitySpan
        }
      };
    } catch (error) {
      logger.error('Failed to trace agent spawn:', error.message);
      return this.createMockTrace('agent_spawn', agentConfig);
    }
  }

  /**
   * Trace task orchestration
   */
  async traceTaskOrchestration(task, swarmId, context = {}) {
    if (!this.config.isEnabled('swarm')) {
      return this.createMockTrace('task_orchestration', task);
    }

    try {
      const swarmData = this.activeSwarms.get(swarmId);
      const parentTrace = swarmData?.trace;

      const trace = await this.traceManager.createTrace({
        name: 'swarm.task.orchestrate',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'task_orchestration',
          swarm_id: swarmId,
          task_id: task.id,
          task_type: task.type,
          task_priority: task.priority || 'medium',
          task_strategy: task.strategy || 'adaptive',
          orchestration_phase: 'planning',
          parent_trace_id: parentTrace?.id,
          claude_flow_component: 'task-orchestrator'
        },
        input: {
          task: this.sanitizeTask(task),
          swarmContext: { swarmId, availableAgents: swarmData?.agents.size || 0 }
        },
        tags: ['swarm', 'task', 'orchestration', task.priority || 'medium', task.strategy || 'adaptive']
      });

      // Create planning span
      const planningSpan = await this.traceManager.createSpan(trace.id, {
        name: 'task.planning',
        metadata: {
          planning_phase: 'decomposition',
          task_complexity: task.complexity || 'unknown',
          estimated_duration: task.estimatedDuration || 0
        },
        input: {
          taskId: task.id,
          taskType: task.type,
          requirements: task.requirements || {}
        }
      });

      // Create distribution span
      const distributionSpan = await this.traceManager.createSpan(trace.id, {
        name: 'task.distribution',
        metadata: {
          distribution_phase: 'agent_assignment',
          distribution_strategy: task.strategy || 'adaptive',
          target_agents: task.targetAgents || []
        },
        input: {
          strategy: task.strategy,
          targetAgents: task.targetAgents,
          parallelizable: task.parallelizable || false
        }
      });

      // Store task in swarm data
      if (swarmData) {
        swarmData.tasks.set(task.id, {
          trace,
          task,
          startTime: Date.now(),
          status: 'orchestrating',
          assignedAgents: []
        });
      }

      return {
        trace,
        spans: {
          planning: planningSpan,
          distribution: distributionSpan
        }
      };
    } catch (error) {
      logger.error('Failed to trace task orchestration:', error.message);
      return this.createMockTrace('task_orchestration', task);
    }
  }

  /**
   * Trace swarm topology changes
   */
  async traceTopologyChange(change, swarmId, context = {}) {
    if (!this.config.isEnabled('swarm')) {
      return this.createMockTrace('topology_change', change);
    }

    try {
      const swarmData = this.activeSwarms.get(swarmId);
      const parentTrace = swarmData?.trace;

      const trace = await this.traceManager.createTrace({
        name: 'swarm.topology.change',
        sessionId: context.sessionId,
        metadata: {
          operation_type: 'topology_change',
          swarm_id: swarmId,
          change_type: change.type,
          change_reason: change.reason,
          old_topology: change.oldTopology,
          new_topology: change.newTopology,
          affected_agents: change.affectedAgents || [],
          parent_trace_id: parentTrace?.id,
          claude_flow_component: 'topology-manager'
        },
        input: {
          change: this.sanitizeChange(change),
          swarmContext: { swarmId, currentSize: swarmData?.agents.size || 0 }
        },
        tags: ['swarm', 'topology', 'change', change.type, change.reason]
      });

      // Create reconfiguration span
      const reconfigSpan = await this.traceManager.createSpan(trace.id, {
        name: 'topology.reconfigure',
        metadata: {
          reconfiguration_phase: 'structure_update',
          topology_from: change.oldTopology,
          topology_to: change.newTopology,
          migration_required: change.migrationRequired || false
        },
        input: {
          oldTopology: change.oldTopology,
          newTopology: change.newTopology,
          affectedAgents: change.affectedAgents?.length || 0
        }
      });

      return {
        trace,
        spans: {
          reconfiguration: reconfigSpan
        }
      };
    } catch (error) {
      logger.error('Failed to trace topology change:', error.message);
      return this.createMockTrace('topology_change', change);
    }
  }

  /**
   * End swarm initialization
   */
  async endSwarmInit(traceData, result, error = null) {
    if (!traceData || traceData.trace?.mock) {
      return;
    }

    try {
      const { trace, spans, swarmId } = traceData;
      
      // End all spans
      if (spans.topology) {
        await this.traceManager.endSpan(spans.topology.id, null, {
          topology_status: error ? 'failed' : 'configured',
          topology_error: error ? error.message : undefined
        });
      }

      if (spans.coordination) {
        await this.traceManager.endSpan(spans.coordination.id, null, {
          coordination_status: error ? 'failed' : 'initialized',
          coordination_error: error ? error.message : undefined
        });
      }

      if (spans.agents) {
        await this.traceManager.endSpan(spans.agents.id, null, {
          agent_status: error ? 'failed' : 'prepared',
          agent_error: error ? error.message : undefined
        });
      }

      // End main trace
      await this.traceManager.endTrace(trace.id, result, {
        swarm_status: error ? 'failed' : 'initialized',
        swarm_id: swarmId,
        final_agent_count: result?.agentCount || 0,
        initialization_duration: Date.now() - trace.startTime,
        error_message: error ? error.message : undefined
      });

      // Update swarm data
      const swarmData = this.activeSwarms.get(swarmId);
      if (swarmData) {
        swarmData.status = error ? 'failed' : 'initialized';
        swarmData.error = error;
      }

      logger.debug('Ended swarm initialization trace', {
        traceId: trace.id,
        swarmId,
        status: error ? 'failed' : 'initialized'
      });
    } catch (endError) {
      logger.error('Failed to end swarm initialization trace:', endError.message);
    }
  }

  /**
   * End coordination event
   */
  async endCoordinationEvent(traceData, result, error = null) {
    if (!traceData || traceData.trace?.mock) {
      return;
    }

    try {
      const { trace, spans } = traceData;
      
      // End spans
      if (spans.processing) {
        await this.traceManager.endSpan(spans.processing.id, result, {
          processing_status: error ? 'failed' : 'completed',
          processing_error: error ? error.message : undefined,
          event_outcome: result?.outcome || 'unknown'
        });
      }

      if (spans.sync) {
        await this.traceManager.endSpan(spans.sync.id, result, {
          sync_status: error ? 'failed' : 'completed',
          sync_error: error ? error.message : undefined,
          participants_synced: result?.participantsSynced || 0
        });
      }

      // End trace
      await this.traceManager.endTrace(trace.id, result, {
        coordination_status: error ? 'failed' : 'completed',
        error_message: error ? error.message : undefined,
        final_state: result?.finalState || 'unknown'
      });

      // Clean up coordination event
      this.coordinationEvents.delete(trace.id);

      logger.debug('Ended coordination event trace', {
        traceId: trace.id,
        status: error ? 'failed' : 'completed'
      });
    } catch (endError) {
      logger.error('Failed to end coordination event trace:', endError.message);
    }
  }

  /**
   * Get enabled components for metadata
   */
  getEnabledComponents() {
    return Object.entries(this.config.getConfig().components)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
  }

  /**
   * Sanitize event data
   */
  sanitizeEvent(event) {
    const sanitized = { ...event };
    
    // Remove sensitive fields
    if (sanitized.credentials) {
      sanitized.credentials = '***redacted***';
    }
    
    if (sanitized.tokens) {
      sanitized.tokens = '***redacted***';
    }
    
    return sanitized;
  }

  /**
   * Sanitize agent configuration
   */
  sanitizeAgentConfig(agentConfig) {
    const sanitized = { ...agentConfig };
    
    // Remove sensitive configuration
    if (sanitized.secrets) {
      sanitized.secrets = '***redacted***';
    }
    
    if (sanitized.apiKeys) {
      sanitized.apiKeys = '***redacted***';
    }
    
    return sanitized;
  }

  /**
   * Sanitize task data
   */
  sanitizeTask(task) {
    const sanitized = { ...task };
    
    // Remove sensitive task data
    if (sanitized.credentials) {
      sanitized.credentials = '***redacted***';
    }
    
    if (sanitized.secrets) {
      sanitized.secrets = '***redacted***';
    }
    
    return sanitized;
  }

  /**
   * Sanitize topology change data
   */
  sanitizeChange(change) {
    const sanitized = { ...change };
    
    // Remove sensitive change data
    if (sanitized.migrationSecrets) {
      sanitized.migrationSecrets = '***redacted***';
    }
    
    return sanitized;
  }

  /**
   * Sanitize context data
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove sensitive context fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***redacted***';
      }
    }
    
    return sanitized;
  }

  /**
   * Create mock trace for when tracing is disabled
   */
  createMockTrace(operation, data) {
    return {
      trace: {
        id: `mock-swarm-${Date.now()}`,
        name: `swarm.${operation}`,
        mock: true,
        timestamp: new Date().toISOString()
      },
      spans: {
        main: {
          id: `mock-span-${Date.now()}`,
          name: `${operation}.main`,
          mock: true,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Get swarm tracing statistics
   */
  getStats() {
    return {
      enabled: this.config.isEnabled('swarm'),
      activeSwarms: this.activeSwarms.size,
      activeCoordinationEvents: this.coordinationEvents.size,
      totalAgents: Array.from(this.activeSwarms.values())
        .reduce((sum, swarm) => sum + swarm.agents.size, 0),
      totalTasks: Array.from(this.activeSwarms.values())
        .reduce((sum, swarm) => sum + swarm.tasks.size, 0),
      componentConfig: this.config.getComponentConfig('swarm')
    };
  }

  /**
   * Get swarm details
   */
  getSwarmDetails(swarmId) {
    const swarmData = this.activeSwarms.get(swarmId);
    if (!swarmData) {
      return null;
    }

    return {
      swarmId,
      status: swarmData.status || 'active',
      config: swarmData.config,
      startTime: swarmData.startTime,
      agents: Array.from(swarmData.agents.values()).map(agent => ({
        id: agent.config.id,
        type: agent.config.type,
        status: agent.status,
        spawnTime: agent.spawnTime
      })),
      tasks: Array.from(swarmData.tasks.values()).map(task => ({
        id: task.task.id,
        type: task.task.type,
        status: task.status,
        startTime: task.startTime,
        assignedAgents: task.assignedAgents
      }))
    };
  }
}

// Create singleton instance
export const swarmTracer = new SwarmTracer();

// Export convenience functions
export const traceSwarmInit = (swarmConfig, context) => 
  swarmTracer.traceSwarmInit(swarmConfig, context);

export const traceCoordinationEvent = (event, context) => 
  swarmTracer.traceCoordinationEvent(event, context);

export const traceAgentSpawn = (agentConfig, swarmId, context) => 
  swarmTracer.traceAgentSpawn(agentConfig, swarmId, context);

export const traceTaskOrchestration = (task, swarmId, context) => 
  swarmTracer.traceTaskOrchestration(task, swarmId, context);

export const traceTopologyChange = (change, swarmId, context) => 
  swarmTracer.traceTopologyChange(change, swarmId, context);

export const endSwarmInit = (traceData, result, error) => 
  swarmTracer.endSwarmInit(traceData, result, error);

export const endCoordinationEvent = (traceData, result, error) => 
  swarmTracer.endCoordinationEvent(traceData, result, error);