/**
 * Memory Tracer Interface
 * Defines the contract for tracing memory operations in the swarm
 */

export interface MemoryOperation {
  operationType: 'store' | 'retrieve' | 'search' | 'delete' | 'list';
  key?: string;
  namespace: string;
  swarmId?: string;
  agentId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface MemoryAccessPattern {
  agentId: string;
  accessCount: number;
  readCount: number;
  writeCount: number;
  namespaces: string[];
  avgAccessTime: number;
  hotKeys: string[];
  timestamp: Date;
}

export interface MemoryCoordinationEvent {
  eventType: 'sync' | 'conflict' | 'merge' | 'broadcast';
  sourceAgentId: string;
  targetAgentIds: string[];
  affectedKeys: string[];
  resolution?: 'overwrite' | 'merge' | 'ignore';
  timestamp: Date;
}

export interface MemoryMetrics {
  totalEntries: number;
  totalSize: number;
  namespaceDistribution: Record<string, number>;
  agentDistribution: Record<string, number>;
  avgAccessTime: number;
  cacheHitRate: number;
  coordinationEvents: number;
  timestamp: Date;
}

export interface MemoryTracer {
  /**
   * Trace a memory operation
   */
  traceMemoryOperation(operation: MemoryOperation): Promise<string>;
  
  /**
   * Record memory access patterns
   */
  recordAccessPattern(pattern: MemoryAccessPattern): Promise<void>;
  
  /**
   * Record coordination events between agents
   */
  recordCoordinationEvent(event: MemoryCoordinationEvent): Promise<void>;
  
  /**
   * Update memory metrics
   */
  updateMemoryMetrics(metrics: MemoryMetrics): Promise<void>;
  
  /**
   * Analyze memory usage patterns
   */
  analyzeMemoryPatterns(
    swarmId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    hotspots: Array<{ key: string; accessCount: number }>;
    contentionPoints: Array<{ key: string; agents: string[] }>;
    inefficiencies: Array<{ pattern: string; suggestion: string }>;
  }>;
  
  /**
   * Get memory lineage (track data flow between agents)
   */
  getMemoryLineage(
    key: string,
    namespace: string
  ): Promise<Array<{
    agentId: string;
    operation: 'read' | 'write';
    timestamp: Date;
    value?: any;
  }>>;
  
  /**
   * Monitor cross-agent memory coordination
   */
  monitorCoordination(
    swarmId: string,
    callback: (event: MemoryCoordinationEvent) => void
  ): () => void; // Returns unsubscribe function
}