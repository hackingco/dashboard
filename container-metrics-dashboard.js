#!/usr/bin/env node

/**
 * Container Metrics Dashboard
 * Real-time container metrics visualization and monitoring
 * 
 * Features:
 * - Real-time metrics collection
 * - Interactive web dashboard
 * - Alerting system
 * - Historical data analysis
 * - Performance optimization suggestions
 * - Resource utilization tracking
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class ContainerMetricsDashboard {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server);
    this.port = 9998;
    this.metrics = new Map();
    this.alerts = [];
    this.config = {
      metricsInterval: 5000,
      alertThresholds: {
        cpuPercent: 80,
        memoryPercent: 85,
        diskPercent: 90,
        networkErrorRate: 5
      },
      historyRetention: 1000, // Keep last 1000 metrics points
      refreshInterval: 2000
    };
    this.isRunning = false;
    this.intervals = [];
    this.containers = [
      'cf-langfuse-server',
      'langfuse-worker-built',
      'cf-langfuse-db',
      'cf-clickhouse',
      'cf-analysis-app',
      'cf-analysis-postgres',
      'cf-analysis-redis'
    ];
    this.initializeWebServer();
  }

  // Initialize web server
  initializeWebServer() {
    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'dashboard-static')));
    
    // API routes
    this.app.get('/api/metrics', (req, res) => {
      res.json(Object.fromEntries(this.metrics));
    });

    this.app.get('/api/alerts', (req, res) => {
      res.json(this.alerts);
    });

    this.app.get('/api/containers', (req, res) => {
      res.json(this.containers);
    });

    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        containersMonitored: this.containers.length
      });
    });

    // Dashboard route
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // Socket.IO connections
    this.io.on('connection', (socket) => {
      console.log('📊 Dashboard client connected');
      
      // Send initial data
      socket.emit('initial-metrics', Object.fromEntries(this.metrics));
      socket.emit('initial-alerts', this.alerts);
      
      socket.on('disconnect', () => {
        console.log('📊 Dashboard client disconnected');
      });
    });
  }

  // Start dashboard
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Dashboard is already running');
      return;
    }

    console.log('🚀 Starting Container Metrics Dashboard...');
    this.isRunning = true;

    // Start metrics collection
    await this.startMetricsCollection();

    // Start alert monitoring
    await this.startAlertMonitoring();

    // Start web server
    await this.startWebServer();

    console.log(`✅ Container Metrics Dashboard started at http://localhost:${this.port}`);
  }

  // Stop dashboard
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Container Metrics Dashboard...');
    this.isRunning = false;

    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Close server
    this.server.close();

    console.log('✅ Container Metrics Dashboard stopped');
  }

  // Start metrics collection
  async startMetricsCollection() {
    const metricsInterval = setInterval(async () => {
      if (!this.isRunning) return;

      for (const containerName of this.containers) {
        try {
          const metrics = await this.collectContainerMetrics(containerName);
          if (metrics) {
            this.updateMetrics(containerName, metrics);
          }
        } catch (error) {
          console.error(`❌ Failed to collect metrics for ${containerName}:`, error.message);
        }
      }

      // Emit metrics to connected clients
      this.io.emit('metrics-update', Object.fromEntries(this.metrics));
    }, this.config.metricsInterval);

    this.intervals.push(metricsInterval);
  }

  // Collect container metrics
  async collectContainerMetrics(containerName) {
    try {
      // Check if container is running
      const isRunning = await this.isContainerRunning(containerName);
      if (!isRunning) {
        return {
          timestamp: new Date().toISOString(),
          status: 'stopped',
          cpu: 0,
          memory: 0,
          memoryUsage: '0B / 0B',
          network: '0B / 0B',
          block: '0B / 0B',
          pids: 0
        };
      }

      // Get container stats
      const stats = await this.executeCommand(
        `docker stats ${containerName} --no-stream --format "table {{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}"`
      );

      const lines = stats.split('\n').filter(line => line.trim());
      if (lines.length < 2) return null;

      const data = lines[1].split('\t');
      
      // Get additional container info
      const inspect = await this.executeCommand(`docker inspect ${containerName}`);
      const containerInfo = JSON.parse(inspect)[0];
      
      return {
        timestamp: new Date().toISOString(),
        status: 'running',
        cpu: parseFloat(data[0].replace('%', '')),
        memory: parseFloat(data[1].replace('%', '')),
        memoryUsage: data[2],
        network: data[3],
        block: data[4],
        pids: parseInt(data[5]),
        uptime: this.calculateUptime(containerInfo.State.StartedAt),
        restartCount: containerInfo.RestartCount,
        image: containerInfo.Config.Image,
        ports: this.extractPorts(containerInfo.NetworkSettings.Ports)
      };
    } catch (error) {
      console.error(`❌ Error collecting metrics for ${containerName}:`, error.message);
      return null;
    }
  }

  // Update metrics
  updateMetrics(containerName, metrics) {
    if (!this.metrics.has(containerName)) {
      this.metrics.set(containerName, []);
    }

    const containerMetrics = this.metrics.get(containerName);
    containerMetrics.push(metrics);

    // Keep only recent metrics
    if (containerMetrics.length > this.config.historyRetention) {
      containerMetrics.splice(0, containerMetrics.length - this.config.historyRetention);
    }

    this.metrics.set(containerName, containerMetrics);
  }

  // Start alert monitoring
  async startAlertMonitoring() {
    const alertInterval = setInterval(async () => {
      if (!this.isRunning) return;

      for (const [containerName, metrics] of this.metrics) {
        if (metrics.length === 0) continue;

        const latestMetrics = metrics[metrics.length - 1];
        await this.checkAlerts(containerName, latestMetrics);
      }

      // Clean old alerts
      this.cleanOldAlerts();

      // Emit alerts to connected clients
      this.io.emit('alerts-update', this.alerts);
    }, this.config.metricsInterval);

    this.intervals.push(alertInterval);
  }

  // Check alerts
  async checkAlerts(containerName, metrics) {
    const alerts = [];

    // CPU alert
    if (metrics.cpu > this.config.alertThresholds.cpuPercent) {
      alerts.push({
        id: `${containerName}-cpu-${Date.now()}`,
        container: containerName,
        type: 'cpu',
        level: metrics.cpu > 90 ? 'critical' : 'warning',
        message: `High CPU usage: ${metrics.cpu.toFixed(1)}%`,
        value: metrics.cpu,
        threshold: this.config.alertThresholds.cpuPercent,
        timestamp: new Date().toISOString()
      });
    }

    // Memory alert
    if (metrics.memory > this.config.alertThresholds.memoryPercent) {
      alerts.push({
        id: `${containerName}-memory-${Date.now()}`,
        container: containerName,
        type: 'memory',
        level: metrics.memory > 95 ? 'critical' : 'warning',
        message: `High memory usage: ${metrics.memory.toFixed(1)}%`,
        value: metrics.memory,
        threshold: this.config.alertThresholds.memoryPercent,
        timestamp: new Date().toISOString()
      });
    }

    // Container stopped alert
    if (metrics.status === 'stopped') {
      alerts.push({
        id: `${containerName}-stopped-${Date.now()}`,
        container: containerName,
        type: 'status',
        level: 'critical',
        message: `Container is stopped`,
        value: 'stopped',
        timestamp: new Date().toISOString()
      });
    }

    // High restart count alert
    if (metrics.restartCount > 3) {
      alerts.push({
        id: `${containerName}-restarts-${Date.now()}`,
        container: containerName,
        type: 'restarts',
        level: 'warning',
        message: `High restart count: ${metrics.restartCount}`,
        value: metrics.restartCount,
        timestamp: new Date().toISOString()
      });
    }

    // Add new alerts
    this.alerts.push(...alerts);
  }

  // Clean old alerts
  cleanOldAlerts() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > oneHourAgo
    );
  }

  // Start web server
  async startWebServer() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  // Generate dashboard HTML
  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Container Metrics Dashboard</title>
    <script src="https://cdn.socket.io/4.0.0/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Arial', sans-serif; 
            background: #f0f2f5; 
            color: #333; 
            line-height: 1.6;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 20px; 
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.1em; opacity: 0.9; }
        .dashboard { 
            max-width: 1400px; 
            margin: 20px auto; 
            padding: 0 20px;
        }
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px;
        }
        .metric-card { 
            background: white; 
            border-radius: 12px; 
            padding: 20px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        .metric-card:hover { transform: translateY(-5px); }
        .metric-card h3 { 
            color: #4a5568; 
            margin-bottom: 15px; 
            font-size: 1.2em;
            display: flex;
            align-items: center;
        }
        .status-indicator { 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            margin-right: 10px;
        }
        .status-running { background: #48bb78; }
        .status-stopped { background: #f56565; }
        .status-warning { background: #ed8936; }
        .metric-value { 
            font-size: 2em; 
            font-weight: bold; 
            color: #2d3748;
            margin: 10px 0;
        }
        .metric-details { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 10px; 
            margin-top: 15px;
        }
        .detail-item { 
            background: #f7fafc; 
            padding: 8px 12px; 
            border-radius: 6px; 
            font-size: 0.9em;
        }
        .detail-label { 
            font-weight: 600; 
            color: #4a5568;
        }
        .chart-container { 
            position: relative; 
            height: 200px; 
            margin-top: 20px;
        }
        .alerts-section { 
            background: white; 
            border-radius: 12px; 
            padding: 20px; 
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .alerts-section h2 { 
            color: #4a5568; 
            margin-bottom: 15px;
            font-size: 1.4em;
        }
        .alert-item { 
            background: #fed7d7; 
            border: 1px solid #feb2b2; 
            padding: 12px; 
            margin: 8px 0; 
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .alert-warning { 
            background: #feebc8; 
            border-color: #fbb6ce;
        }
        .alert-critical { 
            background: #fed7d7; 
            border-color: #fc8181;
        }
        .alert-message { 
            font-weight: 600;
        }
        .alert-time { 
            font-size: 0.85em; 
            color: #666;
        }
        .no-alerts { 
            text-align: center; 
            color: #68d391; 
            font-weight: 600;
            padding: 20px;
        }
        .summary-cards { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 15px; 
            margin-bottom: 30px;
        }
        .summary-card { 
            background: white; 
            border-radius: 8px; 
            padding: 20px; 
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card h4 { 
            color: #4a5568; 
            margin-bottom: 10px;
        }
        .summary-value { 
            font-size: 2.5em; 
            font-weight: bold; 
            color: #2d3748;
        }
        .refresh-indicator { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            background: #48bb78; 
            color: white; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-size: 0.9em;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .refresh-indicator.active { opacity: 1; }
        @media (max-width: 768px) {
            .metrics-grid { grid-template-columns: 1fr; }
            .summary-cards { grid-template-columns: 1fr; }
            .dashboard { padding: 0 10px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐳 Container Metrics Dashboard</h1>
        <p>Real-time monitoring of container health and performance</p>
        <div id="lastUpdate">Last updated: ${new Date().toLocaleString()}</div>
    </div>

    <div class="refresh-indicator" id="refreshIndicator">
        🔄 Updating...
    </div>

    <div class="dashboard">
        <div class="summary-cards">
            <div class="summary-card">
                <h4>Total Containers</h4>
                <div class="summary-value" id="totalContainers">${this.containers.length}</div>
            </div>
            <div class="summary-card">
                <h4>Running</h4>
                <div class="summary-value" id="runningContainers">-</div>
            </div>
            <div class="summary-card">
                <h4>Stopped</h4>
                <div class="summary-value" id="stoppedContainers">-</div>
            </div>
            <div class="summary-card">
                <h4>Active Alerts</h4>
                <div class="summary-value" id="activeAlerts">0</div>
            </div>
        </div>

        <div class="alerts-section">
            <h2>🚨 Active Alerts</h2>
            <div id="alertsList">
                <div class="no-alerts">No active alerts</div>
            </div>
        </div>

        <div class="metrics-grid" id="metricsGrid">
            <!-- Metrics cards will be populated here -->
        </div>
    </div>

    <script>
        const socket = io();
        let metrics = {};
        let alerts = [];
        let charts = {};

        // Initialize
        socket.on('initial-metrics', (data) => {
            metrics = data;
            updateDashboard();
        });

        socket.on('initial-alerts', (data) => {
            alerts = data;
            updateAlerts();
        });

        socket.on('metrics-update', (data) => {
            metrics = data;
            updateDashboard();
            showRefreshIndicator();
        });

        socket.on('alerts-update', (data) => {
            alerts = data;
            updateAlerts();
        });

        function updateDashboard() {
            const grid = document.getElementById('metricsGrid');
            grid.innerHTML = '';

            let runningCount = 0;
            let stoppedCount = 0;

            for (const [containerName, containerMetrics] of Object.entries(metrics)) {
                if (containerMetrics.length === 0) continue;

                const latest = containerMetrics[containerMetrics.length - 1];
                const isRunning = latest.status === 'running';
                
                if (isRunning) runningCount++;
                else stoppedCount++;

                const card = createMetricCard(containerName, latest, containerMetrics);
                grid.appendChild(card);
            }

            // Update summary
            document.getElementById('runningContainers').textContent = runningCount;
            document.getElementById('stoppedContainers').textContent = stoppedCount;
            document.getElementById('lastUpdate').textContent = \`Last updated: \${new Date().toLocaleString()}\`;
        }

        function createMetricCard(containerName, latest, history) {
            const card = document.createElement('div');
            card.className = 'metric-card';
            
            const statusClass = latest.status === 'running' ? 'status-running' : 'status-stopped';
            
            card.innerHTML = \`
                <h3>
                    <span class="status-indicator \${statusClass}"></span>
                    \${containerName}
                </h3>
                <div class="metric-value">\${latest.cpu.toFixed(1)}% CPU</div>
                <div class="metric-details">
                    <div class="detail-item">
                        <span class="detail-label">Memory:</span> \${latest.memory.toFixed(1)}%
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span> \${latest.status}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Uptime:</span> \${latest.uptime || 'N/A'}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Restarts:</span> \${latest.restartCount || 0}
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="chart-\${containerName}"></canvas>
                </div>
            \`;

            // Create chart after DOM update
            setTimeout(() => {
                createChart(containerName, history);
            }, 100);

            return card;
        }

        function createChart(containerName, history) {
            const ctx = document.getElementById(\`chart-\${containerName}\`);
            if (!ctx) return;

            const data = history.slice(-20); // Last 20 data points
            
            if (charts[containerName]) {
                charts[containerName].destroy();
            }

            charts[containerName] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
                    datasets: [{
                        label: 'CPU %',
                        data: data.map(d => d.cpu),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Memory %',
                        data: data.map(d => d.memory),
                        borderColor: '#f093fb',
                        backgroundColor: 'rgba(240, 147, 251, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top'
                        }
                    }
                }
            });
        }

        function updateAlerts() {
            const alertsList = document.getElementById('alertsList');
            const activeAlertsCount = document.getElementById('activeAlerts');
            
            activeAlertsCount.textContent = alerts.length;

            if (alerts.length === 0) {
                alertsList.innerHTML = '<div class="no-alerts">No active alerts</div>';
                return;
            }

            alertsList.innerHTML = alerts.map(alert => \`
                <div class="alert-item alert-\${alert.level}">
                    <div>
                        <div class="alert-message">\${alert.container}: \${alert.message}</div>
                    </div>
                    <div class="alert-time">\${new Date(alert.timestamp).toLocaleTimeString()}</div>
                </div>
            \`).join('');
        }

        function showRefreshIndicator() {
            const indicator = document.getElementById('refreshIndicator');
            indicator.classList.add('active');
            setTimeout(() => {
                indicator.classList.remove('active');
            }, 1000);
        }

        // Auto-refresh every 30 seconds
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>
    `;
  }

  // Helper methods
  async isContainerRunning(containerName) {
    try {
      const result = await this.executeCommand(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`);
      return result.trim() === containerName;
    } catch (error) {
      return false;
    }
  }

  calculateUptime(startedAt) {
    try {
      const started = new Date(startedAt);
      const now = new Date();
      const uptime = now - started;
      
      const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    } catch (error) {
      return 'Unknown';
    }
  }

  extractPorts(portsConfig) {
    const ports = [];
    for (const [containerPort, hostBindings] of Object.entries(portsConfig || {})) {
      if (hostBindings) {
        for (const binding of hostBindings) {
          ports.push(`${binding.HostPort}:${containerPort}`);
        }
      }
    }
    return ports;
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }
}

// CLI interface
if (require.main === module) {
  const dashboard = new ContainerMetricsDashboard();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down dashboard...');
    await dashboard.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down dashboard...');
    await dashboard.stop();
    process.exit(0);
  });
  
  // Start dashboard
  dashboard.start().catch(error => {
    console.error('❌ Failed to start dashboard:', error);
    process.exit(1);
  });
}

module.exports = ContainerMetricsDashboard;