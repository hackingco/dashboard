# Langfuse Observability Integration

## 🎯 Overview

Langfuse provides comprehensive observability for the Fly Swarm Orchestrator, tracking all API operations, performance metrics, and cost analysis. Every Fly.io API call is automatically traced with detailed metadata.

## 🚀 Key Features

### Real-time Tracing
- **Automatic Tracing**: All Fly.io API calls wrapped with Langfuse spans
- **Performance Monitoring**: Latency tracking for every operation
- **Error Categorization**: Structured error logging with HTTP status codes
- **Cost Tracking**: Token usage estimation and API call costs

### Dashboard Integration
- **Live Metrics**: Real-time performance data in admin dashboard
- **Success Rates**: API call success/failure rates over time
- **Latency Trends**: P95/P99 latency tracking and alerting
- **Error Patterns**: Automated error pattern detection

## 🔧 Implementation

### Environment Configuration

```env
# Required Langfuse Configuration
LANGFUSE_SECRET_KEY=sk_lf_xxx...
LANGFUSE_PUBLIC_KEY=pk_lf_xxx...
LANGFUSE_HOST=https://cloud.langfuse.com

# Optional: Custom project settings
LANGFUSE_PROJECT_ID=your-project-id
LANGFUSE_DEBUG=true  # Enable debug logging
```

### Service Architecture

```typescript
// Core Langfuse service
export class LangfuseService {
  // Trace management
  startTrace(name: string, metadata?: any): string
  endTrace(traceId: string, output?: any, error?: Error): Promise<void>
  
  // Generation tracking (for LLM operations)
  trackGeneration(
    traceId: string,
    name: string,
    input: string,
    output: string,
    usage: TokenUsage,
    latency: number,
    metadata?: any
  ): Promise<void>
  
  // Span management
  startSpan(spanId: string, name: string, traceId?: string, metadata?: any): void
  endSpan(spanId: string, output?: any, error?: Error): void
}
```

### Automatic API Tracing

```typescript
// LangfuseTracer wrapper for Fly.io API calls
export class LangfuseTracer {
  async traceApiCall<T>(
    options: {
      spanName: string;
      tags: {
        endpoint: string;
        app_name?: string;
        [key: string]: any;
      };
    },
    apiCall: () => Promise<T>
  ): Promise<TracedResponse<T>> {
    const startTime = performance.now();
    const traceId = langfuseService.startTrace(options.spanName, options.tags);
    
    try {
      const result = await apiCall();
      const latency = performance.now() - startTime;
      
      // Track successful operation
      await langfuseService.trackGeneration(
        traceId,
        options.spanName,
        JSON.stringify(options.tags),
        JSON.stringify(result),
        { input: 50, output: 100 }, // Token estimates
        latency,
        {
          ...options.tags,
          http_status: 200,
          latency_ms: Math.round(latency),
          status: 'success'
        }
      );
      
      await langfuseService.endTrace(traceId, {
        status: 'success',
        latency_ms: Math.round(latency)
      });
      
      return { data: result, latency, traceId };
    } catch (error) {
      // Track errors with full context
      const latency = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const httpStatus = this.extractHttpStatus(errorMessage);
      
      await langfuseService.trackGeneration(
        traceId,
        options.spanName,
        JSON.stringify(options.tags),
        JSON.stringify({ error: errorMessage }),
        { input: 50, output: 50 },
        latency,
        {
          ...options.tags,
          http_status: httpStatus,
          latency_ms: Math.round(latency),
          status: 'error',
          error: errorMessage
        }
      );
      
      await langfuseService.endTrace(traceId, {
        status: 'error',
        error: errorMessage,
        http_status: httpStatus
      });
      
      throw error;
    }
  }
}
```

## 📊 Tracing Examples

### Machine Creation Tracing

```typescript
// Comprehensive machine creation with tracing
async createMachine(appName: string, config: any): Promise<any> {
  const correlationId = uuidv4();
  const traceId = langfuseService.startTrace(`create-machine-${appName}`, {
    app_name: appName,
    swarm_id: config.swarmId,
    correlation_id: correlationId
  });
  
  try {
    // Create machine via API with automatic tracing
    const machine = await this.flyApiRequest(
      'POST', 
      `/apps/${appName}/machines`, 
      machineConfig
    );
    
    // Track successful creation
    await langfuseService.trackGeneration(
      traceId,
      'fly-machine-create',
      JSON.stringify(machineConfig),
      JSON.stringify(machine),
      { input: 100, output: 50 },
      performance.now(),
      {
        machine_id: machine.id,
        app_name: appName,
        swarm_id: config.swarmId
      }
    );
    
    // Wait for machine readiness with traced health checks
    await this.waitForMachineReady(appName, machine.id);
    
    await langfuseService.endTrace(traceId, {
      status: 'success',
      machine_id: machine.id
    });
    
    return machine;
  } catch (error) {
    await langfuseService.endTrace(traceId, {
      status: 'error',
      error: (error as Error).message
    });
    throw error;
  }
}
```

### Health Check Monitoring

```typescript
async waitForMachineReady(appName: string, machineId: string): Promise<void> {
  const spanId = `wait-machine-${machineId}`;
  
  // Start span for waiting operation
  langfuseService.startSpan(spanId, 'Wait for Machine Ready', undefined, {
    app_name: appName,
    machine_id: machineId,
    max_attempts: 30
  });
  
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const machine = await this.getMachineMetadata(appName, machineId);
      
      if (machine.state === 'started' || machine.state === 'running') {
        const health = await this.checkMachineHealth(appName, machineId);
        if (health.status === 'passing') {
          // End span successfully
          langfuseService.endSpan(spanId, {
            status: 'ready',
            attempts: attempt + 1,
            total_wait_ms: (attempt + 1) * 2000
          });
          return;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      // Continue retrying but log the error
      logger.warn(`Health check attempt ${attempt + 1} failed`, { error });
    }
  }
  
  // End span with failure
  langfuseService.endSpan(spanId, undefined, 
    new Error(`Machine ${machineId} failed to become ready after 30 attempts`)
  );
  
  throw new Error(`Machine ${machineId} failed to become ready`);
}
```

## 📈 Performance Metrics

### Key Metrics Tracked

```typescript
interface PerformanceMetrics {
  // API Performance
  totalApiCalls: number;
  successRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  
  // Error Analysis
  errorRate: number;
  errorsByType: Record<string, number>;
  httpStatusCodes: Record<number, number>;
  
  // Cost Tracking
  totalTokenUsage: number;
  estimatedCost: number;
  costPerOperation: number;
  
  // Machine Operations
  machineCreationTime: number;
  machineReadinessTime: number;
  scalingOperationTime: number;
}
```

### Dashboard Integration

```typescript
// Real-time metrics for dashboard
export async function getPerformanceMetrics(timeWindow = '24h') {
  const metrics = await langfuseService.getPerformanceMetrics('fly.api', timeWindow);
  
  return {
    apiPerformance: {
      totalCalls: metrics.totalCalls,
      successRate: (metrics.successfulCalls / metrics.totalCalls) * 100,
      avgLatency: metrics.avgLatency,
      p95Latency: metrics.p95Latency
    },
    errorAnalysis: {
      errorRate: (metrics.errors / metrics.totalCalls) * 100,
      topErrors: metrics.errorsByMessage.slice(0, 5),
      httpErrors: metrics.httpStatusCodes
    },
    costTracking: {
      totalCost: metrics.estimatedCost,
      costPerOperation: metrics.estimatedCost / metrics.totalCalls,
      tokenUsage: metrics.totalTokens
    }
  };
}
```

## 🔍 Advanced Features

### Custom Span Management

```typescript
// Manual span creation for complex operations
async complexSwarmOperation(swarmId: string) {
  const traceId = langfuseService.startTrace('complex-swarm-operation', {
    swarm_id: swarmId,
    operation_type: 'multi-machine-scaling'
  });
  
  // Span for pre-scaling analysis
  langfuseService.startSpan('analyze-requirements', 'Analyze Scaling Requirements', traceId, {
    current_machines: await this.getMachineCount(swarmId)
  });
  
  const requirements = await this.analyzeScalingRequirements(swarmId);
  
  langfuseService.endSpan('analyze-requirements', {
    required_machines: requirements.targetCount,
    scaling_strategy: requirements.strategy
  });
  
  // Span for parallel machine creation
  langfuseService.startSpan('create-machines', 'Create Machines in Parallel', traceId);
  
  const machines = await Promise.all(
    requirements.machineConfigs.map(config => 
      this.createMachine(config.appName, config)
    )
  );
  
  langfuseService.endSpan('create-machines', {
    created_count: machines.length,
    machine_ids: machines.map(m => m.id)
  });
  
  await langfuseService.endTrace(traceId, {
    status: 'success',
    total_machines: machines.length,
    operation_duration_ms: performance.now()
  });
}
```

### Error Pattern Detection

```typescript
// Automatic error categorization
async categorizeError(error: Error, operation: string, metadata: any) {
  const errorCategory = this.classifyError(error.message);
  
  await langfuseService.trackGeneration(
    'error-analysis',
    'error-categorization',
    JSON.stringify({ error: error.message, operation, metadata }),
    JSON.stringify({ category: errorCategory, severity: this.getSeverity(error) }),
    { input: 30, output: 20 },
    0,
    {
      error_category: errorCategory,
      operation_type: operation,
      error_message: error.message,
      severity: this.getSeverity(error)
    }
  );
}

private classifyError(message: string): string {
  if (message.includes('401') || message.includes('unauthorized')) return 'authentication';
  if (message.includes('429') || message.includes('rate limit')) return 'rate_limiting';
  if (message.includes('500') || message.includes('internal server')) return 'server_error';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('network')) return 'network';
  return 'unknown';
}
```

## 🚨 Alerting & Monitoring

### Performance Thresholds

```typescript
const PERFORMANCE_THRESHOLDS = {
  maxLatency: 5000,      // 5 seconds
  minSuccessRate: 0.95,  // 95%
  maxErrorRate: 0.05,    // 5%
  maxCostPerHour: 10.00  // $10/hour
};

// Automatic alerting based on thresholds
async checkPerformanceThresholds() {
  const metrics = await this.getPerformanceMetrics('1h');
  
  const alerts = [];
  
  if (metrics.avgLatency > PERFORMANCE_THRESHOLDS.maxLatency) {
    alerts.push({
      type: 'high_latency',
      value: metrics.avgLatency,
      threshold: PERFORMANCE_THRESHOLDS.maxLatency
    });
  }
  
  if (metrics.successRate < PERFORMANCE_THRESHOLDS.minSuccessRate) {
    alerts.push({
      type: 'low_success_rate',
      value: metrics.successRate,
      threshold: PERFORMANCE_THRESHOLDS.minSuccessRate
    });
  }
  
  return alerts;
}
```

## 🔗 Integration Examples

### TrustGraph Integration

```typescript
// Combine Langfuse tracing with TrustGraph nodes
async createMachineWithTrustGraph(appName: string, config: any) {
  const traceId = langfuseService.startTrace('machine-with-trustgraph', {
    app_name: appName,
    swarm_id: config.swarmId
  });
  
  try {
    // Create machine (automatically traced)
    const machine = await this.createMachine(appName, config);
    
    // Create TrustGraph node for the machine
    await trustGraphService.createNode({
      id: `machine-${machine.id}`,
      type: 'machine',
      label: `Machine: ${machine.id}`,
      metadata: {
        app_name: appName,
        trace_id: traceId,  // Link to Langfuse trace
        machine_id: machine.id
      }
    });
    
    await langfuseService.endTrace(traceId, {
      status: 'success',
      machine_id: machine.id,
      trustgraph_node: `machine-${machine.id}`
    });
    
    return machine;
  } catch (error) {
    await langfuseService.endTrace(traceId, {
      status: 'error',
      error: error.message
    });
    throw error;
  }
}
```

### Supabase Real-time Integration

```typescript
// Real-time metrics updates via Supabase
async publishMetricsUpdate(metrics: PerformanceMetrics) {
  const updateData = {
    timestamp: new Date().toISOString(),
    metrics: metrics,
    trace_count: await langfuseService.getTraceCount('1h'),
    error_rate: metrics.errorRate
  };
  
  // Publish to Supabase real-time channel
  await supabase
    .channel('performance-metrics')
    .send({
      type: 'broadcast',
      event: 'metrics-update',
      payload: updateData
    });
}
```

## 🛠️ Development & Testing

### Local Development

```bash
# Start with Langfuse tracing enabled
LANGFUSE_SECRET_KEY=sk_lf_xxx LANGFUSE_DEBUG=true npm run dev

# View traces in Langfuse dashboard
open https://cloud.langfuse.com/project/your-project
```

### Testing with Mock Traces

```typescript
// Mock Langfuse for testing
jest.mock('../services/langfuse/langfuse.service', () => ({
  langfuseService: {
    startTrace: jest.fn().mockReturnValue('mock-trace-id'),
    endTrace: jest.fn().mockResolvedValue(undefined),
    trackGeneration: jest.fn().mockResolvedValue(undefined)
  }
}));

// Test traced operations
test('should trace machine creation', async () => {
  const machine = await flyService.createMachine('test-app', config);
  
  expect(langfuseService.startTrace).toHaveBeenCalledWith(
    'create-machine-test-app',
    expect.objectContaining({
      app_name: 'test-app',
      swarm_id: config.swarmId
    })
  );
  
  expect(langfuseService.endTrace).toHaveBeenCalledWith(
    'mock-trace-id',
    expect.objectContaining({
      status: 'success',
      machine_id: machine.id
    })
  );
});
```

## 📊 Cost Optimization

### Token Usage Tracking

```typescript
// Estimate and track token usage for API operations
function estimateTokenUsage(operation: string, payload: any): TokenUsage {
  const baseTokens = {
    'createApp': { input: 30, output: 20 },
    'createMachine': { input: 100, output: 50 },
    'listMachines': { input: 20, output: 30 },
    'scaleApp': { input: 40, output: 25 }
  };
  
  const base = baseTokens[operation] || { input: 50, output: 50 };
  
  // Adjust based on payload size
  const payloadSize = JSON.stringify(payload).length;
  const multiplier = Math.max(1, payloadSize / 1000);
  
  return {
    input: Math.round(base.input * multiplier),
    output: Math.round(base.output * multiplier)
  };
}
```

### Cost Analysis Dashboard

```typescript
// Generate cost analysis reports
async generateCostReport(timeRange: string) {
  const traces = await langfuseService.getTraces(timeRange);
  
  const analysis = {
    totalOperations: traces.length,
    totalTokens: traces.reduce((sum, trace) => sum + trace.tokenUsage, 0),
    operationCosts: {},
    recommendations: []
  };
  
  // Analyze cost by operation type
  const operationTypes = [...new Set(traces.map(t => t.name))];
  
  for (const operation of operationTypes) {
    const operationTraces = traces.filter(t => t.name === operation);
    const avgTokens = operationTraces.reduce((sum, t) => sum + t.tokenUsage, 0) / operationTraces.length;
    
    analysis.operationCosts[operation] = {
      count: operationTraces.length,
      avgTokens: Math.round(avgTokens),
      totalCost: (avgTokens * operationTraces.length * 0.002) // Estimate: $0.002 per 1k tokens
    };
  }
  
  // Generate cost optimization recommendations
  const highCostOps = Object.entries(analysis.operationCosts)
    .filter(([_, data]) => data.totalCost > 1.0)
    .sort((a, b) => b[1].totalCost - a[1].totalCost);
  
  if (highCostOps.length > 0) {
    analysis.recommendations.push(
      `Consider optimizing ${highCostOps[0][0]} operations (${highCostOps[0][1].totalCost.toFixed(2)} cost)`
    );
  }
  
  return analysis;
}
```

## 📚 Comprehensive Documentation

For detailed integration guides and API reference, see:

- **[Integration Guide](./docs/swarm-memory/integration/LANGFUSE_INTEGRATION.md)** - Quick start, examples, and best practices
- **[API Reference](./docs/swarm-memory/integration/LANGFUSE_API_REFERENCE.md)** - Complete API documentation
- **[Architecture Decision](./docs/swarm-memory/architecture-decisions/ADR-015-langfuse-universal-tracing.md)** - Design rationale and implementation strategy

---

**Langfuse Integration Status**: ✅ **Fully Operational** - Complete observability with automatic tracing, performance monitoring, and cost analysis across all Fly.io operations.