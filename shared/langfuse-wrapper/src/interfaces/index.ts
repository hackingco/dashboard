/**
 * Central export for all interfaces used across the Langfuse wrapper
 */

// Main wrapper interfaces
export * from './langfuse-wrapper.interface';

// Hook tracing interfaces
export * from './hook-tracer.interface';

// Swarm tracing interfaces
export * from './swarm-tracer.interface';

// Memory and performance interfaces
export * from './memory-tracer.interface';
export * from './performance-tracer.interface';

// Additional type definitions for comprehensive tracing
export interface TraceMetadata {
  traceId: string;
  spanId: string;
  parentId?: string;
  swarmId?: string;
  agentId?: string;
  taskId?: string;
  timestamp: number;
  duration?: number;
  tags: Record<string, string>;
  baggage: Record<string, any>;
}

export interface SwarmContext {
  swarmId: string;
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star';
  maxAgents: number;
  activeAgents: string[];
  coordinationData: Record<string, any>;
}

export interface HookExecutionContext {
  hookType: string;
  phase: 'pre' | 'post' | 'error';
  parentTrace?: string;
  metadata: Record<string, any>;
  swarmContext?: SwarmContext;
}

export interface TracingConfig {
  enabled: boolean;
  langfuseConfig?: {
    publicKey?: string;
    secretKey?: string;
    host?: string;
  };
  samplingRate: number;
  maxTraceAge: number;
  autoCleanup: boolean;
}