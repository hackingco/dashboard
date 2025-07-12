import logger from './logger';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { trustGraphService } from './trustgraph';
import { langfuseService } from './langfuse';

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
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private performanceMarks: Map<string, number> = new Map();

  constructor() {
    super();
    
    if (!langfuseService.isEnabled()) {
      logger.info('Langfuse telemetry disabled - API keys not configured');
    }
    
    logger.info('Telemetry service initialized with TrustGraph and Langfuse integration');
  }

  // Langfuse Methods (delegated to langfuseService)
  startSpan(spanId: string, name: string, input?: any, metadata?: Record<string, any>, parentId?: string): void {
    langfuseService.startSpan(spanId, name, parentId, input, metadata);
    
    // Mark performance start
    this.performanceMarks.set(spanId, performance.now());
    logger.debug('Started Langfuse span', { spanId, name });
  }

  endSpan(spanId: string, output?: any, error?: any): void {
    langfuseService.endSpan(spanId, output, error);
    
    // Calculate duration using performance marks
    const startMark = this.performanceMarks.get(spanId);
    if (startMark) {
      const duration = performance.now() - startMark;
      this.performanceMarks.delete(spanId);
      
      // Emit performance metric
      this.recordMetric('span.duration', duration, 'ms', {
        span: spanId,
        status: error ? 'error' : 'success',
      });
    }
    
    logger.debug('Ended Langfuse span', { spanId });
  }

  // TrustGraph Methods (delegated to trustGraphService)
  async emitNode(node: TrustGraphNode): Promise<void> {
    await trustGraphService.createNode(node);
  }

  async emitEdge(edge: TrustGraphEdge): Promise<void> {
    await trustGraphService.createEdge(edge);
  }

  // Track task dependencies
  async trackTaskDependency(taskId: string, dependsOn: string[]): Promise<void> {
    await trustGraphService.trackTaskDependency(taskId, dependsOn);
  }

  async updateTaskStatus(taskId: string, status: 'pending' | 'ready' | 'executing' | 'completed' | 'failed'): Promise<void> {
    await trustGraphService.updateTaskStatus(taskId, status);
  }

  // Convenience method for swarm operations
  async trackSwarmCreation(swarmId: string, swarmName: string, config: any): Promise<void> {
    const traceId = langfuseService.startTrace('SwarmCreation', { swarmName, config });
    
    // Emit TrustGraph node
    await trustGraphService.createNode({
      id: swarmId,
      type: 'swarm',
      label: swarmName,
      metadata: { config, createdAt: new Date().toISOString() },
    });

    // Track in both systems
    this.emit('swarm:created', { swarmId, swarmName, config });
  }

  async trackSwarmDeployment(swarmId: string, machineId: string, success: boolean, error?: any): Promise<void> {
    const traceId = `swarm-create-${swarmId}`;
    
    // End Langfuse trace
    if (success) {
      await langfuseService.endTrace(traceId, { machineId, status: 'deployed' });
    } else {
      await langfuseService.trackError(traceId, error);
      await langfuseService.endTrace(traceId, { status: 'failed' });
    }

    // Emit TrustGraph edge
    if (success) {
      await trustGraphService.createEdge({
        source: 'swarm-manager',
        target: swarmId,
        label: 'deployed',
        type: 'creates',
        metadata: { machineId, deployedAt: new Date().toISOString() },
      });
    }
  }

  async trackWorkerAssignment(swarmId: string, workerId: string): Promise<void> {
    await trustGraphService.createEdge({
      source: swarmId,
      target: workerId,
      label: 'assigned',
      type: 'creates',
      metadata: { assignedAt: new Date().toISOString() },
    });

    // Also create worker node
    await trustGraphService.createNode({
      id: workerId,
      type: 'worker',
      label: `Worker ${workerId}`,
      metadata: { swarmId, createdAt: new Date().toISOString() }
    });
  }

  async trackTaskExecution(taskId: string, workerId: string, input: any, output: any, duration: number): Promise<void> {
    const traceId = langfuseService.startTrace('TaskExecution', { workerId, taskId });
    const spanId = `task-${taskId}`;
    
    langfuseService.startSpan(spanId, 'TaskExecution', traceId, input);
    
    // Track execution
    langfuseService.endSpan(spanId, output);
    await langfuseService.endTrace(traceId, { duration });

    // Create task node
    await trustGraphService.createNode({
      id: taskId,
      type: 'task',
      label: `Task ${taskId}`,
      metadata: { workerId, duration, completedAt: new Date().toISOString() },
    });

    // Create execution edge
    await trustGraphService.createEdge({
      source: workerId,
      target: taskId,
      label: 'executed',
      type: 'executes',
      metadata: { duration, completedAt: new Date().toISOString() },
    });

    // Update task status
    await trustGraphService.updateTaskStatus(taskId, 'completed');
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

  // Get DAG analysis from TrustGraph
  getDAGAnalysis() {
    return trustGraphService.analyzeDAG();
  }

  // Get visualization data
  getVisualizationData() {
    return trustGraphService.getVisualizationData();
  }

  // Get Langfuse metrics
  getLangfuseMetrics(timeRange?: { start: Date; end: Date }) {
    return langfuseService.getMetrics(timeRange);
  }

  // Cleanup
  async destroy(): Promise<void> {
    await Promise.all([
      trustGraphService.destroy(),
      langfuseService.shutdown()
    ]).catch(error => {
      logger.error('Error during telemetry service cleanup', { error });
    });
  }
}

// Export singleton instance
export const telemetryService = new TelemetryService();