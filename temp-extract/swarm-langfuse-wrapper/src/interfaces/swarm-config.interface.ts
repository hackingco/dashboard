/**
 * Swarm configuration interface
 */

export interface SwarmConfig {
  // Langfuse configuration
  publicKey?: string;
  secretKey?: string;
  host?: string;
  enabled?: boolean;
  flushAt?: number;
  flushInterval?: number;

  // Swarm-specific configuration
  swarmId?: string;
  maxAgents?: number;
  topology?: 'mesh' | 'hierarchical' | 'ring' | 'star';
  coordinationEnabled?: boolean;
  
  // Error handling configuration
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenMaxAttempts?: number;
  };
  
  // Memory and storage
  memoryPath?: string;
  retentionDays?: number;
  
  // Tracing configuration
  tracing?: {
    enabled?: boolean;
    samplingRate?: number;
    maxTraceAge?: number;
    autoCleanup?: boolean;
  };
  
  // Performance options
  performance?: {
    batchSize?: number;
    flushInterval?: number;
    maxConcurrentOperations?: number;
  };
}

export interface SwarmMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  tokenUsage: {
    total: number;
    input: number;
    output: number;
  };
  cost: number;
  efficiency: number;
}

export interface AgentConfig {
  id: string;
  type: string;
  role: string;
  capabilities: string[];
  priority: number;
  maxConcurrentTasks: number;
}