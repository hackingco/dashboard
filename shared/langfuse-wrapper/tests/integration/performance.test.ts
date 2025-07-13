import { jest } from '@jest/globals';
import { LangfuseWrapper } from '../../src';
import Langfuse from 'langfuse';
import { performance } from 'perf_hooks';

// Mock Langfuse
jest.mock('langfuse');

describe('Performance Tests', () => {
  let wrapper: LangfuseWrapper;
  let mockLangfuseClient: any;

  beforeEach(() => {
    mockLangfuseClient = global.testHelpers.mockLangfuseClient();
    (Langfuse as jest.MockedClass<typeof Langfuse>).mockImplementation(() => mockLangfuseClient);
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.shutdown();
    }
  });

  describe('Throughput Tests', () => {
    it('should handle 1000 traces per second', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());
      
      const tracesPerSecond = 1000;
      const startTime = performance.now();
      const promises: Promise<string>[] = [];

      for (let i = 0; i < tracesPerSecond; i++) {
        promises.push(wrapper.startTrace(`trace-${i}`));
      }

      const traceIds = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(traceIds).toHaveLength(tracesPerSecond);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify memory usage is reasonable
      if (global.gc) {
        global.gc();
        const memUsage = process.memoryUsage();
        expect(memUsage.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      }
    });

    it('should handle 5000 spans across traces', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());
      
      const traceCount = 100;
      const spansPerTrace = 50;
      const startTime = performance.now();

      // Create traces
      const traceIds = await Promise.all(
        Array.from({ length: traceCount }, (_, i) => 
          wrapper.startTrace(`trace-${i}`)
        )
      );

      // Create spans
      const spanPromises: Promise<void>[] = [];
      for (let i = 0; i < traceCount; i++) {
        for (let j = 0; j < spansPerTrace; j++) {
          spanPromises.push(
            wrapper.startSpan(`span-${i}-${j}`, `Span ${j}`, traceIds[i])
          );
        }
      }

      await Promise.all(spanPromises);
      const duration = performance.now() - startTime;

      expect(spanPromises).toHaveLength(traceCount * spansPerTrace);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(wrapper.getActiveSpans()).toHaveLength(traceCount * spansPerTrace);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with trace lifecycle', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig({
        memoryDbPath: ':memory:'
      }));
      
      const iterations = 1000;
      const baselineMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const traceId = await wrapper.startTrace(`memory-test-${i}`);
        await wrapper.startSpan(`span-${i}`, 'Test span', traceId);
        await wrapper.endSpan(`span-${i}`);
        await wrapper.endTrace(traceId);
        
        // Force garbage collection every 100 iterations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      if (global.gc) {
        global.gc();
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemory - baselineMemory;
        
        // Memory growth should be minimal (less than 10MB)
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
      }

      // Verify no active traces or spans remain
      expect(wrapper.getActiveTraces()).toHaveLength(0);
      expect(wrapper.getActiveSpans()).toHaveLength(0);
    });

    it('should handle memory database growth efficiently', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig({
        memoryDbPath: ':memory:'
      }));

      // Create many traces
      const traceCount = 10000;
      const batchSize = 100;

      for (let batch = 0; batch < traceCount / batchSize; batch++) {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          const idx = batch * batchSize + i;
          promises.push(
            wrapper.startTrace(`db-test-${idx}`).then(traceId =>
              wrapper.endTrace(traceId)
            )
          );
        }
        await Promise.all(promises);
      }

      const stats = wrapper.getMemoryStats();
      expect(stats?.total_traces).toBe(traceCount);
      
      // Database should still be responsive
      const queryStart = performance.now();
      const newStats = wrapper.getMemoryStats();
      const queryDuration = performance.now() - queryStart;
      
      expect(queryDuration).toBeLessThan(100); // Query should be fast
      expect(newStats).toBeTruthy();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle race conditions in trace management', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());
      
      const concurrentOps = 100;
      const results: any[] = [];

      // Simulate race conditions
      const operations = Array.from({ length: concurrentOps }, (_, i) => async () => {
        const traceId = await wrapper.startTrace(`race-${i}`);
        
        // Random delay to increase chance of race conditions
        await global.testHelpers.delay(Math.random() * 10);
        
        // Try to start multiple spans on same trace
        const spanPromises = [
          wrapper.startSpan(`span-a-${i}`, 'Span A', traceId),
          wrapper.startSpan(`span-b-${i}`, 'Span B', traceId),
          wrapper.startSpan(`span-c-${i}`, 'Span C', traceId)
        ];
        
        await Promise.all(spanPromises);
        
        // End spans in random order
        const endPromises = [
          wrapper.endSpan(`span-b-${i}`),
          wrapper.endSpan(`span-a-${i}`),
          wrapper.endSpan(`span-c-${i}`)
        ];
        
        await Promise.all(endPromises);
        await wrapper.endTrace(traceId);
        
        return { traceId, completed: true };
      });

      // Execute all operations concurrently
      const promises = operations.map(op => op().catch(e => ({ error: e.message })));
      const allResults = await Promise.all(promises);

      // All operations should complete successfully
      const successful = allResults.filter((r: any) => r.completed);
      expect(successful).toHaveLength(concurrentOps);
      
      // No traces or spans should remain active
      expect(wrapper.getActiveTraces()).toHaveLength(0);
      expect(wrapper.getActiveSpans()).toHaveLength(0);
    });
  });

  describe('Batching and Flushing', () => {
    it('should batch operations efficiently', async () => {
      let flushCount = 0;
      mockLangfuseClient.flushAsync.mockImplementation(async () => {
        flushCount++;
      });

      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig({
        flushAt: 20,
        flushInterval: 1000
      }));

      // Create 100 traces rapidly
      const promises = Array.from({ length: 100 }, (_, i) =>
        wrapper.startTrace(`batch-${i}`)
      );
      
      await Promise.all(promises);
      
      // Should not flush immediately
      expect(flushCount).toBe(0);
      
      // End all traces
      await Promise.all(
        promises.map(async (tracePromise, i) => {
          const traceId = await tracePromise;
          await wrapper.endTrace(traceId);
        })
      );

      // Should have triggered some flushes based on batch size
      expect(flushCount).toBeGreaterThan(0);
      expect(flushCount).toBeLessThan(100); // But not one per trace
    });

    it('should handle flush failures gracefully', async () => {
      mockLangfuseClient.flushAsync.mockRejectedValue(new Error('Flush failed'));

      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());

      const traceId = await wrapper.startTrace('flush-fail-test');
      
      // Should not throw even if flush fails
      await expect(wrapper.endTrace(traceId)).resolves.not.toThrow();
      
      // Should continue operating normally
      const newTraceId = await wrapper.startTrace('after-flush-fail');
      expect(newTraceId).toBeTruthy();
    });
  });

  describe('Hook Performance', () => {
    it('should not significantly impact performance with many hooks', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());
      
      // Register many hooks
      const hookTypes = ['pre-trace', 'post-trace', 'pre-span', 'post-span'];
      const hooksPerType = 10;
      
      hookTypes.forEach(type => {
        for (let i = 0; i < hooksPerType; i++) {
          wrapper.registerHook(type, async (context) => {
            // Simulate some processing
            await global.testHelpers.delay(0.1);
          });
        }
      });

      const startTime = performance.now();
      
      // Execute trace with spans
      const traceId = await wrapper.startTrace('hook-perf-test');
      await wrapper.startSpan('span-1', 'Test span', traceId);
      await wrapper.endSpan('span-1');
      await wrapper.endTrace(traceId);
      
      const duration = performance.now() - startTime;
      
      // Even with many hooks, should complete quickly
      expect(duration).toBeLessThan(200); // 200ms max
    });

    it('should handle synchronous and asynchronous hooks efficiently', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());
      
      const syncExecutions: number[] = [];
      const asyncExecutions: number[] = [];
      
      // Mix of sync and async hooks
      wrapper.registerHook('pre-trace', (context) => {
        syncExecutions.push(Date.now());
      });
      
      wrapper.registerHook('pre-trace', async (context) => {
        await global.testHelpers.delay(10);
        asyncExecutions.push(Date.now());
      });
      
      wrapper.registerHook('pre-trace', (context) => {
        syncExecutions.push(Date.now());
      });

      const startTime = Date.now();
      await wrapper.startTrace('mixed-hooks-test');
      
      // Sync hooks should execute immediately
      expect(syncExecutions).toHaveLength(2);
      expect(syncExecutions[1] - syncExecutions[0]).toBeLessThan(5);
      
      // Async hook should complete after delay
      expect(asyncExecutions).toHaveLength(1);
      expect(asyncExecutions[0] - startTime).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on shutdown', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig({
        memoryDbPath: ':memory:'
      }));

      // Create active traces and spans
      const traceIds = await Promise.all(
        Array.from({ length: 10 }, (_, i) => wrapper.startTrace(`cleanup-${i}`))
      );
      
      await Promise.all(
        traceIds.map((traceId, i) => 
          wrapper.startSpan(`span-${i}`, 'Test span', traceId)
        )
      );

      // Verify resources are active
      expect(wrapper.getActiveTraces()).toHaveLength(10);
      expect(wrapper.getActiveSpans()).toHaveLength(10);

      // Shutdown
      await wrapper.shutdown();

      // Verify cleanup
      expect(mockLangfuseClient.shutdownAsync).toHaveBeenCalled();
      
      // Should not be able to create new traces
      await expect(wrapper.startTrace('after-shutdown')).resolves.toBeTruthy();
      // But client should not be called
      expect(mockLangfuseClient.trace).toHaveBeenCalledTimes(10); // Only initial traces
    });
  });

  describe('Event Emitter Performance', () => {
    it('should handle many event listeners efficiently', async () => {
      wrapper = new LangfuseWrapper(global.testHelpers.createMockConfig());
      
      const listenerCount = 100;
      const executionCounts: Record<string, number> = {};
      
      // Add many listeners
      const events = ['trace:started', 'trace:ended', 'span:started', 'span:ended'];
      events.forEach(event => {
        executionCounts[event] = 0;
        for (let i = 0; i < listenerCount; i++) {
          wrapper.on(event, () => {
            executionCounts[event]++;
          });
        }
      });

      // Execute operations
      const traceId = await wrapper.startTrace('event-perf-test');
      await wrapper.startSpan('span-1', 'Test', traceId);
      await wrapper.endSpan('span-1');
      await wrapper.endTrace(traceId);

      // Verify all listeners executed
      expect(executionCounts['trace:started']).toBe(listenerCount);
      expect(executionCounts['trace:ended']).toBe(listenerCount);
      expect(executionCounts['span:started']).toBe(listenerCount);
      expect(executionCounts['span:ended']).toBe(listenerCount);

      // Remove all listeners to prevent memory leaks
      events.forEach(event => wrapper.removeAllListeners(event));
    });
  });
});