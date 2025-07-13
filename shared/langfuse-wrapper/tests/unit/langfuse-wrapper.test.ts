import { jest } from '@jest/globals';
import { LangfuseWrapper, LangfuseWrapperConfig } from '../../src';
import Langfuse from 'langfuse';
import Database from 'better-sqlite3';
import winston from 'winston';

// Mock dependencies
jest.mock('langfuse');
jest.mock('better-sqlite3');

describe('LangfuseWrapper', () => {
  let wrapper: LangfuseWrapper;
  let mockLangfuseClient: any;
  let mockDatabase: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Langfuse client
    mockLangfuseClient = global.testHelpers.mockLangfuseClient();
    (Langfuse as jest.MockedClass<typeof Langfuse>).mockImplementation(() => mockLangfuseClient);

    // Mock Database
    mockDatabase = {
      exec: jest.fn(),
      prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn().mockReturnValue({
          total_traces: 10,
          pending_traces: 2,
          completed_traces: 8,
          avg_duration_ms: 1500
        })
      }),
      close: jest.fn()
    };
    (Database as jest.MockedClass<typeof Database>).mockImplementation(() => mockDatabase);

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize with valid credentials', () => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);

      expect(Langfuse).toHaveBeenCalledWith({
        publicKey: config.publicKey,
        secretKey: config.secretKey,
        baseUrl: config.host,
        flushAt: config.flushAt,
        flushInterval: config.flushInterval
      });

      expect(wrapper.isEnabled()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Langfuse client initialized successfully');
    });

    it('should initialize in disabled mode without credentials', () => {
      const config = global.testHelpers.createMockConfig({ 
        publicKey: undefined,
        secretKey: undefined,
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);

      expect(Langfuse).not.toHaveBeenCalled();
      expect(wrapper.isEnabled()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Langfuse credentials not provided - running in disabled mode');
    });

    it('should initialize memory database when configured', () => {
      const config = global.testHelpers.createMockConfig({ 
        memoryDbPath: ':memory:',
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);

      expect(Database).toHaveBeenCalledWith(expect.stringContaining(':memory:'));
      expect(mockDatabase.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS traces'));
      expect(mockLogger.info).toHaveBeenCalledWith('Memory database initialized', expect.any(Object));
    });

    it('should handle initialization errors gracefully', () => {
      (Langfuse as jest.MockedClass<typeof Langfuse>).mockImplementationOnce(() => {
        throw new Error('Init failed');
      });

      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);

      expect(wrapper.isEnabled()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize Langfuse wrapper', expect.any(Object));
    });

    it('should emit initialization events', (done) => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);

      wrapper.on('initialized', (event) => {
        expect(event).toEqual({ enabled: true });
        done();
      });
    });
  });

  describe('Trace Management', () => {
    beforeEach(() => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);
    });

    it('should start a trace successfully', async () => {
      const mockTrace = {
        span: jest.fn(),
        generation: jest.fn(),
        event: jest.fn(),
        update: jest.fn()
      };
      mockLangfuseClient.trace.mockReturnValue(mockTrace);

      const traceId = await wrapper.startTrace('test-operation', { test: 'metadata' });

      expect(traceId).toMatch(/^trace-\d+-[a-z0-9]+$/);
      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({
        id: traceId,
        name: 'test-operation',
        metadata: { test: 'metadata' }
      });
      expect(wrapper.getActiveTraces()).toContain(traceId);
    });

    it('should end a trace successfully', async () => {
      const mockTrace = {
        update: jest.fn(),
        span: jest.fn(),
        generation: jest.fn(),
        event: jest.fn()
      };
      mockLangfuseClient.trace.mockReturnValue(mockTrace);

      const traceId = await wrapper.startTrace('test-operation');
      await wrapper.endTrace(traceId, { final: 'metadata' });

      expect(mockTrace.update).toHaveBeenCalledWith({
        metadata: {
          final: 'metadata',
          completed_at: expect.any(String)
        }
      });
      expect(mockLangfuseClient.flushAsync).toHaveBeenCalled();
      expect(wrapper.getActiveTraces()).not.toContain(traceId);
    });

    it('should handle trace operations when disabled', async () => {
      const config = global.testHelpers.createMockConfig({ 
        publicKey: undefined,
        secretKey: undefined,
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);

      const traceId = await wrapper.startTrace('test-operation');
      expect(traceId).toMatch(/^trace-\d+-[a-z0-9]+$/);
      expect(mockLangfuseClient.trace).not.toHaveBeenCalled();

      await wrapper.endTrace(traceId);
      expect(mockLangfuseClient.flushAsync).not.toHaveBeenCalled();
    });

    it('should store traces in memory database', async () => {
      const traceId = await wrapper.startTrace('test-operation', { test: 'data' });

      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO traces'));
      const mockStmt = mockDatabase.prepare.mock.results[0].value;
      expect(mockStmt.run).toHaveBeenCalledWith(
        traceId,
        traceId,
        'test-operation',
        JSON.stringify({ test: 'data' }),
        expect.any(Number)
      );
    });
  });

  describe('Span Management', () => {
    let traceId: string;
    let mockTrace: any;

    beforeEach(async () => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);
      
      mockTrace = {
        span: jest.fn(),
        generation: jest.fn(),
        event: jest.fn(),
        update: jest.fn()
      };
      mockLangfuseClient.trace.mockReturnValue(mockTrace);
      
      traceId = await wrapper.startTrace('test-trace');
    });

    it('should start a span successfully', async () => {
      const spanId = 'test-span-1';
      const enrichment = {
        metadata: { key: 'value' },
        input: { test: 'input' }
      };

      await wrapper.startSpan(spanId, 'test-span', traceId, enrichment);

      expect(mockTrace.span).toHaveBeenCalledWith({
        id: spanId,
        name: 'test-span',
        input: enrichment.input,
        metadata: enrichment.metadata
      });
      expect(wrapper.getActiveSpans()).toContain(spanId);
    });

    it('should end a span successfully', async () => {
      const spanId = 'test-span-1';
      await wrapper.startSpan(spanId, 'test-span', traceId);
      
      const output = { result: 'success' };
      await wrapper.endSpan(spanId, output);

      expect(mockTrace.span).toHaveBeenCalledWith({
        id: spanId,
        endTime: expect.any(Date),
        output: output,
        metadata: {
          duration_ms: expect.any(Number),
          status: 'success'
        }
      });
      expect(wrapper.getActiveSpans()).not.toContain(spanId);
    });

    it('should handle span errors', async () => {
      const spanId = 'test-span-1';
      await wrapper.startSpan(spanId, 'test-span', traceId);
      
      const error = new Error('Test error');
      await wrapper.endSpan(spanId, undefined, error);

      expect(mockTrace.span).toHaveBeenCalledWith({
        id: spanId,
        endTime: expect.any(Date),
        output: error,
        metadata: {
          duration_ms: expect.any(Number),
          status: 'error'
        }
      });
    });

    it('should warn when ending non-existent span', async () => {
      await wrapper.endSpan('non-existent-span');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to end non-existent span',
        { spanId: 'non-existent-span' }
      );
    });
  });

  describe('Generation Tracking', () => {
    let traceId: string;
    let mockTrace: any;

    beforeEach(async () => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);
      
      mockTrace = {
        span: jest.fn(),
        generation: jest.fn(),
        event: jest.fn(),
        update: jest.fn()
      };
      mockLangfuseClient.trace.mockReturnValue(mockTrace);
      
      traceId = await wrapper.startTrace('test-trace');
    });

    it('should track generation successfully', async () => {
      const generationData = {
        model: 'gpt-4',
        prompt: 'Test prompt',
        response: 'Test response',
        tokenUsage: { input: 100, output: 200 },
        metadata: { test: 'metadata' }
      };

      await wrapper.trackGeneration(
        traceId,
        generationData.model,
        generationData.prompt,
        generationData.response,
        generationData.tokenUsage,
        generationData.metadata
      );

      expect(mockTrace.generation).toHaveBeenCalledWith({
        name: 'gpt-4 generation',
        model: generationData.model,
        input: generationData.prompt,
        output: generationData.response,
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300
        },
        metadata: generationData.metadata
      });
    });

    it('should emit generation tracked event', (done) => {
      wrapper.on('generation:tracked', (event) => {
        expect(event).toEqual({
          traceId,
          model: 'gpt-4',
          tokenUsage: { input: 100, output: 200 }
        });
        done();
      });

      wrapper.trackGeneration(
        traceId,
        'gpt-4',
        'prompt',
        'response',
        { input: 100, output: 200 }
      );
    });
  });

  describe('Error Tracking', () => {
    let traceId: string;
    let mockTrace: any;

    beforeEach(async () => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);
      
      mockTrace = {
        span: jest.fn(),
        generation: jest.fn(),
        event: jest.fn(),
        update: jest.fn()
      };
      mockLangfuseClient.trace.mockReturnValue(mockTrace);
      
      traceId = await wrapper.startTrace('test-trace');
    });

    it('should track errors successfully', async () => {
      const error = new Error('Test error');
      error.stack = 'Test stack trace';
      const metadata = { context: 'test' };

      await wrapper.trackError(traceId, error, metadata);

      expect(mockTrace.event).toHaveBeenCalledWith({
        name: 'error',
        level: 'ERROR',
        statusMessage: 'Test error',
        metadata: {
          context: 'test',
          error: {
            message: 'Test error',
            stack: 'Test stack trace'
          }
        }
      });
    });

    it('should execute error hooks', async () => {
      const error = new Error('Test error');
      const errorHook = jest.fn();
      
      wrapper.registerHook('error', errorHook);
      await wrapper.trackError(traceId, error);

      expect(errorHook).toHaveBeenCalledWith({
        type: 'error',
        operation: traceId,
        metadata: undefined,
        error,
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Hook System', () => {
    beforeEach(() => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);
    });

    it('should register and execute hooks', async () => {
      const preHook = jest.fn();
      const postHook = jest.fn();
      
      wrapper.registerHook('pre-trace', preHook);
      wrapper.registerHook('post-trace', postHook);

      const traceId = await wrapper.startTrace('test-operation');
      await wrapper.endTrace(traceId);

      expect(preHook).toHaveBeenCalledWith({
        type: 'pre',
        operation: 'test-operation',
        metadata: expect.objectContaining({ traceId }),
        timestamp: expect.any(Date)
      });

      expect(postHook).toHaveBeenCalledWith({
        type: 'post',
        operation: traceId,
        metadata: undefined,
        timestamp: expect.any(Date)
      });
    });

    it('should handle hook errors gracefully', async () => {
      const failingHook = jest.fn().mockRejectedValue(new Error('Hook failed'));
      wrapper.registerHook('pre-trace', failingHook);

      // Should not throw
      const traceId = await wrapper.startTrace('test-operation');
      expect(traceId).toBeTruthy();
      expect(mockLogger.error).toHaveBeenCalledWith('Hook execution failed', expect.any(Object));
    });

    it('should execute multiple hooks in order', async () => {
      const order: number[] = [];
      const hook1 = jest.fn(() => order.push(1));
      const hook2 = jest.fn(() => order.push(2));
      const hook3 = jest.fn(() => order.push(3));

      wrapper.registerHook('pre-trace', hook1);
      wrapper.registerHook('pre-trace', hook2);
      wrapper.registerHook('pre-trace', hook3);

      await wrapper.startTrace('test-operation');

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('Auto-registration', () => {
    it('should auto-register with Claude-Flow when enabled', () => {
      process.env.CLAUDE_FLOW_ENABLED = 'true';
      
      const config = global.testHelpers.createMockConfig({ 
        autoRegister: true,
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);

      expect(mockLogger.info).toHaveBeenCalledWith('Auto-registering with Claude-Flow hooks');
      
      // Should have registered hooks
      const traceId = wrapper.startTrace('test');
      expect(traceId).toBeTruthy();
      
      process.env.CLAUDE_FLOW_ENABLED = 'false';
    });

    it('should skip auto-registration when disabled', () => {
      const config = global.testHelpers.createMockConfig({ 
        autoRegister: false,
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);

      expect(mockLogger.info).not.toHaveBeenCalledWith('Auto-registering with Claude-Flow hooks');
    });
  });

  describe('Memory Database Operations', () => {
    beforeEach(() => {
      const config = global.testHelpers.createMockConfig({ 
        memoryDbPath: ':memory:',
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);
    });

    it('should get memory stats', () => {
      const stats = wrapper.getMemoryStats();
      
      expect(stats).toEqual({
        total_traces: 10,
        pending_traces: 2,
        completed_traces: 8,
        avg_duration_ms: 1500
      });
    });

    it('should handle memory stats errors', () => {
      mockDatabase.prepare.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const stats = wrapper.getMemoryStats();
      
      expect(stats).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get memory stats', expect.any(Object));
    });

    it('should update trace status when ending', async () => {
      const traceId = await wrapper.startTrace('test-operation');
      await wrapper.endTrace(traceId);

      const updateStmt = mockDatabase.prepare.mock.calls.find(
        call => call[0].includes('UPDATE traces')
      );
      expect(updateStmt).toBeTruthy();
      
      const mockStmt = mockDatabase.prepare.mock.results.find(r => r.value.run).value;
      expect(mockStmt.run).toHaveBeenCalledWith('completed', expect.any(Number), traceId);
    });
  });

  describe('Shutdown and Cleanup', () => {
    beforeEach(() => {
      const config = global.testHelpers.createMockConfig({ 
        memoryDbPath: ':memory:',
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);
    });

    it('should shutdown cleanly', async () => {
      await wrapper.shutdown();

      expect(mockLangfuseClient.shutdownAsync).toHaveBeenCalled();
      expect(mockDatabase.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Langfuse wrapper shut down');
    });

    it('should emit shutdown event', (done) => {
      wrapper.on('shutdown', () => {
        done();
      });

      wrapper.shutdown();
    });

    it('should handle shutdown errors', async () => {
      mockLangfuseClient.shutdownAsync.mockRejectedValue(new Error('Shutdown failed'));

      await wrapper.shutdown();

      expect(mockLogger.error).toHaveBeenCalledWith('Error during shutdown', expect.any(Object));
    });

    it('should flush before shutdown', async () => {
      await wrapper.flush();
      expect(mockLangfuseClient.flushAsync).toHaveBeenCalled();
    });
  });

  describe('Event Emissions', () => {
    beforeEach(() => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);
    });

    it('should emit trace lifecycle events', async () => {
      const events: any[] = [];
      
      wrapper.on('trace:started', (e) => events.push({ type: 'started', ...e }));
      wrapper.on('trace:ended', (e) => events.push({ type: 'ended', ...e }));

      const traceId = await wrapper.startTrace('test-op', { meta: 'data' });
      await wrapper.endTrace(traceId, { final: 'meta' });

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: 'started',
        traceId,
        name: 'test-op',
        metadata: { meta: 'data' }
      });
      expect(events[1]).toMatchObject({
        type: 'ended',
        traceId,
        metadata: { final: 'meta' }
      });
    });

    it('should emit span lifecycle events', async () => {
      const events: any[] = [];
      
      wrapper.on('span:started', (e) => events.push({ type: 'started', ...e }));
      wrapper.on('span:ended', (e) => events.push({ type: 'ended', ...e }));

      const traceId = await wrapper.startTrace('test-trace');
      await wrapper.startSpan('span-1', 'test-span', traceId, { metadata: { test: true } });
      await wrapper.endSpan('span-1', { output: 'data' });

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: 'started',
        spanId: 'span-1',
        name: 'test-span',
        traceId
      });
      expect(events[1]).toMatchObject({
        type: 'ended',
        spanId: 'span-1',
        status: 'success'
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      const config = global.testHelpers.createMockConfig({ logger: mockLogger });
      wrapper = new LangfuseWrapper(config);
    });

    it('should handle missing trace when tracking generation', async () => {
      await wrapper.trackGeneration(
        'non-existent-trace',
        'gpt-4',
        'prompt',
        'response',
        { input: 10, output: 20 }
      );

      expect(mockLangfuseClient.trace).toHaveBeenCalledWith({ id: 'non-existent-trace' });
    });

    it('should handle database initialization failure', () => {
      (Database as jest.MockedClass<typeof Database>).mockImplementationOnce(() => {
        throw new Error('DB init failed');
      });

      const config = global.testHelpers.createMockConfig({ 
        memoryDbPath: ':memory:',
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize memory database', expect.any(Object));
    });

    it('should work without memory database', () => {
      const config = global.testHelpers.createMockConfig({ 
        memoryDbPath: undefined,
        logger: mockLogger
      });
      wrapper = new LangfuseWrapper(config);

      const stats = wrapper.getMemoryStats();
      expect(stats).toBeNull();
    });

    it('should handle concurrent operations safely', async () => {
      const promises = [];
      
      // Start multiple traces concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(wrapper.startTrace(`operation-${i}`));
      }
      
      const traceIds = await Promise.all(promises);
      
      expect(traceIds).toHaveLength(10);
      expect(new Set(traceIds).size).toBe(10); // All unique
      expect(wrapper.getActiveTraces()).toHaveLength(10);
    });
  });
});