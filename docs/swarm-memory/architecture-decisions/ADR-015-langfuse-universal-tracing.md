# ADR-015: Adopt Langfuse Hook for Universal Tracing

Date: 2025-07-13
Status: Accepted
Authors: Swarm Architecture Team

## Context

Our distributed swarm system requires comprehensive observability across multiple services, APIs, and LLM operations. We need a unified tracing solution that can:

1. Track API calls to external services (Fly.io, Supabase, etc.)
2. Monitor LLM token usage and costs
3. Trace distributed operations across swarm workers
4. Provide performance insights and bottleneck identification
5. Enable debugging of complex multi-step workflows

Current challenges:
- Fragmented logging across services
- No unified view of distributed operations
- Difficulty tracking LLM costs and performance
- Limited visibility into cross-service dependencies
- Manual correlation of logs for debugging

## Decision

We will adopt Langfuse as our universal tracing and observability platform, implementing it through a standardized hook system that all swarm components will use.

### Implementation Strategy

1. **Centralized Langfuse Service**
   - Single `LangfuseService` class managing all trace operations
   - Automatic batch processing and error handling
   - Cost calculation for LLM operations

2. **Specialized Tracers**
   - `LangfuseTracer` for API call tracing
   - `SwarmObservabilityHooks` for swarm lifecycle events
   - Decorator patterns for automatic method tracing

3. **Standardized Integration**
   - Environment-based configuration
   - Shared configuration service
   - Consistent span naming conventions

## Consequences

### Positive

1. **Unified Observability**
   - Single dashboard for all system operations
   - Correlated traces across services
   - End-to-end request tracking

2. **Cost Management**
   - Accurate LLM token tracking
   - Cost attribution by operation
   - Budget monitoring and alerts

3. **Performance Optimization**
   - Identify bottlenecks quickly
   - Track latency trends
   - Monitor resource utilization

4. **Improved Debugging**
   - Detailed error traces
   - Request replay capability
   - Root cause analysis tools

5. **Scalability**
   - Handles high-volume tracing
   - Configurable sampling rates
   - Efficient batch processing

### Negative

1. **Additional Dependency**
   - Requires Langfuse service availability
   - API key management overhead
   - Potential vendor lock-in

2. **Performance Overhead**
   - Small latency added to operations
   - Memory usage for trace buffering
   - Network calls for trace submission

3. **Learning Curve**
   - Team needs to learn Langfuse concepts
   - New debugging workflows
   - Dashboard navigation training

## Implementation Details

### 1. Shared Workspace Package Architecture

**Package Structure:**
```
shared/langfuse-wrapper/
├── src/
│   ├── index.ts                    # Main LangfuseWrapper class
│   ├── auto-register.ts            # Hook API auto-registration
│   ├── claude-flow-integration.ts  # Claude-Flow MCP integration
│   └── types.ts                    # TypeScript interfaces
├── tests/                          # >90% test coverage
│   ├── unit/                      # Jest unit tests with mocks
│   ├── integration/               # Claude-Flow integration tests
│   └── performance/               # High-throughput benchmarks
└── package.json                    # Workspace package config
```

**Core Implementation:**
```typescript
// Singleton wrapper with auto-registration
export const langfuseWrapper = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  host: process.env.LANGFUSE_HOST,
  enabled: process.env.ENABLE_TRACING !== 'false'
});

// Auto-registration with Claude-Flow hooks
export async function registerWithClaudeFlow(): Promise<void> {
  await claudeFlowHooks.registerPreHook(langfuseWrapper.preHook.bind(langfuseWrapper));
  await claudeFlowHooks.registerPostHook(langfuseWrapper.postHook.bind(langfuseWrapper));
  await claudeFlowHooks.registerErrorHook(langfuseWrapper.errorHook.bind(langfuseWrapper));
}
```

### 2. Zero-Code Integration via Hook API

**Automatic Hook Registration:**
```typescript
// Auto-registration happens during Claude-Flow initialization
// No manual integration required by agent code
const context: HookContext = {
  hookType: 'pre-task',
  swarmId: 'swarm-1752378045830',
  agentId: 'agent-researcher-abc123',
  agentRole: 'researcher',
  taskId: 'task-analyze-performance',
  operationType: 'analysis',
  metadata: { priority: 'high', estimated_tokens: 2500 }
};

// Automatically called by Claude-Flow hook system
const traceId = await langfuseWrapper.preHook(context);
```

**Enhanced Span Enrichment:**
```typescript
// Automatic metadata enrichment with swarm context
const enrichedMetadata = await enrichSpanWithMetadata({
  swarm_id: context.swarmId,
  agent_id: context.agentId,
  agent_role: context.agentRole,
  hook_stage: 'pre',
  coordination_memory: coordinationContext,
  token_usage: estimatedTokens,
  agent_multiplier: getAgentTokenMultiplier(agentRole),
  distributed_trace_id: generateDistributedTraceId(context)
});
```

**Memory Coordination Integration:**
```typescript
// Automatic storage in SQLite for cross-agent coordination
await storeTraceInMemory(swarmId, agentId, {
  timestamp: Date.now(),
  traceActive: true,
  langfuseTraceId: traceId
});
```

### 3. Configuration Standards

**Environment Variables:**
```env
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
ENABLE_TRACING=true                    # Defaults to true
CLAUDE_FLOW_VERSION=2.0.0
```

**Hook Operation Naming:**
```
{hookType}-{swarmId}-{agentRole}
Examples:
- pre-task-swarm-1752378045830-researcher
- post-edit-swarm-1752378045830-coder
- error-task-swarm-1752378045830-analyst
```

### 4. Performance Considerations & Graceful Degradation

**High-Performance Features:**
- Batch size: 20 events (configurable via `flushAt`)
- Flush interval: 10 seconds (configurable via `flushInterval`)
- Async trace submission to avoid blocking operations
- Agent-specific token multipliers for accurate cost calculation
- Performance monitoring with latency tracking

**Graceful Degradation:**
```typescript
// No breaking changes if Langfuse unavailable
if (!this.enabled || !this.client) {
  return null; // Operation continues normally
}

// Fallback metadata on enrichment errors
catch (error) {
  return {
    ...baseMetadata,
    enrichment_error: true,
    graceful_degradation: true,
    fallback_mode: true
  };
}
```

**>90% Test Coverage:**
- Jest unit tests with mocked Langfuse client
- Integration tests with Claude-Flow hooks
- Performance benchmarks for high-throughput scenarios
- Error scenario testing with graceful degradation

## Monitoring Strategy

1. **Key Metrics to Track:**
   - Request latency (p50, p95, p99)
   - Error rates by service
   - LLM token usage and costs
   - API call success rates
   - Worker utilization

2. **Alerting Rules:**
   - Latency exceeds thresholds
   - Error rate spikes
   - Cost overruns
   - Service unavailability

3. **Dashboards:**
   - Service health overview
   - Cost analysis
   - Performance trends
   - Error diagnostics

## Implementation Status

### ✅ Completed (2025-07-13)

1. **Phase 1: Shared Workspace Package** 
   - ✅ Created `@swarm/langfuse-wrapper` package
   - ✅ Implemented `LangfuseWrapper` class with hook integration
   - ✅ Added auto-registration with Claude-Flow hook API
   - ✅ Comprehensive span enrichment with swarm metadata

2. **Phase 2: Testing & Quality Assurance**
   - ✅ >90% test coverage with Jest unit tests
   - ✅ Mocked Langfuse client for reliable testing
   - ✅ Integration tests with Claude-Flow hooks
   - ✅ Performance benchmarks for high-throughput scenarios
   - ✅ Error scenario testing with graceful degradation

3. **Phase 3: Zero-Breaking-Change Integration**
   - ✅ Hook API auto-registration during initialization
   - ✅ Graceful degradation when Langfuse unavailable
   - ✅ Memory coordination with SQLite storage
   - ✅ Agent-specific token multipliers and cost estimation

### 🔄 Next Steps

1. **Phase 4: Production Deployment**
   - Enable in production swarms
   - Configure environment variables
   - Monitor dashboard creation

2. **Phase 5: Team Training**
   - Dashboard navigation training
   - Troubleshooting procedure documentation
   - Cost optimization workflows

## Security Considerations

1. **API Key Management:**
   - Store in secure environment variables
   - Rotate keys monthly
   - Use separate keys for environments

2. **Data Privacy:**
   - Never log sensitive user data
   - Implement PII redaction
   - Configure data retention policies

3. **Access Control:**
   - Role-based dashboard access
   - Audit log viewing
   - Compliance with data regulations

## Alternatives Considered

1. **OpenTelemetry + Jaeger**
   - ❌ More complex setup and configuration
   - ❌ Less LLM-specific features (no token tracking)
   - ❌ Higher operational overhead
   - ❌ No built-in cost calculation for LLM operations

2. **DataDog APM**
   - ❌ Higher cost ($15-31/host/month)
   - ❌ Less specialized for LLM workloads
   - ❌ More general-purpose (less swarm-specific features)
   - ❌ Complex integration with custom hook systems

3. **Custom Solution**
   - ❌ High development effort (estimated 3-4 weeks)
   - ❌ Ongoing maintenance burden
   - ❌ Limited features compared to specialized tools
   - ❌ No existing ecosystem or community support

4. **Manual Integration per Service**
   - ❌ Code changes required in every agent
   - ❌ Inconsistent implementation across services
   - ❌ High maintenance overhead
   - ❌ Breaking changes during integration

**Why Langfuse with Auto-Registration Won:**
- ✅ Zero breaking changes to existing agent code
- ✅ LLM-specialized features (token tracking, cost calculation)
- ✅ Hook API enables universal adoption without manual integration
- ✅ Comprehensive swarm metadata enrichment
- ✅ Graceful degradation when service unavailable
- ✅ >90% test coverage ensures reliability
- ✅ Cost-effective for LLM-heavy workloads

## References

- [Langfuse Documentation](https://langfuse.com/docs)
- [Langfuse API Reference](https://langfuse.com/docs/api)
- [Implementation Package](../../shared/langfuse-wrapper/) - `@swarm/langfuse-wrapper`
- [Test Coverage Report](../../shared/langfuse-wrapper/tests/)
- [Claude-Flow Hook Integration](../../shared/langfuse-wrapper/src/claude-flow-integration.ts)

## Review History

- 2025-07-13: Initial draft created
- 2025-07-13: Accepted by Architecture Team  
- 2025-07-13: Updated with implemented solution details:
  - Added shared workspace package structure
  - Documented auto-registration hook API
  - Updated with >90% test coverage
  - Added graceful degradation details
  - Documented agent-specific token multipliers
  - Added SQLite memory coordination integration