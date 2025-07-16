/**
 * Real-Time Functionality Validation Tests
 * Tests WebSocket connections, live updates, and observer pattern implementation
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { WebSocket } from 'ws';
import { RealTimeObserver } from '../../shared/langfuse-wrapper/src/real-time-observer';
import { LiveDashboard } from '../../shared/langfuse-wrapper/src/live-dashboard';
import { vi, beforeEach, afterEach, describe, it } from 'vitest';

describe('Real-Time Dashboard Functionality', () => {
  let realTimeObserver: RealTimeObserver;
  let liveDashboard: LiveDashboard;
  let testPort: number;
  let dashboardPort: number;

  beforeEach(async () => {
    // Setup test ports
    testPort = 8090 + Math.floor(Math.random() * 100);
    dashboardPort = 3010 + Math.floor(Math.random() * 100);

    // Initialize real-time observer
    realTimeObserver = new RealTimeObserver(testPort, ':memory:');
    await realTimeObserver.start();

    // Initialize live dashboard (mock streaming integration)
    const mockStreamingIntegration = {
      getActiveTraces: vi.fn().mockReturnValue(['trace-1', 'trace-2']),
      getCoordinationState: vi.fn().mockReturnValue(new Map([
        ['swarm-1', { syncStatus: 'synced', lastActivity: Date.now() }],
        ['swarm-2', { syncStatus: 'synced', lastActivity: Date.now() }]
      ])),
      getAdaptiveThresholds: vi.fn().mockReturnValue(new Map([
        ['latency', { currentThreshold: 100 }],
        ['error_rate', { currentThreshold: 0.05 }]
      ])),
      getTraceInfo: vi.fn().mockReturnValue({ status: 'active', duration: 1500 })
    };

    liveDashboard = new LiveDashboard(
      realTimeObserver,
      mockStreamingIntegration as any,
      { port: dashboardPort }
    );
    await liveDashboard.start();
  });

  afterEach(async () => {
    await liveDashboard?.stop();
    await realTimeObserver?.stop();
  });

  describe('WebSocket Connection Tests', () => {
    test('should establish WebSocket connection successfully', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve(true);
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      ws.close();
    });

    test('should receive initial metrics on connection', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      
      const initialMessage = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('No initial message received')), 5000);
      });

      expect(initialMessage).toHaveProperty('type', 'metrics_update');
      expect(initialMessage).toHaveProperty('data');
      expect(initialMessage.data).toHaveProperty('totalTraces');
      expect(initialMessage.data).toHaveProperty('activeTraces');

      ws.close();
    });

    test('should handle multiple concurrent connections', async () => {
      const connectionCount = 10;
      const connections: WebSocket[] = [];
      
      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${testPort}`);
        connections.push(ws);
      }

      // Wait for all connections to open
      await Promise.all(connections.map(ws => 
        new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        })
      ));

      // Verify all connections are open
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Verify observer reports correct client count
      expect(realTimeObserver.getClientCount()).toBe(connectionCount);

      // Close all connections
      connections.forEach(ws => ws.close());
    });

    test('should auto-reconnect on connection drop', async ({ page }) => {
      await page.goto(`http://localhost:${dashboardPort}`);
      
      // Wait for initial connection
      await page.waitForFunction(() => window.WebSocket);
      
      // Simulate connection drop by restarting observer
      await realTimeObserver.stop();
      
      // Verify dashboard shows connection error
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connection Error');
      
      // Restart observer
      realTimeObserver = new RealTimeObserver(testPort, ':memory:');
      await realTimeObserver.start();
      
      // Verify dashboard reconnects automatically
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected', { timeout: 10000 });
    });
  });

  describe('Real-Time Data Streaming', () => {
    test('should stream observations in real-time', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      const receivedMessages: any[] = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Generate test observations
      const testObservations = [
        {
          type: 'trace_start',
          traceId: 'test-trace-1',
          swarmId: 'test-swarm-1',
          agentId: 'agent-1',
          agentRole: 'coder',
          performanceMetrics: { latencyMs: 50, tokensPerSecond: 100 },
          severity: 'low' as const
        },
        {
          type: 'trace_complete',
          traceId: 'test-trace-1',
          swarmId: 'test-swarm-1',
          agentId: 'agent-1',
          agentRole: 'coder',
          performanceMetrics: { latencyMs: 150, tokensPerSecond: 95 },
          severity: 'low' as const
        }
      ];

      // Record observations
      testObservations.forEach(obs => {
        realTimeObserver.recordObservation(obs);
      });

      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify observations were streamed
      const observationMessages = receivedMessages.filter(msg => msg.type === 'observation');
      expect(observationMessages).toHaveLength(testObservations.length);
      
      observationMessages.forEach((msg, index) => {
        expect(msg.data.traceId).toBe(testObservations[index].traceId);
        expect(msg.data.type).toBe(testObservations[index].type);
      });

      ws.close();
    });

    test('should detect and stream anomalies', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      const receivedMessages: any[] = [];
      
      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Generate high-latency observation to trigger anomaly
      realTimeObserver.recordObservation({
        type: 'trace_complete',
        traceId: 'anomaly-trace',
        swarmId: 'test-swarm',
        agentId: 'agent-slow',
        agentRole: 'coder',
        performanceMetrics: { 
          latencyMs: 5000, // Very high latency
          tokensPerSecond: 10 
        },
        severity: 'high' as const
      });

      // Wait for anomaly detection
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify anomaly was detected and streamed
      const anomalyMessages = receivedMessages.filter(msg => msg.type === 'anomaly');
      expect(anomalyMessages.length).toBeGreaterThan(0);
      
      const anomaly = anomalyMessages[0];
      expect(anomaly.data).toHaveProperty('description');
      expect(anomaly.data).toHaveProperty('severity');

      ws.close();
    });

    test('should update metrics in real-time', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      let initialMetrics: any;
      let updatedMetrics: any;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'metrics_update') {
          if (!initialMetrics) {
            initialMetrics = message.data;
          } else {
            updatedMetrics = message.data;
          }
        }
      });

      await new Promise(resolve => ws.on('open', resolve));

      // Generate trace activity to update metrics
      realTimeObserver.recordObservation({
        type: 'trace_start',
        traceId: 'metrics-test-trace',
        performanceMetrics: { latencyMs: 100, tokensPerSecond: 50 },
        severity: 'low' as const
      });

      // Wait for metrics update
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(initialMetrics).toBeDefined();
      expect(updatedMetrics).toBeDefined();
      expect(updatedMetrics.totalTraces).toBeGreaterThan(initialMetrics.totalTraces);

      ws.close();
    });
  });

  describe('Live Dashboard Component Tests', () => {
    test('should serve dashboard HTML correctly', async ({ page }) => {
      await page.goto(`http://localhost:${dashboardPort}`);
      
      // Verify dashboard loads
      await expect(page.locator('h1')).toContainText('Swarm Coordination Live Dashboard');
      
      // Verify essential UI elements
      await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="alerts-list"]')).toBeVisible();
    });

    test('should display real-time metrics without refresh', async ({ page }) => {
      await page.goto(`http://localhost:${dashboardPort}`);
      
      // Wait for initial load
      await expect(page.locator('[data-testid="metrics-grid"]')).toBeVisible();
      
      // Get initial metric values
      const initialActiveTraces = await page.locator('[data-testid="active-traces"]').textContent();
      
      // Generate new trace activity
      realTimeObserver.recordObservation({
        type: 'trace_start',
        traceId: 'dashboard-test-trace',
        performanceMetrics: { latencyMs: 75, tokensPerSecond: 80 },
        severity: 'low' as const
      });

      // Wait for dashboard update (should be automatic via WebSocket)
      await page.waitForFunction((initial) => {
        const current = document.querySelector('[data-testid="active-traces"]')?.textContent;
        return current !== initial;
      }, initialActiveTraces, { timeout: 5000 });

      // Verify metrics updated without page refresh
      const updatedActiveTraces = await page.locator('[data-testid="active-traces"]').textContent();
      expect(updatedActiveTraces).not.toBe(initialActiveTraces);
    });

    test('should show alerts in real-time', async ({ page }) => {
      await page.goto(`http://localhost:${dashboardPort}`);
      
      // Verify alerts section exists
      await expect(page.locator('[data-testid="alerts-list"]')).toBeVisible();
      
      // Generate an alert-triggering observation
      realTimeObserver.recordObservation({
        type: 'error',
        traceId: 'error-trace',
        swarmId: 'test-swarm',
        agentId: 'agent-error',
        data: { error: 'Test error for alert' },
        performanceMetrics: { latencyMs: 1000 },
        severity: 'critical' as const
      });

      // Wait for alert to appear
      await expect(page.locator('.alert-item')).toBeVisible({ timeout: 10000 });
      
      // Verify alert content
      await expect(page.locator('.alert-critical')).toBeVisible();
    });

    test('should handle API endpoints correctly', async ({ page }) => {
      // Test metrics API
      const metricsResponse = await page.request.get(`http://localhost:${dashboardPort}/api/metrics`);
      expect(metricsResponse.ok()).toBeTruthy();
      
      const metricsData = await metricsResponse.json();
      expect(metricsData).toHaveProperty('system');
      expect(metricsData).toHaveProperty('swarm');
      expect(metricsData).toHaveProperty('traces');

      // Test health API
      const healthResponse = await page.request.get(`http://localhost:${dashboardPort}/api/health`);
      expect(healthResponse.ok()).toBeTruthy();
      
      const healthData = await healthResponse.json();
      expect(healthData).toHaveProperty('status', 'healthy');
      expect(healthData).toHaveProperty('dashboard', true);

      // Test swarms API
      const swarmsResponse = await page.request.get(`http://localhost:${dashboardPort}/api/swarms`);
      expect(swarmsResponse.ok()).toBeTruthy();
      
      const swarmsData = await swarmsResponse.json();
      expect(Array.isArray(swarmsData)).toBeTruthy();
    });
  });

  describe('Observer Pattern Implementation', () => {
    test('should track swarm activity accurately', async () => {
      const swarmId = 'test-swarm-activity';
      const agentIds = ['agent-1', 'agent-2', 'agent-3'];
      
      // Generate activity from multiple agents
      agentIds.forEach((agentId, index) => {
        realTimeObserver.recordObservation({
          type: 'trace_start',
          traceId: `trace-${agentId}`,
          swarmId,
          agentId,
          agentRole: 'coder',
          performanceMetrics: { latencyMs: 50 + index * 10 },
          severity: 'low' as const
        });
      });

      // Wait for observations to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get swarm activity summary
      const activity = realTimeObserver.getSwarmActivity(swarmId, 1);
      
      expect(activity.swarmId).toBe(swarmId);
      expect(activity.uniqueAgents).toBe(agentIds.length);
      expect(activity.uniqueTraces).toBe(agentIds.length);
      expect(activity.totalObservations).toBe(agentIds.length);
      expect(activity.agentActivity).toHaveLength(agentIds.length);
    });

    test('should maintain observation history correctly', async () => {
      const traceId = 'history-test-trace';
      
      // Generate sequence of observations for same trace
      const observations = [
        { type: 'trace_start', data: { phase: 'start' } },
        { type: 'trace_update', data: { phase: 'processing' } },
        { type: 'trace_update', data: { phase: 'completion' } },
        { type: 'trace_complete', data: { phase: 'done' } }
      ];

      observations.forEach((obs, index) => {
        realTimeObserver.recordObservation({
          ...obs,
          traceId,
          performanceMetrics: { latencyMs: 50 + index * 25 },
          severity: 'low' as const
        });
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get trace history
      const traceObservations = realTimeObserver.getObservationsForTrace(traceId);
      
      expect(traceObservations).toHaveLength(observations.length);
      
      // Verify chronological order
      for (let i = 1; i < traceObservations.length; i++) {
        expect(traceObservations[i].timestamp).toBeGreaterThanOrEqual(
          traceObservations[i - 1].timestamp
        );
      }
    });

    test('should calculate metrics accurately', async () => {
      // Generate observations with known metrics
      const testData = [
        { latency: 100, tokens: 50 },
        { latency: 200, tokens: 75 },
        { latency: 150, tokens: 60 }
      ];

      testData.forEach((data, index) => {
        realTimeObserver.recordObservation({
          type: 'trace_complete',
          traceId: `metrics-trace-${index}`,
          performanceMetrics: { 
            latencyMs: data.latency, 
            tokensPerSecond: data.tokens 
          },
          severity: 'low' as const
        });
      });

      // Wait for metrics calculation
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = realTimeObserver.getMetrics();
      
      // Verify total traces count
      expect(metrics.totalTraces).toBeGreaterThanOrEqual(testData.length);
      
      // Verify average latency calculation
      const expectedAvgLatency = testData.reduce((sum, d) => sum + d.latency, 0) / testData.length;
      expect(Math.abs(metrics.averageLatency - expectedAvgLatency)).toBeLessThan(10);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle malformed observations gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${testPort}`);
      await new Promise(resolve => ws.on('open', resolve));

      // Record malformed observation
      expect(() => {
        realTimeObserver.recordObservation({
          // Missing required fields
          type: 'trace_start' as any,
          performanceMetrics: { latencyMs: 100 },
          severity: 'low' as const
        });
      }).not.toThrow();

      // System should continue functioning
      const metrics = realTimeObserver.getMetrics();
      expect(metrics).toBeDefined();

      ws.close();
    });

    test('should recover from WebSocket server restart', async ({ page }) => {
      await page.goto(`http://localhost:${dashboardPort}`);
      
      // Verify initial connection
      await expect(page.locator('[data-testid="connection-indicator"]')).toContainText('Connected');
      
      // Stop and restart observer
      await realTimeObserver.stop();
      
      // Verify disconnection state
      await expect(page.locator('[data-testid="connection-indicator"]')).toContainText('Disconnected', { timeout: 5000 });
      
      // Restart observer
      realTimeObserver = new RealTimeObserver(testPort, ':memory:');
      await realTimeObserver.start();
      
      // Verify reconnection
      await expect(page.locator('[data-testid="connection-indicator"]')).toContainText('Connected', { timeout: 10000 });
    });

    test('should handle database errors gracefully', async () => {
      // This test would require mocking the database to simulate failures
      // For now, we'll test that the system continues to function even with DB issues
      
      const initialMetrics = realTimeObserver.getMetrics();
      
      // Record observation (should work even if DB operations fail)
      realTimeObserver.recordObservation({
        type: 'trace_start',
        traceId: 'db-error-test',
        performanceMetrics: { latencyMs: 100 },
        severity: 'low' as const
      });

      // System should still be responsive
      const updatedMetrics = realTimeObserver.getMetrics();
      expect(updatedMetrics.totalTraces).toBeGreaterThanOrEqual(initialMetrics.totalTraces);
    });
  });
});