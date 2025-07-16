#!/usr/bin/env node

/**
 * Container Orchestrator
 * Master container management and orchestration system
 * 
 * Features:
 * - Unified container management
 * - Health monitoring integration
 * - Automated recovery coordination
 * - Metrics dashboard integration
 * - Dependency management
 * - Service mesh coordination
 */

const ContainerManager = require('./container-manager');
const ContainerHealthMonitor = require('./container-health-monitor');
const ContainerRecoverySystem = require('./container-recovery-system');
const ContainerMetricsDashboard = require('./container-metrics-dashboard');
const ServiceDependencyChecker = require('./service-dependency-checker');
const { exec } = require('child_process');
const fs = require('fs').promises;

class ContainerOrchestrator {
  constructor() {
    this.manager = new ContainerManager();
    this.healthMonitor = new ContainerHealthMonitor();
    this.recoverySystem = new ContainerRecoverySystem();
    this.metricsDashboard = new ContainerMetricsDashboard();
    this.dependencyChecker = new ServiceDependencyChecker();
    this.isRunning = false;
    this.config = {
      startupTimeout: 120000,
      healthCheckDelay: 30000,
      recoveryDelay: 60000,
      dashboardDelay: 10000
    };
  }

  // Start orchestration
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Container orchestrator is already running');
      return;
    }

    console.log('🚀 Starting Container Orchestrator...');
    console.log('=====================================');
    this.isRunning = true;

    try {
      // Phase 1: Initialize and start container manager
      console.log('\n📋 Phase 1: Container Management');
      console.log('Starting container manager...');
      await this.manager.start();
      
      // Wait for containers to stabilize
      console.log('⏳ Waiting for containers to stabilize...');
      await new Promise(resolve => setTimeout(resolve, this.config.healthCheckDelay));

      // Phase 2: Check dependencies
      console.log('\n📋 Phase 2: Dependency Validation');
      console.log('Checking service dependencies...');
      const dependencyResults = await this.dependencyChecker.checkAllDependencies();
      
      if (dependencyResults.overall === 'critical') {
        console.log('❌ Critical dependency failures detected');
        console.log('🔧 Attempting to resolve dependencies...');
        
        // Attempt to resolve critical dependencies
        await this.resolveCriticalDependencies();
        
        // Re-check dependencies
        const recheck = await this.dependencyChecker.checkAllDependencies();
        if (recheck.overall === 'critical') {
          throw new Error('Unable to resolve critical dependencies');
        }
      }

      // Phase 3: Start health monitoring
      console.log('\n📋 Phase 3: Health Monitoring');
      console.log('Starting health monitor...');
      await this.healthMonitor.start();

      // Phase 4: Start recovery system
      console.log('\n📋 Phase 4: Recovery System');
      console.log('Starting recovery system...');
      await this.recoverySystem.start();

      // Phase 5: Start metrics dashboard
      console.log('\n📋 Phase 5: Metrics Dashboard');
      console.log('Starting metrics dashboard...');
      await this.metricsDashboard.start();

      // Phase 6: Final health check
      console.log('\n📋 Phase 6: Final Validation');
      await this.performFinalHealthCheck();

      // Setup event handlers
      this.setupEventHandlers();

      console.log('\n✅ Container Orchestrator started successfully!');
      console.log('=====================================');
      console.log('🌐 Dashboard: http://localhost:9998');
      console.log('🔍 Health Monitor: http://localhost:9999/dashboard');
      console.log('📊 Metrics API: http://localhost:9998/api/metrics');
      console.log('🚨 Alerts API: http://localhost:9998/api/alerts');
      console.log('=====================================');

    } catch (error) {
      console.error('❌ Container Orchestrator startup failed:', error.message);
      await this.stop();
      throw error;
    }
  }

  // Stop orchestration
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Container Orchestrator...');
    this.isRunning = false;

    try {
      // Stop components in reverse order
      console.log('🛑 Stopping metrics dashboard...');
      await this.metricsDashboard.stop();

      console.log('🛑 Stopping recovery system...');
      await this.recoverySystem.stop();

      console.log('🛑 Stopping health monitor...');
      await this.healthMonitor.stop();

      console.log('🛑 Stopping container manager...');
      await this.manager.stop();

      console.log('✅ Container Orchestrator stopped');
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
    }
  }

  // Resolve critical dependencies
  async resolveCriticalDependencies() {
    console.log('🔧 Resolving critical dependencies...');
    
    // Try to start essential services
    const essentialServices = [
      'cf-langfuse-db',
      'cf-clickhouse', 
      'cf-analysis-postgres',
      'cf-analysis-redis'
    ];

    for (const service of essentialServices) {
      try {
        console.log(`🔄 Attempting to start ${service}...`);
        await this.executeCommand(`docker start ${service}`);
        
        // Wait for service to be ready
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log(`✅ ${service} started successfully`);
      } catch (error) {
        console.log(`⚠️  Failed to start ${service}: ${error.message}`);
      }
    }
  }

  // Perform final health check
  async performFinalHealthCheck() {
    console.log('🔍 Performing final health check...');
    
    const healthResults = await this.healthMonitor.getSystemStatus();
    const recoveryStatus = this.recoverySystem.getRecoveryStatus();
    
    console.log(`📊 System Health: ${healthResults.healthPercentage}% (${healthResults.healthyContainers}/${healthResults.totalContainers})`);
    console.log(`🔧 Recovery System: ${recoveryStatus.isRunning ? 'Active' : 'Inactive'}`);
    console.log(`📈 Metrics Dashboard: Running on port 9998`);
    
    if (healthResults.healthPercentage < 80) {
      console.log('⚠️  System health is below optimal threshold');
      console.log('🔧 Consider investigating unhealthy containers');
    }
  }

  // Setup event handlers
  setupEventHandlers() {
    // Health monitor events
    this.healthMonitor.on('container-unhealthy', ({ name, container }) => {
      console.log(`⚠️  HEALTH ALERT: ${name} is unhealthy`);
    });

    this.healthMonitor.on('container-recovered', ({ name, container }) => {
      console.log(`✅ HEALTH RECOVERY: ${name} is now healthy`);
    });

    // Recovery system events
    this.recoverySystem.on('recovery-success', ({ containerName, strategy, reason }) => {
      console.log(`✅ RECOVERY SUCCESS: ${containerName} recovered using ${strategy} (${reason})`);
    });

    this.recoverySystem.on('recovery-failed', ({ containerName, reason }) => {
      console.log(`❌ RECOVERY FAILURE: ${containerName} recovery failed (${reason})`);
    });

    // Container manager events
    this.manager.on('service-started', ({ serviceName }) => {
      console.log(`🚀 SERVICE STARTED: ${serviceName}`);
    });

    this.manager.on('service-stopped', ({ serviceName }) => {
      console.log(`🛑 SERVICE STOPPED: ${serviceName}`);
    });

    this.manager.on('high-resource-usage', ({ container, stats, resource }) => {
      console.log(`⚠️  HIGH RESOURCE USAGE: ${container} ${resource} at ${stats[resource + 'Percent']}%`);
    });
  }

  // Get orchestrator status
  getStatus() {
    return {
      isRunning: this.isRunning,
      components: {
        manager: this.manager.getSystemStatus(),
        healthMonitor: this.healthMonitor.getSystemStatus(),
        recoverySystem: this.recoverySystem.getRecoveryStatus(),
        dashboard: { running: this.metricsDashboard.isRunning }
      },
      timestamp: new Date().toISOString()
    };
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

  // Restart all containers
  async restartAllContainers() {
    console.log('🔄 Restarting all containers...');
    
    const containers = [
      'cf-langfuse-server',
      'langfuse-worker-built',
      'cf-langfuse-db',
      'cf-clickhouse',
      'cf-analysis-app',
      'cf-analysis-postgres',
      'cf-analysis-redis'
    ];

    for (const container of containers) {
      try {
        console.log(`🔄 Restarting ${container}...`);
        await this.executeCommand(`docker restart ${container}`);
        
        // Wait between restarts
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log(`✅ ${container} restarted`);
      } catch (error) {
        console.log(`❌ Failed to restart ${container}: ${error.message}`);
      }
    }
  }

  // Check system requirements
  async checkSystemRequirements() {
    console.log('🔍 Checking system requirements...');
    
    try {
      // Check Docker
      await this.executeCommand('docker --version');
      console.log('✅ Docker is available');

      // Check Docker Compose
      await this.executeCommand('docker-compose --version');
      console.log('✅ Docker Compose is available');

      // Check available disk space
      const diskSpace = await this.executeCommand('df -h .');
      console.log(`💾 Disk space: ${diskSpace.split('\n')[1]}`);

      // Check memory
      const memory = await this.executeCommand('free -h');
      console.log(`🧠 Memory: ${memory.split('\n')[1]}`);

      return true;
    } catch (error) {
      console.error('❌ System requirements check failed:', error.message);
      return false;
    }
  }

  // Generate system report
  async generateSystemReport() {
    console.log('📊 Generating system report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      orchestrator: this.getStatus(),
      dependencies: await this.dependencyChecker.checkAllDependencies(),
      containers: await this.getContainerStatuses(),
      systemInfo: await this.getSystemInfo()
    };

    // Save report
    const filename = `system-report-${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    
    console.log(`📊 System report saved to ${filename}`);
    return report;
  }

  // Get container statuses
  async getContainerStatuses() {
    try {
      const result = await this.executeCommand('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
      return result;
    } catch (error) {
      return 'Error getting container statuses';
    }
  }

  // Get system info
  async getSystemInfo() {
    try {
      const dockerInfo = await this.executeCommand('docker info');
      return {
        docker: dockerInfo,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

// CLI interface
if (require.main === module) {
  const orchestrator = new ContainerOrchestrator();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down orchestrator...');
    await orchestrator.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down orchestrator...');
    await orchestrator.stop();
    process.exit(0);
  });
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'start') {
    orchestrator.start().catch(error => {
      console.error('❌ Failed to start orchestrator:', error);
      process.exit(1);
    });
  } else if (command === 'stop') {
    orchestrator.stop().catch(error => {
      console.error('❌ Failed to stop orchestrator:', error);
      process.exit(1);
    });
  } else if (command === 'status') {
    console.log(JSON.stringify(orchestrator.getStatus(), null, 2));
    process.exit(0);
  } else if (command === 'restart') {
    orchestrator.restartAllContainers().then(() => {
      console.log('✅ All containers restarted');
      process.exit(0);
    }).catch(error => {
      console.error('❌ Failed to restart containers:', error);
      process.exit(1);
    });
  } else if (command === 'report') {
    orchestrator.generateSystemReport().then(() => {
      console.log('✅ System report generated');
      process.exit(0);
    }).catch(error => {
      console.error('❌ Failed to generate report:', error);
      process.exit(1);
    });
  } else if (command === 'check') {
    orchestrator.checkSystemRequirements().then(success => {
      if (success) {
        console.log('✅ System requirements satisfied');
        process.exit(0);
      } else {
        console.log('❌ System requirements not satisfied');
        process.exit(1);
      }
    });
  } else {
    console.log('Container Orchestrator - Master container management system');
    console.log('');
    console.log('Usage:');
    console.log('  node container-orchestrator.js start    - Start orchestration');
    console.log('  node container-orchestrator.js stop     - Stop orchestration');
    console.log('  node container-orchestrator.js status   - Show status');
    console.log('  node container-orchestrator.js restart  - Restart all containers');
    console.log('  node container-orchestrator.js report   - Generate system report');
    console.log('  node container-orchestrator.js check    - Check system requirements');
    console.log('');
    console.log('Dashboard URLs:');
    console.log('  http://localhost:9998 - Metrics Dashboard');
    console.log('  http://localhost:9999/dashboard - Health Monitor');
    process.exit(1);
  }
}

module.exports = ContainerOrchestrator;