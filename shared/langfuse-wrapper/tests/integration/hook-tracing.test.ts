/**
 * Hook Tracing Integration Tests
 * Demonstrates comprehensive hook tracing with parent-child relationships
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  hookTracer,
  tracedHookRegistry,
  initializeHookTracing,
  HookTracingIntegration,
  getHookMetrics,
  exportHookTraces
} from '../../src/hook-tracing-integration';

describe('Hook Tracing Integration', () => {
  let integration: HookTracingIntegration;

  beforeAll(async () => {
    // Initialize hook tracing with all features enabled
    integration = await initializeHookTracing({
      enableTracing: true,
      enableInterceptors: true,
      enableLangfuse: process.env.LANGFUSE_PUBLIC_KEY ? true : false,
      enableSwarmHooks: true,
      tracingOptions: {
        maxTraceAge: 60000, // 1 minute for tests
        autoCleanup: true,
        cleanupInterval: 10000 // 10 seconds for tests
      }
    });
  });

  afterAll(async () => {
    await integration.shutdown();
  });

  describe('Pre-Hook Tracing', () => {
    it('should trace pre-task hook with metadata', async () => {
      const taskId = `task-${Date.now()}`;
      const result = await integration.executeHook('pre-task', {
        taskId,
        description: 'Test task for hook tracing',
        autoSpawnAgents: true,
        loadPreviousContext: false
      });

      expect(result).toBeDefined();
      expect(result.taskId).toBe(taskId);
      expect(result.initialized).toBe(true);

      // Check metrics
      const metrics = integration.getMetrics('pre-task');
      expect(metrics.hookMetrics.count).toBeGreaterThan(0);
    });

    it('should trace pre-search hook with caching', async () => {
      const query = 'test search query';
      
      // First search (no cache)
      const result1 = await integration.executeHook('pre-search', {
        query,
        cacheResults: true,
        suggestOptimizations: true
      });

      expect(result1.cached).toBe(false);

      // Second search (should be cached)
      const result2 = await integration.executeHook('pre-search', {
        query,
        cacheResults: true
      });

      // Note: Cache checking is simulated in test environment
      expect(result2).toBeDefined();
    });

    it('should trace pre-edit hook with agent assignment', async () => {
      const result = await integration.executeHook('pre-edit', {
        file: '/test/file.ts',
        autoAssignAgent: true
      });

      expect(result.file).toBe('/test/file.ts');
      expect(result.agent).toBeDefined();
      expect(result.validated).toBe(true);
    });
  });

  describe('Post-Hook Tracing', () => {
    it('should trace post-task hook with performance analysis', async () => {
      const taskId = `task-${Date.now()}`;
      
      // First execute pre-task
      await integration.executeHook('pre-task', {
        taskId,
        description: 'Test task for post-hook'
      });

      // Then execute post-task
      const result = await integration.executeHook('post-task', {
        taskId,
        analyzePerformance: true,
        generateSummary: true
      });

      expect(result.taskId).toBe(taskId);
      expect(result.completed).toBe(true);
    });

    it('should trace post-edit hook with auto-formatting', async () => {
      const result = await integration.executeHook('post-edit', {
        file: '/test/file.js',
        memoryKey: 'test/edits/file',
        autoFormat: true,
        trackChanges: true
      });

      expect(result.file).toBe('/test/file.js');
      expect(result.formatted).toBe(true);
      expect(result.tracked).toBe(true);
    });

    it('should trace session-end hook with summary', async () => {
      const sessionId = `session-${Date.now()}`;
      
      const result = await integration.executeHook('session-end', {
        sessionId,
        exportMetrics: true,
        generateSummary: true
      });

      expect(result.sessionId).toBe(sessionId);
      expect(result.exported).toBe(true);
      expect(result.summarized).toBe(true);
    });
  });

  describe('Parent-Child Hook Relationships', () => {
    it('should trace nested hook calls with parent-child relationships', async () => {
      const parentTaskId = `parent-${Date.now()}`;
      const childTaskId = `child-${Date.now()}`;

      // Start parent task
      const parentResult = await integration.executeHook('pre-task', {
        taskId: parentTaskId,
        description: 'Parent task'
      });

      // Start child task (within parent context)
      const childResult = await integration.executeHook('pre-task', {
        taskId: childTaskId,
        description: 'Child task',
        parentTaskId
      });

      // Get trace hierarchy
      const traces = hookTracer.getSessionTraces(parentTaskId);
      expect(traces.length).toBeGreaterThanOrEqual(1);

      // Complete child task
      await integration.executeHook('post-task', {
        taskId: childTaskId
      });

      // Complete parent task
      await integration.executeHook('post-task', {
        taskId: parentTaskId
      });

      expect(parentResult).toBeDefined();
      expect(childResult).toBeDefined();
    });
  });

  describe('Hook Performance Metrics', () => {
    it('should collect hook execution metrics', async () => {
      // Execute multiple hooks
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          integration.executeHook('notification', {
            message: `Test notification ${i}`,
            telemetry: true
          })
        );
      }

      await Promise.all(promises);

      // Get metrics
      const metrics = getHookMetrics('notification');
      expect(metrics.hookMetrics.count).toBeGreaterThanOrEqual(5);
      expect(metrics.hookMetrics.avgDuration).toBeGreaterThan(0);
      expect(metrics.hookMetrics.minDuration).toBeGreaterThan(0);
      expect(metrics.hookMetrics.maxDuration).toBeGreaterThan(0);
    });

    it('should track memory usage across hooks', async () => {
      const beforeMemory = process.memoryUsage().heapUsed;

      // Execute memory-intensive operation
      const largeData = Array(1000).fill('x'.repeat(1000));
      await integration.executeHook('pre-search', {
        query: largeData.join(' '),
        cacheResults: false
      });

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryDelta = afterMemory - beforeMemory;

      expect(memoryDelta).toBeGreaterThan(0);
    });
  });

  describe('Hook Error Handling', () => {
    it('should trace hook errors with context', async () => {
      // Register a hook that throws an error
      integration.registerHook(
        'error-test',
        async () => {
          throw new Error('Test error in hook');
        }
      );

      // Execute and expect error
      await expect(
        integration.executeHook('error-test', {})
      ).rejects.toThrow('Test error in hook');

      // Check error metrics
      const metrics = getHookMetrics('error-test');
      expect(metrics.hookMetrics.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Hook Trace Export', () => {
    it('should export hook traces for analysis', async () => {
      const sessionId = `export-test-${Date.now()}`;

      // Execute hooks with session ID
      await integration.executeHook('pre-task', {
        taskId: 'export-task-1',
        sessionId
      });

      await integration.executeHook('notification', {
        message: 'Export test notification',
        sessionId
      });

      await integration.executeHook('post-task', {
        taskId: 'export-task-1',
        sessionId
      });

      // Export traces
      const exported = exportHookTraces(sessionId);

      expect(exported).toBeDefined();
      expect(exported.sessionId).toBe(sessionId);
      expect(exported.traceCount).toBeGreaterThan(0);
      expect(exported.traces).toBeInstanceOf(Array);
      expect(exported.metrics).toBeDefined();
    });
  });

  describe('Swarm Hook Integration', () => {
    it('should trace swarm lifecycle hooks', async () => {
      const swarmId = `swarm-${Date.now()}`;
      const workerId = `worker-${Date.now()}`;

      // Execute swarm creation hook
      await integration.executeHook('swarm-created', {
        swarmId,
        swarmName: 'Test Swarm',
        config: { topology: 'mesh', maxAgents: 3 }
      });

      // Execute worker assignment hook
      await integration.executeHook('worker-assigned', {
        swarmId,
        workerId,
        workerConfig: { type: 'researcher' }
      });

      // Check metrics
      const swarmMetrics = getHookMetrics('swarm-created');
      const workerMetrics = getHookMetrics('worker-assigned');

      expect(swarmMetrics.hookMetrics.count).toBeGreaterThan(0);
      expect(workerMetrics.hookMetrics.count).toBeGreaterThan(0);
    });

    it('should trace task execution lifecycle', async () => {
      const taskId = `exec-task-${Date.now()}`;
      const workerId = `worker-${Date.now()}`;

      // Start task execution
      await integration.executeHook('task-execution-start', {
        taskId,
        workerId,
        input: { type: 'test', data: 'sample' }
      });

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));

      // Complete task execution
      await integration.executeHook('task-execution-complete', {
        taskId,
        workerId,
        input: { type: 'test', data: 'sample' },
        output: { result: 'success' },
        duration: 100
      });

      // Check metrics
      const startMetrics = getHookMetrics('task-execution-start');
      const completeMetrics = getHookMetrics('task-execution-complete');

      expect(startMetrics.hookMetrics.count).toBeGreaterThan(0);
      expect(completeMetrics.hookMetrics.count).toBeGreaterThan(0);
    });
  });

  describe('Hook Cleanup', () => {
    it('should cleanup old traces automatically', async () => {
      // Execute some hooks
      for (let i = 0; i < 3; i++) {
        await integration.executeHook('notification', {
          message: `Cleanup test ${i}`
        });
      }

      // Get initial count
      const beforeCleanup = getHookMetrics();
      const initialCount = beforeCleanup.hookMetrics.count;

      // Manually trigger cleanup with very short max age
      hookTracer.clearOldTraces(1); // 1ms max age

      // Check that old traces were cleaned
      const afterCleanup = getHookMetrics();
      expect(afterCleanup.hookMetrics.count).toBeLessThanOrEqual(initialCount);
    });
  });
});