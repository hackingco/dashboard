# Hook Tracing Implementation Guide

## Overview

The Hive Mind hook tracing system provides comprehensive pre and post hook interception with parent-child relationship tracking, performance metrics, and integration with Langfuse observability.

## Architecture

### Core Components

1. **Hook Tracer (`hook-tracer.ts`)**
   - Manages trace lifecycle
   - Tracks parent-child relationships
   - Collects performance metrics
   - Handles memory usage tracking

2. **Hook Interceptors (`hook-interceptors.ts`)**
   - Pre-task: Task initialization and context loading
   - Pre-search: Query caching and optimization
   - Pre-edit: File validation and agent assignment
   - Post-task: Performance analysis and summary generation
   - Post-edit: Auto-formatting and change tracking
   - Session-end: Trace export and cleanup

3. **Traced Hook Wrapper (`traced-hook-wrapper.ts`)**
   - Combines tracing with interceptors
   - Provides hook execution framework
   - Manages hook registry
   - Enables Langfuse integration

4. **Hook Tracing Integration (`hook-tracing-integration.ts`)**
   - Main integration module
   - Coordinates all components
   - Provides unified API
   - Handles auto-cleanup and lifecycle

## Features

### Pre-Hook Interceptors

#### Pre-Task
- Loads previous context if requested
- Stores task initialization data
- Tracks task descriptions and auto-spawn settings

#### Pre-Search
- Implements query result caching
- Checks cache before execution
- Stores results for future use

#### Pre-Edit
- Validates file existence
- Auto-assigns agents based on file type
- Tracks file metadata

### Post-Hook Interceptors

#### Post-Task
- Analyzes task performance
- Generates task summaries
- Calculates task duration

#### Post-Edit
- Auto-formats files based on type
- Tracks file changes
- Stores edit history in memory

#### Session-End
- Exports session traces
- Generates session summaries
- Cleans up resources

### Hook Metadata Collection

Each hook trace includes:
- Unique trace ID
- Hook type and phase
- Parent-child relationships
- Start/end timestamps
- Duration in milliseconds
- Input/output data
- Error information (if any)
- Memory usage delta
- Token usage (if applicable)

### Performance Timing

The system tracks:
- Individual hook execution time
- Parent-child execution hierarchies
- Memory usage before/after
- Average, min, max durations
- Active trace counts
- Error rates

## Usage

### Basic Hook Execution

```typescript
import { initializeHookTracing } from '@swarm/langfuse-wrapper';

// Initialize the integration
const integration = await initializeHookTracing({
  enableTracing: true,
  enableInterceptors: true,
  enableLangfuse: true,
  enableSwarmHooks: true
});

// Execute a hook
const result = await integration.executeHook('pre-task', {
  taskId: 'task-123',
  description: 'My task',
  autoSpawnAgents: true
});
```

### Custom Hook Registration

```typescript
// Register a custom hook with interceptor
integration.registerHook(
  'my-custom-hook',
  async (options) => {
    // Hook implementation
    return { success: true };
  },
  {
    before: async (args, metadata) => {
      console.log('Before hook execution');
    },
    after: async (result, args, metadata) => {
      console.log('After hook execution');
    }
  }
);
```

### Trace Export

```typescript
// Export traces for a session
const traces = integration.exportTraces('session-123', './traces.json');

// Get hook metrics
const metrics = integration.getMetrics('pre-task');
console.log(`Average duration: ${metrics.hookMetrics.avgDuration}ms`);
```

### Parent-Child Relationships

```typescript
// Parent task
const parentTrace = await hookTracer.tracePreHook('pre-task', {
  taskId: 'parent-task'
}, { sessionId: 'session-123' });

// Child task (automatically linked)
const childTrace = await hookTracer.tracePreHook('pre-task', {
  taskId: 'child-task',
  parentTaskId: 'parent-task'
}, { sessionId: 'session-123' });

// Get full hierarchy
const hierarchy = hookTracer.getTraceHierarchy(childTrace);
```

## Configuration

### Environment Variables

```bash
# Enable hook tracing
ENABLE_HOOK_TRACING=true

# Langfuse integration (optional)
LANGFUSE_PUBLIC_KEY=your-key
LANGFUSE_SECRET_KEY=your-secret
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Initialization Options

```typescript
{
  enableTracing: true,          // Enable trace collection
  enableInterceptors: true,     // Enable pre/post interceptors
  enableLangfuse: true,         // Enable Langfuse integration
  enableSwarmHooks: true,       // Enable swarm lifecycle hooks
  tracingOptions: {
    maxTraceAge: 3600000,       // Max trace age (1 hour)
    autoCleanup: true,          // Enable auto-cleanup
    cleanupInterval: 300000     // Cleanup interval (5 minutes)
  }
}
```

## Integration with Claude Flow

The hook tracing system integrates seamlessly with Claude Flow hooks:

```bash
# Hooks automatically traced
npx claude-flow@alpha hooks pre-task --description "My task"
npx claude-flow@alpha hooks post-edit --file "file.ts" --memory-key "edits/file"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## Performance Considerations

1. **Memory Management**
   - Old traces are automatically cleaned up
   - Configurable max trace age
   - Efficient parent-child linking

2. **Async Operations**
   - All hook operations are async
   - Non-blocking trace collection
   - Parallel execution support

3. **Error Handling**
   - Graceful degradation on errors
   - Error traces are preserved
   - No impact on hook execution

## Testing

Comprehensive test suite available:

```bash
# Run hook tracing tests
npm test -- hook-tracing.test.ts
```

Tests cover:
- Pre/post hook tracing
- Parent-child relationships
- Performance metrics
- Error handling
- Trace export
- Cleanup functionality

## Future Enhancements

1. **Real-time Monitoring**
   - WebSocket support for live traces
   - Real-time metrics dashboard
   - Alert thresholds

2. **Advanced Analytics**
   - Hook execution patterns
   - Performance bottleneck detection
   - Agent coordination analysis

3. **Integration Extensions**
   - OpenTelemetry support
   - Prometheus metrics export
   - Custom visualization tools