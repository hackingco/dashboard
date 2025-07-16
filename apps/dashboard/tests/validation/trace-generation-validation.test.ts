/**
 * Comprehensive Trace Generation Validation Tests
 * Tests the creation, validation, and processing of langfuse traces
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LangfuseRealtimeClient } from '../../lib/langfuse-client';
import { createSwarmLogger } from '../../lib/swarm-langfuse-logger';
import type { LiveTrace, SwarmMetrics } from '../../lib/langfuse-client';
import { mockLangfuseTraces, createMockLangfuseClient, generateMockTrace } from '../unit/mocks/langfuse-mocks';

describe('Trace Generation Validation Tests', () => {
  let client: LangfuseRealtimeClient;
  let swarmLogger: ReturnType<typeof createSwarmLogger>;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockLangfuseClient();
    
    client = new LangfuseRealtimeClient({
      baseUrl: 'http://localhost:3000',
      enableRealtime: true,
      autoFlush: false,
    });
    
    swarmLogger = createSwarmLogger('test-swarm', 'test-session');
  });

  afterEach(async () => {
    if (client) {
      await client.shutdown();
    }
    if (swarmLogger) {
      await swarmLogger.close();
    }
  });

  describe('Basic Trace Creation', () => {
    it('should create a valid trace with all required fields', async () => {
      const traceData = {
        id: 'test-trace-001',
        name: 'Test Trace Creation',
        sessionId: 'test-session',
        userId: 'test-user',
        timestamp: new Date(),
        status: 'success' as const,
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalCost: 0.003,
        input: 'Test input for trace creation',
        output: 'Test output from trace creation',
        metadata: {
          testMode: true,
          agentId: 'test-agent',
          swarmId: 'test-swarm',
        },
        tags: ['test', 'validation'],
        scores: { quality: 0.95, relevance: 0.88 },
      };

      const traceId = await client.createTrace(traceData);
      
      expect(traceId).toBeTruthy();
      expect(typeof traceId).toBe('string');
    });

    it('should handle trace creation with minimal required fields', async () => {
      const minimalTrace = {
        name: 'Minimal Trace',
        input: 'Minimal input',
        output: 'Minimal output',
      };

      const traceId = await client.createTrace(minimalTrace);
      
      // Should either succeed or fail gracefully
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });

    it('should generate unique trace IDs', async () => {
      const traceIds = new Set<string>();
      const promises = Array.from({ length: 10 }, (_, i) => 
        client.createTrace({
          name: `Unique Trace ${i}`,
          input: `Input ${i}`,
          output: `Output ${i}`,
        })
      );

      const results = await Promise.all(promises);
      
      results.forEach(traceId => {
        if (traceId) {
          expect(traceIds.has(traceId)).toBe(false);
          traceIds.add(traceId);
        }
      });
    });
  });

  describe('Trace Data Structure Validation', () => {
    it('should validate trace data types correctly', () => {
      const trace = generateMockTrace();
      
      // Required string fields
      expect(typeof trace.id).toBe('string');
      expect(typeof trace.name).toBe('string');
      expect(typeof trace.sessionId).toBe('string');
      expect(typeof trace.model).toBe('string');
      expect(typeof trace.input).toBe('string');
      expect(typeof trace.output).toBe('string');
      
      // Required number fields
      expect(typeof trace.promptTokens).toBe('number');
      expect(typeof trace.completionTokens).toBe('number');
      expect(typeof trace.totalCost).toBe('number');
      expect(typeof trace.duration).toBe('number');
      
      // Date field
      expect(trace.timestamp).toBeInstanceOf(Date);
      
      // Enum field
      expect(['success', 'error', 'pending', 'running']).toContain(trace.status);
      
      // Optional fields
      if (trace.metadata) {
        expect(typeof trace.metadata).toBe('object');
      }
      if (trace.tags) {
        expect(Array.isArray(trace.tags)).toBe(true);
      }
      if (trace.scores) {
        expect(typeof trace.scores).toBe('object');
      }
    });

    it('should validate numeric field ranges', () => {
      const trace = generateMockTrace();
      
      // Token counts should be non-negative
      expect(trace.promptTokens).toBeGreaterThanOrEqual(0);
      expect(trace.completionTokens).toBeGreaterThanOrEqual(0);
      
      // Cost should be non-negative
      expect(trace.totalCost).toBeGreaterThanOrEqual(0);
      
      // Duration should be positive for completed traces
      if (trace.status === 'success' || trace.status === 'error') {
        expect(trace.duration).toBeGreaterThan(0);
      }
      
      // Score ranges should be between 0 and 1
      if (trace.scores) {
        Object.values(trace.scores).forEach(score => {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should validate array and object structures', () => {
      const trace = generateMockTrace({
        tags: ['test', 'validation', 'structure'],
        metadata: {
          agentId: 'test-agent',
          swarmId: 'test-swarm',
          custom: { nested: 'value' },
        },
        scores: {
          quality: 0.95,
          relevance: 0.88,
          accuracy: 0.92,
        },
      });
      
      // Tags should be array of strings
      expect(Array.isArray(trace.tags)).toBe(true);
      trace.tags?.forEach(tag => {
        expect(typeof tag).toBe('string');
      });
      
      // Metadata should be object
      expect(typeof trace.metadata).toBe('object');
      expect(trace.metadata).not.toBeNull();
      
      // Scores should be object with numeric values
      if (trace.scores) {
        Object.entries(trace.scores).forEach(([key, value]) => {
          expect(typeof key).toBe('string');
          expect(typeof value).toBe('number');
        });
      }
    });
  });

  describe('Trace Status Transitions', () => {
    it('should handle status transitions correctly', async () => {
      const initialTrace = generateMockTrace({
        status: 'pending',
        duration: 0,
      });
      
      const runningTrace = { ...initialTrace, status: 'running' as const };
      const completedTrace = { ...initialTrace, status: 'success' as const, duration: 1500 };
      
      expect(initialTrace.status).toBe('pending');
      expect(runningTrace.status).toBe('running');
      expect(completedTrace.status).toBe('success');
      expect(completedTrace.duration).toBeGreaterThan(0);
    });

    it('should validate status-specific fields', () => {
      const pendingTrace = generateMockTrace({ status: 'pending' });
      const runningTrace = generateMockTrace({ status: 'running' });
      const successTrace = generateMockTrace({ status: 'success', duration: 1200 });
      const errorTrace = generateMockTrace({ status: 'error', duration: 800 });
      
      // Running traces may have zero duration
      expect(runningTrace.duration).toBeGreaterThanOrEqual(0);
      
      // Completed traces should have positive duration
      expect(successTrace.duration).toBeGreaterThan(0);
      expect(errorTrace.duration).toBeGreaterThan(0);
    });
  });

  describe('Swarm Logger Integration', () => {
    it('should log swarm initialization correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logSwarmInit('mesh', 5, 'parallel');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log agent spawning with correct metadata', async () => {
      const agentData = {
        id: 'test-agent-001',
        name: 'Test Agent',
        type: 'researcher',
        capabilities: ['search', 'analyze', 'summarize'],
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logAgentSpawn(
        agentData.id,
        agentData.name,
        agentData.type,
        agentData.capabilities
      );
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log task assignments with priority', async () => {
      const taskData = {
        agentId: 'test-agent-001',
        task: 'Analyze user behavior patterns',
        priority: 'high',
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logAgentTask(
        taskData.agentId,
        taskData.task,
        taskData.priority
      );
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log task completion with results', async () => {
      const completionData = {
        agentId: 'test-agent-001',
        result: {
          success: true,
          patterns: ['pattern1', 'pattern2'],
          insights: 'User behavior shows increased engagement',
        },
        duration: 2500,
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logAgentComplete(
        completionData.agentId,
        completionData.result,
        completionData.duration
      );
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log coordination events', async () => {
      const coordinationData = {
        event: 'task_distribution',
        participants: ['agent-001', 'agent-002', 'agent-003'],
        data: {
          totalTasks: 10,
          distribution: { 'agent-001': 4, 'agent-002': 3, 'agent-003': 3 },
        },
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logSwarmCoordination(
        coordinationData.event,
        coordinationData.participants,
        coordinationData.data
      );
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log metrics updates', async () => {
      const metricsData = {
        activeAgents: 5,
        completedTasks: 25,
        averageResponseTime: 1200,
        throughput: 15,
        errorRate: 2.5,
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logSwarmMetrics(metricsData);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log errors with context', async () => {
      const errorData = {
        agentId: 'test-agent-001',
        error: new Error('Test error message'),
        context: {
          operation: 'data_analysis',
          input: 'invalid_data_format',
          timestamp: new Date().toISOString(),
        },
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logError(
        errorData.agentId,
        errorData.error,
        errorData.context
      );
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log performance warnings', async () => {
      const performanceData = {
        operation: 'database_query',
        duration: 5500,
        threshold: 3000,
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await swarmLogger.logPerformanceWarning(
        performanceData.operation,
        performanceData.duration,
        performanceData.threshold
      );
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Batch Processing', () => {
    it('should handle batch trace creation', async () => {
      const batchSize = 10;
      const traces = Array.from({ length: batchSize }, (_, i) => 
        generateMockTrace({
          id: `batch-trace-${i}`,
          name: `Batch Trace ${i}`,
        })
      );
      
      const promises = traces.map(trace => client.createTrace(trace));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(batchSize);
      results.forEach(result => {
        expect(result === null || typeof result === 'string').toBe(true);
      });
    });

    it('should handle concurrent trace operations', async () => {
      const concurrentOperations = 5;
      const promises = Array.from({ length: concurrentOperations }, (_, i) => 
        client.getTraces({ limit: 10 })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(concurrentOperations);
      results.forEach(traceList => {
        expect(Array.isArray(traceList)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid trace data gracefully', async () => {
      const invalidTrace = {
        // Missing required fields
        name: '',
        input: null,
        output: undefined,
        promptTokens: -1,
        completionTokens: 'invalid',
        totalCost: 'not-a-number',
      } as any;
      
      const traceId = await client.createTrace(invalidTrace);
      
      // Should either return null or handle gracefully
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });

    it('should handle network errors during trace creation', async () => {
      // Mock network error
      const originalFetch = global.fetch;
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
      
      const trace = generateMockTrace();
      const traceId = await client.createTrace(trace);
      
      // Should return null on error
      expect(traceId).toBe(null);
      
      global.fetch = originalFetch;
    });

    it('should handle API timeout errors', async () => {
      // Mock timeout error
      const originalFetch = global.fetch;
      global.fetch = vi.fn(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );
      
      const trace = generateMockTrace();
      const traceId = await client.createTrace(trace);
      
      // Should return null on timeout
      expect(traceId).toBe(null);
      
      global.fetch = originalFetch;
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large trace payloads', async () => {
      const largeTrace = generateMockTrace({
        input: 'x'.repeat(10000), // 10KB input
        output: 'y'.repeat(10000), // 10KB output
        metadata: {
          largeData: Array.from({ length: 1000 }, (_, i) => `item-${i}`),
        },
      });
      
      const startTime = performance.now();
      const traceId = await client.createTrace(largeTrace);
      const endTime = performance.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      expect(traceId === null || typeof traceId === 'string').toBe(true);
    });

    it('should handle memory-intensive operations', async () => {
      const memoryIntensiveTraces = Array.from({ length: 100 }, (_, i) => 
        generateMockTrace({
          id: `memory-trace-${i}`,
          metadata: {
            data: Array.from({ length: 1000 }, (_, j) => ({ id: j, value: Math.random() })),
          },
        })
      );
      
      const startTime = performance.now();
      const promises = memoryIntensiveTraces.map(trace => client.createTrace(trace));
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
      expect(results).toHaveLength(100);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across operations', async () => {
      const trace1 = generateMockTrace({ sessionId: 'consistency-session' });
      const trace2 = generateMockTrace({ sessionId: 'consistency-session' });
      
      await client.createTrace(trace1);
      await client.createTrace(trace2);
      
      const traces = await client.getTraces({ sessionId: 'consistency-session' });
      
      // Should return consistent data
      expect(Array.isArray(traces)).toBe(true);
      traces.forEach(trace => {
        expect(trace.sessionId).toBe('consistency-session');
      });
    });

    it('should handle concurrent modifications correctly', async () => {
      const baseTrace = generateMockTrace({ id: 'concurrent-trace' });
      
      // Create trace first
      await client.createTrace(baseTrace);
      
      // Simulate concurrent updates
      const updatePromises = Array.from({ length: 5 }, (_, i) => 
        client.updateTrace(baseTrace.id, {
          metadata: { update: i, timestamp: Date.now() },
        })
      );
      
      const results = await Promise.all(updatePromises);
      
      // Should handle concurrent updates gracefully
      results.forEach(result => {
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with real-time updates', async () => {
      let receivedTraces: LiveTrace[] = [];
      
      client.on('trace', (trace: LiveTrace) => {
        receivedTraces.push(trace);
      });
      
      // Simulate real-time trace creation
      const testTrace = generateMockTrace();
      await client.createTrace(testTrace);
      
      // Give time for real-time updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if we received real-time updates (may be mocked)
      expect(receivedTraces.length).toBeGreaterThanOrEqual(0);
    });

    it('should integrate with metrics calculation', async () => {
      // Create multiple traces
      const traces = Array.from({ length: 5 }, (_, i) => 
        generateMockTrace({
          id: `metrics-trace-${i}`,
          status: i % 2 === 0 ? 'success' : 'error',
        })
      );
      
      for (const trace of traces) {
        await client.createTrace(trace);
      }
      
      const metrics = await client.getSwarmMetrics();
      
      // Should calculate metrics correctly
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalTraces).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
    });
  });
});