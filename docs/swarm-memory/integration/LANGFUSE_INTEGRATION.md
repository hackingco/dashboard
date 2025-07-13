# Langfuse Integration Guide

## 🚀 Quick Start

Langfuse provides unified observability for all swarm operations, tracking API calls, LLM interactions, and performance metrics across your distributed system.

### Installation

```bash
npm install langfuse @swarm/shared-config
```

### Basic Setup

1. **Environment Configuration**

Add to your `.env` file:

```env
# Langfuse Configuration
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LANGFUSE_HOST=https://cloud.langfuse.com  # or your self-hosted instance

# Optional: Enable/disable tracing
ENABLE_TRACING=true
```

2. **Initialize in Your Application**

```typescript
import { langfuseService } from '@swarm/langfuse';
import { ConfigurationService } from '@swarm/shared-config';

// Get configuration
const config = ConfigurationService.getInstance();
const { langfuse } = config.observability;

// Initialize Langfuse
if (langfuse.publicKey && langfuse.secretKey) {
  langfuseService.initialize({
    publicKey: langfuse.publicKey,
    secretKey: langfuse.secretKey,
    host: langfuse.host || 'https://cloud.langfuse.com',
    flushAt: 20,        // Batch size for sending events
    flushInterval: 10000 // Batch interval in ms
  });
}
```

## 📋 Copy-Paste Examples

### Example 1: Trace API Calls

```typescript
import { langfuseTracer } from '@swarm/langfuse/utils';

// Trace any async API call
async function fetchUserData(userId: string) {
  return langfuseTracer.traceApiCall(
    {
      spanName: 'api.user.fetch',
      tags: {
        endpoint: `/users/${userId}`,
        app_name: 'user-service',
        user_id: userId
      }
    },
    async () => {
      // Your actual API call here
      const response = await fetch(`/api/users/${userId}`);
      return response.json();
    }
  );
}
```

### Example 2: Track LLM Operations

```typescript
import { langfuseService } from '@swarm/langfuse';

async function generateResponse(prompt: string) {
  const traceId = langfuseService.startTrace('LLM.Generation', {
    model: 'gpt-4',
    feature: 'chat-completion'
  });

  try {
    const startTime = performance.now();
    
    // Your LLM call
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    });

    const latency = performance.now() - startTime;

    // Track the generation
    await langfuseService.trackGeneration(
      traceId,
      'gpt-4',
      prompt,
      response.choices[0].message.content,
      {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens
      },
      latency,
      {
        temperature: 0.7,
        max_tokens: 1000
      }
    );

    await langfuseService.endTrace(traceId, { status: 'success' });
    return response;
  } catch (error) {
    await langfuseService.trackError(traceId, error);
    await langfuseService.endTrace(traceId, { status: 'error' });
    throw error;
  }
}
```

### Example 3: Swarm Operation Tracking

```typescript
import { swarmHooks } from '@swarm/langfuse/observability/hooks';

// Track swarm lifecycle
async function deploySwarm(swarmConfig: SwarmConfig) {
  const operationId = `deploy-${Date.now()}`;
  
  // Start tracking
  swarmHooks.onSwarmOperationStart(operationId, 'deploy', {
    swarmName: swarmConfig.name,
    workerCount: swarmConfig.workers.length
  });

  try {
    // Create swarm
    const swarmId = await createSwarm(swarmConfig);
    await swarmHooks.onSwarmCreated(swarmId, swarmConfig.name, swarmConfig);

    // Assign workers
    for (const worker of swarmConfig.workers) {
      const workerId = await assignWorker(swarmId, worker);
      await swarmHooks.onWorkerAssigned(swarmId, workerId, worker);
    }

    // Complete tracking
    await swarmHooks.onSwarmOperationComplete(operationId, true, {
      swarmId,
      duration: performance.now() - startTime
    });

    return swarmId;
  } catch (error) {
    await swarmHooks.onSwarmOperationComplete(operationId, false, null, error);
    throw error;
  }
}
```

### Example 4: Task Execution Monitoring

```typescript
import { swarmHooks } from '@swarm/langfuse/observability/hooks';

async function executeTask(task: Task, workerId: string) {
  const startTime = performance.now();
  
  // Track task creation
  await swarmHooks.onTaskCreated(task.id, task.type, task.dependencies);
  
  // Track execution start
  await swarmHooks.onTaskExecutionStart(task.id, workerId, task.input);

  try {
    const result = await task.execute();
    const duration = performance.now() - startTime;

    // Track completion
    await swarmHooks.onTaskExecutionComplete(
      task.id,
      workerId,
      task.input,
      result,
      duration
    );

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    await swarmHooks.onTaskExecutionComplete(
      task.id,
      workerId,
      task.input,
      null,
      duration,
      error
    );
    
    throw error;
  }
}
```

## 🔧 Advanced Configuration

### Custom Trace Metadata

```typescript
// Add custom metadata to traces
const traceId = langfuseService.startTrace('CustomOperation', {
  environment: process.env.NODE_ENV,
  version: process.env.APP_VERSION,
  region: process.env.DEPLOYMENT_REGION,
  customField: 'any-value'
});
```

### Batch Configuration

```typescript
langfuseService.initialize({
  publicKey: 'pk-lf-xxx',
  secretKey: 'sk-lf-xxx',
  host: 'https://cloud.langfuse.com',
  
  // Performance tuning
  flushAt: 50,          // Send batch when 50 events accumulate
  flushInterval: 5000,  // Or every 5 seconds
  
  // Network configuration
  requestTimeout: 30000, // 30 second timeout
  maxRetries: 3         // Retry failed requests
});
```

### Filtering and Sampling

```typescript
// Only trace in production
if (process.env.NODE_ENV === 'production') {
  langfuseService.initialize(config);
}

// Sample traces (e.g., 10% of requests)
if (Math.random() < 0.1) {
  const traceId = langfuseService.startTrace('SampledOperation');
  // ... perform operation
}
```

## 📊 Monitoring Best Practices

### 1. Structured Span Naming

Use consistent naming conventions:
```
service.resource.action
```

Examples:
- `fly.api.machine.create`
- `swarm.worker.assign`
- `llm.gpt4.completion`
- `database.user.query`

### 2. Essential Tags

Always include these tags for better filtering:

```typescript
{
  // Service identification
  service: 'user-service',
  version: '1.2.3',
  environment: 'production',
  
  // Request context
  user_id: 'user-123',
  tenant_id: 'tenant-456',
  request_id: 'req-789',
  
  // Performance
  region: 'us-east-1',
  instance_id: 'i-abc123'
}
```

### 3. Error Tracking

Comprehensive error tracking:

```typescript
try {
  // Operation
} catch (error) {
  await langfuseService.trackError(traceId, error, {
    error_type: error.constructor.name,
    error_code: error.code,
    stack_trace: error.stack,
    user_impact: 'high',
    recovery_action: 'retry'
  });
}
```

### 4. Performance Metrics

Track key performance indicators:

```typescript
// After operation
await langfuseService.endTrace(traceId, {
  status: 'success',
  latency_ms: latency,
  
  // Custom metrics
  items_processed: 100,
  cache_hit_rate: 0.85,
  memory_used_mb: 256,
  cpu_usage_percent: 45
});
```

## 🛠️ Troubleshooting

### Debug Mode

Enable detailed logging:

```typescript
// Set environment variable
process.env.LANGFUSE_DEBUG = 'true';

// Or in code
langfuseService.setDebugMode(true);
```

### Common Issues

1. **Missing Traces**
   - Check API keys are correctly set
   - Verify network connectivity to Langfuse host
   - Ensure `flushAsync()` is called before shutdown

2. **High Memory Usage**
   - Reduce `flushAt` batch size
   - Decrease `flushInterval`
   - Implement trace sampling

3. **Slow Performance**
   - Use async methods (`trackGenerationAsync`)
   - Batch operations when possible
   - Consider local Langfuse deployment

### Verification Script

```typescript
// verify-langfuse.ts
import { langfuseService } from '@swarm/langfuse';

async function verifyConnection() {
  console.log('Testing Langfuse connection...');
  
  const traceId = langfuseService.startTrace('ConnectionTest');
  
  await langfuseService.trackGeneration(
    traceId,
    'test-model',
    'test prompt',
    'test response',
    { input: 10, output: 20 },
    100
  );
  
  await langfuseService.endTrace(traceId);
  await langfuseService.shutdown();
  
  console.log('✅ Langfuse connection successful!');
}

verifyConnection().catch(console.error);
```

## 🔍 Viewing Traces

1. **Langfuse Dashboard**: Navigate to your Langfuse instance
2. **Filter by**:
   - Service name
   - Time range
   - Status (success/error)
   - Custom tags

3. **Analyze**:
   - Request latency distribution
   - Token usage trends
   - Error rates
   - Cost analysis

## 📈 Performance Considerations

### Memory Management

```typescript
// Clean up old traces periodically
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 3600000);
  langfuseService.cleanupTraces(oneHourAgo);
}, 3600000); // Every hour
```

### Batching Strategies

```typescript
// For high-throughput services
langfuseService.initialize({
  flushAt: 100,        // Larger batches
  flushInterval: 2000  // More frequent sends
});

// For low-throughput services
langfuseService.initialize({
  flushAt: 10,         // Smaller batches
  flushInterval: 30000 // Less frequent sends
});
```

### Network Optimization

```typescript
// Use local Langfuse instance for development
const langfuseHost = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3000'
  : 'https://cloud.langfuse.com';
```

## 🔐 Security Best Practices

1. **Never log sensitive data**:
   ```typescript
   // Bad
   prompt: creditCardNumber
   
   // Good
   prompt: '[REDACTED_CREDIT_CARD]'
   ```

2. **Use environment variables** for API keys
3. **Implement access controls** on Langfuse dashboard
4. **Regular key rotation** (monthly recommended)

## 📚 Additional Resources

- [Langfuse Documentation](https://langfuse.com/docs)
- [API Reference](https://langfuse.com/docs/api)
- [Self-hosting Guide](https://langfuse.com/docs/deployment/self-host)
- [Swarm Integration Examples](./examples/)

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/swarm/issues)
- **Discord**: [Join our community](https://discord.gg/swarm)
- **Email**: support@swarm.dev