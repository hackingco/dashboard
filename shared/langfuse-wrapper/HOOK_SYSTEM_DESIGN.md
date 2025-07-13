# Claude-Flow Hook System Integration Design

## Executive Summary

This document outlines the design for integrating Langfuse observability with Claude-Flow's hook system. The integration will enable automatic tracking of all agent operations, LLM calls, and workflow execution through a transparent wrapper that intercepts hook events.

## Hook System Architecture

### Core Hook Types

Claude-Flow implements 9 primary hook types in the `HooksManager` class:

1. **pre-task** - Executed before starting a task
2. **post-task** - Executed after completing a task
3. **pre-edit** - Executed before editing a file
4. **post-edit** - Executed after editing a file
5. **notification** - For storing decisions and messages
6. **pre-search** - Executed before searching
7. **session-start** - Marks beginning of a session
8. **session-end** - Marks end of a session
9. **session-restore** - Restores previous session

### Hook Execution Pattern

```javascript
// HooksManager.executeHook() flow:
1. Generate unique hookId
2. Log start time
3. Execute specific hook handler
4. Store result in memory.db via memory.db.logHook()
5. Return standardized response with success/error status
```

### Hook Data Structure

Each hook execution produces:
```javascript
{
  hookId: string,
  hookType: string,
  options: object,
  result: any,
  success: boolean,
  error?: string,
  duration: number,
  timestamp: string
}
```

## Integration Points

### 1. HooksManager Extension

The LangfuseWrapper will extend HooksManager to intercept all hook executions:

```typescript
export class LangfuseHooksManager extends HooksManager {
  private langfuseService: LangfuseService;
  
  async executeHook(hookType: string, options: any): Promise<any> {
    // Start Langfuse trace
    const traceId = await this.langfuseService.startTrace(
      `Hook.${hookType}`,
      { hookType, ...options }
    );
    
    // Execute original hook
    const result = await super.executeHook(hookType, options);
    
    // Track in Langfuse
    await this.trackHookExecution(traceId, hookType, options, result);
    
    // End trace
    await this.langfuseService.endTrace(traceId, result);
    
    return result;
  }
}
```

### 2. Hook-Specific Tracking

Each hook type requires specific Langfuse tracking:

#### Task Hooks (pre-task, post-task)
```typescript
// Track task lifecycle
- Task creation with suggested agents
- Task assignment to agents
- Task execution duration
- Task completion status
- Performance metrics
```

#### Edit Hooks (pre-edit, post-edit)
```typescript
// Track file operations
- File paths and types
- Assigned agents for edits
- Auto-formatting actions
- Edit suggestions applied
- Change tracking
```

#### Notification Hook
```typescript
// Track decisions and coordination
- Agent decisions
- Coordination messages
- Telemetry data
- Knowledge sharing events
```

#### Session Hooks
```typescript
// Track session lifecycle
- Session duration
- Metrics exported
- State persistence
- Memory usage
```

### 3. CLI Command Integration

The wrapper intercepts CLI commands through exec calls:

```typescript
// Pattern: npx claude-flow@alpha hooks [type] [args]
interface CLIHookCall {
  command: string;
  hookType: string;
  args: string[];
  timestamp: Date;
}

// Intercept and track
async function trackCLIHook(call: CLIHookCall) {
  const span = tracer.startSpan(`CLI.Hook.${call.hookType}`);
  // Parse args and track parameters
  // Link to parent trace
  span.end();
}
```

### 4. Memory Integration

Hook results are stored in SQLite memory.db:

```typescript
// Memory storage pattern
interface HookMemoryEntry {
  key: string;        // e.g., "task/123/init"
  value: any;         // Hook-specific data
  namespace: string;  // e.g., "hooks", "telemetry"
  timestamp: Date;
}

// Track memory operations
async function trackMemoryOperation(op: 'store' | 'retrieve', entry: HookMemoryEntry) {
  await langfuse.trackEvent({
    name: `Memory.${op}`,
    metadata: {
      key: entry.key,
      namespace: entry.namespace,
      valueSize: JSON.stringify(entry.value).length
    }
  });
}
```

## Implementation Strategy

### Phase 1: Hook Interception Layer

1. Create `LangfuseHooksManager` extending `HooksManager`
2. Override `executeHook()` method
3. Add trace creation/completion logic
4. Implement hook-specific tracking methods

### Phase 2: CLI Command Tracking

1. Create exec wrapper for CLI commands
2. Parse hook command patterns
3. Link CLI executions to parent traces
4. Track command success/failure

### Phase 3: Memory Operations Tracking

1. Intercept memory.store() calls
2. Track memory keys and namespaces
3. Monitor memory usage patterns
4. Link memory ops to hook executions

### Phase 4: Agent Coordination Tracking

1. Track agent spawning via hooks
2. Monitor task assignments
3. Track knowledge sharing events
4. Measure coordination effectiveness

## Hook Metadata Extraction

### Pre-Task Hook
```typescript
{
  taskId: string,
  description: string,
  suggestedAgents: Agent[],
  previousContext?: any,
  autoSpawnAgents: boolean
}
```

### Post-Task Hook
```typescript
{
  taskId: string,
  duration: number,
  performance: {
    editsCount: number,
    searchesCount: number,
    averageEditTime: number
  },
  summary: {
    keyDecisions: string[],
    notificationsCount: number
  }
}
```

### Pre-Edit Hook
```typescript
{
  file: string,
  assignedAgent: string,
  suggestions: string[],
  fileType: string
}
```

### Post-Edit Hook
```typescript
{
  editId: string,
  file: string,
  formatted: boolean,
  memoryKey?: string,
  changes: any
}
```

## Observability Benefits

1. **Complete Operation Tracking** - Every hook execution traced
2. **Agent Performance Metrics** - Track agent effectiveness by hook patterns
3. **File Operation Insights** - Understand edit patterns and frequencies
4. **Task Execution Analysis** - Measure task completion rates and durations
5. **Coordination Effectiveness** - Track multi-agent coordination success
6. **Memory Usage Patterns** - Understand memory access and storage patterns
7. **Session Analytics** - Track session durations and productivity

## Integration with Existing Services

### AgentService Integration
- Track `execAsync` calls to Claude-Flow hooks
- Monitor task assignment and completion
- Measure agent adaptation effectiveness

### SwarmObservabilityHooks Integration
- Extend existing hooks with Langfuse tracking
- Unify swarm and hook observability
- Correlate swarm operations with hook executions

### TelemetryService Integration
- Feed hook metrics to telemetry
- Aggregate hook performance data
- Generate hook-based reports

## Testing Strategy

1. **Unit Tests** - Test each hook type tracking
2. **Integration Tests** - Test full hook chains
3. **Performance Tests** - Measure tracking overhead
4. **Memory Tests** - Verify no memory leaks
5. **CLI Tests** - Test command interception

## Security Considerations

1. **Sensitive Data** - Filter sensitive file paths
2. **Command Safety** - Track dangerous commands
3. **Memory Privacy** - Anonymize memory keys if needed
4. **Token Security** - Never log auth tokens

## Performance Optimization

1. **Async Tracking** - Don't block hook execution
2. **Batch Operations** - Group related traces
3. **Sampling** - Allow sampling for high-volume hooks
4. **Caching** - Cache agent assignments
5. **Compression** - Compress large payloads

## Conclusion

The LangfuseWrapper hook integration provides comprehensive observability for Claude-Flow operations while maintaining the system's performance and flexibility. By intercepting hooks at the HooksManager level, we gain complete visibility into agent coordination, task execution, and system behavior.