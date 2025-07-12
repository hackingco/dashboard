import Langfuse, { LangfuseTraceClient } from 'langfuse';
import { EventEmitter } from 'events';
import logger from '../logger';
import { performance } from 'perf_hooks';

export interface LLMTrace {
  traceId: string;
  model: string;
  prompt: string;
  response: string;
  tokens: { input: number; output: number; total?: number };
  latency: number;
  cost: number;
  metadata?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface LangfuseSpan {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
  parentId?: string;
  duration?: number;
  status?: 'success' | 'error' | 'pending';
}

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  host?: string;
  flushAt?: number;
  flushInterval?: number;
}

export class LangfuseService extends EventEmitter {
  private client: Langfuse | null = null;
  private traces: Map<string, LLMTrace> = new Map();
  private activeSpans: Map<string, LangfuseSpan> = new Map();
  private activeTraces: Map<string, LangfuseTraceClient> = new Map();
  private performanceMarks: Map<string, number> = new Map();
  private costCalculator: CostCalculator;
  private enabled: boolean = false;
  private publicKey: string;
  private secretKey: string;
  private host: string;

  constructor(config?: LangfuseConfig) {
    super();
    this.publicKey = config?.publicKey || process.env.LANGFUSE_PUBLIC_KEY || '';
    this.secretKey = config?.secretKey || process.env.LANGFUSE_SECRET_KEY || '';
    this.host = config?.host || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';
    this.costCalculator = new CostCalculator();
    
    if (this.publicKey && this.secretKey) {
      this.initialize({
        publicKey: this.publicKey,
        secretKey: this.secretKey,
        host: this.host,
        flushAt: config?.flushAt,
        flushInterval: config?.flushInterval
      });
    } else {
      logger.info('Langfuse service disabled - missing API keys');
    }
  }

  /**
   * Initialize Langfuse client
   */
  initialize(config: LangfuseConfig): void {
    try {
      this.client = new Langfuse({
        publicKey: config.publicKey,
        secretKey: config.secretKey,
        baseUrl: config.host,
        flushAt: config.flushAt || 20,
        flushInterval: config.flushInterval || 10000
      });
      
      this.enabled = true;
      logger.info('Langfuse client initialized');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Langfuse client', { error });
      this.enabled = false;
    }
  }

  /**
   * Start a new trace
   */
  startTrace(name: string, metadata?: Record<string, any>): string {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.client && this.enabled) {
      const trace = this.client.trace({
        id: traceId,
        name,
        metadata
      });
      
      this.activeTraces.set(traceId, trace);
    }
    
    this.performanceMarks.set(traceId, performance.now());
    logger.debug('Started Langfuse trace', { traceId, name });
    
    return traceId;
  }

  /**
   * Start a span within a trace
   */
  startSpan(
    spanId: string, 
    name: string, 
    traceId?: string,
    input?: any, 
    metadata?: Record<string, any>
  ): void {
    const span: LangfuseSpan = {
      id: spanId,
      name,
      startTime: new Date(),
      input,
      metadata,
      parentId: traceId,
      status: 'pending',
    };

    this.performanceMarks.set(spanId, performance.now());
    this.activeSpans.set(spanId, span);
    
    logger.debug('Started Langfuse span', { spanId, name, traceId });
  }

  /**
   * End a span
   */
  endSpan(spanId: string, output?: any, error?: any): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.warn('Attempted to end non-existent span', { spanId });
      return;
    }

    span.endTime = new Date();
    span.output = error || output;
    span.status = error ? 'error' : 'success';

    // Calculate duration
    const startMark = this.performanceMarks.get(spanId);
    if (startMark) {
      span.duration = performance.now() - startMark;
      this.performanceMarks.delete(spanId);
    } else {
      span.duration = span.endTime.getTime() - span.startTime.getTime();
    }

    // Send to Langfuse if we have a parent trace
    if (span.parentId && this.enabled && this.client) {
      const trace = this.activeTraces.get(span.parentId);
      if (trace) {
        trace.span({
          id: spanId,
          name: span.name,
          startTime: span.startTime,
          endTime: span.endTime,
          input: span.input,
          output: span.output,
          metadata: {
            ...span.metadata,
            duration_ms: span.duration,
            status: span.status
          }
        });
      }
    }

    this.activeSpans.delete(spanId);
    this.emit('span:ended', span);
    
    logger.debug('Ended Langfuse span', { spanId, duration: span.duration });
  }

  /**
   * Track LLM generation
   */
  async trackGeneration(
    traceId: string,
    model: string,
    prompt: string,
    response: string,
    tokenUsage: { input: number; output: number },
    latency: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const cost = this.costCalculator.calculate(model, tokenUsage);
    const totalTokens = tokenUsage.input + tokenUsage.output;
    
    const llmTrace: LLMTrace = {
      traceId,
      model,
      prompt,
      response,
      tokens: { ...tokenUsage, total: totalTokens },
      latency,
      cost,
      metadata,
      timestamp: new Date()
    };
    
    this.traces.set(traceId, llmTrace);
    
    if (this.enabled && this.client) {
      const trace = this.activeTraces.get(traceId) || this.client.trace({ id: traceId });
      
      trace.generation({
        name: `${model} generation`,
        model,
        input: prompt,
        output: response,
        usage: {
          promptTokens: tokenUsage.input,
          completionTokens: tokenUsage.output,
          totalTokens
        },
        metadata: {
          ...metadata,
          cost,
          latency_ms: latency
        }
      });
    }
    
    this.emit('generation:tracked', llmTrace);
    
    logger.info(`Tracked generation for trace ${traceId}`, {
      model,
      tokens: tokenUsage,
      cost,
      latency
    });
  }

  /**
   * Track error in LLM operation
   */
  async trackError(
    traceId: string,
    error: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    const llmTrace = this.traces.get(traceId);
    if (llmTrace) {
      llmTrace.error = error.message;
    }
    
    if (this.enabled && this.client) {
      const trace = this.activeTraces.get(traceId);
      if (trace) {
        trace.event({
          name: 'error',
          level: 'ERROR',
          statusMessage: error.message,
          metadata: {
            ...metadata,
            error: {
              message: error.message,
              stack: error.stack
            }
          }
        });
      }
    }
    
    this.emit('error:tracked', { traceId, error });
    logger.error(`Tracked error for trace ${traceId}`, { error });
  }

  /**
   * End a trace
   */
  async endTrace(traceId: string, metadata?: Record<string, any>): Promise<void> {
    const startMark = this.performanceMarks.get(traceId);
    const duration = startMark ? performance.now() - startMark : 0;
    
    if (this.enabled && this.client) {
      const trace = this.activeTraces.get(traceId);
      if (trace) {
        trace.update({
          metadata: {
            ...metadata,
            duration_ms: duration,
            completed_at: new Date().toISOString()
          }
        });
        
        await this.client.flushAsync();
      }
    }
    
    this.activeTraces.delete(traceId);
    this.performanceMarks.delete(traceId);
    
    this.emit('trace:ended', { traceId, duration });
    logger.debug(`Ended trace ${traceId}`, { duration });
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): LLMTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get traces with filters
   */
  getTraces(filters?: {
    model?: string;
    startTime?: Date;
    endTime?: Date;
    minCost?: number;
    maxCost?: number;
  }): LLMTrace[] {
    let traces = Array.from(this.traces.values());
    
    if (filters) {
      if (filters.model) {
        traces = traces.filter(t => t.model === filters.model);
      }
      if (filters.startTime) {
        traces = traces.filter(t => t.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        traces = traces.filter(t => t.timestamp <= filters.endTime!);
      }
      if (filters.minCost !== undefined) {
        traces = traces.filter(t => t.cost >= filters.minCost!);
      }
      if (filters.maxCost !== undefined) {
        traces = traces.filter(t => t.cost <= filters.maxCost!);
      }
    }
    
    return traces;
  }

  /**
   * Get aggregated metrics
   */
  getMetrics(timeRange?: { start: Date; end: Date }): {
    totalTraces: number;
    totalTokens: { input: number; output: number; total: number };
    totalCost: number;
    averageLatency: number;
    errorRate: number;
    modelUsage: Record<string, number>;
  } {
    let traces = Array.from(this.traces.values());
    
    if (timeRange) {
      traces = traces.filter(
        t => t.timestamp >= timeRange.start && t.timestamp <= timeRange.end
      );
    }
    
    const metrics = {
      totalTraces: traces.length,
      totalTokens: { input: 0, output: 0, total: 0 },
      totalCost: 0,
      averageLatency: 0,
      errorRate: 0,
      modelUsage: {} as Record<string, number>
    };
    
    if (traces.length === 0) {
      return metrics;
    }
    
    let totalLatency = 0;
    let errorCount = 0;
    
    for (const trace of traces) {
      metrics.totalTokens.input += trace.tokens.input;
      metrics.totalTokens.output += trace.tokens.output;
      metrics.totalTokens.total += (trace.tokens.total || trace.tokens.input + trace.tokens.output);
      metrics.totalCost += trace.cost;
      totalLatency += trace.latency;
      
      if (trace.error) {
        errorCount++;
      }
      
      metrics.modelUsage[trace.model] = (metrics.modelUsage[trace.model] || 0) + 1;
    }
    
    metrics.averageLatency = totalLatency / traces.length;
    metrics.errorRate = errorCount / traces.length;
    
    return metrics;
  }

  /**
   * Export traces for analysis
   */
  exportTraces(format: 'json' | 'csv' = 'json'): string {
    const traces = Array.from(this.traces.values());
    
    if (format === 'json') {
      return JSON.stringify(traces, null, 2);
    } else {
      // CSV format
      const headers = [
        'traceId',
        'timestamp',
        'model',
        'inputTokens',
        'outputTokens',
        'totalTokens',
        'cost',
        'latency',
        'error'
      ].join(',');
      
      const rows = traces.map(t => [
        t.traceId,
        t.timestamp.toISOString(),
        t.model,
        t.tokens.input,
        t.tokens.output,
        t.tokens.total || (t.tokens.input + t.tokens.output),
        t.cost.toFixed(6),
        t.latency,
        t.error || ''
      ].join(','));
      
      return [headers, ...rows].join('\n');
    }
  }

  /**
   * Clean up old traces
   */
  cleanupTraces(olderThan: Date): number {
    let cleaned = 0;
    
    for (const [id, trace] of this.traces.entries()) {
      if (trace.timestamp < olderThan) {
        this.traces.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old traces`);
    }
    
    return cleaned;
  }

  /**
   * Shutdown and flush
   */
  async shutdown(): Promise<void> {
    if (this.client && this.enabled) {
      await this.client.shutdownAsync();
    }
    
    this.emit('shutdown');
    logger.info('Langfuse service shut down');
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Cost calculator for different models
 */
class CostCalculator {
  private rates: Record<string, { input: number; output: number }> = {
    // OpenAI models (per 1K tokens)
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
    
    // Anthropic models (per 1K tokens)
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-2.1': { input: 0.008, output: 0.024 },
    'claude-2': { input: 0.008, output: 0.024 },
    'claude-instant-1.2': { input: 0.0008, output: 0.0024 },
    
    // Other models
    'llama-2-70b': { input: 0.0007, output: 0.0009 },
    'llama-2-13b': { input: 0.0003, output: 0.0004 },
    'mistral-7b': { input: 0.0002, output: 0.0002 },
    'mixtral-8x7b': { input: 0.0007, output: 0.0007 }
  };

  calculate(model: string, tokens: { input: number; output: number }): number {
    const rate = this.rates[model] || { input: 0, output: 0 };
    return (tokens.input * rate.input + tokens.output * rate.output) / 1000;
  }

  updateRate(model: string, rates: { input: number; output: number }): void {
    this.rates[model] = rates;
  }

  getRate(model: string): { input: number; output: number } | undefined {
    return this.rates[model];
  }

  getAllRates(): Record<string, { input: number; output: number }> {
    return { ...this.rates };
  }
}

// Export singleton instance
export const langfuseService = new LangfuseService();