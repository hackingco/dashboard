# 🚀 Claude Flow Trace - Quick Start Guide

Get up and running with Claude Flow Trace in under 5 minutes!

## 📋 Prerequisites

- Node.js 18+ installed
- Claude Flow v2.0.0+ installed
- npm or yarn package manager

## ⚡ 1-Minute Setup

### Option 1: Global Installation (Recommended)

```bash
# Install globally
npm install -g claude-flow-trace

# Run automatic setup
claude-flow-trace setup

# Verify installation
claude-flow-trace status
```

### Option 2: Project-Specific Installation

```bash
# In your project directory
npm install --save-dev claude-flow-trace

# Run setup
npx claude-flow-trace setup

# Add to package.json scripts
npm pkg set scripts.trace="claude-flow-trace"
```

## 🎯 Basic Usage

### Start Tracing

```bash
# Start the trace collector
claude-flow-trace start

# In another terminal, run any Claude Flow command
npx claude-flow@alpha hive-mind spawn "Build a REST API"

# View real-time traces
claude-flow-trace monitor
```

### View Traces

```bash
# List recent traces
claude-flow-trace list

# Search specific commands
claude-flow-trace search "hive-mind"

# Export traces
claude-flow-trace export --format json > traces.json
```

## 🔧 Configuration

### Quick Config

Create a `.claude-flow-trace.json` in your project root:

```json
{
  "collector": {
    "port": 9876,
    "websocketPort": 9877
  },
  "storage": {
    "path": "~/.claude-flow/traces",
    "retentionDays": 30
  },
  "langfuse": {
    "enabled": true,
    "publicKey": "your-public-key",
    "secretKey": "your-secret-key"
  }
}
```

### Environment Variables

```bash
# Create .env file
cat > .env << EOF
# Trace Collector
TRACE_COLLECTOR_PORT=9876
TRACE_WEBSOCKET_PORT=9877

# Langfuse Integration  
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_SECRET_KEY=your-secret-key

# Performance
TRACE_BUFFER_SIZE=10000
EOF
```

## 📊 Common Use Cases

### 1. Debug Command Execution

```bash
# Enable debug mode
export TRACE_DEBUG=true

# Run problematic command
npx claude-flow@alpha swarm "Complex task"

# View detailed trace
claude-flow-trace show --last --detailed
```

### 2. Monitor Performance

```bash
# Start performance monitoring
claude-flow-trace perf --watch

# Run your workflow
npx claude-flow@alpha hive-mind spawn "Build app" --agents 5

# View performance report
claude-flow-trace perf --report
```

### 3. Track Costs

```bash
# Enable cost tracking
claude-flow-trace costs --enable

# Run operations
npx claude-flow@alpha swarm "Analyze codebase"

# View cost breakdown
claude-flow-trace costs --summary
```

## 🛠️ Integration Examples

### JavaScript/TypeScript

```javascript
const { TraceClient } = require('claude-flow-trace');

// Create client
const tracer = new TraceClient({
  port: 9876,
  autoConnect: true
});

// Subscribe to traces
tracer.on('trace', (trace) => {
  console.log(`Command: ${trace.command}`);
  console.log(`Duration: ${trace.duration}ms`);
});

// Query traces
const recentTraces = await tracer.query({
  limit: 10,
  filter: { command: 'hive-mind' }
});
```

### REST API

```bash
# Get recent traces
curl http://localhost:9876/traces?limit=10

# Search traces
curl -X POST http://localhost:9876/traces/search \
  -H "Content-Type: application/json" \
  -d '{"query": "spawn", "timeRange": "1h"}'

# Get statistics
curl http://localhost:9876/stats
```

### WebSocket

```javascript
// Connect to real-time stream
const ws = new WebSocket('ws://localhost:9877');

// Subscribe to specific traces
ws.send(JSON.stringify({
  type: 'subscribe',
  filter: {
    commands: ['hive-mind', 'swarm'],
    sources: ['cli-wrapper']
  }
}));

// Handle incoming traces
ws.on('message', (data) => {
  const event = JSON.parse(data);
  if (event.type === 'trace') {
    console.log('New trace:', event.trace);
  }
});
```

## 🎨 Dashboard

### Start Web Dashboard

```bash
# Launch dashboard
claude-flow-trace dashboard

# Open in browser
open http://localhost:9878
```

### Dashboard Features

- Real-time trace timeline
- Command frequency charts
- Performance metrics
- Error tracking
- Agent coordination view

## 🐛 Troubleshooting

### Common Issues

#### Traces Not Appearing

```bash
# Check collector status
claude-flow-trace status

# Verify wrapper installation
claude-flow-trace verify

# Test trace submission
claude-flow-trace test-trace
```

#### Port Conflicts

```bash
# Use alternative ports
claude-flow-trace start --port 9900 --ws-port 9901

# Or set in environment
export TRACE_COLLECTOR_PORT=9900
export TRACE_WEBSOCKET_PORT=9901
```

#### Permission Issues

```bash
# Fix permissions
sudo claude-flow-trace setup --global

# Or use local installation
claude-flow-trace setup --local
```

## 📚 Next Steps

- Read the [Full Documentation](README.md)
- Explore [API Reference](docs/api.md)
- Check out [Examples](docs/examples.md)
- Join our [Community](https://github.com/ruvnet/claude-flow-trace/discussions)

## 💡 Pro Tips

1. **Batch Operations**: Group traces for better performance
2. **Filtering**: Use filters to reduce noise in high-volume environments
3. **Retention**: Set appropriate retention policies to manage storage
4. **Webhooks**: Configure webhooks for alerts on specific events
5. **Custom Sources**: Add your own trace sources for complete coverage

---

<div align="center">
  <sub>
    Need help? Check our <a href="https://github.com/ruvnet/claude-flow-trace/wiki">Wiki</a> or <a href="https://github.com/ruvnet/claude-flow-trace/issues">open an issue</a>
  </sub>
</div>