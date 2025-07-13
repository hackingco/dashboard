/**
 * Local type definitions for Langfuse wrapper
 * Replaces @swarm/types dependency for testing
 */

export interface ObservabilityContext {
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  taskId?: string;
  operationType?: string;
  metadata?: Record<string, any>;
}

export interface LangfuseFlySpan {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
}

export interface ObservabilityCorrelation {
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  context: ObservabilityContext;
}

export interface FlyAPIMetrics {
  requests: number;
  errors: number;
  avgResponseTime: number;
  lastRequestTime: Date;
}