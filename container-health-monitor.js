#!/usr/bin/env node

/**
 * Container Health Monitoring System
 * Comprehensive container orchestration and health monitoring
 * 
 * Features:
 * - Container health monitoring
 * - Service dependency checking
 * - Automated restart and recovery
 * - Container metrics collection
 * - Health dashboard
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ContainerHealthMonitor extends EventEmitter {
  constructor() {
    super();
    this.containers = new Map();
    this.healthChecks = new Map();
    this.dependencies = new Map();
    this.metrics = new Map();
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      dependencyCheckInterval: 60000, // 1 minute
      metricsInterval: 15000, // 15 seconds
      maxRestartAttempts: 3,
      restartDelay: 5000, // 5 seconds
      healthTimeout: 10000, // 10 seconds
      logRetentionDays: 7
    };
    this.isRunning = false;
    this.intervals = [];
    this.initializeContainerConfig();
  }

  // Initialize container configuration
  initializeContainerConfig() {
    // Essential containers configuration
    this.containers.set('cf-langfuse-server', {
      name: 'cf-langfuse-server',
      service: 'langfuse-main',
      priority: 'high',
      healthEndpoint: 'http://localhost:3000/api/public/health',
      ports: ['3000:3000'],
      dependencies: ['cf-langfuse-db', 'cf-clickhouse'],
      restartPolicy: 'unless-stopped',
      maxMemory: '2g',
      maxCpu: '1.0',
      environment: 'production',
      startupTime: 120000, // 2 minutes
      healthCheckPath: '/api/public/health'
    });

    this.containers.set('langfuse-worker-built', {
      name: 'langfuse-worker-built',
      service: 'langfuse-worker',
      priority: 'high',
      healthEndpoint: 'http://localhost:3030/health',
      ports: ['3030:3030'],
      dependencies: ['cf-langfuse-db', 'cf-clickhouse', 'cf-analysis-redis'],
      restartPolicy: 'unless-stopped',
      maxMemory: '1g',
      maxCpu: '0.5',
      environment: 'production',
      startupTime: 60000, // 1 minute
      healthCheckPath: '/health'
    });

    this.containers.set('cf-langfuse-db', {
      name: 'cf-langfuse-db',
      service: 'postgres',
      priority: 'critical',
      healthEndpoint: 'postgresql://localhost:5432/langfuse',
      ports: ['5432:5432'],
      dependencies: [],
      restartPolicy: 'unless-stopped',
      maxMemory: '512m',
      maxCpu: '0.5',
      environment: 'production',
      startupTime: 30000, // 30 seconds
      healthCheckCommand: 'pg_isready -U postgres'
    });

    this.containers.set('cf-clickhouse', {
      name: 'cf-clickhouse',
      service: 'clickhouse',
      priority: 'high',
      healthEndpoint: 'http://localhost:8123/ping',
      ports: ['8123:8123', '9000:9000'],
      dependencies: [],
      restartPolicy: 'unless-stopped',
      maxMemory: '4g',
      maxCpu: '2.0',
      environment: 'production',
      startupTime: 60000, // 1 minute
      healthCheckPath: '/ping'
    });

    this.containers.set('cf-analysis-app', {
      name: 'cf-analysis-app',
      service: 'analysis-app',
      priority: 'medium',
      healthEndpoint: 'http://localhost:3001/health',
      ports: ['3001:8080'],
      dependencies: ['cf-analysis-postgres', 'cf-analysis-redis'],
      restartPolicy: 'unless-stopped',
      maxMemory: '1g',
      maxCpu: '0.5',
      environment: 'production',
      startupTime: 45000, // 45 seconds
      healthCheckPath: '/health'
    });

    this.containers.set('cf-analysis-postgres', {
      name: 'cf-analysis-postgres',
      service: 'postgres',
      priority: 'high',
      healthEndpoint: 'postgresql://localhost:5433/postgres',
      ports: ['5433:5432'],
      dependencies: [],
      restartPolicy: 'unless-stopped',
      maxMemory: '512m',
      maxCpu: '0.5',
      environment: 'production',
      startupTime: 30000, // 30 seconds
      healthCheckCommand: 'pg_isready -U postgres'
    });

    this.containers.set('cf-analysis-redis', {
      name: 'cf-analysis-redis',
      service: 'redis',
      priority: 'medium',
      healthEndpoint: 'redis://localhost:6380',
      ports: ['6380:6379'],
      dependencies: [],
      restartPolicy: 'unless-stopped',
      maxMemory: '256m',
      maxCpu: '0.25',
      environment: 'production',
      startupTime: 15000, // 15 seconds
      healthCheckCommand: 'redis-cli ping'
    });

    // Set up dependency mapping
    this.setupDependencyMapping();
  }

  // Setup dependency mapping for service coordination
  setupDependencyMapping() {
    this.dependencies.set('cf-langfuse-server', ['cf-langfuse-db', 'cf-clickhouse']);
    this.dependencies.set('langfuse-worker-built', ['cf-langfuse-db', 'cf-clickhouse', 'cf-analysis-redis']);
    this.dependencies.set('cf-analysis-app', ['cf-analysis-postgres', 'cf-analysis-redis']);
  }

  // Start the health monitoring system
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Container health monitor is already running');
      return;
    }

    console.log('🚀 Starting Container Health Monitor...');
    this.isRunning = true;

    // Initialize metrics collection
    await this.initializeMetrics();

    // Start health monitoring intervals
    this.startHealthChecks();
    this.startDependencyChecks();
    this.startMetricsCollection();

    // Initial container discovery
    await this.discoverContainers();

    // Start dashboard server
    await this.startDashboardServer();

    console.log('✅ Container Health Monitor started successfully');
    this.emit('monitor-started');
  }

  // Stop the health monitoring system
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Container Health Monitor...');
    this.isRunning = false;

    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Save final metrics
    await this.saveMetrics();

    console.log('✅ Container Health Monitor stopped');
    this.emit('monitor-stopped');
  }

  // Discover running containers
  async discoverContainers() {
    try {
      const containers = await this.executeCommand('docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"');
      const lines = containers.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const [name, status, ports] = line.split('\t');
        if (this.containers.has(name)) {
          const container = this.containers.get(name);
          container.currentStatus = status;
          container.currentPorts = ports;
          container.lastSeen = new Date().toISOString();
          
          // Check if container is healthy
          const isHealthy = await this.checkContainerHealth(name);
          container.isHealthy = isHealthy;
          
          this.containers.set(name, container);
        }
      }
      
      console.log(`📊 Discovered ${lines.length} containers`);
    } catch (error) {
      console.error('❌ Error discovering containers:', error.message);
    }
  }

  // Start health checks
  startHealthChecks() {
    const healthInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      console.log('🔍 Running health checks...');
      
      for (const [name, container] of this.containers) {
        try {
          const isHealthy = await this.checkContainerHealth(name);
          const wasHealthy = container.isHealthy;
          
          container.isHealthy = isHealthy;
          container.lastHealthCheck = new Date().toISOString();
          
          if (!isHealthy && wasHealthy) {
            console.log(`⚠️  Container ${name} became unhealthy`);
            this.emit('container-unhealthy', { name, container });
            await this.handleUnhealthyContainer(name, container);
          } else if (isHealthy && !wasHealthy) {
            console.log(`✅ Container ${name} recovered`);
            this.emit('container-recovered', { name, container });
          }
          
          this.containers.set(name, container);
        } catch (error) {
          console.error(`❌ Health check failed for ${name}:`, error.message);
        }
      }
    }, this.config.healthCheckInterval);

    this.intervals.push(healthInterval);
  }

  // Start dependency checks
  startDependencyChecks() {
    const dependencyInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      console.log('🔗 Checking service dependencies...');
      
      for (const [name, deps] of this.dependencies) {
        try {
          const container = this.containers.get(name);
          if (!container) continue;
          
          const dependencyStatus = await this.checkDependencies(name, deps);
          container.dependencyStatus = dependencyStatus;
          
          if (!dependencyStatus.allHealthy) {
            console.log(`⚠️  Container ${name} has unhealthy dependencies:`, dependencyStatus.unhealthyDeps);
            this.emit('dependency-failure', { name, container, dependencyStatus });
          }
          
          this.containers.set(name, container);
        } catch (error) {
          console.error(`❌ Dependency check failed for ${name}:`, error.message);
        }
      }
    }, this.config.dependencyCheckInterval);

    this.intervals.push(dependencyInterval);
  }

  // Start metrics collection
  startMetricsCollection() {
    const metricsInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      for (const [name, container] of this.containers) {
        try {
          const metrics = await this.collectContainerMetrics(name);
          
          if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
          }
          
          const containerMetrics = this.metrics.get(name);
          containerMetrics.push({
            timestamp: new Date().toISOString(),
            ...metrics
          });
          
          // Keep only last 1000 metrics points
          if (containerMetrics.length > 1000) {
            containerMetrics.splice(0, containerMetrics.length - 1000);
          }
          
          this.metrics.set(name, containerMetrics);
        } catch (error) {
          console.error(`❌ Metrics collection failed for ${name}:`, error.message);
        }
      }
    }, this.config.metricsInterval);

    this.intervals.push(metricsInterval);
  }

  // Check container health
  async checkContainerHealth(name) {
    try {
      const container = this.containers.get(name);
      if (!container) return false;
      
      // Check if container is running
      const isRunning = await this.isContainerRunning(name);
      if (!isRunning) return false;
      
      // Check container-specific health
      if (container.healthEndpoint) {
        if (container.healthEndpoint.startsWith('http')) {
          return await this.checkHttpHealth(container.healthEndpoint);
        } else if (container.healthEndpoint.startsWith('postgresql')) {
          return await this.checkPostgresHealth(name);
        } else if (container.healthEndpoint.startsWith('redis')) {
          return await this.checkRedisHealth(name);
        }
      }
      
      if (container.healthCheckCommand) {
        return await this.checkCommandHealth(name, container.healthCheckCommand);
      }
      
      return true; // Default to healthy if no specific check
    } catch (error) {
      console.error(`❌ Health check error for ${name}:`, error.message);
      return false;
    }
  }

  // Check if container is running
  async isContainerRunning(name) {
    try {
      const result = await this.executeCommand(`docker ps --filter "name=${name}" --format "{{.Names}}"`);
      return result.trim() === name;
    } catch (error) {
      return false;
    }
  }

  // Check HTTP health
  async checkHttpHealth(url) {
    try {
      const response = await fetch(url, { 
        timeout: this.config.healthTimeout,
        method: 'GET'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Check PostgreSQL health
  async checkPostgresHealth(containerName) {
    try {
      const result = await this.executeCommand(`docker exec ${containerName} pg_isready -U postgres`);
      return result.includes('accepting connections');
    } catch (error) {
      return false;
    }
  }

  // Check Redis health
  async checkRedisHealth(containerName) {
    try {
      const result = await this.executeCommand(`docker exec ${containerName} redis-cli ping`);
      return result.trim() === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Check command health
  async checkCommandHealth(containerName, command) {
    try {
      const result = await this.executeCommand(`docker exec ${containerName} ${command}`);
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Check dependencies
  async checkDependencies(containerName, dependencies) {
    const results = {
      allHealthy: true,
      healthyDeps: [],
      unhealthyDeps: []
    };
    
    for (const dep of dependencies) {
      const isHealthy = await this.checkContainerHealth(dep);
      if (isHealthy) {
        results.healthyDeps.push(dep);
      } else {
        results.unhealthyDeps.push(dep);
        results.allHealthy = false;
      }
    }
    
    return results;
  }

  // Collect container metrics
  async collectContainerMetrics(name) {
    try {
      const stats = await this.executeCommand(`docker stats ${name} --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"`);
      const lines = stats.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) return {};
      
      const data = lines[1].split('\t');
      return {
        cpuPercent: parseFloat(data[0].replace('%', '')),
        memoryUsage: data[1],
        networkIO: data[2],
        blockIO: data[3]
      };
    } catch (error) {
      console.error(`❌ Metrics collection error for ${name}:`, error.message);
      return {};
    }
  }

  // Handle unhealthy container
  async handleUnhealthyContainer(name, container) {
    console.log(`🔧 Handling unhealthy container: ${name}`);
    
    // Check restart attempts
    if (!container.restartAttempts) {
      container.restartAttempts = 0;
    }
    
    if (container.restartAttempts >= this.config.maxRestartAttempts) {
      console.log(`⚠️  Container ${name} exceeded max restart attempts`);
      this.emit('container-failed', { name, container });
      return;
    }
    
    // Attempt restart
    try {
      console.log(`🔄 Restarting container: ${name}`);
      await this.executeCommand(`docker restart ${name}`);
      container.restartAttempts++;
      container.lastRestart = new Date().toISOString();
      
      // Wait for container to start
      await new Promise(resolve => setTimeout(resolve, container.startupTime || 30000));
      
      // Check if restart was successful
      const isHealthy = await this.checkContainerHealth(name);
      if (isHealthy) {
        console.log(`✅ Container ${name} restarted successfully`);
        container.restartAttempts = 0;
        this.emit('container-restarted', { name, container });
      } else {
        console.log(`❌ Container ${name} restart failed`);
        this.emit('container-restart-failed', { name, container });
      }
      
      this.containers.set(name, container);
    } catch (error) {
      console.error(`❌ Restart failed for ${name}:`, error.message);
      this.emit('container-restart-error', { name, container, error });
    }
  }

  // Initialize metrics storage
  async initializeMetrics() {
    try {
      await fs.mkdir('./container-metrics', { recursive: true });
      console.log('📊 Metrics storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize metrics storage:', error.message);
    }
  }

  // Save metrics to file
  async saveMetrics() {
    try {
      const metricsData = {
        timestamp: new Date().toISOString(),
        containers: Object.fromEntries(this.containers),
        metrics: Object.fromEntries(this.metrics)
      };
      
      const filename = `./container-metrics/metrics-${new Date().toISOString().split('T')[0]}.json`;
      await fs.writeFile(filename, JSON.stringify(metricsData, null, 2));
      
      console.log(`📊 Metrics saved to ${filename}`);
    } catch (error) {
      console.error('❌ Failed to save metrics:', error.message);
    }
  }

  // Start dashboard server
  async startDashboardServer() {
    const http = require('http');
    
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      } else if (req.url === '/containers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(Object.fromEntries(this.containers)));
      } else if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(Object.fromEntries(this.metrics)));
      } else if (req.url === '/dashboard') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.generateDashboardHTML());
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    
    server.listen(9999, () => {
      console.log('🌐 Container dashboard available at http://localhost:9999/dashboard');
    });
  }

  // Generate dashboard HTML
  generateDashboardHTML() {
    const containerStats = Array.from(this.containers.entries()).map(([name, container]) => {
      const status = container.isHealthy ? '🟢 Healthy' : '🔴 Unhealthy';
      const lastMetrics = this.metrics.get(name)?.[this.metrics.get(name)?.length - 1];
      
      return `
        <div class="container-card">
          <h3>${name}</h3>
          <p><strong>Status:</strong> ${status}</p>
          <p><strong>Priority:</strong> ${container.priority}</p>
          <p><strong>Service:</strong> ${container.service}</p>
          <p><strong>Ports:</strong> ${container.ports?.join(', ') || 'N/A'}</p>
          <p><strong>Dependencies:</strong> ${container.dependencies?.join(', ') || 'None'}</p>
          <p><strong>Last Health Check:</strong> ${container.lastHealthCheck || 'N/A'}</p>
          <p><strong>Restart Attempts:</strong> ${container.restartAttempts || 0}</p>
          ${lastMetrics ? `
            <div class="metrics">
              <p><strong>CPU:</strong> ${lastMetrics.cpuPercent}%</p>
              <p><strong>Memory:</strong> ${lastMetrics.memoryUsage}</p>
              <p><strong>Network I/O:</strong> ${lastMetrics.networkIO}</p>
              <p><strong>Block I/O:</strong> ${lastMetrics.blockIO}</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Container Health Dashboard</title>
          <meta http-equiv="refresh" content="30">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .container-card { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .metrics { background: #ecf0f1; padding: 10px; margin-top: 10px; border-radius: 4px; }
            .status-healthy { color: #27ae60; }
            .status-unhealthy { color: #e74c3c; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🐳 Container Health Dashboard</h1>
            <p>Real-time monitoring of container health and metrics</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="grid">
            ${containerStats}
          </div>
          
          <script>
            setTimeout(() => location.reload(), 30000);
          </script>
        </body>
      </html>
    `;
  }

  // Execute command utility
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

  // Get system status
  getSystemStatus() {
    const totalContainers = this.containers.size;
    const healthyContainers = Array.from(this.containers.values()).filter(c => c.isHealthy).length;
    const unhealthyContainers = totalContainers - healthyContainers;
    
    return {
      totalContainers,
      healthyContainers,
      unhealthyContainers,
      healthPercentage: totalContainers > 0 ? ((healthyContainers / totalContainers) * 100).toFixed(1) : 0,
      lastUpdate: new Date().toISOString()
    };
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new ContainerHealthMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down container monitor...');
    await monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down container monitor...');
    await monitor.stop();
    process.exit(0);
  });
  
  // Start monitor
  monitor.start().catch(error => {
    console.error('❌ Failed to start container monitor:', error);
    process.exit(1);
  });
  
  // Event handlers
  monitor.on('container-unhealthy', ({ name, container }) => {
    console.log(`⚠️  ALERT: Container ${name} is unhealthy`);
  });
  
  monitor.on('container-recovered', ({ name, container }) => {
    console.log(`✅ RECOVERY: Container ${name} is now healthy`);
  });
  
  monitor.on('container-restarted', ({ name, container }) => {
    console.log(`🔄 RESTART: Container ${name} restarted successfully`);
  });
  
  monitor.on('container-failed', ({ name, container }) => {
    console.log(`❌ FAILURE: Container ${name} failed after ${container.restartAttempts} attempts`);
  });
  
  monitor.on('dependency-failure', ({ name, container, dependencyStatus }) => {
    console.log(`🔗 DEPENDENCY: Container ${name} has dependency issues:`, dependencyStatus.unhealthyDeps);
  });
}

module.exports = ContainerHealthMonitor;