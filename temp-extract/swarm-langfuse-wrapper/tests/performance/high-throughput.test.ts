/**
 * Performance tests for Langfuse wrapper
 * Validates high-throughput scenarios and memory efficiency
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper, HookContext } from '../../src/index';
import { createMockLangfuseClient, performanceUtils } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('better-sqlite3');

describe('Langfuse Wrapper Performance Tests', () => {
  let wrapper: LangfuseWrapper;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = createMockLangfuseClient();
    (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
    (require('better-sqlite3') as any).default = jest.fn(() => ({
      exec: jest.fn(),
      prepare: jest.fn(() => ({
        run: jest.fn(),
        get: jest.fn(() => ({ total_traces: 0 }))
      })),
      close: jest.fn()
    }));
    
    wrapper = new LangfuseWrapper({
      publicKey: 'test-public',
      secretKey: 'test-secret',
      flushAt: 100, // Higher flush threshold for performance
      flushInterval: 5000
    });
  });

  afterEach(async () => {
    await wrapper.shutdown();
  });

  describe('High Throughput Scenarios', () => {
    it('should handle 1000+ traces per second', async () => {
      const traceCount = 1000;
      const timeLimit = 1000; // 1 second

      const { duration, result: traces } = await performanceUtils.measureAsyncExecution(async () => {
        const operations = Array(traceCount).fill(0).map(async (_, i) => {
          const context: HookContext = {
            hookType: `perf-test-${i}`,
            swarmId: 'perf-swarm',
            agentId: `agent-${i % 10}`, // 10 different agents
            metadata: { index: i, batch: Math.floor(i / 100) }
          };
          
          const traceId = await wrapper.preHook(context);
          await wrapper.postHook(traceId, { result: `completed-${i}` });
          return traceId;
        });

        return Promise.all(operations);
      });

      expect(traces).toHaveLength(traceCount);
      expect(traces.every(id => id !== null)).toBe(true);
      expect(duration).toBeLessThan(timeLimit);
      
      // Calculate actual throughput
      const throughput = traceCount / (duration / 1000);
      console.log(`Achieved throughput: ${throughput.toFixed(2)} traces/second`);
      expect(throughput).toBeGreaterThan(1000);
    });

    it('should maintain performance with concurrent agents', async () => {
      const agentCount = 20;
      const tracesPerAgent = 50;
      const totalTraces = agentCount * tracesPerAgent;

      const { duration } = await performanceUtils.measureAsyncExecution(async () => {
        // Simulate multiple agents working concurrently
        const agentOperations = Array(agentCount).fill(0).map(async (_, agentIndex) => {
          const agentTraces = Array(tracesPerAgent).fill(0).map(async (_, traceIndex) => {
            const context: HookContext = {
              hookType: 'agent-operation',
              swarmId: 'concurrent-swarm',
              agentId: `agent-${agentIndex}`,
              agentRole: 'concurrent-worker',
              taskId: `task-${agentIndex}-${traceIndex}`,
              metadata: { 
                agent_index: agentIndex,
                trace_index: traceIndex,
                operation_type: 'concurrent_processing'
              }
            };

            const traceId = await wrapper.preHook(context);
            
            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            
            await wrapper.postHook(traceId, {
              agent: agentIndex,
              trace: traceIndex,
              processing_time: Math.random() * 100
            });

            return traceId;
          });

          return Promise.all(agentTraces);
        });

        const results = await Promise.all(agentOperations);
        return results.flat();
      });

      const throughput = totalTraces / (duration / 1000);
      console.log(`Concurrent throughput: ${throughput.toFixed(2)} traces/second with ${agentCount} agents`);
      
      expect(throughput).toBeGreaterThan(800); // Slightly lower due to artificial delays
      expect(wrapper.getActiveTraceCount()).toBe(0); // All should be completed
    });

    it('should handle burst traffic patterns', async () => {
      const burstCount = 200;
      const burstInterval = 100; // 100ms between bursts
      const totalBursts = 5;

      const allTraces: string[] = [];

      const { duration } = await performanceUtils.measureAsyncExecution(async () => {
        for (let burst = 0; burst < totalBursts; burst++) {
          // Create a burst of traces
          const burstTraces = await Promise.all(
            Array(burstCount).fill(0).map(async (_, i) => {
              const context: HookContext = {
                hookType: 'burst-operation',
                metadata: { 
                  burst_id: burst,
                  trace_in_burst: i,
                  timestamp: Date.now()
                }
              };

              const traceId = await wrapper.preHook(context);
              await wrapper.postHook(traceId, { burst, index: i });
              return traceId;
            })
          );

          allTraces.push(...burstTraces);

          // Wait between bursts (except for the last one)
          if (burst < totalBursts - 1) {
            await new Promise(resolve => setTimeout(resolve, burstInterval));
          }
        }
      });

      expect(allTraces).toHaveLength(burstCount * totalBursts);
      
      const averageThroughput = allTraces.length / (duration / 1000);
      console.log(`Burst pattern throughput: ${averageThroughput.toFixed(2)} traces/second`);
      
      expect(averageThroughput).toBeGreaterThan(800);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not accumulate memory with long-running operations', async () => {
      const batchSize = 100;
      const batchCount = 10;

      // Process multiple batches to test memory cleanup
      for (let batch = 0; batch < batchCount; batch++) {
        const batchTraces = await Promise.all(
          Array(batchSize).fill(0).map(async (_, i) => {
            const context: HookContext = {
              hookType: 'memory-test',
              metadata: { 
                batch_id: batch,
                trace_id: i,
                large_data: 'x'.repeat(1000) // Simulate larger payloads
              }
            };

            const traceId = await wrapper.preHook(context);
            await wrapper.postHook(traceId, {
              batch,
              index: i,
              large_result: 'y'.repeat(2000)
            });
            
            return traceId;
          })
        );

        // Verify all traces in batch are completed
        expect(batchTraces).toHaveLength(batchSize);
        expect(wrapper.getActiveTraceCount()).toBe(0);

        console.log(`Completed batch ${batch + 1}/${batchCount}`);
      }

      // Memory should be stable after all batches
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });

    it('should handle large payload data efficiently', async () => {
      const largePayloadSize = 50000; // 50KB strings
      const traceCount = 50;

      const { duration } = await performanceUtils.measureAsyncExecution(async () => {
        const traces = Array(traceCount).fill(0).map(async (_, i) => {
          const context: HookContext = {
            hookType: 'large-payload-test',
            metadata: {
              large_input: 'A'.repeat(largePayloadSize),
              trace_index: i
            }
          };

          const traceId = await wrapper.preHook(context);
          
          await wrapper.postHook(traceId, {
            large_output: 'B'.repeat(largePayloadSize),
            processing_complete: true
          });

          return traceId;
        });

        return Promise.all(traces);
      });

      const throughput = traceCount / (duration / 1000);
      console.log(`Large payload throughput: ${throughput.toFixed(2)} traces/second`);
      
      // Should still maintain reasonable performance with large payloads
      expect(throughput).toBeGreaterThan(20);
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });
  });

  describe('Span Performance', () => {
    it('should handle nested spans efficiently', async () => {
      const parentTraceCount = 50;
      const spansPerTrace = 20;

      const { duration } = await performanceUtils.measureAsyncExecution(async () => {
        const operations = Array(parentTraceCount).fill(0).map(async (_, traceIndex) => {
          const context: HookContext = {
            hookType: 'nested-span-test',
            metadata: { trace_index: traceIndex }
          };

          const traceId = await wrapper.preHook(context);

          // Create multiple nested spans
          const spanOperations = Array(spansPerTrace).fill(0).map(async (_, spanIndex) => {
            const spanId = await wrapper.createSpan(
              traceId!,
              `span-${spanIndex}`,
              { span_index: spanIndex },
              { parent_trace: traceIndex }
            );

            // Simulate span work
            await new Promise(resolve => setTimeout(resolve, 1));

            await wrapper.endSpan(spanId!, {
              span_result: `completed-${spanIndex}`
            });

            return spanId;
          });

          await Promise.all(spanOperations);
          
          await wrapper.postHook(traceId, {
            spans_completed: spansPerTrace
          });

          return traceId;
        });

        return Promise.all(operations);
      });

      const totalOperations = parentTraceCount * (spansPerTrace + 1); // +1 for main trace
      const throughput = totalOperations / (duration / 1000);
      
      console.log(`Nested span throughput: ${throughput.toFixed(2)} operations/second`);
      
      expect(throughput).toBeGreaterThan(500);
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });
  });

  describe('Error Handling Performance', () => {
    it('should maintain performance when handling errors', async () => {
      const traceCount = 200;
      const errorRate = 0.3; // 30% error rate

      const { duration } = await performanceUtils.measureAsyncExecution(async () => {
        const operations = Array(traceCount).fill(0).map(async (_, i) => {
          const context: HookContext = {
            hookType: 'error-test',
            metadata: { trace_index: i }
          };

          const traceId = await wrapper.preHook(context);

          if (Math.random() < errorRate) {
            // Simulate error scenario
            const error = new Error(`Simulated error for trace ${i}`);
            await wrapper.errorHook(traceId, error, {
              error_type: 'simulated',
              retry_count: 0
            });
          } else {
            // Normal completion
            await wrapper.postHook(traceId, {
              success: true,
              trace_index: i
            });
          }

          return traceId;
        });

        return Promise.all(operations);
      });

      const throughput = traceCount / (duration / 1000);
      console.log(`Error handling throughput: ${throughput.toFixed(2)} traces/second (${(errorRate * 100)}% error rate)`);
      
      expect(throughput).toBeGreaterThan(400);
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });
  });

  describe('Concurrent Resource Management', () => {
    it('should handle multiple wrapper instances efficiently', async () => {
      const wrapperCount = 5;
      const tracesPerWrapper = 100;

      // Create multiple wrapper instances
      const wrappers = Array(wrapperCount).fill(0).map(() => 
        new LangfuseWrapper({
          publicKey: 'test-public',
          secretKey: 'test-secret'
        })
      );

      try {
        const { duration } = await performanceUtils.measureAsyncExecution(async () => {
          const wrapperOperations = wrappers.map(async (w, wrapperIndex) => {
            const traces = Array(tracesPerWrapper).fill(0).map(async (_, traceIndex) => {
              const context: HookContext = {
                hookType: 'multi-wrapper-test',
                metadata: {
                  wrapper_id: wrapperIndex,
                  trace_index: traceIndex
                }
              };

              const traceId = await w.preHook(context);
              await w.postHook(traceId, {
                wrapper: wrapperIndex,
                trace: traceIndex
              });

              return traceId;
            });

            return Promise.all(traces);
          });

          const results = await Promise.all(wrapperOperations);
          return results.flat();
        });

        const totalTraces = wrapperCount * tracesPerWrapper;
        const throughput = totalTraces / (duration / 1000);
        
        console.log(`Multi-wrapper throughput: ${throughput.toFixed(2)} traces/second across ${wrapperCount} instances`);
        
        expect(throughput).toBeGreaterThan(600);

        // Verify all wrappers are clean
        wrappers.forEach(w => {
          expect(w.getActiveTraceCount()).toBe(0);
        });

      } finally {
        // Clean up all wrappers
        await Promise.all(wrappers.map(w => w.shutdown()));
      }
    });
  });

  describe('Resource Cleanup Performance', () => {
    it('should shutdown quickly with many active traces', async () => {
      const activeTraceCount = 500;

      // Create many active traces
      const activeTraces = await Promise.all(
        Array(activeTraceCount).fill(0).map((_, i) =>
          wrapper.preHook({
            hookType: 'shutdown-test',
            metadata: { trace_index: i }
          })
        )
      );

      expect(wrapper.getActiveTraceCount()).toBe(activeTraceCount);

      // Measure shutdown time
      const { duration } = await performanceUtils.measureAsyncExecution(async () => {
        await wrapper.shutdown();
      });

      console.log(`Shutdown time with ${activeTraceCount} active traces: ${duration.toFixed(2)}ms`);
      
      // Should shutdown quickly even with many active traces
      expect(duration).toBeLessThan(500); // Less than 500ms
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });
  });
});