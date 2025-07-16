/**
 * Integration tests for Enhanced Live Dashboard
 */

import { EnhancedLiveDashboard } from '../../src/dashboard/enhanced-live-dashboard';
import { RealTimeObserver } from '../../src/real-time-observer';
import { StreamingTraceIntegration } from '../../src/streaming-trace-integration';
import { WebSocket } from 'ws';
import * as http from 'http';

describe('Enhanced Live Dashboard Integration Tests', () => {
  let dashboard: EnhancedLiveDashboard;
  let realTimeObserver: RealTimeObserver;
  let streamingIntegration: StreamingTraceIntegration;
  let wsClient: WebSocket;

  beforeAll(async () => {
    // Initialize dependencies
    realTimeObserver = new RealTimeObserver(8081);
    streamingIntegration = new StreamingTraceIntegration();
    
    // Start real-time observer
    await realTimeObserver.start();
  });

  afterAll(async () => {
    // Clean up
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (dashboard) {
      await dashboard.stop();
    }
    if (realTimeObserver) {
      await realTimeObserver.stop();
    }
  });

  beforeEach(() => {
    // Create fresh dashboard instance
    dashboard = new EnhancedLiveDashboard(
      realTimeObserver,
      streamingIntegration,
      {
        port: 3003,
        wsPort: 3004,
        refreshIntervalMs: 100,
        enableWebSocket: true,
        enableCharts: true,
        enableAlerts: true,
        alertThresholds: {
          errorRate: 0.1,
          latency: 500,
          memoryUsage: 80,
          cpuUsage: 80,
          tokenThroughput: 10
        }
      }
    );
  });

  afterEach(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (dashboard && dashboard.isRunning()) {
      await dashboard.stop();
    }
  });

  describe('Dashboard Lifecycle', () => {
    test('should start successfully', async () => {
      const startPromise = new Promise<void>((resolve) => {
        dashboard.once('started', resolve);
      });

      await dashboard.start();
      await startPromise;

      expect(dashboard.isRunning()).toBe(true);
    });

    test('should stop gracefully', async () => {
      await dashboard.start();
      
      const stopPromise = new Promise<void>((resolve) => {
        dashboard.once('stopped', resolve);
      });

      await dashboard.stop();
      await stopPromise;

      expect(dashboard.isRunning()).toBe(false);
    });

    test('should handle multiple start attempts', async () => {
      await dashboard.start();
      await dashboard.start(); // Should not throw

      expect(dashboard.isRunning()).toBe(true);
    });
  });

  describe('HTTP API', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should serve dashboard HTML', async () => {
      const response = await fetch('http://localhost:3003/');
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html');
      expect(html).toContain('Swarm Coordination Dashboard');
      expect(html).toContain('Chart.js');
    });

    test('should return current metrics', async () => {
      const response = await fetch('http://localhost:3003/api/metrics/current');
      const metrics = await response.json();

      expect(response.status).toBe(200);
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('swarm');
      expect(metrics).toHaveProperty('traces');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('charts');
    });

    test('should return metrics history', async () => {
      // Wait for some metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 300));

      const response = await fetch('http://localhost:3003/api/metrics/history');
      const history = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    test('should return alerts', async () => {
      const response = await fetch('http://localhost:3003/api/alerts');
      const alerts = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(alerts)).toBe(true);
    });

    test('should return health status', async () => {
      const response = await fetch('http://localhost:3003/api/health');
      const health = await response.json();

      expect(response.status).toBe(200);
      expect(health.status).toBe('healthy');
      expect(health.dashboard).toBe(true);
      expect(health.websocket).toBe(true);
    });

    test('should export metrics', async () => {
      const response = await fetch('http://localhost:3003/api/export');
      const exportData = await response.json();

      expect(response.status).toBe(200);
      expect(exportData).toHaveProperty('metrics');
      expect(exportData).toHaveProperty('alerts');
      expect(exportData).toHaveProperty('config');
      expect(exportData).toHaveProperty('timestamp');
    });

    test('should return WebSocket configuration', async () => {
      const response = await fetch('http://localhost:3003/api/ws-config');
      const wsConfig = await response.json();

      expect(response.status).toBe(200);
      expect(wsConfig.enabled).toBe(true);
      expect(wsConfig.port).toBe(3004);
      expect(wsConfig.url).toBe('ws://localhost:3004');
    });

    test('should handle 404 routes', async () => {
      const response = await fetch('http://localhost:3003/api/unknown');
      const error = await response.json();

      expect(response.status).toBe(404);
      expect(error.error).toBe('Not found');
    });
  });

  describe('WebSocket Communication', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should accept WebSocket connections', async () => {
      const connected = await new Promise<boolean>((resolve) => {
        wsClient = new WebSocket('ws://localhost:3004');
        wsClient.on('open', () => resolve(true));
        wsClient.on('error', () => resolve(false));
      });

      expect(connected).toBe(true);
    });

    test('should send welcome message', async () => {
      const welcomeMessage = await new Promise<any>((resolve) => {
        wsClient = new WebSocket('ws://localhost:3004');
        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'welcome') {
            resolve(message);
          }
        });
      });

      expect(welcomeMessage.type).toBe('welcome');
      expect(welcomeMessage.data).toHaveProperty('clientId');
      expect(welcomeMessage.data.features).toHaveProperty('compression');
      expect(welcomeMessage.data.subscriptions).toContain('default');
    });

    test('should handle ping/pong', async () => {
      wsClient = new WebSocket('ws://localhost:3004');
      await new Promise(resolve => wsClient.on('open', resolve));

      const pongMessage = await new Promise<any>((resolve) => {
        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            resolve(message);
          }
        });

        wsClient.send(JSON.stringify({
          type: 'ping',
          id: 'test-ping'
        }));
      });

      expect(pongMessage.type).toBe('pong');
      expect(pongMessage.id).toBe('test-ping');
    });

    test('should handle subscriptions', async () => {
      wsClient = new WebSocket('ws://localhost:3004');
      await new Promise(resolve => wsClient.on('open', resolve));

      const subscriptionResponse = await new Promise<any>((resolve) => {
        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscribed') {
            resolve(message);
          }
        });

        wsClient.send(JSON.stringify({
          type: 'subscribe',
          id: 'test-sub',
          data: { channels: ['metrics', 'alerts'] }
        }));
      });

      expect(subscriptionResponse.type).toBe('subscribed');
      expect(subscriptionResponse.data.channels).toContain('metrics');
      expect(subscriptionResponse.data.channels).toContain('alerts');
    });

    test('should broadcast metrics updates', async () => {
      wsClient = new WebSocket('ws://localhost:3004');
      await new Promise(resolve => wsClient.on('open', resolve));

      const metricsUpdate = await new Promise<any>((resolve) => {
        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'metrics_update') {
            resolve(message);
          }
        });
      });

      expect(metricsUpdate.type).toBe('metrics_update');
      expect(metricsUpdate.data).toBeDefined();
    });

    test('should handle configuration updates', async () => {
      wsClient = new WebSocket('ws://localhost:3004');
      await new Promise(resolve => wsClient.on('open', resolve));

      const configResponse = await new Promise<any>((resolve) => {
        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'configured') {
            resolve(message);
          }
        });

        wsClient.send(JSON.stringify({
          type: 'configure',
          id: 'test-config',
          data: {
            compression: true,
            features: { supportsCharts: true }
          }
        }));
      });

      expect(configResponse.type).toBe('configured');
      expect(configResponse.data.compression).toBe(true);
      expect(configResponse.data.features.supportsCharts).toBe(true);
    });

    test('should enforce rate limiting', async () => {
      wsClient = new WebSocket('ws://localhost:3004');
      await new Promise(resolve => wsClient.on('open', resolve));

      const errors: any[] = [];
      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          errors.push(message);
        }
      });

      // Send many messages quickly
      for (let i = 0; i < 1000; i++) {
        wsClient.send(JSON.stringify({
          type: 'ping',
          id: `spam-${i}`
        }));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(errors.some(e => e.error.message === 'Rate limit exceeded')).toBe(true);
    });
  });

  describe('Alert System', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should create alerts on threshold breach', async () => {
      const alertPromise = new Promise<any>((resolve) => {
        dashboard.once('alert_created', resolve);
      });

      // Trigger high error rate
      for (let i = 0; i < 10; i++) {
        realTimeObserver.recordObservation({
          id: `error-${i}`,
          timestamp: Date.now(),
          type: 'error',
          traceId: `trace-${i}`,
          data: { error: 'Test error' },
          performanceMetrics: { latencyMs: 100 },
          severity: 'high'
        });
      }

      const alert = await alertPromise;

      expect(alert.severity).toBe('critical');
      expect(alert.category).toBe('error');
      expect(alert.message).toContain('Error rate exceeded threshold');
    });

    test('should handle alert actions', async () => {
      // Create an alert
      const alert = dashboard.alertManager.createAlert(
        'warning',
        'performance',
        'Test alert',
        { test: true }
      );

      // Acknowledge alert
      const acknowledged = dashboard.alertManager.acknowledgeAlert(alert.id);
      expect(acknowledged).toBe(true);

      const updatedAlert = dashboard.alertManager.getAllAlerts()
        .find(a => a.id === alert.id);
      expect(updatedAlert?.acknowledged).toBe(true);
    });

    test('should resolve alerts', async () => {
      // Create an alert
      const alert = dashboard.alertManager.createAlert(
        'info',
        'system',
        'Test alert',
        { test: true }
      );

      // Resolve alert
      const resolved = dashboard.resolveAlert(alert.id);
      expect(resolved).toBe(true);

      const alerts = dashboard.getAlerts();
      const resolvedAlert = alerts.find(a => a.id === alert.id);
      expect(resolvedAlert?.resolved).toBe(true);
    });

    test('should auto-resolve info alerts', async () => {
      const alert = dashboard.alertManager.createAlert(
        'info',
        'system',
        'Auto-resolve test',
        { test: true },
        undefined,
        { autoResolveTimeout: 100 }
      );

      await new Promise(resolve => setTimeout(resolve, 150));

      const alerts = dashboard.getAlerts();
      const autoResolved = alerts.find(a => a.id === alert.id);
      expect(autoResolved?.resolved).toBe(true);
    });
  });

  describe('Metrics Aggregation', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should aggregate metrics over time', async () => {
      // Record some metrics
      for (let i = 0; i < 10; i++) {
        dashboard.metricsAggregator.addMetric('test.latency', 100 + i * 10);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const aggregated = dashboard.metricsAggregator.getAggregatedMetric('test.latency');
      
      expect(aggregated).not.toBeNull();
      expect(aggregated!.current).toBe(190); // Last value
      expect(aggregated!.windows['1m'].samples).toBe(10);
      expect(aggregated!.windows['1m'].avg).toBeCloseTo(145, 0);
      expect(aggregated!.windows['1m'].min).toBe(100);
      expect(aggregated!.windows['1m'].max).toBe(190);
    });

    test('should detect anomalies', async () => {
      // Add normal values
      for (let i = 0; i < 20; i++) {
        dashboard.metricsAggregator.addMetric('test.cpu', 40 + Math.random() * 10);
      }

      // Add anomalous values
      dashboard.metricsAggregator.addMetric('test.cpu', 95);
      dashboard.metricsAggregator.addMetric('test.cpu', 98);

      const anomalies = dashboard.metricsAggregator.getAnomalies('test.cpu', 2);
      
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.value > 90)).toBe(true);
    });

    test('should calculate metric correlations', () => {
      // Add correlated metrics
      for (let i = 0; i < 20; i++) {
        const base = 50 + i * 2;
        dashboard.metricsAggregator.addMetric('metric.a', base);
        dashboard.metricsAggregator.addMetric('metric.b', base * 1.5 + Math.random() * 5);
      }

      const correlation = dashboard.metricsAggregator.getCorrelation('metric.a', 'metric.b');
      
      expect(correlation).toBeGreaterThan(0.8); // Strong positive correlation
    });
  });

  describe('Chart Data Generation', () => {
    beforeEach(async () => {
      await dashboard.start();
    });

    test('should generate performance trend data', async () => {
      // Wait for some metrics
      await new Promise(resolve => setTimeout(resolve, 300));

      const history = dashboard.getMetricsHistory();
      const chartData = dashboard.chartDataProvider.generateChartData(history, history[history.length - 1]);

      expect(chartData.performanceTrend).toBeDefined();
      expect(chartData.performanceTrend.length).toBeGreaterThan(0);
      expect(chartData.performanceTrend[0]).toHaveProperty('timestamp');
      expect(chartData.performanceTrend[0]).toHaveProperty('value');
    });

    test('should generate Chart.js configurations', () => {
      const perfData = [
        { timestamp: Date.now() - 5000, value: 80, label: 'Efficiency' },
        { timestamp: Date.now(), value: 85, label: 'Efficiency' }
      ];

      const config = dashboard.chartDataProvider.getPerformanceChartConfig(perfData);

      expect(config.type).toBe('line');
      expect(config.data.datasets[0].label).toBe('Performance Efficiency');
      expect(config.data.datasets[0].data).toHaveLength(2);
      expect(config.options.responsive).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle observer connection errors', async () => {
      const badObserver = new RealTimeObserver(9999);
      const badDashboard = new EnhancedLiveDashboard(
        badObserver,
        streamingIntegration,
        { port: 3005, wsPort: 3006 }
      );

      await badDashboard.start();
      
      // Should start even if observer has issues
      expect(badDashboard.isRunning()).toBe(true);

      await badDashboard.stop();
    });

    test('should handle WebSocket client disconnection', async () => {
      await dashboard.start();

      wsClient = new WebSocket('ws://localhost:3004');
      await new Promise(resolve => wsClient.on('open', resolve));

      const initialCount = dashboard.wsHandler.getClientCount();
      expect(initialCount).toBe(1);

      wsClient.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalCount = dashboard.wsHandler.getClientCount();
      expect(finalCount).toBe(0);
    });
  });
});

// Helper function for fetch (if not available in test environment)
function fetch(url: string, options?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options?.method || 'GET',
      headers: options?.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: {
            get: (name: string) => res.headers[name.toLowerCase()]
          },
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}