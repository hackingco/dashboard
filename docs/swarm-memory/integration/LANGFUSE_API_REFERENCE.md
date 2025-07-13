# Langfuse API Reference

## Core Services

### LangfuseService

The main service for managing traces, generations, and metrics.

```typescript
import { langfuseService } from '@swarm/langfuse';
```

#### Methods

##### `initialize(config: LangfuseConfig): void`

Initialize the Langfuse client with configuration.

```typescript
interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  host?: string;         // Default: 'https://cloud.langfuse.com'
  flushAt?: number;      // Default: 20
  flushInterval?: number; // Default: 10000 (10s)
}
```

##### `startTrace(name: string, metadata?: Record<string, any>): string`

Start a new trace and return its ID.

```typescript
const traceId = langfuseService.startTrace('API.Call', {
  service: 'user-service',
  version: '1.0.0',
  environment: 'production'
});
```

##### `trackGeneration(traceId: string, model: string, prompt: string, response: string, tokens: TokenUsage, latency: number, metadata?: Record<string, any>): Promise<void>`

Track an LLM generation within a trace.

```typescript
interface TokenUsage {
  input: number;
  output: number;
  total?: number;
}

await langfuseService.trackGeneration(
  traceId,
  'gpt-4',
  'What is the weather?',
  'The weather is sunny.',
  { input: 10, output: 20 },
  150,
  { temperature: 0.7 }
);
```

##### `trackError(traceId: string, error: Error, metadata?: Record<string, any>): Promise<void>`

Track an error in the trace.

```typescript
try {
  // operation
} catch (error) {
  await langfuseService.trackError(traceId, error, {
    retry_count: 3,
    fallback_used: true
  });
}
```

##### `endTrace(traceId: string, metadata?: Record<string, any>): Promise<void>`

Complete a trace with final metadata.

```typescript
await langfuseService.endTrace(traceId, {
  status: 'success',
  duration_ms: 1500,
  items_processed: 100
});
```

##### `getMetrics(timeRange?: TimeRange): Metrics`

Get aggregated metrics for the specified time range.

```typescript
interface TimeRange {
  start: Date;
  end: Date;
}

interface Metrics {
  totalTraces: number;
  totalTokens: { input: number; output: number; total: number };
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  modelUsage: Record<string, number>;
}

const metrics = langfuseService.getMetrics({
  start: new Date(Date.now() - 86400000), // 24 hours ago
  end: new Date()
});
```

##### `cleanupTraces(olderThan: Date): number`

Remove traces older than the specified date.

```typescript
const removed = langfuseService.cleanupTraces(
  new Date(Date.now() - 7 * 86400000) // 7 days ago
);
console.log(`Cleaned up ${removed} traces`);
```

##### `shutdown(): Promise<void>`

Flush pending traces and close the client.

```typescript
process.on('SIGTERM', async () => {
  await langfuseService.shutdown();
  process.exit(0);
});
```

### LangfuseTracer

Specialized tracer for API calls with automatic span management.

```typescript
import { langfuseTracer } from '@swarm/langfuse/utils';
```

#### Methods

##### `traceApiCall<T>(options: TracerOptions, apiCall: () => Promise<T>): Promise<TracedResponse<T>>`

Trace an async API call with automatic error handling.

```typescript
interface TracerOptions {
  spanName: string;
  tags: {
    endpoint: string;
    app_name?: string;
    [key: string]: any;
  };
}

interface TracedResponse<T> {
  data: T;
  latency: number;
  traceId: string;
}

const result = await langfuseTracer.traceApiCall(
  {
    spanName: 'database.query',
    tags: {
      endpoint: '/api/users',
      query_type: 'select',
      table: 'users'
    }
  },
  async () => {
    return await db.query('SELECT * FROM users');
  }
);
```

### SwarmObservabilityHooks

Hooks for tracking swarm lifecycle events.

```typescript
import { swarmHooks } from '@swarm/langfuse/observability/hooks';
```

#### Methods

##### `onSwarmOperationStart(operationId: string, operationType: string, metadata: Record<string, any>): void`

Track the start of a swarm operation.

```typescript
swarmHooks.onSwarmOperationStart(
  'op-123',
  'deploy',
  {
    swarmName: 'production-api',
    targetSize: 5
  }
);
```

##### `onSwarmCreated(swarmId: string, swarmName: string, config: any): Promise<void>`

Track swarm creation.

```typescript
await swarmHooks.onSwarmCreated(
  'swarm-456',
  'api-workers',
  {
    topology: 'mesh',
    maxWorkers: 10,
    region: 'us-east-1'
  }
);
```

##### `onWorkerAssigned(swarmId: string, workerId: string, workerConfig: any): Promise<void>`

Track worker assignment to a swarm.

```typescript
await swarmHooks.onWorkerAssigned(
  'swarm-456',
  'worker-789',
  {
    cpu: 2,
    memory: 4096,
    capabilities: ['api', 'processing']
  }
);
```

##### `onTaskCreated(taskId: string, taskType: string, dependencies?: string[]): Promise<void>`

Track task creation with dependencies.

```typescript
await swarmHooks.onTaskCreated(
  'task-001',
  'data-processing',
  ['task-000'] // Dependencies
);
```

##### `onTaskExecutionStart(taskId: string, workerId: string, input: any): Promise<void>`

Track the start of task execution.

```typescript
await swarmHooks.onTaskExecutionStart(
  'task-001',
  'worker-789',
  {
    dataSource: 's3://bucket/data.csv',
    processingType: 'aggregate'
  }
);
```

##### `onTaskExecutionComplete(taskId: string, workerId: string, input: any, output: any, duration: number, error?: Error): Promise<void>`

Track task completion or failure.

```typescript
// Success case
await swarmHooks.onTaskExecutionComplete(
  'task-001',
  'worker-789',
  { dataSource: 's3://bucket/data.csv' },
  { rowsProcessed: 10000, outputFile: 's3://bucket/output.csv' },
  5000 // 5 seconds
);

// Error case
await swarmHooks.onTaskExecutionComplete(
  'task-002',
  'worker-789',
  { dataSource: 's3://bucket/invalid.csv' },
  null,
  1000,
  new Error('File not found')
);
```

##### `onSwarmOperationComplete(operationId: string, success: boolean, metadata?: Record<string, any>, error?: Error): Promise<void>`

Complete a swarm operation tracking.

```typescript
await swarmHooks.onSwarmOperationComplete(
  'op-123',
  true,
  {
    deployedWorkers: 5,
    totalDuration: 30000
  }
);
```

## Decorators

### @TraceLLM

Decorator for automatic LLM operation tracing.

```typescript
import { TraceLLM } from '@swarm/langfuse/decorators';

class AIService {
  @TraceLLM({ model: 'gpt-4' })
  async generateResponse(prompt: string): Promise<string> {
    const response = await openai.complete({ prompt });
    return response.text;
  }
}
```

### @TraceAPI

Decorator for automatic API call tracing.

```typescript
import { TraceAPI } from '@swarm/langfuse/decorators';

class UserService {
  @TraceAPI({ 
    endpoint: '/api/users/:id',
    service: 'user-service' 
  })
  async getUser(userId: string): Promise<User> {
    return await this.db.findUser(userId);
  }
}
```

### @TraceMethod

Generic method tracing decorator.

```typescript
import { TraceMethod } from '@swarm/langfuse/decorators';

class DataProcessor {
  @TraceMethod({ 
    spanName: 'data.process',
    captureArgs: true,
    captureResult: true 
  })
  async processData(input: any): Promise<any> {
    // Complex processing logic
    return processedData;
  }
}
```

## Types and Interfaces

### Core Types

```typescript
interface LLMTrace {
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

interface TracerOptions {
  spanName: string;
  tags: Record<string, any>;
}

interface TracedResponse<T> {
  data: T;
  latency: number;
  traceId: string;
}
```

### Configuration Types

```typescript
interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  host?: string;
  flushAt?: number;
  flushInterval?: number;
  requestTimeout?: number;
  maxRetries?: number;
}

interface DecoratorOptions {
  spanName?: string;
  tags?: Record<string, any>;
  captureArgs?: boolean;
  captureResult?: boolean;
  captureError?: boolean;
}
```

## Event Emitters

The LangfuseService extends EventEmitter and emits the following events:

```typescript
langfuseService.on('initialized', () => {
  console.log('Langfuse client initialized');
});

langfuseService.on('generation:tracked', (trace: LLMTrace) => {
  console.log('Generation tracked:', trace);
});

langfuseService.on('error:tracked', ({ traceId, error }) => {
  console.log('Error tracked:', traceId, error);
});

langfuseService.on('span:ended', (span: LangfuseSpan) => {
  console.log('Span completed:', span);
});

langfuseService.on('trace:ended', ({ traceId, duration }) => {
  console.log('Trace completed:', traceId, duration);
});

langfuseService.on('shutdown', () => {
  console.log('Langfuse service shutdown');
});
```

## Utility Functions

### Cost Calculator

```typescript
import { CostCalculator } from '@swarm/langfuse/utils';

const calculator = new CostCalculator();

// Calculate cost for token usage
const cost = calculator.calculate('gpt-4', { input: 1000, output: 500 });

// Update model rates
calculator.updateRate('custom-model', { input: 0.001, output: 0.002 });

// Get all rates
const rates = calculator.getAllRates();
```

### Performance Helpers

```typescript
import { performanceHelpers } from '@swarm/langfuse/utils';

// Measure async operation
const { result, duration } = await performanceHelpers.measureAsync(
  async () => await someAsyncOperation()
);

// Create performance mark
const markId = performanceHelpers.mark('operation-start');
// ... do work ...
const duration = performanceHelpers.measure(markId);
```

## Best Practices

1. **Always clean up**: Call `shutdown()` before process termination
2. **Use structured span names**: Follow the `service.resource.action` pattern
3. **Include relevant metadata**: Add context that helps with debugging
4. **Handle errors gracefully**: Always track errors for failed operations
5. **Configure batching**: Adjust `flushAt` and `flushInterval` based on volume
6. **Implement sampling**: For high-volume operations, sample traces
7. **Secure sensitive data**: Never include PII or secrets in traces
8. **Monitor costs**: Regularly review token usage and costs

## Examples

See the [integration guide](./LANGFUSE_INTEGRATION.md) for comprehensive examples of each API method in action.