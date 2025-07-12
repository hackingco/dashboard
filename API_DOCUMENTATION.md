# Hive Mind Swarm Orchestrator API Documentation

## Base URL
```
https://api.swarm-orchestrator.fly.dev
```

## Authentication
All API requests require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your-supabase-jwt-token>
```

## API Endpoints

### Swarm Management

#### Create New Swarm
```http
POST /api/swarms
Content-Type: application/json

{
  "name": "data-processing-swarm",
  "purpose": "Process large datasets in parallel",
  "workerCount": 5,
  "config": {
    "maxWorkers": 10,
    "taskTimeout": 300000,
    "retryLimit": 3,
    "workerType": "shared-cpu-1x",
    "region": "iad",
    "cpus": 1,
    "memory": 256,
    "minInstances": 2,
    "dockerImage": "registry.fly.io/swarm-worker:latest",
    "env": {
      "LOG_LEVEL": "info",
      "WORKER_MODE": "autonomous"
    }
  }
}

Response: 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "data-processing-swarm",
  "purpose": "Process large datasets in parallel",
  "status": "initializing",
  "workerCount": 5,
  "flyAppName": "swarm-550e8400",
  "config": {
    "maxWorkers": 10,
    "taskTimeout": 300000,
    "retryLimit": 3,
    "workerType": "shared-cpu-1x",
    "region": "iad",
    "cpus": 1,
    "memory": 256,
    "minInstances": 2,
    "dockerImage": "registry.fly.io/swarm-worker:latest",
    "env": {
      "LOG_LEVEL": "info",
      "WORKER_MODE": "autonomous"
    }
  },
  "metrics": {
    "tasksCompleted": 0,
    "tasksFailed": 0,
    "averageTaskTime": 0
  },
  "createdAt": "2024-01-11T10:00:00Z",
  "updatedAt": "2024-01-11T10:00:00Z"
}
```

#### List All Swarms
```http
GET /api/swarms?status=running&limit=20&offset=0

Response: 200 OK
{
  "swarms": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "data-processing-swarm",
      "purpose": "Process large datasets in parallel",
      "status": "running",
      "workerCount": 5,
      "metrics": {
        "tasksCompleted": 1250,
        "tasksFailed": 3,
        "averageTaskTime": 2340
      },
      "createdAt": "2024-01-11T10:00:00Z",
      "updatedAt": "2024-01-11T15:30:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

#### Get Swarm Details
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000

Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "data-processing-swarm",
  "purpose": "Process large datasets in parallel",
  "status": "running",
  "workerCount": 5,
  "flyAppName": "swarm-550e8400",
  "config": {
    "maxWorkers": 10,
    "taskTimeout": 300000,
    "retryLimit": 3
  },
  "metrics": {
    "tasksCompleted": 1250,
    "tasksFailed": 3,
    "averageTaskTime": 2340,
    "cpuUsage": 45.5,
    "memoryUsage": 78.2,
    "activeWorkers": 5,
    "idleWorkers": 0
  },
  "workers": [
    {
      "id": "worker-001",
      "status": "busy",
      "lastHeartbeat": "2024-01-11T15:35:00Z",
      "currentTask": "task-789"
    }
  ],
  "createdAt": "2024-01-11T10:00:00Z",
  "updatedAt": "2024-01-11T15:30:00Z"
}
```

#### Scale Swarm Workers
```http
PUT /api/swarms/550e8400-e29b-41d4-a716-446655440000/scale
Content-Type: application/json

{
  "targetWorkerCount": 8,
  "scalingStrategy": "gradual"
}

Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "previousWorkerCount": 5,
  "targetWorkerCount": 8,
  "currentWorkerCount": 6,
  "scalingStatus": "in_progress",
  "estimatedCompletionTime": "2024-01-11T15:40:00Z"
}
```

#### Destroy Swarm
```http
DELETE /api/swarms/550e8400-e29b-41d4-a716-446655440000

Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "terminating",
  "message": "Swarm destruction initiated. All workers will be terminated."
}
```

### Task Management

#### Submit Task to Swarm
```http
POST /api/swarms/550e8400-e29b-41d4-a716-446655440000/tasks
Content-Type: application/json

{
  "type": "data-transform",
  "priority": 1,
  "input": {
    "sourceUrl": "s3://bucket/input/data.csv",
    "transformations": [
      {"type": "filter", "column": "age", "operator": ">", "value": 18},
      {"type": "aggregate", "groupBy": "city", "metric": "count"}
    ],
    "outputUrl": "s3://bucket/output/transformed.csv"
  },
  "dependencies": ["task-123", "task-456"],
  "maxRetries": 3
}

Response: 201 Created
{
  "id": "task-789",
  "swarmId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "data-transform",
  "status": "pending",
  "priority": 1,
  "input": {
    "sourceUrl": "s3://bucket/input/data.csv",
    "transformations": [
      {"type": "filter", "column": "age", "operator": ">", "value": 18},
      {"type": "aggregate", "groupBy": "city", "metric": "count"}
    ],
    "outputUrl": "s3://bucket/output/transformed.csv"
  },
  "dependencies": ["task-123", "task-456"],
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": "2024-01-11T15:35:00Z"
}
```

#### Get Task Status
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000/tasks/task-789

Response: 200 OK
{
  "id": "task-789",
  "swarmId": "550e8400-e29b-41d4-a716-446655440000",
  "workerId": "worker-003",
  "type": "data-transform",
  "status": "active",
  "priority": 1,
  "progress": 65,
  "input": {...},
  "output": null,
  "error": null,
  "retryCount": 0,
  "startedAt": "2024-01-11T15:36:00Z",
  "estimatedCompletionTime": "2024-01-11T15:38:30Z",
  "createdAt": "2024-01-11T15:35:00Z",
  "updatedAt": "2024-01-11T15:37:00Z"
}
```

### Monitoring & Metrics

#### Get Swarm Metrics
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000/metrics?period=1h&metrics=cpu,memory,tasks

Response: 200 OK
{
  "swarmId": "550e8400-e29b-41d4-a716-446655440000",
  "period": "1h",
  "metrics": {
    "cpu": {
      "current": 45.5,
      "average": 52.3,
      "max": 89.2,
      "timeseries": [
        {"timestamp": "2024-01-11T14:35:00Z", "value": 48.2},
        {"timestamp": "2024-01-11T14:40:00Z", "value": 52.1},
        {"timestamp": "2024-01-11T14:45:00Z", "value": 89.2}
      ]
    },
    "memory": {
      "current": 78.2,
      "average": 75.5,
      "max": 92.1,
      "timeseries": [...]
    },
    "tasks": {
      "completed": 125,
      "failed": 2,
      "pending": 34,
      "active": 5,
      "throughput": 2.08
    }
  }
}
```

#### Get Swarm Logs
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000/logs?level=error&limit=50

Response: 200 OK
{
  "logs": [
    {
      "id": "log-001",
      "timestamp": "2024-01-11T15:30:00Z",
      "level": "error",
      "source": "worker-002",
      "message": "Failed to process task: Connection timeout",
      "metadata": {
        "taskId": "task-456",
        "errorCode": "CONN_TIMEOUT",
        "duration": 30000
      }
    }
  ],
  "total": 3,
  "limit": 50,
  "offset": 0
}
```

#### Subscribe to Real-time Events (SSE)
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000/events

Response: 200 OK (Server-Sent Events)
event: worker-status
data: {"workerId": "worker-001", "status": "idle", "timestamp": "2024-01-11T15:35:00Z"}

event: task-completed
data: {"taskId": "task-789", "workerId": "worker-003", "duration": 2340, "timestamp": "2024-01-11T15:36:30Z"}

event: metrics-update
data: {"cpu": 45.5, "memory": 78.2, "activeTasks": 4, "timestamp": "2024-01-11T15:37:00Z"}
```

### Claude-Flow Integration

#### Create Hive Configuration
```http
POST /api/swarms/550e8400-e29b-41d4-a716-446655440000/claude-flow/configure
Content-Type: application/json

{
  "queenType": "strategic",
  "consensusAlgorithm": "weighted",
  "workerDistribution": {
    "researchers": 2,
    "coders": 3,
    "analysts": 2,
    "testers": 1,
    "coordinators": 1
  },
  "objective": "Build and test a REST API with authentication",
  "memoryPersistence": true
}

Response: 200 OK
{
  "swarmId": "550e8400-e29b-41d4-a716-446655440000",
  "hiveConfigured": true,
  "queenId": "queen-001",
  "workerRoles": {
    "researchers": ["worker-001", "worker-002"],
    "coders": ["worker-003", "worker-004", "worker-005"],
    "analysts": ["worker-006", "worker-007"],
    "testers": ["worker-008"],
    "coordinators": ["worker-009"]
  }
}
```

#### Get Claude-Flow Decisions
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000/claude-flow/decisions?limit=10

Response: 200 OK
{
  "decisions": [
    {
      "id": "decision-001",
      "type": "task-assignment",
      "context": {
        "availableWorkers": 5,
        "taskComplexity": "high",
        "dependencies": ["task-123"]
      },
      "decision": {
        "assignTo": "worker-003",
        "reason": "Best suited based on skill match and availability"
      },
      "confidence": 0.92,
      "reasoning": "Worker-003 has completed similar tasks with 95% success rate",
      "timestamp": "2024-01-11T15:30:00Z"
    }
  ],
  "total": 45,
  "limit": 10,
  "offset": 0
}
```

### TrustGraph Integration

#### Get Task Dependencies
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000/trustgraph/dependencies?taskId=task-789

Response: 200 OK
{
  "taskId": "task-789",
  "dependencies": {
    "direct": ["task-123", "task-456"],
    "transitive": ["task-100", "task-101", "task-102"],
    "graph": {
      "nodes": [
        {"id": "task-789", "type": "task", "status": "pending"},
        {"id": "task-123", "type": "task", "status": "completed"},
        {"id": "task-456", "type": "task", "status": "active"}
      ],
      "edges": [
        {"from": "task-789", "to": "task-123"},
        {"from": "task-789", "to": "task-456"},
        {"from": "task-123", "to": "task-100"}
      ]
    }
  },
  "executionOrder": ["task-100", "task-101", "task-102", "task-123", "task-456", "task-789"]
}
```

### Langfuse Integration

#### Get LLM Operation Traces
```http
GET /api/swarms/550e8400-e29b-41d4-a716-446655440000/langfuse/traces?period=1h

Response: 200 OK
{
  "traces": [
    {
      "traceId": "trace-001",
      "sessionId": "session-123",
      "swarmId": "550e8400-e29b-41d4-a716-446655440000",
      "spans": [
        {
          "spanId": "span-001",
          "name": "task-analysis",
          "startTime": "2024-01-11T15:30:00Z",
          "endTime": "2024-01-11T15:30:02Z",
          "input": {"task": "Analyze code quality"},
          "output": {"score": 8.5, "issues": 3},
          "metadata": {
            "model": "claude-3-opus",
            "tokens": 1250,
            "cost": 0.0375
          }
        }
      ],
      "totalTokens": 2500,
      "totalCost": 0.075,
      "duration": 4500
    }
  ],
  "summary": {
    "totalTraces": 125,
    "totalTokens": 312500,
    "totalCost": 9.375,
    "averageTokensPerTrace": 2500,
    "averageDuration": 3200
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid worker count. Must be between 1 and 100.",
    "field": "workerCount"
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired authentication token"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this swarm"
  }
}
```

### 404 Not Found
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Swarm not found",
    "resource": "swarm",
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 429 Too Many Requests
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "retryAfter": 60
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req-123456"
  }
}
```

## Rate Limiting

- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute
- **Pro Plan**: 1000 requests/minute
- **Enterprise**: Custom limits

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704974400
```

## Webhooks

Configure webhooks to receive real-time notifications:

```http
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["swarm.created", "task.completed", "worker.error"],
  "secret": "your-webhook-secret"
}
```

Webhook payload example:
```json
{
  "event": "task.completed",
  "timestamp": "2024-01-11T15:36:30Z",
  "data": {
    "taskId": "task-789",
    "swarmId": "550e8400-e29b-41d4-a716-446655440000",
    "workerId": "worker-003",
    "duration": 2340,
    "result": {...}
  }
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { SwarmOrchestrator } from '@swarm/sdk';

const client = new SwarmOrchestrator({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.swarm-orchestrator.fly.dev'
});

// Create a swarm
const swarm = await client.swarms.create({
  name: 'my-swarm',
  purpose: 'Data processing',
  workerCount: 5
});

// Submit a task
const task = await client.tasks.create(swarm.id, {
  type: 'process-data',
  input: { data: 'example' }
});

// Monitor progress
const status = await client.tasks.getStatus(swarm.id, task.id);
```

### Python
```python
from swarm_orchestrator import SwarmClient

client = SwarmClient(
    api_key='your-api-key',
    base_url='https://api.swarm-orchestrator.fly.dev'
)

# Create a swarm
swarm = client.swarms.create(
    name='my-swarm',
    purpose='Data processing',
    worker_count=5
)

# Submit a task
task = client.tasks.create(
    swarm_id=swarm.id,
    type='process-data',
    input={'data': 'example'}
)

# Monitor progress
status = client.tasks.get_status(swarm.id, task.id)
```