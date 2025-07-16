/**
 * Swarm Tracer Interface
 * Defines the contract for tracing swarm-specific operations
 */

export interface SwarmOperation {
  swarmId: string;
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star';
  agentCount: number;
  strategy: 'balanced' | 'specialized' | 'adaptive';
  startTime: Date;
  metadata?: Record<string, any>;
}

export interface AgentOperation {
  agentId: string;
  agentRole: string;
  swarmId: string;
  operationType: 'spawn' | 'task' | 'coordinate' | 'complete';
  taskId?: string;
  parentAgentId?: string;
  startTime: Date;
  metadata?: Record<string, any>;
}

export interface CoordinationEvent {
  eventType: 'message' | 'sync' | 'handoff' | 'merge';
  sourceAgentId: string;
  targetAgentId?: string;
  swarmId: string;
  payload?: any;
  timestamp: Date;
}

export interface SwarmMetrics {
  swarmId: string;
  activeAgents: number;
  completedTasks: number;
  pendingTasks: number;
  totalTokensUsed: number;
  totalCost: number;
  avgResponseTime: number;
  coordinationEfficiency: number;
  timestamp: Date;
}

export interface SwarmTracer {
  /**
   * Start tracing a swarm operation
   */
  startSwarmOperation(operation: SwarmOperation): Promise<string>;
  
  /**
   * End a swarm operation trace
   */
  endSwarmOperation(traceId: string, result?: any, error?: Error): Promise<void>;
  
  /**
   * Trace an agent operation within a swarm
   */
  traceAgentOperation(operation: AgentOperation): Promise<string>;
  
  /**
   * Record a coordination event between agents
   */
  recordCoordinationEvent(event: CoordinationEvent): Promise<void>;
  
  /**
   * Update swarm metrics
   */
  updateSwarmMetrics(metrics: SwarmMetrics): Promise<void>;
  
  /**
   * Get correlation data for distributed tracing
   */
  getCorrelationContext(swarmId: string): Promise<{
    traceId: string;
    spanId: string;
    baggage: Record<string, string>;
  }>;
  
  /**
   * Create a child span for nested operations
   */
  createChildSpan(
    parentSpanId: string,
    operationName: string,
    attributes?: Record<string, any>
  ): Promise<string>;
}