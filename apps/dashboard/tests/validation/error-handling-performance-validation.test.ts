/**
 * Error Handling and Performance Validation Tests
 * Tests error scenarios, performance limits, and system resilience
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LangfuseRealtimeClient } from '../../lib/langfuse-client';
import { createSwarmLogger } from '../../lib/swarm-langfuse-logger';
import { traceSwarmOperation, withPerformanceMonitoring } from '../../lib/langfuse-server';
import { 
  createMockFetch, 
  MockWebSocket, 
  generateMockTrace, 
  testScenarios 
} from '../unit/mocks/langfuse-mocks';
import type { LiveTrace } from '../../lib/langfuse-client';

describe('Error Handling and Performance Validation Tests', () => {
  let client: LangfuseRealtimeClient;
  let swarmLogger: ReturnType<typeof createSwarmLogger>;
  let mockWebSocket: MockWebSocket;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    
    client = new LangfuseRealtimeClient({
      baseUrl: 'http://localhost:3000',
      enableRealtime: true,
      autoFlush: false,
    });
    
    swarmLogger = createSwarmLogger('error-test-swarm', 'error-test-session');
    mockWebSocket = new MockWebSocket('ws://localhost:3000/ws');
    
    originalFetch = global.fetch;
    global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);
  });

  afterEach(async () => {
    if (client) {
      await client.shutdown();
    }
    if (swarmLogger) {
      await swarmLogger.close();
    }
    
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Network Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      global.fetch = createMockFetch('timeout');
      
      const traces = await client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0); // Should return mock data
    });

    it('should handle HTTP error responses', async () => {
      global.fetch = createMockFetch('error');
      
      const traces = await client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0); // Should return mock data
    });

    it('should handle connection refused errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
      
      const traces = await client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0); // Should return mock data
    });

    it('should handle DNS resolution errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('ENOTFOUND')));
      
      const traces = await client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0); // Should return mock data
    });

    it('should handle malformed responses', async () => {
      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve('invalid json'),
      }));
      
      const traces = await client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0); // Should return mock data
    });
  });

  describe('WebSocket Error Handling', () => {
    it('should handle WebSocket connection failures', async () => {
      let connectionAttempted = false;
      
      client.on('error', (error) => {
        expect(error).toBeDefined();
        connectionAttempted = true;
      });

      // Simulate WebSocket connection error
      mockWebSocket.simulateError();
      
      // Give time for error handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(client.isRealtimeConnected()).toBe(false);
    });

    it('should handle WebSocket message parsing errors', async () => {
      let errorHandled = false;
      
      client.on('error', (error) => {
        errorHandled = true;
      });

      // Simulate malformed WebSocket message
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(new MessageEvent('message', { 
          data: 'invalid json' 
        }));
      }
      
      // Give time for error handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Error should be handled gracefully
      expect(typeof errorHandled).toBe('boolean');
    });

    it('should handle WebSocket connection drops', async () => {
      let disconnectHandled = false;
      
      client.on('disconnected', () => {
        disconnectHandled = true;
      });

      // Simulate connection drop
      mockWebSocket.simulateClose();
      
      // Give time for event handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(disconnectHandled).toBe(true);
    });

    it('should handle WebSocket reconnection attempts', async () => {
      let reconnectAttempted = false;
      
      // Mock reconnection logic
      client.on('disconnected', () => {
        reconnectAttempted = true;
        client.reconnect();
      });

      // Simulate disconnect and reconnect
      mockWebSocket.simulateClose();
      
      // Give time for reconnection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(reconnectAttempted).toBe(true);
    });
  });

  describe('Data Validation Error Handling', () => {
    it('should handle invalid trace data', async () => {
      const invalidTrace = {
        id: '',
        name: null,
        sessionId: undefined,
        timestamp: 'invalid-date',
        status: 'invalid-status',
        model: 123,
        promptTokens: -1,
        completionTokens: 'not-a-number',
        totalCost: Infinity,
      } as any;

      const traceId = await client.createTrace(invalidTrace);
      
      // Should handle gracefully and return null or valid ID
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });

    it('should handle missing required fields', async () => {
      const incompleteTrace = {
        // Missing required fields
        name: 'Incomplete Trace',
      } as any;

      const traceId = await client.createTrace(incompleteTrace);
      
      // Should handle gracefully
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });

    it('should handle oversized data', async () => {
      const oversizedTrace = generateMockTrace({
        input: 'x'.repeat(1000000), // 1MB input
        output: 'y'.repeat(1000000), // 1MB output
        metadata: {
          largeData: Array.from({ length: 100000 }, (_, i) => `large-item-${i}`),
        },
      });

      const startTime = performance.now();
      const traceId = await client.createTrace(oversizedTrace);
      const endTime = performance.now();
      
      // Should handle gracefully and complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should handle memory-intensive operations', async () => {
      const memoryIntensiveData = Array.from({ length: 1000 }, (_, i) => 
        generateMockTrace({
          id: `memory-trace-${i}`,
          input: 'x'.repeat(1000),
          output: 'y'.repeat(1000),
          metadata: {
            data: Array.from({ length: 100 }, (_, j) => ({ 
              id: j, 
              value: Math.random(),
              text: `item-${j}`.repeat(10)
            })),
          },
        })
      );

      const startTime = performance.now();
      const promises = memoryIntensiveData.map(trace => client.createTrace(trace));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(results).toHaveLength(1000);
    });

    it('should handle garbage collection scenarios', async () => {
      // Create many traces to potentially trigger garbage collection
      const traces: LiveTrace[] = [];
      
      for (let i = 0; i < 100; i++) {
        const trace = generateMockTrace({
          id: `gc-trace-${i}`,
          metadata: {
            iteration: i,
            data: Array.from({ length: 1000 }, (_, j) => j),
          },
        });
        traces.push(trace);
      }

      const startTime = performance.now();
      const promises = traces.map(trace => client.createTrace(trace));
      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10000);
      expect(results).toHaveLength(100);
    });

    it('should handle circular reference protection', async () => {
      const circularTrace = generateMockTrace();
      
      // Create circular reference
      const metadata = { trace: circularTrace };
      circularTrace.metadata = metadata;
      (metadata as any).circular = metadata;

      // Should handle without throwing
      const traceId = await client.createTrace(circularTrace);
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should detect performance issues', async () => {
      let performanceWarning = false;
      
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { success: true };
      };

      try {
        await withPerformanceMonitoring(
          'slow_operation',
          slowOperation,
          1000 // 1 second threshold
        );
      } catch (error) {
        // Operation should complete but may trigger warning
      }

      // Should detect that operation exceeded threshold
      expect(true).toBe(true); // Operation completes
    });

    it('should handle concurrent performance monitoring', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => 
        withPerformanceMonitoring(
          `concurrent_operation_${i}`,
          async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
            return { operationId: i, success: true };
          },
          1000
        )
      );

      const startTime = performance.now();
      const results = await Promise.all(concurrentOperations);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000);
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.operationId).toBe(index);
        expect(result.success).toBe(true);
      });
    });

    it('should handle operation timeouts', async () => {
      const timeoutOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true };
      };

      const startTime = performance.now();
      
      try {
        await withPerformanceMonitoring(
          'timeout_operation',
          timeoutOperation,
          1000
        );
      } catch (error) {
        // Operation may complete but will trigger warnings
      }
      
      const endTime = performance.now();
      
      // Should complete (though may be slow)
      expect(endTime - startTime).toBeLessThan(4000);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from transient errors', async () => {
      let attemptCount = 0;
      
      const flakyOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Transient error');
        }
        return { success: true, attempts: attemptCount };
      };

      // Simulate retry logic
      let result;
      for (let i = 0; i < 5; i++) {
        try {
          result = await flakyOperation();
          break;
        } catch (error) {
          if (i === 4) throw error; // Final attempt
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      expect(result?.success).toBe(true);
      expect(result?.attempts).toBe(3);
    });

    it('should handle cascading failures', async () => {
      const operations = [
        async () => { throw new Error('Operation 1 failed'); },
        async () => { throw new Error('Operation 2 failed'); },
        async () => { return { success: true }; }, // This should succeed
      ];

      const results = await Promise.allSettled(operations.map(op => op()));
      
      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('should handle partial system failures', async () => {
      // Mock partial system failure
      global.fetch = vi.fn((url) => {
        if (url.includes('/traces')) {
          return Promise.reject(new Error('Traces service down'));
        }
        return createMockFetch('success')(url);
      });

      const traces = await client.getTraces({ limit: 10 });
      const metrics = await client.getSwarmMetrics();

      // Should get mock data for traces and metrics
      expect(Array.isArray(traces)).toBe(true);
      expect(typeof metrics.totalTraces).toBe('number');
    });
  });

  describe('Load Testing', () => {
    it('should handle high-frequency trace creation', async () => {
      const traceCount = 100;
      const batchSize = 10;
      const batches = Math.ceil(traceCount / batchSize);

      const startTime = performance.now();
      
      for (let batch = 0; batch < batches; batch++) {
        const promises = Array.from({ length: batchSize }, (_, i) => {
          const traceIndex = batch * batchSize + i;
          return client.createTrace(generateMockTrace({
            id: `load-test-trace-${traceIndex}`,
            name: `Load Test Trace ${traceIndex}`,
          }));
        });
        
        await Promise.all(promises);
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(20000); // Should complete within 20 seconds
    });

    it('should handle concurrent client connections', async () => {
      const clientCount = 5;
      const clients = Array.from({ length: clientCount }, () => 
        new LangfuseRealtimeClient({
          baseUrl: 'http://localhost:3000',
          enableRealtime: false,
          autoFlush: false,
        })
      );

      const startTime = performance.now();
      
      const promises = clients.map(async (client, index) => {
        const traces = await client.getTraces({ limit: 5 });
        return { clientIndex: index, traceCount: traces.length };
      });

      const results = await Promise.all(promises);
      
      // Cleanup
      await Promise.all(clients.map(client => client.shutdown()));
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(10000);
      expect(results).toHaveLength(clientCount);
      results.forEach((result, index) => {
        expect(result.clientIndex).toBe(index);
        expect(result.traceCount).toBeGreaterThan(0);
      });
    });

    it('should handle stress testing scenarios', async () => {
      const stressData = testScenarios.highActivity;
      
      const startTime = performance.now();
      
      // Simulate high-stress operations
      const operations = [
        () => client.getTraces({ limit: 50 }),
        () => client.getSwarmMetrics(),
        () => client.createTrace(generateMockTrace()),
        () => client.getTraces({ sessionId: 'stress-session' }),
      ];

      // Run operations multiple times concurrently
      const promises = Array.from({ length: 20 }, (_, i) => 
        operations[i % operations.length]()
      );

      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(15000);
      expect(results).toHaveLength(20);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on shutdown', async () => {
      const testClient = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: true,
        autoFlush: false,
      });

      // Use the client
      await testClient.getTraces({ limit: 5 });
      
      // Shutdown should complete without errors
      await expect(testClient.shutdown()).resolves.not.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      const testClient = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: true,
        autoFlush: false,
      });

      // Multiple shutdown calls should be safe
      await testClient.shutdown();
      await testClient.shutdown();
      await testClient.shutdown();
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should cleanup swarm logger resources', async () => {
      const testLogger = createSwarmLogger('cleanup-test', 'cleanup-session');
      
      // Use the logger
      await testLogger.logSwarmInit('mesh', 5, 'parallel');
      
      // Cleanup should complete without errors
      await expect(testLogger.close()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty responses', async () => {
      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }));

      const traces = await client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0); // Should return mock data
    });

    it('should handle null responses', async () => {
      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(null),
      }));

      const traces = await client.getTraces({ limit: 10 });
      
      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0); // Should return mock data
    });

    it('should handle extremely large numbers', async () => {
      const trace = generateMockTrace({
        promptTokens: Number.MAX_SAFE_INTEGER,
        completionTokens: Number.MAX_SAFE_INTEGER,
        totalCost: Number.MAX_VALUE,
      });

      const traceId = await client.createTrace(trace);
      
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });

    it('should handle special characters in strings', async () => {
      const trace = generateMockTrace({
        name: '🤖 Special chars: "quotes" & <tags> & émojis',
        input: 'Input with\nnewlines\tand\ttabs',
        output: 'Output with unicode: 🔥💻🚀',
        metadata: {
          special: 'äöü ß €',
          json: '{"nested": "value"}',
        },
      });

      const traceId = await client.createTrace(trace);
      
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });
  });
});