/**
 * TraceContext - Manages distributed trace context across swarm agents
 * Provides context propagation and correlation for distributed tracing
 */

import { EventEmitter } from 'events';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  swarmId: string;
  agentId: string;
  agentRole: string;
  taskId?: string;
  correlationId: string;
  baggage: Record<string, string>;
  flags: number;
  startTime: number;
}

export interface PropagationHeaders {
  'x-trace-id': string;
  'x-span-id': string;
  'x-parent-span-id'?: string;
  'x-swarm-id': string;
  'x-agent-id': string;
  'x-correlation-id': string;
  'x-baggage'?: string;
}

export class TraceContextManager extends EventEmitter {
  private activeContexts: Map<string, TraceContext> = new Map();
  private contextStack: Map<string, TraceContext[]> = new Map(); // For nested operations
  private correlationMap: Map<string, Set<string>> = new Map(); // correlationId -> Set<traceId>

  /**
   * Create a new trace context
   */
  createContext(
    swarmId: string,
    agentId: string,
    agentRole: string,
    parentContext?: TraceContext
  ): TraceContext {
    const traceId = parentContext?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const correlationId = parentContext?.correlationId || this.generateCorrelationId();

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId: parentContext?.spanId,
      swarmId,
      agentId,
      agentRole,
      correlationId,
      baggage: { ...parentContext?.baggage },
      flags: parentContext?.flags || 0,
      startTime: Date.now()
    };

    // Store context
    this.activeContexts.set(this.getContextKey(agentId, spanId), context);
    
    // Update correlation map
    if (!this.correlationMap.has(correlationId)) {
      this.correlationMap.set(correlationId, new Set());
    }
    this.correlationMap.get(correlationId)!.add(traceId);

    // Manage context stack for nested operations
    const stackKey = this.getStackKey(agentId);
    if (!this.contextStack.has(stackKey)) {
      this.contextStack.set(stackKey, []);
    }
    this.contextStack.get(stackKey)!.push(context);

    this.emit('context_created', context);
    return context;
  }

  /**
   * Get current context for an agent
   */
  getCurrentContext(agentId: string): TraceContext | null {
    const stackKey = this.getStackKey(agentId);
    const stack = this.contextStack.get(stackKey);
    
    if (!stack || stack.length === 0) {
      return null;
    }
    
    return stack[stack.length - 1];
  }

  /**
   * Set baggage item in current context
   */
  setBaggage(agentId: string, key: string, value: string): void {
    const context = this.getCurrentContext(agentId);
    if (context) {
      context.baggage[key] = value;
      this.emit('baggage_updated', { agentId, key, value });
    }
  }

  /**
   * Get baggage item from current context
   */
  getBaggage(agentId: string, key: string): string | undefined {
    const context = this.getCurrentContext(agentId);
    return context?.baggage[key];
  }

  /**
   * Extract context from propagation headers
   */
  extract(headers: Record<string, string>): Partial<TraceContext> | null {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const swarmId = headers['x-swarm-id'];
    const agentId = headers['x-agent-id'];
    
    if (!traceId || !spanId) {
      return null;
    }

    const baggage = headers['x-baggage'] 
      ? this.parseBaggage(headers['x-baggage'])
      : {};

    return {
      traceId,
      spanId,
      parentSpanId: headers['x-parent-span-id'],
      swarmId,
      agentId,
      correlationId: headers['x-correlation-id'] || this.generateCorrelationId(),
      baggage,
      flags: parseInt(headers['x-trace-flags'] || '0', 10)
    };
  }

  /**
   * Inject context into propagation headers
   */
  inject(context: TraceContext): PropagationHeaders {
    const headers: PropagationHeaders = {
      'x-trace-id': context.traceId,
      'x-span-id': context.spanId,
      'x-swarm-id': context.swarmId,
      'x-agent-id': context.agentId,
      'x-correlation-id': context.correlationId
    };

    if (context.parentSpanId) {
      headers['x-parent-span-id'] = context.parentSpanId;
    }

    if (Object.keys(context.baggage).length > 0) {
      headers['x-baggage'] = this.serializeBaggage(context.baggage);
    }

    return headers;
  }

  /**
   * Start a new span within current trace
   */
  startSpan(
    agentId: string,
    operationName: string,
    taskId?: string
  ): TraceContext | null {
    const parentContext = this.getCurrentContext(agentId);
    if (!parentContext) {
      return null;
    }

    const spanContext: TraceContext = {
      ...parentContext,
      spanId: this.generateSpanId(),
      parentSpanId: parentContext.spanId,
      taskId,
      startTime: Date.now()
    };

    // Store the new span context
    this.activeContexts.set(this.getContextKey(agentId, spanContext.spanId), spanContext);
    
    // Push to stack
    const stackKey = this.getStackKey(agentId);
    this.contextStack.get(stackKey)!.push(spanContext);

    this.emit('span_started', { agentId, operationName, context: spanContext });
    return spanContext;
  }

  /**
   * End current span
   */
  endSpan(agentId: string): void {
    const stackKey = this.getStackKey(agentId);
    const stack = this.contextStack.get(stackKey);
    
    if (!stack || stack.length === 0) {
      return;
    }

    const context = stack.pop()!;
    const duration = Date.now() - context.startTime;
    
    // Remove from active contexts
    this.activeContexts.delete(this.getContextKey(agentId, context.spanId));
    
    this.emit('span_ended', { agentId, context, duration });

    // Store span data in SQLite for cross-agent access
    this.storeSpanData(context, duration);
  }

  /**
   * Get all contexts for a correlation ID
   */
  getCorrelatedContexts(correlationId: string): TraceContext[] {
    const traceIds = this.correlationMap.get(correlationId);
    if (!traceIds) {
      return [];
    }

    const contexts: TraceContext[] = [];
    for (const [_, context] of this.activeContexts) {
      if (traceIds.has(context.traceId)) {
        contexts.push(context);
      }
    }

    return contexts;
  }

  /**
   * Fork context for parallel operations
   */
  forkContext(agentId: string, newAgentId: string, newAgentRole: string): TraceContext | null {
    const currentContext = this.getCurrentContext(agentId);
    if (!currentContext) {
      return null;
    }

    return this.createContext(
      currentContext.swarmId,
      newAgentId,
      newAgentRole,
      currentContext
    );
  }

  /**
   * Merge parallel contexts
   */
  mergeContexts(contexts: TraceContext[]): TraceContext | null {
    if (contexts.length === 0) {
      return null;
    }

    // Use the first context as base
    const baseContext = contexts[0];
    const mergedBaggage = { ...baseContext.baggage };

    // Merge baggage from all contexts
    for (const context of contexts.slice(1)) {
      Object.assign(mergedBaggage, context.baggage);
    }

    const mergedContext: TraceContext = {
      ...baseContext,
      spanId: this.generateSpanId(),
      parentSpanId: baseContext.spanId,
      baggage: mergedBaggage,
      startTime: Date.now()
    };

    // Store merged context
    this.activeContexts.set(
      this.getContextKey(baseContext.agentId, mergedContext.spanId),
      mergedContext
    );

    return mergedContext;
  }

  /**
   * Store span data in SQLite
   */
  private async storeSpanData(context: TraceContext, duration: number): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      const memoryKey = `trace/span/${context.swarmId}/${context.spanId}`;
      const spanData = {
        ...context,
        duration,
        endTime: Date.now()
      };
      
      const query = `sqlite3 .swarm/memory.db "INSERT INTO memory_entries (key, value, namespace, metadata) VALUES ('${memoryKey}', '${JSON.stringify(spanData).replace(/'/g, "''")}', 'trace_spans', '${JSON.stringify({ swarmId: context.swarmId, agentId: context.agentId })}')"`;
      execSync(query);
    } catch (error) {
      console.warn('Failed to store span data:', error);
    }
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get context storage key
   */
  private getContextKey(agentId: string, spanId: string): string {
    return `${agentId}:${spanId}`;
  }

  /**
   * Get stack storage key
   */
  private getStackKey(agentId: string): string {
    return `stack:${agentId}`;
  }

  /**
   * Parse baggage string
   */
  private parseBaggage(baggageStr: string): Record<string, string> {
    const baggage: Record<string, string> = {};
    const pairs = baggageStr.split(',');
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        baggage[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }
    
    return baggage;
  }

  /**
   * Serialize baggage to string
   */
  private serializeBaggage(baggage: Record<string, string>): string {
    return Object.entries(baggage)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join(',');
  }

  /**
   * Clear all contexts for an agent
   */
  clearAgentContexts(agentId: string): void {
    // Clear from stack
    const stackKey = this.getStackKey(agentId);
    this.contextStack.delete(stackKey);

    // Clear from active contexts
    const keysToDelete: string[] = [];
    for (const [key, context] of this.activeContexts) {
      if (context.agentId === agentId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.activeContexts.delete(key);
    }

    this.emit('agent_contexts_cleared', { agentId });
  }

  /**
   * Get trace timeline for a swarm
   */
  async getTraceTimeline(swarmId: string): Promise<any[]> {
    try {
      const { execSync } = require('child_process');
      
      const query = `sqlite3 .swarm/memory.db "SELECT value FROM memory_entries WHERE namespace = 'trace_spans' AND key LIKE '%${swarmId}%' ORDER BY key"`;
      const result = execSync(query, { encoding: 'utf8' }).trim();
      
      if (!result) return [];
      
      const spans = result.split('\n').map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);

      // Sort by start time
      return spans.sort((a, b) => a.startTime - b.startTime);
    } catch (error) {
      console.warn('Failed to get trace timeline:', error);
      return [];
    }
  }

  /**
   * Get context statistics
   */
  getStats(): {
    activeContexts: number;
    activeAgents: number;
    correlations: number;
    totalSpans: number;
  } {
    const activeAgents = new Set(
      Array.from(this.activeContexts.values()).map(ctx => ctx.agentId)
    ).size;

    return {
      activeContexts: this.activeContexts.size,
      activeAgents,
      correlations: this.correlationMap.size,
      totalSpans: Array.from(this.contextStack.values())
        .reduce((sum, stack) => sum + stack.length, 0)
    };
  }
}

// Export singleton instance
export const traceContextManager = new TraceContextManager();