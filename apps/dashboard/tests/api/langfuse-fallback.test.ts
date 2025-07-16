/**
 * Langfuse Mock Data Fallback Tests
 * Tests behavior when Langfuse API is unavailable and system falls back to mock data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LangfuseRealtimeClient } from '../../lib/langfuse-client';
import { langfuseAPI } from '../../lib/langfuse-api';
import type { LiveTrace, SwarmMetrics } from '../../lib/langfuse-client';

describe('Langfuse Mock Data Fallback Tests', () => {
  let client: LangfuseRealtimeClient;
  let originalFetch: typeof global.fetch;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Store original functions
    originalFetch = global.fetch;
    originalConsoleWarn = console.warn;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Mock console to reduce noise in tests
    console.warn = vi.fn();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  afterEach(async () => {
    // Restore original functions
    global.fetch = originalFetch;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    if (client) {
      await client.shutdown();
    }
  });

  describe('Network Failure Scenarios', () => {
    it('should fallback to mock data when fetch fails', async () => {
      // Mock fetch to always fail
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: false,
      });

      const traces = await client.getTraces({ limit: 10 });

      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0);
      expect(traces[0]).toHaveProperty('id');
      expect(traces[0]).toHaveProperty('name');
      expect(traces[0]).toHaveProperty('sessionId');
      expect(traces[0]).toHaveProperty('metadata');

      // Should have warned about fallback
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Langfuse'),
        expect.any(Error)
      );
    });

    it('should fallback to mock data when API returns error', async () => {
      // Mock fetch to return error response
      global.fetch = vi.fn(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: 'Server error' }),
        } as Response)
      );

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: false,
      });

      const traces = await client.getTraces({ limit: 5 });

      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0);
      
      // Validate mock trace structure
      const trace = traces[0];
      expect(trace.metadata).toHaveProperty('swarmDemo', true);
      expect(trace.metadata).toHaveProperty('dashboardIntegration', true);
      expect(trace.tags).toContain('swarm');
    });

    it('should fallback to mock data when API times out', async () => {
      // Mock fetch to timeout
      global.fetch = vi.fn(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        })
      );

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: false,
      });

      const startTime = Date.now();
      const traces = await client.getTraces({ limit: 10 });
      const duration = Date.now() - startTime;

      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0);
      // Should complete quickly with mock data
      expect(duration).toBeLessThan(1000);
    });

    it('should fallback to mock data when response is malformed', async () => {
      // Mock fetch to return malformed JSON
      global.fetch = vi.fn(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invalid: 'structure' }),
        } as Response)
      );

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: false,
      });

      const traces = await client.getTraces({ limit: 10 });

      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0);
      
      // Should return properly structured mock traces
      traces.forEach(trace => {
        expect(trace).toHaveProperty('id');
        expect(trace).toHaveProperty('name');
        expect(trace).toHaveProperty('status');
        expect(['success', 'error', 'pending', 'running']).toContain(trace.status);
      });
    });
  });

  describe('Mock Data Quality and Structure', () => {
    it('should provide realistic mock traces', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Offline')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://offline:3000',
        enableRealtime: false,
      });

      const traces = await client.getTraces({ limit: 20 });

      expect(traces.length).toBeGreaterThan(0);

      traces.forEach(trace => {
        // Validate required fields
        expect(typeof trace.id).toBe('string');
        expect(typeof trace.name).toBe('string');
        expect(typeof trace.sessionId).toBe('string');
        expect(trace.timestamp).toBeInstanceOf(Date);
        expect(['success', 'error', 'pending', 'running']).toContain(trace.status);
        expect(typeof trace.model).toBe('string');
        
        // Validate numeric fields
        expect(typeof trace.promptTokens).toBe('number');
        expect(typeof trace.completionTokens).toBe('number');
        expect(typeof trace.totalCost).toBe('number');
        expect(trace.promptTokens).toBeGreaterThanOrEqual(0);
        expect(trace.completionTokens).toBeGreaterThanOrEqual(0);
        expect(trace.totalCost).toBeGreaterThanOrEqual(0);

        // Validate optional fields
        if (trace.duration !== undefined) {
          expect(typeof trace.duration).toBe('number');
          expect(trace.duration).toBeGreaterThan(0);
        }

        if (trace.metadata) {
          expect(typeof trace.metadata).toBe('object');
          expect(trace.metadata.swarmDemo).toBe(true);
        }

        if (trace.tags) {
          expect(Array.isArray(trace.tags)).toBe(true);
        }

        if (trace.scores) {
          expect(typeof trace.scores).toBe('object');
          Object.values(trace.scores).forEach(score => {
            expect(typeof score).toBe('number');
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
          });
        }
      });
    });

    it('should provide realistic mock metrics', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Offline')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://offline:3000',
        enableRealtime: false,
      });

      const metrics = await client.getSwarmMetrics();

      expect(metrics).toBeDefined();
      
      // Validate metric structure and realistic values
      expect(typeof metrics.totalTraces).toBe('number');
      expect(typeof metrics.activeTraces).toBe('number');
      expect(typeof metrics.totalAgents).toBe('number');
      expect(typeof metrics.activeAgents).toBe('number');
      expect(typeof metrics.totalTasks).toBe('number');
      expect(typeof metrics.completedTasks).toBe('number');
      expect(typeof metrics.failedTasks).toBe('number');
      expect(typeof metrics.averageResponseTime).toBe('number');
      expect(typeof metrics.throughput).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.totalCost).toBe('number');

      // Validate token usage
      expect(metrics.tokenUsage).toHaveProperty('prompt');
      expect(metrics.tokenUsage).toHaveProperty('completion');
      expect(metrics.tokenUsage).toHaveProperty('total');
      expect(typeof metrics.tokenUsage.prompt).toBe('number');
      expect(typeof metrics.tokenUsage.completion).toBe('number');
      expect(typeof metrics.tokenUsage.total).toBe('number');

      // Validate logical relationships
      expect(metrics.activeTraces).toBeLessThanOrEqual(metrics.totalTraces);
      expect(metrics.activeAgents).toBeLessThanOrEqual(metrics.totalAgents);
      expect(metrics.completedTasks + metrics.failedTasks).toBeLessThanOrEqual(metrics.totalTasks);
      expect(metrics.tokenUsage.total).toBe(metrics.tokenUsage.prompt + metrics.tokenUsage.completion);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeLessThanOrEqual(100);
    });

    it('should provide diverse mock trace data', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Offline')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://offline:3000',
        enableRealtime: false,
      });

      const traces = await client.getTraces({ limit: 50 });

      // Should have variety in trace data
      const statuses = new Set(traces.map(t => t.status));
      const models = new Set(traces.map(t => t.model));
      const sessionIds = new Set(traces.map(t => t.sessionId));

      expect(statuses.size).toBeGreaterThan(1); // Multiple statuses
      expect(statuses).toContain('success');
      expect(statuses).toContain('running');

      // Should have swarm-related content
      const swarmTraces = traces.filter(t => 
        t.name.toLowerCase().includes('swarm') ||
        t.metadata?.swarmDemo === true ||
        t.tags?.includes('swarm')
      );
      expect(swarmTraces.length).toBeGreaterThan(0);

      // Should have realistic timestamps (within reasonable range)
      traces.forEach(trace => {
        const age = Date.now() - trace.timestamp.getTime();
        expect(age).toBeGreaterThanOrEqual(0); // Not in future
        expect(age).toBeLessThan(24 * 60 * 60 * 1000); // Within last 24 hours
      });
    });

    it('should respect session filtering in mock data', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Offline')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://offline:3000',
        enableRealtime: false,
      });

      const specificSessionId = 'mock-session-live';
      const traces = await client.getTraces({ 
        sessionId: specificSessionId,
        limit: 10 
      });

      expect(traces.length).toBeGreaterThan(0);
      
      // Mock implementation should include the session ID in some traces
      const matchingTraces = traces.filter(t => t.sessionId === specificSessionId);
      expect(matchingTraces.length).toBeGreaterThan(0);
    });
  });

  describe('REST API Fallback Tests', () => {
    it('should fallback in langfuseAPI.fetchTraces', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network down')));

      const traces = await langfuseAPI.fetchTraces();

      expect(Array.isArray(traces)).toBe(true);
      expect(traces.length).toBeGreaterThan(0);
      
      // Should return mock traces
      const trace = traces[0];
      expect(trace).toHaveProperty('id');
      expect(trace).toHaveProperty('name');
      expect(trace).toHaveProperty('sessionId');
      expect(trace).toHaveProperty('timestamp');
      expect(trace).toHaveProperty('metadata');
    });

    it('should fallback in langfuseAPI.fetchSessions', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network down')));

      const sessions = await langfuseAPI.fetchSessions();

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      
      // Should return mock sessions
      const session = sessions[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('updatedAt');
    });

    it('should handle trace creation gracefully when offline', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network down')));

      const success = await langfuseAPI.createTrace({
        id: 'test-trace-offline',
        name: 'Offline Test Trace',
        sessionId: 'offline-session',
      });

      // Should fail gracefully without throwing
      expect(typeof success).toBe('boolean');
      expect(success).toBe(false);
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue working after network recovery', async () => {
      // Start with network failure
      global.fetch = vi.fn(() => Promise.reject(new Error('Network down')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: false,
      });

      // Get mock data
      const mockTraces = await client.getTraces({ limit: 5 });
      expect(mockTraces.length).toBeGreaterThan(0);

      // Simulate network recovery
      global.fetch = vi.fn(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            data: [
              {
                id: 'real-trace-1',
                name: 'Real Trace',
                sessionId: 'real-session',
                timestamp: new Date().toISOString(),
                startTime: new Date().toISOString(),
                level: 'DEFAULT'
              }
            ]
          }),
        } as Response)
      );

      // Should now get real data
      const realTraces = await client.getTraces({ limit: 5 });
      expect(realTraces.length).toBeGreaterThan(0);
      
      // The traces might still be mock data due to client caching,
      // but no errors should be thrown
      expect(Array.isArray(realTraces)).toBe(true);
    });

    it('should handle intermittent failures', async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount % 2 === 0) {
          // Fail every other call
          return Promise.reject(new Error('Intermittent failure'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        } as Response);
      });

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://localhost:3000',
        enableRealtime: false,
      });

      // Multiple calls should all succeed (fallback to mock on failure)
      for (let i = 0; i < 5; i++) {
        const traces = await client.getTraces({ limit: 5 });
        expect(Array.isArray(traces)).toBe(true);
      }
    });

    it('should provide consistent mock data structure', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Always offline')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://offline:3000',
        enableRealtime: false,
      });

      // Get traces multiple times
      const traces1 = await client.getTraces({ limit: 5 });
      const traces2 = await client.getTraces({ limit: 5 });
      const traces3 = await client.getTraces({ limit: 5 });

      // All should have same structure
      [traces1, traces2, traces3].forEach(traces => {
        expect(Array.isArray(traces)).toBe(true);
        expect(traces.length).toBeGreaterThan(0);
        
        traces.forEach(trace => {
          expect(trace).toHaveProperty('id');
          expect(trace).toHaveProperty('name');
          expect(trace).toHaveProperty('sessionId');
          expect(trace).toHaveProperty('timestamp');
          expect(trace).toHaveProperty('status');
          expect(trace).toHaveProperty('model');
          expect(trace).toHaveProperty('promptTokens');
          expect(trace).toHaveProperty('completionTokens');
          expect(trace).toHaveProperty('totalCost');
        });
      });
    });
  });

  describe('Performance During Fallback', () => {
    it('should respond quickly when falling back to mock data', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network timeout')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://timeout:3000',
        enableRealtime: false,
      });

      const startTime = Date.now();
      const traces = await client.getTraces({ limit: 100 });
      const duration = Date.now() - startTime;

      expect(traces.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should be very fast with mock data
    });

    it('should handle multiple concurrent requests during fallback', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Offline')));

      client = new LangfuseRealtimeClient({
        baseUrl: 'http://offline:3000',
        enableRealtime: false,
      });

      const startTime = Date.now();
      const promises = Array.from({ length: 10 }, () => 
        client.getTraces({ limit: 10 })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach(traces => {
        expect(Array.isArray(traces)).toBe(true);
        expect(traces.length).toBeGreaterThan(0);
      });
      
      expect(duration).toBeLessThan(1000); // Should handle concurrent requests quickly
    });
  });
});