# Langfuse Wrapper Implementation Plan

## Overview

This document outlines the implementation plan for enhancing the Langfuse wrapper with the new architecture interfaces designed for comprehensive swarm tracing.

## Implementation Phases

### Phase 1: Core Infrastructure Enhancement

#### 1.1 Update LangfuseWrapper Class
```typescript
// Extend the existing wrapper with new tracers
class LangfuseWrapper extends EventEmitter implements ILangfuseWrapper {
  // Existing properties
  private client: Langfuse | null = null;
  private activeTraces: Map<string, LangfuseTraceClient> = new Map();
  private activeSpans: Map<string, any> = new Map();
  
  // New tracer instances
  public swarm: SwarmTracer;
  public hooks: HookTracer;
  public memory: MemoryTracer;
  public performance: PerformanceTracer;
  
  constructor(config?: LangfuseWrapperConfig) {
    super();
    // Initialize tracers
    this.swarm = new SwarmTracerImpl(this);
    this.hooks = new HookTracerImpl(this);
    this.memory = new MemoryTracerImpl(this);
    this.performance = new PerformanceTracerImpl(this);
  }
}
```

#### 1.2 Implement SwarmTracer
```typescript
class SwarmTracerImpl implements SwarmTracer {
  constructor(private wrapper: LangfuseWrapper) {}
  
  async startSwarmOperation(operation: SwarmOperation): Promise<string> {
    const context: HookContext = {
      hookType: 'swarm-operation',
      swarmId: operation.swarmId,
      metadata: {
        topology: operation.topology,
        strategy: operation.strategy,
        agentCount: operation.agentCount,
        ...operation.metadata
      }
    };
    
    return await this.wrapper.preHook(context) || '';
  }
  
  // Implement other methods...
}
```

### Phase 2: SQLite Integration Enhancement

#### 2.1 Create Database Schema
```sql
-- Swarm operations table
CREATE TABLE swarm_operations (
  id TEXT PRIMARY KEY,
  swarm_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  topology TEXT,
  agent_count INTEGER,
  strategy TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status TEXT,
  metadata JSON
);

-- Agent operations table
CREATE TABLE agent_operations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  swarm_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  operation_type TEXT,
  task_id TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  token_usage JSON,
  metadata JSON
);

-- Coordination events table
CREATE TABLE coordination_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source_agent_id TEXT,
  target_agent_id TEXT,
  swarm_id TEXT,
  payload JSON,
  timestamp TIMESTAMP
);

-- Performance metrics table
CREATE TABLE performance_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,
  name TEXT NOT NULL,
  value REAL,
  unit TEXT,
  swarm_id TEXT,
  agent_id TEXT,
  timestamp TIMESTAMP,
  tags JSON
);
```

#### 2.2 Implement Database Access Layer
```typescript
class SwarmDatabase {
  private db: Database;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }
  
  async storeSwarmOperation(operation: SwarmOperation, traceId: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO swarm_operations 
      (id, swarm_id, trace_id, topology, agent_count, strategy, start_time, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      generateId(),
      operation.swarmId,
      traceId,
      operation.topology,
      operation.agentCount,
      operation.strategy,
      operation.startTime,
      JSON.stringify(operation.metadata)
    );
  }
  
  // Other database methods...
}
```

### Phase 3: Hook Enhancement Implementation

#### 3.1 Enhanced Hook Registration
```typescript
class HookRegistrar {
  private originalHooks: Map<string, Function> = new Map();
  
  registerAllHooks(wrapper: LangfuseWrapper): void {
    const hookTypes = [
      'pre-task', 'post-task',
      'pre-edit', 'post-edit',
      'pre-bash', 'post-bash',
      'notification', 'pre-search',
      'session-start', 'session-end'
    ];
    
    hookTypes.forEach(hookType => {
      this.enhanceHook(hookType, wrapper);
    });
  }
  
  private enhanceHook(hookType: string, wrapper: LangfuseWrapper): void {
    // Store original hook if exists
    const originalHook = global.claudeFlowHooks?.[hookType];
    if (originalHook) {
      this.originalHooks.set(hookType, originalHook);
    }
    
    // Replace with enhanced version
    global.claudeFlowHooks[hookType] = async (...args: any[]) => {
      const traceId = await wrapper.hooks.startHookExecution({
        hookType,
        hookStage: 'pre',
        executionId: generateId(),
        startTime: new Date(),
        ...extractContextFromArgs(args)
      });
      
      try {
        const result = originalHook ? await originalHook(...args) : null;
        
        await wrapper.hooks.endHookExecution(traceId, {
          success: true,
          data: result,
          duration: Date.now() - startTime,
          tokenUsage: estimateTokens(args, result)
        });
        
        return result;
      } catch (error) {
        await wrapper.hooks.endHookExecution(traceId, {
          success: false,
          error,
          duration: Date.now() - startTime
        });
        throw error;
      }
    };
  }
}
```

### Phase 4: Memory Tracing Implementation

#### 4.1 Memory Operation Interceptor
```typescript
class MemoryInterceptor {
  constructor(private tracer: MemoryTracer) {}
  
  interceptMemoryStore(originalStore: Function): Function {
    return async (key: string, value: any, namespace: string, metadata?: any) => {
      const operation: MemoryOperation = {
        operationType: 'store',
        key,
        namespace,
        timestamp: new Date(),
        metadata: {
          valueSize: JSON.stringify(value).length,
          ...metadata
        }
      };
      
      await this.tracer.traceMemoryOperation(operation);
      
      // Call original store
      const result = await originalStore(key, value, namespace, metadata);
      
      // Record access pattern
      await this.tracer.recordAccessPattern({
        agentId: metadata?.agentId || 'unknown',
        accessCount: 1,
        writeCount: 1,
        readCount: 0,
        namespaces: [namespace],
        avgAccessTime: 0,
        hotKeys: [key],
        timestamp: new Date()
      });
      
      return result;
    };
  }
  
  // Similar interceptors for retrieve, search, delete, list...
}
```

### Phase 5: Performance Monitoring Implementation

#### 5.1 Real-time Performance Collector
```typescript
class PerformanceCollector {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  
  constructor(private tracer: PerformanceTracer) {
    this.startCollection();
  }
  
  private startCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
      this.checkAlerts();
      this.analyzeBottlenecks();
    }, 5000); // Every 5 seconds
  }
  
  private async collectSystemMetrics(): Promise<void> {
    // Collect from various sources
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    // Record metrics
    await this.tracer.recordMetric({
      metricType: 'resource',
      name: 'cpu_usage',
      value: cpuUsage.user + cpuUsage.system,
      unit: 'microseconds',
      timestamp: new Date()
    });
    
    await this.tracer.recordMetric({
      metricType: 'resource',
      name: 'memory_usage',
      value: memUsage.heapUsed / 1024 / 1024,
      unit: 'MB',
      timestamp: new Date()
    });
  }
  
  private async checkAlerts(): Promise<void> {
    for (const [alertId, alert] of this.alerts) {
      const metrics = await this.getRecentMetrics(alert.metric);
      const currentValue = this.calculateAggregation(metrics, 'avg');
      
      if (this.evaluateCondition(currentValue, alert.threshold, alert.operator)) {
        alert.callback({
          metric: alert.metric,
          currentValue,
          threshold: alert.threshold
        });
      }
    }
  }
}
```

### Phase 6: Integration Testing

#### 6.1 Test Suite Structure
```typescript
describe('Langfuse Wrapper Enhanced', () => {
  describe('Swarm Tracing', () => {
    it('should trace swarm initialization', async () => {
      const wrapper = new LangfuseWrapper({ enabled: true });
      
      const traceId = await wrapper.swarm.startSwarmOperation({
        swarmId: 'test-swarm',
        topology: 'mesh',
        agentCount: 5,
        strategy: 'balanced',
        startTime: new Date()
      });
      
      expect(traceId).toBeDefined();
      expect(wrapper.getActiveTraceCount()).toBe(1);
    });
    
    it('should correlate agent operations within swarm', async () => {
      // Test agent operation correlation
    });
  });
  
  describe('Hook Tracing', () => {
    it('should automatically trace all registered hooks', async () => {
      // Test hook auto-registration
    });
  });
  
  describe('Memory Tracing', () => {
    it('should track memory access patterns', async () => {
      // Test memory pattern analysis
    });
  });
  
  describe('Performance Monitoring', () => {
    it('should detect and report bottlenecks', async () => {
      // Test bottleneck detection
    });
  });
});
```

## Deployment Strategy

### 1. Gradual Rollout
1. **Alpha**: Test with single swarm in development
2. **Beta**: Enable for specific agent types
3. **GA**: Full deployment with all features

### 2. Feature Flags
```typescript
const featureFlags = {
  enableSwarmTracing: process.env.ENABLE_SWARM_TRACING === 'true',
  enableMemoryTracing: process.env.ENABLE_MEMORY_TRACING === 'true',
  enablePerformanceAlerts: process.env.ENABLE_PERF_ALERTS === 'true',
  enableAutoHookRegistration: process.env.AUTO_REGISTER_HOOKS === 'true'
};
```

### 3. Monitoring Dashboard

Create Langfuse dashboard with:
- Swarm topology visualization
- Agent coordination flow
- Memory access heatmap
- Performance bottleneck indicators
- Token usage by agent role
- Cost optimization recommendations

## Performance Considerations

1. **Batching**: Aggregate metrics before sending
2. **Sampling**: Sample high-frequency operations
3. **Async Processing**: Never block main execution
4. **Circuit Breaker**: Disable tracing if errors exceed threshold
5. **Memory Limits**: Cap trace storage to prevent OOM

## Security Enhancements

1. **PII Filtering**: Redact sensitive data from traces
2. **Access Control**: Role-based access to traces
3. **Encryption**: Encrypt trace data at rest
4. **Audit Logging**: Track who views traces

## Migration Path

1. **v1 → v2**: Backward compatible, opt-in new features
2. **Configuration**: Environment variable overrides
3. **Data Migration**: Script to migrate existing traces
4. **Deprecation**: 6-month warning for removed features