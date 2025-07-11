import logger from './logger';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface LangfuseSpan {
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

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface TrustGraphNode {
  id: string;
  type: string;
  label: string;
  metadata?: Record<string, any>;
}

interface TrustGraphEdge {
  source: string;
  target: string;
  label: string;
  metadata?: Record<string, any>;
}

export class TelemetryService extends EventEmitter {
  private langfuseEnabled: boolean;
  private trustGraphEnabled: boolean;
  private langfuseApiKey: string;
  private trustGraphApiKey: string;
  private activeSpans: Map<string, LangfuseSpan> = new Map();

  private langfuseHost: string;
  private langfusePublicKey: string;
  private trustGraphHost: string;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private spanQueue: LangfuseSpan[] = [];
  private nodeQueue: TrustGraphNode[] = [];
  private edgeQueue: TrustGraphEdge[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private performanceMarks: Map<string, number> = new Map();

  constructor() {
    super();
    this.langfuseApiKey = process.env.LANGFUSE_SECRET_KEY || '';
    this.langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY || '';
    this.langfuseHost = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';
    this.trustGraphApiKey = process.env.TRUSTGRAPH_API_KEY || '';
    this.trustGraphHost = process.env.TRUSTGRAPH_API_URL || 'https://api.trustgraph.ai';
    this.langfuseEnabled = !!this.langfuseApiKey;
    this.trustGraphEnabled = !!this.trustGraphApiKey;

    if (!this.langfuseEnabled) {
      logger.info('Langfuse telemetry disabled - LANGFUSE_SECRET_KEY not set');
    }
    if (!this.trustGraphEnabled) {
      logger.info('TrustGraph telemetry disabled - TRUSTGRAPH_API_KEY not set');
    }

    // Start flush interval for batched operations
    if (this.langfuseEnabled || this.trustGraphEnabled) {
      this.startFlushInterval();
    }
  }

  // Langfuse Methods
  startSpan(spanId: string, name: string, input?: any, metadata?: Record<string, any>, parentId?: string): void {
    if (!this.langfuseEnabled) return;

    const span: LangfuseSpan = {
      id: spanId,
      name,
      startTime: new Date(),
      input,
      metadata,
      parentId,
      status: 'pending',
    };

    // Mark performance start
    this.performanceMarks.set(spanId, performance.now());

    this.activeSpans.set(spanId, span);
    logger.debug('Started Langfuse span', { spanId, name });
  }

  endSpan(spanId: string, output?: any, error?: any): void {
    if (!this.langfuseEnabled) return;

    const span = this.activeSpans.get(spanId);
    if (!span) {
      logger.warn('Attempted to end non-existent span', { spanId });
      return;
    }

    span.endTime = new Date();
    span.output = error || output;
    span.status = error ? 'error' : 'success';

    // Calculate duration using performance marks
    const startMark = this.performanceMarks.get(spanId);
    if (startMark) {
      span.duration = performance.now() - startMark;
      this.performanceMarks.delete(spanId);
    } else {
      span.duration = span.endTime.getTime() - span.startTime.getTime();
    }

    // Queue span for batch sending
    this.spanQueue.push(span);
    
    // Emit performance metric
    this.recordMetric('span.duration', span.duration, 'ms', {
      span: span.name,
      status: span.status,
    });
    this.activeSpans.delete(spanId);
    logger.debug('Ended Langfuse span', { spanId, duration: span.endTime.getTime() - span.startTime.getTime() });
  }

  private async flushSpans(): Promise<void> {
    if (this.spanQueue.length === 0) return;

    const spans = [...this.spanQueue];
    this.spanQueue = [];

    try {
      const response = await fetch(`${this.langfuseHost}/api/public/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Langfuse-Public-Key': this.langfusePublicKey,
          'X-Langfuse-Secret-Key': this.langfuseApiKey,
        },
        body: JSON.stringify({
          batch: spans.map(span => ({
            id: span.id,
            traceId: span.parentId || span.id,
            type: 'span',
            name: span.name,
            startTime: span.startTime.toISOString(),
            endTime: span.endTime?.toISOString(),
            input: span.input,
            output: span.output,
            metadata: span.metadata,
            statusMessage: span.status,
            parentObservationId: span.parentId,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Langfuse API error: ${response.status} - ${error}`);
      }

      logger.debug(`Flushed ${spans.length} spans to Langfuse`);
    } catch (error) {
      logger.error('Failed to flush spans to Langfuse', { error });
      // Re-queue failed spans
      this.spanQueue.unshift(...spans);
    }
  }

  // TrustGraph Methods
  async emitNode(node: TrustGraphNode): Promise<void> {
    if (!this.trustGraphEnabled) return;

    // Queue node for batch sending
    this.nodeQueue.push(node);
  }

  private async flushNodes(): Promise<void> {
    if (this.nodeQueue.length === 0) return;

    const nodes = [...this.nodeQueue];
    this.nodeQueue = [];

    try {
      const response = await fetch(`${this.trustGraphHost}/v1/nodes/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.trustGraphApiKey}`,
        },
        body: JSON.stringify({ nodes }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TrustGraph API error: ${response.status} - ${error}`);
      }

      logger.debug(`Flushed ${nodes.length} nodes to TrustGraph`);
    } catch (error) {
      logger.error('Failed to flush nodes to TrustGraph', { error });
      // Re-queue failed nodes
      this.nodeQueue.unshift(...nodes);
    }
  }

  async emitEdge(edge: TrustGraphEdge): Promise<void> {
    if (!this.trustGraphEnabled) return;

    // Queue edge for batch sending
    this.edgeQueue.push(edge);
  }

  private async flushEdges(): Promise<void> {
    if (this.edgeQueue.length === 0) return;

    const edges = [...this.edgeQueue];
    this.edgeQueue = [];

    try {
      const response = await fetch(`${this.trustGraphHost}/v1/edges/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.trustGraphApiKey}`,
        },
        body: JSON.stringify({ edges }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TrustGraph API error: ${response.status} - ${error}`);
      }

      logger.debug(`Flushed ${edges.length} edges to TrustGraph`);
    } catch (error) {
      logger.error('Failed to flush edges to TrustGraph', { error });
      // Re-queue failed edges
      this.edgeQueue.unshift(...edges);
    }
  }

  // Convenience method for swarm operations
  async trackSwarmCreation(swarmId: string, swarmName: string, config: any): Promise<void> {
    const spanId = `swarm-create-${swarmId}`;
    
    // Start Langfuse span
    this.startSpan(spanId, 'SwarmCreation', { swarmName, config });

    // Emit TrustGraph node
    await this.emitNode({
      id: swarmId,
      type: 'swarm',
      label: swarmName,
      metadata: { config, createdAt: new Date().toISOString() },
    });
  }

  async trackSwarmDeployment(swarmId: string, machineId: string, success: boolean, error?: any): Promise<void> {
    const spanId = `swarm-create-${swarmId}`;
    
    // End Langfuse span
    this.endSpan(spanId, success ? { machineId, status: 'deployed' } : null, error);

    // Emit TrustGraph edge
    if (success) {
      await this.emitEdge({
        source: 'swarm-manager',
        target: swarmId,
        label: 'deployed',
        metadata: { machineId, deployedAt: new Date().toISOString() },
      });
    }
  }

  async trackWorkerAssignment(swarmId: string, workerId: string): Promise<void> {
    await this.emitEdge({
      source: swarmId,
      target: workerId,
      label: 'assigned',
      metadata: { assignedAt: new Date().toISOString() },
    });
  }

  async trackTaskExecution(taskId: string, workerId: string, input: any, output: any, duration: number): Promise<void> {
    const spanId = `task-${taskId}`;
    
    this.startSpan(spanId, 'TaskExecution', input, { workerId, taskId });
    
    // Simulate execution
    setTimeout(() => {
      this.endSpan(spanId, output);
    }, 10);

    await this.emitNode({
      id: taskId,
      type: 'task',
      label: `Task ${taskId}`,
      metadata: { workerId, duration, completedAt: new Date().toISOString() },
    });

    await this.emitEdge({
      source: workerId,
      target: taskId,
      label: 'executed',
      metadata: { duration, completedAt: new Date().toISOString() },
    });
  }

  // Performance metrics
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Emit metric event
    this.emit('metric', metric);

    // Keep only last 1000 metrics per name
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  getMetrics(name?: string, since?: Date): PerformanceMetric[] {
    if (name) {
      const metrics = this.metrics.get(name) || [];
      if (since) {
        return metrics.filter(m => m.timestamp >= since);
      }
      return metrics;
    }

    // Return all metrics
    const allMetrics: PerformanceMetric[] = [];
    for (const metrics of this.metrics.values()) {
      if (since) {
        allMetrics.push(...metrics.filter(m => m.timestamp >= since));
      } else {
        allMetrics.push(...metrics);
      }
    }
    return allMetrics;
  }

  getMetricSummary(name: string, since?: Date): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics(name, since);
    if (metrics.length === 0) return null;

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    };
  }

  // Batch flush operations
  private startFlushInterval(): void {
    this.flushInterval = setInterval(async () => {
      await Promise.all([
        this.flushSpans(),
        this.flushNodes(),
        this.flushEdges(),
      ]).catch(error => {
        logger.error('Error during telemetry flush', { error });
      });
    }, 5000); // Flush every 5 seconds
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    Promise.all([
      this.flushSpans(),
      this.flushNodes(),
      this.flushEdges(),
    ]).catch(error => {
      logger.error('Error during final telemetry flush', { error });
    });
  }
}

// Export singleton instance
export const telemetryService = new TelemetryService();