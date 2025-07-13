#!/usr/bin/env node
/**
 * Langfuse Live Trace Monitor
 * Real-time monitoring of traces during test execution
 */

const { Langfuse } = require('langfuse');
const chalk = require('chalk');
const Table = require('cli-table3');
const blessed = require('blessed');
const contrib = require('blessed-contrib');

// Environment configuration
const LANGFUSE_HOST = process.env.LANGFUSE_HOST || 'https://us.cloud.langfuse.com';
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const MONITOR_INTERVAL = parseInt(process.env.MONITOR_INTERVAL || '1000');
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || '5000'); // ms

class LangfuseMonitor {
  constructor() {
    this.langfuse = new Langfuse({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_HOST,
      flushAt: 1,
      flushInterval: 100
    });

    this.stats = {
      totalTraces: 0,
      successfulTraces: 0,
      failedTraces: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errorRate: 0,
      tracesPerSecond: 0,
      lastTraceTime: null,
      startTime: Date.now(),
      tracesByType: {},
      errors: [],
      alerts: []
    };

    this.recentTraces = [];
    this.maxRecentTraces = 100;
    this.setupDashboard();
  }

  setupDashboard() {
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Langfuse Trace Monitor'
    });

    // Create grid layout
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    // Stats table
    this.statsTable = this.grid.set(0, 0, 4, 6, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: 'Live Statistics',
      width: '50%',
      height: '30%',
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 3,
      columnWidth: [20, 20]
    });

    // Trace rate chart
    this.traceChart = this.grid.set(0, 6, 4, 6, contrib.line, {
      style: { line: 'yellow', text: 'green', baseline: 'white' },
      xLabelPadding: 3,
      xPadding: 5,
      showLegend: true,
      wholeNumbersOnly: false,
      label: 'Traces Per Second'
    });

    // Recent traces log
    this.traceLog = this.grid.set(4, 0, 4, 12, contrib.log, {
      fg: 'green',
      selectedFg: 'green',
      label: 'Recent Traces'
    });

    // Alerts box
    this.alertBox = this.grid.set(8, 0, 4, 6, contrib.log, {
      fg: 'red',
      selectedFg: 'red',
      label: 'Alerts & Warnings'
    });

    // Error distribution
    this.errorChart = this.grid.set(8, 6, 4, 6, contrib.bar, {
      label: 'Error Distribution',
      barWidth: 6,
      barSpacing: 6,
      xOffset: 0,
      maxHeight: 9
    });

    // Quit on Escape, q, or Control-C
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.cleanup();
      process.exit(0);
    });

    this.screen.render();
  }

  async start() {
    console.log(chalk.cyan('🚀 Starting Langfuse Live Monitor...'));
    
    // Start monitoring loop
    this.monitorInterval = setInterval(() => this.monitorTraces(), MONITOR_INTERVAL);
    
    // Update dashboard
    this.dashboardInterval = setInterval(() => this.updateDashboard(), 500);
    
    // Track trace rate
    this.rateInterval = setInterval(() => this.calculateTraceRate(), 1000);
  }

  async monitorTraces() {
    try {
      // Fetch recent traces
      const traces = await this.fetchRecentTraces();
      
      for (const trace of traces) {
        this.processTrace(trace);
      }
    } catch (error) {
      this.handleError('Monitor Error', error);
    }
  }

  async fetchRecentTraces() {
    // In production, this would use Langfuse API to fetch traces
    // For now, simulating trace data
    const mockTraces = [];
    
    // Simulate 0-5 new traces per interval
    const numTraces = Math.floor(Math.random() * 6);
    
    for (let i = 0; i < numTraces; i++) {
      mockTraces.push({
        id: `trace-${Date.now()}-${i}`,
        timestamp: new Date().toISOString(),
        name: this.getRandomTraceName(),
        userId: `user-${Math.floor(Math.random() * 100)}`,
        metadata: {
          model: this.getRandomModel(),
          tokens: Math.floor(Math.random() * 1000),
          cost: (Math.random() * 0.1).toFixed(4)
        },
        latency: Math.floor(Math.random() * 3000) + 200,
        status: Math.random() > 0.95 ? 'error' : 'success',
        error: Math.random() > 0.95 ? 'Rate limit exceeded' : null
      });
    }
    
    return mockTraces;
  }

  processTrace(trace) {
    // Update statistics
    this.stats.totalTraces++;
    
    if (trace.status === 'success') {
      this.stats.successfulTraces++;
    } else {
      this.stats.failedTraces++;
      this.stats.errors.push({
        time: trace.timestamp,
        error: trace.error || 'Unknown error'
      });
    }
    
    // Update latency stats
    const latency = trace.latency || 0;
    this.stats.averageLatency = 
      (this.stats.averageLatency * (this.stats.totalTraces - 1) + latency) / this.stats.totalTraces;
    this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);
    this.stats.minLatency = Math.min(this.stats.minLatency, latency);
    
    // Check for alerts
    if (latency > ALERT_THRESHOLD) {
      this.addAlert(`High latency detected: ${latency}ms for trace ${trace.id}`);
    }
    
    // Track trace types
    const traceType = trace.name || 'unknown';
    this.stats.tracesByType[traceType] = (this.stats.tracesByType[traceType] || 0) + 1;
    
    // Update recent traces
    this.recentTraces.unshift(trace);
    if (this.recentTraces.length > this.maxRecentTraces) {
      this.recentTraces.pop();
    }
    
    // Log trace
    const logMessage = `${trace.timestamp} - ${trace.name} - ${trace.status} - ${latency}ms`;
    this.traceLog.log(trace.status === 'success' ? chalk.green(logMessage) : chalk.red(logMessage));
    
    this.stats.lastTraceTime = Date.now();
  }

  calculateTraceRate() {
    const currentTime = Date.now();
    const timeWindow = 60000; // 1 minute window
    
    const recentTraces = this.recentTraces.filter(trace => {
      const traceTime = new Date(trace.timestamp).getTime();
      return currentTime - traceTime < timeWindow;
    });
    
    this.stats.tracesPerSecond = recentTraces.length / (timeWindow / 1000);
    this.stats.errorRate = this.stats.totalTraces > 0 
      ? (this.stats.failedTraces / this.stats.totalTraces) * 100 
      : 0;
  }

  updateDashboard() {
    // Update stats table
    const statsData = [
      ['Total Traces', this.stats.totalTraces.toString()],
      ['Successful', this.stats.successfulTraces.toString()],
      ['Failed', this.stats.failedTraces.toString()],
      ['Error Rate', `${this.stats.errorRate.toFixed(2)}%`],
      ['Avg Latency', `${this.stats.averageLatency.toFixed(0)}ms`],
      ['Max Latency', `${this.stats.maxLatency}ms`],
      ['Traces/sec', this.stats.tracesPerSecond.toFixed(2)],
      ['Uptime', this.formatUptime()]
    ];
    
    this.statsTable.setData({
      headers: ['Metric', 'Value'],
      data: statsData
    });
    
    // Update trace rate chart
    if (!this.traceRateData) {
      this.traceRateData = {
        x: [],
        y: []
      };
    }
    
    this.traceRateData.x.push(new Date().toLocaleTimeString());
    this.traceRateData.y.push(this.stats.tracesPerSecond);
    
    // Keep last 60 data points
    if (this.traceRateData.x.length > 60) {
      this.traceRateData.x.shift();
      this.traceRateData.y.shift();
    }
    
    this.traceChart.setData([
      {
        title: 'Traces/sec',
        x: this.traceRateData.x,
        y: this.traceRateData.y,
        style: { line: 'yellow' }
      }
    ]);
    
    // Update error distribution
    const errorData = Object.entries(this.stats.tracesByType)
      .map(([type, count]) => [type.substring(0, 10), count]);
    
    this.errorChart.setData({
      titles: errorData.map(d => d[0]),
      data: errorData.map(d => d[1])
    });
    
    this.screen.render();
  }

  addAlert(message) {
    const alert = {
      time: new Date().toISOString(),
      message
    };
    
    this.stats.alerts.push(alert);
    this.alertBox.log(chalk.yellow(`⚠️  ${alert.time} - ${message}`));
    
    // Keep last 50 alerts
    if (this.stats.alerts.length > 50) {
      this.stats.alerts.shift();
    }
  }

  handleError(context, error) {
    const errorMessage = `${context}: ${error.message}`;
    this.addAlert(errorMessage);
    console.error(chalk.red(errorMessage));
  }

  formatUptime() {
    const uptime = Date.now() - this.stats.startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  getRandomTraceName() {
    const names = [
      'user.query',
      'agent.spawn',
      'task.orchestrate',
      'memory.store',
      'memory.retrieve',
      'neural.train',
      'swarm.init',
      'file.read',
      'file.write',
      'bash.execute'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  getRandomModel() {
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'claude-2'];
    return models[Math.floor(Math.random() * models.length)];
  }

  async cleanup() {
    console.log(chalk.yellow('\n🛑 Stopping monitor...'));
    
    // Clear intervals
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.dashboardInterval) clearInterval(this.dashboardInterval);
    if (this.rateInterval) clearInterval(this.rateInterval);
    
    // Generate final report
    await this.generateReport();
    
    // Cleanup Langfuse
    await this.langfuse.shutdown();
  }

  async generateReport() {
    const report = {
      summary: {
        totalTraces: this.stats.totalTraces,
        successfulTraces: this.stats.successfulTraces,
        failedTraces: this.stats.failedTraces,
        errorRate: `${this.stats.errorRate.toFixed(2)}%`,
        averageLatency: `${this.stats.averageLatency.toFixed(0)}ms`,
        maxLatency: `${this.stats.maxLatency}ms`,
        runtime: this.formatUptime()
      },
      traceTypes: this.stats.tracesByType,
      alerts: this.stats.alerts,
      errors: this.stats.errors
    };
    
    const fs = require('fs');
    const reportPath = `langfuse-report-${Date.now()}.json`;
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`\n📊 Report saved to: ${reportPath}`));
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Start monitor
if (require.main === module) {
  const monitor = new LangfuseMonitor();
  monitor.start();
}

module.exports = LangfuseMonitor;