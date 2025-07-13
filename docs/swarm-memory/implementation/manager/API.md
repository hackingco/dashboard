# Swarm Manager API Documentation

The Swarm Manager API provides programmatic control over AI swarm orchestration on Fly.io infrastructure.

## Base URL

```
https://swarm-manager.fly.dev/api
```

## Authentication

Currently no authentication is required (this should be implemented before production use).

## Endpoints

### Swarms

#### List All Swarms
```http
GET /swarms
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Analytics Swarm",
    "purpose": "Process user analytics data",
    "status": "running",
    "workerCount": 3,
    "createdAt": "2024-01-11T10:00:00Z",
    "updatedAt": "2024-01-11T10:05:00Z",
    "config": {
      "maxWorkers": 10,
      "taskTimeout": 300000,
      "retryLimit": 3
    },
    "metrics": {
      "tasksCompleted": 156,
      "tasksFailed": 2,
      "averageTaskTime": 4500
    }
  }
]
```

#### Create a Swarm
```http
POST /swarms
```

**Request Body:**
```json
{
  "name": "Analytics Swarm",
  "purpose": "Process user analytics data",
  "workerCount": 3,
  "config": {
    "maxWorkers": 10,
    "taskTimeout": 300000,
    "retryLimit": 3,
    "workerType": "analyst",
    "region": "dfw",
    "cpus": 2,
    "memory": 512
  }
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Analytics Swarm",
  "purpose": "Process user analytics data",
  "status": "initializing",
  "workerCount": 3,
  "createdAt": "2024-01-11T10:00:00Z",
  "updatedAt": "2024-01-11T10:00:00Z",
  "config": {
    "maxWorkers": 10,
    "taskTimeout": 300000,
    "retryLimit": 3
  },
  "metrics": {
    "tasksCompleted": 0,
    "tasksFailed": 0,
    "averageTaskTime": 0
  }
}
```

#### Get a Specific Swarm
```http
GET /swarms/:id
```

#### Update a Swarm
```http
PUT /swarms/:id
```

**Request Body:**
```json
{
  "name": "Updated Analytics Swarm",
  "purpose": "Process enhanced analytics",
  "config": {
    "maxWorkers": 20,
    "taskTimeout": 600000
  }
}
```

#### Delete a Swarm
```http
DELETE /swarms/:id
```

#### Scale a Swarm
```http
POST /swarms/:id/scale
```

**Request Body:**
```json
{
  "workerCount": 5
}
```

**Response:**
```json
{
  "message": "Swarm scaled to 5 workers",
  "swarm": { /* swarm object */ }
}
```

#### Get Swarm Logs
```http
GET /swarms/:id/logs?lines=100
```

**Response:**
```json
{
  "swarmId": "123e4567-e89b-12d3-a456-426614174000",
  "logs": [
    "2024-01-11T10:00:00.123Z app[worker.1] Starting worker process...",
    "2024-01-11T10:00:01.456Z app[worker.1] Connected to Redis",
    "2024-01-11T10:00:02.789Z app[worker.1] Ready to process tasks"
  ]
}
```

#### Stop a Swarm
```http
POST /swarms/:id/stop
```

#### Start a Swarm
```http
POST /swarms/:id/start
```

**Request Body (optional):**
```json
{
  "workerCount": 3
}
```

### Workers

#### List Workers for a Swarm
```http
GET /workers?swarmId=123e4567-e89b-12d3-a456-426614174000
```

#### Get Worker Details
```http
GET /workers/:id
```

### Tasks

#### Create a Task
```http
POST /tasks
```

**Request Body:**
```json
{
  "swarmId": "123e4567-e89b-12d3-a456-426614174000",
  "type": "analyze",
  "payload": {
    "data": "Sample data to analyze",
    "options": {
      "depth": "detailed"
    }
  }
}
```

#### Get Task Status
```http
GET /tasks/:id
```

#### List Tasks
```http
GET /tasks?swarmId=123e4567-e89b-12d3-a456-426614174000&status=pending
```

### Health

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-11T10:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (success with no response body)
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Example Usage

### Creating and Managing a Swarm

```bash
# Create a new swarm
curl -X POST https://swarm-manager.fly.dev/api/swarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Data Processing Swarm",
    "purpose": "Process incoming data streams",
    "workerCount": 2,
    "config": {
      "maxWorkers": 10,
      "workerType": "processor"
    }
  }'

# Scale the swarm
curl -X POST https://swarm-manager.fly.dev/api/swarms/SWARM_ID/scale \
  -H "Content-Type: application/json" \
  -d '{"workerCount": 5}'

# Get logs
curl https://swarm-manager.fly.dev/api/swarms/SWARM_ID/logs?lines=50

# Stop the swarm
curl -X POST https://swarm-manager.fly.dev/api/swarms/SWARM_ID/stop
```

### Creating and Monitoring Tasks

```bash
# Create a task
curl -X POST https://swarm-manager.fly.dev/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "swarmId": "SWARM_ID",
    "type": "analyze",
    "payload": {
      "url": "https://example.com/data.json"
    }
  }'

# Check task status
curl https://swarm-manager.fly.dev/api/tasks/TASK_ID
```