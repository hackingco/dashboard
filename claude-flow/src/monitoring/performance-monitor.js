import { EventEmitter } from 'events';
import os from 'os';
import { trace } from '../instrumentation/index.js';

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      cpu: 0,
      memory: 0,
      activeRequests: 0,
      requestsPerSecond: 0,
      avgResponseTime: 0,
      errorRate: 0
    };
    this.requestHistory = [];
    this.errorHistory = [];
    this.lastCheck = Date.now();
    this.cpuUsage = process.cpuUsage();
  }

  start(interval = 1000) {
    this.interval = setInterval(() => {
      this.updateMetrics();
    }, interval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  updateMetrics() {
    // CPU usage
    const currentCpuUsage = process.cpuUsage(this.cpuUsage);
    const totalCpuTime = currentCpuUsage.user + currentCpuUsage.system;
    const elapsedTime = Date.now() - this.lastCheck;
    this.metrics.cpu = (totalCpuTime / 1000 / elapsedTime) * 100;
    this.cpuUsage = process.cpuUsage();

    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memory = memUsage.heapUsed;

    // Calculate request metrics
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(r => r.timestamp > now - 60000);
    this.metrics.requestsPerSecond = recentRequests.length / 60;

    // Average response time
    if (recentRequests.length > 0) {
      const totalResponseTime = recentRequests.reduce((sum, r) => sum + r.duration, 0);
      this.metrics.avgResponseTime = totalResponseTime / recentRequests.length;
    }

    // Error rate
    const recentErrors = this.errorHistory.filter(e => e.timestamp > now - 60000);
    this.metrics.errorRate = recentRequests.length > 0 
      ? (recentErrors.length / recentRequests.length) * 100 
      : 0;

    // Clean old data
    this.requestHistory = recentRequests;
    this.errorHistory = recentErrors;

    this.lastCheck = now;
    this.emit('metrics-updated', this.metrics);
  }

  recordRequest(duration, error = false) {
    const request = {
      timestamp: Date.now(),
      duration,
      error
    };

    this.requestHistory.push(request);
    if (error) {
      this.errorHistory.push(request);
    }

    // Keep only last 1000 requests
    if (this.requestHistory.length > 1000) {
      this.requestHistory.shift();
    }
    if (this.errorHistory.length > 1000) {
      this.errorHistory.shift();
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
      uptime: os.uptime()
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Start monitoring by default
performanceMonitor.start();

// Instrumented performance check
export const checkPerformance = trace(async (duration = 10) => {
  const startMetrics = performanceMonitor.getMetrics();
  const samples = [];

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      samples.push({
        timestamp: new Date().toISOString(),
        ...performanceMonitor.getMetrics()
      });
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      const endMetrics = performanceMonitor.getMetrics();

      resolve({
        startMetrics,
        endMetrics,
        samples,
        systemInfo: performanceMonitor.getSystemInfo(),
        summary: {
          avgCpu: samples.reduce((sum, s) => sum + s.cpu, 0) / samples.length,
          maxCpu: Math.max(...samples.map(s => s.cpu)),
          minCpu: Math.min(...samples.map(s => s.cpu)),
          avgMemory: samples.reduce((sum, s) => sum + s.memory, 0) / samples.length,
          totalRequests: endMetrics.activeRequests - startMetrics.activeRequests
        }
      });
    }, duration * 1000);
  });
});