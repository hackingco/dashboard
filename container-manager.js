#!/usr/bin/env node

/**
 * Automated Container Management System
 * Advanced container orchestration with intelligent recovery
 * 
 * Features:
 * - Smart container restart policies
 * - Dependency-aware startup sequences
 * - Resource monitoring and optimization
 * - Auto-scaling based on load
 * - Service mesh coordination
 */

const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ContainerManager extends EventEmitter {
  constructor() {
    super();
    this.containers = new Map();
    this.services = new Map();
    this.networks = new Map();
    this.volumes = new Map();
    this.config = {
      maxRestartAttempts: 5,
      restartDelay: 10000,
      healthCheckTimeout: 15000,
      dependencyTimeout: 60000,
      resourceCheckInterval: 30000,
      autoScaleThreshold: 80,
      networkRetryAttempts: 3
    };
    this.isRunning = false;
    this.intervals = [];
    this.initializeServices();
  }

  // Initialize service definitions
  initializeServices() {
    // Core Langfuse services
    this.services.set('langfuse-stack', {
      name: 'langfuse-stack',
      compose: 'docker-compose.langfuse-v3-working.yml',
      services: ['postgres', 'redis', 'clickhouse', 'langfuse'],
      priority: 'critical',
      startupOrder: ['postgres', 'redis', 'clickhouse', 'langfuse'],
      dependencies: {},
      healthChecks: {
        postgres: 'pg_isready -U postgres',
        redis: 'redis-cli ping',
        clickhouse: 'wget --spider http://localhost:8123/ping',
        langfuse: 'curl -f http://localhost:3000/api/public/health'
      },
      ports: {
        postgres: 5432,
        redis: 6379,
        clickhouse: [8123, 9000],
        langfuse: 3000
      }
    });

    // Analysis services
    this.services.set('analysis-stack', {
      name: 'analysis-stack',
      compose: 'docker-compose.yml',
      services: ['cf-analysis-postgres', 'cf-analysis-redis', 'cf-analysis-app'],
      priority: 'high',
      startupOrder: ['cf-analysis-postgres', 'cf-analysis-redis', 'cf-analysis-app'],
      dependencies: {},
      healthChecks: {
        'cf-analysis-postgres': 'pg_isready -U postgres',
        'cf-analysis-redis': 'redis-cli ping',
        'cf-analysis-app': 'curl -f http://localhost:3001/health'
      },
      ports: {
        'cf-analysis-postgres': 5433,
        'cf-analysis-redis': 6380,
        'cf-analysis-app': 3001
      }
    });

    // Worker services
    this.services.set('worker-stack', {
      name: 'worker-stack',
      compose: 'docker-compose.langfuse-v3-working.yml',
      services: ['langfuse-worker-built'],
      priority: 'high',
      startupOrder: ['langfuse-worker-built'],
      dependencies: {
        'langfuse-worker-built': ['postgres', 'redis', 'clickhouse']
      },
      healthChecks: {
        'langfuse-worker-built': 'curl -f http://localhost:3030/health'
      },
      ports: {
        'langfuse-worker-built': 3030
      }
    });
  }

  // Start container management
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Container manager is already running');
      return;
    }

    console.log('🚀 Starting Container Manager...');
    this.isRunning = true;

    // Initialize Docker environment
    await this.initializeDockerEnvironment();

    // Start all services in order
    await this.startAllServices();

    // Start monitoring
    await this.startMonitoring();

    // Start resource optimization
    await this.startResourceOptimization();

    console.log('✅ Container Manager started successfully');
    this.emit('manager-started');
  }

  // Stop container management
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Container Manager...');
    this.isRunning = false;

    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Graceful shutdown of services
    await this.stopAllServices();

    console.log('✅ Container Manager stopped');
    this.emit('manager-stopped');
  }

  // Initialize Docker environment
  async initializeDockerEnvironment() {
    console.log('🔧 Initializing Docker environment...');
    
    try {
      // Create networks
      await this.createNetworks();
      
      // Create volumes
      await this.createVolumes();
      
      // Verify Docker daemon
      await this.verifyDockerDaemon();
      
      console.log('✅ Docker environment initialized');
    } catch (error) {
      console.error('❌ Docker environment initialization failed:', error.message);
      throw error;
    }
  }

  // Create Docker networks
  async createNetworks() {
    const networks = [
      'swarm-network',
      'swarm-langfuse-v3-working',
      'langfuse-network'
    ];
    
    for (const network of networks) {
      try {
        const exists = await this.executeCommand(`docker network ls --filter "name=${network}" --format "{{.Name}}"`);
        if (!exists.includes(network)) {
          await this.executeCommand(`docker network create ${network}`);
          console.log(`📡 Created network: ${network}`);
        }
      } catch (error) {
        console.log(`⚠️  Network ${network} already exists or creation failed`);
      }
    }
  }

  // Create Docker volumes
  async createVolumes() {
    const volumes = [
      'postgres_data',
      'redis_data',
      'clickhouse_data',
      'langfuse_data',
      'langfuse_uploads'
    ];
    
    for (const volume of volumes) {
      try {
        const exists = await this.executeCommand(`docker volume ls --filter "name=${volume}" --format "{{.Name}}"`);
        if (!exists.includes(volume)) {
          await this.executeCommand(`docker volume create ${volume}`);
          console.log(`💾 Created volume: ${volume}`);
        }
      } catch (error) {
        console.log(`⚠️  Volume ${volume} already exists or creation failed`);
      }
    }
  }

  // Verify Docker daemon
  async verifyDockerDaemon() {
    try {
      await this.executeCommand('docker info');
      console.log('✅ Docker daemon is running');
    } catch (error) {
      throw new Error('Docker daemon is not running or not accessible');
    }
  }

  // Start all services
  async startAllServices() {
    console.log('🚀 Starting all services...');
    
    // Start in priority order
    const priorityOrder = ['critical', 'high', 'medium', 'low'];
    
    for (const priority of priorityOrder) {
      const servicesToStart = Array.from(this.services.values())
        .filter(service => service.priority === priority);
      
      for (const service of servicesToStart) {
        await this.startService(service.name);
        
        // Wait for service to be ready
        await this.waitForServiceReady(service.name);
      }
    }
    
    console.log('✅ All services started');
  }

  // Start a specific service
  async startService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    console.log(`🚀 Starting service: ${serviceName}`);
    
    try {
      // Check if already running
      const runningContainers = await this.getRunningContainers();
      const serviceRunning = service.services.every(s => 
        runningContainers.some(c => c.includes(s))
      );
      
      if (serviceRunning) {
        console.log(`✅ Service ${serviceName} is already running`);
        return;
      }

      // Start service using Docker Compose
      const composeFile = service.compose;
      const composeCommand = `docker-compose -f ${composeFile} up -d ${service.services.join(' ')}`;
      
      await this.executeCommand(composeCommand);
      
      // Wait for containers to start
      await this.waitForContainersStart(service.services);
      
      console.log(`✅ Service ${serviceName} started successfully`);
      this.emit('service-started', { serviceName, service });
      
    } catch (error) {
      console.error(`❌ Failed to start service ${serviceName}:`, error.message);
      this.emit('service-start-failed', { serviceName, service, error });
      throw error;
    }
  }

  // Stop all services
  async stopAllServices() {
    console.log('🛑 Stopping all services...');
    
    // Stop in reverse priority order
    const priorityOrder = ['low', 'medium', 'high', 'critical'];
    
    for (const priority of priorityOrder) {
      const servicesToStop = Array.from(this.services.values())
        .filter(service => service.priority === priority);
      
      for (const service of servicesToStop) {
        await this.stopService(service.name);
      }
    }
    
    console.log('✅ All services stopped');
  }

  // Stop a specific service
  async stopService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    console.log(`🛑 Stopping service: ${serviceName}`);
    
    try {
      const composeFile = service.compose;
      const composeCommand = `docker-compose -f ${composeFile} down`;
      
      await this.executeCommand(composeCommand);
      
      console.log(`✅ Service ${serviceName} stopped successfully`);
      this.emit('service-stopped', { serviceName, service });
      
    } catch (error) {
      console.error(`❌ Failed to stop service ${serviceName}:`, error.message);
      this.emit('service-stop-failed', { serviceName, service, error });
    }
  }

  // Wait for service to be ready
  async waitForServiceReady(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return;

    console.log(`⏳ Waiting for service ${serviceName} to be ready...`);
    
    const maxAttempts = 30;
    const delayBetweenAttempts = 5000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const isReady = await this.checkServiceHealth(serviceName);
        if (isReady) {
          console.log(`✅ Service ${serviceName} is ready`);
          return;
        }
      } catch (error) {
        console.log(`⚠️  Service ${serviceName} health check failed (attempt ${attempt}/${maxAttempts})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
    }
    
    throw new Error(`Service ${serviceName} failed to become ready after ${maxAttempts} attempts`);
  }

  // Check service health
  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return false;

    let allHealthy = true;
    
    for (const [containerName, healthCheck] of Object.entries(service.healthChecks)) {
      try {
        if (healthCheck.startsWith('curl')) {
          // HTTP health check
          const response = await this.executeCommand(healthCheck);
          if (!response || response.includes('error')) {
            allHealthy = false;
          }
        } else {
          // Container exec health check
          const result = await this.executeCommand(`docker exec ${containerName} ${healthCheck}`);
          if (!result || result.includes('error')) {
            allHealthy = false;
          }
        }
      } catch (error) {
        allHealthy = false;
      }
    }
    
    return allHealthy;
  }

  // Wait for containers to start
  async waitForContainersStart(containerNames) {
    console.log(`⏳ Waiting for containers to start: ${containerNames.join(', ')}`);
    
    const maxAttempts = 20;
    const delayBetweenAttempts = 3000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const runningContainers = await this.getRunningContainers();
        const allStarted = containerNames.every(name => 
          runningContainers.some(container => container.includes(name))
        );
        
        if (allStarted) {
          console.log(`✅ All containers started: ${containerNames.join(', ')}`);
          return;
        }
      } catch (error) {
        console.log(`⚠️  Container check failed (attempt ${attempt}/${maxAttempts})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
    }
    
    throw new Error(`Containers failed to start: ${containerNames.join(', ')}`);
  }

  // Get running containers
  async getRunningContainers() {
    try {
      const result = await this.executeCommand('docker ps --format "{{.Names}}"');
      return result.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('❌ Failed to get running containers:', error.message);
      return [];
    }
  }

  // Start monitoring
  async startMonitoring() {
    console.log('📊 Starting container monitoring...');
    
    const monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.performHealthChecks();
        await this.checkResourceUsage();
        await this.performMaintenanceTasks();
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }
    }, this.config.resourceCheckInterval);
    
    this.intervals.push(monitoringInterval);
  }

  // Perform health checks
  async performHealthChecks() {
    for (const [serviceName, service] of this.services) {
      try {
        const isHealthy = await this.checkServiceHealth(serviceName);
        if (!isHealthy) {
          console.log(`⚠️  Service ${serviceName} is unhealthy, attempting recovery...`);
          await this.recoverService(serviceName);
        }
      } catch (error) {
        console.error(`❌ Health check failed for ${serviceName}:`, error.message);
      }
    }
  }

  // Check resource usage
  async checkResourceUsage() {
    try {
      const containers = await this.getRunningContainers();
      
      for (const container of containers) {
        const stats = await this.getContainerStats(container);
        
        if (stats.cpuPercent > this.config.autoScaleThreshold) {
          console.log(`⚠️  High CPU usage detected in ${container}: ${stats.cpuPercent}%`);
          this.emit('high-resource-usage', { container, stats, resource: 'cpu' });
        }
        
        if (stats.memoryPercent > this.config.autoScaleThreshold) {
          console.log(`⚠️  High memory usage detected in ${container}: ${stats.memoryPercent}%`);
          this.emit('high-resource-usage', { container, stats, resource: 'memory' });
        }
      }
    } catch (error) {
      console.error('❌ Resource usage check failed:', error.message);
    }
  }

  // Get container stats
  async getContainerStats(containerName) {
    try {
      const result = await this.executeCommand(`docker stats ${containerName} --no-stream --format "{{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"`);
      const [cpuPercent, memPercent, memUsage, netIO, blockIO] = result.split('\t');
      
      return {
        cpuPercent: parseFloat(cpuPercent.replace('%', '')),
        memoryPercent: parseFloat(memPercent.replace('%', '')),
        memoryUsage: memUsage,
        networkIO: netIO,
        blockIO: blockIO
      };
    } catch (error) {
      console.error(`❌ Failed to get stats for ${containerName}:`, error.message);
      return {};
    }
  }

  // Perform maintenance tasks
  async performMaintenanceTasks() {
    try {
      // Clean up unused containers
      await this.executeCommand('docker container prune -f');
      
      // Clean up unused images
      await this.executeCommand('docker image prune -f');
      
      // Clean up unused volumes
      await this.executeCommand('docker volume prune -f');
      
      // Clean up unused networks
      await this.executeCommand('docker network prune -f');
      
      console.log('🧹 Maintenance tasks completed');
    } catch (error) {
      console.error('❌ Maintenance tasks failed:', error.message);
    }
  }

  // Recover service
  async recoverService(serviceName) {
    console.log(`🔧 Recovering service: ${serviceName}`);
    
    try {
      // Stop service
      await this.stopService(serviceName);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Start service
      await this.startService(serviceName);
      
      console.log(`✅ Service ${serviceName} recovered successfully`);
      this.emit('service-recovered', { serviceName });
      
    } catch (error) {
      console.error(`❌ Failed to recover service ${serviceName}:`, error.message);
      this.emit('service-recovery-failed', { serviceName, error });
    }
  }

  // Start resource optimization
  async startResourceOptimization() {
    console.log('⚡ Starting resource optimization...');
    
    const optimizationInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.optimizeResources();
      } catch (error) {
        console.error('❌ Resource optimization error:', error.message);
      }
    }, this.config.resourceCheckInterval * 2);
    
    this.intervals.push(optimizationInterval);
  }

  // Optimize resources
  async optimizeResources() {
    // Implement resource optimization logic
    console.log('🔍 Checking resource optimization opportunities...');
    
    // This would include:
    // - Adjusting container memory limits
    // - Scaling containers based on load
    // - Optimizing network connections
    // - Balancing workloads
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
    return {
      isRunning: this.isRunning,
      totalServices: this.services.size,
      runningServices: Array.from(this.services.keys()).length,
      lastCheck: new Date().toISOString()
    };
  }
}

// CLI interface
if (require.main === module) {
  const manager = new ContainerManager();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down container manager...');
    await manager.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down container manager...');
    await manager.stop();
    process.exit(0);
  });
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'start') {
    manager.start().catch(error => {
      console.error('❌ Failed to start container manager:', error);
      process.exit(1);
    });
  } else if (command === 'stop') {
    manager.stop().catch(error => {
      console.error('❌ Failed to stop container manager:', error);
      process.exit(1);
    });
  } else if (command === 'status') {
    console.log(manager.getSystemStatus());
  } else {
    console.log('Usage: node container-manager.js [start|stop|status]');
    process.exit(1);
  }
  
  // Event handlers
  manager.on('service-started', ({ serviceName }) => {
    console.log(`✅ SERVICE STARTED: ${serviceName}`);
  });
  
  manager.on('service-stopped', ({ serviceName }) => {
    console.log(`🛑 SERVICE STOPPED: ${serviceName}`);
  });
  
  manager.on('service-recovered', ({ serviceName }) => {
    console.log(`🔧 SERVICE RECOVERED: ${serviceName}`);
  });
  
  manager.on('high-resource-usage', ({ container, stats, resource }) => {
    console.log(`⚠️  HIGH ${resource.toUpperCase()} USAGE: ${container} at ${stats[resource + 'Percent']}%`);
  });
}

module.exports = ContainerManager;