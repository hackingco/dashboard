const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'hive-mind',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Claude Flow Hive Mind',
    status: 'operational',
    description: 'Central swarm intelligence coordination service',
    endpoints: {
      health: '/health',
      status: '/status',
      agents: '/agents',
      tasks: '/tasks'
    }
  });
});

// Swarm status
app.get('/status', (req, res) => {
  res.json({
    swarm: {
      status: 'active',
      agents: {
        total: 3,
        active: 3,
        types: ['coordinator', 'coder', 'researcher']
      },
      coordination: 'hierarchical',
      memory: 'operational'
    }
  });
});

// Agent management
app.get('/agents', (req, res) => {
  res.json({
    agents: [
      { id: 'coordinator-001', type: 'coordinator', status: 'active', tasks: 2 },
      { id: 'agent-001', type: 'coder', status: 'active', tasks: 1 },
      { id: 'agent-002', type: 'researcher', status: 'active', tasks: 0 },
      { id: 'agent-003', type: 'analyst', status: 'active', tasks: 1 }
    ]
  });
});

// Task management
app.get('/tasks', (req, res) => {
  res.json({
    tasks: {
      total: 4,
      pending: 1,
      running: 2,
      completed: 1
    },
    queue: [
      { id: 'task-001', type: 'analysis', status: 'running', agent: 'agent-001' },
      { id: 'task-002', type: 'coordination', status: 'running', agent: 'coordinator-001' },
      { id: 'task-003', type: 'research', status: 'pending', agent: null }
    ]
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🐝 Hive Mind coordination service running on port ${PORT}`);
  console.log(`🎯 Service endpoints available at http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Hive Mind service shutting down gracefully...');
  process.exit(0);
});