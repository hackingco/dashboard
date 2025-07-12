import Langfuse from 'langfuse';
import { Logger } from 'winston';
import { createLogger } from '../../utils/logger';

export interface LLMTrace {
  traceId: string;
  model: string;
  prompt: string;
  response: string;
  tokens: { input: number; output: number };
  latency: number;
  cost: number;
  metadata?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  host?: string;
  flushAt?: number;
  flushInterval?: number;
}

export class LangfuseService {
  private logger: Logger;
  private client: Langfuse | null = null;
  private traces: Map<string, LLMTrace> = new Map();
  private costCalculator: CostCalculator;

  constructor(private config?: LangfuseConfig) {
    this.logger = createLogger('langfuse-service');
    this.costCalculator = new CostCalculator();
    
    if (config) {
      this.initialize(config);
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
      
      this.logger.info('Langfuse client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Langfuse client', error);
      throw error;
    }
  }

  /**
   * Start a new trace
   */
  startTrace(metadata?: Record<string, any>): string {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.client) {
      this.client.trace({
        id: traceId,
        metadata
      });
    }
    
    return traceId;
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
    
    const trace: LLMTrace = {
      traceId,
      model,
      prompt,
      response,
      tokens: tokenUsage,
      latency,
      cost,
      metadata,
      timestamp: new Date()
    };
    
    this.traces.set(traceId, trace);
    
    if (this.client) {
      this.client.generation({
        traceId,
        name: `${model} generation`,
        model,
        input: prompt,
        output: response,
        usage: {
          promptTokens: tokenUsage.input,
          completionTokens: tokenUsage.output,
          totalTokens: tokenUsage.input + tokenUsage.output
        },
        metadata: {
          ...metadata,
          cost,
          latency
        }
      });
    }
    
    this.logger.info(`Tracked generation for trace ${traceId}`, {
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
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.error = error.message;
    }
    
    if (this.client) {
      this.client.event({
        traceId,
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
    
    this.logger.error(`Tracked error for trace ${traceId}`, error);
  }

  /**
   * End a trace
   */
  async endTrace(traceId: string, metadata?: Record<string, any>): Promise<void> {
    if (this.client) {
      this.client.score({
        traceId,
        name: 'completion',
        value: 1,
        dataType: 'BOOLEAN'
      });
      
      await this.client.flush();
    }
    
    this.logger.info(`Ended trace ${traceId}`);
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
    totalTokens: { input: number; output: number };
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
      totalTokens: { input: 0, output: 0 },
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
      this.logger.info(`Cleaned up ${cleaned} old traces`);
    }
    
    return cleaned;
  }

  /**
   * Shutdown and flush
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdownAsync();
    }
    
    this.logger.info('Langfuse service shut down');
  }
}

/**
 * Cost calculator for different models
 */
class CostCalculator {
  private rates: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-2.1': { input: 0.008, output: 0.024 },
    'claude-2': { input: 0.008, output: 0.024 }
  };

  calculate(model: string, tokens: { input: number; output: number }): number {
    const rate = this.rates[model] || { input: 0, output: 0 };
    return (tokens.input * rate.input + tokens.output * rate.output) / 1000;
  }

  updateRate(model: string, rates: { input: number; output: number }): void {
    this.rates[model] = rates;
  }
}