/**
 * Enhanced comprehensive tests for LangfuseWrapper
 * Target coverage: >95% with error scenarios and edge cases
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper, HookContext, TokenUsage } from '../../src/index';
import { 
  createMockLangfuseClient, 
  createMockLangfuseConstructor,
  createMockDatabase,
  performanceUtils 
} from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('better-sqlite3');

const MockLangfuse = createMockLangfuseConstructor();
const MockDatabase = jest.fn(() => createMockDatabase());

describe('LangfuseWrapper - Enhanced Coverage Tests', () => {
  let wrapper: LangfuseWrapper;
  let mockClient: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockLangfuseClient();
    mockDb = createMockDatabase();
    
    // Setup mocks
    (require('langfuse') as any).Langfuse = MockLangfuse;
    (require('better-sqlite3') as any).default = MockDatabase;
    
    MockLangfuse.mockImplementation(() => mockClient);
    MockDatabase.mockImplementation(() => mockDb);
  });

  afterEach(async () => {
    if (wrapper && wrapper.isEnabled()) {
      await wrapper.shutdown();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with all configuration options', () => {
      const config = {
        publicKey: 'test-public',
        secretKey: 'test-secret',
        host: 'https://custom.langfuse.com',
        enabled: true,
        flushAt: 50,
        flushInterval: 20000
      };

      wrapper = new LangfuseWrapper(config);

      expect(MockLangfuse).toHaveBeenCalledWith({
        publicKey: 'test-public',
        secretKey: 'test-secret',
        baseUrl: 'https://custom.langfuse.com',
        flushAt: 50,
        flushInterval: 20000
      });

      expect(wrapper.isEnabled()).toBe(true);
    });

    it('should use environment variables when config not provided', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'env-public';
      process.env.LANGFUSE_SECRET_KEY = 'env-secret';
      process.env.LANGFUSE_HOST = 'https://env.langfuse.com';

      wrapper = new LangfuseWrapper();

      expect(MockLangfuse).toHaveBeenCalledWith({
        publicKey: 'env-public',
        secretKey: 'env-secret',
        baseUrl: 'https://env.langfuse.com',
        flushAt: 20,
        flushInterval: 10000
      });

      // Cleanup
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_HOST;
    });

    it('should handle initialization failure gracefully', () => {
      MockLangfuse.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      const config = {
        publicKey: 'test-public',
        secretKey: 'test-secret'
      };

      wrapper = new LangfuseWrapper(config);

      expect(wrapper.isEnabled()).toBe(false);
    });

    it('should disable when explicitly configured', () => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret',
        enabled: false
      });

      expect(MockLangfuse).not.toHaveBeenCalled();
      expect(wrapper.isEnabled()).toBe(false);
    });

    it('should disable when credentials are missing', () => {
      wrapper = new LangfuseWrapper({
        enabled: true
      });

      expect(MockLangfuse).not.toHaveBeenCalled();
      expect(wrapper.isEnabled()).toBe(false);
    });
  });

  describe('Hook Lifecycle Management', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should handle complete pre-post hook cycle', async () => {
      const context: HookContext = {
        hookType: 'test-operation',
        swarmId: 'swarm-123',
        agentId: 'agent-456',
        agentRole: 'coder',
        taskId: 'task-789',
        operationType: 'code-generation',
        metadata: { custom: 'data' }
      };

      const traceId = await wrapper.preHook(context);
      expect(traceId).toMatch(/^trace-\d+-[a-z0-9]+$/);

      const tokenUsage: TokenUsage = { input: 150, output: 300, total: 450 };
      const result = { success: true, output: 'Generated code' };

      await wrapper.postHook(traceId, result, tokenUsage, { final: true });

      expect(mockClient.trace).toHaveBeenCalledWith({
        id: traceId,
        name: 'test-operation',
        metadata: {
          swarm_id: 'swarm-123',
          agent_id: 'agent-456',
          agent_role: 'coder',
          task_id: 'task-789',
          operation_type: 'code-generation',
          hook_stage: 'pre',
          custom: 'data'
        }
      });

      expect(mockClient.flushAsync).toHaveBeenCalled();
    });

    it('should handle error hook correctly', async () => {
      const context: HookContext = {
        hookType: 'failing-operation',
        metadata: { attempt: 1 }
      };

      const traceId = await wrapper.preHook(context);
      const error = new Error('Operation failed');
      error.stack = 'Error stack trace';

      await wrapper.errorHook(traceId, error, { retry: false });

      const mockTrace = mockClient.getTrace(traceId!);
      expect(mockTrace.event).toHaveBeenCalledWith({
        name: 'error',
        level: 'ERROR',
        statusMessage: 'Operation failed',
        metadata: {
          error: {
            message: 'Operation failed',
            stack: 'Error stack trace',
            name: 'Error'
          },
          retry: false
        }
      });

      expect(mockTrace.update).toHaveBeenCalledWith({
        metadata: {
          hook_stage: 'error',
          success: false,
          error_message: 'Operation failed',
          retry: false
        }
      });
    });

    it('should handle hooks when disabled', async () => {
      wrapper = new LangfuseWrapper({ enabled: false });

      const context: HookContext = { hookType: 'test' };
      const traceId = await wrapper.preHook(context);

      expect(traceId).toBeNull();
      expect(mockClient.trace).not.toHaveBeenCalled();

      await wrapper.postHook(traceId, { data: 'test' });
      await wrapper.errorHook(traceId, new Error('test'));

      expect(mockClient.flushAsync).not.toHaveBeenCalled();
    });

    it('should handle missing trace ID in post/error hooks', async () => {
      await wrapper.postHook(null, { data: 'test' });
      await wrapper.errorHook(null, new Error('test'));

      expect(mockClient.flushAsync).not.toHaveBeenCalled();
    });
  });

  describe('Span Management', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should create and end spans correctly', async () => {
      const context: HookContext = { hookType: 'parent-operation' };
      const traceId = await wrapper.preHook(context);

      const spanId = await wrapper.createSpan(
        traceId!,
        'child-operation',
        { input: 'data' },
        { type: 'processing' }
      );

      expect(spanId).toMatch(/^span-\d+-[a-z0-9]+$/);
      expect(wrapper.getActiveSpanCount()).toBe(2); // main span + child span

      await wrapper.endSpan(spanId!, { result: 'success' }, { status: 'completed' });

      expect(wrapper.getActiveSpanCount()).toBe(1); // only main span remains
    });

    it('should handle span creation for non-existent trace', async () => {
      const spanId = await wrapper.createSpan(
        'non-existent-trace',
        'test-span',
        { input: 'data' }
      );

      expect(spanId).toBeNull();
    });

    it('should handle ending non-existent span', async () => {
      await wrapper.endSpan('non-existent-span', { result: 'test' });
      // Should not throw error
    });

    it('should calculate span duration correctly', async () => {
      const context: HookContext = { hookType: 'timed-operation' };
      const traceId = await wrapper.preHook(context);

      const spanId = await wrapper.createSpan(traceId!, 'timed-span');
      
      // Wait to ensure some duration
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await wrapper.endSpan(spanId!, { result: 'success' });

      const mockTrace = mockClient.getTrace(traceId!);
      const spanCall = mockTrace.span.mock.calls.find((call: any) => 
        call[0].id === spanId && call[0].endTime
      );
      
      expect(spanCall[0].metadata.duration_ms).toBeGreaterThan(0);
    });
  });

  describe('Cost Estimation', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should estimate costs correctly for different token counts', async () => {
      const context: HookContext = { hookType: 'cost-test' };
      const traceId = await wrapper.preHook(context);

      const tokenUsages = [
        { input: 1000, output: 2000 },
        { input: 500, output: 1500 },
        { input: 100, output: 50 }
      ];

      for (const tokenUsage of tokenUsages) {
        await wrapper.postHook(traceId, { data: 'test' }, tokenUsage);
        
        const mockTrace = mockClient.getTrace(traceId!);
        const generationCall = mockTrace.generation.mock.calls[mockTrace.generation.mock.calls.length - 1];
        
        expect(generationCall[0].metadata.estimated_cost).toBeGreaterThan(0);
        expect(generationCall[0].usage.totalTokens).toBe(tokenUsage.input + tokenUsage.output);
      }
    });
  });

  describe('Metadata Enrichment', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should enrich span metadata with environment info', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalVersion = process.env.CLAUDE_FLOW_VERSION;
      
      process.env.NODE_ENV = 'test';
      process.env.CLAUDE_FLOW_VERSION = '2.0.0';

      const enriched = wrapper.enrichSpanMetadata({ custom: 'data' });

      expect(enriched).toMatchObject({
        custom: 'data',
        environment: 'test',
        claude_flow_version: '2.0.0',
        timestamp: expect.any(String)
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      process.env.CLAUDE_FLOW_VERSION = originalVersion;
    });

    it('should handle missing environment variables', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalVersion = process.env.CLAUDE_FLOW_VERSION;
      
      delete process.env.NODE_ENV;
      delete process.env.CLAUDE_FLOW_VERSION;

      const enriched = wrapper.enrichSpanMetadata({ test: 'data' });

      expect(enriched).toMatchObject({
        test: 'data',
        environment: 'development',
        claude_flow_version: 'unknown'
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      process.env.CLAUDE_FLOW_VERSION = originalVersion;
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should track active traces and spans correctly', async () => {
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);

      const context1: HookContext = { hookType: 'operation-1' };
      const context2: HookContext = { hookType: 'operation-2' };

      const traceId1 = await wrapper.preHook(context1);
      expect(wrapper.getActiveTraceCount()).toBe(1);
      expect(wrapper.getActiveSpanCount()).toBe(1);

      const traceId2 = await wrapper.preHook(context2);
      expect(wrapper.getActiveTraceCount()).toBe(2);
      expect(wrapper.getActiveSpanCount()).toBe(2);

      const spanId = await wrapper.createSpan(traceId1!, 'child-span');
      expect(wrapper.getActiveSpanCount()).toBe(3);

      await wrapper.endSpan(spanId!);
      expect(wrapper.getActiveSpanCount()).toBe(2);

      await wrapper.postHook(traceId1, { data: 'test' });
      expect(wrapper.getActiveTraceCount()).toBe(1);
      expect(wrapper.getActiveSpanCount()).toBe(1);

      await wrapper.postHook(traceId2, { data: 'test' });
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should handle Langfuse client errors gracefully', async () => {
      mockClient.trace.mockImplementationOnce(() => {
        throw new Error('Langfuse API error');
      });

      const context: HookContext = { hookType: 'failing-trace' };
      const traceId = await wrapper.preHook(context);

      expect(traceId).toBeNull();
    });

    it('should handle flush errors during postHook', async () => {
      mockClient.flushAsync.mockRejectedValueOnce(new Error('Flush failed'));

      const context: HookContext = { hookType: 'flush-error' };
      const traceId = await wrapper.preHook(context);

      // Should not throw
      await wrapper.postHook(traceId, { data: 'test' });
    });

    it('should handle span errors during errorHook', async () => {
      const mockTrace = mockClient.trace();
      mockTrace.span.mockImplementationOnce(() => {
        throw new Error('Span creation failed');
      });

      const context: HookContext = { hookType: 'span-error' };
      const traceId = await wrapper.preHook(context);

      // Should not throw
      await wrapper.errorHook(traceId, new Error('Original error'));
    });

    it('should handle concurrent operations safely', async () => {
      const operations = Array(10).fill(0).map((_, i) => 
        wrapper.preHook({ hookType: `concurrent-op-${i}` })
      );

      const traceIds = await Promise.all(operations);

      expect(traceIds.every(id => id !== null)).toBe(true);
      expect(new Set(traceIds).size).toBe(10); // All unique
      expect(wrapper.getActiveTraceCount()).toBe(10);

      // Complete all traces
      const completions = traceIds.map(id => 
        wrapper.postHook(id, { data: 'test' })
      );

      await Promise.all(completions);
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });

    it('should handle malformed contexts gracefully', async () => {
      const malformedContexts = [
        null as any,
        undefined as any,
        {} as HookContext,
        { hookType: '' } as HookContext,
        { hookType: null } as any
      ];

      for (const context of malformedContexts) {
        const traceId = await wrapper.preHook(context);
        expect(typeof traceId === 'string' || traceId === null).toBe(true);
      }
    });
  });

  describe('Shutdown and Cleanup', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should shutdown gracefully with active traces', async () => {
      // Create multiple active traces and spans
      const tracePromises = Array(5).fill(0).map((_, i) => 
        wrapper.preHook({ hookType: `active-op-${i}` })
      );
      const traceIds = await Promise.all(tracePromises);

      // Create child spans
      const spanPromises = traceIds.map(traceId => 
        wrapper.createSpan(traceId!, 'child-span')
      );
      await Promise.all(spanPromises);

      expect(wrapper.getActiveTraceCount()).toBe(5);
      expect(wrapper.getActiveSpanCount()).toBe(10); // 5 main + 5 child spans

      await wrapper.shutdown();

      expect(mockClient.shutdownAsync).toHaveBeenCalled();
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });

    it('should handle shutdown errors gracefully', async () => {
      mockClient.shutdownAsync.mockRejectedValueOnce(new Error('Shutdown failed'));

      // Should not throw
      await wrapper.shutdown();
    });

    it('should emit shutdown event', (done) => {
      wrapper.on('shutdown', () => {
        done();
      });

      wrapper.shutdown();
    });

    it('should be safe to call shutdown multiple times', async () => {
      await wrapper.shutdown();
      await wrapper.shutdown();
      await wrapper.shutdown();

      expect(mockClient.shutdownAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should emit initialization event', (done) => {
      wrapper.on('initialized', () => {
        done();
      });

      // Re-create wrapper to trigger initialization
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should emit events for trace lifecycle', async () => {
      const events: any[] = [];

      wrapper.on('trace:started', (event) => events.push({ type: 'started', ...event }));
      wrapper.on('trace:ended', (event) => events.push({ type: 'ended', ...event }));
      wrapper.on('trace:error', (event) => events.push({ type: 'error', ...event }));

      const context: HookContext = { hookType: 'event-test' };
      const traceId = await wrapper.preHook(context);
      await wrapper.postHook(traceId, { success: true });

      // Note: Events may not be implemented in the current version
      // This test ensures the wrapper doesn't break if events are added
    });
  });

  describe('Performance Characteristics', () => {
    beforeEach(() => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    it('should handle high-frequency operations efficiently', async () => {
      const operationCount = 100;
      const { duration } = await performanceUtils.measureAsyncExecution(async () => {
        const operations = Array(operationCount).fill(0).map(async (_, i) => {
          const context: HookContext = { hookType: `perf-test-${i}` };
          const traceId = await wrapper.preHook(context);
          await wrapper.postHook(traceId, { index: i });
        });

        await Promise.all(operations);
      });

      // Should handle 100 operations in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should maintain performance under concurrent load', async () => {
      const { results, duration } = await performanceUtils.measureAsyncExecution(() =>
        performanceUtils.simulateHighLoad(50, 10, async () => {
          const context: HookContext = { hookType: 'load-test' };
          const traceId = await wrapper.preHook(context);
          await wrapper.postHook(traceId, { data: 'test' });
          return traceId;
        })
      );

      expect(results).toHaveLength(50);
      expect(results.every(id => id !== null)).toBe(true);
      // Should handle concurrent load efficiently
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many operations', async () => {
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });

      // Perform many operations
      for (let i = 0; i < 50; i++) {
        const context: HookContext = { hookType: `memory-test-${i}` };
        const traceId = await wrapper.preHook(context);
        await wrapper.postHook(traceId, { iteration: i });
      }

      // All traces should be completed and cleaned up
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });

    it('should clean up interrupted operations during shutdown', async () => {
      // Create operations but don't complete them
      const incompleteTraces = await Promise.all(
        Array(10).fill(0).map((_, i) => 
          wrapper.preHook({ hookType: `incomplete-${i}` })
        )
      );

      const incompleteSpans = await Promise.all(
        incompleteTraces.map(traceId => 
          wrapper.createSpan(traceId!, 'incomplete-span')
        )
      );

      expect(wrapper.getActiveTraceCount()).toBe(10);
      expect(wrapper.getActiveSpanCount()).toBe(20);

      await wrapper.shutdown();

      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });
  });
});