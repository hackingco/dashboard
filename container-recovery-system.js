#!/usr/bin/env node

/**
 * Container Recovery System
 * Intelligent container recovery and self-healing system
 * 
 * Features:
 * - Automated failure detection
 * - Intelligent recovery strategies
 * - Rollback capabilities
 * - Health-based recovery decisions
 * - Dependency-aware recovery
 * - Circuit breaker pattern
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class ContainerRecoverySystem extends EventEmitter {
  constructor() {
    super();
    this.containers = new Map();
    this.recoveryStrategies = new Map();
    this.failureHistory = new Map();
    this.circuitBreakers = new Map();
    this.config = {
      maxRecoveryAttempts: 5,
      recoveryBackoffMs: 5000,
      healthCheckInterval: 15000,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 300000, // 5 minutes
      dependencyTimeout: 60000,
      logRetentionDays: 7
    };
    this.isRunning = false;
    this.intervals = [];
    this.initializeRecoveryStrategies();
  }

  // Initialize recovery strategies
  initializeRecoveryStrategies() {
    // Langfuse server recovery
    this.recoveryStrategies.set('cf-langfuse-server', {
      name: 'cf-langfuse-server',
      priority: 'critical',
      strategies: [
        {
          name: 'restart-container',
          description: 'Simple container restart',
          command: 'docker restart cf-langfuse-server',
          timeout: 30000,
          successCondition: 'container-running',
          failureCondition: 'container-failed'
        },
        {
          name: 'recreate-container',
          description: 'Recreate container from image',
          command: 'docker-compose -f docker-compose.langfuse-v3-working.yml up -d --force-recreate langfuse',
          timeout: 60000,
          successCondition: 'service-healthy',
          failureCondition: 'service-failed'
        },
        {
          name: 'rebuild-and-restart',
          description: 'Rebuild image and restart service',
          command: 'docker-compose -f docker-compose.langfuse-v3-working.yml build langfuse && docker-compose -f docker-compose.langfuse-v3-working.yml up -d langfuse',
          timeout: 180000,
          successCondition: 'service-healthy',
          failureCondition: 'service-failed'
        }
      ],
      dependencies: ['cf-langfuse-db', 'cf-clickhouse'],
      healthCheck: {
        endpoint: 'http://localhost:3000/api/public/health',
        timeout: 10000,
        retries: 3
      },
      rollbackStrategy: 'previous-version'
    });

    // Langfuse worker recovery
    this.recoveryStrategies.set('langfuse-worker-built', {
      name: 'langfuse-worker-built',
      priority: 'high',
      strategies: [
        {
          name: 'restart-container',
          description: 'Simple container restart',
          command: 'docker restart langfuse-worker-built',
          timeout: 30000,
          successCondition: 'container-running',
          failureCondition: 'container-failed'
        },
        {
          name: 'clear-queue-and-restart',
          description: 'Clear Redis queue and restart worker',
          command: 'docker exec cf-analysis-redis redis-cli FLUSHALL && docker restart langfuse-worker-built',
          timeout: 45000,
          successCondition: 'service-healthy',
          failureCondition: 'service-failed'
        },
        {
          name: 'recreate-worker',
          description: 'Recreate worker container',
          command: 'docker-compose -f docker-compose.langfuse-v3-working.yml up -d --force-recreate langfuse-worker-built',
          timeout: 60000,
          successCondition: 'service-healthy',
          failureCondition: 'service-failed'
        }
      ],
      dependencies: ['cf-langfuse-db', 'cf-clickhouse', 'cf-analysis-redis'],
      healthCheck: {
        endpoint: 'http://localhost:3030/health',
        timeout: 10000,
        retries: 3
      },
      rollbackStrategy: 'previous-version'
    });

    // Database recovery
    this.recoveryStrategies.set('cf-langfuse-db', {
      name: 'cf-langfuse-db',
      priority: 'critical',
      strategies: [
        {
          name: 'restart-database',
          description: 'Restart PostgreSQL container',
          command: 'docker restart cf-langfuse-db',
          timeout: 30000,
          successCondition: 'database-ready',
          failureCondition: 'database-failed'
        },
        {
          name: 'repair-database',
          description: 'Run database repair and restart',
          command: 'docker exec cf-langfuse-db pg_ctl restart -D /var/lib/postgresql/data',
          timeout: 60000,
          successCondition: 'database-ready',
          failureCondition: 'database-failed'
        },
        {
          name: 'recreate-database',
          description: 'Recreate database container (data preserved)',
          command: 'docker-compose -f docker-compose.langfuse-v3-working.yml up -d --force-recreate postgres',
          timeout: 120000,
          successCondition: 'database-ready',
          failureCondition: 'database-failed'
        }
      ],
      dependencies: [],
      healthCheck: {
        command: 'docker exec cf-langfuse-db pg_isready -U postgres',
        timeout: 10000,
        retries: 5
      },
      rollbackStrategy: 'backup-restore'
    });

    // ClickHouse recovery
    this.recoveryStrategies.set('cf-clickhouse', {
      name: 'cf-clickhouse',
      priority: 'high',
      strategies: [
        {
          name: 'restart-clickhouse',
          description: 'Restart ClickHouse container',
          command: 'docker restart cf-clickhouse',
          timeout: 30000,
          successCondition: 'clickhouse-ready',
          failureCondition: 'clickhouse-failed'
        },
        {
          name: 'clear-cache-and-restart',
          description: 'Clear ClickHouse cache and restart',
          command: 'docker exec cf-clickhouse clickhouse-client --query "SYSTEM DROP DNS CACHE" && docker restart cf-clickhouse',
          timeout: 45000,
          successCondition: 'clickhouse-ready',
          failureCondition: 'clickhouse-failed'
        },
        {
          name: 'recreate-clickhouse',
          description: 'Recreate ClickHouse container',
          command: 'docker-compose -f docker-compose.langfuse-v3-working.yml up -d --force-recreate clickhouse',
          timeout: 90000,
          successCondition: 'clickhouse-ready',
          failureCondition: 'clickhouse-failed'
        }
      ],
      dependencies: [],
      healthCheck: {
        command: 'docker exec cf-clickhouse wget -q --spider http://localhost:8123/ping',
        timeout: 10000,
        retries: 3
      },
      rollbackStrategy: 'backup-restore'
    });

    // Analysis app recovery
    this.recoveryStrategies.set('cf-analysis-app', {
      name: 'cf-analysis-app',
      priority: 'medium',
      strategies: [
        {
          name: 'restart-app',
          description: 'Restart analysis app container',
          command: 'docker restart cf-analysis-app',
          timeout: 30000,
          successCondition: 'service-healthy',
          failureCondition: 'service-failed'
        },
        {
          name: 'recreate-app',
          description: 'Recreate analysis app container',
          command: 'docker-compose up -d --force-recreate cf-analysis-app',
          timeout: 60000,
          successCondition: 'service-healthy',
          failureCondition: 'service-failed'
        }
      ],
      dependencies: ['cf-analysis-postgres', 'cf-analysis-redis'],
      healthCheck: {
        endpoint: 'http://localhost:3001/health',
        timeout: 10000,
        retries: 3
      },
      rollbackStrategy: 'previous-version'
    });

    // Initialize circuit breakers
    this.initializeCircuitBreakers();
  }

  // Initialize circuit breakers
  initializeCircuitBreakers() {
    for (const [containerName, strategy] of this.recoveryStrategies) {
      this.circuitBreakers.set(containerName, {
        name: containerName,
        state: 'closed', // closed, open, half-open
        failureCount: 0,
        lastFailureTime: null,
        nextRetryTime: null,
        successCount: 0
      });
    }
  }

  // Start recovery system
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Recovery system is already running');
      return;
    }

    console.log('🚀 Starting Container Recovery System...');
    this.isRunning = true;

    // Start health monitoring
    await this.startHealthMonitoring();

    // Start recovery monitoring
    await this.startRecoveryMonitoring();

    // Initialize failure history
    await this.initializeFailureHistory();

    console.log('✅ Container Recovery System started');
    this.emit('recovery-system-started');
  }

  // Stop recovery system
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Container Recovery System...');
    this.isRunning = false;

    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Save failure history
    await this.saveFailureHistory();

    console.log('✅ Container Recovery System stopped');
    this.emit('recovery-system-stopped');
  }

  // Start health monitoring
  async startHealthMonitoring() {
    const healthInterval = setInterval(async () => {
      if (!this.isRunning) return;

      for (const [containerName, strategy] of this.recoveryStrategies) {
        try {
          const isHealthy = await this.checkContainerHealth(containerName);
          
          if (!isHealthy) {
            console.log(`⚠️  Container ${containerName} is unhealthy`);
            await this.triggerRecovery(containerName, 'health-check-failed');
          } else {
            // Reset circuit breaker on success
            this.updateCircuitBreaker(containerName, 'success');
          }
        } catch (error) {
          console.error(`❌ Health check error for ${containerName}:`, error.message);
          await this.triggerRecovery(containerName, 'health-check-error');
        }
      }
    }, this.config.healthCheckInterval);

    this.intervals.push(healthInterval);
  }

  // Start recovery monitoring
  async startRecoveryMonitoring() {
    const monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;

      // Check circuit breaker states
      for (const [containerName, circuitBreaker] of this.circuitBreakers) {
        if (circuitBreaker.state === 'open' && circuitBreaker.nextRetryTime) {
          if (Date.now() >= circuitBreaker.nextRetryTime) {
            console.log(`🔄 Circuit breaker for ${containerName} transitioning to half-open`);
            circuitBreaker.state = 'half-open';
            circuitBreaker.nextRetryTime = null;
          }
        }
      }
    }, 30000); // Check every 30 seconds

    this.intervals.push(monitoringInterval);
  }

  // Check container health
  async checkContainerHealth(containerName) {
    const strategy = this.recoveryStrategies.get(containerName);
    if (!strategy) return false;

    try {
      // Check if container is running
      const isRunning = await this.isContainerRunning(containerName);
      if (!isRunning) return false;

      // Check health endpoint or command
      if (strategy.healthCheck.endpoint) {
        return await this.checkHttpHealth(strategy.healthCheck.endpoint);
      } else if (strategy.healthCheck.command) {
        return await this.checkCommandHealth(strategy.healthCheck.command);
      }

      return true;
    } catch (error) {
      console.error(`❌ Health check failed for ${containerName}:`, error.message);
      return false;
    }
  }

  // Check if container is running
  async isContainerRunning(containerName) {
    try {
      const result = await this.executeCommand(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`);
      return result.trim() === containerName;
    } catch (error) {
      return false;
    }
  }

  // Check HTTP health
  async checkHttpHealth(url) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Check command health
  async checkCommandHealth(command) {
    try {
      const result = await this.executeCommand(command);
      return result.length > 0 && !result.includes('error');
    } catch (error) {
      return false;
    }
  }

  // Trigger recovery
  async triggerRecovery(containerName, reason) {
    const circuitBreaker = this.circuitBreakers.get(containerName);
    
    // Check circuit breaker state
    if (circuitBreaker.state === 'open') {
      console.log(`🔒 Circuit breaker for ${containerName} is open, skipping recovery`);
      return;
    }

    const strategy = this.recoveryStrategies.get(containerName);
    if (!strategy) {
      console.error(`❌ No recovery strategy found for ${containerName}`);
      return;
    }

    console.log(`🔧 Triggering recovery for ${containerName} (reason: ${reason})`);
    
    // Record failure
    this.recordFailure(containerName, reason);

    // Check dependencies first
    if (strategy.dependencies.length > 0) {
      const dependenciesHealthy = await this.checkDependenciesHealth(strategy.dependencies);
      if (!dependenciesHealthy) {
        console.log(`⚠️  Dependencies for ${containerName} are unhealthy, attempting dependency recovery first`);
        await this.recoverDependencies(strategy.dependencies);
      }
    }

    // Try recovery strategies in order
    for (const [index, recoveryStrategy] of strategy.strategies.entries()) {
      try {
        console.log(`🔄 Attempting recovery strategy ${index + 1}/${strategy.strategies.length}: ${recoveryStrategy.name}`);
        
        const success = await this.executeRecoveryStrategy(containerName, recoveryStrategy);
        
        if (success) {
          console.log(`✅ Recovery successful for ${containerName} using strategy: ${recoveryStrategy.name}`);
          this.updateCircuitBreaker(containerName, 'success');
          this.emit('recovery-success', { containerName, strategy: recoveryStrategy.name, reason });
          return;
        } else {
          console.log(`❌ Recovery strategy ${recoveryStrategy.name} failed for ${containerName}`);
        }
      } catch (error) {
        console.error(`❌ Recovery strategy ${recoveryStrategy.name} error for ${containerName}:`, error.message);
      }
    }

    // All strategies failed
    console.log(`❌ All recovery strategies failed for ${containerName}`);
    this.updateCircuitBreaker(containerName, 'failure');
    this.emit('recovery-failed', { containerName, reason });
  }

  // Execute recovery strategy
  async executeRecoveryStrategy(containerName, strategy) {
    try {
      console.log(`🔧 Executing: ${strategy.command}`);
      
      const result = await this.executeCommand(strategy.command, strategy.timeout);
      
      // Wait for container to stabilize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check success condition
      const success = await this.checkSuccessCondition(containerName, strategy.successCondition);
      
      if (success) {
        console.log(`✅ Recovery strategy ${strategy.name} succeeded for ${containerName}`);
        return true;
      } else {
        console.log(`❌ Recovery strategy ${strategy.name} failed success condition for ${containerName}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Recovery strategy ${strategy.name} execution failed for ${containerName}:`, error.message);
      return false;
    }
  }

  // Check success condition
  async checkSuccessCondition(containerName, condition) {
    switch (condition) {
      case 'container-running':
        return await this.isContainerRunning(containerName);
      
      case 'service-healthy':
        return await this.checkContainerHealth(containerName);
      
      case 'database-ready':
        return await this.checkDatabaseReady(containerName);
      
      case 'clickhouse-ready':
        return await this.checkClickHouseReady(containerName);
      
      default:
        return false;
    }
  }

  // Check database ready
  async checkDatabaseReady(containerName) {
    try {
      const result = await this.executeCommand(`docker exec ${containerName} pg_isready -U postgres`);
      return result.includes('accepting connections');
    } catch (error) {
      return false;
    }
  }

  // Check ClickHouse ready
  async checkClickHouseReady(containerName) {
    try {
      const result = await this.executeCommand(`docker exec ${containerName} wget -q --spider http://localhost:8123/ping`);
      return result === '';
    } catch (error) {
      return false;
    }
  }

  // Check dependencies health
  async checkDependenciesHealth(dependencies) {
    for (const dep of dependencies) {
      const isHealthy = await this.checkContainerHealth(dep);
      if (!isHealthy) {
        return false;
      }
    }
    return true;
  }

  // Recover dependencies
  async recoverDependencies(dependencies) {
    for (const dep of dependencies) {
      const isHealthy = await this.checkContainerHealth(dep);
      if (!isHealthy) {
        console.log(`🔧 Recovering dependency: ${dep}`);
        await this.triggerRecovery(dep, 'dependency-failure');
      }
    }
  }

  // Update circuit breaker
  updateCircuitBreaker(containerName, result) {
    const circuitBreaker = this.circuitBreakers.get(containerName);
    if (!circuitBreaker) return;

    if (result === 'success') {
      circuitBreaker.successCount++;
      circuitBreaker.failureCount = 0;
      
      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
        console.log(`✅ Circuit breaker for ${containerName} closed`);
      }
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = Date.now();
      
      if (circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
        circuitBreaker.state = 'open';
        circuitBreaker.nextRetryTime = Date.now() + this.config.circuitBreakerTimeout;
        console.log(`🔒 Circuit breaker for ${containerName} opened`);
      }
    }

    this.circuitBreakers.set(containerName, circuitBreaker);
  }

  // Record failure
  recordFailure(containerName, reason) {
    if (!this.failureHistory.has(containerName)) {
      this.failureHistory.set(containerName, []);
    }

    const failures = this.failureHistory.get(containerName);
    failures.push({
      timestamp: new Date().toISOString(),
      reason: reason,
      containerName: containerName
    });

    // Keep only recent failures
    const cutoff = Date.now() - (this.config.logRetentionDays * 24 * 60 * 60 * 1000);
    const recentFailures = failures.filter(f => new Date(f.timestamp).getTime() > cutoff);
    
    this.failureHistory.set(containerName, recentFailures);
  }

  // Initialize failure history
  async initializeFailureHistory() {
    try {
      const historyFile = './container-recovery-history.json';
      const exists = await fs.access(historyFile).then(() => true).catch(() => false);
      
      if (exists) {
        const data = await fs.readFile(historyFile, 'utf8');
        const history = JSON.parse(data);
        
        for (const [containerName, failures] of Object.entries(history)) {
          this.failureHistory.set(containerName, failures);
        }
        
        console.log('📊 Failure history loaded');
      }
    } catch (error) {
      console.error('❌ Failed to load failure history:', error.message);
    }
  }

  // Save failure history
  async saveFailureHistory() {
    try {
      const historyFile = './container-recovery-history.json';
      const history = Object.fromEntries(this.failureHistory);
      
      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
      console.log('💾 Failure history saved');
    } catch (error) {
      console.error('❌ Failed to save failure history:', error.message);
    }
  }

  // Execute command with timeout
  async executeCommand(command, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, timeout);

      exec(command, (error, stdout, stderr) => {
        clearTimeout(timer);
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  // Get recovery status
  getRecoveryStatus() {
    const status = {
      isRunning: this.isRunning,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      failureHistory: Object.fromEntries(this.failureHistory),
      totalFailures: Array.from(this.failureHistory.values()).reduce((sum, failures) => sum + failures.length, 0),
      lastUpdate: new Date().toISOString()
    };

    return status;
  }
}

// CLI interface
if (require.main === module) {
  const recovery = new ContainerRecoverySystem();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down recovery system...');
    await recovery.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down recovery system...');
    await recovery.stop();
    process.exit(0);
  });
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'start') {
    recovery.start().catch(error => {
      console.error('❌ Failed to start recovery system:', error);
      process.exit(1);
    });
  } else if (command === 'recover' && args[1]) {
    const containerName = args[1];
    const reason = args[2] || 'manual-trigger';
    
    recovery.triggerRecovery(containerName, reason)
      .then(() => {
        console.log(`✅ Recovery completed for ${containerName}`);
        process.exit(0);
      })
      .catch(error => {
        console.error(`❌ Recovery failed for ${containerName}:`, error);
        process.exit(1);
      });
  } else if (command === 'status') {
    const status = recovery.getRecoveryStatus();
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log('Usage:');
    console.log('  node container-recovery-system.js start');
    console.log('  node container-recovery-system.js recover <container-name> [reason]');
    console.log('  node container-recovery-system.js status');
    process.exit(1);
  }
  
  // Event handlers
  recovery.on('recovery-success', ({ containerName, strategy, reason }) => {
    console.log(`✅ RECOVERY SUCCESS: ${containerName} using ${strategy} (${reason})`);
  });
  
  recovery.on('recovery-failed', ({ containerName, reason }) => {
    console.log(`❌ RECOVERY FAILED: ${containerName} (${reason})`);
  });
}

module.exports = ContainerRecoverySystem;