#!/usr/bin/env node

/**
 * Docker Swarm Coordinator with Real-time Langfuse Integration
 * Coordinates distributed swarm agents with enhanced tracing
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// Initialize configuration
const config = {
  port: process.env.COORDINATOR_PORT || 8000,
  swarmId: process.env.SWARM_ID || `docker-swarm-${Date.now()}`,
  agentCount: parseInt(process.env.AGENT_COUNT || '8'),
  langfuseHost: process.env.LANGFUSE_HOST || 'http://langfuse:3000',
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk_lf_demo',
  secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk_lf_demo',
  memoryPath: process.env.MEMORY_DB_PATH || '/app/data/memory.db',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379'
};

console.log('🐝 DOCKER SWARM COORDINATOR STARTING');
console.log('═══════════════════════════════════════');
console.log(`Swarm ID: ${config.swarmId}`);
console.log(`Agent Count Target: ${config.agentCount}`);
console.log(`Langfuse Host: ${config.langfuseHost}`);
console.log(`Memory DB: ${config.memoryPath}`);

// Initialize Langfuse wrapper with fallback
let LangfuseWrapper;
try {
  // Try to use real Langfuse if available
  const Langfuse = require('langfuse').Langfuse;
  const client = new Langfuse({
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    baseUrl: config.langfuseHost,
    flushAt: 10,
    flushInterval: 5000
  });
  
  LangfuseWrapper = {
    isEnabled: () => true,
    preHook: async (context) => {
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const trace = client.trace({
        id: traceId,
        name: context.hookType,
        metadata: context.metadata
      });
      return traceId;
    },
    postHook: async (traceId, result, tokenUsage) => {
      if (traceId) {
        client.trace({ id: traceId, output: result });
        await client.flushAsync();
      }
    },
    errorHook: async (traceId, error) => {
      if (traceId) {
        client.trace({ id: traceId, output: { error: error.message } });
        await client.flushAsync();
      }
    },
    shutdown: async () => {
      await client.shutdownAsync();
    }
  };
  console.log('✅ Langfuse client initialized');
} catch (error) {
  console.log('⚠️  Using fallback wrapper (Langfuse not available):', error.message);
  LangfuseWrapper = {
    isEnabled: () => false,
    preHook: async () => null,
    postHook: async () => {},
    errorHook: async () => {},
    shutdown: async () => {}
  };
}

// Initialize Express app and Socket.IO
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());

// State management
const swarmState = {
  agents: new Map(),
  tasks: new Map(),
  traces: new Map(),
  performance: {
    startTime: Date.now(),
    totalTasks: 0,
    completedTasks: 0,
    errors: 0
  },
  lessons: new Map()
};

// Initialize memory database
function initializeMemory() {
  try {
    const { execSync } = require('child_process');
    
    // Ensure data directory exists
    const dataDir = path.dirname(config.memoryPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize database
    execSync(`sqlite3 ${config.memoryPath} "CREATE TABLE IF NOT EXISTS coordination (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      swarm_id TEXT,
      agent_id TEXT,
      task_id TEXT,
      event_type TEXT,
      data TEXT,
      timestamp INTEGER,
      trace_id TEXT
    )"`);

    execSync(`sqlite3 ${config.memoryPath} "CREATE TABLE IF NOT EXISTS lessons_learned (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      lesson TEXT,
      context TEXT,
      confidence REAL,
      timestamp INTEGER,
      metadata TEXT
    )"`);

    execSync(`sqlite3 ${config.memoryPath} "CREATE TABLE IF NOT EXISTS real_time_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT,
      value REAL,
      agent_id TEXT,
      timestamp INTEGER,
      metadata TEXT
    )"`);

    console.log('✅ Memory database initialized');
    return true;
  } catch (error) {
    console.error('❌ Memory initialization failed:', error);
    return false;
  }
}

const memoryActive = initializeMemory();

// Enhanced tracing functions
async function startTrace(context) {
  const traceId = await LangfuseWrapper.preHook({
    hookType: 'docker_coordination',
    swarmId: config.swarmId,
    agentId: context.agentId,
    agentRole: context.agentType,
    operationType: context.operation,
    metadata: {
      containerized: true,
      coordinator: true,
      realTimeTracing: true,
      ...context.metadata
    }
  });

  if (traceId) {
    swarmState.traces.set(context.id || context.agentId, {
      traceId,
      startTime: Date.now(),
      context,
      observations: []
    });
  }

  return traceId;
}

async function addObservation(agentId, observation) {
  const trace = swarmState.traces.get(agentId);
  if (trace) {
    trace.observations.push({
      timestamp: Date.now(),
      ...observation
    });

    // Store in memory for lessons learned
    if (memoryActive) {
      try {
        const { execSync } = require('child_process');
        execSync(`sqlite3 ${config.memoryPath} "INSERT INTO real_time_metrics (metric_type, value, agent_id, timestamp, metadata) VALUES ('${observation.type}', ${observation.value || 0}, '${agentId}', ${Date.now()}, '${JSON.stringify(observation)}')"`);
      } catch (error) {
        console.warn('Failed to store observation:', error);
      }
    }

    // Emit real-time update
    io.emit('traceUpdate', {
      agentId,
      observation,
      timestamp: Date.now()
    });
  }
}

async function completeTrace(agentId, result) {
  const trace = swarmState.traces.get(agentId);
  if (trace && trace.traceId) {
    await LangfuseWrapper.postHook(
      trace.traceId,
      {
        ...result,
        observations: trace.observations,
        duration: Date.now() - trace.startTime
      },
      {
        input: 0,
        output: 50,
        total: 50
      },
      {
        containerized: true,
        observationCount: trace.observations.length
      }
    );

    swarmState.traces.delete(agentId);
  }
}

// Lessons learned system
async function logLesson(category, lesson, context, confidence = 0.8) {
  const lessonData = {
    category,
    lesson,
    context: JSON.stringify(context),
    confidence,
    timestamp: Date.now(),
    metadata: JSON.stringify({
      swarmId: config.swarmId,
      containerized: true
    })
  };

  // Store in memory
  if (memoryActive) {
    try {
      const { execSync } = require('child_process');
      execSync(`sqlite3 ${config.memoryPath} "INSERT INTO lessons_learned (category, lesson, context, confidence, timestamp, metadata) VALUES ('${category}', '${lesson.replace(/'/g, "''")}', '${lessonData.context}', ${confidence}, ${Date.now()}, '${lessonData.metadata}')"`);
      
      console.log(`📚 Lesson learned [${category}]: ${lesson}`);
      
      // Emit to dashboard
      io.emit('lessonLearned', lessonData);
    } catch (error) {
      console.warn('Failed to store lesson:', error);
    }
  }

  // Store in local state
  const lessonId = Date.now().toString();
  swarmState.lessons.set(lessonId, lessonData);
}

// API Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    swarmId: config.swarmId,
    agentCount: swarmState.agents.size,
    uptime: Date.now() - swarmState.performance.startTime,
    langfuseEnabled: LangfuseWrapper.isEnabled(),
    memoryActive
  });
});

app.post('/agent/register', async (req, res) => {
  const { agentId, agentType, capabilities, containerInfo } = req.body;
  
  console.log(`🤖 Agent registering: ${agentId} (${agentType})`);

  // Start trace for agent registration
  const traceId = await startTrace({
    id: agentId,
    agentId,
    agentType,
    operation: 'agent_registration',
    metadata: { capabilities, containerInfo }
  });

  const agent = {
    id: agentId,
    type: agentType,
    capabilities: capabilities || [],
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
    status: 'active',
    containerInfo,
    traceId,
    tasks: 0,
    performance: {
      totalTasks: 0,
      avgResponseTime: 0,
      errorRate: 0
    }
  };

  swarmState.agents.set(agentId, agent);

  // Add registration observation
  await addObservation(agentId, {
    type: 'agent_registration',
    value: 1,
    details: `Agent ${agentType} registered successfully`,
    capabilities
  });

  // Log lesson about agent registration patterns
  await logLesson(
    'agent_registration',
    `Agent type ${agentType} registered with ${capabilities.length} capabilities`,
    { agentType, capabilities, containerInfo },
    0.9
  );

  // Complete registration trace
  await completeTrace(agentId, {
    status: 'registered',
    agentType,
    capabilities
  });

  // Store coordination event
  if (memoryActive) {
    try {
      const { execSync } = require('child_process');
      execSync(`sqlite3 ${config.memoryPath} "INSERT INTO coordination (swarm_id, agent_id, event_type, data, timestamp, trace_id) VALUES ('${config.swarmId}', '${agentId}', 'registration', '${JSON.stringify(agent)}', ${Date.now()}, '${traceId || 'null'}')"`, { encoding: 'utf8' });
    } catch (error) {
      console.warn('Failed to store coordination event:', error);
    }
  }

  // Emit real-time update
  io.emit('agentRegistered', agent);

  res.json({
    success: true,
    swarmId: config.swarmId,
    agentId,
    coordinationEndpoint: '/coordination',
    traceId
  });
});

app.post('/agent/heartbeat', async (req, res) => {
  const { agentId, status, metrics } = req.body;
  
  const agent = swarmState.agents.get(agentId);
  if (agent) {
    agent.lastHeartbeat = Date.now();
    agent.status = status || 'active';
    
    if (metrics) {
      agent.performance = { ...agent.performance, ...metrics };
      
      // Add performance observation
      await addObservation(agentId, {
        type: 'heartbeat',
        value: metrics.avgResponseTime || 0,
        details: 'Agent heartbeat with metrics',
        metrics
      });

      // Emit real-time metrics
      io.emit('agentMetrics', {
        agentId,
        metrics,
        timestamp: Date.now()
      });
    }
  }

  res.json({ success: true, timestamp: Date.now() });
});

app.post('/task/assign', async (req, res) => {
  const { taskId, agentId, task, priority } = req.body;
  
  console.log(`📋 Assigning task ${taskId} to ${agentId}`);

  // Start trace for task assignment
  const traceId = await startTrace({
    id: taskId,
    agentId,
    agentType: swarmState.agents.get(agentId)?.type,
    operation: 'task_assignment',
    metadata: { task, priority, taskId }
  });

  const taskData = {
    id: taskId,
    agentId,
    task,
    priority: priority || 'medium',
    assignedAt: Date.now(),
    status: 'assigned',
    traceId
  };

  swarmState.tasks.set(taskId, taskData);

  // Update agent task count
  const agent = swarmState.agents.get(agentId);
  if (agent) {
    agent.tasks++;
    agent.performance.totalTasks++;
  }

  // Add task assignment observation
  await addObservation(agentId, {
    type: 'task_assignment',
    value: 1,
    details: `Task ${taskId} assigned with priority ${priority}`,
    taskId,
    priority
  });

  // Log lesson about task assignment
  await logLesson(
    'task_assignment',
    `Task assigned to ${agent?.type || 'unknown'} agent with priority ${priority}`,
    { taskId, agentType: agent?.type, priority },
    0.8
  );

  res.json({
    success: true,
    taskId,
    traceId,
    estimatedCompletion: Date.now() + (30000 * (priority === 'high' ? 0.5 : priority === 'low' ? 2 : 1))
  });
});

app.post('/task/complete', async (req, res) => {
  const { taskId, agentId, result, metrics } = req.body;
  
  console.log(`✅ Task ${taskId} completed by ${agentId}`);

  const task = swarmState.tasks.get(taskId);
  if (task) {
    task.status = 'completed';
    task.completedAt = Date.now();
    task.duration = task.completedAt - task.assignedAt;
    task.result = result;

    swarmState.performance.completedTasks++;

    // Add completion observation
    await addObservation(agentId, {
      type: 'task_completion',
      value: task.duration,
      details: `Task ${taskId} completed in ${task.duration}ms`,
      taskId,
      duration: task.duration,
      result
    });

    // Complete task trace
    await completeTrace(taskId, {
      status: 'completed',
      duration: task.duration,
      result,
      metrics
    });

    // Log performance lesson
    const performanceCategory = task.duration < 10000 ? 'fast_execution' : 
                               task.duration < 30000 ? 'normal_execution' : 'slow_execution';
    
    await logLesson(
      performanceCategory,
      `Task completion took ${task.duration}ms for ${task.priority} priority task`,
      { taskId, duration: task.duration, priority: task.priority, agentType: swarmState.agents.get(agentId)?.type },
      0.9
    );

    // Emit completion event
    io.emit('taskCompleted', {
      taskId,
      agentId,
      duration: task.duration,
      result,
      timestamp: Date.now()
    });
  }

  res.json({ success: true, taskId });
});

// Real-time dashboard endpoints
app.get('/dashboard/state', (req, res) => {
  const agents = Array.from(swarmState.agents.values());
  const tasks = Array.from(swarmState.tasks.values());
  const lessons = Array.from(swarmState.lessons.values()).slice(-50); // Recent 50 lessons

  res.json({
    swarmId: config.swarmId,
    agents,
    tasks,
    performance: swarmState.performance,
    lessons,
    traceCount: swarmState.traces.size,
    timestamp: Date.now()
  });
});

app.get('/dashboard/metrics', async (req, res) => {
  if (!memoryActive) {
    return res.json({ error: 'Memory not available' });
  }

  try {
    const { execSync } = require('child_process');
    
    // Get recent metrics
    const metricsQuery = `sqlite3 ${config.memoryPath} "SELECT * FROM real_time_metrics WHERE timestamp > ${Date.now() - 3600000} ORDER BY timestamp DESC LIMIT 100"`;
    const metricsResult = execSync(metricsQuery, { encoding: 'utf8' }).trim();
    
    const metrics = metricsResult ? metricsResult.split('\n').map(line => {
      const [id, metric_type, value, agent_id, timestamp, metadata] = line.split('|');
      return { id, metric_type, value: parseFloat(value), agent_id, timestamp: parseInt(timestamp), metadata };
    }) : [];

    res.json({ metrics, count: metrics.length });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('📡 Dashboard connected:', socket.id);
  
  // Send current state
  socket.emit('initialState', {
    swarmId: config.swarmId,
    agents: Array.from(swarmState.agents.values()),
    tasks: Array.from(swarmState.tasks.values()),
    performance: swarmState.performance
  });

  socket.on('disconnect', () => {
    console.log('📡 Dashboard disconnected:', socket.id);
  });
});

// Periodic health monitoring
setInterval(async () => {
  const now = Date.now();
  let inactiveAgents = 0;

  for (const [agentId, agent] of swarmState.agents.entries()) {
    if (now - agent.lastHeartbeat > 60000) { // 1 minute timeout
      agent.status = 'inactive';
      inactiveAgents++;

      await addObservation(agentId, {
        type: 'agent_timeout',
        value: now - agent.lastHeartbeat,
        details: 'Agent became inactive'
      });

      await logLesson(
        'agent_health',
        `Agent ${agentId} (${agent.type}) became inactive after ${now - agent.lastHeartbeat}ms`,
        { agentId, agentType: agent.type, lastHeartbeat: agent.lastHeartbeat },
        0.9
      );
    }
  }

  // Emit health update
  io.emit('healthUpdate', {
    totalAgents: swarmState.agents.size,
    activeAgents: swarmState.agents.size - inactiveAgents,
    inactiveAgents,
    performance: swarmState.performance,
    timestamp: now
  });
}, 30000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down coordinator...');
  
  // Complete all active traces
  for (const [agentId, trace] of swarmState.traces.entries()) {
    await completeTrace(agentId, { status: 'interrupted', reason: 'coordinator_shutdown' });
  }

  await LangfuseWrapper.shutdown();
  server.close();
  process.exit(0);
});

// Start server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Coordinator running on port ${config.port}`);
  console.log(`📊 Dashboard available at http://localhost:3001`);
  console.log(`🔍 Langfuse dashboard at ${config.langfuseHost}`);
  console.log('⚡ Ready for agent connections...');
});