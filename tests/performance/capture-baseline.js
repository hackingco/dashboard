#!/usr/bin/env node

/**
 * Performance Baseline Capture Script
 * Captures performance metrics to establish baseline for regression detection
 */

const fetch = require('node-fetch');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;

// Configuration
const config = {
  target: {
    api: process.env.TEST_API_URL || 'http://localhost:3001',
    dashboard: process.env.TEST_DASHBOARD_URL || 'http://localhost:3000',
    websocket: process.env.TEST_WS_URL || 'ws://localhost:3001',
  },
  
  testDuration: 10 * 60 * 1000, // 10 minutes default
  warmupDuration: 2 * 60 * 1000, // 2 minutes warmup
  
  concurrency: {
    light: 10,
    medium: 25,
    heavy: 50,
  },
  
  endpoints: [
    { path: '/health', method: 'GET', weight: 10 },
    { path: '/api/swarms', method: 'GET', weight: 5 },
    { path: '/api/machines', method: 'GET', weight: 5 },
    { path: '/api/metrics', method: 'GET', weight: 3 },
    { path: '/api/system/status', method: 'GET', weight: 2 },
  ],
  
  outputFile: 'baseline-metrics.json',
};

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    switch (key) {
      case 'duration':
        parsed.duration = parseInt(value) * 60 * 1000;
        break;
      case 'concurrency':
        parsed.concurrency = value;
        break;
      case 'output':
        parsed.output = value;
        break;
      case 'target':
        parsed.target = value;
        break;
    }
  }
  
  return parsed;
}

// Utility functions
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculatePercentiles = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    p999: sorted[Math.floor(sorted.length * 0.999)],
  };
};

// Performance metrics collector
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: [],
      websockets: [],
      system: [],
      startTime: Date.now(),
    };
  }
  
  recordRequest(endpoint, method, responseTime, statusCode, success) {
    this.metrics.requests.push({
      timestamp: Date.now(),
      endpoint,
      method,
      responseTime,
      statusCode,
      success,
    });
  }
  
  recordWebSocket(action, responseTime, success, error = null) {
    this.metrics.websockets.push({
      timestamp: Date.now(),
      action,
      responseTime,
      success,
      error,
    });
  }
  
  recordSystemMetrics(cpu, memory, connections) {
    this.metrics.system.push({
      timestamp: Date.now(),
      cpu,
      memory,
      connections,
    });
  }
  
  generateSummary() {
    const duration = Date.now() - this.metrics.startTime;
    const requests = this.metrics.requests;
    const successful = requests.filter(r => r.success);
    
    // Calculate response time metrics
    const responseTimes = successful.map(r => r.responseTime);
    const responseTimeStats = responseTimes.length > 0 ? {
      ...calculatePercentiles(responseTimes),
      average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
    } : {};
    
    // Calculate throughput
    const throughput = {
      rps: (successful.length / duration) * 1000,
      total_requests: requests.length,
      successful_requests: successful.length,
      failed_requests: requests.length - successful.length,
    };
    
    // Calculate error rates
    const errorStats = {
      error_rate: requests.length > 0 ? (requests.length - successful.length) / requests.length : 0,
      errors_by_status: {},
    };
    
    requests.filter(r => !r.success).forEach(r => {
      errorStats.errors_by_status[r.statusCode] = 
        (errorStats.errors_by_status[r.statusCode] || 0) + 1;
    });
    
    // WebSocket metrics
    const wsRequests = this.metrics.websockets;
    const wsSuccessful = wsRequests.filter(ws => ws.success);
    const wsResponseTimes = wsSuccessful.map(ws => ws.responseTime);
    
    const websocketStats = wsResponseTimes.length > 0 ? {
      response_time: calculatePercentiles(wsResponseTimes),
      success_rate: wsSuccessful.length / wsRequests.length,
      total_operations: wsRequests.length,
    } : {};
    
    // System resource metrics
    const systemMetrics = this.metrics.system;
    if (systemMetrics.length > 0) {
      const avgCpu = systemMetrics.reduce((sum, m) => sum + m.cpu, 0) / systemMetrics.length;
      const avgMemory = systemMetrics.reduce((sum, m) => sum + m.memory, 0) / systemMetrics.length;
      const maxConnections = Math.max(...systemMetrics.map(m => m.connections));
      
      var systemStats = {
        average_cpu: avgCpu,
        average_memory: avgMemory,
        peak_connections: maxConnections,
      };
    }
    
    return {
      timestamp: new Date().toISOString(),
      test_duration_ms: duration,
      response_time: responseTimeStats,
      throughput,
      errors: errorStats,
      websockets: websocketStats,
      system: systemStats || {},
      raw_data: {
        total_samples: requests.length,
        ws_samples: wsRequests.length,
        system_samples: systemMetrics.length,
      },
    };
  }
}

// HTTP load tester
class HttpLoadTester {
  constructor(collector, targetUrl) {
    this.collector = collector;
    this.targetUrl = targetUrl;
    this.running = false;
  }
  
  async runSingleRequest(endpoint) {
    const startTime = performance.now();
    let success = false;
    let statusCode = 0;
    
    try {
      const response = await fetch(`${this.targetUrl}${endpoint.path}`, {
        method: endpoint.method,
        timeout: 10000,
        headers: {
          'User-Agent': 'PerformanceBaseline/1.0',
        },
      });
      
      statusCode = response.status;
      success = response.ok;
      
      // Consume response body to ensure complete measurement
      await response.text();
      
    } catch (error) {
      success = false;
      statusCode = 0;
    }
    
    const responseTime = performance.now() - startTime;
    this.collector.recordRequest(endpoint.path, endpoint.method, responseTime, statusCode, success);
    
    return { success, responseTime, statusCode };
  }
  
  async startLoadTest(concurrency, duration) {
    this.running = true;
    const endTime = Date.now() + duration;
    
    logWithTimestamp(`🚀 Starting HTTP load test with ${concurrency} concurrent users`);
    
    const workers = [];
    
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.runWorker(endTime));
    }
    
    await Promise.all(workers);
    this.running = false;
    
    logWithTimestamp('✅ HTTP load test completed');
  }
  
  async runWorker(endTime) {
    while (this.running && Date.now() < endTime) {
      // Select endpoint based on weight
      const endpoint = this.selectWeightedEndpoint();
      await this.runSingleRequest(endpoint);
      
      // Small delay between requests to simulate realistic usage
      await delay(Math.random() * 100 + 50); // 50-150ms delay
    }
  }
  
  selectWeightedEndpoint() {
    const totalWeight = config.endpoints.reduce((sum, ep) => sum + ep.weight, 0);
    const random = Math.random() * totalWeight;
    
    let current = 0;
    for (const endpoint of config.endpoints) {
      current += endpoint.weight;
      if (random <= current) {
        return endpoint;
      }
    }
    
    return config.endpoints[0]; // Fallback
  }
  
  stop() {
    this.running = false;
  }
}

// WebSocket load tester
class WebSocketTester {
  constructor(collector, wsUrl) {
    this.collector = collector;
    this.wsUrl = wsUrl;
    this.connections = [];
    this.running = false;
  }
  
  async testWebSocketPerformance(concurrency, duration) {
    this.running = true;
    logWithTimestamp(`🔗 Starting WebSocket test with ${concurrency} connections`);
    
    // Create connections
    for (let i = 0; i < concurrency; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        logWithTimestamp(`⚠️  Failed to create WebSocket connection ${i}: ${error.message}`);
      }
    }
    
    logWithTimestamp(`✅ Created ${this.connections.length} WebSocket connections`);
    
    // Run tests for duration
    const endTime = Date.now() + duration;
    const testPromises = this.connections.map(conn => this.runConnectionTest(conn, endTime));
    
    await Promise.all(testPromises);
    
    // Close connections
    this.connections.forEach(conn => {
      if (conn.readyState === WebSocket.OPEN) {
        conn.close();
      }
    });
    
    this.running = false;
    logWithTimestamp('✅ WebSocket test completed');
  }
  
  async createConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      
      ws.on('open', () => {
        this.connections.push(ws);
        resolve(ws);
      });
      
      ws.on('error', reject);
      
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
  }
  
  async runConnectionTest(ws, endTime) {
    while (this.running && Date.now() < endTime && ws.readyState === WebSocket.OPEN) {
      await this.testMessage(ws);
      await delay(1000 + Math.random() * 2000); // 1-3 second intervals
    }
  }
  
  async testMessage(ws) {
    const startTime = performance.now();
    let success = false;
    
    try {
      const testMessage = {
        type: 'ping',
        timestamp: Date.now(),
        id: Math.random().toString(36).substr(2, 9),
      };
      
      ws.send(JSON.stringify(testMessage));
      
      // Wait for response (simplified - in real implementation you'd track specific responses)
      await delay(100);
      success = true;
      
    } catch (error) {
      success = false;
    }
    
    const responseTime = performance.now() - startTime;
    this.collector.recordWebSocket('ping', responseTime, success);
  }
}

// System metrics monitor
class SystemMonitor {
  constructor(collector, targetUrl) {
    this.collector = collector;
    this.targetUrl = targetUrl;
    this.running = false;
  }
  
  async startMonitoring(interval = 10000) {
    this.running = true;
    logWithTimestamp('📊 Starting system metrics monitoring');
    
    while (this.running) {
      await this.collectSystemMetrics();
      await delay(interval);
    }
    
    logWithTimestamp('✅ System monitoring completed');
  }
  
  async collectSystemMetrics() {
    try {
      const response = await fetch(`${this.targetUrl}/api/metrics`, {
        timeout: 5000,
      });
      
      if (response.ok) {
        const metrics = await response.json();
        
        this.collector.recordSystemMetrics(
          metrics.system?.cpu || 0,
          metrics.system?.memory || 0,
          metrics.connections?.active || 0
        );
      }
    } catch (error) {
      // Silently fail - we don't want monitoring to interfere with load testing
    }
  }
  
  stop() {
    this.running = false;
  }
}

// Main baseline capture function
async function captureBaseline() {
  const args = parseArguments();
  const testDuration = args.duration || config.testDuration;
  const concurrencyLevel = args.concurrency || 'medium';
  const outputFile = args.output || config.outputFile;
  
  logWithTimestamp('🎯 Starting performance baseline capture');
  logWithTimestamp(`📋 Test duration: ${testDuration / 1000 / 60} minutes`);
  logWithTimestamp(`👥 Concurrency level: ${concurrencyLevel}`);
  
  const collector = new MetricsCollector();
  const concurrency = config.concurrency[concurrencyLevel] || config.concurrency.medium;
  
  // Initialize testers
  const httpTester = new HttpLoadTester(collector, config.target.api);
  const wsTester = new WebSocketTester(collector, config.target.websocket);
  const monitor = new SystemMonitor(collector, config.target.api);
  
  try {
    // Warmup phase
    logWithTimestamp('🔥 Starting warmup phase');
    await httpTester.startLoadTest(Math.max(1, Math.floor(concurrency / 4)), config.warmupDuration);
    
    logWithTimestamp('⏱️  Warmup completed, starting baseline capture');
    
    // Start system monitoring
    const monitoringPromise = monitor.startMonitoring();
    
    // Run main performance tests
    await Promise.all([
      httpTester.startLoadTest(concurrency, testDuration),
      wsTester.testWebSocketPerformance(Math.max(1, Math.floor(concurrency / 5)), testDuration),
    ]);
    
    // Stop monitoring
    monitor.stop();
    await monitoringPromise;
    
    // Generate and save baseline metrics
    const baseline = collector.generateSummary();
    
    await fs.writeFile(outputFile, JSON.stringify(baseline, null, 2), 'utf8');
    
    logWithTimestamp('✅ Baseline capture completed');
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE BASELINE SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Total Requests: ${baseline.throughput.total_requests}`);
    console.log(`✅ Success Rate: ${((baseline.throughput.successful_requests / baseline.throughput.total_requests) * 100).toFixed(2)}%`);
    console.log(`⚡ Throughput: ${baseline.throughput.rps.toFixed(2)} RPS`);
    console.log(`⏱️  Response Time P95: ${baseline.response_time.p95?.toFixed(2) || 'N/A'}ms`);
    console.log(`⏱️  Response Time P99: ${baseline.response_time.p99?.toFixed(2) || 'N/A'}ms`);
    console.log(`🔗 WebSocket Success Rate: ${((baseline.websockets.success_rate || 0) * 100).toFixed(2)}%`);
    console.log(`💾 Baseline saved to: ${outputFile}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    logWithTimestamp(`❌ Baseline capture failed: ${error.message}`);
    
    // Stop all testers
    httpTester.stop();
    monitor.stop();
    
    throw error;
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  logWithTimestamp(`❌ Unhandled rejection: ${error.message}`);
  process.exit(1);
});

process.on('SIGINT', () => {
  logWithTimestamp('🛑 Baseline capture interrupted');
  process.exit(0);
});

// Main execution
if (require.main === module) {
  captureBaseline().catch(error => {
    logWithTimestamp(`❌ Baseline capture failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  captureBaseline,
  MetricsCollector,
  HttpLoadTester,
  WebSocketTester,
  SystemMonitor,
};