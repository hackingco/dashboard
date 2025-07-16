#!/usr/bin/env node

/**
 * Swarm Orchestrator - Central coordination system
 * Manages multi-agent deployment, scaling, and health monitoring
 */

const express = require('express');
const WebSocket = require('ws');
const Redis = require('redis');
const { createPrometheusRegistry, register } = require('prom-client');
const Docker = require('dockerode');
const EventEmitter = require('events');

class SwarmOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: process.env.COORDINATOR_PORT || 8090,
      wsPort: process.env.WS_PORT || 8091,
      maxAgents: parseInt(process.env.MAX_AGENTS) || 12,
      minAgents: parseInt(process.env.MIN_AGENTS) || 3,
      coordinationStrategy: process.env.COORDINATION_STRATEGY || 'hierarchical',
      autoScaling: process.env.AUTO_SCALING_ENABLED === 'true',
      healthCheckInterval: process.env.HEALTH_CHECK_INTERVAL || '10s',
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      ...config
    };

    this.agents = new Map();
    this.tasks = new Map();
    this.metrics = this.initializeMetrics();
    this.docker = new Docker();
    this.redis = null;
    this.wss = null;
    this.app = express();
    
    this.status = {
      state: 'initializing',
      agentCount: 0,
      activeTasks: 0,
      uptime: 0,
      lastHealthCheck: null
    };
  }

  async initialize() {
    try {
      console.log('🐝 Initializing Swarm Orchestrator...');
      
      // Connect to Redis
      await this.connectRedis();
      
      // Setup Express server
      this.setupExpress();
      
      // Setup WebSocket server
      this.setupWebSocket();
      
      // Initialize agent discovery
      await this.discoverExistingAgents();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      this.status.state = 'active';
      console.log('✅ Swarm Orchestrator initialized successfully');
      
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Swarm Orchestrator:', error);
      this.status.state = 'error';
      throw error;
    }
  }

  async connectRedis() {
    this.redis = Redis.createClient({ url: this.config.redisUrl });
    
    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
      this.status.state = 'degraded';
    });
    
    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis');
    });
    
    await this.redis.connect();
  }

  setupExpress() {
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: this.status.state,
        agentCount: this.status.agentCount,
        activeTasks: this.status.activeTasks,
        uptime: process.uptime(),
        lastHealthCheck: this.status.lastHealthCheck,
        coordination: {
          strategy: this.config.coordinationStrategy,
          autoScaling: this.config.autoScaling,
          maxAgents: this.config.maxAgents
        }
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    });

    // Agent registration
    this.app.post('/api/agents/register', async (req, res) => {
      try {
        const agent = await this.registerAgent(req.body);
        res.json({ success: true, agent });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Agent deregistration
    this.app.delete('/api/agents/:agentId', async (req, res) => {
      try {
        await this.deregisterAgent(req.params.agentId);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Task orchestration
    this.app.post('/api/tasks', async (req, res) => {
      try {
        const task = await this.orchestrateTask(req.body);
        res.json({ success: true, task });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Get task status
    this.app.get('/api/tasks/:taskId', async (req, res) => {
      const task = this.tasks.get(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    });

    // List agents
    this.app.get('/api/agents', (req, res) => {
      const agents = Array.from(this.agents.values());
      res.json({ agents, count: agents.length });
    });

    // Swarm scaling
    this.app.post('/api/scale', async (req, res) => {
      try {
        const { targetCount, agentType } = req.body;
        await this.scaleSwarm(targetCount, agentType);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Start server
    this.server = this.app.listen(this.config.port, () => {
      console.log(`🌐 Coordinator API listening on port ${this.config.port}`);
    });
  }

  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: this.config.wsPort });
    
    this.wss.on('connection', (ws) => {
      console.log('🔗 WebSocket client connected');
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleWebSocketMessage(ws, message);
        } catch (error) {
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });
      
      ws.on('close', () => {
        console.log('🔗 WebSocket client disconnected');
      });
    });
    
    console.log(`🔗 WebSocket server listening on port ${this.config.wsPort}`);
  }

  async handleWebSocketMessage(ws, message) {
    switch (message.type) {
      case 'agent_heartbeat':
        await this.handleAgentHeartbeat(message.agentId, message.data);
        break;
      case 'task_update':
        await this.handleTaskUpdate(message.taskId, message.status, message.data);
        break;
      case 'coordination_request':
        await this.handleCoordinationRequest(ws, message);
        break;
      default:
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  async registerAgent(agentData) {
    const agentId = agentData.id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const agent = {
      id: agentId,
      type: agentData.type,
      containerId: agentData.containerId,
      capabilities: agentData.capabilities || [],
      status: 'active',
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      taskCount: 0,
      successCount: 0,
      errorCount: 0,
      resources: {
        cpu: agentData.resources?.cpu || 0,
        memory: agentData.resources?.memory || 0
      }
    };
    
    this.agents.set(agentId, agent);
    this.status.agentCount = this.agents.size;
    
    // Store in Redis
    await this.redis.setEx(`agent:${agentId}`, 3600, JSON.stringify(agent));
    
    // Update Prometheus metrics
    this.metrics.agentCount.set(this.agents.size);
    this.metrics.agentRegistrations.inc();
    
    console.log(`✅ Agent registered: ${agentId} (${agent.type})`);
    
    // Broadcast to WebSocket clients
    this.broadcast({ type: 'agent_registered', agent });
    
    return agent;
  }

  async deregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    this.agents.delete(agentId);
    this.status.agentCount = this.agents.size;
    
    // Remove from Redis
    await this.redis.del(`agent:${agentId}`);
    
    // Update metrics
    this.metrics.agentCount.set(this.agents.size);
    this.metrics.agentDeregistrations.inc();
    
    console.log(`❌ Agent deregistered: ${agentId}`);
    
    // Broadcast to WebSocket clients
    this.broadcast({ type: 'agent_deregistered', agentId });
  }

  async orchestrateTask(taskData) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find suitable agents based on requirements
    const suitableAgents = this.findSuitableAgents(taskData);
    
    if (suitableAgents.length === 0) {
      throw new Error('No suitable agents available for task');
    }
    
    const task = {
      id: taskId,
      type: taskData.type,
      priority: taskData.priority || 'medium',
      requirements: taskData.requirements || {},
      assignedAgents: suitableAgents.map(a => a.id),
      status: 'pending',
      createdAt: new Date(),
      data: taskData.data || {}
    };
    
    this.tasks.set(taskId, task);
    this.status.activeTasks = this.tasks.size;
    
    // Store in Redis
    await this.redis.setEx(`task:${taskId}`, 3600, JSON.stringify(task));
    
    // Update metrics
    this.metrics.taskCount.inc();
    this.metrics.activeTasks.set(this.tasks.size);
    
    // Assign task to agents
    await this.assignTaskToAgents(task, suitableAgents);
    
    console.log(`📋 Task orchestrated: ${taskId} -> ${suitableAgents.length} agents`);
    
    return task;
  }

  findSuitableAgents(taskData) {
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.status === 'active');
    
    // Simple load balancing - can be enhanced with more sophisticated algorithms
    return availableAgents
      .sort((a, b) => a.taskCount - b.taskCount)
      .slice(0, taskData.agentCount || 1);
  }

  async assignTaskToAgents(task, agents) {
    for (const agent of agents) {
      agent.taskCount++;
      
      // Send task via WebSocket or HTTP
      this.broadcast({
        type: 'task_assigned',
        taskId: task.id,
        agentId: agent.id,
        task
      }, agent.id);
    }
    
    task.status = 'assigned';
    await this.redis.setEx(`task:${task.id}`, 3600, JSON.stringify(task));
  }

  async handleAgentHeartbeat(agentId, data) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date();
      agent.resources = data.resources || agent.resources;
      
      await this.redis.setEx(`agent:${agentId}`, 3600, JSON.stringify(agent));
    }
  }

  async handleTaskUpdate(taskId, status, data) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.lastUpdate = new Date();
      
      if (data) {
        task.result = data;
      }
      
      if (status === 'completed' || status === 'failed') {
        this.status.activeTasks = this.tasks.size - 1;
        this.metrics.activeTasks.set(this.status.activeTasks);
        
        if (status === 'completed') {
          this.metrics.completedTasks.inc();
        } else {
          this.metrics.failedTasks.inc();
        }
      }
      
      await this.redis.setEx(`task:${taskId}`, 3600, JSON.stringify(task));
      
      // Broadcast update
      this.broadcast({ type: 'task_updated', taskId, status, data });
    }
  }

  async scaleSwarm(targetCount, agentType = 'worker') {
    const currentCount = Array.from(this.agents.values())
      .filter(agent => !agentType || agent.type === agentType).length;
    
    if (targetCount > currentCount) {
      // Scale up
      const needed = targetCount - currentCount;
      console.log(`📈 Scaling up: adding ${needed} ${agentType} agents`);
      
      for (let i = 0; i < needed; i++) {
        await this.spawnAgent(agentType);
      }
    } else if (targetCount < currentCount) {
      // Scale down
      const excess = currentCount - targetCount;
      console.log(`📉 Scaling down: removing ${excess} ${agentType} agents`);
      
      const agentsToRemove = Array.from(this.agents.values())
        .filter(agent => !agentType || agent.type === agentType)
        .sort((a, b) => a.taskCount - b.taskCount)
        .slice(0, excess);
      
      for (const agent of agentsToRemove) {
        await this.removeAgent(agent.id);
      }
    }
  }

  async spawnAgent(agentType) {
    try {
      const container = await this.docker.createContainer({
        Image: 'swarm-agent:latest',
        Env: [
          `AGENT_TYPE=${agentType}`,
          `COORDINATOR_URL=http://swarm-coordinator:8090`,
          `REDIS_URL=${this.config.redisUrl}`,
          `LANGFUSE_PUBLIC_KEY=${process.env.LANGFUSE_PUBLIC_KEY}`,
          `LANGFUSE_SECRET_KEY=${process.env.LANGFUSE_SECRET_KEY}`,
          `LANGFUSE_HOST=${process.env.LANGFUSE_HOST}`
        ],
        NetworkMode: 'swarm03_swarm-network'
      });
      
      await container.start();
      console.log(`🚀 Spawned ${agentType} agent: ${container.id.substr(0, 12)}`);
      
      this.metrics.agentSpawns.inc();
      
    } catch (error) {
      console.error(`❌ Failed to spawn ${agentType} agent:`, error);
      this.metrics.agentSpawnFailures.inc();
    }
  }

  async removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent && agent.containerId) {
      try {
        const container = this.docker.getContainer(agent.containerId);
        await container.stop();
        await container.remove();
        
        console.log(`🗑️ Removed agent: ${agentId}`);
        
      } catch (error) {
        console.error(`❌ Failed to remove agent ${agentId}:`, error);
      }
    }
    
    await this.deregisterAgent(agentId);
  }

  async discoverExistingAgents() {
    // Look for existing agent containers
    const containers = await this.docker.listContainers({
      filters: { label: ['swarm.agent=true'] }
    });
    
    console.log(`🔍 Discovered ${containers.length} existing agent containers`);
    
    for (const containerInfo of containers) {
      // Register discovered agents
      // This would typically involve inspecting container labels/env vars
      console.log(`📝 Registering discovered agent: ${containerInfo.Id.substr(0, 12)}`);
    }
  }

  startHealthMonitoring() {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.parseInterval(this.config.healthCheckInterval));
    
    console.log(`❤️ Health monitoring started (${this.config.healthCheckInterval})`);
  }

  async performHealthCheck() {
    this.status.lastHealthCheck = new Date();
    
    const unhealthyAgents = [];
    
    for (const [agentId, agent] of this.agents) {
      const timeSinceLastHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
      
      if (timeSinceLastHeartbeat > 60000) { // 1 minute timeout
        unhealthyAgents.push(agentId);
        agent.status = 'unhealthy';
      }
    }
    
    if (unhealthyAgents.length > 0) {
      console.log(`⚠️ Found ${unhealthyAgents.length} unhealthy agents`);
      
      for (const agentId of unhealthyAgents) {
        await this.handleUnhealthyAgent(agentId);
      }
    }
    
    // Update metrics
    this.metrics.healthyAgents.set(this.agents.size - unhealthyAgents.length);
    this.metrics.unhealthyAgents.set(unhealthyAgents.length);
  }

  async handleUnhealthyAgent(agentId) {
    console.log(`🚨 Handling unhealthy agent: ${agentId}`);
    
    // Try to restart the agent
    await this.removeAgent(agentId);
    
    // If auto-scaling is enabled, spawn a replacement
    if (this.config.autoScaling) {
      const agent = this.agents.get(agentId);
      if (agent) {
        await this.spawnAgent(agent.type);
      }
    }
  }

  startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, 15000); // Every 15 seconds
  }

  collectMetrics() {
    // Update Prometheus metrics
    this.metrics.uptime.set(process.uptime());
    this.metrics.agentCount.set(this.agents.size);
    this.metrics.activeTasks.set(this.status.activeTasks);
    
    // Memory and CPU metrics
    const usage = process.memoryUsage();
    this.metrics.memoryUsage.set(usage.heapUsed);
    this.metrics.memoryTotal.set(usage.heapTotal);
  }

  initializeMetrics() {
    const { Counter, Gauge, Histogram } = require('prom-client');
    
    return {
      agentCount: new Gauge({
        name: 'swarm_agent_count',
        help: 'Number of registered agents'
      }),
      activeTasks: new Gauge({
        name: 'swarm_active_tasks',
        help: 'Number of active tasks'
      }),
      taskCount: new Counter({
        name: 'swarm_task_total',
        help: 'Total number of tasks processed'
      }),
      completedTasks: new Counter({
        name: 'swarm_completed_tasks_total',
        help: 'Number of completed tasks'
      }),
      failedTasks: new Counter({
        name: 'swarm_failed_tasks_total',
        help: 'Number of failed tasks'
      }),
      agentRegistrations: new Counter({
        name: 'swarm_agent_registrations_total',
        help: 'Number of agent registrations'
      }),
      agentDeregistrations: new Counter({
        name: 'swarm_agent_deregistrations_total',
        help: 'Number of agent deregistrations'
      }),
      agentSpawns: new Counter({
        name: 'swarm_agent_spawns_total',
        help: 'Number of agent spawns'
      }),
      agentSpawnFailures: new Counter({
        name: 'swarm_agent_spawn_failures_total',
        help: 'Number of failed agent spawns'
      }),
      healthyAgents: new Gauge({
        name: 'swarm_healthy_agents',
        help: 'Number of healthy agents'
      }),
      unhealthyAgents: new Gauge({
        name: 'swarm_unhealthy_agents',
        help: 'Number of unhealthy agents'
      }),
      uptime: new Gauge({
        name: 'swarm_uptime_seconds',
        help: 'Swarm coordinator uptime in seconds'
      }),
      memoryUsage: new Gauge({
        name: 'swarm_memory_usage_bytes',
        help: 'Memory usage in bytes'
      }),
      memoryTotal: new Gauge({
        name: 'swarm_memory_total_bytes',
        help: 'Total memory in bytes'
      })
    };
  }

  broadcast(message, targetAgentId = null) {
    const messageStr = JSON.stringify(message);
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  parseInterval(intervalStr) {
    const units = { s: 1000, m: 60000, h: 3600000 };
    const match = intervalStr.match(/^(\d+)([smh])$/);
    
    if (!match) return 10000; // default 10 seconds
    
    return parseInt(match[1]) * units[match[2]];
  }

  async shutdown() {
    console.log('🛑 Shutting down Swarm Orchestrator...');
    
    this.status.state = 'shutting_down';
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    // Close HTTP server
    if (this.server) {
      this.server.close();
    }
    
    // Disconnect Redis
    if (this.redis) {
      await this.redis.disconnect();
    }
    
    console.log('✅ Swarm Orchestrator shutdown complete');
  }
}

// Start the orchestrator if run directly
if (require.main === module) {
  const orchestrator = new SwarmOrchestrator();
  
  orchestrator.initialize().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGTERM', () => orchestrator.shutdown());
  process.on('SIGINT', () => orchestrator.shutdown());
}

module.exports = SwarmOrchestrator;