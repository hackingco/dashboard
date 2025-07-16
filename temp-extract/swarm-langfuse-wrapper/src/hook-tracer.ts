/**
 * Hook Tracer for Claude Flow
 * Implements comprehensive pre and post hook tracing with parent-child relationships
 */

// Simple UUID fallback without external dependency
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import { performance } from 'perf_hooks';
import { langfuseWrapper, HookContext, TokenUsage } from './index';
import * as winston from 'winston';

// Create a simple logger if the complex path doesn't exist
const logger = winston.createLogger({
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

export interface HookTrace {
  id: string;
  hookType: string;
  hookPhase: 'pre' | 'post' | 'error';
  parentId?: string;
  childIds: string[];
  startTime: number;
  endTime?: number;
  duration?: number;
  input: any;
  output?: any;
  error?: Error;
  metadata: Record<string, any>;
  tokenUsage?: TokenUsage;
  memory?: {
    before: number;
    after: number;
    delta: number;
  };
}

export interface HookMetadata {
  swarmId?: string;
  agentId?: string;
  agentRole?: string;
  taskId?: string;
  sessionId?: string;
  operationId?: string;
  file?: string;
  query?: string;
  message?: string;
  [key: string]: any;
}

export class HookTracer {
  private static instance: HookTracer;
  private traces: Map<string, HookTrace> = new Map();
  private activeTraces: Map<string, HookTrace> = new Map();
  private hookStack: string[] = [];
  private sessionTraces: Map<string, string[]> = new Map();

  private constructor() {}

  static getInstance(): HookTracer {
    if (!HookTracer.instance) {
      HookTracer.instance = new HookTracer();
    }
    return HookTracer.instance;
  }

  /**
   * Start tracing a pre-hook
   */
  async tracePreHook(
    hookType: string,
    input: any,
    metadata: HookMetadata = {}
  ): Promise<string> {
    const traceId = uuidv4();
    const parentId = this.hookStack[this.hookStack.length - 1];

    const trace: HookTrace = {
      id: traceId,
      hookType,
      hookPhase: 'pre',
      parentId,
      childIds: [],
      startTime: performance.now(),
      input,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        depth: this.hookStack.length
      },
      memory: {
        before: process.memoryUsage().heapUsed,
        after: 0,
        delta: 0
      }
    };

    // Link to parent if exists
    if (parentId) {
      const parent = this.activeTraces.get(parentId);
      if (parent) {
        parent.childIds.push(traceId);
      }
    }

    // Store trace
    this.traces.set(traceId, trace);
    this.activeTraces.set(traceId, trace);
    this.hookStack.push(traceId);

    // Link to session if available
    if (metadata.sessionId) {
      if (!this.sessionTraces.has(metadata.sessionId)) {
        this.sessionTraces.set(metadata.sessionId, []);
      }
      this.sessionTraces.get(metadata.sessionId)!.push(traceId);
    }

    // Create Langfuse context
    const context: HookContext = {
      hookType: `${hookType}-pre`,
      swarmId: metadata.swarmId,
      agentId: metadata.agentId,
      agentRole: metadata.agentRole,
      taskId: metadata.taskId,
      operationType: hookType,
      metadata: {
        ...metadata,
        trace_id: traceId,
        parent_id: parentId,
        hook_phase: 'pre'
      }
    };

    // Start Langfuse trace
    const langfuseTraceId = await langfuseWrapper.preHook(context);
    trace.metadata.langfuseTraceId = langfuseTraceId;

    logger.debug(`Started ${hookType} pre-hook trace`, {
      traceId,
      parentId,
      depth: this.hookStack.length
    });

    return traceId;
  }

  /**
   * Complete tracing a post-hook
   */
  async tracePostHook(
    traceId: string,
    output: any,
    tokenUsage?: TokenUsage,
    additionalMetadata?: Record<string, any>
  ): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn(`Post-hook trace not found for ID: ${traceId}`);
      return;
    }

    // Update trace
    trace.hookPhase = 'post';
    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.output = output;
    trace.tokenUsage = tokenUsage;
    trace.metadata = {
      ...trace.metadata,
      ...additionalMetadata,
      completed_at: Date.now()
    };

    // Update memory usage
    trace.memory!.after = process.memoryUsage().heapUsed;
    trace.memory!.delta = trace.memory!.after - trace.memory!.before;

    // Complete Langfuse trace
    if (trace.metadata.langfuseTraceId) {
      await langfuseWrapper.postHook(
        trace.metadata.langfuseTraceId,
        output,
        tokenUsage,
        {
          duration_ms: trace.duration,
          memory_delta_bytes: trace.memory!.delta,
          hook_phase: 'post'
        }
      );
    }

    // Remove from active traces and stack
    this.activeTraces.delete(traceId);
    const stackIndex = this.hookStack.indexOf(traceId);
    if (stackIndex > -1) {
      this.hookStack.splice(stackIndex, 1);
    }

    logger.debug(`Completed ${trace.hookType} post-hook trace`, {
      traceId,
      duration: trace.duration,
      memoryDelta: trace.memory!.delta
    });
  }

  /**
   * Trace an error in a hook
   */
  async traceErrorHook(
    traceId: string,
    error: Error,
    additionalMetadata?: Record<string, any>
  ): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn(`Error hook trace not found for ID: ${traceId}`);
      return;
    }

    // Update trace
    trace.hookPhase = 'error';
    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.error = error;
    trace.metadata = {
      ...trace.metadata,
      ...additionalMetadata,
      error_at: Date.now(),
      error_message: error.message,
      error_stack: error.stack
    };

    // Complete Langfuse trace with error
    if (trace.metadata.langfuseTraceId) {
      await langfuseWrapper.errorHook(
        trace.metadata.langfuseTraceId,
        error,
        {
          duration_ms: trace.duration,
          hook_phase: 'error'
        }
      );
    }

    // Remove from active traces and stack
    this.activeTraces.delete(traceId);
    const stackIndex = this.hookStack.indexOf(traceId);
    if (stackIndex > -1) {
      this.hookStack.splice(stackIndex, 1);
    }

    logger.error(`Error in ${trace.hookType} hook`, {
      traceId,
      duration: trace.duration,
      error: error.message
    });
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): HookTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces for a session
   */
  getSessionTraces(sessionId: string): HookTrace[] {
    const traceIds = this.sessionTraces.get(sessionId) || [];
    return traceIds
      .map(id => this.traces.get(id))
      .filter((trace): trace is HookTrace => trace !== undefined);
  }

  /**
   * Get hook hierarchy for a trace
   */
  getTraceHierarchy(traceId: string): HookTrace[] {
    const trace = this.traces.get(traceId);
    if (!trace) return [];

    const hierarchy: HookTrace[] = [trace];

    // Add parent traces
    let currentTrace = trace;
    while (currentTrace.parentId) {
      const parent = this.traces.get(currentTrace.parentId);
      if (!parent) break;
      hierarchy.unshift(parent);
      currentTrace = parent;
    }

    // Add child traces recursively
    const addChildren = (parentTrace: HookTrace) => {
      for (const childId of parentTrace.childIds) {
        const child = this.traces.get(childId);
        if (child) {
          hierarchy.push(child);
          addChildren(child);
        }
      }
    };

    addChildren(trace);

    return hierarchy;
  }

  /**
   * Get performance metrics for hooks
   */
  getHookMetrics(hookType?: string): Record<string, any> {
    const allTraces = Array.from(this.traces.values());
    const filteredTraces = hookType
      ? allTraces.filter(t => t.hookType === hookType)
      : allTraces;

    const completedTraces = filteredTraces.filter(t => t.duration !== undefined);

    if (completedTraces.length === 0) {
      return { count: 0, avgDuration: 0, minDuration: 0, maxDuration: 0 };
    }

    const durations = completedTraces.map(t => t.duration!);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: completedTraces.length,
      avgDuration: totalDuration / completedTraces.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration,
      errorCount: filteredTraces.filter(t => t.error).length,
      activeCount: Array.from(this.activeTraces.values()).filter(
        t => !hookType || t.hookType === hookType
      ).length
    };
  }

  /**
   * Clear old traces to prevent memory leaks
   */
  clearOldTraces(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, trace] of this.traces) {
      const age = now - trace.metadata.timestamp;
      if (age > maxAgeMs && !this.activeTraces.has(id)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.traces.delete(id);
    }

    logger.info(`Cleared ${toDelete.length} old traces`);
  }

  /**
   * Export traces for analysis
   */
  exportTraces(sessionId?: string): any {
    const traces = sessionId
      ? this.getSessionTraces(sessionId)
      : Array.from(this.traces.values());

    return {
      exportedAt: new Date().toISOString(),
      sessionId,
      traceCount: traces.length,
      metrics: this.getHookMetrics(),
      traces: traces.map(t => ({
        ...t,
        hierarchyDepth: this.getTraceHierarchy(t.id).length
      }))
    };
  }
}

// Export singleton instance
export const hookTracer = HookTracer.getInstance();

/**
 * Decorator to automatically trace hooks
 */
export function TraceHook(hookType: string) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const metadata: HookMetadata = {};
      
      // Extract metadata from first argument if it's an object
      if (args[0] && typeof args[0] === 'object') {
        const firstArg = args[0];
        metadata.swarmId = firstArg.swarmId || firstArg.swarm_id;
        metadata.agentId = firstArg.agentId || firstArg.agent_id;
        metadata.agentRole = firstArg.agentRole || firstArg.agent_role;
        metadata.taskId = firstArg.taskId || firstArg.task_id;
        metadata.sessionId = firstArg.sessionId || firstArg.session_id;
      }

      const traceId = await hookTracer.tracePreHook(hookType, args, metadata);

      try {
        const result = await originalMethod.apply(this, args);
        await hookTracer.tracePostHook(traceId, result);
        return result;
      } catch (error) {
        await hookTracer.traceErrorHook(traceId, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}