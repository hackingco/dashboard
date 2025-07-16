#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { autoInitTracing, createTracingMiddleware } from './tracing/auto-init.js';
import { tracing } from './tracing/index.js';
import logger from './utils/logger.js';
import { realTimeMonitor } from './monitoring/real-time-monitor.js';
import { eventCollector } from './monitoring/event-collector.js';
import { swarmManager } from './agents/swarm-manager.js';
import { memoryManager } from './memory/memory-manager.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Initialize tracing
let tracingManager = null;
try {
  tracingManager = await autoInitTracing({
    context: {
      sessionId: `server-${Date.now()}`,
      agentId: 'claude-flow-server'
    }
  });
  app.use(createTracingMiddleware());
  logger.info('Tracing initialized for server');
} catch (error) {
  logger.error('Failed to initialize tracing', error);
}

// Initialize real-time monitoring
try {
  await realTimeMonitor.initialize(3333);
  logger.info('Real-time monitoring server started on port 3333');
  
  // Register event sources
  eventCollector.registerSource('express', app, {
    'request': 'http.request',
    'error': 'http.error'
  });
  
  if (swarmManager) {
    eventCollector.registerSource('swarm', swarmManager, {
      'agent-spawned': 'agent.spawned',
      'agent-terminated': 'agent.terminated',
      'task-assigned': 'task.assigned',
      'task-completed': 'task.completed',
      'task-failed': 'task.failed'
    });
  }
  
  if (memoryManager) {
    eventCollector.registerSource('memory', memoryManager, {
      'memory-stored': 'memory.stored',
      'memory-retrieved': 'memory.retrieved',
      'memory-deleted': 'memory.deleted'
    });
  }
  
  eventCollector.start();
  logger.info('Event collector started');
} catch (error) {
  logger.error('Failed to initialize monitoring', error);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'claude-flow-core',
    version: pkg.version,
    timestamp: new Date().toISOString(),
    swarm: {
      enabled: process.env.SWARM_COORDINATION_ENABLED === 'true',
      agents: 0,
      tasks: 0
    }
  });
});

// Swarm API endpoints
app.get('/api/swarm/status', (req, res) => {
  const swarmStatus = swarmManager.getAgentStatus();
  const taskStatus = swarmManager.getTaskStatus();
  
  res.json({
    swarmId: 'claude-flow-docker-swarm',
    status: 'active',
    topology: swarmManager.topology,
    agents: swarmStatus.total,
    activeAgents: swarmStatus.active,
    tasks: taskStatus.total,
    completedTasks: taskStatus.completed,
    failedTasks: taskStatus.failed,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/agents', (req, res) => {
  const agentStatus = swarmManager.getAgentStatus();
  res.json({
    agents: agentStatus.agents
  });
});

// MCP Server endpoint
app.get('/mcp/status', (req, res) => {
  res.json({
    mcpServer: {
      enabled: process.env.MCP_SERVER_ENABLED === 'true',
      port: process.env.MCP_SERVER_PORT || 8081,
      tools: 87,
      status: 'active'
    }
  });
});

// Langfuse integration status
app.get('/api/langfuse/status', async (req, res) => {
  try {
    const health = await tracing.healthCheck();
    const metrics = await tracing.generateMetrics();
    
    res.json({
      langfuse: {
        baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
        connected: health.status === 'healthy',
        initialized: tracing.isEnabled(),
        traces: metrics.client?.activeTraces || 0,
        spans: metrics.client?.activeSpans || 0,
        health: health
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get tracing status',
      message: error.message
    });
  }
});

// Tracing endpoints
app.get('/api/tracing/health', async (req, res) => {
  try {
    const health = await tracing.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

app.get('/api/tracing/metrics', async (req, res) => {
  try {
    const metrics = await tracing.generateMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

app.post('/api/tracing/flush', async (req, res) => {
  try {
    await tracing.flush();
    res.json({ success: true, message: 'Traces flushed' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to flush traces',
      message: error.message
    });
  }
});

// Real-time monitoring API endpoints
app.get('/api/monitoring/events', (req, res) => {
  const filter = {
    source: req.query.source,
    type: req.query.type,
    limit: parseInt(req.query.limit) || 100
  };
  
  const events = eventCollector.getEvents(filter);
  res.json({ events });
});

app.get('/api/monitoring/metrics', (req, res) => {
  const metrics = realTimeMonitor.getMetrics();
  const aggregators = eventCollector.getAllAggregatorStates();
  
  res.json({
    realtime: metrics,
    aggregators: aggregators,
    sources: eventCollector.getSourceStats()
  });
});

app.get('/api/monitoring/status', (req, res) => {
  res.json({
    monitoring: {
      websocket: {
        enabled: true,
        port: 3333,
        url: 'ws://localhost:3333'
      },
      events: {
        total: eventCollector.eventBuffer.length,
        sources: Object.keys(eventCollector.getSourceStats())
      },
      metrics: realTimeMonitor.getMetrics()
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Claude Flow Core Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🐝 Swarm status: http://localhost:${port}/api/swarm/status`);
  console.log(`🔊 Real-time monitor: ws://localhost:3333`);
  console.log(`📈 Monitoring status: http://localhost:${port}/api/monitoring/status`);
});