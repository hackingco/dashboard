#!/usr/bin/env node

/**
 * Swarm Auto-Scaler Service
 * Automatically scales agent count based on load, CPU, memory, and queue metrics
 */

const express = require('express');
const Redis = require('redis');
const Docker = require('dockerode');
const axios = require('axios');
const { createPrometheusRegistry, register } = require('prom-client');

class SwarmAutoScaler {
  constructor(config = {}) {
    this.config = {
      port: process.env.SCALER_PORT || 8093,
      coordinatorUrl: process.env.COORDINATOR_URL || 'http://swarm-coordinator:8090',
      poolManagerUrl: process.env.POOL_MANAGER_URL || 'http://agent-pool-manager:8092',
      metricsUrl: process.env.METRICS_URL || 'http://swarm-metrics:9090',
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      scalingInterval: this.parseInterval(process.env.SCALING_INTERVAL || '30s'),
      
      // Scaling thresholds
      cpuScaleUpThreshold: parseInt(process.env.CPU_SCALE_UP_THRESHOLD) || 75,
      cpuScaleDownThreshold: parseInt(process.env.CPU_SCALE_DOWN_THRESHOLD) || 25,
      memoryScaleUpThreshold: parseInt(process.env.MEMORY_SCALE_UP_THRESHOLD) || 80,
      memoryScaleDownThreshold: parseInt(process.env.MEMORY_SCALE_DOWN_THRESHOLD) || 30,
      taskQueueThreshold: parseInt(process.env.TASK_QUEUE_THRESHOLD) || 10,
      cooldownPeriod: this.parseInterval(process.env.COOLDOWN_PERIOD || '300s'),
      
      // Agent limits
      minAgents: parseInt(process.env.MIN_AGENTS) || 3,
      maxAgents: parseInt(process.env.MAX_AGENTS) || 12,
      
      ...config
    };

    this.redis = null;
    this.docker = new Docker();
    this.app = express();
    this.metrics = this.initializeMetrics();
    
    this.lastScaleAction = null;
    this.scalingHistory = [];
    this.isScaling = false;
    
    console.log('🎛️ Auto-Scaler Configuration:', {
      cpuThresholds: `${this.config.cpuScaleDownThreshold}% - ${this.config.cpuScaleUpThreshold}%`,
      memoryThresholds: `${this.config.memoryScaleDownThreshold}% - ${this.config.memoryScaleUpThreshold}%`,
      agentLimits: `${this.config.minAgents} - ${this.config.maxAgents}`,
      scalingInterval: process.env.SCALING_INTERVAL || '30s',
      cooldownPeriod: process.env.COOLDOWN_PERIOD || '300s'
    });
  }

  async initialize() {
    try {
      console.log('🎛️ Initializing Auto-Scaler...');
      
      // Connect to Redis
      await this.connectRedis();
      
      // Setup Express server
      this.setupExpress();
      
      // Start scaling loop
      this.startScalingLoop();
      
      console.log('✅ Auto-Scaler initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Auto-Scaler:', error);
      throw error;
    }
  }

  async connectRedis() {
    this.redis = Redis.createClient({ url: this.config.redisUrl });
    
    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });
    
    await this.redis.connect();
    console.log('✅ Connected to Redis');
  }

  setupExpress() {
    this.app.use(express.json());
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        lastScaleAction: this.lastScaleAction,
        isScaling: this.isScaling,
        config: {
          minAgents: this.config.minAgents,
          maxAgents: this.config.maxAgents,
          scalingInterval: process.env.SCALING_INTERVAL || '30s'
        }
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    // Manual scaling trigger
    this.app.post('/api/scale', async (req, res) => {
      try {
        const { action, agentType, count } = req.body;
        
        if (action === 'up') {
          await this.scaleUp(agentType, count);
        } else if (action === 'down') {
          await this.scaleDown(agentType, count);
        } else {
          return res.status(400).json({ error: 'Invalid action. Use "up" or "down"' });
        }
        
        res.json({ success: true, action, agentType, count });
        
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Scaling history
    this.app.get('/api/scaling-history', (req, res) => {
      res.json({
        history: this.scalingHistory.slice(-50), // Last 50 actions
        lastAction: this.lastScaleAction
      });
    });

    // Current metrics
    this.app.get('/api/metrics-data', async (req, res) => {
      try {
        const metrics = await this.gatherMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Start server
    this.server = this.app.listen(this.config.port, () => {
      console.log(`🌐 Auto-Scaler API listening on port ${this.config.port}`);
    });
  }

  startScalingLoop() {
    console.log(`🔄 Starting scaling loop (${process.env.SCALING_INTERVAL || '30s'} interval)`);
    
    setInterval(async () => {
      if (!this.isScaling) {
        await this.performScalingCheck();
      }
    }, this.config.scalingInterval);
  }

  async performScalingCheck() {
    try {
      this.metrics.scalingChecks.inc();
      
      // Check if we're in cooldown period
      if (this.isInCooldown()) {
        console.log('⏳ Scaling in cooldown period, skipping check');
        return;
      }

      const metrics = await this.gatherMetrics();
      const decision = this.makeScalingDecision(metrics);
      
      if (decision.action !== 'none') {
        await this.executeScalingDecision(decision, metrics);
      }
      
    } catch (error) {
      console.error('❌ Error during scaling check:', error);
      this.metrics.scalingErrors.inc();
    }
  }

  async gatherMetrics() {
    try {
      // Get current agent status from coordinator
      const agentsResponse = await axios.get(`${this.config.coordinatorUrl}/api/agents`);
      const agents = agentsResponse.data.agents;
      
      // Get task queue status
      const tasksResponse = await axios.get(`${this.config.coordinatorUrl}/api/tasks`);
      const activeTasks = tasksResponse.data.activeTasks || 0;
      
      // Get system metrics from Prometheus (if available)
      let systemMetrics = { cpu: 0, memory: 0 };
      try {
        const metricsResponse = await axios.get(
          `${this.config.metricsUrl}/api/v1/query?query=avg(rate(container_cpu_usage_seconds_total[5m])*100)`
        );
        
        if (metricsResponse.data.data.result.length > 0) {
          systemMetrics.cpu = parseFloat(metricsResponse.data.data.result[0].value[1]);
        }
        
        const memoryResponse = await axios.get(
          `${this.config.metricsUrl}/api/v1/query?query=avg(container_memory_usage_bytes/container_spec_memory_limit_bytes*100)`
        );
        
        if (memoryResponse.data.data.result.length > 0) {
          systemMetrics.memory = parseFloat(memoryResponse.data.data.result[0].value[1]);
        }
        
      } catch (metricsError) {
        console.log('⚠️ Could not fetch system metrics, using defaults');
      }
      
      // Calculate agent type distribution
      const agentTypes = {};
      agents.forEach(agent => {
        agentTypes[agent.type] = (agentTypes[agent.type] || 0) + 1;
      });

      const metrics = {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === 'active').length,
        unhealthyAgents: agents.filter(a => a.status !== 'active').length,
        activeTasks,
        queuedTasks: Math.max(0, activeTasks - agents.length), // Simplified queue calculation
        agentTypes,
        systemMetrics,
        timestamp: new Date()
      };
      
      // Update Prometheus metrics
      this.updatePrometheusMetrics(metrics);
      
      return metrics;
      
    } catch (error) {
      console.error('❌ Failed to gather metrics:', error);
      throw error;
    }
  }

  makeScalingDecision(metrics) {
    const decision = {
      action: 'none',
      reason: '',
      targetCount: metrics.totalAgents,
      agentType: 'researcher' // Default type for scaling
    };

    // Check if we need to scale up
    const scaleUpReasons = [];
    
    // High CPU usage
    if (metrics.systemMetrics.cpu > this.config.cpuScaleUpThreshold) {
      scaleUpReasons.push(`CPU usage ${metrics.systemMetrics.cpu.toFixed(1)}% > ${this.config.cpuScaleUpThreshold}%`);
    }
    
    // High memory usage
    if (metrics.systemMetrics.memory > this.config.memoryScaleUpThreshold) {
      scaleUpReasons.push(`Memory usage ${metrics.systemMetrics.memory.toFixed(1)}% > ${this.config.memoryScaleUpThreshold}%`);
    }
    
    // Task queue backlog
    if (metrics.queuedTasks > this.config.taskQueueThreshold) {
      scaleUpReasons.push(`Queued tasks ${metrics.queuedTasks} > ${this.config.taskQueueThreshold}`);
    }
    
    // Agent overload (more tasks than agents)
    if (metrics.activeTasks > metrics.activeAgents * 2) {
      scaleUpReasons.push(`Task overload: ${metrics.activeTasks} tasks for ${metrics.activeAgents} agents`);
    }

    // Check if we need to scale down
    const scaleDownReasons = [];
    
    // Low CPU usage
    if (metrics.systemMetrics.cpu < this.config.cpuScaleDownThreshold && metrics.totalAgents > this.config.minAgents) {
      scaleDownReasons.push(`CPU usage ${metrics.systemMetrics.cpu.toFixed(1)}% < ${this.config.cpuScaleDownThreshold}%`);
    }
    
    // Low memory usage
    if (metrics.systemMetrics.memory < this.config.memoryScaleDownThreshold && metrics.totalAgents > this.config.minAgents) {
      scaleDownReasons.push(`Memory usage ${metrics.systemMetrics.memory.toFixed(1)}% < ${this.config.memoryScaleDownThreshold}%`);
    }
    
    // Agent underutilization
    if (metrics.activeTasks < metrics.activeAgents * 0.3 && metrics.totalAgents > this.config.minAgents) {
      scaleDownReasons.push(`Agent underutilization: ${metrics.activeTasks} tasks for ${metrics.activeAgents} agents`);
    }

    // Make scaling decision
    if (scaleUpReasons.length > 0 && metrics.totalAgents < this.config.maxAgents) {
      decision.action = 'scale_up';
      decision.reason = scaleUpReasons.join(', ');
      decision.targetCount = Math.min(metrics.totalAgents + 1, this.config.maxAgents);
      
      // Choose agent type based on current distribution
      decision.agentType = this.chooseAgentTypeForScaling(metrics.agentTypes, 'up');
      
    } else if (scaleDownReasons.length > 1 && metrics.totalAgents > this.config.minAgents) { // Require multiple reasons for scale down
      decision.action = 'scale_down';
      decision.reason = scaleDownReasons.join(', ');
      decision.targetCount = Math.max(metrics.totalAgents - 1, this.config.minAgents);
      
      decision.agentType = this.chooseAgentTypeForScaling(metrics.agentTypes, 'down');
    }

    return decision;
  }

  chooseAgentTypeForScaling(agentTypes, direction) {
    // For scaling up, add the least common agent type
    // For scaling down, remove the most common agent type
    
    const types = Object.entries(agentTypes);
    
    if (types.length === 0) {
      return 'researcher'; // Default
    }
    
    if (direction === 'up') {
      // Find the least common type
      types.sort((a, b) => a[1] - b[1]);
      return types[0][0];
    } else {
      // Find the most common type (but avoid coordinator)
      types.sort((a, b) => b[1] - a[1]);
      return types.find(([type]) => type !== 'coordinator')?.[0] || types[0][0];
    }
  }

  async executeScalingDecision(decision, metrics) {
    this.isScaling = true;
    
    try {
      console.log(`🎯 Scaling decision: ${decision.action}`);
      console.log(`📊 Reason: ${decision.reason}`);
      console.log(`🎭 Agent type: ${decision.agentType}`);
      console.log(`📈 Target count: ${decision.targetCount} (current: ${metrics.totalAgents})`);
      
      const scaleAction = {
        timestamp: new Date(),
        action: decision.action,
        reason: decision.reason,
        agentType: decision.agentType,
        fromCount: metrics.totalAgents,
        toCount: decision.targetCount,
        metrics: {
          cpu: metrics.systemMetrics.cpu,
          memory: metrics.systemMetrics.memory,
          activeTasks: metrics.activeTasks,
          queuedTasks: metrics.queuedTasks
        }
      };
      
      if (decision.action === 'scale_up') {
        await this.scaleUp(decision.agentType, decision.targetCount - metrics.totalAgents);
        this.metrics.scaleUpActions.inc();
      } else if (decision.action === 'scale_down') {
        await this.scaleDown(decision.agentType, metrics.totalAgents - decision.targetCount);
        this.metrics.scaleDownActions.inc();
      }
      
      // Record the action
      this.lastScaleAction = scaleAction;
      this.scalingHistory.push(scaleAction);
      
      // Store in Redis for persistence
      await this.redis.setEx('autoscaler:last_action', 3600, JSON.stringify(scaleAction));
      await this.redis.lPush('autoscaler:history', JSON.stringify(scaleAction));
      await this.redis.lTrim('autoscaler:history', 0, 99); // Keep last 100 actions
      
      console.log(`✅ Scaling completed: ${decision.action} for ${decision.agentType}`);
      
    } catch (error) {
      console.error(`❌ Failed to execute scaling decision:`, error);
      this.metrics.scalingErrors.inc();
      throw error;
    } finally {
      this.isScaling = false;
    }
  }

  async scaleUp(agentType, count = 1) {
    console.log(`📈 Scaling up ${count} ${agentType} agent(s)`);
    
    try {
      const response = await axios.post(`${this.config.coordinatorUrl}/api/scale`, {
        targetCount: count,
        agentType,
        action: 'add'
      });
      
      console.log(`✅ Scale up request sent successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to scale up:`, error.message);
      throw error;
    }
  }

  async scaleDown(agentType, count = 1) {
    console.log(`📉 Scaling down ${count} ${agentType} agent(s)`);
    
    try {
      const response = await axios.post(`${this.config.coordinatorUrl}/api/scale`, {
        targetCount: -count,
        agentType,
        action: 'remove'
      });
      
      console.log(`✅ Scale down request sent successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to scale down:`, error.message);
      throw error;
    }
  }

  isInCooldown() {
    if (!this.lastScaleAction) return false;
    
    const timeSinceLastAction = Date.now() - new Date(this.lastScaleAction.timestamp).getTime();
    return timeSinceLastAction < this.config.cooldownPeriod;
  }

  updatePrometheusMetrics(metrics) {
    this.metrics.totalAgents.set(metrics.totalAgents);
    this.metrics.activeAgents.set(metrics.activeAgents);
    this.metrics.unhealthyAgents.set(metrics.unhealthyAgents);
    this.metrics.activeTasks.set(metrics.activeTasks);
    this.metrics.queuedTasks.set(metrics.queuedTasks);
    this.metrics.cpuUsage.set(metrics.systemMetrics.cpu);
    this.metrics.memoryUsage.set(metrics.systemMetrics.memory);
  }

  initializeMetrics() {
    const { Counter, Gauge } = require('prom-client');
    
    return {
      scalingChecks: new Counter({
        name: 'autoscaler_scaling_checks_total',
        help: 'Total number of scaling checks performed'
      }),
      scaleUpActions: new Counter({
        name: 'autoscaler_scale_up_actions_total',
        help: 'Total number of scale up actions'
      }),
      scaleDownActions: new Counter({
        name: 'autoscaler_scale_down_actions_total',
        help: 'Total number of scale down actions'
      }),
      scalingErrors: new Counter({
        name: 'autoscaler_scaling_errors_total',
        help: 'Total number of scaling errors'
      }),
      totalAgents: new Gauge({
        name: 'autoscaler_total_agents',
        help: 'Current total number of agents'
      }),
      activeAgents: new Gauge({
        name: 'autoscaler_active_agents',
        help: 'Current number of active agents'
      }),
      unhealthyAgents: new Gauge({
        name: 'autoscaler_unhealthy_agents',
        help: 'Current number of unhealthy agents'
      }),
      activeTasks: new Gauge({
        name: 'autoscaler_active_tasks',
        help: 'Current number of active tasks'
      }),
      queuedTasks: new Gauge({
        name: 'autoscaler_queued_tasks',
        help: 'Current number of queued tasks'
      }),
      cpuUsage: new Gauge({
        name: 'autoscaler_cpu_usage_percent',
        help: 'Current CPU usage percentage'
      }),
      memoryUsage: new Gauge({
        name: 'autoscaler_memory_usage_percent',
        help: 'Current memory usage percentage'
      })
    };
  }

  parseInterval(intervalStr) {
    const units = { s: 1000, m: 60000, h: 3600000 };
    const match = intervalStr.match(/^(\d+)([smh])$/);
    
    if (!match) return 30000; // default 30 seconds
    
    return parseInt(match[1]) * units[match[2]];
  }

  async shutdown() {
    console.log('🛑 Shutting down Auto-Scaler...');
    
    if (this.server) {
      this.server.close();
    }
    
    if (this.redis) {
      await this.redis.disconnect();
    }
    
    console.log('✅ Auto-Scaler shutdown complete');
  }
}

// Start the auto-scaler if run directly
if (require.main === module) {
  const autoScaler = new SwarmAutoScaler();
  
  autoScaler.initialize().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGTERM', () => autoScaler.shutdown());
  process.on('SIGINT', () => autoScaler.shutdown());
}

module.exports = SwarmAutoScaler;