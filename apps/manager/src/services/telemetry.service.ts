import logger from './logger';

interface LangfuseSpan {
  name: string;
  startTime: Date;
  endTime?: Date;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
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

export class TelemetryService {
  private langfuseEnabled: boolean;
  private trustGraphEnabled: boolean;
  private langfuseApiKey: string;
  private trustGraphApiKey: string;
  private activeSpans: Map<string, LangfuseSpan> = new Map();

  constructor() {
    this.langfuseApiKey = process.env.LANGFUSE_SECRET_KEY || '';
    this.trustGraphApiKey = process.env.TRUSTGRAPH_API_KEY || '';
    this.langfuseEnabled = !!this.langfuseApiKey;
    this.trustGraphEnabled = !!this.trustGraphApiKey;

    if (!this.langfuseEnabled) {
      logger.info('Langfuse telemetry disabled - LANGFUSE_SECRET_KEY not set');
    }
    if (!this.trustGraphEnabled) {
      logger.info('TrustGraph telemetry disabled - TRUSTGRAPH_API_KEY not set');
    }
  }

  // Langfuse Methods
  startSpan(spanId: string, name: string, input?: any, metadata?: Record<string, any>): void {
    if (!this.langfuseEnabled) return;

    const span: LangfuseSpan = {
      name,
      startTime: new Date(),
      input,
      metadata,
    };

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

    // Send to Langfuse (mock implementation)
    this.sendToLangfuse(span);
    this.activeSpans.delete(spanId);
    logger.debug('Ended Langfuse span', { spanId, duration: span.endTime.getTime() - span.startTime.getTime() });
  }

  private async sendToLangfuse(span: LangfuseSpan): Promise<void> {
    try {
      // In a real implementation, this would send data to Langfuse API
      const langfusePayload = {
        name: span.name,
        startTime: span.startTime.toISOString(),
        endTime: span.endTime?.toISOString(),
        input: span.input,
        output: span.output,
        metadata: span.metadata,
        duration: span.endTime ? span.endTime.getTime() - span.startTime.getTime() : 0,
      };

      logger.debug('Would send to Langfuse', langfusePayload);
      // await fetch(LANGFUSE_API_URL, { ... })
    } catch (error) {
      logger.error('Failed to send span to Langfuse', { error });
    }
  }

  // TrustGraph Methods
  async emitNode(node: TrustGraphNode): Promise<void> {
    if (!this.trustGraphEnabled) return;

    try {
      // In a real implementation, this would send data to TrustGraph API
      logger.debug('Emitting TrustGraph node', node);
      // await fetch(TRUSTGRAPH_API_URL + '/nodes', { ... })
    } catch (error) {
      logger.error('Failed to emit node to TrustGraph', { error });
    }
  }

  async emitEdge(edge: TrustGraphEdge): Promise<void> {
    if (!this.trustGraphEnabled) return;

    try {
      // In a real implementation, this would send data to TrustGraph API
      logger.debug('Emitting TrustGraph edge', edge);
      // await fetch(TRUSTGRAPH_API_URL + '/edges', { ... })
    } catch (error) {
      logger.error('Failed to emit edge to TrustGraph', { error });
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
}

// Export singleton instance
export const telemetryService = new TelemetryService();