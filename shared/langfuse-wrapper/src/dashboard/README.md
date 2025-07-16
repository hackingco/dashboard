# Enhanced Live Dashboard for Swarm Coordination

A production-ready, real-time monitoring dashboard for swarm coordination with WebSocket streaming, Chart.js visualizations, and advanced alerting capabilities.

## 🚀 Features

### Core Features
- **Real-time WebSocket Streaming**: True bi-directional communication with delta compression
- **Chart.js Integration**: Beautiful, interactive charts for performance metrics
- **Advanced Alert System**: Severity-based alerts with customizable actions
- **Mobile Responsive**: Optimized for all device sizes
- **Dark Theme UI**: Modern, eye-friendly interface
- **Performance Optimization**: Rate limiting and compression for efficiency

### Technical Capabilities
- **Delta Compression**: Reduces bandwidth by 70-90% for metric updates
- **Adaptive Thresholds**: Dynamic alert thresholds based on historical data
- **Metric Aggregation**: Time-series data with statistical analysis
- **Connection Recovery**: Automatic reconnection with exponential backoff
- **Message Queuing**: Ensures no data loss during temporary disconnections

## 📊 Dashboard Components

### 1. Enhanced Live Dashboard (`enhanced-live-dashboard.ts`)
The main dashboard class that orchestrates all components:
- HTTP server for dashboard UI
- WebSocket integration for real-time updates
- Metrics collection and aggregation
- Alert threshold monitoring

### 2. WebSocket Handler (`websocket/websocket-handler.ts`)
Manages WebSocket connections with advanced features:
- Client authentication and session management
- Message compression (gzip)
- Rate limiting per client
- Heartbeat mechanism for connection health
- Message queue for offline clients

### 3. Alert Manager (`components/alert-manager.ts`)
Intelligent alert system with:
- Configurable severity levels (info, warning, critical)
- Alert correlation and grouping
- Custom actions (acknowledge, resolve, escalate, snooze)
- Auto-resolution with timeouts
- Historical tracking and statistics

### 4. Metrics Aggregator (`utils/metrics-aggregator.ts`)
Time-series data management:
- Sliding window aggregations (1m, 5m, 15m, 1h)
- Statistical calculations (min, max, avg, p50, p95, p99)
- Anomaly detection with configurable sensitivity
- Correlation analysis between metrics
- Forecasting with linear regression

### 5. Chart Data Provider (`utils/chart-data-provider.ts`)
Chart.js data formatting:
- Multiple chart types (line, bar, pie, doughnut)
- Real-time data updates
- Custom color palettes
- Responsive configurations
- Multi-metric correlation charts

## 🛠️ Installation & Usage

### Basic Setup

```typescript
import { EnhancedLiveDashboard } from './dashboard/enhanced-live-dashboard';
import { RealTimeObserver } from './real-time-observer';
import { StreamingTraceIntegration } from './streaming-trace-integration';

// Initialize dependencies
const realTimeObserver = new RealTimeObserver();
const streamingIntegration = new StreamingTraceIntegration();

// Create dashboard with configuration
const dashboard = new EnhancedLiveDashboard(
  realTimeObserver,
  streamingIntegration,
  {
    port: 3001,                    // HTTP port
    wsPort: 3002,                  // WebSocket port
    refreshIntervalMs: 1000,       // Update frequency
    enableWebSocket: true,         // Enable real-time streaming
    enableCharts: true,            // Enable Chart.js visualizations
    enableAlerts: true,            // Enable alert system
    enableMobileOptimization: true,// Mobile-friendly UI
    theme: 'dark',                 // UI theme
    maxDataPoints: 1000,           // History retention
    compressionEnabled: true,      // Enable gzip compression
    rateLimitMs: 100,             // Rate limit per client
    alertThresholds: {
      errorRate: 0.05,            // 5% error rate threshold
      latency: 1000,              // 1s latency threshold
      memoryUsage: 80,            // 80% memory threshold
      cpuUsage: 80,               // 80% CPU threshold
      tokenThroughput: 10         // Min tokens/sec
    }
  }
);

// Start the dashboard
await dashboard.start();
```

### Event Handling

```typescript
// Dashboard lifecycle events
dashboard.on('started', () => {
  console.log('Dashboard started successfully');
});

dashboard.on('stopped', () => {
  console.log('Dashboard stopped');
});

// Alert events
dashboard.on('alert_created', (alert) => {
  console.log(`New alert: ${alert.message}`);
});

dashboard.on('alert_resolved', ({ alert, reason }) => {
  console.log(`Alert resolved: ${alert.id} - ${reason}`);
});

// Metrics events
dashboard.on('metrics_updated', (metrics) => {
  console.log(`Efficiency: ${metrics.performance.efficiency}%`);
});
```

### Custom Alert Rules

```typescript
// Add custom alert rule
dashboard.alertManager.addRule({
  id: 'custom-rule',
  name: 'Custom Performance Rule',
  condition: (metrics) => metrics.performance.efficiency < 50,
  severity: 'warning',
  category: 'performance',
  message: 'Performance efficiency below 50%',
  cooldownMs: 300000, // 5 minute cooldown
  enabled: true
});

// Update thresholds dynamically
dashboard.alertManager.updateThresholds({
  errorRate: 0.1,  // Increase to 10%
  latency: 2000    // Increase to 2s
});
```

### WebSocket Client Integration

```javascript
// Connect from a web client
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => {
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channels: ['metrics', 'alerts'] }
  }));

  // Configure client features
  ws.send(JSON.stringify({
    type: 'configure',
    data: {
      compression: true,
      features: {
        supportsCharts: true,
        isMobile: false
      }
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'metrics_update':
      updateDashboard(message.data);
      break;
    case 'alert':
      showAlert(message.data);
      break;
  }
};
```

## 📈 Chart Configurations

### Performance Trend Chart
```typescript
const perfConfig = chartProvider.getPerformanceChartConfig(performanceData);
// Returns Chart.js configuration for efficiency trends
```

### Token Flow Chart
```typescript
const tokenConfig = chartProvider.getTokenFlowChartConfig(tokenData);
// Returns Chart.js configuration for token throughput
```

### Multi-Metric Correlation
```typescript
const correlationConfig = chartProvider.getCorrelationMatrixConfig([
  'latency',
  'throughput',
  'errorRate',
  'efficiency'
]);
// Returns heatmap showing metric correlations
```

## 🎨 UI Customization

### Theme Configuration
The dashboard supports light/dark themes with CSS variables:

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --text-primary: #ffffff;
  --accent-primary: #667eea;
  --success: #4ade80;
  --warning: #fbbf24;
  --error: #ef4444;
}
```

### Mobile Optimization
- Responsive grid layouts
- Touch-friendly controls
- Reduced data updates on mobile
- Simplified charts for small screens

## 🔧 Advanced Features

### Delta Compression
Reduces bandwidth usage by sending only changed values:
```typescript
// Full update: ~5KB
{
  system: { memory: 512, cpu: 45, ... },
  swarm: { active: 5, agents: 20, ... },
  // ... all metrics
}

// Delta update: ~200B
{
  delta: [
    { path: 'system.memory', operation: 'update', value: 520 },
    { path: 'swarm.agents', operation: 'update', value: 21 }
  ],
  compressionRatio: 25.0
}
```

### Alert Correlation
Groups related alerts to reduce noise:
```typescript
// Correlated alerts share a correlationId
alertManager.createAlert(
  'critical',
  'system',
  'High memory usage detected',
  details,
  actions,
  { correlationId: 'system-resources-123' }
);
```

### Performance Monitoring
Built-in performance tracking:
```typescript
const stats = dashboard.exportMetrics();
console.log(`Average latency: ${stats.metrics.averageLatency}ms`);
console.log(`Compression ratio: ${stats.compressionRatio}x`);
console.log(`Active connections: ${stats.connections}`);
```

## 🚨 Alert Management

### Alert Lifecycle
1. **Creation**: Triggered by threshold or custom rule
2. **Notification**: Broadcast to connected clients
3. **Action**: User acknowledges/resolves/escalates
4. **Resolution**: Manual or auto-resolution
5. **Archival**: Historical tracking for analysis

### Alert Actions
- **Acknowledge**: Mark as seen
- **Resolve**: Close the alert
- **Escalate**: Upgrade severity and notify
- **Snooze**: Temporarily hide (30m default)
- **Custom**: Define custom handlers

## 📊 Metrics Collected

### System Metrics
- Memory usage (MB)
- CPU usage (%)
- Active connections
- Uptime

### Swarm Metrics
- Active swarms
- Total agents
- Coordination latency (ms)
- Sync success rate (%)
- Cross-agent communications

### Trace Metrics
- Active traces
- Total traces
- Average latency (ms)
- Token throughput (tokens/sec)
- Error rate (%)
- Completion rate (%)

### Performance Metrics
- Overall efficiency (%)
- Throughput score
- Resource utilization (%)
- Anomaly count
- Adaptive thresholds

## 🔒 Security Considerations

- WebSocket connections should use WSS in production
- Implement authentication for dashboard access
- Rate limiting prevents DoS attacks
- Sanitize all user inputs
- Use environment variables for sensitive config

## 🐛 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check firewall settings
   - Verify port availability
   - Ensure CORS headers are set

2. **High Memory Usage**
   - Reduce `maxDataPoints` setting
   - Enable more aggressive cleanup
   - Limit connected clients

3. **Charts Not Updating**
   - Verify Chart.js is loaded
   - Check browser console for errors
   - Ensure data format is correct

### Debug Mode
Enable detailed logging:
```typescript
const dashboard = new EnhancedLiveDashboard(observer, integration, {
  // ... other config
  debug: true,
  logLevel: 'verbose'
});
```

## 📝 License

This enhanced dashboard is part of the Langfuse wrapper project and follows the same license terms.