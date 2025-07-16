#!/usr/bin/env node

/**
 * Swarm Coordinator - Central orchestration service
 * Manages task distribution, agent coordination, and hive mind integration
 */

const express = require('express');
const Redis = require('ioredis');
const { WebSocketServer } = require('ws');
const http = require('http');
const winston = require('winston');

// Initialize environment
const PORT = process.env.PORT || 8000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const HIVE_MIND_URL = process.env.HIVE_MIND_URL || 'http://localhost:8888';
const CLAUDE_FLOW_URL = process.env.CLAUDE_FLOW_URL || 'http://localhost:8890';
const COORDINATION_STRATEGY = process.env.COORDINATION_STRATEGY || 'hierarchical';
const MAX_CONCURRENT_TASKS = parseInt(process.env.MAX_CONCURRENT_TASKS) || 10;

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/app/logs/coordinator.log' }),
    new winston.transports.Console()
  ]
});

// Initialize Redis clients
const redis = new Redis(REDIS_URL, {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
});

const redisPub = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);

// Express app setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// State management
class SwarmCoordinator {
  constructor() {
    this.agents = new Map();
    this.tasks = new Map();
    this.taskQueue = [];
    this.activeTasks = new Set();
    this.coordination = {
      strategy: COORDINATION_STRATEGY,
      maxConcurrentTasks: MAX_CONCURRENT_TASKS,
      topology: 'hierarchical'
    };
    
    this.init();
  }

  async init() {
    try {
      // Connect to coordination services
      await this.connectToHiveMind();
      await this.connectToClaudeFlow();
      
      // Setup Redis subscriptions
      await this.setupRedisSubscriptions();
      
      // Start coordination loops
      this.startTaskDistribution();
      this.startHealthMonitoring();
      
      logger.info('Swarm Coordinator initialized successfully', {
        strategy: this.coordination.strategy,
        maxTasks: this.coordination.maxConcurrentTasks
      });
    } catch (error) {
      logger.error('Failed to initialize coordinator', { error: error.message });
      process.exit(1);
    }
  }

  async connectToHiveMind() {
    try {
      const response = await fetch(`${HIVE_MIND_URL}/health`);
      if (response.ok) {
        logger.info('Connected to Hive Mind', { url: HIVE_MIND_URL });
        return true;
      }
    } catch (error) {
      logger.warn('Hive Mind connection failed', { error: error.message });
    }
    return false;
  }

  async connectToClaudeFlow() {
    try {
      const response = await fetch(`${CLAUDE_FLOW_URL}/health`);
      if (response.ok) {
        logger.info('Connected to Claude Flow MCP', { url: CLAUDE_FLOW_URL });
        return true;
      }
    } catch (error) {
      logger.warn('Claude Flow connection failed', { error: error.message });
    }
    return false;
  }

  getStatus() {
    return {
      coordinator: {
        strategy: this.coordination.strategy,
        maxConcurrentTasks: this.coordination.maxConcurrentTasks,
        uptime: process.uptime()
      },
      agents: {
        total: this.agents.size,
        available: Array.from(this.agents.values()).filter(a => a.status === 'available').length,
        busy: Array.from(this.agents.values()).filter(a => a.status === 'busy').length,
        stale: Array.from(this.agents.values()).filter(a => a.status === 'stale').length
      },
      tasks: {
        total: this.tasks.size,
        queued: this.taskQueue.length,
        active: this.activeTasks.size,
        completed: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length
      }
    };
  }
}

// Initialize coordinator
const coordinator = new SwarmCoordinator();

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'swarm-coordinator',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/status', (req, res) => {
  res.json(coordinator.getStatus());
});

// Start server
server.listen(PORT, () => {
  logger.info(`Swarm Coordinator running on port ${PORT}`);
});

module.exports = coordinator;