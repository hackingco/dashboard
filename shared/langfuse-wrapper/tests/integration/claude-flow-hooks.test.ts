/**
 * Integration tests for Claude Flow hooks with Langfuse tracing
 * Tests end-to-end integration and real hook scenarios
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper } from '../../src/index';
import { ClaudeFlowLangfuseIntegration } from '../../src/claude-flow-integration';
import { createMockLangfuseClient, createMockDatabase } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('better-sqlite3');

describe('Claude Flow Hooks Integration', () => {
  let wrapper: LangfuseWrapper;
  let integration: ClaudeFlowLangfuseIntegration;
  let mockClient: any;
  let mockDb: any;
  let mockHookManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = createMockLangfuseClient();
    mockDb = createMockDatabase();
    
    // Setup mocks
    (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
    (require('better-sqlite3') as any).default = jest.fn(() => mockDb);
    
    wrapper = new LangfuseWrapper({
      publicKey: 'test-public',
      secretKey: 'test-secret'
    });
    
    integration = new ClaudeFlowLangfuseIntegration(wrapper);

    // Mock Claude Flow hook manager
    mockHookManager = {
      executeHook: jest.fn().mockImplementation(async (hookType: string, options: any) => {
        // Simulate successful hook execution
        return {
          success: true,
          data: { result: `${hookType} completed`, ...options },
          duration: 100
        };
      })
    };
  });

  afterEach(async () => {
    await integration.shutdown();
  });

  describe('Hook Manager Integration', () => {
    it('should register with Claude Flow hook manager successfully', () => {
      integration.registerWithClaudeFlow(mockHookManager);

      expect(typeof mockHookManager.executeHook).toBe('function');
    });

    it('should trace hook execution end-to-end', async () => {
      integration.registerWithClaudeFlow(mockHookManager);

      const result = await mockHookManager.executeHook('pre-task', {
        description: 'Test task',
        swarmId: 'swarm-123',
        agentId: 'agent-456',
        taskId: 'task-789'
      });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          result: 'pre-task completed',
          description: 'Test task'
        }),
        duration: 100
      });

      // Verify Langfuse tracing occurred
      expect(mockClient.trace).toHaveBeenCalledWith({
        id: expect.stringMatching(/^trace-\d+-[a-z0-9]+$/),
        name: 'pre-task',
        metadata: expect.objectContaining({
          swarm_id: 'swarm-123',
          agent_id: 'agent-456',
          task_id: 'task-789',
          claude_flow_hook: true
        })
      });

      expect(mockClient.flushAsync).toHaveBeenCalled();
    });

    it('should handle hook execution errors', async () => {
      const originalExecuteHook = mockHookManager.executeHook;
      mockHookManager.executeHook = jest.fn().mockRejectedValue(new Error('Hook failed'));
      
      integration.registerWithClaudeFlow(mockHookManager);

      await expect(mockHookManager.executeHook('failing-hook', {}))
        .rejects.toThrow('Hook failed');

      // Verify error was traced
      const traceId = expect.stringMatching(/^trace-\d+-[a-z0-9]+$/);
      expect(mockClient.trace).toHaveBeenCalledWith(expect.objectContaining({
        id: traceId,
        name: 'failing-hook'
      }));
    });

    it('should skip integration when Langfuse is disabled', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const disabledWrapper = new LangfuseWrapper({ enabled: false });
      const disabledIntegration = new ClaudeFlowLangfuseIntegration(disabledWrapper);
      
      disabledIntegration.registerWithClaudeFlow(mockHookManager);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Langfuse is not enabled, skipping Claude Flow integration'
      );
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('Specific Hook Handlers', () => {
    let hookHandlers: any;

    beforeEach(() => {
      hookHandlers = integration.createHookHandlers();
    });

    describe('Pre-Task Hook', () => {
      it('should handle pre-task hook with all options', async () => {
        const options = {
          description: 'Implement new feature',
          taskId: 'task-123',
          autoSpawnAgents: true,
          loadPreviousContext: true
        };

        const result = await hookHandlers['pre-task'](options);

        expect(result).toEqual({
          spanId: expect.stringMatching(/^span-\d+-[a-z0-9]+$/)
        });

        // Should create a span with proper metadata
        expect(mockClient.trace).toHaveBeenCalled();
        const mockTrace = mockClient.trace.mock.results[0].value;
        expect(mockTrace.span).toHaveBeenCalledWith(expect.objectContaining({
          name: 'pre-task',
          input: options,
          metadata: expect.objectContaining({
            task_description: 'Implement new feature',
            auto_spawn_agents: true,
            load_previous_context: true
          })
        }));
      });

      it('should handle pre-task hook without task ID', async () => {
        const options = {
          description: 'Simple task',
          autoSpawnAgents: false
        };

        const result = await hookHandlers['pre-task'](options);

        expect(result).toEqual({
          spanId: expect.stringMatching(/^span-\d+-[a-z0-9]+$/)
        });
      });
    });

    describe('Post-Task Hook', () => {
      it('should handle post-task hook and clean up spans', async () => {
        // First create a pre-task span
        const preTaskResult = await hookHandlers['pre-task']({
          taskId: 'task-123',
          description: 'Test task'
        });

        const options = {
          taskId: 'task-123',
          analyzePerformance: true,
          generateSummary: true
        };

        const result = await hookHandlers['post-task'](options);

        expect(result).toEqual({ completed: true });

        // Should end the span that was created in pre-task
        const mockTrace = mockClient.trace.mock.results[0].value;
        expect(mockTrace.span).toHaveBeenCalledWith(expect.objectContaining({
          id: preTaskResult.spanId,
          endTime: expect.any(Date),
          metadata: expect.objectContaining({
            analyze_performance: true,
            generate_summary: true
          })
        }));
      });

      it('should handle post-task hook without corresponding pre-task', async () => {
        const options = {
          taskId: 'orphan-task',
          analyzePerformance: false
        };

        const result = await hookHandlers['post-task'](options);

        expect(result).toEqual({ completed: true });
        // Should not attempt to end non-existent span
      });
    });

    describe('Edit Hooks', () => {
      it('should handle pre-edit hook', async () => {
        const options = {
          file: '/path/to/file.js',
          autoAssignAgent: true
        };

        const result = await hookHandlers['pre-edit'](options);

        expect(result).toEqual({
          spanId: expect.stringMatching(/^span-\d+-[a-z0-9]+$/)
        });

        const mockTrace = mockClient.trace.mock.results[0].value;
        expect(mockTrace.span).toHaveBeenCalledWith(expect.objectContaining({
          name: 'pre-edit',
          input: options,
          metadata: expect.objectContaining({
            file: '/path/to/file.js',
            auto_assign_agent: true
          })
        }));
      });

      it('should handle post-edit hook with memory storage', async () => {
        const options = {
          file: '/path/to/file.js',
          memoryKey: 'agent/coder/edit-123',
          autoFormat: true,
          trackChanges: true
        };

        const result = await hookHandlers['post-edit'](options);

        expect(result).toEqual({ traced: true });

        expect(mockClient.trace).toHaveBeenCalledWith(expect.objectContaining({
          name: 'post-edit',
          metadata: expect.objectContaining({
            file: '/path/to/file.js',
            memory_key: 'agent/coder/edit-123',
            auto_format: true,
            track_changes: true
          })
        }));
      });
    });

    describe('Search Hooks', () => {
      it('should handle pre-search hook with caching options', async () => {
        const options = {
          query: 'function implementation',
          cacheResults: true,
          suggestOptimizations: true
        };

        const result = await hookHandlers['pre-search'](options);

        expect(result).toEqual({
          spanId: expect.stringMatching(/^span-\d+-[a-z0-9]+$/)
        });

        const mockTrace = mockClient.trace.mock.results[0].value;
        expect(mockTrace.span).toHaveBeenCalledWith(expect.objectContaining({
          name: 'pre-search',
          input: options,
          metadata: expect.objectContaining({
            query: 'function implementation',
            cache_results: true,
            suggest_optimizations: true
          })
        }));
      });
    });

    describe('Session Hooks', () => {
      it('should handle complete session lifecycle', async () => {
        // Start session
        const startOptions = {
          sessionId: 'session-123',
          sessionName: 'Development Session'
        };

        const startResult = await hookHandlers['session-start'](startOptions);

        expect(startResult).toEqual({
          traceId: expect.stringMatching(/^trace-\d+-[a-z0-9]+$/)
        });

        // Restore session
        const restoreOptions = {
          sessionId: 'session-123',
          loadMemory: true
        };

        const restoreResult = await hookHandlers['session-restore'](restoreOptions);

        expect(restoreResult).toEqual({ traced: true });

        // End session
        const endOptions = {
          sessionId: 'session-123',
          exportMetrics: true,
          generateSummary: true
        };

        const endResult = await hookHandlers['session-end'](endOptions);

        expect(endResult).toEqual({ completed: true });

        // Should have called trace multiple times for session lifecycle
        expect(mockClient.trace).toHaveBeenCalledTimes(3);
      });

      it('should handle session-end without corresponding session-start', async () => {
        const options = {
          sessionId: 'orphan-session',
          exportMetrics: false
        };

        const result = await hookHandlers['session-end'](options);

        expect(result).toEqual({ completed: true });
      });
    });

    describe('Notification Hook', () => {
      it('should handle notification hook with telemetry', async () => {
        const options = {
          message: 'Build completed successfully',
          category: 'build',
          telemetry: true
        };

        const result = await hookHandlers['notification'](options);

        expect(result).toEqual({ traced: true });

        expect(mockClient.trace).toHaveBeenCalledWith(expect.objectContaining({
          name: 'notification',
          metadata: expect.objectContaining({
            message: 'Build completed successfully',
            category: 'build',
            telemetry: true
          })
        }));
      });
    });
  });

  describe('Token Usage Extraction', () => {
    beforeEach(() => {
      integration.registerWithClaudeFlow(mockHookManager);
    });

    it('should extract token usage from various result formats', async () => {
      const testCases = [
        {
          name: 'direct tokens property',
          mockResult: {
            success: true,
            data: { tokens: { input: 100, output: 200 } }
          }
        },
        {
          name: 'tokenUsage property',
          mockResult: {
            success: true,
            data: { tokenUsage: { input: 150, output: 250 } }
          }
        },
        {
          name: 'nested in metrics',
          mockResult: {
            success: true,
            data: { metrics: { tokens: { input: 75, output: 125 } } }
          }
        },
        {
          name: 'text-based estimation',
          mockResult: {
            success: true,
            data: {
              prompt: 'A'.repeat(400), // 400 chars ≈ 100 tokens
              response: 'B'.repeat(800) // 800 chars ≈ 200 tokens
            }
          }
        }
      ];

      for (const testCase of testCases) {
        mockHookManager.executeHook.mockResolvedValueOnce(testCase.mockResult);

        await mockHookManager.executeHook('test-hook', { test: testCase.name });

        // Verify generation tracking was called with token usage
        const mockTrace = mockClient.trace.mock.results[mockClient.trace.mock.results.length - 1].value;
        expect(mockTrace.generation).toHaveBeenCalled();
        
        const generationCall = mockTrace.generation.mock.calls[0][0];
        expect(generationCall.usage).toBeDefined();
        expect(generationCall.usage.promptTokens).toBeGreaterThan(0);
        expect(generationCall.usage.completionTokens).toBeGreaterThan(0);
      }
    });

    it('should handle results without token usage', async () => {
      mockHookManager.executeHook.mockResolvedValueOnce({
        success: true,
        data: { result: 'No token info' }
      });

      await mockHookManager.executeHook('no-tokens', {});

      // Should still complete trace without generation tracking
      expect(mockClient.flushAsync).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(() => {
      integration.registerWithClaudeFlow(mockHookManager);
    });

    it('should handle Langfuse client errors during hook execution', async () => {
      mockClient.trace.mockImplementationOnce(() => {
        throw new Error('Langfuse API error');
      });

      // Should not throw despite Langfuse error
      const result = await mockHookManager.executeHook('test-hook', {});
      
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          result: 'test-hook completed'
        }),
        duration: 100
      });
    });

    it('should handle hook handler internal errors', async () => {
      const handlers = integration.createHookHandlers();
      
      // Mock wrapper to throw error
      jest.spyOn(wrapper, 'createSpan').mockRejectedValueOnce(new Error('Span creation failed'));

      // Should not throw
      const result = await handlers['pre-task']({ description: 'Test' });
      
      // May return partial result or handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(() => {
      integration.registerWithClaudeFlow(mockHookManager);
    });

    it('should handle concurrent hook executions', async () => {
      const concurrentHooks = Array(10).fill(0).map((_, i) =>
        mockHookManager.executeHook(`concurrent-hook-${i}`, { index: i })
      );

      const results = await Promise.all(concurrentHooks);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);

      // Should have created 10 traces
      expect(mockClient.trace).toHaveBeenCalledTimes(10);
    });

    it('should maintain hook execution order', async () => {
      const executionOrder: number[] = [];
      
      mockHookManager.executeHook.mockImplementation(async (hookType: string, options: any) => {
        if (options.index !== undefined) {
          executionOrder.push(options.index);
        }
        return { success: true, data: { hookType }, duration: 50 };
      });

      // Execute hooks sequentially
      for (let i = 0; i < 5; i++) {
        await mockHookManager.executeHook('sequential-hook', { index: i });
      }

      expect(executionOrder).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should clean up resources on shutdown', async () => {
      integration.registerWithClaudeFlow(mockHookManager);

      // Execute some hooks to create traces
      await mockHookManager.executeHook('test-hook-1', {});
      await mockHookManager.executeHook('test-hook-2', {});

      expect(wrapper.getActiveTraceCount()).toBeGreaterThan(0);

      await integration.shutdown();

      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(mockClient.shutdownAsync).toHaveBeenCalled();
    });

    it('should handle multiple shutdown calls gracefully', async () => {
      await integration.shutdown();
      await integration.shutdown();
      await integration.shutdown();

      // Should not throw or cause issues
      expect(mockClient.shutdownAsync).toHaveBeenCalledTimes(1);
    });
  });
});