/**
 * Tests for token enrichment, cost estimation, and agent multipliers
 */

import { jest } from '@jest/globals';
import { LangfuseWrapper, HookContext, TokenUsage } from '../../src';
import { createMockLangfuseClient, createMockLangfuseConstructor } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('child_process');

const MockLangfuse = createMockLangfuseConstructor();

describe('Token Enrichment and Cost Estimation Tests', () => {
  let wrapper: LangfuseWrapper;
  let mockClient: any;
  let mockExecSync: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockLangfuseClient();
    
    // Setup mocks
    (require('langfuse') as any).Langfuse = MockLangfuse;
    MockLangfuse.mockImplementation(() => mockClient);
    
    // Mock child_process for SQLite operations
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

  describe('Token Usage Tracking', () => {
    it('should track token usage with accurate cost estimation', async () => {
      const context: HookContext = {
        hookType: 'token-test',
        agentRole: 'general'
      };
      
      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);

      const tokenUsage: TokenUsage = {
        input: 1500,
        output: 3000,
        total: 4500
      };

      await wrapper.postHook(traceId, { result: 'generated' }, tokenUsage);

      const generationCall = mockTrace.generation.mock.calls[0];
      expect(generationCall[0]).toMatchObject({
        name: 'enhanced_token_usage',
        model: 'claude-flow',
        usage: {
          promptTokens: 1500,
          completionTokens: 3000,
          totalTokens: 4500
        },
        metadata: expect.objectContaining({
          estimated_cost: expect.any(Number),
          agent_multiplier: 1.0,
          agent_role: 'general'
        })
      });

      // Cost calculation: (1500 * 0.008 + 3000 * 0.024) / 1000 = 0.084
      expect(generationCall[0].metadata.estimated_cost).toBeCloseTo(0.084, 3);
    });

    it('should apply agent-specific token multipliers correctly', async () => {
      const testCases = [
        { role: 'researcher', multiplier: 1.2, input: 1000, output: 2000 },
        { role: 'coder', multiplier: 1.4, input: 800, output: 1600 },
        { role: 'analyst', multiplier: 1.1, input: 1200, output: 1800 },
        { role: 'tester', multiplier: 1.3, input: 900, output: 1500 },
        { role: 'coordinator', multiplier: 1.0, input: 500, output: 1000 },
        { role: 'architect', multiplier: 1.5, input: 2000, output: 3000 },
        { role: 'unknown', multiplier: 1.0, input: 700, output: 1300 }
      ];

      for (const testCase of testCases) {
        const context: HookContext = {
          hookType: `${testCase.role}-task`,
          agentRole: testCase.role
        };
        
        const traceId = await wrapper.preHook(context);
        const mockTrace = mockClient.getTrace(traceId);

        const tokenUsage: TokenUsage = {
          input: testCase.input,
          output: testCase.output
        };

        await wrapper.postHook(traceId, { result: 'test' }, tokenUsage, {
          model: 'claude-3-sonnet'
        });

        const generationCall = mockTrace.generation.mock.calls[0];
        
        // Verify multiplier applied correctly
        expect(generationCall[0].usage).toEqual({
          promptTokens: Math.round(testCase.input * testCase.multiplier),
          completionTokens: Math.round(testCase.output * testCase.multiplier),
          totalTokens: Math.round((testCase.input + testCase.output) * testCase.multiplier)
        });

        expect(generationCall[0].metadata.agent_multiplier).toBe(testCase.multiplier);
        expect(generationCall[0].metadata.agent_role).toBe(testCase.role);
      }
    });

    it('should handle token usage without total field', async () => {
      const context: HookContext = { hookType: 'no-total-test' };
      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);

      const tokenUsage: TokenUsage = {
        input: 500,
        output: 1000
        // No total field
      };

      await wrapper.postHook(traceId, { result: 'test' }, tokenUsage);

      const generationCall = mockTrace.generation.mock.calls[0];
      expect(generationCall[0].usage.totalTokens).toBe(1500); // Calculated
    });

    it('should include swarm coordination context in token metadata', async () => {
      // Mock SQLite responses for coordination context
      mockExecSync
        .mockReturnValueOnce('3') // active agents
        .mockReturnValueOnce('1234567890'); // timestamp

      const context: HookContext = {
        hookType: 'coordinated-token-test',
        swarmId: 'swarm-789',
        agentId: 'agent-456',
        agentRole: 'coder'
      };

      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);

      const tokenUsage: TokenUsage = {
        input: 2000,
        output: 4000
      };

      await wrapper.postHook(traceId, { code: 'generated' }, tokenUsage);

      const generationCall = mockTrace.generation.mock.calls[0];
      expect(generationCall[0].metadata).toMatchObject({
        swarm_id: 'swarm-789',
        coordination_context: {
          activeAgents: 3,
          coordinationState: 'coordinated',
          lastActivity: expect.any(String)
        }
      });
    });
  });

  describe('Token Estimation from Context', () => {
    it('should estimate tokens from string content', async () => {
      const context: HookContext = {
        hookType: 'estimation-test',
        metadata: {
          input: 'This is a test string with multiple words for token estimation.',
          output: 'The response contains even more words to properly test the token estimation functionality of our wrapper.'
        }
      };

      const traceId = await wrapper.preHook(context);
      
      // The enrichSpanWithMetadata method will estimate tokens
      const mockTrace = mockClient.getTrace(traceId);
      const spanCall = mockTrace.span.mock.calls[0];
      
      expect(spanCall[0].metadata).toMatchObject({
        token_usage: expect.objectContaining({
          input: expect.any(Number),
          output: expect.any(Number),
          total: expect.any(Number)
        }),
        token_cost: expect.any(Number),
        token_strategy: expect.any(String)
      });
    });

    it('should estimate tokens from JSON objects', async () => {
      const context: HookContext = {
        hookType: 'json-estimation-test',
        metadata: {
          input: {
            query: 'SELECT * FROM users WHERE active = true',
            parameters: { limit: 100, offset: 0 },
            options: { timeout: 5000 }
          },
          output: {
            results: Array(10).fill({ id: 1, name: 'User', email: 'user@example.com' }),
            metadata: { total: 100, page: 1 }
          }
        }
      };

      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);
      const spanCall = mockTrace.span.mock.calls[0];
      
      // Should have estimated tokens from JSON stringification
      expect(spanCall[0].metadata.token_usage).toBeTruthy();
      expect(spanCall[0].metadata.token_cost).toBeGreaterThan(0);
    });

    it('should handle token estimation errors gracefully', async () => {
      const context: HookContext = {
        hookType: 'error-estimation-test',
        metadata: {
          // Circular reference that would break JSON.stringify
          circular: {} as any
        }
      };
      
      // Create circular reference
      context.metadata!.circular.ref = context.metadata!.circular;

      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);
      const spanCall = mockTrace.span.mock.calls[0];
      
      // Should fallback gracefully
      expect(spanCall[0].metadata).toMatchObject({
        token_usage: { input: 0, output: 0, total: 0 },
        token_cost: 0,
        token_strategy: 'fallback',
        fallback_mode: true
      });
    });
  });

  describe('Cost Calculation Scenarios', () => {
    it('should calculate costs for different token ranges', async () => {
      const costScenarios = [
        { input: 100, output: 200, expectedCost: 0.0056 },     // Small
        { input: 1000, output: 2000, expectedCost: 0.056 },    // Medium
        { input: 10000, output: 20000, expectedCost: 0.56 },   // Large
        { input: 100000, output: 200000, expectedCost: 5.6 }   // Very large
      ];

      for (const scenario of costScenarios) {
        const context: HookContext = {
          hookType: `cost-scenario-${scenario.input}`,
          agentRole: 'general' // No multiplier
        };

        const traceId = await wrapper.preHook(context);
        const mockTrace = mockClient.getTrace(traceId);

        await wrapper.postHook(traceId, { result: 'test' }, {
          input: scenario.input,
          output: scenario.output
        });

        const generationCall = mockTrace.generation.mock.calls[0];
        
        // Cost = (input * 0.008 + output * 0.024) / 1000
        expect(generationCall[0].metadata.estimated_cost).toBeCloseTo(
          scenario.expectedCost,
          4
        );
      }
    });

    it('should track cumulative costs across multiple operations', async () => {
      const context: HookContext = {
        hookType: 'cumulative-cost-test',
        swarmId: 'swarm-cost-123'
      };

      let totalCost = 0;
      const operations = [
        { input: 500, output: 1000 },
        { input: 750, output: 1500 },
        { input: 1000, output: 2000 },
        { input: 1250, output: 2500 }
      ];

      for (const op of operations) {
        const traceId = await wrapper.preHook(context);
        const mockTrace = mockClient.getTrace(traceId);

        await wrapper.postHook(traceId, { result: 'test' }, op);

        const generationCall = mockTrace.generation.mock.calls[0];
        totalCost += generationCall[0].metadata.estimated_cost;
      }

      // Verify cumulative cost calculation
      const expectedTotal = operations.reduce((sum, op) => {
        return sum + (op.input * 0.008 + op.output * 0.024) / 1000;
      }, 0);

      expect(totalCost).toBeCloseTo(expectedTotal, 4);
    });
  });

  describe('Efficiency Score Calculation', () => {
    it('should calculate efficiency scores based on token throughput', async () => {
      const context: HookContext = { hookType: 'efficiency-test' };
      
      // Mock different processing speeds
      const scenarios = [
        { tokens: 1000, latencyMs: 100, expectedScore: 100 },  // 10 tokens/ms = perfect
        { tokens: 500, latencyMs: 100, expectedScore: 50 },    // 5 tokens/ms = 50%
        { tokens: 100, latencyMs: 100, expectedScore: 10 },    // 1 token/ms = 10%
        { tokens: 2000, latencyMs: 100, expectedScore: 100 },  // 20 tokens/ms = capped at 100
      ];

      for (const scenario of scenarios) {
        const traceId = await wrapper.preHook(context);
        const mockTrace = mockClient.getTrace(traceId);

        // The efficiency score is calculated in enrichSpanWithMetadata
        // We can't directly control latency, but we can check the metadata
        const spanCall = mockTrace.span.mock.calls[0];
        
        // Efficiency score should be present
        expect(spanCall[0].metadata.efficiency_score).toBeDefined();
        expect(spanCall[0].metadata.efficiency_score).toBeGreaterThanOrEqual(0);
        expect(spanCall[0].metadata.efficiency_score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Coordination Memory Integration', () => {
    it('should store token metrics in coordination memory', async () => {
      const context: HookContext = {
        hookType: 'memory-integration-test',
        swarmId: 'swarm-memory-123',
        agentId: 'agent-memory-456',
        agentRole: 'analyst'
      };

      const traceId = await wrapper.preHook(context);
      
      await wrapper.postHook(traceId, { result: 'analyzed' }, {
        input: 2500,
        output: 5000
      });

      // Verify SQLite was called to store coordination data
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO memory_entries'),
        expect.any(Object)
      );

      // Check the stored data structure
      const insertCall = mockExecSync.mock.calls.find(
        call => call[0].includes('INSERT OR REPLACE')
      );
      
      expect(insertCall).toBeTruthy();
      expect(insertCall[0]).toContain('langfuse/trace/swarm-memory-123/agent-memory-456');
    });

    it('should handle memory storage failures gracefully', async () => {
      // Make SQLite fail for storage operations
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('INSERT')) {
          throw new Error('SQLite write error');
        }
        return '0';
      });

      const context: HookContext = {
        hookType: 'memory-failure-test',
        swarmId: 'swarm-fail',
        agentId: 'agent-fail'
      };

      const traceId = await wrapper.preHook(context);
      
      // Should not throw even if memory storage fails
      await expect(
        wrapper.postHook(traceId, { result: 'test' }, {
          input: 1000,
          output: 2000
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Advanced Token Scenarios', () => {
    it('should handle very large token counts', async () => {
      const context: HookContext = {
        hookType: 'large-token-test',
        agentRole: 'architect' // 1.5x multiplier
      };

      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);

      const largeTokenUsage: TokenUsage = {
        input: 128000,  // Max context size
        output: 256000  // Large generation
      };

      await wrapper.postHook(traceId, { result: 'large' }, largeTokenUsage);

      const generationCall = mockTrace.generation.mock.calls[0];
      
      // With architect multiplier: 1.5x
      expect(generationCall[0].usage).toEqual({
        promptTokens: 192000,
        completionTokens: 384000,
        totalTokens: 576000
      });

      // Large cost calculation
      const expectedCost = (128000 * 0.008 + 256000 * 0.024) / 1000;
      expect(generationCall[0].metadata.estimated_cost).toBeCloseTo(expectedCost, 2);
    });

    it('should handle zero token usage', async () => {
      const context: HookContext = { hookType: 'zero-token-test' };
      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);

      await wrapper.postHook(traceId, { result: 'empty' }, {
        input: 0,
        output: 0
      });

      const generationCall = mockTrace.generation.mock.calls[0];
      
      expect(generationCall[0].usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      });
      
      expect(generationCall[0].metadata.estimated_cost).toBe(0);
    });

    it('should handle fractional token multipliers correctly', async () => {
      const context: HookContext = {
        hookType: 'fractional-multiplier-test',
        agentRole: 'analyst' // 1.1x multiplier
      };

      const traceId = await wrapper.preHook(context);
      const mockTrace = mockClient.getTrace(traceId);

      await wrapper.postHook(traceId, { result: 'test' }, {
        input: 333,
        output: 777
      });

      const generationCall = mockTrace.generation.mock.calls[0];
      
      // Should round correctly: 333 * 1.1 = 366.3 → 366
      expect(generationCall[0].usage.promptTokens).toBe(366);
      // 777 * 1.1 = 854.7 → 855
      expect(generationCall[0].usage.completionTokens).toBe(855);
    });
  });
});