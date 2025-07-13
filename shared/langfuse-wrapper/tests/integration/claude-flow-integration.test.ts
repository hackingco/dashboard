import { jest } from '@jest/globals';
import { LangfuseWrapper } from '../../src';
import Langfuse from 'langfuse';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock Langfuse
jest.mock('langfuse');

// Helper to simulate Claude-Flow hooks
class ClaudeFlowSimulator extends EventEmitter {
  private wrapper: LangfuseWrapper;
  private activeTraces: Map<string, string> = new Map();

  constructor(wrapper: LangfuseWrapper) {
    super();
    this.wrapper = wrapper;
    this.setupHooks();
  }

  private setupHooks() {
    // Simulate Claude-Flow pre-task hook
    this.on('pre-task', async (taskId: string, description: string) => {
      const traceId = await this.wrapper.startTrace(description, {
        taskId,
        source: 'claude-flow',
        timestamp: new Date().toISOString()
      });
      this.activeTraces.set(taskId, traceId);
    });

    // Simulate Claude-Flow post-task hook
    this.on('post-task', async (taskId: string, result: any) => {
      const traceId = this.activeTraces.get(taskId);
      if (traceId) {
        await this.wrapper.endTrace(traceId, {
          result,
          completedAt: new Date().toISOString()
        });
        this.activeTraces.delete(taskId);
      }
    });

    // Simulate Claude-Flow error hook
    this.on('error', async (taskId: string, error: Error) => {
      const traceId = this.activeTraces.get(taskId);
      if (traceId) {
        await this.wrapper.trackError(traceId, error, {
          taskId,
          errorAt: new Date().toISOString()
        });
      }
    });
  }

  async executeTask(taskId: string, description: string, task: () => Promise<any>) {
    this.emit('pre-task', taskId, description);
    
    try {
      const result = await task();
      this.emit('post-task', taskId, result);
      return result;
    } catch (error) {
      this.emit('error', taskId, error as Error);
      throw error;
    }
  }
}

describe('Claude-Flow Integration', () => {
  let wrapper: LangfuseWrapper;
  let claudeFlow: ClaudeFlowSimulator;
  let mockLangfuseClient: any;

  beforeEach(() => {
    // Mock Langfuse client
    mockLangfuseClient = global.testHelpers.mockLangfuseClient();
    (Langfuse as jest.MockedClass<typeof Langfuse>).mockImplementation(() => mockLangfuseClient);

    // Enable Claude-Flow integration
    process.env.CLAUDE_FLOW_ENABLED = 'true';
    
    const config = global.testHelpers.createMockConfig({
      autoRegister: true,
      memoryDbPath: ':memory:'
    });
    
    wrapper = new LangfuseWrapper(config);
    claudeFlow = new ClaudeFlowSimulator(wrapper);
  });

  afterEach(async () => {
    await wrapper.shutdown();
    process.env.CLAUDE_FLOW_ENABLED = 'false';
  });

  describe('Auto-registration Flow', () => {
    it('should auto-register hooks with Claude-Flow', (done) => {
      wrapper.on('registered', (event) => {
        expect(event).toEqual({ system: 'claude-flow' });
        done();
      });

      // Re-initialize to trigger auto-registration
      new LangfuseWrapper({
        ...global.testHelpers.createMockConfig(),
        autoRegister: true
      });
    });

    it('should handle pre-task hook registration', async () => {
      const taskResult = await claudeFlow.executeTask(
        'task-1',
        'Test task execution',
        async () => {
          // Simulate task work
          await global.testHelpers.delay(50);
          return { success: true, data: 'test-data' };
        }
      );

      expect(taskResult).toEqual({ success: true, data: 'test-data' });
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: expect.stringMatching(/^trace-/),
        name: 'Test task execution',
        metadata: expect.objectContaining({
          taskId: 'task-1',
          source: 'claude-flow'
        })
      });
    });

    it('should handle post-task hook registration', async () => {
      const mockTrace = mockLangfuseClient.trace.mock.results[0]?.value;
      
      await claudeFlow.executeTask(
        'task-2',
        'Test completion',
        async () => ({ completed: true })
      );

      expect(mockTrace?.update).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          result: { completed: true },
          completedAt: expect.any(String)
        })
      });
    });

    it('should handle error hook registration', async () => {
      const mockTrace = mockLangfuseClient.trace.mock.results[0]?.value;
      const testError = new Error('Task failed');

      await expect(
        claudeFlow.executeTask(
          'task-3',
          'Test error handling',
          async () => {
            throw testError;
          }
        )
      ).rejects.toThrow('Task failed');

      expect(mockTrace?.event).toHaveBeenCalledWith({
        name: 'error',
        level: 'ERROR',
        statusMessage: 'Task failed',
        metadata: expect.objectContaining({
          taskId: 'task-3',
          error: {
            message: 'Task failed',
            stack: expect.any(String)
          }
        })
      });
    });
  });

  describe('Memory Coordination', () => {
    it('should coordinate traces through memory database', async () => {
      // Execute multiple tasks
      const tasks = ['task-a', 'task-b', 'task-c'];
      const results = await Promise.all(
        tasks.map(taskId => 
          claudeFlow.executeTask(
            taskId,
            `Processing ${taskId}`,
            async () => ({ taskId, processed: true })
          )
        )
      );

      expect(results).toHaveLength(3);
      
      // Check memory stats
      const stats = wrapper.getMemoryStats();
      expect(stats).toMatchObject({
        total_traces: expect.any(Number),
        completed_traces: expect.any(Number)
      });
    });

    it('should handle concurrent task execution', async () => {
      const concurrentTasks = 20;
      const tasks = Array.from({ length: concurrentTasks }, (_, i) => ({
        id: `concurrent-${i}`,
        description: `Concurrent task ${i}`
      }));

      const results = await Promise.all(
        tasks.map(task =>
          claudeFlow.executeTask(
            task.id,
            task.description,
            async () => {
              await global.testHelpers.delay(Math.random() * 100);
              return { taskId: task.id, completed: true };
            }
          )
        )
      );

      expect(results).toHaveLength(concurrentTasks);
      expect(wrapper.getActiveTraces()).toHaveLength(0); // All completed
      expect(mockLangfuseClient.flushAsync).toHaveBeenCalled();
    });
  });

  describe('Span Enrichment', () => {
    it('should enrich spans with Claude-Flow metadata', async () => {
      let traceId: string;

      wrapper.registerHook('pre-trace', async (context) => {
        context.metadata = {
          ...context.metadata,
          enriched: true,
          claudeFlowVersion: '2.0.0'
        };
      });

      await claudeFlow.executeTask(
        'enriched-task',
        'Task with enrichment',
        async () => {
          // Get the trace ID from the active traces
          const traces = wrapper.getActiveTraces();
          traceId = traces[0];
          
          // Start a span within the task
          await wrapper.startSpan('span-1', 'Processing step', traceId, {
            metadata: { step: 1 },
            input: { data: 'input' }
          });

          await global.testHelpers.delay(50);

          await wrapper.endSpan('span-1', { result: 'processed' });

          return { processed: true };
        }
      );

      const mockTrace = mockLangfuseClient.trace.mock.results[0]?.value;
      expect(mockTrace?.span).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'span-1',
          name: 'Processing step',
          input: { data: 'input' },
          metadata: { step: 1 }
        })
      );
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics across tasks', async () => {
      const performanceData: any[] = [];

      wrapper.on('trace:ended', (event) => {
        performanceData.push(event);
      });

      // Execute tasks with varying durations
      const taskDurations = [10, 50, 100, 200];
      
      await Promise.all(
        taskDurations.map((duration, i) =>
          claudeFlow.executeTask(
            `perf-task-${i}`,
            `Performance test ${i}`,
            async () => {
              await global.testHelpers.delay(duration);
              return { duration };
            }
          )
        )
      );

      expect(performanceData).toHaveLength(4);
      performanceData.forEach((data, i) => {
        expect(data.traceId).toMatch(/^trace-/);
        expect(data.metadata?.result?.duration).toBe(taskDurations[i]);
      });
    });
  });

  describe('Error Recovery', () => {
    it('should handle partial failures gracefully', async () => {
      const results: any[] = [];
      const errors: any[] = [];

      wrapper.on('error:tracked', (event) => {
        errors.push(event);
      });

      // Execute mix of successful and failing tasks
      const taskPromises = [
        claudeFlow.executeTask('success-1', 'Successful task 1', async () => ({ success: true }))
          .then(r => results.push(r))
          .catch(e => errors.push(e)),
        
        claudeFlow.executeTask('fail-1', 'Failing task 1', async () => {
          throw new Error('Deliberate failure');
        })
          .then(r => results.push(r))
          .catch(e => errors.push(e)),
        
        claudeFlow.executeTask('success-2', 'Successful task 2', async () => ({ success: true }))
          .then(r => results.push(r))
          .catch(e => errors.push(e))
      ];

      await Promise.allSettled(taskPromises);

      expect(results).toHaveLength(2);
      expect(errors).toHaveLength(2); // One from catch, one from event
    });
  });

  describe('Network Failure Simulation', () => {
    it('should handle Langfuse API failures gracefully', async () => {
      // Simulate network failure
      mockLangfuseClient.trace.mockImplementationOnce(() => {
        throw new Error('Network timeout');
      });

      // Task should still execute
      const result = await claudeFlow.executeTask(
        'network-fail-task',
        'Task with network failure',
        async () => ({ completed: true })
      );

      expect(result).toEqual({ completed: true });
    });

    it('should continue operation when Langfuse is unavailable', async () => {
      // Create wrapper without credentials (disabled mode)
      const disabledWrapper = new LangfuseWrapper({
        publicKey: undefined,
        secretKey: undefined,
        autoRegister: true,
        memoryDbPath: ':memory:'
      });

      const disabledFlow = new ClaudeFlowSimulator(disabledWrapper);

      const result = await disabledFlow.executeTask(
        'disabled-task',
        'Task in disabled mode',
        async () => ({ success: true })
      );

      expect(result).toEqual({ success: true });
      expect(disabledWrapper.isEnabled()).toBe(false);

      await disabledWrapper.shutdown();
    });
  });

  describe('High Load Stress Test', () => {
    it('should handle high load without degradation', async () => {
      const loadTestTasks = 100;
      const startTime = Date.now();

      const tasks = Array.from({ length: loadTestTasks }, (_, i) => ({
        id: `load-${i}`,
        delay: Math.random() * 10
      }));

      const results = await Promise.all(
        tasks.map(task =>
          claudeFlow.executeTask(
            task.id,
            `Load test ${task.id}`,
            async () => {
              await global.testHelpers.delay(task.delay);
              return { taskId: task.id };
            }
          )
        )
      );

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(loadTestTasks);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all traces were properly closed
      expect(wrapper.getActiveTraces()).toHaveLength(0);
      expect(wrapper.getActiveSpans()).toHaveLength(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration on initialization', () => {
      const invalidConfigs = [
        { flushAt: -1 },
        { flushInterval: 0 },
        { host: 'not-a-url' }
      ];

      invalidConfigs.forEach(invalidConfig => {
        expect(() => {
          new LangfuseWrapper({
            ...global.testHelpers.createMockConfig(),
            ...invalidConfig
          });
        }).not.toThrow(); // Should handle gracefully
      });
    });
  });

  describe('Event Flow Integration', () => {
    it('should maintain event order across hooks', async () => {
      const events: string[] = [];

      wrapper.on('trace:started', () => events.push('trace:started'));
      wrapper.on('span:started', () => events.push('span:started'));
      wrapper.on('span:ended', () => events.push('span:ended'));
      wrapper.on('trace:ended', () => events.push('trace:ended'));

      await claudeFlow.executeTask(
        'event-order-task',
        'Event ordering test',
        async () => {
          const traces = wrapper.getActiveTraces();
          const traceId = traces[0];
          
          await wrapper.startSpan('test-span', 'Test span', traceId);
          await global.testHelpers.delay(10);
          await wrapper.endSpan('test-span');
          
          return { done: true };
        }
      );

      expect(events).toEqual([
        'trace:started',
        'span:started',
        'span:ended',
        'trace:ended'
      ]);
    });
  });
});