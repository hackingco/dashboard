# Swarm Dashboard - Real-time Swarm Monitoring Interface

## Overview

Swarm Dashboard is a comprehensive real-time monitoring and management interface for Claude Flow swarm orchestration. It provides intuitive visualizations, detailed analytics, and interactive controls for managing distributed AI agent swarms.

## Core Features

### 📊 Real-time Monitoring
- **Live Agent Status**: Real-time agent activity and health monitoring
- **Task Progress Tracking**: Visual progress indicators for all running tasks
- **Performance Metrics**: CPU, memory, and coordination efficiency metrics
- **WebSocket Integration**: Instant updates without page refresh

### 🎯 Interactive Management
- **Agent Control Panel**: Start, stop, and configure individual agents
- **Task Orchestration**: Create and manage complex multi-agent workflows
- **Resource Allocation**: Dynamic resource assignment and load balancing
- **Emergency Controls**: Immediate swarm shutdown and recovery options

### 📈 Advanced Analytics
- **Performance Insights**: Historical performance trends and optimization suggestions
- **Collaboration Metrics**: Agent interaction patterns and efficiency analysis
- **Predictive Analytics**: Forecast resource needs and potential bottlenecks
- **Custom Reports**: Generate detailed reports for specific time periods

### 🔧 Configuration Management
- **Topology Visualization**: Interactive swarm topology editor
- **Parameter Tuning**: Real-time configuration adjustment
- **Template Management**: Save and load swarm configuration templates
- **Environment Controls**: Manage multiple deployment environments

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Swarm Dashboard                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  React UI   │  │   WebSocket  │  │    Analytics     │  │
│  │ Components  │  │   Client     │  │    Engine        │  │
│  │             │  │              │  │                  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Agent     │  │   Task       │  │   Performance    │  │
│  │ Management  │  │Orchestration │  │   Monitor        │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Backend Services                       │  │
│  │  • Express API  • Socket.IO  • Langfuse Client     │  │
│  │  • SQLite DB    • Claude Flow Integration          │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites
- Node.js 18+ and npm
- Claude Flow platform
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Quick Start
```bash
# Clone repository
git clone https://github.com/hackingco/swarm-dashboard.git
cd swarm-dashboard

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Dashboard available at http://localhost:3000
```

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up --build

# Dashboard available at http://localhost:3000
# API available at http://localhost:5000
```

## Configuration

### Environment Variables
```bash
# Frontend Configuration
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
REACT_APP_REFRESH_INTERVAL=5000
REACT_APP_THEME=dark

# Backend Configuration
PORT=5000
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000

# Claude Flow Integration
CLAUDE_FLOW_ENABLED=true
CLAUDE_FLOW_API_URL=http://localhost:8080
CLAUDE_FLOW_API_KEY=your_api_key

# Langfuse Integration
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_HOST=https://cloud.langfuse.com

# Database Configuration
DATABASE_URL=sqlite:./data/dashboard.db
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
ENABLE_AUTH=true
```

### Dashboard Configuration
```json
{
  "dashboard": {
    "theme": "dark",
    "autoRefresh": true,
    "refreshInterval": 5000,
    "enableNotifications": true,
    "maxHistoryEntries": 1000
  },
  "monitoring": {
    "enableRealTime": true,
    "enableAlerts": true,
    "alertThresholds": {
      "cpuUsage": 80,
      "memoryUsage": 85,
      "errorRate": 5
    }
  },
  "performance": {
    "enablePredictiveAnalytics": true,
    "historyRetention": "30d",
    "metricAggregationInterval": "1m"
  }
}
```

## Core Features

### Real-time Swarm Monitoring

#### Agent Status Overview
- **Active Agents**: Visual list of all running agents
- **Health Indicators**: Color-coded health status per agent
- **Performance Metrics**: Real-time CPU, memory, and task metrics
- **Communication Patterns**: Agent-to-agent interaction visualization

```javascript
// Example agent status display
{
  id: "agent-001",
  type: "coder",
  status: "active",
  currentTask: "implementing-auth-system",
  progress: 0.75,
  health: {
    cpu: 45.2,
    memory: 68.1,
    lastHeartbeat: "2024-01-15T10:30:00Z"
  },
  capabilities: ["javascript", "react", "testing"],
  coordination: {
    collaboratingWith: ["agent-002", "agent-005"],
    tasksCompleted: 12,
    successRate: 0.92
  }
}
```

#### Task Progress Tracking
- **Visual Progress Bars**: Real-time task completion indicators
- **Dependency Visualization**: Task dependency graphs
- **Bottleneck Detection**: Automatic identification of blocking tasks
- **ETA Predictions**: Estimated completion times based on historical data

### Interactive Agent Management

#### Agent Control Panel
```jsx
// Agent management interface
<AgentControlPanel>
  <AgentList 
    agents={agents}
    onAgentSelect={handleAgentSelect}
    onAgentAction={handleAgentAction}
  />
  <AgentDetails 
    agent={selectedAgent}
    onConfigChange={handleConfigChange}
  />
  <AgentActions>
    <Button onClick={() => startAgent(agent.id)}>Start</Button>
    <Button onClick={() => pauseAgent(agent.id)}>Pause</Button>
    <Button onClick={() => stopAgent(agent.id)}>Stop</Button>
    <Button onClick={() => restartAgent(agent.id)}>Restart</Button>
  </AgentActions>
</AgentControlPanel>
```

#### Task Orchestration Interface
```jsx
// Task orchestration components
<TaskOrchestrator>
  <TaskBuilder 
    onTaskCreate={handleTaskCreate}
    availableAgents={agents}
  />
  <WorkflowDesigner 
    onWorkflowSave={handleWorkflowSave}
    templates={workflowTemplates}
  />
  <ExecutionMonitor 
    runningTasks={tasks}
    onTaskUpdate={handleTaskUpdate}
  />
</TaskOrchestrator>
```

### Analytics & Reporting

#### Performance Analytics
- **Efficiency Metrics**: Task completion rates and optimization opportunities
- **Resource Utilization**: CPU, memory, and network usage analytics
- **Collaboration Patterns**: Agent interaction and coordination efficiency
- **Historical Trends**: Performance trends over time with predictive insights

```javascript
// Analytics data structure
const performanceAnalytics = {
  efficiency: {
    overallTaskCompletionRate: 0.89,
    averageTaskDuration: 145.5,
    resourceUtilizationRate: 0.73,
    collaborationEfficiency: 0.91
  },
  trends: {
    performanceImprovement: 0.15, // 15% improvement over last period
    resourceOptimization: 0.23,   // 23% better resource usage
    errorReduction: 0.45          // 45% fewer errors
  },
  predictions: {
    nextBottleneck: "memory_constraint",
    estimatedTime: "2024-01-15T14:30:00Z",
    recommendedAction: "scale_memory_resources"
  }
}
```

#### Custom Reports
```jsx
// Report generation interface
<ReportGenerator>
  <ReportBuilder 
    metrics={availableMetrics}
    timeRange={timeRanges}
    onGenerateReport={handleReportGeneration}
  />
  <ReportViewer 
    report={generatedReport}
    exportFormats={['pdf', 'csv', 'json']}
  />
</ReportGenerator>
```

### Configuration Management

#### Topology Visualization
```jsx
// Interactive topology editor
<TopologyEditor>
  <SwarmTopologyCanvas 
    topology={currentTopology}
    onTopologyChange={handleTopologyChange}
    tools={topologyTools}
  />
  <TopologyControls 
    presets={topologyPresets}
    onPresetLoad={handlePresetLoad}
  />
</TopologyEditor>
```

#### Parameter Tuning
```jsx
// Real-time parameter adjustment
<ParameterTuner>
  <ParameterGroup name="Performance">
    <Slider 
      label="Max Agents"
      value={config.maxAgents}
      min={1} max={20}
      onChange={handleMaxAgentsChange}
    />
    <Slider 
      label="Task Timeout"
      value={config.taskTimeout}
      min={1000} max={300000}
      onChange={handleTimeoutChange}
    />
  </ParameterGroup>
  <ParameterGroup name="Coordination">
    <Select 
      label="Consensus Threshold"
      value={config.consensusThreshold}
      options={thresholdOptions}
      onChange={handleThresholdChange}
    />
  </ParameterGroup>
</ParameterTuner>
```

## API Reference

### WebSocket Events

#### Agent Events
```javascript
// Agent status updates
socket.on('agent:status', (data) => {
  // Handle agent status change
  updateAgentStatus(data.agentId, data.status);
});

// Agent metrics updates
socket.on('agent:metrics', (data) => {
  // Handle real-time metrics
  updateAgentMetrics(data.agentId, data.metrics);
});
```

#### Task Events
```javascript
// Task progress updates
socket.on('task:progress', (data) => {
  // Handle task progress change
  updateTaskProgress(data.taskId, data.progress);
});

// Task completion events
socket.on('task:completed', (data) => {
  // Handle task completion
  markTaskCompleted(data.taskId, data.result);
});
```

### REST API Endpoints

#### Agent Management
```javascript
// Get all agents
GET /api/agents
// Response: Array of agent objects

// Get specific agent
GET /api/agents/:id
// Response: Detailed agent information

// Update agent configuration
PUT /api/agents/:id/config
// Body: Configuration updates

// Control agent (start/stop/restart)
POST /api/agents/:id/action
// Body: { action: 'start' | 'stop' | 'restart' | 'pause' }
```

#### Task Management
```javascript
// Get all tasks
GET /api/tasks
// Query params: ?status=active&limit=50

// Create new task
POST /api/tasks
// Body: Task definition

// Update task
PUT /api/tasks/:id
// Body: Task updates

// Delete task
DELETE /api/tasks/:id
```

#### Analytics
```javascript
// Get performance metrics
GET /api/analytics/performance
// Query params: ?timeframe=24h&granularity=1h

// Get efficiency report
GET /api/analytics/efficiency
// Query params: ?agents=all&metrics=completion_rate,collaboration

// Generate custom report
POST /api/analytics/reports
// Body: Report configuration
```

## Customization

### Theme Customization
```css
/* Custom theme variables */
:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
  
  --background-color: #1e1e1e;
  --surface-color: #2d2d2d;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
}
```

### Custom Components
```jsx
// Create custom dashboard widgets
import { DashboardWidget } from '@swarm-dashboard/core';

const CustomMetricsWidget = () => {
  return (
    <DashboardWidget title="Custom Metrics">
      <CustomChart data={customData} />
    </DashboardWidget>
  );
};

// Register custom widget
dashboard.registerWidget('custom-metrics', CustomMetricsWidget);
```

### Plugin System
```javascript
// Create dashboard plugin
const myPlugin = {
  name: 'my-custom-plugin',
  version: '1.0.0',
  
  initialize(dashboard) {
    // Plugin initialization
    dashboard.addMenuItem({
      label: 'My Feature',
      path: '/my-feature',
      component: MyFeatureComponent
    });
  },
  
  destroy() {
    // Cleanup when plugin is removed
  }
};

// Register plugin
dashboard.use(myPlugin);
```

## Deployment

### Production Deployment
```bash
# Build for production
npm run build

# Start production server
npm run start:prod

# Or use PM2 for process management
pm2 start ecosystem.config.js
```

### Docker Production
```dockerfile
# Multi-stage production build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build

EXPOSE 3000 5000
CMD ["npm", "run", "start:prod"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: swarm-dashboard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: swarm-dashboard
  template:
    metadata:
      labels:
        app: swarm-dashboard
    spec:
      containers:
      - name: dashboard
        image: swarm-dashboard:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: dashboard-secrets
              key: database-url
```

## Monitoring & Alerting

### Health Checks
```javascript
// Application health monitoring
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabaseHealth(),
      claudeFlow: await checkClaudeFlowHealth(),
      langfuse: await checkLangfuseHealth(),
      websocket: checkWebSocketHealth()
    }
  };
  
  res.json(health);
});
```

### Performance Monitoring
```javascript
// Performance metrics collection
const performanceMonitor = {
  collectMetrics: () => {
    return {
      responseTime: getAverageResponseTime(),
      throughput: getRequestsPerSecond(),
      errorRate: getErrorRate(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: getCpuUsage()
    };
  },
  
  sendMetrics: (metrics) => {
    // Send to monitoring service
    langfuse.trackMetrics(metrics);
  }
};
```

### Alert Configuration
```javascript
// Alert rules
const alertRules = [
  {
    name: 'High CPU Usage',
    condition: 'cpu > 80',
    severity: 'warning',
    action: 'scale_up'
  },
  {
    name: 'Agent Failure',
    condition: 'agent_status == "failed"',
    severity: 'critical',
    action: 'restart_agent'
  },
  {
    name: 'Task Timeout',
    condition: 'task_duration > max_duration',
    severity: 'error',
    action: 'kill_task'
  }
];
```

## Best Practices

### Performance Optimization
1. **Use WebSocket efficiently** - Batch updates when possible
2. **Implement pagination** - Don't load all data at once
3. **Cache frequently accessed data** - Use Redis for caching
4. **Optimize re-renders** - Use React.memo and useMemo appropriately

### Security
1. **Implement authentication** - Secure dashboard access
2. **Use HTTPS in production** - Encrypt all communications
3. **Validate inputs** - Sanitize all user inputs
4. **Rate limiting** - Prevent API abuse

### Scalability
1. **Horizontal scaling** - Use load balancers for multiple instances
2. **Database optimization** - Index frequently queried columns
3. **Caching strategy** - Implement multi-level caching
4. **WebSocket scaling** - Use Redis adapter for Socket.IO

## Troubleshooting

### Common Issues

#### Dashboard not loading
```bash
# Check if services are running
curl http://localhost:5000/health

# Check logs
docker logs swarm-dashboard-backend
docker logs swarm-dashboard-frontend
```

#### WebSocket connection issues
```javascript
// Debug WebSocket connection
socket.on('connect_error', (error) => {
  console.error('WebSocket connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('WebSocket disconnected:', reason);
});
```

#### Performance issues
```bash
# Monitor resource usage
docker stats swarm-dashboard

# Check database performance
sqlite3 data/dashboard.db "EXPLAIN QUERY PLAN SELECT * FROM agents;"
```

## Support & Community

- **Documentation**: [https://github.com/hackingco/swarm-dashboard](https://github.com/hackingco/swarm-dashboard)
- **Issues**: [GitHub Issues](https://github.com/hackingco/swarm-dashboard/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/hackingco/swarm-dashboard/discussions)
- **Live Demo**: [https://demo.swarm-dashboard.com](https://demo.swarm-dashboard.com)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with React and Material-UI
- Real-time updates powered by Socket.IO
- Charts and visualizations by Recharts
- Backend powered by Express.js
- Integrated with Claude Flow ecosystem

---

**Monitor, Manage, and Optimize your swarm intelligence in real-time.**