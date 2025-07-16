/**
 * Server-side Langfuse SDK initialization and instrumentation
 * This module provides proper Langfuse SDK setup for server-side trace collection
 */

import { Langfuse } from 'langfuse-node';

// Initialize Langfuse client for server-side usage
let langfuseServerClient: Langfuse | null = null;

export function initializeLangfuseServer(): Langfuse {
  if (langfuseServerClient) {
    return langfuseServerClient;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY || process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY || 'pk-lf-1c8afc48-c76e-4abc-aa7a-7e02449ea4fd';
  const secretKey = process.env.LANGFUSE_SECRET_KEY || 'sk-lf-10ae3e48-9bea-4d06-84dd-2a83abc3fc86';
  const baseUrl = process.env.LANGFUSE_HOST || process.env.NEXT_PUBLIC_LANGFUSE_HOST || 'http://localhost:3000';

  if (!publicKey || !secretKey) {
    console.warn('⚠️ Langfuse credentials missing, instrumentation disabled');
    throw new Error('Langfuse credentials not configured');
  }

  try {
    langfuseServerClient = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      flushAt: 20,
      flushInterval: 10000,
      enabled: process.env.NODE_ENV !== 'test', // Disable in test environment
    });

    console.log('✅ Langfuse server client initialized successfully');
    console.log(`📍 Connected to: ${baseUrl}`);

    // Handle shutdown gracefully
    const shutdownHandler = async () => {
      console.log('🔄 Flushing Langfuse traces before shutdown...');
      if (langfuseServerClient) {
        await langfuseServerClient.shutdownAsync();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);

    return langfuseServerClient;
  } catch (error) {
    console.error('❌ Failed to initialize Langfuse server client:', error);
    throw error;
  }
}

// Helper to get or create Langfuse client
export function getLangfuseServer(): Langfuse {
  if (!langfuseServerClient) {
    return initializeLangfuseServer();
  }
  return langfuseServerClient;
}

// Instrumentation helpers for swarm operations
export async function traceSwarmOperation<T>(
  operationName: string,
  sessionId: string,
  metadata: Record<string, any>,
  operation: () => Promise<T>
): Promise<T> {
  const langfuse = getLangfuseServer();
  const trace = langfuse.trace({
    name: operationName,
    sessionId,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    },
    tags: ['swarm', 'server-side'],
  });

  const startTime = Date.now();
  
  try {
    const result = await operation();
    
    trace.update({
      output: { success: true },
      metadata: {
        ...metadata,
        duration: Date.now() - startTime,
        status: 'success',
      },
    });

    await langfuse.flushAsync();
    return result;
  } catch (error) {
    trace.update({
      output: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      metadata: {
        ...metadata,
        duration: Date.now() - startTime,
        status: 'error',
        error: error instanceof Error ? error.stack : String(error),
      },
      level: 'ERROR',
    });

    await langfuse.flushAsync();
    throw error;
  }
}

// Trace agent activities
export async function traceAgentActivity(
  agentId: string,
  agentName: string,
  activity: string,
  sessionId: string,
  metadata?: Record<string, any>
): Promise<void> {
  const langfuse = getLangfuseServer();
  
  const trace = langfuse.trace({
    name: `Agent: ${agentName}`,
    sessionId,
    userId: agentId,
    metadata: {
      agentId,
      agentName,
      activity,
      ...metadata,
      timestamp: new Date().toISOString(),
    },
    tags: ['agent', 'activity', activity],
  });

  // Create a span for the specific activity
  const span = trace.span({
    name: activity,
    metadata: {
      agentId,
      ...metadata,
    },
  });

  span.end();
  await langfuse.flushAsync();
}

// Trace swarm coordination events
export async function traceSwarmCoordination(
  swarmId: string,
  event: string,
  participants: string[],
  sessionId: string,
  metadata?: Record<string, any>
): Promise<void> {
  const langfuse = getLangfuseServer();
  
  const trace = langfuse.trace({
    name: `Swarm Coordination: ${event}`,
    sessionId,
    metadata: {
      swarmId,
      event,
      participants,
      participantCount: participants.length,
      ...metadata,
      timestamp: new Date().toISOString(),
    },
    tags: ['swarm', 'coordination', event],
  });

  await langfuse.flushAsync();
}

// Trace API endpoints
export async function traceAPIEndpoint<T>(
  endpoint: string,
  method: string,
  handler: () => Promise<T>
): Promise<T> {
  const langfuse = getLangfuseServer();
  const sessionId = `api-${Date.now()}`;
  
  const trace = langfuse.trace({
    name: `API: ${method} ${endpoint}`,
    sessionId,
    metadata: {
      endpoint,
      method,
      timestamp: new Date().toISOString(),
    },
    tags: ['api', method.toLowerCase()],
  });

  const startTime = Date.now();

  try {
    const result = await handler();
    
    trace.update({
      output: { success: true },
      metadata: {
        endpoint,
        method,
        duration: Date.now() - startTime,
        status: 'success',
      },
    });

    await langfuse.flushAsync();
    return result;
  } catch (error) {
    trace.update({
      output: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      metadata: {
        endpoint,
        method,
        duration: Date.now() - startTime,
        status: 'error',
      },
      level: 'ERROR',
    });

    await langfuse.flushAsync();
    throw error;
  }
}

// Create generation spans for LLM calls
export async function traceLLMGeneration(
  model: string,
  prompt: string,
  sessionId: string,
  metadata?: Record<string, any>
): Promise<{
  generation: any;
  complete: (completion: string, usage?: { promptTokens?: number; completionTokens?: number }) => Promise<void>;
}> {
  const langfuse = getLangfuseServer();
  
  const trace = langfuse.trace({
    name: `LLM Generation: ${model}`,
    sessionId,
    metadata: {
      model,
      ...metadata,
      timestamp: new Date().toISOString(),
    },
    tags: ['llm', 'generation', model],
  });

  const generation = trace.generation({
    name: model,
    model,
    input: prompt,
    metadata,
  });

  return {
    generation,
    complete: async (completion: string, usage?: { promptTokens?: number; completionTokens?: number }) => {
      generation.end({
        output: completion,
        usage,
      });
      await langfuse.flushAsync();
    },
  };
}

// Performance monitoring wrapper
export async function withPerformanceMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>,
  thresholdMs: number = 1000
): Promise<T> {
  const startTime = Date.now();
  const langfuse = getLangfuseServer();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    if (duration > thresholdMs) {
      const trace = langfuse.trace({
        name: `Performance Warning: ${operationName}`,
        sessionId: `perf-${Date.now()}`,
        metadata: {
          operation: operationName,
          duration,
          threshold: thresholdMs,
          exceeded: true,
        },
        tags: ['performance', 'warning'],
        level: 'WARNING',
      });
      
      await langfuse.flushAsync();
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    const trace = langfuse.trace({
      name: `Performance Error: ${operationName}`,
      sessionId: `perf-error-${Date.now()}`,
      metadata: {
        operation: operationName,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      tags: ['performance', 'error'],
      level: 'ERROR',
    });
    
    await langfuse.flushAsync();
    throw error;
  }
}

// Batch trace creation for high-volume operations
export class BatchTracer {
  private traces: Array<{
    name: string;
    sessionId: string;
    metadata?: Record<string, any>;
    tags?: string[];
  }> = [];
  
  private batchSize: number;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(batchSize: number = 50, flushIntervalMs: number = 5000) {
    this.batchSize = batchSize;
    
    // Set up automatic flush interval
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, flushIntervalMs);
  }

  add(trace: {
    name: string;
    sessionId: string;
    metadata?: Record<string, any>;
    tags?: string[];
  }): void {
    this.traces.push(trace);
    
    if (this.traces.length >= this.batchSize) {
      this.flush().catch(console.error);
    }
  }

  async flush(): Promise<void> {
    if (this.traces.length === 0) return;
    
    const langfuse = getLangfuseServer();
    const tracesToFlush = [...this.traces];
    this.traces = [];
    
    // Create all traces
    for (const trace of tracesToFlush) {
      langfuse.trace(trace);
    }
    
    // Flush all at once
    await langfuse.flushAsync();
  }

  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

// Export singleton batch tracer
export const batchTracer = new BatchTracer();

// Clean up on process exit
process.on('beforeExit', async () => {
  await batchTracer.close();
});