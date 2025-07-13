# @swarm/langfuse-wrapper

A comprehensive Langfuse integration wrapper for Swarm orchestration with auto-registration, memory coordination, and Claude-Flow hooks support.

## Features

- 🚀 **Auto-registration** with Claude-Flow hooks system
- 💾 **Memory coordination** through SQLite database
- 🪝 **Flexible hook system** for pre/post/error operations
- 📊 **Span enrichment** with metadata and tags
- 🔄 **Graceful degradation** when Langfuse is unavailable
- 🎯 **High performance** - handles 1000+ traces per second
- 🧪 **Comprehensive test coverage** (>90%)
- 🔧 **TypeScript support** with full type definitions

## Installation

```bash
npm install @swarm/langfuse-wrapper
```

## Quick Start

```typescript
import { LangfuseWrapper } from '@swarm/langfuse-wrapper';

// Initialize with auto-configuration
const langfuse = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  autoRegister: true, // Auto-register with Claude-Flow
  memoryDbPath: '.swarm/langfuse-memory.db'
});

// Start a trace
const traceId = await langfuse.startTrace('api-request', {
  endpoint: '/api/users',
  method: 'GET'
});

// Add spans
await langfuse.startSpan('db-query', 'Fetch users', traceId);
// ... perform operation
await langfuse.endSpan('db-query', { userCount: 42 });

// Track LLM generations
await langfuse.trackGeneration(
  traceId,
  'gpt-4',
  'Generate user summary',
  'Here are the users...',
  { input: 150, output: 300 }
);

// End trace
await langfuse.endTrace(traceId, { status: 'success' });
```

## Configuration

### Environment Variables

```bash
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com # Optional
CLAUDE_FLOW_ENABLED=true # Enable Claude-Flow integration
```

### Configuration Options

```typescript
interface LangfuseWrapperConfig {
  publicKey?: string;        // Langfuse public key
  secretKey?: string;        // Langfuse secret key
  host?: string;            // Langfuse host (default: cloud.langfuse.com)
  flushAt?: number;         // Batch size for flushing (default: 20)
  flushInterval?: number;   // Flush interval in ms (default: 10000)
  autoRegister?: boolean;   // Auto-register with Claude-Flow (default: true)
  memoryDbPath?: string;    // SQLite database path (default: .swarm/langfuse-memory.db)
  enableHooks?: boolean;    // Enable hook system (default: true)
  logger?: winston.Logger;  // Custom logger instance
}
```

## Hook System

Register custom hooks for trace lifecycle events:

```typescript
// Pre-trace hook
langfuse.registerHook('pre-trace', async (context) => {
  console.log(`Starting trace: ${context.operation}`);
  // Add custom logic
});

// Post-span hook
langfuse.registerHook('post-span', async (context) => {
  console.log(`Span completed in ${context.metadata.duration}ms`);
});

// Error hook
langfuse.registerHook('error', async (context) => {
  console.error(`Error in ${context.operation}:`, context.error);
  // Send to error tracking service
});
```

## Claude-Flow Integration

When `CLAUDE_FLOW_ENABLED=true`, the wrapper automatically registers with Claude-Flow hooks:

```typescript
// Automatic integration - traces are created for Claude-Flow tasks
npx claude-flow@alpha hooks pre-task --description "Process data"
// LangfuseWrapper automatically starts a trace

npx claude-flow@alpha hooks post-task --task-id "task-123"
// LangfuseWrapper automatically ends the trace
```

## Memory Coordination

The wrapper maintains a local SQLite database for coordination:

```typescript
// Get memory statistics
const stats = langfuse.getMemoryStats();
console.log(stats);
// {
//   total_traces: 1000,
//   pending_traces: 5,
//   completed_traces: 995,
//   avg_duration_ms: 1250.5
// }
```

## Event System

Listen to lifecycle events:

```typescript
langfuse.on('initialized', ({ enabled }) => {
  console.log(`Langfuse initialized: ${enabled}`);
});

langfuse.on('trace:started', ({ traceId, name }) => {
  console.log(`Trace started: ${traceId} - ${name}`);
});

langfuse.on('span:ended', ({ spanId, duration, status }) => {
  console.log(`Span ended: ${spanId} - ${duration}ms - ${status}`);
});

langfuse.on('error:tracked', ({ traceId, error }) => {
  console.error(`Error tracked in trace ${traceId}:`, error);
});
```

## Performance

The wrapper is optimized for high-throughput scenarios:

- Handles 1000+ traces per second
- Minimal memory overhead with automatic cleanup
- Efficient batching and flushing
- Thread-safe concurrent operations

## Testing

Run the comprehensive test suite:

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Run performance tests
NODE_OPTIONS="--expose-gc" npm run test tests/integration/performance.test.ts
```

## CI/CD Integration

The package includes GitHub Actions workflows for:

- Multi-version Node.js testing (18.x, 20.x)
- Code coverage reporting with Codecov
- Performance regression testing
- Automated publishing dry-runs

## API Reference

### Core Methods

#### `startTrace(name: string, metadata?: Record<string, any>): Promise<string>`
Start a new trace with optional metadata.

#### `startSpan(spanId: string, name: string, traceId?: string, enrichment?: SpanEnrichment): Promise<void>`
Start a span within a trace with optional enrichment.

#### `endSpan(spanId: string, output?: any, error?: Error): Promise<void>`
End a span with optional output or error.

#### `trackGeneration(traceId: string, model: string, prompt: string, response: string, tokenUsage: TokenUsage, metadata?: Record<string, any>): Promise<void>`
Track LLM generation with token usage.

#### `trackError(traceId: string, error: Error, metadata?: Record<string, any>): Promise<void>`
Track an error within a trace.

#### `endTrace(traceId: string, metadata?: Record<string, any>): Promise<void>`
End a trace with optional final metadata.

#### `flush(): Promise<void>`
Manually flush pending events to Langfuse.

#### `shutdown(): Promise<void>`
Gracefully shutdown the wrapper and close connections.

### Utility Methods

#### `isEnabled(): boolean`
Check if Langfuse integration is enabled.

#### `getActiveTraces(): string[]`
Get list of currently active trace IDs.

#### `getActiveSpans(): string[]`
Get list of currently active span IDs.

#### `getMemoryStats(): Record<string, any> | null`
Get statistics from the memory database.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a pull request

## License

MIT