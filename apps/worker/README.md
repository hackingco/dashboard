# Worker Service

**Distributed Agent Execution Engine for Swarm Intelligence Platform**

*High-performance worker agents for distributed task execution and coordination*

---

## 🚀 Overview

The Worker Service provides the distributed execution layer for the swarm intelligence platform. Each worker instance runs specialized AI agents that can be dynamically spawned, scaled, and coordinated across multiple regions using Fly.io Machines. Built with TypeScript and designed for high concurrency, workers handle task execution, inter-agent communication, and real-time coordination.

## ✨ Key Features

### 🎯 Agent Execution
- **Multi-Agent Types** - Coordinator, Researcher, Coder, Analyst, Tester, and custom agents
- **Dynamic Spawning** - On-demand agent creation via Fly.io Machines API
- **Capability-Based Routing** - Intelligent task assignment based on agent capabilities
- **Performance Optimization** - Auto-tuning and resource management
- **Fault Tolerance** - Automatic recovery and graceful degradation

### ⚡ High-Performance Processing
- **Concurrent Execution** - Multi-threaded task processing with worker pools
- **Resource Management** - CPU and memory optimization with adaptive scaling
- **Load Balancing** - Intelligent task distribution across available workers
- **Caching Layer** - Redis-based caching for improved performance
- **Connection Pooling** - Efficient database and API connection management

### 🔗 Swarm Coordination
- **Real-time Communication** - WebSocket connections to Manager service
- **Consensus Participation** - Distributed decision-making algorithms
- **State Synchronization** - Real-time state sharing across worker instances
- **Event Broadcasting** - Efficient event propagation and handling
- **Health Monitoring** - Continuous health reporting and diagnostics

### 🛠️ Developer Experience
- **TypeScript** - Full type safety with comprehensive type definitions
- **Hot Reloading** - Fast development with automatic restarts
- **Comprehensive Logging** - Structured logging with multiple output formats
- **Metrics Collection** - Built-in performance and usage metrics
- **Docker Support** - Containerized deployment with optimized images

---

## 🏗️ Architecture

### Service Structure
```
apps/worker/
├── src/
│   ├── index.ts              # Main entry point and server setup
│   ├── agents/               # Agent implementations
│   │   ├── base-agent.ts     # Base agent abstract class
│   │   ├── coordinator.ts    # Coordinator agent implementation
│   │   ├── researcher.ts     # Research agent implementation
│   │   ├── coder.ts          # Coding agent implementation
│   │   ├── analyst.ts        # Analysis agent implementation
│   │   └── tester.ts         # Testing agent implementation
│   ├── services/             # Core services
│   │   ├── task-executor.ts  # Task execution engine
│   │   ├── websocket-client.ts # Manager communication
│   │   ├── health-monitor.ts # Health checking service
│   │   └── metrics-collector.ts # Performance metrics
│   ├── utils/                # Utility functions
│   │   ├── logger.ts         # Structured logging
│   │   ├── config.ts         # Configuration management
│   │   └── performance.ts    # Performance utilities
│   └── types/                # TypeScript definitions
├── tests/                    # Test suites
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── smoke/                # Smoke tests
├── Dockerfile                # Container definition
└── fly.toml                  # Fly.io configuration
```

### Agent Types

#### 🎯 Coordinator Agent
- **Purpose**: Orchestrate and coordinate other agents
- **Capabilities**: Task delegation, resource management, consensus building
- **Use Cases**: Swarm leadership, complex workflow orchestration

#### 🔍 Researcher Agent
- **Purpose**: Information gathering and analysis
- **Capabilities**: Web research, data collection, knowledge synthesis
- **Use Cases**: Market research, competitive analysis, documentation

#### 💻 Coder Agent
- **Purpose**: Code generation, review, and optimization
- **Capabilities**: Programming, debugging, code analysis, testing
- **Use Cases**: Software development, code reviews, bug fixes

#### 📊 Analyst Agent
- **Purpose**: Data analysis and insights generation
- **Capabilities**: Statistical analysis, pattern recognition, reporting
- **Use Cases**: Performance analysis, trend identification, metrics

#### 🧪 Tester Agent
- **Purpose**: Quality assurance and testing
- **Capabilities**: Test creation, execution, validation, reporting
- **Use Cases**: Automated testing, quality assurance, validation

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 8+
- **Redis** instance for caching
- **Manager Service** running (see [../manager/README.md](../manager/README.md))
- **Fly.io** account for production deployment

### Environment Setup

Create `.env` file:

```env
# Worker Configuration
NODE_ENV=development
PORT=8000
WORKER_ID=worker-dev-001
WORKER_TYPE=generic
WORKER_CONCURRENCY=4

# Manager Service Connection
MANAGER_URL=http://localhost:8080
MANAGER_WS_URL=ws://localhost:8080/ws
MANAGER_API_KEY=your-manager-api-key

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=worker:

# Agent Configuration
AGENT_SPAWN_TIMEOUT=30000
AGENT_MAX_CONCURRENT_TASKS=10
AGENT_HEALTH_CHECK_INTERVAL=15000

# Claude Integration
CLAUDE_API_KEY=your-claude-api-key
CLAUDE_MODEL=claude-3-sonnet-20240229

# Performance Settings
MAX_MEMORY_USAGE=80
CPU_THRESHOLD=85
TASK_TIMEOUT=300000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_PATH=/health
```

### Installation & Development

```bash
# Navigate to worker directory
cd apps/worker

# Install dependencies
pnpm install

# Start Redis (if running locally)
redis-server

# Start development server
pnpm dev

# Worker will be available at http://localhost:8000
```

### Development Commands

```bash
# Development
pnpm dev              # Start with hot reloading
pnpm dev:debug        # Start with debugging enabled
pnpm dev:agent        # Start specific agent type

# Building
pnpm build            # Build production bundle
pnpm build:docker     # Build Docker image
pnpm start            # Start production server

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests
pnpm test:smoke       # Smoke tests
pnpm test:load        # Load testing

# Agent Testing
pnpm test:coordinator # Test coordinator agent
pnpm test:researcher  # Test researcher agent
pnpm test:coder       # Test coder agent

# Code Quality
pnpm lint             # ESLint checking
pnpm lint:fix         # Auto-fix linting issues
pnpm type-check       # TypeScript checking
```

---

## 🤖 Agent Implementation

### Base Agent Class

```typescript
// Base agent implementation
import { EventEmitter } from 'events';

export abstract class BaseAgent extends EventEmitter {
  protected id: string;
  protected type: string;
  protected capabilities: string[];
  protected status: 'idle' | 'busy' | 'error' | 'stopped';
  protected currentTask?: Task;

  constructor(config: AgentConfig) {
    super();
    this.id = config.id;
    this.type = config.type;
    this.capabilities = config.capabilities;
    this.status = 'idle';
  }

  abstract async executeTask(task: Task): Promise<TaskResult>;
  abstract async initialize(): Promise<void>;
  abstract async shutdown(): Promise<void>;

  // Common agent methods
  async reportStatus(): Promise<AgentStatus> {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      capabilities: this.capabilities,
      currentTask: this.currentTask?.id,
      performance: await this.getPerformanceMetrics()
    };
  }

  protected async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      cpu_usage: process.cpuUsage(),
      memory_usage: process.memoryUsage(),
      uptime: process.uptime(),
      tasks_completed: this.tasksCompleted,
      avg_task_duration: this.avgTaskDuration
    };
  }
}
```

### Coordinator Agent

```typescript
// Coordinator agent implementation
import { BaseAgent } from './base-agent';

export class CoordinatorAgent extends BaseAgent {
  private subordinateAgents: Map<string, AgentConnection> = new Map();
  private taskQueue: TaskQueue;

  constructor(config: AgentConfig) {
    super({ ...config, type: 'coordinator' });
    this.capabilities = ['coordination', 'task_delegation', 'resource_management'];
    this.taskQueue = new TaskQueue();
  }

  async executeTask(task: Task): Promise<TaskResult> {
    this.status = 'busy';
    this.currentTask = task;

    try {
      // Analyze task and determine delegation strategy
      const strategy = await this.analyzeDelegationStrategy(task);
      
      // Delegate subtasks to appropriate agents
      const subtasks = await this.createSubtasks(task, strategy);
      const results = await this.delegateSubtasks(subtasks);
      
      // Coordinate and synthesize results
      const finalResult = await this.synthesizeResults(results);
      
      this.status = 'idle';
      this.currentTask = undefined;
      
      return {
        success: true,
        result: finalResult,
        duration: Date.now() - task.startTime,
        metrics: await this.getPerformanceMetrics()
      };
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  private async delegateSubtasks(subtasks: SubTask[]): Promise<TaskResult[]> {
    return Promise.all(subtasks.map(async (subtask) => {
      const agent = await this.selectBestAgent(subtask);
      return agent.executeTask(subtask);
    }));
  }
}
```

### Researcher Agent

```typescript
// Researcher agent implementation
export class ResearcherAgent extends BaseAgent {
  private knowledgeBase: KnowledgeBase;
  private searchTools: SearchTools;

  constructor(config: AgentConfig) {
    super({ ...config, type: 'researcher' });
    this.capabilities = ['research', 'data_collection', 'analysis', 'synthesis'];
    this.knowledgeBase = new KnowledgeBase();
    this.searchTools = new SearchTools();
  }

  async executeTask(task: ResearchTask): Promise<TaskResult> {
    this.status = 'busy';
    
    try {
      // Parse research query and requirements
      const query = await this.parseResearchQuery(task.query);
      
      // Gather information from multiple sources
      const sources = await this.identifySearchSources(query);
      const rawData = await this.gatherInformation(sources);
      
      // Analyze and synthesize findings
      const analysis = await this.analyzeFindings(rawData);
      const synthesis = await this.synthesizeInsights(analysis);
      
      // Generate research report
      const report = await this.generateReport(synthesis);
      
      this.status = 'idle';
      
      return {
        success: true,
        result: {
          report,
          sources: sources.length,
          insights: synthesis.insights.length,
          confidence: synthesis.confidence
        }
      };
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }
}
```

---

## 🔄 Task Execution

### Task Processing Pipeline

```typescript
// Task executor service
export class TaskExecutor {
  private agents: Map<string, BaseAgent> = new Map();
  private taskQueue: PriorityQueue<Task>;
  private concurrencyLimit: number;

  constructor(config: TaskExecutorConfig) {
    this.concurrencyLimit = config.concurrency || 4;
    this.taskQueue = new PriorityQueue();
  }

  async executeTask(task: Task): Promise<TaskResult> {
    // Validate task
    await this.validateTask(task);
    
    // Select appropriate agent
    const agent = await this.selectAgent(task);
    
    // Execute with timeout and monitoring
    return this.executeWithMonitoring(agent, task);
  }

  private async selectAgent(task: Task): Promise<BaseAgent> {
    // Find agents with required capabilities
    const capableAgents = Array.from(this.agents.values())
      .filter(agent => this.hasRequiredCapabilities(agent, task));
    
    if (capableAgents.length === 0) {
      // Spawn new agent if needed
      return this.spawnAgent(task.requiredAgentType);
    }
    
    // Select best agent based on load and performance
    return this.selectBestAgent(capableAgents, task);
  }

  private async executeWithMonitoring(agent: BaseAgent, task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    
    // Set up monitoring
    const monitor = new TaskMonitor(task, agent);
    monitor.start();
    
    try {
      // Execute task with timeout
      const result = await Promise.race([
        agent.executeTask(task),
        this.createTimeoutPromise(task.timeout || 300000)
      ]);
      
      monitor.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      monitor.recordError(error);
      throw error;
    } finally {
      monitor.stop();
    }
  }
}
```

### Concurrent Processing

```typescript
// Concurrent task processing
export class ConcurrentProcessor {
  private workerPool: WorkerPool;
  private loadBalancer: LoadBalancer;

  async processConcurrentTasks(tasks: Task[]): Promise<TaskResult[]> {
    // Optimize task distribution
    const optimizedBatches = this.loadBalancer.optimizeBatches(tasks);
    
    // Process batches concurrently
    const batchResults = await Promise.allSettled(
      optimizedBatches.map(batch => this.processBatch(batch))
    );
    
    return this.aggregateResults(batchResults);
  }

  private async processBatch(batch: Task[]): Promise<TaskResult[]> {
    return Promise.all(
      batch.map(task => this.workerPool.executeTask(task))
    );
  }
}
```

---

## 📡 Communication & Coordination

### WebSocket Client

```typescript
// WebSocket communication with Manager service
export class WebSocketClient extends EventEmitter {
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private config: WSConfig) {
    super();
  }

  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.on('open', () => {
        this.handleConnection();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      this.ws.on('close', () => {
        this.handleDisconnection();
      });
      
      this.ws.on('error', (error) => {
        this.handleError(error);
      });
    } catch (error) {
      await this.handleReconnect();
    }
  }

  private async handleMessage(message: WSMessage): Promise<void> {
    switch (message.type) {
      case 'task_assignment':
        await this.handleTaskAssignment(message.data);
        break;
      case 'coordination_request':
        await this.handleCoordinationRequest(message.data);
        break;
      case 'health_check':
        await this.sendHealthStatus();
        break;
      default:
        this.emit('message', message);
    }
  }

  async sendTaskResult(taskId: string, result: TaskResult): Promise<void> {
    const message = {
      type: 'task_result',
      workerId: this.config.workerId,
      data: { taskId, result }
    };
    
    this.send(message);
  }
}
```

### Inter-Agent Communication

```typescript
// Agent communication service
export class AgentCommunication {
  private messageQueue: MessageQueue;
  private eventBus: EventBus;

  async sendMessage(
    fromAgent: string,
    toAgent: string,
    message: AgentMessage
  ): Promise<void> {
    const envelope = {
      id: generateId(),
      from: fromAgent,
      to: toAgent,
      timestamp: new Date(),
      message
    };
    
    await this.messageQueue.enqueue(envelope);
    this.eventBus.emit('message_sent', envelope);
  }

  async broadcastToSwarm(
    fromAgent: string,
    swarmId: string,
    message: AgentMessage
  ): Promise<void> {
    const agents = await this.getSwarmAgents(swarmId);
    
    await Promise.all(
      agents.map(agent => 
        this.sendMessage(fromAgent, agent.id, message)
      )
    );
  }

  async subscribeToMessages(
    agentId: string,
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void> {
    this.messageQueue.subscribe(`agent:${agentId}`, handler);
  }
}
```

---

## 🧪 Testing

### Test Suites

```bash
# Run all tests
pnpm test

# Agent-specific tests
pnpm test:coordinator    # Coordinator agent tests
pnpm test:researcher     # Researcher agent tests
pnpm test:coder         # Coder agent tests
pnpm test:analyst       # Analyst agent tests
pnpm test:tester        # Tester agent tests

# Integration tests
pnpm test:integration   # Manager service integration
pnpm test:redis         # Redis integration tests
pnpm test:websocket     # WebSocket communication tests

# Performance tests
pnpm test:load          # Load testing
pnpm test:stress        # Stress testing
pnpm test:concurrency   # Concurrent execution tests
```

### Agent Testing

```typescript
// Example: Agent testing framework
import { describe, it, expect, beforeEach } from 'vitest';
import { CoordinatorAgent } from '../src/agents/coordinator';
import { MockTaskExecutor } from './mocks/task-executor';

describe('CoordinatorAgent', () => {
  let agent: CoordinatorAgent;
  let mockExecutor: MockTaskExecutor;

  beforeEach(async () => {
    mockExecutor = new MockTaskExecutor();
    agent = new CoordinatorAgent({
      id: 'test-coordinator',
      executor: mockExecutor
    });
    
    await agent.initialize();
  });

  it('should delegate complex tasks to subordinate agents', async () => {
    const complexTask = {
      id: 'task-1',
      type: 'complex_analysis',
      requirements: ['research', 'coding', 'analysis'],
      data: { /* task data */ }
    };

    const result = await agent.executeTask(complexTask);

    expect(result.success).toBe(true);
    expect(mockExecutor.getExecutedTasks()).toHaveLength(3);
    expect(result.result).toContain('synthesized');
  });

  it('should handle agent failures gracefully', async () => {
    mockExecutor.simulateAgentFailure('researcher');

    const researchTask = {
      id: 'task-2',
      type: 'research',
      requirements: ['research']
    };

    const result = await agent.executeTask(researchTask);

    expect(result.success).toBe(true);
    expect(result.warnings).toContain('agent_failure_recovered');
  });
});
```

### Load Testing

```typescript
// Load testing for concurrent task execution
import { loadTest } from '../utils/load-test';

describe('Worker Load Testing', () => {
  it('should handle 100 concurrent tasks', async () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      id: `task-${i}`,
      type: 'simple_computation',
      data: { value: i }
    }));

    const results = await loadTest(tasks, {
      concurrency: 10,
      timeout: 30000
    });

    expect(results.successRate).toBeGreaterThan(0.95);
    expect(results.avgResponseTime).toBeLessThan(1000);
  });
});
```

---

## 🚢 Deployment

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 8000

CMD ["node", "dist/index.js"]
```

```bash
# Build and run with Docker
pnpm build:docker
docker run -p 8000:8000 --env-file .env swarm-worker
```

### Fly.io Deployment

```bash
# Deploy worker to Fly.io
pnpm deploy

# Deploy multiple workers across regions
pnpm deploy:multi-region

# Scale workers dynamically
fly scale count 5 -a swarm-worker

# Monitor worker status
fly status -a swarm-worker
```

#### Fly.io Configuration (`fly.toml`)

```toml
app = "swarm-worker"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8000"
  WORKER_TYPE = "multi"

[http_service]
  internal_port = 8000
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 2

  [http_service.concurrency]
    type = "requests"
    hard_limit = 100
    soft_limit = 80

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 1024

[metrics]
  port = 9090
  path = "/metrics"

[[services]]
  protocol = "tcp"
  internal_port = 8000

  [services.concurrency]
    type = "requests"
    hard_limit = 100
    soft_limit = 80

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"
    grace_period = "5s"

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/health"
```

### Multi-Region Deployment

```bash
# Deploy to multiple regions for better performance
fly deploy --region ord  # Chicago
fly deploy --region lax  # Los Angeles
fly deploy --region fra  # Frankfurt
fly deploy --region nrt  # Tokyo

# Configure automatic regional routing
fly volumes create worker_data --region ord --size 10
fly volumes create worker_data --region lax --size 10
```

---

## 📊 Monitoring & Observability

### Health Monitoring

```typescript
// Health monitoring service
export class HealthMonitor {
  private checks: HealthCheck[] = [];
  private status: HealthStatus = 'healthy';

  async performHealthCheck(): Promise<HealthReport> {
    const checkResults = await Promise.allSettled(
      this.checks.map(check => check.execute())
    );

    const report: HealthReport = {
      status: this.calculateOverallStatus(checkResults),
      timestamp: new Date(),
      checks: checkResults.map((result, index) => ({
        name: this.checks[index].name,
        status: result.status === 'fulfilled' ? 'healthy' : 'unhealthy',
        message: result.status === 'rejected' ? result.reason : undefined
      }))
    };

    return report;
  }

  addCheck(check: HealthCheck): void {
    this.checks.push(check);
  }
}

// Health check implementations
const redisCheck = new HealthCheck('redis', async () => {
  await redis.ping();
});

const managerConnectionCheck = new HealthCheck('manager', async () => {
  const response = await fetch(`${managerUrl}/health`);
  if (!response.ok) throw new Error('Manager unreachable');
});

const memoryCheck = new HealthCheck('memory', async () => {
  const usage = process.memoryUsage();
  const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;
  if (usagePercent > 90) throw new Error('High memory usage');
});
```

### Performance Metrics

```typescript
// Metrics collection service
export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();

  recordTaskExecution(taskId: string, duration: number, success: boolean): void {
    this.metrics.set(`task.${taskId}.duration`, {
      type: 'histogram',
      value: duration,
      timestamp: Date.now()
    });

    this.metrics.set(`task.${taskId}.success`, {
      type: 'counter',
      value: success ? 1 : 0,
      timestamp: Date.now()
    });
  }

  recordAgentPerformance(agentId: string, metrics: PerformanceMetrics): void {
    this.metrics.set(`agent.${agentId}.cpu`, {
      type: 'gauge',
      value: metrics.cpu_usage,
      timestamp: Date.now()
    });

    this.metrics.set(`agent.${agentId}.memory`, {
      type: 'gauge',
      value: metrics.memory_usage.heapUsed,
      timestamp: Date.now()
    });
  }

  async exportMetrics(): Promise<string> {
    // Export in Prometheus format
    const lines: string[] = [];
    
    for (const [name, metric] of this.metrics) {
      lines.push(`${name} ${metric.value} ${metric.timestamp}`);
    }
    
    return lines.join('\n');
  }
}
```

### Logging

```typescript
// Structured logging
import { Logger } from '../utils/logger';

const logger = new Logger({
  service: 'worker',
  workerId: process.env.WORKER_ID,
  level: process.env.LOG_LEVEL || 'info'
});

// Log agent activities
logger.info('Agent started', {
  agentId: agent.id,
  agentType: agent.type,
  capabilities: agent.capabilities
});

// Log task execution
logger.info('Task executed', {
  taskId: task.id,
  agentId: agent.id,
  duration: result.duration,
  success: result.success
});

// Log errors with context
logger.error('Task execution failed', {
  taskId: task.id,
  agentId: agent.id,
  error: error.message,
  stack: error.stack
});
```

---

## 🔒 Security

### Secure Communication

```typescript
// Secure WebSocket connection
export class SecureWebSocketClient {
  private certificate?: Buffer;
  private privateKey?: Buffer;

  async connect(): Promise<void> {
    const options: WebSocket.ClientOptions = {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Worker-ID': this.config.workerId,
        'X-Worker-Type': this.config.workerType
      },
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    };

    if (this.certificate && this.privateKey) {
      options.cert = this.certificate;
      options.key = this.privateKey;
    }

    this.ws = new WebSocket(this.config.url, options);
  }

  private validateMessage(message: WSMessage): boolean {
    // Validate message signature
    return this.verifySignature(message);
  }
}
```

### Input Validation

```typescript
// Task validation
import { z } from 'zod';

const taskSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['research', 'coding', 'analysis', 'coordination']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  timeout: z.number().int().min(1000).max(3600000),
  data: z.record(z.any()),
  requiredCapabilities: z.array(z.string())
});

export function validateTask(task: unknown): Task {
  return taskSchema.parse(task);
}
```

### Resource Limits

```typescript
// Resource limiting
export class ResourceLimiter {
  private maxMemory: number;
  private maxCpu: number;

  constructor(config: ResourceConfig) {
    this.maxMemory = config.maxMemoryMB * 1024 * 1024;
    this.maxCpu = config.maxCpuPercent;
  }

  async checkResourceUsage(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > this.maxMemory) {
      throw new Error('Memory limit exceeded');
    }

    const cpuUsage = await this.getCpuUsage();
    if (cpuUsage > this.maxCpu) {
      throw new Error('CPU limit exceeded');
    }
  }
}
```

---

## 🤝 Contributing

### Development Guidelines

1. **Agent Development** - Follow the BaseAgent interface
2. **Performance** - Maintain sub-second response times
3. **Testing** - 90%+ coverage for all agent types
4. **Documentation** - Document all agent capabilities
5. **Security** - Validate all inputs and communications

### Agent Development Template

```typescript
// Template for new agent types
import { BaseAgent } from './base-agent';

export class CustomAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      type: 'custom',
      capabilities: ['custom_capability_1', 'custom_capability_2']
    });
  }

  async executeTask(task: CustomTask): Promise<TaskResult> {
    this.status = 'busy';
    
    try {
      // 1. Validate task input
      this.validateTaskInput(task);
      
      // 2. Perform custom processing
      const result = await this.performCustomProcessing(task);
      
      // 3. Return result
      this.status = 'idle';
      return {
        success: true,
        result,
        duration: Date.now() - task.startTime
      };
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  async initialize(): Promise<void> {
    // Custom initialization logic
  }

  async shutdown(): Promise<void> {
    // Custom cleanup logic
  }

  private async performCustomProcessing(task: CustomTask): Promise<any> {
    // Implement custom agent logic
    throw new Error('Not implemented');
  }
}
```

---

## 🆘 Troubleshooting

### Common Issues

#### 1. Agent Spawn Failures
```bash
# Check agent spawning logs
pnpm logs:agent-spawn

# Test agent creation
curl -X POST http://localhost:8000/debug/spawn-agent \
  -d '{"type": "coordinator"}'

# Check resource availability
curl http://localhost:8000/debug/resources
```

#### 2. Task Execution Timeouts
```bash
# Monitor task execution
pnpm logs:task-execution

# Check task queue status
curl http://localhost:8000/debug/task-queue

# Adjust timeout settings
export TASK_TIMEOUT=600000  # 10 minutes
```

#### 3. WebSocket Connection Issues
```bash
# Test WebSocket connection
curl -H "Upgrade: websocket" \
     -H "Connection: upgrade" \
     http://localhost:8000/ws

# Check connection logs
pnpm logs:websocket

# Verify authentication
curl -H "Authorization: Bearer $API_KEY" \
     http://localhost:8000/debug/auth
```

#### 4. Performance Issues
```bash
# Monitor performance metrics
curl http://localhost:8000/metrics

# Check memory usage
curl http://localhost:8000/debug/memory

# Analyze slow tasks
curl http://localhost:8000/debug/slow-tasks
```

### Debug Commands

```bash
# Enable debug mode
export DEBUG=true
export LOG_LEVEL=debug

# Start with performance profiling
pnpm dev:profile

# Monitor real-time metrics
pnpm monitor:realtime

# Generate performance report
pnpm debug:performance-report
```

---

## 📚 Additional Resources

- [**Agent Development Guide**](docs/agent-development.md) - Creating custom agents
- [**Performance Optimization**](docs/performance.md) - Optimization strategies
- [**Deployment Guide**](docs/deployment.md) - Production deployment
- [**API Documentation**](docs/api.md) - Worker service API reference

### Related Services

- [**Dashboard Service**](../dashboard/README.md) - Web UI for monitoring workers
- [**Manager Service**](../manager/README.md) - Central coordination and API
- [**Hive Mind**](../hive-mind/README.md) - Advanced swarm coordination
- [**Claude Flow**](../../claude-flow-analysis/README.md) - AI integration layer

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

<div align="center">
  <sub>⚡ Worker Service - Distributed intelligence in action</sub>
</div>