/**
 * Optimized Hook Tracer for Claude Flow
 * High-performance implementation with async processing, memory management, and batch operations
 * Designed for 8+ agent swarm coordination with minimal latency overhead
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { langfuseWrapper, HookContext, TokenUsage } from './index';
import * as winston from 'winston';

// Optimized UUID generation using crypto
function fastUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// LRU Cache for memory management
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Batch processor for async operations
class BatchProcessor<T, R> extends EventEmitter {
  private queue: T[] = [];
  private processing = false;
  private batchSize: number;
  private flushInterval: number;
  private processor: (items: T[]) => Promise<R[]>;
  private timer?: NodeJS.Timeout;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    batchSize: number = 25,
    flushInterval: number = 500
  ) {
    super();
    this.processor = processor;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startTimer();
  }

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const queueItem = { item, resolve, reject };
      this.queue.push(queueItem as any);

      if (this.queue.length >= this.batchSize) {
        this.flush();
      }
    });
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      const items = batch.map((b: any) => b.item);
      const results = await this.processor(items);

      batch.forEach((b: any, index: number) => {
        b.resolve(results[index] || results[0]);
      });
    } catch (error) {
      batch.forEach((b: any) => b.reject(error));
    } finally {
      this.processing = false;
    }
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.flush();
  }
}

// Optimized hook trace interface
export interface OptimizedHookTrace {
  id: string;
  hookType: string;
  hookPhase: 'pre' | 'post' | 'error';
  parentId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  input: any;
  output?: any;
  error?: Error;
  metadata: Record<string, any>;
  tokenUsage?: TokenUsage;
  memoryDelta?: number;
}

export interface HookMetadata {
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  taskId?: string;
  sessionId?: string;
  operationId?: string;
  priority?: number;
  [key: string]: any;
}

// Performance metrics interface
export interface HookPerformanceMetrics {
  totalHooks: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cacheHitRate: number;
}

/**
 * Optimized Hook Tracer with high-performance features
 */
export class OptimizedHookTracer extends EventEmitter {
  private static instance: OptimizedHookTracer;
  
  // Optimized storage
  private traces: LRUCache<string, OptimizedHookTrace>;
  private activeTraces: Map<string, OptimizedHookTrace> = new Map();
  private parentIndex: Map<string, Set<string>> = new Map(); // Parent -> Children
  private sessionIndex: Map<string, Set<string>> = new Map(); // Session -> Traces
  
  // Performance optimization
  private batchProcessor: BatchProcessor<OptimizedHookTrace, any>;
  private hookStack: string[] = [];
  private performanceMetrics: HookPerformanceMetrics;
  private metricsBuffer: number[] = [];
  
  // Configuration
  private readonly maxTraces: number = 10000;
  private readonly maxStackDepth: number = 50;
  private readonly cleanupInterval: number = 30000; // 30 seconds
  
  private logger: winston.Logger;
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    super();
    
    this.traces = new LRUCache<string, OptimizedHookTrace>(this.maxTraces);
    this.performanceMetrics = {
      totalHooks: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      errorRate: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Initialize batch processor
    this.batchProcessor = new BatchProcessor(
      this.processBatchedTraces.bind(this),
      25, // Batch size
      500 // Flush interval
    );

    this.startPerformanceMonitoring();
    this.startCleanupTimer();
  }

  static getInstance(): OptimizedHookTracer {
    if (!OptimizedHookTracer.instance) {
      OptimizedHookTracer.instance = new OptimizedHookTracer();
    }
    return OptimizedHookTracer.instance;
  }

  /**
   * High-performance pre-hook tracing with minimal latency
   */
  async tracePreHook(
    hookType: string,
    input: any,
    metadata: HookMetadata = {}
  ): Promise<string> {
    const startTime = performance.now();
    const traceId = fastUuid();
    const parentId = this.getLastParentId();

    // Create trace synchronously for immediate return
    const trace: OptimizedHookTrace = {
      id: traceId,
      hookType,
      hookPhase: 'pre',
      parentId,
      startTime,
      input,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        depth: this.hookStack.length,
        priority: metadata.priority || 5
      }
    };

    // Update indexes efficiently
    this.updateIndexes(traceId, parentId, metadata.sessionId);
    
    // Store trace
    this.traces.set(traceId, trace);
    this.activeTraces.set(traceId, trace);
    this.pushToStack(traceId);

    // Async processing without blocking
    setImmediate(() => {
      this.batchProcessor.add(trace).catch(error => {
        this.logger.error('Failed to process trace batch', error);
      });
    });

    const latency = performance.now() - startTime;
    this.recordLatency(latency);

    return traceId;
  }

  /**
   * High-performance post-hook completion
   */
  async tracePostHook(
    traceId: string,
    output: any,
    tokenUsage?: TokenUsage,
    additionalMetadata?: Record<string, any>
  ): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      this.logger.warn(`Post-hook trace not found: ${traceId}`);
      return;
    }

    const endTime = performance.now();
    
    // Update trace efficiently
    trace.hookPhase = 'post';
    trace.endTime = endTime;
    trace.duration = endTime - trace.startTime;
    trace.output = output;
    trace.tokenUsage = tokenUsage;
    
    if (additionalMetadata) {
      Object.assign(trace.metadata, additionalMetadata);
    }

    // Calculate memory delta efficiently
    const currentMemory = process.memoryUsage().heapUsed;
    trace.memoryDelta = currentMemory - (trace.metadata.startMemory || currentMemory);

    // Remove from active traces and stack
    this.activeTraces.delete(traceId);
    this.removeFromStack(traceId);

    // Update performance metrics
    this.updatePerformanceMetrics(trace);

    // Async processing
    setImmediate(() => {
      this.batchProcessor.add(trace);
    });
  }

  /**
   * Error handling with minimal overhead
   */
  async traceErrorHook(
    traceId: string,
    error: Error,
    additionalMetadata?: Record<string, any>
  ): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      this.logger.warn(`Error hook trace not found: ${traceId}`);
      return;
    }

    trace.hookPhase = 'error';
    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.error = error;

    if (additionalMetadata) {
      Object.assign(trace.metadata, additionalMetadata);
    }

    this.activeTraces.delete(traceId);
    this.removeFromStack(traceId);

    this.logger.error(`Hook error in ${trace.hookType}`, {
      traceId,
      duration: trace.duration,
      error: error.message
    });
  }

  /**
   * Get trace with O(1) lookup
   */
  getTrace(traceId: string): OptimizedHookTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get session traces efficiently
   */
  getSessionTraces(sessionId: string): OptimizedHookTrace[] {
    const traceIds = this.sessionIndex.get(sessionId);
    if (!traceIds) return [];

    return Array.from(traceIds)
      .map(id => this.traces.get(id))
      .filter((trace): trace is OptimizedHookTrace => trace !== undefined);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): HookPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Efficient trace hierarchy calculation
   */
  getTraceHierarchy(traceId: string): OptimizedHookTrace[] {
    const trace = this.traces.get(traceId);
    if (!trace) return [];

    const hierarchy: OptimizedHookTrace[] = [];
    const visited = new Set<string>();

    // Build hierarchy efficiently
    this.buildHierarchy(trace, hierarchy, visited);
    
    return hierarchy;
  }

  /**
   * Memory-efficient export
   */
  exportTraces(sessionId?: string, limit: number = 1000): any {
    const traces = sessionId
      ? this.getSessionTraces(sessionId).slice(0, limit)
      : Array.from(this.traces.cache.values()).slice(0, limit);

    return {
      exportedAt: new Date().toISOString(),
      sessionId,
      traceCount: traces.length,
      metrics: this.performanceMetrics,
      traces: traces.map(t => ({
        ...t,
        hierarchyDepth: this.calculateDepth(t.id)
      }))
    };
  }

  // Private helper methods

  private getLastParentId(): string | undefined {
    return this.hookStack.length > 0 
      ? this.hookStack[this.hookStack.length - 1] 
      : undefined;
  }

  private updateIndexes(traceId: string, parentId?: string, sessionId?: string): void {
    // Update parent-child relationship
    if (parentId) {
      if (!this.parentIndex.has(parentId)) {
        this.parentIndex.set(parentId, new Set());
      }
      this.parentIndex.get(parentId)!.add(traceId);
    }

    // Update session index
    if (sessionId) {
      if (!this.sessionIndex.has(sessionId)) {
        this.sessionIndex.set(sessionId, new Set());
      }
      this.sessionIndex.get(sessionId)!.add(traceId);
    }
  }

  private pushToStack(traceId: string): void {
    this.hookStack.push(traceId);
    if (this.hookStack.length > this.maxStackDepth) {
      this.hookStack.shift(); // Remove oldest
    }
  }

  private removeFromStack(traceId: string): void {
    const index = this.hookStack.indexOf(traceId);
    if (index > -1) {
      this.hookStack.splice(index, 1);
    }
  }

  private recordLatency(latency: number): void {
    this.metricsBuffer.push(latency);
    if (this.metricsBuffer.length > 1000) {
      this.metricsBuffer.shift();
    }
  }

  private updatePerformanceMetrics(trace: OptimizedHookTrace): void {
    this.performanceMetrics.totalHooks++;
    
    if (trace.duration) {
      const totalLatency = this.performanceMetrics.avgLatency * (this.performanceMetrics.totalHooks - 1) + trace.duration;
      this.performanceMetrics.avgLatency = totalLatency / this.performanceMetrics.totalHooks;
    }

    if (trace.error) {
      this.performanceMetrics.errorRate = 
        (this.performanceMetrics.errorRate * (this.performanceMetrics.totalHooks - 1) + 1) / 
        this.performanceMetrics.totalHooks;
    }

    // Update percentiles periodically
    if (this.performanceMetrics.totalHooks % 100 === 0) {
      this.calculatePercentiles();
    }
  }

  private calculatePercentiles(): void {
    if (this.metricsBuffer.length === 0) return;

    const sorted = [...this.metricsBuffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    this.performanceMetrics.p95Latency = sorted[p95Index] || 0;
    this.performanceMetrics.p99Latency = sorted[p99Index] || 0;
  }

  private buildHierarchy(
    trace: OptimizedHookTrace, 
    hierarchy: OptimizedHookTrace[], 
    visited: Set<string>
  ): void {
    if (visited.has(trace.id)) return;
    
    visited.add(trace.id);
    hierarchy.push(trace);

    // Add children
    const children = this.parentIndex.get(trace.id);
    if (children) {
      for (const childId of children) {
        const child = this.traces.get(childId);
        if (child) {
          this.buildHierarchy(child, hierarchy, visited);
        }
      }
    }
  }

  private calculateDepth(traceId: string): number {
    let depth = 0;
    let currentTrace = this.traces.get(traceId);
    
    while (currentTrace?.parentId) {
      depth++;
      currentTrace = this.traces.get(currentTrace.parentId);
      if (depth > 100) break; // Prevent infinite loops
    }
    
    return depth;
  }

  private async processBatchedTraces(traces: OptimizedHookTrace[]): Promise<any[]> {
    // Batch process traces for Langfuse or other external systems
    const contexts: HookContext[] = traces.map(trace => ({
      hookType: `${trace.hookType}-${trace.hookPhase}`,
      swarmId: trace.metadata.swarmId,
      agentId: trace.metadata.agentId,
      agentRole: trace.metadata.agentRole,
      taskId: trace.metadata.taskId,
      operationType: trace.hookType,
      metadata: {
        ...trace.metadata,
        trace_id: trace.id,
        parent_id: trace.parentId,
        hook_phase: trace.hookPhase
      }
    }));

    try {
      // Process in smaller batches for external services
      const batchSize = 10;
      const results = [];
      
      for (let i = 0; i < contexts.length; i += batchSize) {
        const batch = contexts.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(context => langfuseWrapper.preHook(context))
        );
        results.push(...batchResults);
      }

      return results;
    } catch (error) {
      this.logger.error('Batch processing failed', error);
      return traces.map(() => null);
    }
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.performanceMetrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
      
      // Calculate throughput (hooks per second)
      const timeWindow = 60; // 1 minute
      this.performanceMetrics.throughput = this.performanceMetrics.totalHooks / timeWindow;
      
      this.emit('performance:update', this.performanceMetrics);
    }, 10000); // Every 10 seconds
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
  }

  private performCleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    let cleaned = 0;

    // Clean expired traces from indexes
    for (const [sessionId, traceIds] of this.sessionIndex) {
      const validTraces = new Set<string>();
      
      for (const traceId of traceIds) {
        const trace = this.traces.get(traceId);
        if (trace && (now - trace.metadata.timestamp) < maxAge) {
          validTraces.add(traceId);
        } else {
          cleaned++;
        }
      }
      
      if (validTraces.size === 0) {
        this.sessionIndex.delete(sessionId);
      } else {
        this.sessionIndex.set(sessionId, validTraces);
      }
    }

    // Clean parent index
    for (const [parentId, childIds] of this.parentIndex) {
      const validChildren = new Set<string>();
      
      for (const childId of childIds) {
        if (this.traces.get(childId)) {
          validChildren.add(childId);
        }
      }
      
      if (validChildren.size === 0) {
        this.parentIndex.delete(parentId);
      } else {
        this.parentIndex.set(parentId, validChildren);
      }
    }

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} expired traces`);
    }
  }

  /**
   * Shutdown and cleanup
   */
  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.batchProcessor.close();
    this.traces.clear();
    this.activeTraces.clear();
    this.parentIndex.clear();
    this.sessionIndex.clear();
    this.hookStack.length = 0;
    
    this.emit('tracer:closed');
  }
}

// Export singleton instance
export const optimizedHookTracer = OptimizedHookTracer.getInstance();

/**
 * High-performance decorator for automatic hook tracing
 */
export function OptimizedTraceHook(hookType: string, priority: number = 5) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const metadata: HookMetadata = { priority };
      
      // Extract metadata from arguments efficiently
      if (args[0] && typeof args[0] === 'object') {
        const firstArg = args[0];
        Object.assign(metadata, {
          swarmId: firstArg.swarmId || firstArg.swarm_id,
          agentId: firstArg.agentId || firstArg.agent_id,
          agentRole: firstArg.agentRole || firstArg.agent_role,
          taskId: firstArg.taskId || firstArg.task_id,
          sessionId: firstArg.sessionId || firstArg.session_id
        });
      }

      const traceId = await optimizedHookTracer.tracePreHook(hookType, args, metadata);

      try {
        const result = await originalMethod.apply(this, args);
        await optimizedHookTracer.tracePostHook(traceId, result);
        return result;
      } catch (error) {
        await optimizedHookTracer.traceErrorHook(traceId, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}