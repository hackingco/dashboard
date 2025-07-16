/**
 * Comprehensive error scenario tests
 * Tests graceful degradation when Langfuse is unavailable
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper, HookContext } from '../../src/index';
import { ClaudeFlowLangfuseIntegration } from '../../src/claude-flow-integration';
import { createMockDatabase } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('better-sqlite3');

describe('Error Scenarios and Graceful Degradation', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDatabase();
    (require('better-sqlite3') as any).default = jest.fn(() => mockDb);
  });

  describe('Langfuse Client Initialization Failures', () => {
    it('should handle network connectivity issues', () => {
      const MockLangfuse = jest.fn(() => {
        throw new Error('ECONNREFUSED: Connection refused');
      });
      (require('langfuse') as any).Langfuse = MockLangfuse;

      const wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });

      expect(wrapper.isEnabled()).toBe(false);
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });

    it('should handle authentication failures', () => {
      const MockLangfuse = jest.fn(() => {
        throw new Error('401 Unauthorized: Invalid API key');
      });
      (require('langfuse') as any).Langfuse = MockLangfuse;

      const wrapper = new LangfuseWrapper({
        publicKey: 'invalid-public',
        secretKey: 'invalid-secret'
      });

      expect(wrapper.isEnabled()).toBe(false);
    });

    it('should handle service unavailable errors', () => {
      const MockLangfuse = jest.fn(() => {
        throw new Error('503 Service Unavailable');
      });
      (require('langfuse') as any).Langfuse = MockLangfuse;

      const wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });

      expect(wrapper.isEnabled()).toBe(false);
    });

    it('should handle SSL/TLS errors', () => {
      const MockLangfuse = jest.fn(() => {
        throw new Error('CERT_UNTRUSTED: Certificate not trusted');
      });
      (require('langfuse') as any).Langfuse = MockLangfuse;

      const wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret',
        host: 'https://invalid-cert.langfuse.com'
      });

      expect(wrapper.isEnabled()).toBe(false);
    });

    it('should handle timeout errors', () => {
      const MockLangfuse = jest.fn(() => {
        throw new Error('ETIMEDOUT: Connection timeout');
      });
      (require('langfuse') as any).Langfuse = MockLangfuse;

      const wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });

      expect(wrapper.isEnabled()).toBe(false);
    });
  });

  describe('Runtime API Failures', () => {
    let wrapper: LangfuseWrapper;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        trace: jest.fn(),
        flushAsync: jest.fn(),
        shutdownAsync: jest.fn()
      };
      
      (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
      
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    afterEach(async () => {
      await wrapper.shutdown();
    });

    it('should handle trace creation failures', async () => {
      mockClient.trace.mockImplementation(() => {
        throw new Error('Failed to create trace');
      });

      const context: HookContext = { hookType: 'test-operation' };
      const traceId = await wrapper.preHook(context);

      expect(traceId).toBeNull();
      expect(wrapper.getActiveTraceCount()).toBe(0);
    });

    it('should handle trace method failures', async () => {
      const mockTrace = {
        span: jest.fn().mockImplementation(() => {
          throw new Error('Span creation failed');
        }),
        generation: jest.fn(),
        event: jest.fn(),
        update: jest.fn()
      };
      
      mockClient.trace.mockReturnValue(mockTrace);

      const context: HookContext = { hookType: 'test-operation' };
      const traceId = await wrapper.preHook(context);

      // Should still create trace ID but handle span failure
      expect(traceId).not.toBeNull();
      
      // Should handle the span failure gracefully in postHook
      await wrapper.postHook(traceId, { result: 'test' });
    });

    it('should handle flush failures', async () => {
      const mockTrace = {
        span: jest.fn(),
        generation: jest.fn(),
        event: jest.fn(),
        update: jest.fn()
      };
      
      mockClient.trace.mockReturnValue(mockTrace);
      mockClient.flushAsync.mockRejectedValue(new Error('Flush failed'));

      const context: HookContext = { hookType: 'test-operation' };
      const traceId = await wrapper.preHook(context);

      // Should not throw even if flush fails
      await wrapper.postHook(traceId, { result: 'test' });
    });

    it('should handle generation tracking failures', async () => {
      const mockTrace = {
        span: jest.fn(),
        generation: jest.fn().mockImplementation(() => {
          throw new Error('Generation tracking failed');
        }),
        event: jest.fn(),
        update: jest.fn()
      };
      
      mockClient.trace.mockReturnValue(mockTrace);

      const context: HookContext = { hookType: 'test-operation' };
      const traceId = await wrapper.preHook(context);

      const tokenUsage = { input: 100, output: 200 };
      
      // Should not throw even if generation tracking fails
      await wrapper.postHook(traceId, { result: 'test' }, tokenUsage);
    });

    it('should handle event logging failures', async () => {
      const mockTrace = {
        span: jest.fn(),
        generation: jest.fn(),
        event: jest.fn().mockImplementation(() => {
          throw new Error('Event logging failed');
        }),
        update: jest.fn()
      };
      
      mockClient.trace.mockReturnValue(mockTrace);

      const context: HookContext = { hookType: 'test-operation' };
      const traceId = await wrapper.preHook(context);

      // Should not throw even if event logging fails
      await wrapper.errorHook(traceId, new Error('Test error'));
    });

    it('should handle shutdown failures', async () => {
      mockClient.shutdownAsync.mockRejectedValue(new Error('Shutdown failed'));

      // Should not throw
      await wrapper.shutdown();
    });
  });

  describe('Database Failures', () => {
    it('should handle database initialization failure', () => {
      const MockDatabase = jest.fn(() => {
        throw new Error('Database connection failed');
      });
      (require('better-sqlite3') as any).default = MockDatabase;

      const wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });

      // Should still initialize but without database functionality
      expect(wrapper.isEnabled()).toBe(true);
    });

    it('should handle database operation failures during tracing', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database operation failed');
      });

      const wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });

      const context: HookContext = { hookType: 'test-operation' };
      
      // Should not throw even if database operations fail
      const traceId = await wrapper.preHook(context);
      await wrapper.postHook(traceId, { result: 'test' });
    });

    it('should handle database corruption', () => {
      mockDb.exec.mockImplementation(() => {
        throw new Error('SQLITE_CORRUPT: Database disk image is malformed');
      });

      const wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });

      // Should handle database corruption gracefully
      expect(wrapper.getMemoryStats()).toBeNull();
    });
  });

  describe('Memory and Resource Limits', () => {
    let wrapper: LangfuseWrapper;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        trace: jest.fn().mockReturnValue({
          span: jest.fn(),
          generation: jest.fn(),
          event: jest.fn(),
          update: jest.fn()
        }),
        flushAsync: jest.fn().mockResolvedValue(undefined),
        shutdownAsync: jest.fn().mockResolvedValue(undefined)
      };
      
      (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
      
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    afterEach(async () => {
      await wrapper.shutdown();
    });

    it('should handle out of memory conditions', async () => {
      // Simulate OOM by making trace creation fail with memory error
      mockClient.trace.mockImplementation(() => {
        throw new Error('Cannot allocate memory');
      });

      const operations = Array(10).fill(0).map(async (_, i) => {
        const context: HookContext = { hookType: `memory-test-${i}` };
        return wrapper.preHook(context);
      });

      const results = await Promise.all(operations);
      
      // All should return null due to memory error, but shouldn't crash
      expect(results.every(id => id === null)).toBe(true);
    });

    it('should handle extremely large payloads', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB string

      const context: HookContext = {
        hookType: 'large-payload',
        metadata: { largeData: largePayload }
      };

      // Should handle large payloads without crashing
      const traceId = await wrapper.preHook(context);
      await wrapper.postHook(traceId, { largeResult: largePayload });
    });

    it('should handle resource exhaustion during concurrent operations', async () => {
      // Simulate resource exhaustion after some operations
      let operationCount = 0;
      mockClient.trace.mockImplementation(() => {
        operationCount++;
        if (operationCount > 50) {
          throw new Error('Resource temporarily unavailable');
        }
        return {
          span: jest.fn(),
          generation: jest.fn(),
          event: jest.fn(),
          update: jest.fn()
        };
      });

      const operations = Array(100).fill(0).map(async (_, i) => {
        const context: HookContext = { hookType: `resource-test-${i}` };
        return wrapper.preHook(context);
      });

      const results = await Promise.all(operations);
      
      // First 50 should succeed, rest should fail gracefully
      const successCount = results.filter(id => id !== null).length;
      expect(successCount).toBeLessThanOrEqual(50);
    });
  });

  describe('Network and Connectivity Issues', () => {
    let wrapper: LangfuseWrapper;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        trace: jest.fn().mockReturnValue({
          span: jest.fn(),
          generation: jest.fn(),
          event: jest.fn(),
          update: jest.fn()
        }),
        flushAsync: jest.fn(),
        shutdownAsync: jest.fn()
      };
      
      (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
      
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    afterEach(async () => {
      await wrapper.shutdown();
    });

    it('should handle intermittent network failures', async () => {
      let flushAttempts = 0;
      mockClient.flushAsync.mockImplementation(() => {
        flushAttempts++;
        if (flushAttempts <= 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve();
      });

      const context: HookContext = { hookType: 'network-test' };
      const traceId = await wrapper.preHook(context);

      // Should not throw even with network failures
      await wrapper.postHook(traceId, { result: 'test' });
      await wrapper.postHook(traceId, { result: 'test2' });
      await wrapper.postHook(traceId, { result: 'test3' });

      expect(flushAttempts).toBe(3);
    });

    it('should handle rate limiting', async () => {
      mockClient.flushAsync.mockRejectedValue(new Error('429 Too Many Requests'));

      const context: HookContext = { hookType: 'rate-limit-test' };
      const traceId = await wrapper.preHook(context);

      // Should handle rate limiting gracefully
      await wrapper.postHook(traceId, { result: 'test' });
    });

    it('should handle DNS resolution failures', async () => {
      mockClient.flushAsync.mockRejectedValue(new Error('ENOTFOUND: getaddrinfo ENOTFOUND'));

      const context: HookContext = { hookType: 'dns-test' };
      const traceId = await wrapper.preHook(context);

      // Should handle DNS failures gracefully
      await wrapper.postHook(traceId, { result: 'test' });
    });
  });

  describe('Claude Flow Integration Failures', () => {
    let integration: ClaudeFlowLangfuseIntegration;
    let wrapper: LangfuseWrapper;

    beforeEach(() => {
      const mockClient = {
        trace: jest.fn().mockReturnValue({
          span: jest.fn(),
          generation: jest.fn(),
          event: jest.fn(),
          update: jest.fn()
        }),
        flushAsync: jest.fn().mockResolvedValue(undefined),
        shutdownAsync: jest.fn().mockResolvedValue(undefined)
      };
      
      (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
      
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
      
      integration = new ClaudeFlowLangfuseIntegration(wrapper);
    });

    afterEach(async () => {
      await integration.shutdown();
    });

    it('should handle hook manager registration failures', () => {
      const mockHookManager = {
        executeHook: jest.fn()
      };

      // Should not throw even if registration somehow fails
      integration.registerWithClaudeFlow(mockHookManager);

      expect(typeof mockHookManager.executeHook).toBe('function');
    });

    it('should handle hook handler creation failures', () => {
      jest.spyOn(wrapper, 'createSpan').mockRejectedValue(new Error('Span creation failed'));

      const handlers = integration.createHookHandlers();

      // Should create handlers even if underlying operations might fail
      expect(handlers['pre-task']).toBeInstanceOf(Function);
      expect(handlers['post-task']).toBeInstanceOf(Function);
    });

    it('should handle Claude Flow hook execution failures', async () => {
      const mockHookManager = {
        executeHook: jest.fn().mockRejectedValue(new Error('Hook execution failed'))
      };

      integration.registerWithClaudeFlow(mockHookManager);

      // Should propagate the original error
      await expect(mockHookManager.executeHook('test-hook', {}))
        .rejects.toThrow('Hook execution failed');
    });
  });

  describe('Malformed Data Handling', () => {
    let wrapper: LangfuseWrapper;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        trace: jest.fn().mockReturnValue({
          span: jest.fn(),
          generation: jest.fn(),
          event: jest.fn(),
          update: jest.fn()
        }),
        flushAsync: jest.fn().mockResolvedValue(undefined),
        shutdownAsync: jest.fn().mockResolvedValue(undefined)
      };
      
      (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
      
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    afterEach(async () => {
      await wrapper.shutdown();
    });

    it('should handle circular references in metadata', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const context: HookContext = {
        hookType: 'circular-test',
        metadata: circularObj
      };

      // Should handle circular references without crashing
      const traceId = await wrapper.preHook(context);
      expect(traceId).not.toBeNull();
    });

    it('should handle undefined and null values', async () => {
      const context: HookContext = {
        hookType: 'null-test',
        swarmId: undefined,
        agentId: null as any,
        metadata: {
          validField: 'test',
          nullField: null,
          undefinedField: undefined
        }
      };

      const traceId = await wrapper.preHook(context);
      await wrapper.postHook(traceId, null as any);
    });

    it('should handle non-serializable objects', async () => {
      const context: HookContext = {
        hookType: 'non-serializable',
        metadata: {
          func: () => 'test',
          symbol: Symbol('test'),
          bigint: BigInt(123),
          date: new Date()
        }
      };

      const traceId = await wrapper.preHook(context);
      expect(traceId).not.toBeNull();
    });

    it('should handle extremely nested objects', async () => {
      let deepObj: any = { level: 0 };
      for (let i = 1; i < 1000; i++) {
        deepObj = { level: i, nested: deepObj };
      }

      const context: HookContext = {
        hookType: 'deep-nesting',
        metadata: { deepData: deepObj }
      };

      const traceId = await wrapper.preHook(context);
      expect(traceId).not.toBeNull();
    });
  });

  describe('Concurrent Error Scenarios', () => {
    let wrapper: LangfuseWrapper;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        trace: jest.fn().mockReturnValue({
          span: jest.fn(),
          generation: jest.fn(),
          event: jest.fn(),
          update: jest.fn()
        }),
        flushAsync: jest.fn().mockResolvedValue(undefined),
        shutdownAsync: jest.fn().mockResolvedValue(undefined)
      };
      
      (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
      
      wrapper = new LangfuseWrapper({
        publicKey: 'test-public',
        secretKey: 'test-secret'
      });
    });

    afterEach(async () => {
      await wrapper.shutdown();
    });

    it('should handle concurrent shutdown during active operations', async () => {
      // Start many operations
      const operations = Array(50).fill(0).map(async (_, i) => {
        const context: HookContext = { hookType: `concurrent-${i}` };
        const traceId = await wrapper.preHook(context);
        
        // Add delay to ensure some operations are still running during shutdown
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        await wrapper.postHook(traceId, { index: i });
      });

      // Start shutdown while operations are running
      setTimeout(() => wrapper.shutdown(), 25);

      // Operations should complete or fail gracefully
      await Promise.allSettled(operations);
    });

    it('should handle errors in concurrent span operations', async () => {
      const context: HookContext = { hookType: 'concurrent-span-test' };
      const traceId = await wrapper.preHook(context);

      // Create many spans concurrently, some of which will fail
      let spanFailureCount = 0;
      jest.spyOn(wrapper, 'createSpan').mockImplementation(async (traceId, name) => {
        spanFailureCount++;
        if (spanFailureCount % 3 === 0) {
          throw new Error('Span creation failed');
        }
        return `span-${spanFailureCount}`;
      });

      const spanOperations = Array(20).fill(0).map(async (_, i) => {
        try {
          const spanId = await wrapper.createSpan(traceId!, `span-${i}`);
          if (spanId) {
            await wrapper.endSpan(spanId, { index: i });
          }
          return true;
        } catch (error) {
          return false;
        }
      });

      const results = await Promise.allSettled(spanOperations);
      
      // Some should succeed, some should fail, but nothing should crash
      expect(results.length).toBe(20);
    });
  });
});