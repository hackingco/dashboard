#!/usr/bin/env node

/**
 * Claude Flow Agent Coordinator
 * Manages agent pool and ensures all agents run with proper tracing
 */

import express from 'express';
import { Langfuse } from 'langfuse';
import Redis from 'redis';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Initialize Langfuse for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
  flushAt: 1,
  flushInterval: 1000
});

// Initialize Redis for agent coordination
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

await redis.connect();

// Agent registry
const agents = new Map();
const agentStatus = new Map();

// Trace all coordinator activities
const coordinatorTrace = langfuse.trace({
  name: 'Claude Flow Coordinator',
  sessionId: `coordinator-${Date.now()}`,
  metadata: {
    role: 'coordinator',
    startTime: new Date().toISOString(),
    environment: 'docker'
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    coordinator: 'active',
    agents: agents.size,
    uptime: process.uptime(),
    tracing: 'enabled'
  };
  
  res.json(health);
});

// Register agent endpoint
app.post('/agent/register', async (req, res) => {
  const { agentId, agentType, capabilities } = req.body;
  
  // Create trace for agent registration
  const registrationSpan = coordinatorTrace.span({
    name: 'Agent Registration',
    input: { agentId, agentType },
    metadata: { timestamp: new Date().toISOString() }
  });
  
  agents.set(agentId, {
    id: agentId,
    type: agentType,
    capabilities,
    status: 'active',
    registeredAt: new Date(),
    container: req.headers['x-container-id'] || 'unknown'
  });
  
  agentStatus.set(agentId, 'idle');
  
  // Store in Redis for persistence
  await redis.hSet('agents', agentId, JSON.stringify(agents.get(agentId)));
  
  registrationSpan.end({
    output: { registered: true, totalAgents: agents.size }
  });
  
  console.log(`✅ Agent registered: ${agentId} (${agentType})`);
  res.json({ success: true, agentId });
});

// Task orchestration endpoint
app.post('/task/orchestrate', async (req, res) => {
  const { task, priority = 'normal', strategy = 'parallel' } = req.body;
  const taskId = `task-${uuidv4()}`;
  
  // Create main task trace
  const taskTrace = langfuse.trace({
    name: 'Task Orchestration',
    sessionId: taskId,
    metadata: {
      task,
      priority,
      strategy,
      coordinator: 'docker-based'
    }
  });
  
  // Find available agents
  const availableAgents = Array.from(agents.entries())
    .filter(([id, agent]) => agentStatus.get(id) === 'idle')
    .map(([id, agent]) => agent);
  
  if (availableAgents.length === 0) {
    taskTrace.generation({
      name: 'No Agents Available',
      input: { task },
      output: { error: 'No idle agents' },
      level: 'ERROR'
    });
    
    return res.status(503).json({ error: 'No available agents' });
  }
  
  // Distribute task to agents
  const assignments = [];
  for (const agent of availableAgents) {
    const subtaskId = `${taskId}-${agent.id}`;
    
    // Create subtask trace
    const subtaskSpan = taskTrace.span({
      name: `Agent Assignment: ${agent.type}`,
      input: {
        agentId: agent.id,
        agentType: agent.type,
        task: task
      }
    });
    
    // Mark agent as busy
    agentStatus.set(agent.id, 'busy');
    
    // Send task to agent via Redis
    await redis.publish(`agent:${agent.id}:tasks`, JSON.stringify({
      taskId: subtaskId,
      task,
      priority,
      assignedAt: new Date().toISOString(),
      traceId: taskTrace.id
    }));
    
    assignments.push({
      agentId: agent.id,
      agentType: agent.type,
      subtaskId
    });
    
    subtaskSpan.end({
      output: { assigned: true }
    });
  }
  
  // Store task in Redis
  await redis.hSet('tasks', taskId, JSON.stringify({
    id: taskId,
    task,
    priority,
    strategy,
    assignments,
    status: 'in_progress',
    createdAt: new Date().toISOString()
  }));
  
  taskTrace.generation({
    name: 'Task Distribution Complete',
    input: { task, agentCount: assignments.length },
    output: { taskId, assignments },
    metadata: { strategy }
  });
  
  console.log(`📋 Task ${taskId} distributed to ${assignments.length} agents`);
  res.json({ taskId, assignments });
});

// Agent status update endpoint
app.post('/agent/status', async (req, res) => {
  const { agentId, status, taskId, result } = req.body;
  
  const statusSpan = coordinatorTrace.span({
    name: 'Agent Status Update',
    input: { agentId, status, taskId }
  });
  
  agentStatus.set(agentId, status);
  
  if (status === 'completed' && taskId) {
    // Update task status in Redis
    const taskData = await redis.hGet('tasks', taskId.split('-')[0]);
    if (taskData) {
      const task = JSON.parse(taskData);
      task.completedAgents = (task.completedAgents || 0) + 1;
      
      if (task.completedAgents === task.assignments.length) {
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
      }
      
      await redis.hSet('tasks', task.id, JSON.stringify(task));
    }
  }
  
  statusSpan.end({
    output: { updated: true, newStatus: status }
  });
  
  res.json({ success: true });
});

// List agents endpoint
app.get('/agents', (req, res) => {
  const agentList = Array.from(agents.values()).map(agent => ({
    ...agent,
    status: agentStatus.get(agent.id)
  }));
  
  res.json({ agents: agentList });
});

// Start coordinator server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🎯 Claude Flow Coordinator running on port ${PORT}`);
  console.log(`📊 Langfuse tracing enabled: ${process.env.LANGFUSE_HOST}`);
  console.log(`🐳 Running in Docker environment`);
  
  coordinatorTrace.generation({
    name: 'Coordinator Started',
    input: { port: PORT },
    output: { status: 'running' },
    metadata: {
      langfuseHost: process.env.LANGFUSE_HOST,
      redisUrl: process.env.REDIS_URL
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down coordinator...');
  
  coordinatorTrace.generation({
    name: 'Coordinator Shutdown',
    input: { signal: 'SIGTERM' },
    output: { graceful: true }
  });
  
  await langfuse.flush();
  await redis.quit();
  process.exit(0);
});