import { LangfuseService } from './langfuse-service';

// Global instance for decorators
let langfuseInstance: LangfuseService | null = null;

export function setLangfuseInstance(instance: LangfuseService): void {
  langfuseInstance = instance;
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
      if (!langfuseInstance) {
        // If no Langfuse instance, just run the original method
        return originalMethod.apply(this, args);
      }

      const startTime = Date.now();
      const traceId = langfuseInstance.startTrace({
        method: `${target.constructor.name}.${propertyKey}`,
        args: args.length
      });

      try {
        const result = await originalMethod.apply(this, args);
        
        // Extract LLM details from result if available
        if (result && typeof result === 'object') {
          const latency = Date.now() - startTime;
          
          // Check if result contains LLM details
          if ('prompt' in result && 'response' in result) {
            const tokens = result.tokens || { input: 0, output: 0 };
            const llmModel = result.model || model || 'unknown';
            
            await langfuseInstance.trackGeneration(
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
        
        await langfuseInstance.endTrace(traceId);
        return result;
      } catch (error) {
        await langfuseInstance.trackError(traceId, error as Error);
        await langfuseInstance.endTrace(traceId);
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
      if (!langfuseInstance) {
        return originalMethod.apply(this, args);
      }

      const traceId = langfuseInstance.startTrace({
        operation: `${target.constructor.name}.${propertyKey}`,
        ...metadata
      });

      try {
        const result = await originalMethod.apply(this, args);
        await langfuseInstance.endTrace(traceId, { success: true });
        return result;
      } catch (error) {
        await langfuseInstance.trackError(traceId, error as Error);
        await langfuseInstance.endTrace(traceId, { success: false });
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

  constructor(metadata?: Record<string, any>) {
    this.startTime = Date.now();
    this.traceId = langfuseInstance?.startTrace(metadata) || '';
  }

  async trackGeneration(
    model: string,
    prompt: string,
    response: string,
    tokens: { input: number; output: number },
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!langfuseInstance) return;
    
    const latency = Date.now() - this.startTime;
    await langfuseInstance.trackGeneration(
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
    if (!langfuseInstance) return;
    await langfuseInstance.trackError(this.traceId, error, metadata);
  }

  async end(metadata?: Record<string, any>): Promise<void> {
    if (!langfuseInstance) return;
    await langfuseInstance.endTrace(this.traceId, metadata);
  }

  getTraceId(): string {
    return this.traceId;
  }
}