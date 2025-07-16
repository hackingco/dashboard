# 🎯 Real-Time Tracing Observations

## Overview

This enhanced Langfuse wrapper provides comprehensive real-time observation capabilities for swarm coordination monitoring. The system implements streaming trace updates, live dashboards, adaptive tracing, automated anomaly detection, and feedback loops for continuous optimization.

## 🚀 Features

### 1. Real-Time Observer
- **WebSocket streaming** for live trace updates
- **Performance metrics collection** with sub-second granularity
- **Anomaly detection** with configurable thresholds
- **SQLite persistence** for data retention and analysis
- **Health monitoring** with auto-recovery capabilities

### 2. Streaming Trace Integration
- **Real-time trace updates** with performance snapshots
- **Adaptive thresholds** that learn from historical data
- **Coordination info** for swarm synchronization
- **Performance trend analysis** with predictive capabilities
- **Resource optimization** based on usage patterns

### 3. Live Dashboard
- **Web-based interface** at `http://localhost:3001`
- **Real-time metrics visualization** with auto-refresh
- **System health monitoring** with color-coded status
- **Alert management** with severity-based filtering
- **Metrics export** for external analysis tools

### 4. Adaptive Tracing System
- **Machine learning-based** strategy selection
- **Pattern recognition** for performance optimization
- **Smart sampling** that adjusts based on conditions
- **Resource optimization** for memory and CPU usage
- **Contextual adaptation** based on agent roles and swarm size

### 5. Anomaly Detection System
- **Statistical analysis** using baseline comparisons
- **Pattern-based detection** with custom rules
- **ML-powered detection** using simple neural networks
- **Predictive anomalies** based on trend analysis
- **Feedback loops** for continuous accuracy improvement

### 6. Feedback Optimization System
- **Automated performance feedback** from trace completions
- **Optimization recommendations** with risk assessment
- **Auto-application** of safe optimizations
- **Effectiveness measurement** with rollback capabilities
- **Continuous learning** from optimization results

## 📦 Installation

```bash
# Install dependencies
npm install

# Install additional real-time dependencies
npm install ws @types/ws better-sqlite3
```

## 🔧 Configuration

### Basic Setup

```typescript
import { LangfuseWrapper, initializeRealTimeIntegration } from '@swarm/langfuse-wrapper';

// Initialize Langfuse wrapper
const langfuseWrapper = new LangfuseWrapper({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  host: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
  enabled: true
});

// Initialize real-time integration
const realTimeIntegration = initializeRealTimeIntegration(langfuseWrapper, {
  enableRealTimeObserver: true,
  enableStreamingIntegration: true,
  enableLiveDashboard: true,
  enableAdaptiveTracing: true,
  enableAnomalyDetection: true,
  enableFeedbackOptimization: true,
  
  // Port configuration
  observerPort: 8080,
  dashboardPort: 3001,
  
  // Performance tuning
  adaptiveLearningRate: 0.1,
  anomalySensitivity: 'medium',
  autoOptimizationEnabled: true
});

// Start the system
await realTimeIntegration.start();
```

### Advanced Configuration

```typescript
const config = {
  // Observer settings
  observerPort: 8080,
  observerRefreshInterval: 2000,
  
  // Dashboard settings
  dashboardPort: 3001,
  dashboardTheme: 'dark', // 'light' | 'dark' | 'auto'
  
  // Adaptive tracing settings
  adaptiveLearningRate: 0.1,
  adaptiveThreshold: 0.2,
  
  // Anomaly detection settings
  anomalySensitivity: 'medium', // 'low' | 'medium' | 'high' | 'adaptive'
  anomalyWindowSize: 300000, // 5 minutes
  
  // Optimization settings
  optimizationInterval: 60000, // 1 minute
  autoOptimizationEnabled: true,
  
  // Database configuration
  databaseDirectory: '.swarm'
};
```

## 🎮 Usage

### Basic Tracing

```typescript
// Start a trace with swarm context
const traceId = await realTimeIntegration.startTrace({
  hookType: 'swarm-operation',
  swarmId: 'my-swarm-001',
  agentId: 'researcher-001',
  agentRole: 'researcher',
  taskId: 'task-001',
  operationType: 'execute',
  metadata: {
    taskDescription: 'Research market trends',
    priority: 'high'
  }
});

// Update trace with progress
await realTimeIntegration.updateTrace(traceId, {
  step: 1,
  progress: 33,
  status: 'processing',
  details: 'Analyzing data sources'
});

// Complete the trace
await realTimeIntegration.completeTrace(traceId, {
  status: 'completed',
  output: 'Research completed successfully',
  metrics: {
    executionTime: 1500,
    resourcesUsed: 15,
    efficiency: 92
  }
}, {
  input: 150,
  output: 300,
  total: 450
});
```

### Error Handling

```typescript
try {
  // Trace operation
  const traceId = await realTimeIntegration.startTrace(context);
  // ... operation logic
  await realTimeIntegration.completeTrace(traceId, result);
} catch (error) {
  // Error tracing
  await realTimeIntegration.errorTrace(traceId, error);
}
```

### System Monitoring

```typescript
// Get real-time system status
const status = realTimeIntegration.getSystemStatus();
console.log('System Health:', status.health);
console.log('Active Traces:', status.metrics.activeTraces);

// Get component-specific information
const observer = realTimeIntegration.getRealTimeObserver();
const metrics = observer.getMetrics();
console.log('Observer Metrics:', metrics);

// Get recent observations
const recentObs = observer.getRecentObservations(10);
recentObs.forEach(obs => {
  console.log(`${obs.type} - ${obs.agentRole} (${obs.performanceMetrics.latencyMs}ms)`);
});
```

### Adaptive Features

```typescript
// Get current tracing strategy
const adaptiveTracing = realTimeIntegration.getAdaptiveTracing();
const currentStrategy = adaptiveTracing.getCurrentStrategy();
console.log('Current Strategy:', currentStrategy.name);

// Get learned patterns
const patterns = adaptiveTracing.getPatterns();
patterns.forEach(pattern => {
  console.log(`Pattern: ${pattern.pattern} (confidence: ${pattern.confidence})`);
});

// Force strategy change
adaptiveTracing.forceStrategySwitch('high_performance');
```

### Anomaly Management

```typescript
// Get recent anomalies
const anomalyDetection = realTimeIntegration.getAnomalyDetection();
const anomalies = anomalyDetection.getAnomalies(24); // Last 24 hours

// Provide feedback on anomaly
anomalyDetection.provideFeedback('anomaly-id', {
  timestamp: Date.now(),
  isValid: false,
  severity: 'false_positive',
  userNotes: 'This was expected behavior'
});

// Add custom anomaly pattern
anomalyDetection.addCustomPattern({
  id: 'custom_pattern',
  name: 'Custom Performance Pattern',
  description: 'Detects custom performance degradation',
  detectionLogic: 'custom logic',
  thresholds: { customMetric: 100 },
  confidence: 0.8,
  accuracy: 0.85,
  falsePositiveRate: 0.05,
  lastDetection: 0,
  detectionCount: 0,
  enabled: true
});
```

### Feedback and Optimization

```typescript
// Get optimization recommendations
const feedbackOptimization = realTimeIntegration.getFeedbackOptimization();
const recommendations = feedbackOptimization.getRecommendations();

recommendations.forEach(rec => {
  console.log(`Recommendation: ${rec.description}`);
  console.log(`Expected improvement: ${rec.expectedImprovement * 100}%`);
  console.log(`Priority: ${rec.priority}`);
});

// Force apply an optimization
feedbackOptimization.forceOptimization('recommendation-id');

// Add user feedback
feedbackOptimization.addUserFeedback('trace-id', 8.5, 'Good performance');

// Get feedback metrics
const feedbackMetrics = feedbackOptimization.getFeedbackMetrics();
console.log('Optimization Success Rate:', feedbackMetrics.successRate);
```

## 🌐 API Endpoints

### Real-Time Observer API

- `GET /health` - System health status
- `GET /metrics` - Current metrics snapshot
- `WebSocket /` - Real-time observations stream

### Live Dashboard API

- `GET /` - Dashboard interface
- `GET /api/metrics` - Current system metrics
- `GET /api/metrics/history` - Historical metrics data
- `GET /api/alerts` - Active alerts
- `GET /api/swarms` - Swarm activity data
- `GET /api/traces` - Active trace information
- `GET /api/export` - Export system data

## 📊 Metrics and Monitoring

### System Metrics

- **Total Traces**: Number of traces processed
- **Active Traces**: Currently running traces
- **Average Latency**: Mean response time
- **Token Throughput**: Tokens processed per second
- **Error Rate**: Percentage of failed operations
- **Anomaly Count**: Detected anomalies
- **Coordination Latency**: Swarm synchronization delay

### Performance Metrics

- **Efficiency Score**: Overall system efficiency (0-100)
- **Throughput Score**: Processing throughput rating
- **Resource Utilization**: Memory and CPU usage
- **Success Rate**: Successful operation percentage
- **User Satisfaction**: Performance satisfaction score

### Swarm Coordination Metrics

- **Active Swarms**: Number of active swarms
- **Total Agents**: Number of active agents
- **Sync Success Rate**: Coordination success percentage
- **Cross-Agent Communication**: Inter-agent message count

## 🚨 Alerting and Notifications

### Alert Types

- **Critical**: System failures, security issues
- **Warning**: Performance degradation, resource limits
- **Info**: Strategy changes, optimizations applied

### Alert Channels

- **Dashboard**: Visual alerts in the web interface
- **WebSocket**: Real-time alert streaming
- **Events**: Programmatic event handlers
- **Logs**: Structured logging with severity levels

## 🔧 Troubleshooting

### Common Issues

#### High Memory Usage
```typescript
// Check memory baselines
const baselines = adaptiveTracing.getAdaptiveMetrics();
console.log('Memory usage baseline:', baselines.averageEffectiveness);

// Force garbage collection
if (global.gc) {
  global.gc();
}
```

#### WebSocket Connection Issues
```typescript
// Check observer status
const observer = realTimeIntegration.getRealTimeObserver();
console.log('Observer running:', observer.isRunning());
console.log('Client count:', observer.getClientCount());
```

#### Dashboard Not Loading
```typescript
// Check dashboard status
const dashboard = realTimeIntegration.getLiveDashboard();
console.log('Dashboard running:', dashboard.isRunning());

// Check port availability
curl http://localhost:3001/api/health
```

### Performance Optimization

#### Reduce Sampling Rate
```typescript
const strategy = adaptiveTracing.getCurrentStrategy();
strategy.samplingRate = 0.1; // Reduce to 10%
```

#### Disable Features
```typescript
// Disable resource-intensive features
const config = {
  enableAnomalyDetection: false,
  enableFeedbackOptimization: false
};
realTimeIntegration.updateConfig(config);
```

#### Database Cleanup
```typescript
// Cleanup old data
const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
// Automatic cleanup is performed, but can be triggered manually
```

## 📚 Examples

See the `examples/real-time-tracing-example.ts` file for a comprehensive demonstration of all features.

### Quick Start Example

```bash
# Clone the repository
git clone <repository-url>
cd shared/langfuse-wrapper

# Install dependencies
npm install

# Set environment variables
export LANGFUSE_PUBLIC_KEY="your-public-key"
export LANGFUSE_SECRET_KEY="your-secret-key"

# Run the example
npm run build
node dist/examples/real-time-tracing-example.js
```

## 🔮 Future Enhancements

- **Multi-tenant support** for different organizations
- **Advanced ML models** for anomaly detection
- **Integration with external monitoring** tools (Grafana, Prometheus)
- **Custom visualization** plugins for the dashboard
- **Distributed tracing** across multiple servers
- **Real-time collaboration** features for team monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues tracker
- **Documentation**: This README and inline code comments
- **Examples**: `examples/` directory
- **Tests**: `tests/` directory with comprehensive test cases

---

🎯 **Real-Time Tracing Observations** - Enhancing swarm coordination through intelligent observability