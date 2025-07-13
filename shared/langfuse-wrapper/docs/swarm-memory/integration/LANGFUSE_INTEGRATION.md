# Langfuse Integration for Claude Flow

## Overview

The Langfuse wrapper provides **universal observability** for all Claude Flow swarm operations through automatic tracing integration. This implementation enables comprehensive monitoring, performance analysis, and coordination tracking across distributed agent swarms with **zero configuration overhead** when environment variables are set.

### Key Features

- **Auto-registration**: Automatically enables when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are present
- **Comprehensive span enrichment**: Tracks swarm_id, agent_role, agent_id, hook_stage, and coordination context
- **Token estimation with agent multipliers**: Agent-specific token usage calculations for accurate cost tracking
- **Cross-agent coordination**: SQLite memory integration for distributed trace correlation
- **Performance monitoring**: 1000+ traces/second capability with graceful degradation
- **Graceful fallback**: Continues operation even when Langfuse is unavailable

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
export LANGFUSE_PUBLIC_KEY="pk_lf_..."
export LANGFUSE_SECRET_KEY="sk_lf_..."
export LANGFUSE_HOST="https://cloud.langfuse.com"  # Optional, defaults to cloud

# Optional: Enable Claude Flow integration
export CLAUDE_FLOW_ENABLED="true"
```

### 2. Installation

```bash
# Install the Langfuse wrapper
npm install @swarm/langfuse-wrapper

# Or use in external swarms
npm install langfuse better-sqlite3 winston
```

### 3. Basic Integration

```typescript
import { langfuseWrapper } from '@swarm/langfuse-wrapper';

// Auto-registration happens when environment variables are set
// No additional setup required

// Manual configuration (if needed)
import { LangfuseWrapper } from '@swarm/langfuse-wrapper';
const wrapper = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  enabled: true
});
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Yes | - | Langfuse public API key |
| `LANGFUSE_SECRET_KEY` | Yes | - | Langfuse secret API key |
| `LANGFUSE_HOST` | No | `https://cloud.langfuse.com` | Langfuse instance URL |
| `CLAUDE_FLOW_ENABLED` | No | `false` | Enable Claude Flow hooks integration |
| `NODE_ENV` | No | `development` | Environment for metadata enrichment |

### Configuration Object

```typescript
interface LangfuseWrapperConfig {
  publicKey?: string;          // Langfuse public key
  secretKey?: string;          // Langfuse secret key  
  host?: string;               // Langfuse host URL
  enabled?: boolean;           // Enable/disable tracing
  flushAt?: number;            // Batch size (default: 20)
  flushInterval?: number;      // Flush interval in ms (default: 10000)
}
```

## Features

### 1. Auto-Registration via Environment Variables

When `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set, the wrapper automatically:

- Initializes Langfuse client with optimal settings
- Registers with Claude Flow hook system
- Enables comprehensive span enrichment
- Sets up graceful error handling

```typescript
// Automatic initialization - no code changes needed
// Just set environment variables and start your swarm

// Check if auto-registered
import { langfuseWrapper } from '@swarm/langfuse-wrapper';
console.log('Langfuse enabled:', langfuseWrapper.isEnabled());
```

### 2. Comprehensive Span Enrichment

Every trace includes rich metadata for complete observability:

```typescript
// Automatic metadata included in every span
{
  // Swarm identification
  swarm_id: "swarm-1752378045830-7si2203xs",
  agent_id: "researcher-a82ewx",
  agent_role: "researcher",
  hook_stage: "pre" | "post" | "error",
  
  // Performance tracking
  latency_ms: 45,
  efficiency_score: 87.3,
  
  // Token usage with agent-specific multipliers
  token_usage: {
    input: 150,
    output: 75,
    total: 225
  },
  token_cost: 0.00345,
  agent_token_multiplier: 1.2,
  
  // Coordination context
  coordination_memory: {
    activeAgents: 5,
    coordinationState: "coordinated",
    lastActivity: "2025-07-13T03:56:22.121Z"
  },
  
  // Environment metadata
  timestamp: "2025-07-13T03:56:22.121Z",
  environment: "production",
  claude_flow_version: "2.0.0",
  swarm_coordination_enabled: true
}
```

### 3. Token Estimation with Agent Multipliers

The wrapper includes sophisticated token estimation with role-based multipliers:

```typescript
// Agent-specific token multipliers
const multipliers = {
  'researcher': 1.2,  // Research involves complex text analysis
  'coder': 1.4,       // Code is more token-dense
  'analyst': 1.1,     // Analysis moderate complexity
  'tester': 1.3,      // Test code and coverage reports
  'coordinator': 1.0, // Basic coordination messages
  'architect': 1.5,   // Complex system designs
  'general': 1.0      // Default multiplier
};

// Automatic token cost calculation
const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
```

### 4. Cross-Agent Coordination via SQLite Memory

Enables distributed trace correlation across swarm agents:

```typescript
// Automatic coordination tracking
const coordinationContext = {
  activeAgents: 5,                    // Agents active in last hour
  coordinationState: "coordinated",   // coordination | standalone | error
  lastActivity: "2025-07-13T03:56:22.121Z",
  distributed_trace_id: "swarm-1752378045830-researcher-a82ewx-1705234582121"
};

// Memory storage for cross-agent visibility
await storeTraceInMemory(swarmId, agentId, traceData);
```

## Span Metadata Fields

### Core Identification
- **swarm_id**: Unique swarm identifier (e.g., `swarm-1752378045830-7si2203xs`)
- **agent_id**: Individual agent identifier (e.g., `researcher-a82ewx`)
- **agent_role**: Agent type (`researcher`, `coder`, `analyst`, `tester`, `coordinator`, `architect`)
- **hook_stage**: Operation phase (`pre`, `post`, `error`, `span_creation`, `span_completion`)

### Performance Metrics
- **latency_ms**: Operation latency in milliseconds
- **efficiency_score**: 0-100 scale performance rating
- **duration_ms**: Total operation duration
- **tokens_per_ms**: Token processing rate

### Token Usage
- **token_usage**: Input/output/total token counts
- **token_cost**: Estimated USD cost
- **token_strategy**: Estimation method used
- **agent_token_multiplier**: Role-based adjustment factor

### Coordination Context
- **coordination_memory**: Cross-agent coordination state
- **distributed_trace_id**: Unique trace for correlation
- **coordination_state**: `coordinated` | `standalone` | `error`
- **active_agents**: Count of agents in swarm

### Environment Information
- **timestamp**: ISO 8601 timestamp
- **environment**: `development` | `production` | `staging`
- **claude_flow_version**: Version identifier
- **swarm_coordination_enabled**: Boolean coordination status
- **graceful_degradation**: Indicates fallback mode usage

## Integration Examples

### 1. External Swarm Integration

```typescript
// For external swarms not using Claude Flow directly
import { LangfuseWrapper } from '@swarm/langfuse-wrapper';

const tracer = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  enabled: true
});

// Before agent operation
const traceId = await tracer.preHook({
  hookType: 'agent-task',
  swarmId: 'my-external-swarm',
  agentId: 'agent-001',
  agentRole: 'researcher',
  metadata: {
    task: 'analyze-dataset'
  }
});

// After operation
await tracer.postHook(traceId, result, tokenUsage, {
  success: true,
  duration_ms: 1250
});
```

### 2. Claude Flow Hook Enhancement

```typescript
// Automatic enhancement of Claude Flow hooks
import { enhanceHook } from '@swarm/langfuse-wrapper/hook-enhancer';

const enhancedPreTask = enhanceHook('pre-task', originalPreTask, {
  enableTracing: true,
  estimateTokens: true,
  traceMetadata: {
    source: 'claude-flow',
    auto_enhanced: true
  }
});
```

### 3. Custom Span Creation

```typescript
// Create custom spans for detailed operation tracking
const spanId = await tracer.createSpan(traceId, 'data-processing', inputData, {
  operation_type: 'data_analysis',
  dataset_size: 1000,
  complexity: 'high'
});

// ... perform operation ...

await tracer.endSpan(spanId, result, {
  records_processed: 950,
  accuracy_score: 0.987
});
```

### 4. Error Handling

```typescript
try {
  // Agent operation
  const result = await performComplexTask();
  await tracer.postHook(traceId, result);
} catch (error) {
  // Automatic error tracking with enriched context
  await tracer.errorHook(traceId, error, {
    operation: 'complex-task',
    recovery_attempted: true
  });
  throw error;
}
```

### 5. HTTP Middleware Integration

```typescript
import { langfuseTracingMiddleware } from '@swarm/langfuse-wrapper/hook-enhancer';

// Express.js integration
app.use(langfuseTracingMiddleware);

// Automatic tracing of all HTTP requests with:
// - Request metadata (method, path, headers)
// - Response timing and status
// - Error tracking
```

## Performance

### Throughput Capabilities

- **1000+ traces/second**: Optimized for high-throughput swarm operations
- **Batch processing**: Configurable batch sizes (default: 20 traces)
- **Async operations**: Non-blocking trace recording
- **Memory efficient**: Minimal overhead for active spans

### Performance Optimizations

```typescript
// High-performance configuration
const wrapper = new LangfuseWrapper({
  flushAt: 50,        // Larger batch size
  flushInterval: 5000, // More frequent flushes
  enabled: true
});

// Efficiency monitoring
const efficiency = calculateEfficiencyScore(tokenData, latencyMs);
// Returns 0-100 score based on tokens processed per millisecond
```

### Memory Management

- **SQLite coordination**: Lightweight cross-agent memory sharing
- **Trace cleanup**: Automatic cleanup of completed traces
- **Graceful degradation**: Continues operation under resource constraints

## Troubleshooting

### Common Issues

#### 1. Langfuse Not Connecting

**Symptoms**: No traces appearing in Langfuse dashboard

**Solutions**:
```bash
# Verify environment variables
echo $LANGFUSE_PUBLIC_KEY
echo $LANGFUSE_SECRET_KEY

# Check network connectivity
curl -I https://cloud.langfuse.com

# Enable debug logging
NODE_ENV=development npm start
```

#### 2. Missing Span Metadata

**Symptoms**: Spans created but missing swarm context

**Solutions**:
```typescript
// Ensure context is passed correctly
const context = {
  hookType: 'my-operation',
  swarmId: process.env.SWARM_ID || generateSwarmId(),
  agentId: process.env.AGENT_ID || generateAgentId(),
  agentRole: 'researcher',
  metadata: { /* additional context */ }
};
```

#### 3. Token Estimation Errors

**Symptoms**: Zero token counts or estimation failures

**Solutions**:
```typescript
// Ensure content is available for estimation
const tokenUsage = {
  input: inputText ? Math.ceil(inputText.length / 4) : 0,
  output: outputText ? Math.ceil(outputText.length / 4) : 0
};

// Manual token usage
await tracer.postHook(traceId, result, tokenUsage);
```

#### 4. SQLite Database Issues

**Symptoms**: Coordination context errors

**Solutions**:
```bash
# Ensure .swarm directory exists
mkdir -p .swarm

# Check database permissions
ls -la .swarm/memory.db

# Reset database if corrupted
rm .swarm/memory.db
# Database will be recreated on next operation
```

#### 5. High Memory Usage

**Symptoms**: Memory leaks or high usage

**Solutions**:
```typescript
// Implement proper cleanup
process.on('SIGINT', async () => {
  await tracer.shutdown();
  process.exit(0);
});

// Monitor active traces
console.log('Active traces:', tracer.getActiveTraceCount());
console.log('Active spans:', tracer.getActiveSpanCount());
```

### Debug Configuration

```typescript
// Enable comprehensive debugging
const debugWrapper = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  enabled: true,
  flushAt: 1,    // Immediate flushing for debugging
  flushInterval: 1000
});

// Monitor events
debugWrapper.on('initialized', () => console.log('Langfuse initialized'));
debugWrapper.on('shutdown', () => console.log('Langfuse shutdown'));
```

### Error Recovery

The wrapper implements comprehensive error recovery:

```typescript
// Graceful degradation example
async enrichSpanWithMetadata(baseMetadata, hookOptions) {
  try {
    // Attempt full enrichment
    return await this.performFullEnrichment(baseMetadata, hookOptions);
  } catch (error) {
    console.warn('Enrichment failed, using fallback:', error);
    
    // Return basic metadata
    return {
      ...baseMetadata,
      timestamp: new Date().toISOString(),
      enrichment_error: true,
      fallback_mode: true
    };
  }
}
```

## Advanced Configuration

### Custom Agent Token Multipliers

```typescript
// Override default multipliers
const customWrapper = new LangfuseWrapper(config);

// Custom multiplier logic
customWrapper.getAgentTokenMultiplier = (agentRole) => {
  const customMultipliers = {
    'data-scientist': 1.6,
    'ml-engineer': 1.8,
    'devops': 1.1
  };
  return customMultipliers[agentRole] || 1.0;
};
```

### Custom Metadata Enrichment

```typescript
// Add custom enrichment logic
class CustomLangfuseWrapper extends LangfuseWrapper {
  async enrichSpanWithMetadata(baseMetadata, hookOptions) {
    const enriched = await super.enrichSpanWithMetadata(baseMetadata, hookOptions);
    
    // Add custom metadata
    enriched.custom_field = await this.getCustomData();
    enriched.business_context = this.extractBusinessContext(hookOptions);
    
    return enriched;
  }
}
```

### Integration with External Systems

```typescript
// Custom correlation with external tracing systems
const tracer = new LangfuseWrapper(config);

tracer.on('initialized', () => {
  // Register with external APM
  externalAPM.registerTracer(tracer);
});

// Custom distributed trace ID generation
tracer.generateDistributedTraceId = (agentContext) => {
  return `${process.env.SERVICE_NAME}-${agentContext.swarmId}-${Date.now()}`;
};
```

## Best Practices

### 1. Environment Variable Management

```bash
# Use .env files for development
# .env
LANGFUSE_PUBLIC_KEY=pk_lf_...
LANGFUSE_SECRET_KEY=sk_lf_...
CLAUDE_FLOW_ENABLED=true

# Production: Use secure environment variable injection
# Docker
ENV LANGFUSE_PUBLIC_KEY=pk_lf_...

# Kubernetes
- name: LANGFUSE_PUBLIC_KEY
  valueFrom:
    secretKeyRef:
      name: langfuse-credentials
      key: public-key
```

### 2. Error Handling

```typescript
// Implement comprehensive error handling
try {
  const result = await agentOperation();
  await tracer.postHook(traceId, result);
} catch (error) {
  // Always record errors
  await tracer.errorHook(traceId, error);
  
  // Implement recovery logic
  if (error.code === 'NETWORK_ERROR') {
    return await fallbackOperation();
  }
  
  throw error;
}
```

### 3. Performance Monitoring

```typescript
// Regular performance checks
setInterval(() => {
  const activeTraces = tracer.getActiveTraceCount();
  const activeSpans = tracer.getActiveSpanCount();
  
  if (activeTraces > 100) {
    console.warn('High trace count:', activeTraces);
  }
}, 30000);
```

### 4. Memory Management

```typescript
// Implement cleanup for long-running processes
process.on('SIGTERM', async () => {
  console.log('Graceful shutdown...');
  await tracer.shutdown();
  process.exit(0);
});

// Periodic cleanup
setInterval(async () => {
  await tracer.flushAsync();
}, 60000);
```

---

## Summary

The Langfuse integration provides comprehensive observability for Claude Flow swarms with:

- ✅ **Zero-configuration setup** via environment variables
- ✅ **Rich span metadata** with 15+ tracking fields
- ✅ **Agent-aware token estimation** with role-based multipliers
- ✅ **Cross-agent coordination** via SQLite memory
- ✅ **High-performance tracing** (1000+ traces/second)
- ✅ **Graceful error handling** and fallback modes

Simply set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` environment variables to enable automatic tracing across your entire swarm infrastructure.