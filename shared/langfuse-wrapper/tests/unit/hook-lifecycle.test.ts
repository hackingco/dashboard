/**
 * Comprehensive tests for hook lifecycle methods
 * Focus on preHook, postHook, and errorHook with full coverage
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper, HookContext, TokenUsage } from '../../src';
import { createMockLangfuseClient, createMockLangfuseConstructor } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('child_process');

const MockLangfuse = createMockLangfuseConstructor();

describe('Hook Lifecycle Tests', () => {
  let wrapper: LangfuseWrapper;
  let mockClient: any;
  let mockExecSync: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockLangfuseClient();
    
    // Setup mocks
    (require('langfuse') as any).Langfuse = MockLangfuse;
    MockLangfuse.mockImplementation(() => mockClient);
    
    // Mock child_process for SQLite coordination
    mockExecSync = jest.fn().mockReturnValue('0');
    (require('child_process') as any).execSync = mockExecSync;
    
    wrapper = new LangfuseWrapper({
      publicKey: 'test-public',
      secretKey: 'test-secret'
    });
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.shutdown();
    }
  });

  describe('preHook', () => {
    it('should handle complete hook context with all fields', async () => {
      const context: HookContext = {
        hookType: 'comprehensive-test',
        swarmId: 'swarm-123',
        agentId: 'agent-456',
        agentRole: 'researcher',
        taskId: 'task-789',
        operationType: 'data-analysis',
        metadata: {
          priority: 'high',
          retry_count: 0,
          parent_trace: 'parent-123'
        }
      };

      const traceId = await wrapper.preHook(context);
      
      expect(traceId).toMatch(/^trace-\d+-[a-z0-9]+$/);
      expect(mockClient.trace).toHaveBeenCalledWith({
        id: traceId,
        name: 'comprehensive-test',
        metadata: expect.objectContaining({
          swarm_id: 'swarm-123',
          agent_id: 'agent-456',
          agent_role: 'researcher',
          task_id: 'task-789',
          operation_type: 'data-analysis',
          hook_stage: 'pre',
          priority: 'high',
          retry_count: 0,
          parent_trace: 'parent-123',
          timestamp: expect.any(String),
          environment: 'test',
          claude_flow_version: 'unknown',
          swarm_coordination_enabled: true
        })
      });
    });

    it('should handle minimal hook context gracefully', async () => {
      const context: HookContext = {
        hookType: 'minimal-test'
      };

      const traceId = await wrapper.preHook(context);
      
      expect(traceId).toBeTruthy();
      expect(mockClient.trace).toHaveBeenCalledWith({
        id: expect.any(String),
        name: 'minimal-test',
        metadata: expect.objectContaining({
          hook_stage: 'pre',
          swarm_id: expect.stringMatching(/^swarm-/),
          agent_id: expect.stringMatching(/^general-/),
          agent_role: 'general'
        })
      });
    });

    it('should infer agent role from hook type description', async () => {
      const testCases = [
        { hookType: 'researcher-task', expectedRole: 'researcher' },
        { hookType: 'coder-implementation', expectedRole: 'coder' },
        { hookType: 'analyst-review', expectedRole: 'analyst' },
        { hookType: 'tester-validation', expectedRole: 'tester' },
        { hookType: 'coordinator-sync', expectedRole: 'coordinator' },
        { hookType: 'unknown-task', expectedRole: 'general' }
      ];

      for (const testCase of testCases) {
        const context: HookContext = {
          hookType: testCase.hookType
        };

        const traceId = await wrapper.preHook(context);
        
        expect(traceId).toBeTruthy();
        const traceCall = mockClient.trace.mock.calls.find(
          (call: any) => call[0].name === testCase.hookType
        );
        expect(traceCall[0].metadata.agent_role).toBe(testCase.expectedRole);
      }
    });

    it('should handle SQLite coordination context', async () => {
      // Mock SQLite responses
      mockExecSync
        .mockReturnValueOnce('5') // active agents count
        .mockReturnValueOnce('1234567890'); // last activity timestamp

      const context: HookContext = {
        hookType: 'coordinated-task',
        swarmId: 'swarm-456',
        agentId: 'agent-789'
      };

      const traceId = await wrapper.preHook(context);
      
      expect(traceId).toBeTruthy();
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) FROM agent_interactions'),
        expect.any(Object)
      );
      
      const traceMetadata = mockClient.trace.mock.calls[0][0].metadata;
      expect(traceMetadata.coordination_memory).toEqual({
        activeAgents: 5,
        coordinationState: 'coordinated',
        lastActivity: expect.any(String)
      });
    });

    it('should handle SQLite failures gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('SQLite error');
      });

      const context: HookContext = {
        hookType: 'sqlite-error-test',
        swarmId: 'swarm-error',
        agentId: 'agent-error'
      };

      const traceId = await wrapper.preHook(context);
      
      expect(traceId).toBeTruthy();
      const traceMetadata = mockClient.trace.mock.calls[0][0].metadata;
      expect(traceMetadata.coordination_memory).toEqual({
        activeAgents: 0,
        coordinationState: 'error',
        lastActivity: null,
        error: true
      });
    });
  });

  describe('postHook', () => {
    let traceId: string;
    let mockTrace: any;

    beforeEach(async () => {
      const context: HookContext = { hookType: 'test-operation' };
      traceId = await wrapper.preHook(context);
      mockTrace = mockClient.getTrace(traceId);
    });

    it('should complete trace with token usage and metadata', async () => {
      const result = { success: true, data: 'processed' };
      const tokenUsage: TokenUsage = { input: 500, output: 1000, total: 1500 };
      const metadata = { 
        model: 'claude-3-sonnet',
        temperature: 0.7,
        completion_reason: 'stop'
      };

      await wrapper.postHook(traceId, result, tokenUsage, metadata);

      // Check span update
      expect(mockTrace.span).toHaveBeenCalledWith({
        id: `span-${traceId}`,
        endTime: expect.any(Date),
        output: result,
        metadata: expect.objectContaining({
          hook_stage: 'post',
          success: true,
          span_type: 'operation_complete',
          model: 'claude-3-sonnet',
          temperature: 0.7,
          completion_reason: 'stop'
        })
      });

      // Check generation tracking with agent multiplier
      expect(mockTrace.generation).toHaveBeenCalledWith({
        name: 'enhanced_token_usage',
        model: 'claude-3-sonnet',
        usage: {
          promptTokens: 500, // general agent has 1.0 multiplier
          completionTokens: 1000,
          totalTokens: 1500
        },
        metadata: expect.objectContaining({
          estimated_cost: expect.any(Number),
          agent_multiplier: 1.0,
          agent_role: 'general'
        })
      });

      // Check trace update
      expect(mockTrace.update).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          hook_stage: 'completed',
          success: true
        })
      });

      expect(mockClient.flushAsync).toHaveBeenCalled();
    });

    it('should apply agent-specific token multipliers', async () => {
      const agentRoles = [
        { role: 'researcher', multiplier: 1.2 },
        { role: 'coder', multiplier: 1.4 },
        { role: 'analyst', multiplier: 1.1 },
        { role: 'tester', multiplier: 1.3 },
        { role: 'coordinator', multiplier: 1.0 },
        { role: 'architect', multiplier: 1.5 }
      ];

      for (const { role, multiplier } of agentRoles) {
        const context: HookContext = {
          hookType: `${role}-task`,
          agentRole: role
        };
        
        const localTraceId = await wrapper.preHook(context);
        const localMockTrace = mockClient.getTrace(localTraceId);
        
        const tokenUsage: TokenUsage = { input: 100, output: 200 };
        await wrapper.postHook(localTraceId, { result: 'test' }, tokenUsage);

        const generationCall = localMockTrace.generation.mock.calls[0];
        expect(generationCall[0].usage).toEqual({
          promptTokens: Math.round(100 * multiplier),
          completionTokens: Math.round(200 * multiplier),
          totalTokens: Math.round(300 * multiplier)
        });
        expect(generationCall[0].metadata.agent_multiplier).toBe(multiplier);
      }
    });

    it('should handle missing token usage gracefully', async () => {
      const result = { completed: true };
      
      await wrapper.postHook(traceId, result);

      expect(mockTrace.generation).not.toHaveBeenCalled();
      expect(mockTrace.span).toHaveBeenCalled();
      expect(mockTrace.update).toHaveBeenCalled();
      expect(mockClient.flushAsync).toHaveBeenCalled();
    });

    it('should handle null trace ID', async () => {
      await wrapper.postHook(null, { data: 'test' });
      
      expect(mockClient.flushAsync).not.toHaveBeenCalled();
    });

    it('should handle non-existent trace', async () => {
      await wrapper.postHook('non-existent-trace', { data: 'test' });
      
      expect(mockClient.flushAsync).not.toHaveBeenCalled();
    });
  });

  describe('errorHook', () => {
    let traceId: string;
    let mockTrace: any;

    beforeEach(async () => {
      const context: HookContext = { hookType: 'error-test-operation' };
      traceId = await wrapper.preHook(context);
      mockTrace = mockClient.getTrace(traceId);
    });

    it('should track errors with full context', async () => {
      const error = new Error('Operation failed');
      error.stack = 'Error: Operation failed\n    at test.js:10:5';
      const metadata = {
        retry_attempt: 3,
        error_category: 'network',
        recovery_action: 'retry'
      };

      await wrapper.errorHook(traceId, error, metadata);

      // Check span update with error
      expect(mockTrace.span).toHaveBeenCalledWith({
        id: `span-${traceId}`,
        endTime: expect.any(Date),
        output: { error: 'Operation failed' },
        metadata: expect.objectContaining({
          hook_stage: 'error',
          success: false,
          error_message: 'Operation failed',
          error_stack: error.stack,
          error_type: 'Error',
          span_type: 'operation_error',
          retry_attempt: 3,
          error_category: 'network',
          recovery_action: 'retry'
        })
      });

      // Check error event
      expect(mockTrace.event).toHaveBeenCalledWith({
        name: 'enhanced_error',
        level: 'ERROR',
        statusMessage: 'Operation failed',
        metadata: expect.objectContaining({
          error: {
            message: 'Operation failed',
            stack: error.stack,
            name: 'Error'
          }
        })
      });

      // Check trace update
      expect(mockTrace.update).toHaveBeenCalledWith({
        metadata: expect.objectContaining({
          hook_stage: 'error',
          success: false,
          error_message: 'Operation failed',
          error_recovery_attempted: true
        })
      });

      expect(mockClient.flushAsync).toHaveBeenCalled();
    });

    it('should handle errors without stack trace', async () => {
      const error = new Error('Simple error');
      delete error.stack;

      await wrapper.errorHook(traceId, error);

      const spanCall = mockTrace.span.mock.calls[0];
      expect(spanCall[0].metadata.error_stack).toBeUndefined();
    });

    it('should handle custom error types', async () => {
      class CustomError extends Error {
        constructor(message: string, public code: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom failure', 'ERR_001');
      
      await wrapper.errorHook(traceId, error, { error_code: 'ERR_001' });

      const eventCall = mockTrace.event.mock.calls[0];
      expect(eventCall[0].metadata.error.name).toBe('CustomError');
    });

    it('should handle null trace ID in error hook', async () => {
      await wrapper.errorHook(null, new Error('test'));
      
      expect(mockClient.flushAsync).not.toHaveBeenCalled();
    });
  });

  describe('Enrichment Methods', () => {
    it('should enrich span metadata with environment info', () => {
      const metadata = wrapper.enrichSpanMetadata({ custom: 'data' });
      
      expect(metadata).toMatchObject({
        custom: 'data',
        environment: 'test',
        claude_flow_version: 'unknown',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    it('should calculate efficiency scores correctly', async () => {
      // Test through postHook to access private method indirectly
      const context: HookContext = { hookType: 'efficiency-test' };
      const traceId = await wrapper.preHook(context);
      
      const tokenUsage: TokenUsage = { input: 1000, output: 2000 };
      await wrapper.postHook(traceId, { data: 'test' }, tokenUsage);
      
      const mockTrace = mockClient.getTrace(traceId);
      const spanCall = mockTrace.span.mock.calls.find(
        (call: any) => call[0].metadata?.efficiency_score !== undefined
      );
      
      expect(spanCall[0].metadata.efficiency_score).toBeGreaterThanOrEqual(0);
      expect(spanCall[0].metadata.efficiency_score).toBeLessThanOrEqual(100);
    });

    it('should estimate costs based on token usage', async () => {
      const context: HookContext = { hookType: 'cost-test' };
      const traceId = await wrapper.preHook(context);
      
      const tokenUsage: TokenUsage = { input: 1000, output: 500 };
      await wrapper.postHook(traceId, { data: 'test' }, tokenUsage);
      
      const mockTrace = mockClient.getTrace(traceId);
      const generationCall = mockTrace.generation.mock.calls[0];
      
      // Cost calculation: (1000 * 0.008 + 500 * 0.024) / 1000 = 0.02
      expect(generationCall[0].metadata.estimated_cost).toBeCloseTo(0.02, 3);
    });
  });

  describe('State Management', () => {
    it('should track active traces and spans', async () => {
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);

      // Start multiple traces
      const context1: HookContext = { hookType: 'state-test-1' };
      const context2: HookContext = { hookType: 'state-test-2' };
      
      const traceId1 = await wrapper.preHook(context1);
      expect(wrapper.getActiveTraceCount()).toBe(1);
      expect(wrapper.getActiveSpanCount()).toBe(1); // main span

      const traceId2 = await wrapper.preHook(context2);
      expect(wrapper.getActiveTraceCount()).toBe(2);
      expect(wrapper.getActiveSpanCount()).toBe(2);

      // Create custom span
      const spanId = await wrapper.createSpan(traceId1!, 'custom-span');
      expect(wrapper.getActiveSpanCount()).toBe(3);

      // End custom span
      await wrapper.endSpan(spanId!);
      expect(wrapper.getActiveSpanCount()).toBe(2);

      // Complete traces
      await wrapper.postHook(traceId1, { done: true });
      expect(wrapper.getActiveTraceCount()).toBe(1);
      expect(wrapper.getActiveSpanCount()).toBe(1);

      await wrapper.postHook(traceId2, { done: true });
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });

    it('should clean up interrupted operations on shutdown', async () => {
      // Create multiple active traces
      const promises = Array(5).fill(0).map((_, i) => 
        wrapper.preHook({ hookType: `shutdown-test-${i}` })
      );
      const traceIds = await Promise.all(promises);

      // Create custom spans
      const spanPromises = traceIds.map((traceId, i) => 
        wrapper.createSpan(traceId!, `custom-span-${i}`)
      );
      await Promise.all(spanPromises);

      expect(wrapper.getActiveTraceCount()).toBe(5);
      expect(wrapper.getActiveSpanCount()).toBe(10); // 5 main + 5 custom

      // Shutdown should clean everything
      await wrapper.shutdown();

      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
      expect(mockClient.shutdownAsync).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent hook operations', async () => {
      const operations = 50;
      const contexts = Array(operations).fill(0).map((_, i) => ({
        hookType: `concurrent-${i}`,
        agentId: `agent-${i}`,
        agentRole: i % 2 === 0 ? 'coder' : 'researcher'
      }));

      // Start all traces concurrently
      const tracePromises = contexts.map(ctx => wrapper.preHook(ctx));
      const traceIds = await Promise.all(tracePromises);

      expect(traceIds.every(id => id !== null)).toBe(true);
      expect(new Set(traceIds).size).toBe(operations); // All unique

      // Complete half with success, half with errors
      const completionPromises = traceIds.map((traceId, i) => {
        if (i % 2 === 0) {
          return wrapper.postHook(traceId, { index: i }, { input: 100, output: 200 });
        } else {
          return wrapper.errorHook(traceId, new Error(`Error ${i}`));
        }
      });

      await Promise.all(completionPromises);
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });

    it('should handle rapid trace creation and completion', async () => {
      const rapidOps = async () => {
        for (let i = 0; i < 20; i++) {
          const traceId = await wrapper.preHook({ hookType: `rapid-${i}` });
          // Immediately complete
          await wrapper.postHook(traceId, { index: i });
        }
      };

      await expect(rapidOps()).resolves.not.toThrow();
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });

    it('should handle malformed metadata gracefully', async () => {
      const weirdMetadata = [
        { circular: {} } as any,
        undefined,
        null,
        { fn: () => {} },
        { bigint: BigInt(123) }
      ];

      // Add circular reference
      weirdMetadata[0].circular.ref = weirdMetadata[0];

      for (const metadata of weirdMetadata) {
        const context: HookContext = {
          hookType: 'weird-metadata',
          metadata: metadata as any
        };

        const traceId = await wrapper.preHook(context);
        expect(traceId).toBeTruthy();
        
        await wrapper.postHook(traceId, { done: true }, undefined, metadata as any);
      }
    });
  });
});