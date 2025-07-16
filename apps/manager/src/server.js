const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'manager-api',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Claude Flow Swarm Manager API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/health',
      swarm: '/api/swarm',
      agents: '/api/agents',
      tasks: '/api/tasks',
      metrics: '/api/metrics'
    }
  });
});

// Swarm management
app.get('/api/swarm', (req, res) => {
  res.json({
    id: 'swarm-001',
    status: 'active',
    coordination: 'hierarchical',
    created: '2024-07-14T10:00:00Z',
    agents: {
      total: 4,
      active: 4,
      coordinator: 1,
      workers: 3
    },
    infrastructure: {
      postgres: { status: 'healthy', port: 5432 },
      redis: { status: 'healthy', port: 6379 },
      clickhouse: { status: 'healthy', port: 8123 }
    }
  });
});

// Agent management
app.get('/api/agents', (req, res) => {
  res.json([
    {
      id: 'coordinator-001',
      type: 'coordinator',
      status: 'active',
      capabilities: ['task_delegation', 'resource_allocation', 'monitoring'],
      current_tasks: 2,
      uptime: '0h 45m'
    },
    {
      id: 'agent-001', 
      type: 'coder',
      status: 'active',
      capabilities: ['code_generation', 'testing', 'debugging'],
      current_tasks: 1,
      uptime: '0h 45m'
    },
    {
      id: 'agent-002',
      type: 'researcher', 
      status: 'active',
      capabilities: ['web_search', 'analysis', 'documentation'],
      current_tasks: 0,
      uptime: '0h 45m'
    },
    {
      id: 'agent-003',
      type: 'analyst',
      status: 'active', 
      capabilities: ['data_analysis', 'performance_monitoring'],
      current_tasks: 1,
      uptime: '0h 45m'
    }
  ]);
});

// Task management
app.get('/api/tasks', (req, res) => {
  res.json({
    summary: {
      total: 8,
      pending: 2,
      running: 3,
      completed: 3,
      failed: 0
    },
    active_tasks: [
      {
        id: 'task-001',
        type: 'code_generation',
        status: 'running',
        agent: 'agent-001',
        started: '2024-07-14T10:30:00Z',
        estimated_completion: '2024-07-14T11:00:00Z'
      },
      {
        id: 'task-002', 
        type: 'coordination',
        status: 'running',
        agent: 'coordinator-001',
        started: '2024-07-14T10:25:00Z',
        estimated_completion: '2024-07-14T10:50:00Z'
      },
      {
        id: 'task-003',
        type: 'analysis',
        status: 'running', 
        agent: 'agent-003',
        started: '2024-07-14T10:35:00Z',
        estimated_completion: '2024-07-14T11:05:00Z'
      }
    ]
  });
});

// Performance metrics
app.get('/api/metrics', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    swarm: {
      efficiency: 87.5,
      task_completion_rate: 94.2,
      average_response_time: '2.3s',
      coordination_latency: '150ms'
    },
    infrastructure: {
      cpu_usage: 45.2,
      memory_usage: 62.8,
      disk_usage: 23.1,
      network_throughput: '125 MB/s'
    },
    agents: {
      average_utilization: 68.4,
      task_success_rate: 96.7,
      coordination_overhead: 8.2
    }
  });
});

// Task creation endpoint
app.post('/api/tasks', (req, res) => {
  const { type, description, priority = 'medium' } = req.body;
  
  const task = {
    id: `task-${Date.now()}`,
    type,
    description,
    priority,
    status: 'pending',
    created: new Date().toISOString(),
    agent: null
  };
  
  res.status(201).json({
    message: 'Task created successfully',
    task
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎛️ Swarm Manager API running on port ${PORT}`);
  console.log(`🔗 API available at http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Manager API shutting down gracefully...');
  process.exit(0);
});