# Langfuse Swarm Integration Architecture

## Overview

The Langfuse wrapper provides comprehensive observability for the Claude Flow swarm system, automatically tracing all agent operations, hook executions, and inter-agent coordination.

## Architecture Components

### 1. Core Wrapper (`LangfuseWrapper`)

The main wrapper class that handles all Langfuse operations:

```typescript
class LangfuseWrapper extends EventEmitter {
  // Core functionality
  - preHook(): Start traces with enriched metadata
  - postHook(): Complete traces with results and token usage
  - errorHook(): Record failures with context
  - createSpan(): Create nested spans for operations
  - endSpan(): Complete custom spans
  
  // Enhanced features
  - enrichSpanWithMetadata(): Add swarm-specific context
  - extractAgentContext(): Identify agent/swarm from hook data
  - estimateTokensFromContext(): Calculate token usage
  - getCoordinationContext(): Query SQLite memory
  - storeTraceInMemory(): Persist trace IDs for coordination
}
```

### 2. Hook Enhancer (`hook-enhancer.ts`)

Automatically wraps Claude Flow hooks with tracing:

```typescript
interface EnhancedHookOptions {
  enableTracing?: boolean;
  traceMetadata?: Record<string, any>;
  estimateTokens?: boolean;
}

// Enhances any hook function with automatic tracing
function enhanceHook<T>(hookName: string, hookFn: T, options: EnhancedHookOptions): T

// Pre-configured traced hook wrappers
const tracedHooks = {
  preTask, postTask, preEdit, postEdit, 
  notification, preSearch, sessionStart, sessionEnd
}
```

### 3. Claude Flow Integration (`claude-flow-integration.ts`)

Deep integration with Claude Flow's hook system:

```typescript
class ClaudeFlowLangfuseIntegration {
  // Wraps the Claude Flow hook manager
  registerWithClaudeFlow(hookManager: ClaudeFlowHookManager): void
  
  // Hook-specific handlers
  createHookHandlers(): {
    'pre-task': (options) => wrapPreTaskHook(options)
    'post-task': (options) => wrapPostTaskHook(options)
    'pre-edit': (options) => wrapPreEditHook(options)
    'post-edit': (options) => wrapPostEditHook(options)
    'notification': (options) => wrapNotificationHook(options)
    'pre-search': (options) => wrapPreSearchHook(options)
    'session-start': (options) => wrapSessionStartHook(options)
    'session-end': (options) => wrapSessionEndHook(options)
    'session-restore': (options) => wrapSessionRestoreHook(options)
  }
}
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Flow Swarm System                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Agent 1   │  │   Agent 2   │  │   Agent 3   │             │
│  │ (Researcher)│  │  (Coder)    │  │  (Analyst)  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                 │                 │                    │
│         └─────────────────┴─────────────────┘                   │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  Claude Flow Hooks                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │ pre-task │ │post-task │ │ pre-edit │ │post-edit │  │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │    │
│  │       │            │            │            │          │    │
│  └───────┴────────────┴────────────┴────────────┴─────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Langfuse Wrapper Layer                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐             │    │
│  │  │ Hook Enhancer   │  │ Trace Enricher  │             │    │
│  │  └────────┬────────┘  └────────┬────────┘             │    │
│  │           │                     │                       │    │
│  │           ▼                     ▼                       │    │
│  │  ┌─────────────────────────────────────────┐          │    │
│  │  │         Metadata Enrichment              │          │    │
│  │  │  - Swarm ID extraction                   │          │    │
│  │  │  - Agent role identification             │          │    │
│  │  │  - Token usage estimation                │          │    │
│  │  │  - Coordination context from SQLite      │          │    │
│  │  └─────────────────────────────────────────┘          │    │
│  └────────────────────────┬───────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  SQLite Memory Store                    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │    │
│  │  │ Trace IDs   │  │Agent States │  │Coordination │   │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │    │
│  └────────────────────────┬───────────────────────────────┘    │
│                           │                                      │
└───────────────────────────┴──────────────────────────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────┐
        │         Langfuse Cloud              │
        │  - Distributed trace aggregation    │
        │  - Cross-agent coordination view    │
        │  - Token usage analytics           │
        │  - Performance dashboards           │
        └─────────────────────────────────────┘
```

## Key Integration Points

### 1. Automatic Agent Context Extraction

The wrapper automatically extracts agent context from multiple sources:

```typescript
private extractAgentContext(hookOptions?: any): {
  swarmId: string | null;
  agentId: string | null;
  agentRole: string | null;
  hookStage: string | null;
}
```

Sources checked (in order):
1. Direct properties: `swarmId`, `agentId`, `agentRole`
2. Task context: `taskContext.swarmId`, etc.
3. Metadata: `metadata.swarmId`, etc.
4. Environment variables: `SWARM_ID`, `AGENT_ID`
5. Auto-generation based on patterns

### 2. Token Usage Tracking

Enhanced token tracking with agent-specific multipliers:

```typescript
const agentMultipliers = {
  'researcher': 1.2,  // Complex text analysis
  'coder': 1.4,       // Code is token-dense
  'analyst': 1.1,     // Moderate complexity
  'tester': 1.3,      // Test code and reports
  'coordinator': 1.0, // Basic coordination
  'architect': 1.5    // Complex designs
}
```

### 3. SQLite Coordination

The wrapper integrates with the swarm's SQLite memory store:

```typescript
// Store trace IDs for cross-agent coordination
await storeTraceInMemory(swarmId, agentId);

// Query active agents in swarm
const activeAgents = await getActiveAgentCount(swarmId);

// Check coordination state
const coordinationContext = await getCoordinationContext(swarmId, agentId);
```

### 4. Performance Tracking

Efficiency scoring based on tokens and latency:

```typescript
calculateEfficiencyScore(tokenData, latencyMs): number {
  // Higher score for more tokens per millisecond
  const tokensPerMs = tokenData.usage.total / latencyMs;
  // Normalize to 0-100 scale
  return Math.min(100, (tokensPerMs / 10) * 100);
}
```

## Swarm-Specific Features

### 1. Distributed Trace IDs

Each trace includes a distributed ID for correlation:
```
Format: {swarmId}-{agentId}-{timestamp}
Example: swarm-abc123-researcher-xyz789-1705123456789
```

### 2. Coordination Memory Integration

Traces are stored in SQLite for cross-agent visibility:
```sql
-- Key format for trace storage
langfuse/trace/{swarmId}/{agentId}

-- Enables queries like:
-- "Show all traces for swarm X"
-- "Find traces from agent Y in the last hour"
-- "Correlate traces across multiple agents"
```

### 3. Graceful Degradation

The wrapper includes multiple fallback mechanisms:
- If Langfuse is unavailable: Operations continue without tracing
- If token estimation fails: Basic character-based estimation
- If SQLite is unavailable: Standalone tracing continues
- If agent context missing: Auto-generation from patterns

### 4. Hook-Specific Enhancements

Each hook type has custom metadata enrichment:

**pre-task**: Task description, auto-spawn settings, context loading
**post-task**: Performance analysis, summary generation
**pre-edit**: File path, agent assignment
**post-edit**: Format status, memory storage
**notification**: Message category, telemetry flags
**pre-search**: Query, cache settings, optimization suggestions
**session-start/end**: Session management, metric export

## Usage Examples

### 1. Basic Integration

```typescript
import { langfuseWrapper } from '@swarm/langfuse-wrapper';

// Initialize with config
const wrapper = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  enabled: true
});
```

### 2. Hook Enhancement

```typescript
import { enhanceHook } from '@swarm/langfuse-wrapper';

// Enhance a custom hook
const tracedHook = enhanceHook('custom-operation', async (options) => {
  // Your hook logic
  return result;
}, {
  enableTracing: true,
  estimateTokens: true,
  traceMetadata: { category: 'custom' }
});
```

### 3. Manual Tracing

```typescript
// Start a trace
const context: HookContext = {
  hookType: 'manual-operation',
  swarmId: 'swarm-123',
  agentId: 'agent-456',
  agentRole: 'researcher'
};

const traceId = await langfuseWrapper.preHook(context);

try {
  // Your operation
  const result = await performOperation();
  
  // Complete trace
  await langfuseWrapper.postHook(traceId, result, tokenUsage);
} catch (error) {
  // Record error
  await langfuseWrapper.errorHook(traceId, error);
}
```

## Performance Considerations

1. **Async Operations**: All tracing is async to avoid blocking
2. **Batching**: Traces are batched (default: 20 traces or 10s)
3. **Memory Efficiency**: Active traces are cleaned up on completion
4. **SQLite Queries**: Optimized for minimal overhead
5. **Token Estimation**: Simple character-based fallback available

## Security Considerations

1. **Credentials**: Never logged, stored securely
2. **PII Filtering**: Implement filters for sensitive data
3. **Error Messages**: Sanitized before sending
4. **Environment Isolation**: Separate configs per environment

## Future Enhancements

1. **Real-time Dashboards**: WebSocket integration for live views
2. **Custom Metrics**: Agent-specific performance indicators
3. **ML Insights**: Pattern detection across swarm operations
4. **Cost Optimization**: Recommendations based on usage patterns
5. **Distributed Tracing**: Full OpenTelemetry compatibility