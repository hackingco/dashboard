#!/usr/bin/env node

/**
 * Swarm Agent - Scalable worker agent
 * Supports multiple agent types: coder, analyst, researcher, tester, optimizer
 */

const express = require('express');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

// Initialize environment
const PORT = process.env.PORT || 8001;
const AGENT_TYPE = process.env.AGENT_TYPE || 'coder';
const AGENT_ID = process.env.AGENT_ID || `${AGENT_TYPE}_${uuidv4().slice(0, 8)}`;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: `/app/logs/${AGENT_ID}.log` }),
    new winston.transports.Console()
  ]
});

// Express app setup
const app = express();
app.use(express.json());

// Agent capabilities by type
const AGENT_TYPE_CAPABILITIES = {
  coder: ['coding', 'debugging', 'testing', 'code-review'],
  analyst: ['analysis', 'data-processing', 'reporting', 'visualization'],
  researcher: ['research', 'information-gathering', 'documentation', 'analysis'],
  tester: ['testing', 'qa', 'automation', 'validation'],
  optimizer: ['optimization', 'performance', 'efficiency', 'monitoring'],
  coordinator: ['coordination', 'orchestration', 'planning', 'management']
};

// State management
class SwarmAgent {
  constructor() {
    this.id = AGENT_ID;
    this.type = AGENT_TYPE;
    this.capabilities = AGENT_TYPE_CAPABILITIES[AGENT_TYPE] || [];
    this.status = 'available';
    this.performance = {
      tasksCompleted: 0,
      tasksSuccess: 0,
      tasksFailed: 0,
      averageTaskTime: 0
    };
  }

  getStatus() {
    return {
      agent: {
        id: this.id,
        type: this.type,
        capabilities: this.capabilities,
        status: this.status,
        uptime: process.uptime()
      },
      performance: this.performance
    };
  }
}

// Initialize agent
const agent = new SwarmAgent();

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'swarm-agent',
    agentId: agent.id,
    agentType: agent.type,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/status', (req, res) => {
  res.json(agent.getStatus());
});

// Start server
app.listen(PORT, () => {
  logger.info(`Swarm Agent running on port ${PORT}`, {
    agentId: agent.id,
    agentType: agent.type,
    capabilities: agent.capabilities
  });
});

module.exports = agent;