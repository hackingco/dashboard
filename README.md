# Dashboard

**A Modern AI Swarm Orchestration Platform**

*Enterprise-grade distributed computing with intelligent agent coordination*

---

## 🚀 Overview

Dashboard is a cutting-edge swarm orchestration platform that transforms distributed computing through intelligent AI agent coordination. Built on modern cloud-native technologies, it provides real-time monitoring, automated scaling, and seamless integration with leading observability tools.

### ✨ Key Features

🎯 **Intelligent Swarm Management**
- Real-time AI agent orchestration
- Automated task distribution and load balancing
- Dynamic scaling based on workload patterns
- Multi-region deployment capabilities

🖥️ **Modern Dashboard Interface**
- Responsive Next.js frontend with Tailwind CSS
- Real-time monitoring and telemetry
- Interactive swarm topology visualization
- Comprehensive observability dashboards

⚡ **Cloud-Native Architecture**
- Fly.io Machines API integration for instant scaling
- Supabase backend for data persistence and real-time sync
- WebSocket connections for live updates
- Docker containerization with zero-downtime deployments

📊 **Advanced Observability**
- Langfuse LLM tracing and performance monitoring
- TrustGraph workflow orchestration
- Real-time metrics and logging
- Custom alerting and notifications

🔧 **Developer Experience**
- TypeScript throughout the stack
- Comprehensive testing with Vitest and Playwright
- CI/CD automation with GitHub Actions
- Monorepo architecture with Turborepo

---

## 🏗️ Architecture

Dashboard consists of three main components working in harmony:

### 📱 Admin Dashboard
**Location:** `apps/dashboard/`
- **Framework:** Next.js 14 with App Router
- **Styling:** Tailwind CSS with shadcn/ui components
- **Features:** Real-time monitoring, swarm management, observability dashboards
- **Deployment:** Optimized static builds for global CDN distribution

### 🧠 Manager API
**Location:** `apps/manager/`
- **Framework:** Express.js with TypeScript
- **Features:** Fly.io integration, task orchestration, WebSocket real-time updates
- **Services:** Supabase persistence, Langfuse tracing, TrustGraph coordination
- **Scaling:** Horizontal auto-scaling with health checks

### 🐝 Worker Swarms
**Location:** `apps/worker/`
- **Deployment:** Dynamic Fly.io Machine creation
- **Types:** Researcher, Coder, Analyst, Tester agents
- **Management:** Auto-scaling, health monitoring, task distribution
- **Coordination:** Claude Flow hive mind integration

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and pnpm
- **Fly.io** account with API token
- **Supabase** project configured
- **Redis** instance for caching

### 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/your-org/dashboard.git
cd dashboard

# Install dependencies
pnpm install

# Build all applications
pnpm build

# Start development environment
pnpm dev
```

### ⚙️ Environment Configuration

#### Dashboard (`apps/dashboard/.env.local`)
```env
NEXT_PUBLIC_MANAGER_URL=https://your-manager-api.fly.dev
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
```

#### Manager API (`apps/manager/.env`)
```env
PORT=8080
FLY_API_TOKEN=your-fly-api-token
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
REDIS_HOST=your-redis-host
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret
LANGFUSE_SECRET_KEY=your-langfuse-secret-key
TRUSTGRAPH_API_KEY=your-trustgraph-api-key
```

#### Worker (`apps/worker/.env`)
```env
PORT=8000
REDIS_HOST=your-redis-host
REDIS_PORT=6379
WORKER_TYPE=generic
WORKER_CONCURRENCY=4
```

---

## 🚢 Deployment

### One-Command Deployment

```bash
# Deploy all services to production
pnpm deploy

# Or deploy individual services
cd apps/dashboard && pnpm deploy
cd apps/manager && pnpm deploy
cd apps/worker && pnpm deploy
```

### Cloud Platform Setup

1. **Fly.io Configuration**
   - Configure `fly.toml` files for each service
   - Set up secrets with `fly secrets set`
   - Enable auto-scaling policies

2. **Supabase Setup**
   - Run database migrations: `supabase db push`
   - Configure Row Level Security policies
   - Set up real-time subscriptions

3. **Monitoring Integration**
   - Configure Langfuse for LLM observability
   - Set up TrustGraph for workflow monitoring
   - Enable custom alerting rules

---

## 📡 API Reference

### Swarm Management

#### Create Swarm
```http
POST /api/swarms
Content-Type: application/json

{
  "name": "data-processing-swarm",
  "purpose": "Process analytics data",
  "workerCount": 4,
  "config": {
    "region": "dfw",
    "cpus": 2,
    "memory": 1024,
    "dockerImage": "your-org/worker:latest",
    "env": {
      "WORKER_TYPE": "analyst",
      "LOG_LEVEL": "info"
    }
  }
}
```

#### Scale Swarm
```http
PUT /api/swarms/:id/scale
Content-Type: application/json

{
  "workerCount": 8,
  "strategy": "gradual"
}
```

#### Real-time Status
```javascript
// WebSocket connection for live updates
const ws = new WebSocket('wss://your-api.fly.dev/ws?token=your-jwt-token');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Swarm update:', data);
};
```

### Observability Endpoints

#### Performance Metrics
```http
GET /api/telemetry/metrics?timeRange=1h&swarmId=swarm-123
```

#### Trace Analysis
```http
GET /api/observability/traces?operation=task_processing&limit=100
```

---

## 🔍 Monitoring & Observability

### Dashboard Features

- **Real-time Topology View:** Interactive graph of swarm relationships
- **Performance Monitoring:** CPU, memory, network, and task metrics
- **Log Aggregation:** Centralized logging with filtering and search
- **Task Timeline:** Visual workflow execution tracking
- **Alert Management:** Custom notifications and escalation policies

### Langfuse Integration

Dashboard provides comprehensive LLM observability through Langfuse:

- Request/response tracing for all AI operations
- Token usage tracking and cost analysis
- Performance benchmarking across models
- Quality scoring and feedback loops

### TrustGraph Workflows

Advanced workflow orchestration with dependency management:

- DAG-based task execution
- Checkpoint validation and rollback
- Parallel execution optimization
- State persistence across failures

---

## 🧪 Testing

### Test Suites

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# End-to-end tests
pnpm test:e2e

# Performance tests
pnpm test:performance
```

### Test Coverage

- **Unit Tests:** 95%+ coverage for core business logic
- **Integration Tests:** Full API endpoint validation
- **E2E Tests:** Critical user journey verification
- **Performance Tests:** Load testing and benchmarking

---

## 🏆 Performance

### Benchmarks

- **Swarm Creation:** < 3 seconds (cold start)
- **Scaling Operations:** < 1 second per worker
- **API Response Time:** < 100ms (p95)
- **WebSocket Latency:** < 50ms
- **Dashboard Load Time:** < 2 seconds

### Optimizations

- **Caching:** Redis-based caching for hot paths
- **CDN Distribution:** Global asset delivery
- **Connection Pooling:** Efficient database connections
- **Lazy Loading:** Dynamic component imports
- **Bundle Optimization:** Tree-shaking and code splitting

---

## 🔒 Security

### Authentication & Authorization

- **JWT-based Authentication:** Secure token-based auth
- **Role-based Access Control:** Fine-grained permissions
- **API Rate Limiting:** Protection against abuse
- **CORS Configuration:** Secure cross-origin requests

### Data Protection

- **Encryption at Rest:** Supabase native encryption
- **TLS Everywhere:** End-to-end encryption
- **Secret Management:** Secure environment variable handling
- **Audit Logging:** Comprehensive activity tracking

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork & Clone:** Create your own fork of the repository
2. **Feature Branch:** Create a branch for your feature (`git checkout -b feature/amazing-feature`)
3. **Development:** Write code with tests and documentation
4. **Testing:** Ensure all tests pass (`pnpm test`)
5. **Pull Request:** Submit PR with clear description

### Code Standards

- **TypeScript:** Strict mode enabled throughout
- **ESLint:** Consistent code formatting
- **Prettier:** Automated code formatting
- **Conventional Commits:** Semantic commit messages

---

## 📚 Resources

### Documentation

- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Architecture Overview](docs/architecture.md)
- [Troubleshooting Guide](docs/troubleshooting.md)

### Community

- [GitHub Discussions](https://github.com/your-org/dashboard/discussions)
- [Discord Community](https://discord.gg/dashboard)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/dashboard-platform)

### Integrations

- [Fly.io Machines API](https://fly.io/docs/machines/)
- [Supabase Documentation](https://supabase.com/docs)
- [Langfuse Observability](https://langfuse.com/docs)
- [TrustGraph Workflows](https://trustgraph.com/docs)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Acknowledgments

Built with modern technologies and best practices:

- **Next.js** - The React framework for production
- **Fly.io** - Global application platform
- **Supabase** - Open source Firebase alternative
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - JavaScript with syntax for types
- **Turborepo** - High-performance build system

---

<div align="center">
  <sub>🚀 Dashboard Platform - Empowering the future of distributed AI computing</sub>
</div>