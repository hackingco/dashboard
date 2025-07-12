import { langfuseService } from './langfuse.service';
import { performance } from 'perf_hooks';

/**
 * Decorator to trace API endpoints
 */
export function TraceEndpoint(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const endpointName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      const traceId = langfuseService.startTrace(endpointName, {
        method: propertyKey,
        args: args.length
      });

      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - startTime;
        
        await langfuseService.endTrace(traceId, {
          success: true,
          duration_ms: duration,
          result_type: typeof result
        });
        
        return result;
      } catch (error) {
        await langfuseService.trackError(traceId, error as Error);
        await langfuseService.endTrace(traceId, { success: false });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to trace LLM operations
 */
export function TraceLLM(model?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      const traceId = langfuseService.startTrace(`LLM.${propertyKey}`, {
        method: `${target.constructor.name}.${propertyKey}`,
        model
      });

      try {
        const result = await originalMethod.apply(this, args);
        const latency = performance.now() - startTime;
        
        // Extract LLM details from result if available
        if (result && typeof result === 'object') {
          // Check if result contains LLM details
          if ('prompt' in result && 'response' in result) {
            const tokens = result.tokens || { input: 0, output: 0 };
            const llmModel = result.model || model || 'unknown';
            
            await langfuseService.trackGeneration(
              traceId,
              llmModel,
              result.prompt,
              result.response,
              tokens,
              latency,
              {
                method: `${target.constructor.name}.${propertyKey}`,
                ...result.metadata
              }
            );
          }
        }
        
        await langfuseService.endTrace(traceId);
        return result;
      } catch (error) {
        await langfuseService.trackError(traceId, error as Error);
        await langfuseService.endTrace(traceId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to trace specific operations with custom metadata
 */
export function TraceOperation(metadata?: Record<string, any>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const traceId = langfuseService.startTrace(`${target.constructor.name}.${propertyKey}`, {
        operation: propertyKey,
        ...metadata
      });

      try {
        const result = await originalMethod.apply(this, args);
        await langfuseService.endTrace(traceId, { success: true });
        return result;
      } catch (error) {
        await langfuseService.trackError(traceId, error as Error);
        await langfuseService.endTrace(traceId, { success: false });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to trace swarm operations
 */
export function TraceSwarmOperation(operationType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const spanId = `swarm-${operationType}-${Date.now()}`;
      const traceId = langfuseService.startTrace(`Swarm.${operationType}`, {
        operation: propertyKey,
        type: operationType
      });
      
      langfuseService.startSpan(spanId, operationType, traceId, args[0]);

      try {
        const result = await originalMethod.apply(this, args);
        langfuseService.endSpan(spanId, result);
        await langfuseService.endTrace(traceId);
        return result;
      } catch (error) {
        langfuseService.endSpan(spanId, null, error);
        await langfuseService.trackError(traceId, error as Error);
        await langfuseService.endTrace(traceId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Manual tracing helper for more control
 */
export class LangfuseTracer {
  private traceId: string;
  private startTime: number;

  constructor(name: string, metadata?: Record<string, any>) {
    this.startTime = performance.now();
    this.traceId = langfuseService.startTrace(name, metadata);
  }

  async trackGeneration(
    model: string,
    prompt: string,
    response: string,
    tokens: { input: number; output: number },
    metadata?: Record<string, any>
  ): Promise<void> {
    const latency = performance.now() - this.startTime;
    await langfuseService.trackGeneration(
      this.traceId,
      model,
      prompt,
      response,
      tokens,
      latency,
      metadata
    );
  }

  async trackError(error: Error, metadata?: Record<string, any>): Promise<void> {
    await langfuseService.trackError(this.traceId, error, metadata);
  }

  async end(metadata?: Record<string, any>): Promise<void> {
    await langfuseService.endTrace(this.traceId, metadata);
  }

  getTraceId(): string {
    return this.traceId;
  }

  startSpan(name: string, input?: any, metadata?: Record<string, any>): string {
    const spanId = `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    langfuseService.startSpan(spanId, name, this.traceId, input, metadata);
    return spanId;
  }

  endSpan(spanId: string, output?: any, error?: any): void {
    langfuseService.endSpan(spanId, output, error);
  }
}

/**
 * Express middleware for automatic tracing
 */
export function langfuseMiddleware(req: any, res: any, next: any) {
  const startTime = performance.now();
  const traceId = langfuseService.startTrace(`HTTP ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    }
  });

  // Track response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = performance.now() - startTime;
    
    langfuseService.endTrace(traceId, {
      status: res.statusCode,
      duration_ms: duration,
      response_size: data ? data.length : 0
    }).catch(err => {
      console.error('Failed to end Langfuse trace:', err);
    });

    return originalSend.call(this, data);
  };

  // Track errors
  res.on('error', (error: Error) => {
    langfuseService.trackError(traceId, error).catch(err => {
      console.error('Failed to track error in Langfuse:', err);
    });
  });

  next();
}