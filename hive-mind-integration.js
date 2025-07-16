#!/usr/bin/env node

/**
 * Hive Mind Swarm Integration Script
 * Integrates the Langfuse logger with the existing swarm system
 */

const { createHiveMindLogger } = require('./hive-mind-langfuse-logger');
const fs = require('fs');
const path = require('path');

class HiveMindIntegration {
  constructor() {
    this.logger = null;
    this.swarmId = 'swarm_1752502984551_ne7n7cr24';
    this.sessionId = 'hive-mind-collective-1752503124';
    this.isInitialized = false;
    this.integrationStatus = {
      langfuseConnected: false,
      swarmRegistered: false,
      metricsActive: false,
      errorTrackingActive: false
    };
  }
  
  async initialize() {
    console.log('🔄 Initializing Hive Mind Integration...');
    
    try {
      // Create the logger
      this.logger = createHiveMindLogger();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize swarm logging
      await this.logger.initializeSwarmLogging();
      
      // Register with swarm system
      await this.registerWithSwarm();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      this.integrationStatus.langfuseConnected = true;
      this.integrationStatus.swarmRegistered = true;
      this.integrationStatus.metricsActive = true;
      this.integrationStatus.errorTrackingActive = true;
      
      console.log('✅ Hive Mind Integration initialized successfully');
      console.log('📊 Integration Status:', this.integrationStatus);
      
      return this.integrationStatus;
      
    } catch (error) {
      console.error('❌ Failed to initialize Hive Mind Integration:', error);
      await this.logger?.logError(null, error, 'integration_initialization');
      throw error;
    }
  }
  
  setupEventListeners() {
    if (!this.logger) return;
    
    // Log all major events
    this.logger.on('swarm_initialized', (data) => {
      console.log('🐝 Swarm initialized:', data.swarmId);
    });
    
    this.logger.on('agent_spawned', (data) => {
      console.log(`🤖 Agent spawned: ${data.agentName} (${data.agentType})`);
    });
    
    this.logger.on('task_assigned', (data) => {
      console.log(`📋 Task assigned to ${data.agentId}: ${data.taskDescription}`);
    });
    
    this.logger.on('task_completed', (data) => {
      console.log(`✅ Task completed by ${data.agentId}: ${data.taskId} (${data.duration}ms)`);
    });
    
    this.logger.on('swarm_coordination', (data) => {
      console.log(`🤝 Swarm coordination: ${data.event} (${data.participants.length} participants)`);
    });
    
    this.logger.on('error_logged', (data) => {
      console.log(`❌ Error logged: ${data.error} (${data.context})`);
    });
    
    this.logger.on('metrics_updated', (data) => {
      // Only log metrics updates every 5th update to avoid spam
      if (Math.random() < 0.2) {
        console.log('📊 Metrics updated - Active agents:', data.metrics.activeAgents);
      }
    });
  }
  
  async registerWithSwarm() {
    console.log('📝 Registering with swarm system...');
    
    try {
      // Check if swarm memory exists
      const swarmMemoryPath = path.join(__dirname, '.swarm', 'memory.db');
      if (fs.existsSync(swarmMemoryPath)) {
        console.log('✅ Swarm memory database found');
      } else {
        console.log('⚠️ Swarm memory database not found, creating directory');
        fs.mkdirSync(path.dirname(swarmMemoryPath), { recursive: true });
      }
      
      // Register swarm coordination
      await this.logger.logSwarmCoordination('integration_registration', [], {
        integrationType: 'hive-mind-langfuse',
        registrationTime: new Date().toISOString(),
        swarmMemoryPath,
        integrationVersion: '1.0.0',
        features: {
          realTimeLogging: true,
          metricsCollection: true,
          errorTracking: true,
          coordinationEvents: true,
          batchProcessing: true
        }
      });
      
      console.log('✅ Registered with swarm system');
      
    } catch (error) {
      console.error('❌ Failed to register with swarm:', error);
      throw error;
    }
  }
  
  startHealthMonitoring() {
    console.log('💗 Starting health monitoring...');
    
    setInterval(async () => {
      try {
        const health = await this.checkHealth();
        if (health.status !== 'healthy') {
          console.warn('⚠️ Health check warning:', health);
          await this.logger.logError(null, new Error(`Health check failed: ${health.status}`), 'health_monitoring');
        }
      } catch (error) {
        console.error('❌ Health monitoring error:', error);
      }
    }, 30000); // Check every 30 seconds
  }
  
  async checkHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        loggerInitialized: !!this.logger,
        integrationActive: this.isInitialized,
        langfuseConnected: this.integrationStatus.langfuseConnected,
        swarmRegistered: this.integrationStatus.swarmRegistered,
        metricsActive: this.integrationStatus.metricsActive,
        errorTrackingActive: this.integrationStatus.errorTrackingActive
      }
    };
    
    // Check if any critical systems are down
    const criticalChecks = ['loggerInitialized', 'integrationActive', 'langfuseConnected'];
    const failedChecks = criticalChecks.filter(check => !health.checks[check]);
    
    if (failedChecks.length > 0) {
      health.status = 'degraded';
      health.failedChecks = failedChecks;
    }
    
    return health;
  }
  
  // Agent management methods
  async spawnAgent(agentId, agentName, agentType, capabilities = []) {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }
    
    return await this.logger.logAgentSpawn(agentId, agentName, agentType, capabilities);
  }
  
  async assignTask(agentId, taskDescription, priority = 'medium') {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }
    
    return await this.logger.logAgentTask(agentId, taskDescription, priority);
  }
  
  async completeTask(agentId, taskId, result, success = true) {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }
    
    return await this.logger.logTaskCompletion(agentId, taskId, result, success);
  }
  
  async logCoordination(event, participants, data) {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }
    
    return await this.logger.logSwarmCoordination(event, participants, data);
  }
  
  async logError(agentId, error, context) {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }
    
    return await this.logger.logError(agentId, error, context);
  }
  
  getCurrentMetrics() {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }
    
    return this.logger.getCurrentMetrics();
  }
  
  async shutdown() {
    console.log('🛑 Shutting down Hive Mind Integration...');
    
    try {
      if (this.logger) {
        await this.logger.shutdown();
      }
      
      this.isInitialized = false;
      this.integrationStatus = {
        langfuseConnected: false,
        swarmRegistered: false,
        metricsActive: false,
        errorTrackingActive: false
      };
      
      console.log('✅ Hive Mind Integration shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Export the integration class
module.exports = {
  HiveMindIntegration
};

// If running directly, start the integration
if (require.main === module) {
  const integration = new HiveMindIntegration();
  
  // Handle process signals
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await integration.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await integration.shutdown();
    process.exit(0);
  });
  
  // Initialize and run
  integration.initialize().then(async () => {
    console.log('🎉 Hive Mind Integration is running!');
    console.log('📊 Use integration.getCurrentMetrics() to get current metrics');
    console.log('🔄 Integration will continue running until terminated');
    
    // Example usage
    try {
      // Spawn example agents
      await integration.spawnAgent('demo-researcher', 'Demo Researcher', 'researcher', ['web-search', 'analysis']);
      await integration.spawnAgent('demo-coder', 'Demo Coder', 'coder', ['javascript', 'python']);
      
      // Assign example tasks
      const taskId1 = await integration.assignTask('demo-researcher', 'Research machine learning trends', 'high');
      const taskId2 = await integration.assignTask('demo-coder', 'Implement authentication system', 'medium');
      
      // Log coordination event
      await integration.logCoordination('demo_coordination', ['demo-researcher', 'demo-coder'], {
        coordinationType: 'task-distribution',
        efficiency: 0.85
      });
      
      // Complete tasks after some time
      setTimeout(async () => {
        await integration.completeTask('demo-researcher', taskId1, 'Research completed successfully', true);
        await integration.completeTask('demo-coder', taskId2, 'Authentication system implemented', true);
      }, 5000);
      
    } catch (error) {
      console.error('❌ Error in example usage:', error);
    }
    
    // Keep the process running
    setInterval(() => {
      // Process heartbeat
    }, 10000);
    
  }).catch(error => {
    console.error('❌ Failed to initialize integration:', error);
    process.exit(1);
  });
}