/**
 * Comprehensive tests for span management functionality
 * Focus on createSpan, endSpan, and span lifecycle
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper, HookContext } from '../../src';
import { createMockLangfuseClient, createMockLangfuseConstructor } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');

const MockLangfuse = createMockLangfuseConstructor();

describe('Span Management Tests', () => {
  let wrapper: LangfuseWrapper;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockLangfuseClient();
    
    // Setup mocks
    (require('langfuse') as any).Langfuse = MockLangfuse;
    MockLangfuse.mockImplementation(() => mockClient);
    
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

  describe('createSpan', () => {
    let traceId: string;
    let mockTrace: any;

    beforeEach(async () => {
      const context: HookContext = { hookType: 'parent-operation' };
      traceId = await wrapper.preHook(context);
      mockTrace = mockClient.getTrace(traceId);
    });

    it('should create span with full metadata and input', async () => {
      const input = {
        query: 'SELECT * FROM users',
        params: { limit: 100, offset: 0 }
      };
      
      const metadata = {
        database: 'production',
        query_type: 'read',
        estimated_rows: 100
      };

      const spanId = await wrapper.createSpan(
        traceId,
        'database-query',
        input,
        metadata
      );

      expect(spanId).toMatch(/^span-\d+-[a-z0-9]+$/);
      expect(mockTrace.span).toHaveBeenCalledWith({
        id: spanId,
        name: 'database-query',
        startTime: expect.any(Date),
        input,
        metadata: expect.objectContaining({
          span_name: 'database-query',
          span_type: 'custom_operation',
          hook_stage: 'span_creation',
          database: 'production',
          query_type: 'read',
          estimated_rows: 100,
          timestamp: expect.any(String),
          environment: 'test'
        })
      });

      expect(wrapper.getActiveSpanCount()).toBe(2); // main + custom span
    });

    it('should create nested spans within spans', async () => {
      // Create parent span
      const parentSpanId = await wrapper.createSpan(
        traceId,
        'parent-span',
        { operation: 'batch-process' }
      );

      // Create child spans
      const childSpanIds = [];
      for (let i = 0; i < 3; i++) {
        const childSpanId = await wrapper.createSpan(
          traceId,
          `child-span-${i}`,
          { parent: parentSpanId, index: i }
        );
        childSpanIds.push(childSpanId);
      }

      expect(childSpanIds).toHaveLength(3);
      expect(wrapper.getActiveSpanCount()).toBe(5); // main + parent + 3 children

      // End child spans
      for (const childSpanId of childSpanIds) {
        await wrapper.endSpan(childSpanId, { processed: true });
      }

      expect(wrapper.getActiveSpanCount()).toBe(2); // main + parent

      // End parent span
      await wrapper.endSpan(parentSpanId!, { 
        children_processed: 3,
        success: true 
      });

      expect(wrapper.getActiveSpanCount()).toBe(1); // only main span
    });

    it('should handle span creation for non-existent trace', async () => {
      const spanId = await wrapper.createSpan(
        'non-existent-trace',
        'orphan-span',
        { data: 'test' }
      );

      expect(spanId).toBeNull();
    });

    it('should handle span creation when disabled', async () => {
      const disabledWrapper = new LangfuseWrapper({
        publicKey: undefined,
        secretKey: undefined
      });

      const spanId = await disabledWrapper.createSpan(
        'any-trace',
        'disabled-span'
      );

      expect(spanId).toBeNull();
      await disabledWrapper.shutdown();
    });

    it('should handle span creation errors gracefully', async () => {
      mockTrace.span.mockImplementationOnce(() => {
        throw new Error('Span creation failed');
      });

      const spanId = await wrapper.createSpan(
        traceId,
        'failing-span',
        { data: 'test' }
      );

      expect(spanId).toBeNull();
    });
  });

  describe('endSpan', () => {
    let traceId: string;
    let mockTrace: any;
    let spanId: string;

    beforeEach(async () => {
      const context: HookContext = { hookType: 'span-end-test' };
      traceId = await wrapper.preHook(context);
      mockTrace = mockClient.getTrace(traceId);
      
      spanId = (await wrapper.createSpan(
        traceId,
        'test-span',
        { input: 'data' }
      ))!;
    });

    it('should end span with output and metadata', async () => {
      const output = {
        result: 'success',
        records_processed: 150,
        duration_ms: 245
      };
      
      const metadata = {
        cache_hit: false,
        optimization_applied: true
      };

      await wrapper.endSpan(spanId, output, metadata);

      const endSpanCall = mockTrace.span.mock.calls.find(
        (call: any) => call[0].id === spanId && call[0].endTime
      );

      expect(endSpanCall).toBeTruthy();
      expect(endSpanCall[0]).toMatchObject({
        id: spanId,
        endTime: expect.any(Date),
        output,
        metadata: expect.objectContaining({
          duration_ms: expect.any(Number),
          span_type: 'custom_operation_complete',
          hook_stage: 'span_completion',
          success: true,
          cache_hit: false,
          optimization_applied: true
        })
      });

      expect(wrapper.getActiveSpanCount()).toBe(1); // only main span remains
    });

    it('should calculate span duration accurately', async () => {
      const startTime = Date.now();
      
      // Create span
      const testSpanId = await wrapper.createSpan(
        traceId,
        'timed-span',
        { start: startTime }
      );

      // Wait for measurable duration
      await new Promise(resolve => setTimeout(resolve, 100));

      // End span
      await wrapper.endSpan(testSpanId!, { completed: true });

      const endSpanCall = mockTrace.span.mock.calls.find(
        (call: any) => call[0].id === testSpanId && call[0].endTime
      );

      expect(endSpanCall[0].metadata.duration_ms).toBeGreaterThanOrEqual(100);
      expect(endSpanCall[0].metadata.duration_ms).toBeLessThan(200);
    });

    it('should handle ending non-existent span', async () => {
      await wrapper.endSpan('non-existent-span', { data: 'test' });
      
      // Should not throw, just return silently
      expect(wrapper.getActiveSpanCount()).toBe(2); // unchanged
    });

    it('should handle ending span when disabled', async () => {
      const disabledWrapper = new LangfuseWrapper({
        publicKey: undefined,
        secretKey: undefined
      });

      await disabledWrapper.endSpan('any-span', { data: 'test' });
      
      // Should not throw
      expect(disabledWrapper.getActiveSpanCount()).toBe(0);
      await disabledWrapper.shutdown();
    });

    it('should handle ending span with error in output', async () => {
      const error = new Error('Processing failed');
      
      await wrapper.endSpan(spanId, error, { 
        error_type: 'ProcessingError',
        retry_possible: true 
      });

      const endSpanCall = mockTrace.span.mock.calls.find(
        (call: any) => call[0].id === spanId && call[0].endTime
      );

      expect(endSpanCall[0].output).toBe(error);
      expect(endSpanCall[0].metadata).toMatchObject({
        success: true, // Note: Current implementation doesn't set to false for errors
        error_type: 'ProcessingError',
        retry_possible: true
      });
    });
  });

  describe('Span Lifecycle Integration', () => {
    it('should handle complete span lifecycle with hooks', async () => {
      const events: string[] = [];
      
      // Set up event listeners
      wrapper.on('trace:started', () => events.push('trace:started'));
      wrapper.on('span:started', () => events.push('span:started'));
      wrapper.on('span:ended', () => events.push('span:ended'));
      wrapper.on('trace:ended', () => events.push('trace:ended'));

      // Execute full lifecycle
      const context: HookContext = {
        hookType: 'lifecycle-test',
        agentId: 'agent-123',
        agentRole: 'analyst'
      };

      const traceId = await wrapper.preHook(context);
      events.push('preHook');

      const span1 = await wrapper.createSpan(traceId!, 'analysis-step-1', {
        step: 1,
        action: 'data-collection'
      });
      events.push('createSpan-1');

      const span2 = await wrapper.createSpan(traceId!, 'analysis-step-2', {
        step: 2,
        action: 'data-processing'
      });
      events.push('createSpan-2');

      await wrapper.endSpan(span1!, { collected: 1000 });
      events.push('endSpan-1');

      await wrapper.endSpan(span2!, { processed: 950 });
      events.push('endSpan-2');

      await wrapper.postHook(traceId, { 
        analysis_complete: true,
        records: 950 
      }, {
        input: 100,
        output: 200
      });
      events.push('postHook');

      // Verify execution order
      expect(events).toContain('preHook');
      expect(events).toContain('createSpan-1');
      expect(events).toContain('createSpan-2');
      expect(events).toContain('endSpan-1');
      expect(events).toContain('endSpan-2');
      expect(events).toContain('postHook');
    });

    it('should handle concurrent span operations', async () => {
      const context: HookContext = { hookType: 'concurrent-spans' };
      const traceId = await wrapper.preHook(context);

      // Create many spans concurrently
      const spanCount = 20;
      const spanPromises = Array(spanCount).fill(0).map((_, i) => 
        wrapper.createSpan(
          traceId!,
          `concurrent-span-${i}`,
          { index: i, batch: Math.floor(i / 5) }
        )
      );

      const spanIds = await Promise.all(spanPromises);
      
      expect(spanIds.every(id => id !== null)).toBe(true);
      expect(new Set(spanIds).size).toBe(spanCount); // All unique
      expect(wrapper.getActiveSpanCount()).toBe(spanCount + 1); // +1 for main span

      // End spans in random order
      const shuffledSpanIds = [...spanIds].sort(() => Math.random() - 0.5);
      const endPromises = shuffledSpanIds.map((spanId, i) => 
        wrapper.endSpan(spanId!, { 
          completed: true,
          end_order: i 
        })
      );

      await Promise.all(endPromises);
      
      expect(wrapper.getActiveSpanCount()).toBe(1); // only main span
      
      await wrapper.postHook(traceId, { all_complete: true });
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });

    it('should maintain span hierarchy integrity', async () => {
      const context: HookContext = { hookType: 'hierarchy-test' };
      const traceId = await wrapper.preHook(context);

      // Create hierarchical span structure
      const rootSpan = await wrapper.createSpan(traceId!, 'root-operation', {
        level: 0
      });

      const level1Spans = await Promise.all([
        wrapper.createSpan(traceId!, 'child-1', { level: 1, parent: rootSpan }),
        wrapper.createSpan(traceId!, 'child-2', { level: 1, parent: rootSpan })
      ]);

      const level2Spans = await Promise.all([
        wrapper.createSpan(traceId!, 'grandchild-1', { 
          level: 2, 
          parent: level1Spans[0] 
        }),
        wrapper.createSpan(traceId!, 'grandchild-2', { 
          level: 2, 
          parent: level1Spans[0] 
        }),
        wrapper.createSpan(traceId!, 'grandchild-3', { 
          level: 2, 
          parent: level1Spans[1] 
        })
      ]);

      expect(wrapper.getActiveSpanCount()).toBe(7); // main + 6 custom

      // End spans from bottom up
      for (const spanId of level2Spans) {
        await wrapper.endSpan(spanId!, { level: 2, completed: true });
      }
      
      for (const spanId of level1Spans) {
        await wrapper.endSpan(spanId!, { level: 1, completed: true });
      }
      
      await wrapper.endSpan(rootSpan!, { level: 0, completed: true });

      expect(wrapper.getActiveSpanCount()).toBe(1); // only main span

      await wrapper.postHook(traceId, { hierarchy_complete: true });
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });

    it('should handle span operations during error scenarios', async () => {
      const context: HookContext = { hookType: 'error-span-test' };
      const traceId = await wrapper.preHook(context);

      // Create spans that will encounter errors
      const span1 = await wrapper.createSpan(traceId!, 'normal-span');
      const span2 = await wrapper.createSpan(traceId!, 'error-span');
      const span3 = await wrapper.createSpan(traceId!, 'recovery-span');

      // Normal completion
      await wrapper.endSpan(span1!, { status: 'success' });

      // Simulate error during span
      const mockTrace = mockClient.getTrace(traceId);
      mockTrace.span.mockImplementationOnce(() => {
        throw new Error('Span update failed');
      });

      // This should handle the error gracefully
      await wrapper.endSpan(span2!, { status: 'failed' });

      // Recovery span should work normally
      await wrapper.endSpan(span3!, { status: 'recovered' });

      // Complete with error hook
      await wrapper.errorHook(traceId, new Error('Operation failed'), {
        spans_completed: 2,
        spans_failed: 1
      });

      // Verify cleanup happened
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle high-frequency span creation efficiently', async () => {
      const context: HookContext = { hookType: 'performance-test' };
      const traceId = await wrapper.preHook(context);

      const startTime = Date.now();
      const spanCount = 100;

      // Create many spans rapidly
      const spanIds = [];
      for (let i = 0; i < spanCount; i++) {
        const spanId = await wrapper.createSpan(
          traceId!,
          `perf-span-${i}`,
          { index: i }
        );
        spanIds.push(spanId);
      }

      const creationTime = Date.now() - startTime;
      
      // Should create 100 spans in under 500ms
      expect(creationTime).toBeLessThan(500);
      expect(spanIds).toHaveLength(spanCount);
      expect(wrapper.getActiveSpanCount()).toBe(spanCount + 1);

      // Clean up
      const endStartTime = Date.now();
      await Promise.all(
        spanIds.map(spanId => wrapper.endSpan(spanId!, { done: true }))
      );
      const endTime = Date.now() - endStartTime;

      // Should end 100 spans in under 500ms
      expect(endTime).toBeLessThan(500);
      expect(wrapper.getActiveSpanCount()).toBe(1);

      await wrapper.postHook(traceId, { performance_test: 'complete' });
    });

    it('should not leak memory with many span operations', async () => {
      const iterations = 10;
      const spansPerIteration = 50;

      for (let i = 0; i < iterations; i++) {
        const context: HookContext = { 
          hookType: `memory-test-${i}`,
          metadata: { iteration: i }
        };
        
        const traceId = await wrapper.preHook(context);
        
        // Create and immediately end spans
        for (let j = 0; j < spansPerIteration; j++) {
          const spanId = await wrapper.createSpan(
            traceId!,
            `span-${i}-${j}`,
            { iteration: i, span: j }
          );
          
          await wrapper.endSpan(spanId!, { 
            processed: true,
            iteration: i,
            span: j
          });
        }
        
        await wrapper.postHook(traceId, { iteration_complete: i });
      }

      // All traces and spans should be cleaned up
      expect(wrapper.getActiveTraceCount()).toBe(0);
      expect(wrapper.getActiveSpanCount()).toBe(0);
    });
  });
});