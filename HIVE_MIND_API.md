# Claude Flow Hive Mind API Documentation

## Overview

The Hive Mind API integrates Claude Flow's powerful swarm orchestration capabilities into the Manager service. This enables intelligent agent coordination, neural pattern learning, and persistent memory across swarm operations.

## Base URL

```
http://localhost:3001/api/enhanced-swarms
```

## Authentication

Currently using basic API authentication. Include your API key in the headers:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### 1. Create Swarm

Create a new swarm with Claude Flow integration.

**POST** `/api/enhanced-swarms`

**Request Body:**
```json
{
  "name": "My AI Swarm",
  "purpose": "Coordinate complex development tasks",
  "agents": [
    {
      "name": "Lead Coordinator",
      "role": "coordinator",
      "tasks": ["plan", "delegate", "monitor"]
    },
    {
      "name": "Code Expert",
      "role": "coder",
      "tasks": ["implement", "refactor", "debug"]
    }
  ],
  "configuration": {
    "maxWorkers": 10,
    "autoScale": true,
    "priority": "high",
    "resources": {
      "cpu": "shared-cpu-2x",
      "memory": "512MB"
    }
  },
  "tags": ["development", "ai-powered"]
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "name": "My AI Swarm",
  "status": "initializing",
  "agents": [...],
  "createdAt": "2024-01-12T10:00:00Z",
  "topology": "hierarchical",
  "neural": {
    "enabled": true,
    "accuracy": 0
  }
}
```

### 2. Scale Swarm

Dynamically scale the number of agents in a swarm.

**POST** `/api/enhanced-swarms/:id/scale`

**Request Body:**
```json
{
  "targetAgents": 15
}
```

**Response:**
```json
{
  "id": "swarm-id",
  "status": "scaling",
  "currentAgents": 10,
  "targetAgents": 15
}
```

### 3. Get Swarm Intelligence

Retrieve neural patterns, memory, and agent intelligence data.

**GET** `/api/enhanced-swarms/:id/intelligence`

**Response:**
```json
{
  "swarmId": "uuid",
  "neural": {
    "status": "active",
    "patterns": [
      {
        "type": "task-delegation",
        "accuracy": 0.85,
        "uses": 142
      }
    ],
    "accuracy": 0.78,
    "training": false
  },
  "memory": {
    "status": "healthy",
    "recent": [
      {
        "key": "decision/architecture",
        "value": { "pattern": "microservices", "reason": "scalability" },
        "updated": "2024-01-12T09:45:00Z"
      }
    ],
    "size": 234
  },
  "agents": [
    {
      "id": "agent-1",
      "type": "coordinator",
      "intelligence": {
        "tasksCompleted": 45,
        "successRate": 0.91,
        "specializations": ["planning", "orchestration"]
      }
    }
  ]
}
```

### 4. Train Neural Patterns

Train the swarm's neural patterns for improved coordination.

**POST** `/api/enhanced-swarms/:id/neural/train`

**Request Body:**
```json
{
  "iterations": 20
}
```

**Response:**
```json
{
  "id": "swarm-id",
  "training": "completed",
  "iterations": 20
}
```

### 5. Assign Task to Agent

Assign a specific task to an agent within the swarm.

**POST** `/api/enhanced-swarms/:id/agents/:agentId/task`

**Request Body:**
```json
{
  "description": "Implement user authentication with JWT",
  "priority": "high"
}
```

**Response:**
```json
{
  "id": "task-uuid",
  "description": "Implement user authentication with JWT",
  "priority": "high",
  "status": "pending",
  "assignedTo": "agent-id",
  "createdAt": "2024-01-12T10:15:00Z"
}
```

### 6. Get Swarm Performance Analysis

Analyze swarm performance including bottlenecks and token usage.

**GET** `/api/enhanced-swarms/:id/performance`

**Response:**
```json
{
  "performance": {
    "throughput": "84.8%",
    "avgResponseTime": 1234,
    "efficiency": 0.92
  },
  "bottlenecks": [
    {
      "component": "memory-retrieval",
      "impact": "medium",
      "suggestion": "Implement caching layer"
    }
  ],
  "tokenUsage": {
    "total": 145678,
    "byOperation": {
      "coordination": 45000,
      "execution": 78000,
      "memory": 22678
    }
  },
  "agents": [
    {
      "id": "agent-1",
      "metrics": {
        "tasksCompleted": 45,
        "tasksFailed": 2,
        "successRate": 0.96,
        "avgResponseTime": 1100
      }
    }
  ],
  "tasks": {
    "active": 3,
    "completed": 142,
    "failed": 8
  }
}
```

### 7. List Swarms with Filtering

Get all swarms with advanced filtering and pagination.

**GET** `/api/enhanced-swarms`

**Query Parameters:**
- `status[]`: Filter by status (initializing, running, scaling, stopped, error)
- `tags[]`: Filter by tags
- `priority[]`: Filter by priority (low, medium, high)
- `search`: Search in name, purpose, or agent names
- `sortBy`: Sort field (name, created, status, priority, agentCount)
- `sortOrder`: Sort order (asc, desc)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Example:**
```
GET /api/enhanced-swarms?status[]=running&tags[]=ai-powered&sortBy=created&sortOrder=desc&page=1&limit=10
```

### 8. Get Swarm Tree Hierarchy

Visualize the swarm hierarchy including all agents.

**GET** `/api/enhanced-swarms/tree`

**Response:**
```json
{
  "id": "root",
  "name": "Swarm Orchestrator",
  "type": "root",
  "metadata": {
    "totalSwarms": 5,
    "activeSwarms": 3,
    "totalAgents": 45
  },
  "children": [
    {
      "id": "swarm-1",
      "name": "Development Swarm",
      "type": "swarm",
      "status": "running",
      "children": [
        {
          "id": "agent-1",
          "name": "Lead Coordinator",
          "type": "agent",
          "status": "busy"
        }
      ]
    }
  ]
}
```

## Integration Features

### Claude Flow Hooks

The integration automatically uses Claude Flow hooks for:

1. **Pre-task validation** - Ensures tasks are properly formatted
2. **Post-edit tracking** - Logs all file modifications
3. **Memory persistence** - Stores decisions and context
4. **Neural pattern learning** - Improves coordination over time

### Memory Persistence

All swarm data is persisted in:
- `.hive-mind/hive.db` - SQLite database for structured data
- `.swarm/memory.db` - Claude Flow memory store

### Neural Capabilities

- **Pattern Recognition**: Learns from successful task completions
- **Adaptive Coordination**: Improves agent collaboration
- **Performance Optimization**: Identifies and resolves bottlenecks

### Agent Types

Available agent types for spawning:
- `coordinator` - Planning and orchestration
- `researcher` - Information gathering and analysis
- `coder` - Implementation and development
- `analyst` - Data analysis and reporting
- `tester` - Quality assurance and validation
- `architect` - System design and structure
- `optimizer` - Performance enhancement
- `reviewer` - Code review and auditing

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "details": "Additional context if available"
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Best Practices

1. **Start Small**: Begin with 3-5 agents and scale as needed
2. **Enable Neural Training**: Run training periodically for better coordination
3. **Monitor Performance**: Use the performance endpoint to identify issues
4. **Use Appropriate Topologies**:
   - `hierarchical` - For structured tasks with clear delegation
   - `mesh` - For collaborative tasks requiring peer communication
   - `ring` - For sequential processing workflows
   - `star` - For centralized coordination patterns

## Example Workflow

```javascript
// 1. Create a swarm
const swarm = await fetch('/api/enhanced-swarms', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Dev Team',
    purpose: 'Build REST API',
    agents: [
      { name: 'PM', role: 'coordinator', tasks: ['plan'] },
      { name: 'Dev1', role: 'coder', tasks: ['implement'] },
      { name: 'QA', role: 'tester', tasks: ['test'] }
    ]
  })
}).then(r => r.json());

// 2. Scale if needed
await fetch(`/api/enhanced-swarms/${swarm.id}/scale`, {
  method: 'POST',
  body: JSON.stringify({ targetAgents: 5 })
});

// 3. Assign tasks
await fetch(`/api/enhanced-swarms/${swarm.id}/agents/${agentId}/task`, {
  method: 'POST',
  body: JSON.stringify({
    description: 'Implement user authentication',
    priority: 'high'
  })
});

// 4. Monitor intelligence
const intelligence = await fetch(`/api/enhanced-swarms/${swarm.id}/intelligence`)
  .then(r => r.json());

// 5. Train for improvement
await fetch(`/api/enhanced-swarms/${swarm.id}/neural/train`, {
  method: 'POST',
  body: JSON.stringify({ iterations: 10 })
});
```