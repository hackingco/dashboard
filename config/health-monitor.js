#!/usr/bin/env node

/**
 * Swarm Health Monitor Service
 * Continuous health checking, alerting, and recovery for swarm components
 */

const express = require('express');
const Redis = require('redis');
const Docker = require('dockerode');
const axios = require('axios');
const { createPrometheusRegistry, register } = require('prom-client');
const WebSocket = require('ws');

class SwarmHealthMonitor {
  constructor(config = {}) {
    this.config = {
      port: process.env.MONITOR_PORT || 8094,
      coordinatorUrl: process.env.COORDINATOR_URL || 'http://swarm-coordinator:8090',
      poolManagerUrl: process.env.POOL_MANAGER_URL || 'http://agent-pool-manager:8092',
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      checkInterval: this.parseInterval(process.env.CHECK_INTERVAL || '15s'),
      restartUnhealthyAgents: process.env.RESTART_UNHEALTHY_AGENTS === 'true',
      alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      
      // Health check thresholds
      agentHeartbeatTimeout: this.parseInterval(process.env.AGENT_HEARTBEAT_TIMEOUT || '60s'),
      coordinatorTimeout: this.parseInterval(process.env.COORDINATOR_TIMEOUT || '30s'),
      maxConsecutiveFailures: parseInt(process.env.MAX_CONSECUTIVE_FAILURES) || 3,
      
      ...config
    };

    this.redis = null;
    this.docker = new Docker();
    this.app = express();
    this.metrics = this.initializeMetrics();
    this.healthStatus = new Map();
    this.alertHistory = [];
    
    // Component health tracking
    this.componentHealth = {
      coordinator: { status: 'unknown', lastCheck: null, consecutiveFailures: 0 },
      poolManager: { status: 'unknown', lastCheck: null, consecutiveFailures: 0 },
      redis: { status: 'unknown', lastCheck: null, consecutiveFailures: 0 },
      agents: new Map()
    };
    
    console.log('❤️ Health Monitor Configuration:', {
      checkInterval: process.env.CHECK_INTERVAL || '15s',
      agentHeartbeatTimeout: process.env.AGENT_HEARTBEAT_TIMEOUT || '60s',
      restartUnhealthy: this.config.restartUnhealthyAgents,
      alertsEnabled: !!(this.config.alertWebhookUrl || this.config.slackWebhookUrl)
    });
  }

  async initialize() {
    try {
      console.log('❤️ Initializing Health Monitor...');
      
      // Connect to Redis
      await this.connectRedis();
      
      // Setup Express server
      this.setupExpress();
      
      // Start health monitoring loop
      this.startHealthMonitoring();
      
      // Start component discovery
      await this.discoverComponents();
      
      console.log('✅ Health Monitor initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Health Monitor:', error);
      throw error;
    }
  }

  async connectRedis() {
    this.redis = Redis.createClient({ url: this.config.redisUrl });
    
    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
      this.updateComponentHealth('redis', 'unhealthy', `Redis error: ${err.message}`);
    });
    
    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis');
      this.updateComponentHealth('redis', 'healthy');
    });
    
    await this.redis.connect();
  }

  setupExpress() {
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const overallHealth = this.calculateOverallHealth();
      
      res.status(overallHealth.status === 'healthy' ? 200 : 503).json({
        status: overallHealth.status,
        components: Object.fromEntries(
          Object.entries(this.componentHealth).map(([key, value]) => [
            key,
            key === 'agents' ? { count: value.size, healthy: Array.from(value.values()).filter(a => a.status === 'healthy').length } : value
          ])
        ),
        checks: overallHealth.checks,
        uptime: process.uptime(),
        lastCheck: new Date().toISOString()
      });
    });

    // Detailed health status
    this.app.get('/api/health/detailed', (req, res) => {
      res.json({
        components: this.componentHealth,
        agents: Object.fromEntries(this.componentHealth.agents),
        alerts: this.alertHistory.slice(-20),
        metrics: {
          totalChecks: this.metrics.healthChecks._hashMap.value,
          failedChecks: this.metrics.failedHealthChecks._hashMap.value,
          recoveries: this.metrics.componentRecoveries._hashMap.value
        }
      });
    });

    // Force health check
    this.app.post('/api/health/check', async (req, res) => {
      try {
        await this.performHealthCheck();
        res.json({ success: true, message: 'Health check completed' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Component restart
    this.app.post('/api/health/restart/:component', async (req, res) => {
      try {
        const component = req.params.component;
        await this.restartComponent(component);
        res.json({ success: true, message: `Restart initiated for ${component}` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Alert history
    this.app.get('/api/alerts', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      res.json({
        alerts: this.alertHistory.slice(-limit),
        totalAlerts: this.alertHistory.length
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    // Start server
    this.server = this.app.listen(this.config.port, () => {
      console.log(`🌐 Health Monitor API listening on port ${this.config.port}`);
    });
  }

  startHealthMonitoring() {
    console.log(`🔄 Starting health monitoring (${process.env.CHECK_INTERVAL || '15s'} interval)`);
    
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.checkInterval);
    
    // Also run an initial check
    setTimeout(() => this.performHealthCheck(), 5000);
  }

  async performHealthCheck() {
    this.metrics.healthChecks.inc();
    
    try {
      console.log('🔍 Performing health check...');
      
      // Check core components
      await this.checkCoordinator();
      await this.checkPoolManager();
      await this.checkRedis();
      
      // Check agents
      await this.checkAgents();
      
      // Check Docker containers
      await this.checkDockerContainers();
      
      // Update overall metrics
      this.updateOverallMetrics();
      
      console.log('✅ Health check completed');
      
    } catch (error) {
      console.error('❌ Error during health check:', error);
      this.metrics.failedHealthChecks.inc();
    }
  }

  async checkCoordinator() {
    try {
      const response = await axios.get(`${this.config.coordinatorUrl}/health`, {
        timeout: 10000
      });
      
      if (response.status === 200) {
        this.updateComponentHealth('coordinator', 'healthy');
      } else {
        this.updateComponentHealth('coordinator', 'unhealthy', `HTTP ${response.status}`);
      }
      
    } catch (error) {
      this.updateComponentHealth('coordinator', 'unhealthy', error.message);
      
      if (this.shouldRestart('coordinator')) {
        await this.restartComponent('swarm-coordinator');
      }
    }
  }

  async checkPoolManager() {
    try {
      const response = await axios.get(`${this.config.poolManagerUrl}/health`, {
        timeout: 10000
      });
      
      if (response.status === 200) {
        this.updateComponentHealth('poolManager', 'healthy');
      } else {
        this.updateComponentHealth('poolManager', 'unhealthy', `HTTP ${response.status}`);
      }
      
    } catch (error) {
      this.updateComponentHealth('poolManager', 'unhealthy', error.message);
      
      if (this.shouldRestart('poolManager')) {
        await this.restartComponent('agent-pool-manager');
      }
    }
  }

  async checkRedis() {
    try {
      await this.redis.ping();
      this.updateComponentHealth('redis', 'healthy');
      
    } catch (error) {
      this.updateComponentHealth('redis', 'unhealthy', error.message);
      
      if (this.shouldRestart('redis')) {
        await this.restartComponent('swarm-redis');
      }
    }
  }

  async checkAgents() {
    try {
      // Get agent list from coordinator
      const response = await axios.get(`${this.config.coordinatorUrl}/api/agents`);
      const agents = response.data.agents;
      
      for (const agent of agents) {
        const lastHeartbeat = new Date(agent.lastHeartbeat);
        const timeSinceHeartbeat = Date.now() - lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > this.config.agentHeartbeatTimeout) {
          this.updateAgentHealth(agent.id, 'unhealthy', 'Heartbeat timeout');
          
          if (this.config.restartUnhealthyAgents && this.shouldRestartAgent(agent.id)) {
            await this.restartAgent(agent);
          }
        } else {
          this.updateAgentHealth(agent.id, 'healthy');
        }
      }
      
      // Remove agents that are no longer in the coordinator's list
      const currentAgentIds = agents.map(a => a.id);
      const trackedAgentIds = Array.from(this.componentHealth.agents.keys());
      
      for (const agentId of trackedAgentIds) {
        if (!currentAgentIds.includes(agentId)) {
          this.componentHealth.agents.delete(agentId);
          console.log(`🗑️ Removed tracking for agent: ${agentId}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to check agents:', error);
    }
  }

  async checkDockerContainers() {
    try {
      const containers = await this.docker.listContainers({
        filters: { label: ['swarm.component=true'] }
      });
      
      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        const inspect = await container.inspect();
        
        const componentName = inspect.Config.Labels['swarm.component.name'] || containerInfo.Names[0];
        const isHealthy = inspect.State.Health ? 
          inspect.State.Health.Status === 'healthy' : 
          inspect.State.Status === 'running';
        
        if (!isHealthy) {
          console.log(`⚠️ Unhealthy container: ${componentName} (${inspect.State.Status})`);
          
          await this.sendAlert({
            level: 'warning',
            component: componentName,
            message: `Container unhealthy: ${inspect.State.Status}`,
            containerId: containerInfo.Id
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to check Docker containers:', error);
    }
  }

  updateComponentHealth(component, status, error = null) {
    const health = this.componentHealth[component];
    const wasHealthy = health.status === 'healthy';
    
    health.lastCheck = new Date();
    
    if (status === 'healthy') {
      if (!wasHealthy && health.status !== 'unknown') {
        // Component recovered
        console.log(`✅ Component recovered: ${component}`);
        this.metrics.componentRecoveries.inc({ component });
        
        this.sendAlert({
          level: 'info',
          component,
          message: 'Component recovered'
        });
      }
      
      health.status = 'healthy';
      health.consecutiveFailures = 0;
      health.error = null;
      
    } else {
      if (wasHealthy) {
        console.log(`❌ Component became unhealthy: ${component} - ${error}`);
      }
      
      health.status = 'unhealthy';
      health.consecutiveFailures++;
      health.error = error;
      
      // Send alert on first failure or every 5 consecutive failures
      if (health.consecutiveFailures === 1 || health.consecutiveFailures % 5 === 0) {
        this.sendAlert({
          level: health.consecutiveFailures === 1 ? 'warning' : 'critical',
          component,
          message: `Component unhealthy (${health.consecutiveFailures} consecutive failures): ${error}`
        });
      }
    }
    
    // Update Prometheus metrics
    this.metrics.componentHealth.set({ component }, status === 'healthy' ? 1 : 0);
  }

  updateAgentHealth(agentId, status, error = null) {
    if (!this.componentHealth.agents.has(agentId)) {
      this.componentHealth.agents.set(agentId, {
        status: 'unknown',
        lastCheck: null,
        consecutiveFailures: 0
      });
    }
    
    const agent = this.componentHealth.agents.get(agentId);
    const wasHealthy = agent.status === 'healthy';
    
    agent.lastCheck = new Date();
    
    if (status === 'healthy') {
      if (!wasHealthy && agent.status !== 'unknown') {
        console.log(`✅ Agent recovered: ${agentId}`);
        this.metrics.agentRecoveries.inc();
      }
      
      agent.status = 'healthy';
      agent.consecutiveFailures = 0;
      agent.error = null;
      
    } else {
      if (wasHealthy) {
        console.log(`❌ Agent became unhealthy: ${agentId} - ${error}`);
      }
      
      agent.status = 'unhealthy';
      agent.consecutiveFailures++;
      agent.error = error;
      
      // Send alert for agent failures
      if (agent.consecutiveFailures === 1) {
        this.sendAlert({
          level: 'warning',
          component: 'agent',
          agentId,
          message: `Agent unhealthy: ${error}`
        });
      }
    }
    
    // Update Prometheus metrics
    this.metrics.agentHealth.set({ agent_id: agentId }, status === 'healthy' ? 1 : 0);
  }

  shouldRestart(component) {
    const health = this.componentHealth[component];
    return health.consecutiveFailures >= this.config.maxConsecutiveFailures;
  }

  shouldRestartAgent(agentId) {
    const agent = this.componentHealth.agents.get(agentId);
    return agent && agent.consecutiveFailures >= this.config.maxConsecutiveFailures;
  }

  async restartComponent(containerName) {
    try {
      console.log(`🔄 Restarting component: ${containerName}`);
      
      const containers = await this.docker.listContainers({
        filters: { name: [containerName] }
      });
      
      if (containers.length === 0) {
        throw new Error(`Container not found: ${containerName}`);
      }
      
      const container = this.docker.getContainer(containers[0].Id);
      await container.restart();
      
      console.log(`✅ Component restarted: ${containerName}`);
      this.metrics.componentRestarts.inc({ component: containerName });
      
      this.sendAlert({
        level: 'info',
        component: containerName,
        message: 'Component restarted due to health check failure'
      });
      
    } catch (error) {
      console.error(`❌ Failed to restart component ${containerName}:`, error);
      
      this.sendAlert({
        level: 'critical',
        component: containerName,
        message: `Failed to restart component: ${error.message}`
      });
    }
  }

  async restartAgent(agent) {
    try {
      console.log(`🔄 Restarting agent: ${agent.id}`);
      
      if (agent.containerId) {
        const container = this.docker.getContainer(agent.containerId);
        await container.restart();
        
        console.log(`✅ Agent restarted: ${agent.id}`);
        this.metrics.agentRestarts.inc();
        
      } else {
        // If no container ID, try to scale down and up via coordinator
        await axios.post(`${this.config.coordinatorUrl}/api/agents/${agent.id}`, {
          action: 'restart'
        });
      }
      
    } catch (error) {
      console.error(`❌ Failed to restart agent ${agent.id}:`, error);
    }
  }

  async sendAlert(alert) {
    const alertData = {
      ...alert,
      timestamp: new Date().toISOString(),
      service: 'swarm-health-monitor'
    };
    
    this.alertHistory.push(alertData);
    
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
    
    // Send to webhook endpoints
    if (this.config.alertWebhookUrl) {
      try {
        await axios.post(this.config.alertWebhookUrl, alertData);
      } catch (error) {
        console.error('Failed to send webhook alert:', error.message);
      }
    }
    
    if (this.config.slackWebhookUrl) {
      try {
        const slackMessage = this.formatSlackMessage(alertData);
        await axios.post(this.config.slackWebhookUrl, slackMessage);
      } catch (error) {
        console.error('Failed to send Slack alert:', error.message);
      }
    }
    
    // Store in Redis
    await this.redis.lPush('health:alerts', JSON.stringify(alertData));
    await this.redis.lTrim('health:alerts', 0, 999); // Keep last 1000
    
    console.log(`🚨 Alert sent: [${alert.level.toUpperCase()}] ${alert.component} - ${alert.message}`);
  }

  formatSlackMessage(alert) {
    const emoji = {
      info: '✅',
      warning: '⚠️',
      critical: '🚨'
    };
    
    return {
      text: `${emoji[alert.level] || '📊'} Swarm Health Alert`,
      attachments: [{
        color: alert.level === 'critical' ? 'danger' : alert.level === 'warning' ? 'warning' : 'good',
        fields: [
          { title: 'Component', value: alert.component, short: true },
          { title: 'Level', value: alert.level.toUpperCase(), short: true },
          { title: 'Message', value: alert.message, short: false },
          { title: 'Time', value: alert.timestamp, short: true }
        ]
      }]
    };
  }

  calculateOverallHealth() {
    const checks = {};
    let healthyCount = 0;
    let totalCount = 0;
    
    // Check core components
    for (const [component, health] of Object.entries(this.componentHealth)) {
      if (component === 'agents') continue;
      
      checks[component] = health.status;
      totalCount++;
      
      if (health.status === 'healthy') {
        healthyCount++;
      }
    }
    
    // Check agents
    const agentStatuses = Array.from(this.componentHealth.agents.values());
    const healthyAgents = agentStatuses.filter(a => a.status === 'healthy').length;
    
    checks.agents = {
      total: agentStatuses.length,
      healthy: healthyAgents,
      unhealthy: agentStatuses.length - healthyAgents
    };
    
    // Calculate overall status
    const coreHealthy = healthyCount === totalCount;
    const agentsHealthy = agentStatuses.length === 0 || healthyAgents > 0;
    
    const overallStatus = coreHealthy && agentsHealthy ? 'healthy' : 'unhealthy';
    
    return { status: overallStatus, checks };
  }

  updateOverallMetrics() {
    const overall = this.calculateOverallHealth();
    
    this.metrics.overallHealth.set(overall.status === 'healthy' ? 1 : 0);
    this.metrics.totalAgents.set(overall.checks.agents.total);
    this.metrics.healthyAgents.set(overall.checks.agents.healthy);
    this.metrics.unhealthyAgents.set(overall.checks.agents.unhealthy);
  }

  async discoverComponents() {
    // Discover existing swarm components
    console.log('🔍 Discovering swarm components...');
    
    try {
      // Initialize component health
      this.updateComponentHealth('coordinator', 'unknown');
      this.updateComponentHealth('poolManager', 'unknown');
      this.updateComponentHealth('redis', 'unknown');
      
      console.log('✅ Component discovery completed');
      
    } catch (error) {
      console.error('❌ Component discovery failed:', error);
    }
  }

  initializeMetrics() {
    const { Counter, Gauge } = require('prom-client');
    
    return {
      healthChecks: new Counter({
        name: 'health_monitor_checks_total',
        help: 'Total number of health checks performed'
      }),
      failedHealthChecks: new Counter({
        name: 'health_monitor_failed_checks_total',
        help: 'Total number of failed health checks'
      }),
      componentHealth: new Gauge({
        name: 'health_monitor_component_health',
        help: 'Component health status (1 = healthy, 0 = unhealthy)',
        labelNames: ['component']
      }),
      agentHealth: new Gauge({
        name: 'health_monitor_agent_health',
        help: 'Agent health status (1 = healthy, 0 = unhealthy)',
        labelNames: ['agent_id']
      }),
      componentRecoveries: new Counter({
        name: 'health_monitor_component_recoveries_total',
        help: 'Total number of component recoveries',
        labelNames: ['component']
      }),
      agentRecoveries: new Counter({
        name: 'health_monitor_agent_recoveries_total',
        help: 'Total number of agent recoveries'
      }),
      componentRestarts: new Counter({
        name: 'health_monitor_component_restarts_total',
        help: 'Total number of component restarts',
        labelNames: ['component']
      }),
      agentRestarts: new Counter({
        name: 'health_monitor_agent_restarts_total',
        help: 'Total number of agent restarts'
      }),
      overallHealth: new Gauge({
        name: 'health_monitor_overall_health',
        help: 'Overall swarm health status (1 = healthy, 0 = unhealthy)'
      }),
      totalAgents: new Gauge({
        name: 'health_monitor_total_agents',
        help: 'Total number of agents'
      }),
      healthyAgents: new Gauge({
        name: 'health_monitor_healthy_agents',
        help: 'Number of healthy agents'
      }),
      unhealthyAgents: new Gauge({
        name: 'health_monitor_unhealthy_agents',
        help: 'Number of unhealthy agents'
      })
    };
  }

  parseInterval(intervalStr) {
    const units = { s: 1000, m: 60000, h: 3600000 };
    const match = intervalStr.match(/^(\d+)([smh])$/);
    
    if (!match) return 15000; // default 15 seconds
    
    return parseInt(match[1]) * units[match[2]];
  }

  async shutdown() {
    console.log('🛑 Shutting down Health Monitor...');
    
    if (this.server) {
      this.server.close();
    }
    
    if (this.redis) {
      await this.redis.disconnect();
    }
    
    console.log('✅ Health Monitor shutdown complete');
  }
}

// Start the health monitor if run directly
if (require.main === module) {
  const healthMonitor = new SwarmHealthMonitor();
  
  healthMonitor.initialize().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGTERM', () => healthMonitor.shutdown());
  process.on('SIGINT', () => healthMonitor.shutdown());
}

module.exports = SwarmHealthMonitor;