# Langfuse Wrapper Integration Guide

## Overview

The Langfuse wrapper provides comprehensive observability for Claude Flow swarm operations with automatic tracing, distributed context propagation, and intelligent error handling.

## Quick Start

```typescript
import { initializeLangfuse } from '@swarm/langfuse-wrapper';

// Initialize with configuration
const langfuse = await initializeLangfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  enabled: true,
  swarmTracingEnabled: true
});

// Use the wrapper
const { wrapper, swarmTracer } = langfuse;
```

## Core Components

### 1. LangfuseWrapper
The main wrapper providing basic tracing capabilities:
- `preHook()` - Start a trace
- `postHook()` - Complete a trace with results
- `errorHook()` - Record errors
- `createSpan()` / `endSpan()` - Create custom spans

### 2. SwarmTracer
Specialized tracer for swarm operations:
- `startSwarmTrace()` - Initialize swarm tracing
- `traceAgentSpawn()` - Track agent creation
- `traceTaskAssignment()` - Monitor task distribution
- `traceAgentCommunication()` - Record inter-agent messages
- `traceTaskCompletion()` - Track task results
- `completeSwarmTrace()` - Finalize swarm operation

### 3. TraceContextManager
Distributed trace context propagation:
- `createContext()` - Create trace context
- `getCurrentContext()` - Get active context
- `inject()` / `extract()` - Context propagation headers
- `setBaggage()` / `getBaggage()` - Metadata propagation

### 4. ConfigManager
Centralized configuration management:
- Environment variable support
- Configuration file loading
- Sampling rules
- Feature flags

### 5. ErrorHandler
Intelligent error handling with retry logic:
- Exponential backoff
- Circuit breakers
- Graceful degradation
- Error statistics

## Configuration

### Environment Variables
```bash
# Required
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key

# Optional
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_ENABLED=true
LANGFUSE_DEBUG=false
LANGFUSE_SAMPLING_RATE=1.0
SWARM_TRACING_ENABLED=true
COORDINATION_MEMORY_ENABLED=true
```

### Configuration File
Create `.langfuse.json` in your project root:
```json
{
  "publicKey": "your_key",
  "secretKey": "your_secret",
  "samplingRules": [
    {
      "condition": "agentRole",
      "value": "coordinator",
      "rate": 1.0
    }
  ],
  "flushAt": 20,
  "flushInterval": 10000
}
```

## Integration Patterns

### 1. Basic Tracing
```typescript
const traceId = await wrapper.preHook({
  hookType: 'operation_name',
  swarmId: 'swarm-123',
  agentId: 'agent-456',
  agentRole: 'researcher'
});

// Do work...

await wrapper.postHook(
  traceId,
  { result: 'success' },
  { input: 100, output: 200 },
  { custom: 'metadata' }
);
```

### 2. Swarm Orchestration
```typescript
// Initialize swarm
await swarmTracer.startSwarmTrace(
  'swarm-123',
  'hierarchical',
  5
);

// Spawn agents
for (const agent of agents) {
  await swarmTracer.traceAgentSpawn({
    actionType: 'spawn',
    agentId: agent.id,
    agentRole: agent.role,
    swarmId: 'swarm-123',
    timestamp: Date.now()
  });
}

// Complete swarm
await swarmTracer.completeSwarmTrace('swarm-123', {
  status: 'completed',
  tasksCompleted: 10
});
```

### 3. Context Propagation
```typescript
// Create context
const context = contextManager.createContext(
  'swarm-123',
  'agent-456',
  'researcher'
);

// Add baggage
contextManager.setBaggage('agent-456', 'priority', 'high');

// Extract for HTTP headers
const headers = contextManager.inject(context);

// In receiving service
const receivedContext = contextManager.extract(headers);
```

### 4. Error Handling
```typescript
await errorHandler.executeWithRetry(
  async () => {
    // Operation that might fail
    return await riskyOperation();
  },
  'risky_operation',
  { swarmId: 'swarm-123' },
  { maxRetries: 5, initialDelay: 1000 }
);
```

## Best Practices

1. **Initialize Early**: Set up Langfuse at application startup
2. **Use Singleton**: Access via `getLangfuse()` for consistency
3. **Handle Errors**: Always wrap traces in try-catch blocks
4. **Set Context**: Provide swarmId and agentId for all operations
5. **Use Sampling**: Configure sampling rules for high-volume operations
6. **Monitor Metrics**: Regularly check swarm metrics and performance
7. **Graceful Shutdown**: Call `shutdown()` on application exit

## Troubleshooting

### Common Issues

1. **Traces not appearing**
   - Check credentials are correct
   - Verify `enabled: true` in config
   - Check network connectivity
   - Review sampling rate

2. **Memory leaks**
   - Ensure traces are completed
   - Call `shutdown()` on exit
   - Monitor active trace count

3. **Performance impact**
   - Adjust `flushAt` and `flushInterval`
   - Use sampling for high-frequency operations
   - Enable compression

### Debug Mode
```typescript
const langfuse = await initializeLangfuse({
  debug: true,
  gracefulDegradation: true
});
```

## Advanced Features

### Custom Sampling Rules
```typescript
{
  samplingRules: [
    {
      condition: 'custom',
      value: (context) => context.priority === 'critical',
      rate: 1.0 // Always sample critical operations
    }
  ]
}
```

### Circuit Breaker Configuration
```typescript
errorHandler.executeWithRetry(
  operation,
  'operation_name',
  context,
  {
    retryCondition: (error) => error.status !== 404,
    maxDelay: 60000
  }
);
```

### Performance Monitoring
```typescript
// Get error statistics
const stats = errorHandler.getStatistics();

// Check circuit breaker status
const breakerStatus = errorHandler.getCircuitBreakerStatus();

// Monitor active traces
const activeCount = wrapper.getActiveTraceCount();
```

## Migration Guide

If migrating from direct Langfuse usage:

1. Replace `new Langfuse()` with `initializeLangfuse()`
2. Update trace calls to use wrapper methods
3. Add swarm context to all operations
4. Implement error handling with retry logic
5. Set up configuration management

## Support

For issues or questions:
- Check the comprehensive example in `/examples`
- Review test files for usage patterns
- Enable debug mode for detailed logging
- Check SQLite memory database for stored traces