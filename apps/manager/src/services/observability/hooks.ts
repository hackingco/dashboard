import { telemetryService } from '../telemetry.service';
import { trustGraphService } from '../trustgraph';
import { langfuseService, LangfuseTracer } from '../langfuse';
import logger from '../logger';

/**
 * Hook to track swarm lifecycle events
 */
export class SwarmObservabilityHooks {
  private static tracers = new Map<string, LangfuseTracer>();

  /**
   * Called when a swarm operation starts
   */
  static onSwarmOperationStart(
    operationId: string,
    operationType: 'create' | 'deploy' | 'scale' | 'stop' | 'destroy',
    metadata: Record<string, any>
  ): void {
    try {
      // Start Langfuse trace
      const tracer = new LangfuseTracer(`Swarm.${operationType}`, {
        operationId,
        ...metadata
      });
      this.tracers.set(operationId, tracer);

      // Record start metric
      telemetryService.recordMetric(
        `swarm.operation.started`,
        1,
        'count',
        { operation: operationType, ...metadata }
      );

      logger.debug(`Started swarm operation tracking`, { operationId, operationType });
    } catch (error) {
      logger.error('Failed to start swarm operation tracking', { error });
    }
  }

  /**
   * Called when a swarm is created
   */
  static async onSwarmCreated(
    swarmId: string,
    swarmName: string,
    config: any
  ): Promise<void> {
    try {
      // Track in TrustGraph
      await trustGraphService.createNode({
        id: swarmId,
        type: 'swarm',
        label: swarmName,
        metadata: {
          config,
          createdAt: new Date().toISOString(),
          status: 'initializing'
        }
      });

      // Track in telemetry
      await telemetryService.trackSwarmCreation(swarmId, swarmName, config);

      logger.info(`Tracked swarm creation`, { swarmId, swarmName });
    } catch (error) {
      logger.error('Failed to track swarm creation', { error });
    }
  }

  /**
   * Called when a worker is assigned to a swarm
   */
  static async onWorkerAssigned(
    swarmId: string,
    workerId: string,
    workerConfig: any
  ): Promise<void> {
    try {
      // Create worker node
      await trustGraphService.createNode({
        id: workerId,
        type: 'worker',
        label: `Worker ${workerId}`,
        metadata: {
          swarmId,
          config: workerConfig,
          assignedAt: new Date().toISOString()
        }
      });

      // Create assignment edge
      await trustGraphService.createEdge({
        source: swarmId,
        target: workerId,
        label: 'assigned',
        type: 'creates',
        metadata: {
          assignedAt: new Date().toISOString()
        }
      });

      // Track in telemetry
      await telemetryService.trackWorkerAssignment(swarmId, workerId);

      logger.info(`Tracked worker assignment`, { swarmId, workerId });
    } catch (error) {
      logger.error('Failed to track worker assignment', { error });
    }
  }

  /**
   * Called when a task is created
   */
  static async onTaskCreated(
    taskId: string,
    taskType: string,
    dependencies: string[] = []
  ): Promise<void> {
    try {
      // Track task dependencies
      if (dependencies.length > 0) {
        await trustGraphService.trackTaskDependency(taskId, dependencies);
      } else {
        // Create standalone task node
        await trustGraphService.createNode({
          id: taskId,
          type: 'task',
          label: `${taskType} Task`,
          metadata: {
            taskType,
            createdAt: new Date().toISOString(),
            status: 'pending'
          }
        });
      }

      logger.info(`Tracked task creation`, { taskId, taskType, dependencies });
    } catch (error) {
      logger.error('Failed to track task creation', { error });
    }
  }

  /**
   * Called when a task starts execution
   */
  static async onTaskExecutionStart(
    taskId: string,
    workerId: string,
    input: any
  ): Promise<void> {
    try {
      // Update task status
      await trustGraphService.updateTaskStatus(taskId, 'executing');

      // Start span if we have a tracer for this task's operation
      const operationId = input?.operationId;
      if (operationId && this.tracers.has(operationId)) {
        const tracer = this.tracers.get(operationId)!;
        const spanId = tracer.startSpan(`Task.${taskId}`, input, { workerId });
        
        // Store span ID for later
        (input as any).__spanId = spanId;
      }

      logger.debug(`Tracked task execution start`, { taskId, workerId });
    } catch (error) {
      logger.error('Failed to track task execution start', { error });
    }
  }

  /**
   * Called when a task completes execution
   */
  static async onTaskExecutionComplete(
    taskId: string,
    workerId: string,
    input: any,
    output: any,
    duration: number,
    error?: Error
  ): Promise<void> {
    try {
      // Update task status
      await trustGraphService.updateTaskStatus(
        taskId, 
        error ? 'failed' : 'completed'
      );

      // Track execution
      await telemetryService.trackTaskExecution(
        taskId,
        workerId,
        input,
        output,
        duration
      );

      // End span if we have one
      const spanId = (input as any).__spanId;
      const operationId = input?.operationId;
      if (spanId && operationId && this.tracers.has(operationId)) {
        const tracer = this.tracers.get(operationId)!;
        tracer.endSpan(spanId, output, error);
      }

      // Record metrics
      telemetryService.recordMetric(
        'task.duration',
        duration,
        'ms',
        { 
          taskId, 
          workerId, 
          status: error ? 'failed' : 'success',
          taskType: input?.taskType 
        }
      );

      logger.info(`Tracked task execution complete`, { 
        taskId, 
        workerId, 
        duration,
        status: error ? 'failed' : 'success'
      });
    } catch (err) {
      logger.error('Failed to track task execution complete', { error: err });
    }
  }

  /**
   * Called when a swarm operation completes
   */
  static async onSwarmOperationComplete(
    operationId: string,
    success: boolean,
    metadata?: Record<string, any>,
    error?: Error
  ): Promise<void> {
    try {
      // End Langfuse trace
      const tracer = this.tracers.get(operationId);
      if (tracer) {
        if (error) {
          await tracer.trackError(error);
        }
        await tracer.end({
          success,
          ...metadata
        });
        this.tracers.delete(operationId);
      }

      // Record completion metric
      telemetryService.recordMetric(
        `swarm.operation.completed`,
        1,
        'count',
        { 
          success: success ? 'true' : 'false',
          ...metadata 
        }
      );

      logger.debug(`Completed swarm operation tracking`, { 
        operationId, 
        success 
      });
    } catch (err) {
      logger.error('Failed to complete swarm operation tracking', { error: err });
    }
  }

  /**
   * Called when an API endpoint is invoked
   */
  static async onApiEndpointInvoked(
    endpoint: string,
    method: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Create API node if it doesn't exist
      const apiNodeId = `api-${endpoint.replace(/\//g, '-')}`;
      await trustGraphService.createNode({
        id: apiNodeId,
        type: 'api',
        label: `${method} ${endpoint}`,
        metadata: {
          method,
          endpoint,
          firstSeen: new Date().toISOString()
        }
      });

      // Record API metric
      telemetryService.recordMetric(
        'api.request',
        1,
        'count',
        {
          endpoint,
          method,
          ...metadata
        }
      );

      logger.debug(`Tracked API endpoint invocation`, { endpoint, method });
    } catch (error) {
      logger.error('Failed to track API endpoint invocation', { error });
    }
  }

  /**
   * Called to track LLM operations
   */
  static async onLLMOperation(
    model: string,
    prompt: string,
    response: string,
    tokens: { input: number; output: number },
    latency: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const traceId = langfuseService.startTrace('LLMOperation', {
        model,
        ...metadata
      });

      await langfuseService.trackGeneration(
        traceId,
        model,
        prompt,
        response,
        tokens,
        latency,
        metadata
      );

      await langfuseService.endTrace(traceId);

      // Record token usage metric
      telemetryService.recordMetric(
        'llm.tokens.input',
        tokens.input,
        'tokens',
        { model }
      );
      
      telemetryService.recordMetric(
        'llm.tokens.output',
        tokens.output,
        'tokens',
        { model }
      );

      logger.debug(`Tracked LLM operation`, { model, tokens });
    } catch (error) {
      logger.error('Failed to track LLM operation', { error });
    }
  }

  /**
   * Clean up resources
   */
  static cleanup(): void {
    // End any remaining traces
    for (const [operationId, tracer] of this.tracers) {
      tracer.end({ status: 'interrupted' }).catch(err =>
        logger.error('Failed to end tracer during cleanup', { operationId, error: err })
      );
    }
    this.tracers.clear();
  }
}

// Export convenience functions
export const swarmHooks = SwarmObservabilityHooks;