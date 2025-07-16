# Langfuse Worker for Hive Mind Swarm

## Overview

The Langfuse Worker is a specialized component that automatically captures and sends all swarm activities to Langfuse for observability and tracing. It provides comprehensive monitoring of the hive mind swarm operations with proper authentication, batch processing, and error handling.

## Features

### ✅ Core Functionality
- **Automatic Trace Capture**: Monitors swarm memory database for new activities
- **Batch Processing**: Efficiently processes traces in configurable batches
- **Proper Authentication**: Uses Langfuse public/secret keys for secure API access
- **Error Handling**: Retry logic with exponential backoff for failed traces
- **Real-time Monitoring**: Continuous monitoring of swarm activities
- **Status Endpoints**: HTTP endpoints for monitoring worker health

### ✅ Advanced Features
- **Connection Validation**: Tests Langfuse connectivity on startup
- **Graceful Shutdown**: Processes remaining traces before shutdown
- **Metrics Collection**: Tracks success rates, batch counts, and performance
- **Memory Monitoring**: Watches `.swarm/memory.db` for new activities
- **Span Support**: Handles complex traces with multiple spans
- **Generation Tracking**: Supports LLM generation tracking

## Configuration

### Environment Variables

The worker uses the following environment variables from `.env.langfuse`:

```bash
# Required
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_HOST=http://localhost:3000

# Optional
CLAUDE_FLOW_BATCH_SIZE=50
CLAUDE_FLOW_FLUSH_INTERVAL=3000
LANGFUSE_MAX_RETRIES=3
LANGFUSE_REQUEST_TIMEOUT=30000
LANGFUSE_WORKER_ENABLED=true
CLAUDE_FLOW_DEBUG_MODE=false
```

### Configuration Options

```javascript
const worker = new LangfuseWorker({
  publicKey: 'pk-lf-your-key',
  secretKey: 'sk-lf-your-secret',
  baseUrl: 'http://localhost:3000',
  batchSize: 50,           // Number of traces per batch
  flushInterval: 3000,     // Flush interval in milliseconds
  maxRetries: 3,           // Maximum retry attempts
  requestTimeout: 30000,   // Request timeout in milliseconds
  workerEnabled: true,     // Enable/disable worker
  debug: false             // Enable debug logging
});
```

## Usage

### Quick Start

1. **Start the worker:**
   ```bash
   ./start-langfuse-worker.sh
   ```

2. **Check status:**
   ```bash
   curl http://localhost:8080/status
   ```

3. **View metrics:**
   ```bash
   curl http://localhost:8080/metrics
   ```

4. **Stop the worker:**
   ```bash
   ./stop-langfuse-worker.sh
   ```

### Programmatic Usage

```javascript
const LangfuseWorker = require('./langfuse-worker');

// Create and initialize worker
const worker = new LangfuseWorker({
  debug: true
});

// Queue a trace
worker.queueTrace({
  name: 'My Swarm Activity',
  input: { task: 'analyze data' },
  output: { result: 'completed' },
  metadata: { 
    swarmId: 'my-swarm',
    agentId: 'analyzer-01'
  }
});

// Create swarm activity trace
const traceId = worker.createSwarmTrace({
  name: 'Agent Coordination',
  type: 'coordination',
  input: { agents: ['agent1', 'agent2'] },
  output: { coordinated: true },
  metadata: { efficiency: 0.95 }
});

// Monitor events
worker.on('batch-processed', (stats) => {
  console.log(`Processed ${stats.batchSize} traces`);
});

worker.on('error', (error) => {
  console.error('Worker error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.shutdown();
  process.exit(0);
});
```

## API Reference

### Class: LangfuseWorker

#### Constructor
```javascript
new LangfuseWorker(options)
```

#### Methods

##### `initialize()`
Initialize the worker and test connection to Langfuse.

##### `queueTrace(traceData)`
Queue a trace for processing.

**Parameters:**
- `traceData` (Object): Trace data including name, input, output, metadata

##### `createSwarmTrace(activity)`
Create a trace from swarm activity data.

**Parameters:**
- `activity` (Object): Swarm activity data

##### `processBatch()`
Process the current batch of queued traces.

##### `getStatus()`
Get current worker status and configuration.

##### `getMetrics()`
Get performance metrics and statistics.

##### `shutdown()`
Gracefully shutdown the worker.

#### Events

##### `initialized`
Emitted when worker successfully initializes.

##### `batch-processed`
Emitted when a batch of traces is processed.

##### `error`
Emitted when an error occurs.

##### `shutdown`
Emitted when worker shuts down.

## Testing

### Run Tests

```bash
# Run the test suite
node test-langfuse-worker.js

# Run with specific credentials
LANGFUSE_PUBLIC_KEY=pk-test LANGFUSE_SECRET_KEY=sk-test node test-langfuse-worker.js
```

### Test Coverage

The test suite validates:
- ✅ Worker initialization
- ✅ Status checking
- ✅ Trace queuing
- ✅ Batch processing
- ✅ Swarm activity traces
- ✅ Complex traces with spans
- ✅ Connection validation
- ✅ Metrics collection
- ✅ Graceful shutdown

### Expected Output

```
🎉 Test Summary:
   Total traces processed: 5
   Successful traces: 5
   Failed traces: 0
   Success rate: 100.00%
   Batches processed: 2

✅ Langfuse Worker is working correctly!
   Check your Langfuse dashboard at: http://localhost:3000
```

## Monitoring

### Status Endpoint

```bash
curl http://localhost:8080/status
```

**Response:**
```json
{
  "initialized": true,
  "connected": true,
  "config": {
    "baseUrl": "http://localhost:3000",
    "batchSize": 50,
    "flushInterval": 3000,
    "maxRetries": 3
  },
  "queue": {
    "pending": 0,
    "retrying": 0
  },
  "metrics": {
    "totalTraces": 15,
    "successfulTraces": 14,
    "failedTraces": 1,
    "batches": 3,
    "lastFlush": "2025-07-14T14:54:23.704Z",
    "errors": []
  }
}
```

### Metrics Endpoint

```bash
curl http://localhost:8080/metrics
```

**Response:**
```json
{
  "totalTraces": 15,
  "successfulTraces": 14,
  "failedTraces": 1,
  "batches": 3,
  "lastFlush": "2025-07-14T14:54:23.704Z",
  "errors": [],
  "queueLength": 0,
  "retryQueueLength": 0,
  "successRate": 93.33,
  "uptime": 3600000
}
```

## Troubleshooting

### Common Issues

#### 1. Connection Failed
```
❌ Connection test failed: Missing Langfuse credentials
```
**Solution:** Ensure `.env.langfuse` has valid credentials.

#### 2. Worker Not Starting
```
❌ Error: Langfuse server not responding at http://localhost:3000
```
**Solution:** Start Langfuse server first:
```bash
docker-compose up langfuse
```

#### 3. Traces Not Appearing
**Check:**
- Langfuse dashboard at http://localhost:3000
- Worker status endpoint: http://localhost:8080/status
- Worker logs: `tail -f logs/langfuse-worker.log`

#### 4. High Memory Usage
**Solutions:**
- Reduce batch size: `CLAUDE_FLOW_BATCH_SIZE=25`
- Increase flush interval: `CLAUDE_FLOW_FLUSH_INTERVAL=5000`
- Enable memory monitoring in configuration

### Debug Mode

Enable debug mode for detailed logging:

```bash
export CLAUDE_FLOW_DEBUG_MODE=true
./start-langfuse-worker.sh
```

## Integration

### Swarm Memory Integration

The worker automatically monitors the swarm memory database (`.swarm/memory.db`) for new activities and creates traces for:

- Agent spawning events
- Task orchestration
- Memory operations
- Hook executions
- Neural training events

### Langfuse Dashboard

All traces appear in the Langfuse dashboard with:
- Session grouping by swarm ID
- Agent identification
- Performance metrics
- Error tracking
- Cost analysis

## Performance

### Optimizations

- **Batch Processing**: Reduces API calls by processing multiple traces together
- **Connection Pooling**: Reuses HTTP connections for better performance
- **Retry Logic**: Handles transient failures without losing traces
- **Memory Monitoring**: Efficient SQLite queries for activity detection
- **Async Processing**: Non-blocking trace processing

### Benchmarks

With default configuration:
- **Throughput**: 50 traces per batch, 3-second intervals
- **Latency**: ~200ms per trace processing
- **Memory**: ~50MB baseline, scales with queue size
- **CPU**: <5% with normal load

## Security

- **Authentication**: Uses Langfuse API keys for secure access
- **No Data Persistence**: Traces are processed and sent immediately
- **Error Sanitization**: Sensitive data removed from error logs
- **Connection Security**: Supports HTTPS for production environments

## Support

For issues or questions:
1. Check the logs: `logs/langfuse-worker.log`
2. Verify configuration: `curl http://localhost:8080/status`
3. Test connectivity: `node test-langfuse-worker.js`
4. Review Langfuse documentation: https://langfuse.com/docs