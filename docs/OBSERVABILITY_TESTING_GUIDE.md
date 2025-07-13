# Observability & Testing Guide

## Overview

This guide covers the observability and testing infrastructure for the Swarm Management Platform, including real-time monitoring, trace analysis, and comprehensive testing procedures.

## Observability Stack

### 1. Langfuse - LLM & API Tracing

Langfuse provides detailed tracing for all API calls, particularly focusing on:
- **API Call Latency**: Every Fly.io API call is wrapped in Langfuse spans
- **Token Usage Tracking**: Monitor LLM token consumption and costs
- **Error Tracking**: Automatic error capture with stack traces
- **Performance Analysis**: Identify bottlenecks and optimize API calls

**Key Integration Points:**
```javascript
// Example: Fly API calls are automatically traced
const machine = await flyApiRequest('POST', `/apps/${appName}/machines`, config);
// This creates a Langfuse span with timing, tokens, and cost data
```

**Accessing Traces:**
1. Navigate to https://cloud.langfuse.com
2. Search by correlation ID or swarm ID
3. View detailed spans for each API operation
4. Analyze token usage and costs

### 2. TrustGraph - Request Flow Visualization

TrustGraph creates a directed acyclic graph (DAG) of all operations:
- **Node Types**:
  - `api`: Fly.io API calls
  - `machine`: Created machines
  - `ws_broadcast`: WebSocket broadcast events
  - `swarm`: Swarm lifecycle events
  - `task`: Task execution nodes

- **Edge Types**:
  - `executes`: Successful operations
  - `triggers`: Event-driven relationships
  - `depends_on`: Task dependencies
  - `creates`: Resource creation

**Key Features:**
- Real-time graph updates
- WebSocket broadcast tracking
- Correlation chain analysis
- Critical path identification

**Viewing the Graph:**
```bash
# Get TrustGraph data for a swarm
curl -H "Authorization: Bearer $FLY_API_TOKEN" \
  http://localhost:3001/api/observability/trustgraph/{swarmId}
```

### 3. WebSocket Real-time Monitoring

All WebSocket broadcasts are automatically tracked:
- **Broadcast Node Creation**: Every WS message creates a TrustGraph node
- **Correlation Tracking**: Messages include correlation IDs for tracing
- **Channel Monitoring**: Track message flow by channel
- **Client Metrics**: Monitor connected clients and message delivery

**WebSocket Event Types:**
- `swarm_update`: Swarm state changes
- `machine_update`: Machine status updates
- `metrics_update`: Real-time metrics
- `alert`: System alerts

### 4. Supabase Real-time Integration

Supabase provides real-time state synchronization:
- **Machine State Changes**: Track all machine state transitions
- **Observability Correlations**: Link traces across services
- **Real-time Subscriptions**: Monitor active channels
- **Event History**: Audit trail of all state changes

## Testing Infrastructure

### 1. Smoke Tests

**Observability Smoke Test** (`observability-smoke-test.js`):
```bash
# Run the comprehensive smoke test
npm run test:smoke

# Or directly:
node tests/monitoring/observability-smoke-test.js
```

**Test Coverage:**
1. WebSocket connectivity
2. Launch/scale operations
3. Health check verification
4. Observability integration
5. TrustGraph node creation
6. Langfuse trace tracking

### 2. Continuous Monitoring

**Health Monitor Script** (`continuous-health-monitor.sh`):
```bash
# Run continuous monitoring
./tests/monitoring/continuous-health-monitor.sh production
```

**Monitors:**
- API endpoint health
- WebSocket connectivity
- Machine health status
- Memory usage
- Response times

### 3. Load Testing

**WebSocket Load Test:**
```javascript
// Test concurrent connections and message throughput
const loadTest = new WebSocketTester();
await loadTest.testLoadBalancing(urls);
```

## Key Observability Patterns

### 1. Correlation IDs

Every operation flow includes a correlation ID:
```javascript
const correlationId = uuidv4();
// Used in: API calls, WebSocket messages, TrustGraph nodes, Langfuse traces
```

### 2. Trace Propagation

Traces automatically propagate through the system:
```
User Request → API Gateway → Fly Service → Machine Creation
     ↓              ↓            ↓              ↓
  Langfuse      TrustGraph   WS Broadcast   Supabase
```

### 3. Error Tracking

Errors are captured at multiple levels:
- **Langfuse**: Detailed error traces with context
- **TrustGraph**: Error edges showing failure paths
- **WebSocket**: Broadcast error events
- **Logs**: Structured logging with correlation IDs

## Monitoring Dashboards

### 1. Real-time Dashboard

Access at: http://localhost:3000 (development)

**Features:**
- Live swarm status
- Machine health indicators
- WebSocket connection status
- Real-time metrics graphs

### 2. Observability API Endpoints

```bash
# Get observability session data
GET /api/observability/sessions/{sessionId}

# Get swarm observability data
GET /api/observability/swarms/{swarmId}

# Get current metrics
GET /api/observability/metrics

# Get TrustGraph visualization
GET /api/observability/trustgraph/{swarmId}
```

## Best Practices

### 1. Always Include Correlation IDs

```javascript
const correlationId = config.correlationId || uuidv4();
// Pass through all service calls
```

### 2. Use Structured Logging

```javascript
logger.info('Operation completed', {
  correlationId,
  swarmId,
  duration,
  result
});
```

### 3. Monitor Key Metrics

- **API Latency**: < 500ms for Fly API calls
- **WebSocket Latency**: < 100ms for broadcasts
- **Health Check Success**: > 99% availability
- **Token Usage**: Monitor for cost optimization

### 4. Regular Testing

- Run smoke tests before deployments
- Monitor production with continuous health checks
- Review Langfuse traces weekly for optimization
- Check TrustGraph for bottlenecks

## Troubleshooting

### Common Issues

1. **Missing Traces**:
   - Check Langfuse API keys are configured
   - Verify correlation ID is being passed
   - Check network connectivity to Langfuse

2. **WebSocket Disconnections**:
   - Monitor client count in logs
   - Check for memory leaks
   - Verify firewall/proxy settings

3. **TrustGraph Gaps**:
   - Ensure all services emit nodes
   - Check for missing correlation IDs
   - Verify TrustGraph service is running

### Debug Commands

```bash
# Check Langfuse traces
curl -H "Authorization: Bearer $LANGFUSE_SECRET_KEY" \
  https://cloud.langfuse.com/api/traces

# Monitor WebSocket connections
wscat -c ws://localhost:3001

# View TrustGraph nodes
curl http://localhost:3001/api/observability/trustgraph/export

# Check Supabase real-time
npx supabase realtime listen --table machine_states
```

## Performance Optimization

### 1. Batch Operations

- Group TrustGraph node creation
- Batch Langfuse trace uploads
- Aggregate WebSocket broadcasts

### 2. Caching

- Cache health check results (5s TTL)
- Cache TrustGraph visualizations
- Cache Langfuse metrics

### 3. Resource Limits

- Limit concurrent API calls to 10
- WebSocket message queue: 1000 max
- TrustGraph nodes: Auto-cleanup after 7 days

## Security Considerations

1. **API Keys**: Store in environment variables
2. **Correlation IDs**: Don't include sensitive data
3. **Traces**: Sanitize before sending to Langfuse
4. **WebSocket**: Validate all incoming messages
5. **Supabase**: Use row-level security

## Future Enhancements

1. **Grafana Integration**: Real-time dashboards
2. **Prometheus Metrics**: Time-series monitoring
3. **Distributed Tracing**: OpenTelemetry support
4. **AI Anomaly Detection**: Automated issue detection
5. **Cost Prediction**: ML-based cost forecasting

## Conclusion

The observability stack provides comprehensive monitoring and tracing for all swarm operations. By following these practices and regularly reviewing the data, you can ensure optimal performance and quick issue resolution.