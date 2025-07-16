# 📡 Claude Flow Trace API Reference

Complete API documentation for Claude Flow Trace collectors, clients, and integrations.

## 🌐 REST API

### Base URL

```
http://localhost:9876
```

### Authentication

Currently, the API does not require authentication for local usage. For production deployments, configure authentication via environment variables.

### Endpoints

#### 📊 Traces

##### GET /traces

Retrieve traces with optional filtering and pagination.

**Query Parameters:**
- `limit` (integer, default: 100): Maximum number of traces to return
- `offset` (integer, default: 0): Number of traces to skip
- `source` (string): Filter by trace source (e.g., 'cli-wrapper', 'process-monitor')
- `type` (string): Filter by trace type (e.g., 'command-execution', 'hook-execution')
- `since` (ISO 8601 datetime): Return traces after this timestamp
- `until` (ISO 8601 datetime): Return traces before this timestamp

**Response:**
```json
{
  "traces": [
    {
      "id": "trace-1234567890",
      "source": "cli-wrapper",
      "type": "command-execution",
      "timestamp": "2025-01-14T10:00:00.000Z",
      "data": {
        "command": "hive-mind spawn",
        "args": ["Build authentication"],
        "workingDirectory": "/project",
        "duration": 3240,
        "exitCode": 0,
        "stdout": "...",
        "stderr": ""
      },
      "metadata": {
        "userId": "system",
        "sessionId": "session-123",
        "platform": "darwin",
        "nodeVersion": "18.12.0"
      }
    }
  ],
  "total": 1523,
  "limit": 100,
  "offset": 0
}
```

##### GET /traces/:id

Retrieve a specific trace by ID.

**Response:**
```json
{
  "id": "trace-1234567890",
  "source": "cli-wrapper",
  "type": "command-execution",
  "timestamp": "2025-01-14T10:00:00.000Z",
  "data": {
    "command": "hive-mind spawn",
    "args": ["Build authentication"],
    "workingDirectory": "/project",
    "duration": 3240,
    "exitCode": 0,
    "stdout": "✅ Spawned 5 agents successfully",
    "stderr": "",
    "environment": {
      "NODE_ENV": "development",
      "CLAUDE_FLOW_VERSION": "2.0.0"
    }
  },
  "metadata": {
    "userId": "system",
    "sessionId": "session-123",
    "platform": "darwin",
    "nodeVersion": "18.12.0",
    "cpuUsage": 45.2,
    "memoryUsage": 128.5
  },
  "scores": {
    "success": 1,
    "speed": 0.85,
    "efficiency": 0.92
  }
}
```

##### POST /traces

Submit a new trace.

**Request Body:**
```json
{
  "source": "custom",
  "type": "api-call",
  "data": {
    "endpoint": "/api/agents",
    "method": "POST",
    "duration": 156,
    "statusCode": 201
  },
  "metadata": {
    "userId": "user-123",
    "requestId": "req-456"
  }
}
```

**Response:**
```json
{
  "id": "trace-9876543210",
  "status": "created",
  "timestamp": "2025-01-14T10:05:00.000Z"
}
```

##### POST /traces/search

Search traces with advanced filtering.

**Request Body:**
```json
{
  "query": "authentication",
  "filters": {
    "sources": ["cli-wrapper", "hook-interceptor"],
    "types": ["command-execution"],
    "dateRange": {
      "from": "2025-01-14T00:00:00Z",
      "to": "2025-01-14T23:59:59Z"
    },
    "exitCode": 0,
    "minDuration": 1000,
    "maxDuration": 5000
  },
  "sort": {
    "field": "timestamp",
    "order": "desc"
  },
  "limit": 50,
  "offset": 0
}
```

**Response:**
```json
{
  "results": [...],
  "total": 23,
  "query": "authentication",
  "executionTime": 45
}
```

#### 📈 Statistics

##### GET /stats

Get overall statistics.

**Query Parameters:**
- `period` (string): Time period ('1h', '24h', '7d', '30d')
- `groupBy` (string): Group statistics by ('source', 'type', 'command', 'hour')

**Response:**
```json
{
  "period": "24h",
  "summary": {
    "totalTraces": 5432,
    "uniqueCommands": 23,
    "totalDuration": 1234567,
    "averageDuration": 227,
    "successRate": 0.94,
    "errorRate": 0.06
  },
  "topCommands": [
    {
      "command": "hive-mind spawn",
      "count": 1234,
      "averageDuration": 3200,
      "successRate": 0.98
    }
  ],
  "timeline": [
    {
      "timestamp": "2025-01-14T00:00:00Z",
      "count": 45,
      "errors": 2
    }
  ],
  "sources": {
    "cli-wrapper": 3210,
    "process-monitor": 1543,
    "hook-interceptor": 679
  }
}
```

##### GET /stats/performance

Get performance metrics.

**Response:**
```json
{
  "collector": {
    "uptime": 86400,
    "memoryUsage": {
      "heapUsed": 45.2,
      "heapTotal": 128,
      "external": 2.1,
      "rss": 156.3
    },
    "cpuUsage": {
      "user": 1234567,
      "system": 234567
    }
  },
  "traces": {
    "bufferSize": 8765,
    "bufferCapacity": 10000,
    "deduplicationRate": 0.12,
    "processingRate": 234.5
  }
}
```

#### 📤 Export

##### GET /export

Export traces in various formats.

**Query Parameters:**
- `format` (string): Export format ('json', 'jsonl', 'csv')
- `compress` (boolean): Compress output with gzip
- All filter parameters from GET /traces

**Response Headers:**
```
Content-Type: application/json (or text/csv)
Content-Disposition: attachment; filename="traces-export-2025-01-14.json"
Content-Encoding: gzip (if compressed)
```

#### 🔧 Management

##### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "services": {
    "collector": "active",
    "api": "active",
    "websocket": "active",
    "storage": "active"
  }
}
```

##### POST /flush

Force flush of trace buffer.

**Response:**
```json
{
  "flushed": 234,
  "remaining": 0,
  "duration": 45
}
```

##### DELETE /traces

Clear trace history.

**Query Parameters:**
- `before` (ISO 8601 datetime): Delete traces before this timestamp
- `source` (string): Only delete traces from specific source

**Response:**
```json
{
  "deleted": 1234,
  "duration": 156
}
```

## 🔌 WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:9877');
```

### Protocol

#### Subscribe to Traces

**Request:**
```json
{
  "type": "subscribe",
  "id": "sub-123",
  "filters": {
    "sources": ["cli-wrapper", "process-monitor"],
    "types": ["command-execution"],
    "commands": ["hive-mind", "swarm"],
    "pattern": "spawn"
  }
}
```

**Response:**
```json
{
  "type": "subscribed",
  "id": "sub-123",
  "status": "active"
}
```

#### Receive Traces

**Server Push:**
```json
{
  "type": "trace",
  "subscriptionId": "sub-123",
  "trace": {
    "id": "trace-123",
    "source": "cli-wrapper",
    "type": "command-execution",
    "timestamp": "2025-01-14T10:00:00Z",
    "data": {...}
  }
}
```

#### Unsubscribe

**Request:**
```json
{
  "type": "unsubscribe",
  "id": "sub-123"
}
```

#### Ping/Pong

**Client Ping:**
```json
{
  "type": "ping",
  "timestamp": 1234567890
}
```

**Server Pong:**
```json
{
  "type": "pong",
  "timestamp": 1234567890,
  "serverTime": 1234567891
}
```

## 🔧 JavaScript Client SDK

### Installation

```bash
npm install claude-flow-trace
```

### Usage

```javascript
const { TraceClient } = require('claude-flow-trace');

// Initialize client
const client = new TraceClient({
  baseUrl: 'http://localhost:9876',
  wsUrl: 'ws://localhost:9877',
  autoConnect: true
});

// Query traces
const traces = await client.getTraces({
  limit: 10,
  source: 'cli-wrapper'
});

// Search traces
const results = await client.searchTraces({
  query: 'authentication',
  limit: 50
});

// Get statistics
const stats = await client.getStats('24h');

// Subscribe to real-time traces
client.subscribe({
  sources: ['cli-wrapper'],
  onTrace: (trace) => {
    console.log('New trace:', trace);
  }
});

// Submit custom trace
await client.submitTrace({
  source: 'custom',
  type: 'api-call',
  data: {
    endpoint: '/api/users',
    method: 'GET',
    duration: 45
  }
});
```

## 🐳 Docker API

### Environment Variables

```yaml
services:
  trace-collector:
    image: claude-flow-trace:latest
    environment:
      - API_PORT=9876
      - WS_PORT=9877
      - STORAGE_PATH=/data/traces
      - RETENTION_DAYS=30
      - LOG_LEVEL=info
      - ENABLE_COMPRESSION=true
      - MAX_BUFFER_SIZE=10000
```

### Health Check

```bash
curl http://localhost:9876/health
```

## 🔐 Security

### API Key Authentication

Enable API key authentication:

```bash
export TRACE_API_KEY=your-secret-key
```

Include in requests:
```bash
curl -H "X-API-Key: your-secret-key" http://localhost:9876/traces
```

### CORS Configuration

```javascript
// Configure CORS in environment
TRACE_CORS_ORIGINS=https://app.example.com,https://dashboard.example.com
TRACE_CORS_CREDENTIALS=true
```

### Rate Limiting

```javascript
// Configure rate limits
TRACE_RATE_LIMIT_WINDOW=60000  // 1 minute
TRACE_RATE_LIMIT_MAX=1000      // 1000 requests per window
```

## 📝 Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Provide valid API key |
| 404 | Not Found | Verify trace ID exists |
| 429 | Too Many Requests | Respect rate limits |
| 500 | Internal Server Error | Check server logs |
| 503 | Service Unavailable | Collector may be starting |

## 🔄 Webhooks

Configure webhooks for trace events:

```json
{
  "url": "https://your-app.com/webhooks/traces",
  "events": ["trace.created", "trace.error"],
  "filters": {
    "sources": ["cli-wrapper"],
    "minDuration": 5000
  }
}
```

---

<div align="center">
  <sub>
    For more examples, see our <a href="docs/examples.md">Examples Guide</a>
  </sub>
</div>