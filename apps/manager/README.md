# Manager Service

**Core API Orchestration Engine for Swarm Intelligence Platform**

*Express.js API service providing swarm coordination, task orchestration, and real-time management*

---

## 🚀 Overview

The Manager Service is the central API orchestration engine that coordinates all swarm intelligence operations. Built with Express.js and TypeScript, it provides comprehensive REST APIs, WebSocket real-time communication, and seamless integration with Fly.io, Supabase, and Langfuse for complete swarm management.

## ✨ Key Features

### 🎯 Swarm Orchestration
- **Agent Lifecycle Management** - Spawn, monitor, and coordinate AI agents across the platform
- **Task Distribution** - Intelligent task assignment and load balancing
- **Real-time Coordination** - WebSocket-based real-time communication between agents
- **Performance Optimization** - Automatic scaling and resource management
- **Consensus Mechanisms** - Distributed decision-making algorithms

### 📡 API Services
- **RESTful APIs** - Comprehensive REST endpoints for all swarm operations
- **WebSocket Server** - Real-time bidirectional communication
- **Authentication & Authorization** - JWT-based security with role-based access
- **Rate Limiting** - Intelligent request throttling and abuse prevention
- **API Documentation** - OpenAPI/Swagger documentation

### 🔗 Integration Hub
- **Fly.io Machines API** - Dynamic machine provisioning and scaling
- **Supabase Integration** - Real-time database operations and persistence
- **Langfuse Observability** - LLM tracing and performance monitoring
- **Claude Flow Hooks** - Advanced AI coordination and neural patterns
- **Redis Caching** - High-performance caching and session management

### 🔧 Developer Experience
- **TypeScript** - Full type safety with strict mode enabled
- **Hot Reloading** - Fast development with automatic restarts
- **Comprehensive Testing** - Unit, integration, and load testing suites
- **Monitoring** - Built-in health checks and performance metrics
- **Docker Support** - Containerized deployment with multi-stage builds

---

## 🏗️ Architecture

### Service Structure
```
apps/manager/
├── src/
│   ├── routes/                # API route handlers
│   │   ├── swarms.ts         # Swarm management endpoints
│   │   ├── agents.ts         # Agent lifecycle endpoints
│   │   ├── tasks.ts          # Task orchestration endpoints
│   │   ├── telemetry.ts      # Metrics and monitoring endpoints
│   │   └── health.ts         # Health check endpoints
│   ├── services/             # Business logic services
│   │   ├── fly.service.ts    # Fly.io Machines integration
│   │   ├── supabase.service.ts # Database operations
│   │   ├── langfuse/         # Langfuse integration
│   │   ├── claude-flow/      # Claude Flow coordination
│   │   └── websocket.service.ts # WebSocket management
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts          # Authentication middleware
│   │   ├── rateLimiter.ts   # Rate limiting
│   │   └── error.ts         # Error handling
│   ├── utils/               # Utility functions
│   │   ├── token-estimator.ts # Token usage estimation
│   │   ├── langfuse-tracer.ts # Tracing utilities
│   │   └── cors-config.ts   # CORS configuration
│   └── types/               # TypeScript type definitions
├── tests/                   # Test suites
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── smoke/             # Smoke tests
├── scripts/               # Deployment scripts
└── docs/                 # API documentation
```

### Core Components

#### 🎯 Swarm Management
- **Network Topology** - Manage mesh, hierarchical, ring, and star topologies
- **Agent Registry** - Track agent states, capabilities, and performance
- **Task Queue** - Distribute and monitor task execution across agents
- **Resource Allocation** - Optimize resource usage and scaling decisions

#### 📊 Observability
- **Langfuse Integration** - Track LLM usage, performance, and costs
- **Performance Metrics** - Monitor API response times and throughput
- **Health Monitoring** - Continuous health checks and system diagnostics
- **Audit Logging** - Comprehensive activity logging and security tracking

#### 🔄 Real-time Communication
- **WebSocket Server** - Bidirectional real-time communication
- **Event Broadcasting** - Distribute events across connected clients
- **Connection Management** - Handle connection lifecycle and reconnection
- **Message Queuing** - Reliable message delivery with retry mechanisms

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 8+
- **Redis** instance for caching
- **Supabase** project configured
- **Fly.io** account with API token (for deployment)

### Environment Setup

Create `.env` file:

```env
# Server Configuration
NODE_ENV=development
PORT=8080
HOST=0.0.0.0

# Database & Cache
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
REDIS_URL=redis://localhost:6379

# Fly.io Integration
FLY_API_TOKEN=your-fly-api-token
FLY_APP_NAME=swarm-manager
FLY_REGION=ord

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# Langfuse Configuration (Optional)
LANGFUSE_SECRET_KEY=your-langfuse-secret-key
LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
LANGFUSE_HOST=https://cloud.langfuse.com

# Claude Flow Integration
CLAUDE_API_KEY=your-claude-api-key
CLAUDE_FLOW_ENDPOINT=http://localhost:3001

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,https://your-dashboard.fly.dev

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Installation & Development

```bash
# Navigate to manager directory
cd apps/manager

# Install dependencies
pnpm install

# Start Redis (if running locally)
redis-server

# Start development server
pnpm dev

# API will be available at http://localhost:8080
```

### Development Commands

```bash
# Development
pnpm dev              # Start with hot reloading
pnpm dev:debug        # Start with debugging enabled
pnpm dev:watch        # Start with file watching

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

# Code Quality
pnpm lint             # ESLint checking
pnpm lint:fix         # Auto-fix linting issues
pnpm type-check       # TypeScript checking
```

---

## 📡 API Reference

### Core Endpoints

#### Swarm Management

```http
# Create new swarm
POST /api/swarms
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Development Swarm",
  "topology": "mesh",
  "strategy": "adaptive",
  "max_agents": 8,
  "region": "ord"
}

# Get swarm status
GET /api/swarms/:id/status

# Scale swarm
PUT /api/swarms/:id/scale
{
  "agent_count": 12,
  "strategy": "gradual"
}

# List all swarms
GET /api/swarms?status=active&limit=10
```

#### Agent Management

```http
# Spawn agent
POST /api/agents
{
  "swarm_id": "swarm-123",
  "type": "coordinator",
  "capabilities": ["coordination", "task_management"],
  "resources": {
    "cpu": 2,
    "memory": 1024
  }
}

# Get agent status
GET /api/agents/:id

# Update agent
PUT /api/agents/:id
{
  "status": "busy",
  "current_task": "task-456"
}

# List agents
GET /api/agents?swarm_id=swarm-123&status=active
```

#### Task Orchestration

```http
# Create task
POST /api/tasks
{
  "swarm_id": "swarm-123",
  "name": "Build Authentication System",
  "description": "Implement JWT authentication",
  "priority": "high",
  "strategy": "parallel",
  "assigned_agents": ["agent-1", "agent-2"]
}

# Get task status
GET /api/tasks/:id

# Update task progress
PUT /api/tasks/:id/progress
{
  "progress": 75,
  "status": "in_progress",
  "completed_subtasks": ["subtask-1", "subtask-2"]
}
```

### WebSocket Events

#### Connection & Authentication

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8080/ws');

// Authenticate connection
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));

// Subscribe to swarm events
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['swarm:swarm-123', 'agents:all']
}));
```

#### Event Types

```javascript
// Agent status updates
{
  type: 'agent_status',
  data: {
    agent_id: 'agent-123',
    status: 'busy',
    current_task: 'task-456',
    performance_metrics: {
      cpu_usage: 45,
      memory_usage: 512
    }
  }
}

// Task progress updates
{
  type: 'task_progress',
  data: {
    task_id: 'task-456',
    progress: 75,
    status: 'in_progress',
    estimated_completion: '2025-07-15T15:30:00Z'
  }
}

// Swarm metrics
{
  type: 'swarm_metrics',
  data: {
    swarm_id: 'swarm-123',
    active_agents: 8,
    completed_tasks: 45,
    avg_response_time: 120,
    resource_utilization: 68
  }
}
```

---

## 🧪 Testing

### Test Suites

```bash
# Run all tests
pnpm test

# Run specific test types
pnpm test:unit           # Unit tests
pnpm test:integration    # Integration tests with external services
pnpm test:smoke          # Basic functionality tests
pnpm test:load           # Load and performance testing

# Coverage reporting
pnpm test:coverage       # Generate coverage report
pnpm test:watch          # Watch mode for development
```

### Integration Testing

```typescript
// Example: Integration test for swarm creation
import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmService } from '../src/services/swarm.service';
import { testDatabase } from './setup';

describe('SwarmService Integration', () => {
  let swarmService: SwarmService;

  beforeEach(async () => {
    await testDatabase.reset();
    swarmService = new SwarmService({
      supabase: testDatabase.client,
      redis: testRedis
    });
  });

  it('should create swarm with agents', async () => {
    const swarm = await swarmService.createSwarm({
      name: 'Test Swarm',
      topology: 'mesh',
      max_agents: 4
    });

    expect(swarm.id).toBeDefined();
    expect(swarm.status).toBe('initializing');

    // Wait for agents to spawn
    await new Promise(resolve => setTimeout(resolve, 1000));

    const agents = await swarmService.getAgents(swarm.id);
    expect(agents).toHaveLength(4);
  });
});
```

### Load Testing

```bash
# Run load tests
pnpm test:load

# Custom load test scenarios
pnpm test:load --scenario=high-throughput
pnpm test:load --scenario=websocket-stress
pnpm test:load --scenario=concurrent-swarms
```

---

## 🚢 Deployment

### Docker Deployment

```bash
# Build Docker image
pnpm build:docker

# Run with Docker
docker run -p 8080:8080 --env-file .env swarm-manager

# Docker Compose (with Redis)
docker-compose up -d
```

### Fly.io Deployment

```bash
# Deploy to Fly.io
pnpm deploy

# Deploy with specific configuration
pnpm deploy --config=fly.production.toml

# Deploy hotfix
pnpm deploy:hotfix

# Monitor deployment
fly logs -a swarm-manager
```

#### Fly.io Configuration (`fly.toml`)

```toml
app = "swarm-manager"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "connections"
    hard_limit = 250
    soft_limit = 200

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 2048

[metrics]
  port = 9091
  path = "/metrics"

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 250
    soft_limit = 200

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/health"

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/health"
    protocol = "http"
```

### Environment Variables (Production)

```env
# Production configuration
NODE_ENV=production
PORT=8080

# Supabase Production
SUPABASE_URL=your-production-supabase-url
SUPABASE_SERVICE_KEY=your-production-service-key

# Redis Production
REDIS_URL=your-production-redis-url

# Fly.io Production
FLY_API_TOKEN=your-production-fly-token

# Security
JWT_SECRET=your-strong-production-secret

# CORS for production
CORS_ORIGIN=https://your-dashboard.fly.dev

# Monitoring
LANGFUSE_SECRET_KEY=your-production-langfuse-key
```

---

## 🔧 Services & Integrations

### Fly.io Machines Service

```typescript
// Example: Fly.io machine management
import { FlyService } from '../services/fly.service';

const flyService = new FlyService({
  apiToken: process.env.FLY_API_TOKEN,
  appName: process.env.FLY_APP_NAME
});

// Create new machine for agent
const machine = await flyService.createMachine({
  region: 'ord',
  config: {
    image: 'swarm-agent:latest',
    services: [{
      ports: [{ port: 8000 }],
      protocol: 'tcp'
    }],
    env: {
      AGENT_TYPE: 'coordinator',
      SWARM_ID: swarmId
    }
  }
});
```

### Supabase Integration

```typescript
// Example: Real-time database operations
import { SupabaseService } from '../services/supabase.service';

const supabaseService = new SupabaseService({
  url: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_KEY
});

// Create swarm with real-time updates
const swarm = await supabaseService.createSwarm({
  name: 'Production Swarm',
  topology: 'hierarchical',
  max_agents: 12
});

// Subscribe to agent updates
supabaseService.subscribeToTable('swarm_agents', {
  event: 'UPDATE',
  schema: 'public'
}, (payload) => {
  // Broadcast agent update via WebSocket
  webSocketService.broadcast('agent_status', payload.new);
});
```

### Langfuse Observability

```typescript
// Example: LLM tracing integration
import { LangfuseService } from '../services/langfuse/langfuse.service';

const langfuseService = new LangfuseService({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY
});

// Trace agent interactions
const trace = langfuseService.trace({
  id: `agent-${agentId}-task-${taskId}`,
  name: 'Agent Task Execution',
  metadata: {
    agentId,
    taskId,
    swarmId
  }
});

await trace.span({
  name: 'task_processing',
  input: taskData,
  output: result
});
```

---

## 📊 Monitoring & Observability

### Health Checks

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    checks: {
      database: await checkDatabaseConnection(),
      redis: await checkRedisConnection(),
      websocket: checkWebSocketServer(),
      fly_api: await checkFlyApiConnection()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Performance Metrics

```typescript
// Example: Performance monitoring
import { MetricsService } from '../services/telemetry.service';

const metricsService = new MetricsService();

// Track API performance
app.use('/api', (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsService.recordApiCall({
      method: req.method,
      route: req.route?.path,
      statusCode: res.statusCode,
      duration
    });
  });
  
  next();
});
```

### Logging

```typescript
// Structured logging
import { Logger } from '../utils/logger';

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  service: 'manager',
  environment: process.env.NODE_ENV
});

// Log swarm operations
logger.info('Swarm created', {
  swarmId,
  topology,
  agentCount,
  duration: Date.now() - startTime
});
```

---

## 🔒 Security

### Authentication & Authorization

```typescript
// JWT authentication middleware
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Role-based authorization
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

### Rate Limiting

```typescript
// Rate limiting configuration
import rateLimit from 'express-rate-limit';

const createRateLimit = (windowMs: number, max: number) => rateLimit({
  windowMs,
  max,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Different limits for different endpoints
app.use('/api/auth', createRateLimit(15 * 60 * 1000, 5)); // 5 requests per 15 minutes
app.use('/api/swarms', createRateLimit(60 * 1000, 100));  // 100 requests per minute
app.use('/api', createRateLimit(60 * 1000, 1000));        // 1000 requests per minute
```

### Input Validation

```typescript
// Zod schema validation
import { z } from 'zod';

const createSwarmSchema = z.object({
  name: z.string().min(1).max(100),
  topology: z.enum(['mesh', 'hierarchical', 'ring', 'star']),
  strategy: z.enum(['balanced', 'specialized', 'adaptive']),
  max_agents: z.number().int().min(1).max(50),
  region: z.string().optional()
});

export const validateCreateSwarm = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = createSwarmSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid request data', details: error.errors });
  }
};
```

---

## 🤝 Contributing

### Development Guidelines

1. **Feature Development** - Create feature branches from `main`
2. **Code Quality** - Maintain 90%+ test coverage
3. **Documentation** - Update API documentation for all changes
4. **Testing** - Include unit and integration tests
5. **Performance** - Ensure no performance regressions

### Code Standards

- **TypeScript Strict Mode** - All code must pass strict type checking
- **ESLint Configuration** - Follow project ESLint rules
- **API Documentation** - OpenAPI/Swagger docs for all endpoints
- **Error Handling** - Comprehensive error handling and logging
- **Security** - Follow OWASP security guidelines

### API Development

```typescript
// Example: New API endpoint template
import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateSchema } from '../middleware/validation';
import { MyService } from '../services/my.service';

const router = Router();
const myService = new MyService();

/**
 * @swagger
 * /api/my-endpoint:
 *   post:
 *     summary: Create new resource
 *     tags: [Resources]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateResourceRequest'
 *     responses:
 *       201:
 *         description: Resource created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Resource'
 */
router.post('/my-endpoint',
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateSchema(createResourceSchema),
  async (req, res, next) => {
    try {
      const result = await myService.createResource(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

---

## 🆘 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check Supabase connection
curl -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
     "$SUPABASE_URL/rest/v1/swarm_networks?select=*"

# Test Redis connection
redis-cli ping

# Check connection pools
pnpm debug:connections
```

#### 2. WebSocket Connection Problems
```bash
# Test WebSocket endpoint
curl -H "Upgrade: websocket" \
     -H "Connection: upgrade" \
     http://localhost:8080/ws

# Check WebSocket logs
pnpm logs:websocket

# Monitor connections
pnpm debug:websocket
```

#### 3. Fly.io API Issues
```bash
# Test Fly.io API connectivity
curl -H "Authorization: Bearer $FLY_API_TOKEN" \
     https://api.machines.dev/v1/apps

# Check machine status
fly machines list -a swarm-manager

# View deployment logs
fly logs -a swarm-manager
```

#### 4. Performance Issues
```bash
# Monitor API performance
pnpm monitor:api

# Check memory usage
pnpm debug:memory

# Analyze slow queries
pnpm debug:queries
```

### Debug Mode

Enable debug mode for detailed logging:

```env
# .env
DEBUG=true
LOG_LEVEL=debug
DEBUG_SQL=true
DEBUG_WEBSOCKET=true
```

### Health Diagnostics

```bash
# Run health diagnostics
curl http://localhost:8080/health

# Detailed system check
curl http://localhost:8080/health/detailed

# Performance metrics
curl http://localhost:8080/metrics
```

---

## 📚 Additional Resources

- [**Express.js Documentation**](https://expressjs.com/) - Web framework
- [**Fly.io Machines API**](https://fly.io/docs/machines/) - Dynamic scaling
- [**Supabase Documentation**](https://supabase.com/docs) - Database and real-time
- [**Langfuse Documentation**](https://langfuse.com/docs) - LLM observability
- [**WebSocket API**](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) - Real-time communication

### Related Services

- [**Dashboard Service**](../dashboard/README.md) - Web UI for swarm management
- [**Worker Service**](../worker/README.md) - Distributed worker agents
- [**Hive Mind**](../hive-mind/README.md) - Advanced swarm coordination
- [**Claude Flow**](../../claude-flow-analysis/README.md) - AI integration layer

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

<div align="center">
  <sub>🧠 Manager Service - The brain of the swarm intelligence platform</sub>
</div>