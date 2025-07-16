# Swarm Intelligence Platform

**Enterprise-Grade AI Swarm Orchestration & Coordination**

*Modern distributed computing with intelligent agent coordination and real-time observability*

---

## 🚀 Overview

This is a comprehensive AI swarm orchestration platform that transforms distributed computing through intelligent agent coordination. Built on modern cloud-native technologies, it provides real-time monitoring, automated scaling, and seamless integration with leading observability tools including Langfuse, Supabase, and Claude Flow.

## 🏗️ Monorepo Structure

This monorepo contains multiple interconnected services and tools:

```
swarm03/
├── apps/
│   ├── dashboard/          # Next.js dashboard application
│   ├── manager/           # API service and orchestration engine
│   ├── worker/            # Distributed worker agents
│   └── hive-mind/         # Swarm coordination service
├── claude-flow-analysis/   # Claude Flow integration and analysis
├── shared/                # Shared libraries and utilities
├── docs/                  # Comprehensive documentation
├── scripts/               # Deployment and automation scripts
└── config/                # Configuration files
```

### 📱 Service Components

| Service | Purpose | Documentation | Status |
|---------|---------|---------------|--------|
| [**Dashboard**](apps/dashboard/) | Web UI for swarm management | [README](apps/dashboard/README.md) | ✅ Active |
| [**Manager**](apps/manager/) | API orchestration engine | [README](apps/manager/README.md) | ✅ Active |
| [**Worker**](apps/worker/) | Distributed agent workers | [README](apps/worker/README.md) | ✅ Active |
| [**Hive Mind**](apps/hive-mind/) | Swarm coordination | [README](apps/hive-mind/README.md) | 🔄 Beta |
| [**Claude Flow**](claude-flow-analysis/) | AI integration layer | [README](claude-flow-analysis/README.md) | ✅ Active |

### ✨ Platform Features

🎯 **Intelligent Swarm Orchestration**
- Real-time AI agent coordination across multiple services
- Automated task distribution and load balancing
- Dynamic scaling based on workload patterns
- Multi-region deployment with Fly.io integration
- Claude Flow integration for enhanced AI capabilities

🖥️ **Modern Dashboard Interface**
- Responsive Next.js frontend with Tailwind CSS
- Real-time monitoring and telemetry via Supabase
- Interactive swarm topology visualization
- Comprehensive observability dashboards with Langfuse
- Live WebSocket connections for instant updates

⚡ **Cloud-Native Architecture**
- Microservices architecture with Docker containers
- Fly.io Machines API for instant scaling
- Supabase for real-time data sync and persistence
- Redis for caching and session management
- Nginx load balancing and reverse proxy

📊 **Advanced Observability & Analytics**
- Langfuse LLM tracing and performance monitoring
- Real-time metrics collection and visualization
- Custom alerting and notification systems
- Performance benchmarking and optimization
- Comprehensive logging across all services

🔧 **Developer Experience**
- TypeScript throughout the entire stack
- Comprehensive testing with Vitest and Playwright
- CI/CD automation with GitHub Actions
- Monorepo architecture with pnpm workspaces
- Hot reloading and development tooling

---

## 🏗️ Service Architecture

The platform consists of multiple interconnected services working in harmony:

### 📱 Dashboard Service
**Location:** [`apps/dashboard/`](apps/dashboard/)
- **Framework:** Next.js 14 with App Router and TypeScript
- **Styling:** Tailwind CSS with shadcn/ui components
- **Features:** Real-time swarm monitoring, agent management, observability dashboards
- **Integration:** Supabase real-time, Langfuse tracing, WebSocket connections
- **Deployment:** Optimized builds for Fly.io with CDN distribution

### 🧠 Manager Service
**Location:** [`apps/manager/`](apps/manager/)
- **Framework:** Express.js with TypeScript and comprehensive API
- **Features:** Fly.io integration, task orchestration, real-time coordination
- **Services:** Supabase persistence, Langfuse monitoring, WebSocket management
- **Scaling:** Horizontal auto-scaling with health checks and load balancing
- **Authentication:** JWT-based auth with role-based access control

### 🐝 Worker Service
**Location:** [`apps/worker/`](apps/worker/)
- **Deployment:** Dynamic Fly.io Machine creation and management
- **Agent Types:** Researcher, Coder, Analyst, Tester, Coordinator agents
- **Features:** Auto-scaling, health monitoring, distributed task execution
- **Coordination:** Integrated with Claude Flow and hive mind systems

### 🧠 Hive Mind Service
**Location:** [`apps/hive-mind/`](apps/hive-mind/)
- **Purpose:** Advanced swarm coordination and consensus management
- **Features:** Agent communication protocols, distributed decision making
- **Integration:** Claude Flow hooks, performance monitoring, neural patterns
- **Architecture:** Event-driven with real-time state synchronization

### 🔗 Claude Flow Integration
**Location:** [`claude-flow-analysis/`](claude-flow-analysis/)
- **Purpose:** Advanced AI integration and analysis layer
- **Features:** LLM tracing, performance optimization, neural pattern recognition
- **Tools:** CLI instrumentation, real-time monitoring, benchmark suites
- **Integration:** Deep hooks into all services for enhanced AI capabilities

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and pnpm workspace support
- **Fly.io** account with API token for deployment
- **Supabase** project with database configured
- **Redis** instance for caching and sessions
- **Claude** API access for AI integration
- **Langfuse** instance for observability (optional but recommended)

### 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/your-org/swarm-platform.git
cd swarm-platform

# Install dependencies for all services
pnpm install

# Set up environment configuration
cp .env.example .env

# Build all applications
pnpm build

# Start development environment (all services)
pnpm dev

# Or start individual services
pnpm dev:dashboard   # Dashboard UI only
pnpm dev:manager     # Manager API only
pnpm dev:worker      # Worker service only
```

### ⚙️ Environment Configuration

Each service requires specific environment variables. See individual README files for detailed configuration:

#### Global Configuration (`.env`)
```env
# Core infrastructure
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
REDIS_URL=redis://localhost:6379

# Fly.io deployment
FLY_API_TOKEN=your-fly-api-token

# AI services
CLAUDE_API_KEY=your-claude-api-key
LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
LANGFUSE_SECRET_KEY=your-langfuse-secret-key

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

#### Service-Specific Configuration
- **Dashboard**: See [`apps/dashboard/README.md`](apps/dashboard/README.md)
- **Manager**: See [`apps/manager/README.md`](apps/manager/README.md)
- **Worker**: See [`apps/worker/README.md`](apps/worker/README.md)
- **Hive Mind**: See [`apps/hive-mind/README.md`](apps/hive-mind/README.md)

---

## 🚢 Deployment

### One-Command Deployment

```bash
# Deploy all services to production
pnpm deploy:all

# Or deploy individual services
pnpm deploy:dashboard   # Dashboard UI
pnpm deploy:manager     # Manager API
pnpm deploy:worker      # Worker service
pnpm deploy:hive-mind   # Hive Mind coordination

# Emergency deployment (hotfix)
pnpm deploy:hotfix
```

### Service-Specific Deployment

Each service has its own deployment documentation:
- **Dashboard**: [`apps/dashboard/README.md#deployment`](apps/dashboard/README.md#deployment)
- **Manager**: [`apps/manager/README.md#deployment`](apps/manager/README.md#deployment)
- **Worker**: [`apps/worker/README.md#deployment`](apps/worker/README.md#deployment)

### Infrastructure Setup

1. **Fly.io Configuration**
   - Configure `fly.toml` files for each service
   - Set up secrets with `fly secrets set`
   - Enable auto-scaling policies
   - Configure load balancing and health checks

2. **Supabase Setup**
   - Run database migrations: `supabase db push`
   - Configure Row Level Security policies
   - Set up real-time subscriptions
   - Import schema from [`apps/dashboard/supabase/`](apps/dashboard/supabase/)

3. **Observability Integration**
   - Configure Langfuse for LLM tracing and monitoring
   - Set up Supabase real-time for live updates
   - Enable custom alerting and notification rules
   - Deploy monitoring dashboards

4. **Claude Flow Integration**
   - Install and configure Claude Flow CLI
   - Set up neural pattern training
   - Configure performance optimization hooks
   - Enable advanced AI coordination features

For detailed setup instructions, see [`docs/deployment/`](docs/deployment/) and individual service documentation.

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

### Comprehensive Test Suites

```bash
# Run all tests across all services
pnpm test:all

# Run tests by type
pnpm test:unit           # Unit tests across all services
pnpm test:integration    # Integration tests
pnpm test:e2e           # End-to-end tests
pnpm test:performance   # Performance and load tests
pnpm test:smoke         # Smoke tests for deployments

# Service-specific testing
pnpm test:dashboard     # Dashboard-specific tests
pnpm test:manager       # Manager API tests
pnpm test:worker        # Worker service tests
pnpm test:langfuse      # Langfuse integration tests

# Development testing
pnpm test:watch         # Watch mode for development
pnpm test:coverage      # Generate coverage reports
```

### Testing Documentation

Each service has detailed testing documentation:
- **Dashboard Tests**: [`apps/dashboard/tests/`](apps/dashboard/tests/)
- **Manager Tests**: [`apps/manager/tests/`](apps/manager/tests/)
- **API Integration Tests**: [`apps/dashboard/tests/api/README.md`](apps/dashboard/tests/api/README.md)
- **Claude Flow Tests**: [`claude-flow-analysis/tests/`](claude-flow-analysis/tests/)

### Test Coverage Goals

- **Unit Tests:** 95%+ coverage for core business logic across all services
- **Integration Tests:** Full API endpoint validation and service communication
- **E2E Tests:** Critical user journeys and swarm coordination scenarios
- **Performance Tests:** Load testing, benchmarking, and scaling validation
- **Observability Tests:** Langfuse integration and monitoring validation
- **Security Tests:** Authentication, authorization, and data protection

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

## 📚 Documentation

### Service Documentation

| Service | README | API Docs | Deployment |
|---------|--------|----------|------------|
| Dashboard | [README](apps/dashboard/README.md) | [API](apps/dashboard/docs/) | [Deploy](apps/dashboard/README.md#deployment) |
| Manager | [README](apps/manager/README.md) | [API](apps/manager/docs/) | [Deploy](apps/manager/README.md#deployment) |
| Worker | [README](apps/worker/README.md) | - | [Deploy](apps/worker/README.md#deployment) |
| Hive Mind | [README](apps/hive-mind/README.md) | - | - |
| Claude Flow | [README](claude-flow-analysis/README.md) | [CLI](claude-flow-analysis/docs/) | [Setup](claude-flow-analysis/README.md#installation) |

### Architecture & Guides

- [**Architecture Overview**](docs/architecture/) - System design and component relationships
- [**Deployment Guide**](docs/deployment/) - Production deployment strategies
- [**Development Guide**](docs/development/) - Local development setup
- [**API Documentation**](docs/api/) - Comprehensive API reference
- [**Troubleshooting Guide**](docs/troubleshooting.md) - Common issues and solutions
- [**Security Guide**](docs/security/) - Security best practices
- [**Performance Guide**](docs/performance/) - Optimization strategies

### Community & Support

- [GitHub Discussions](https://github.com/your-org/swarm-platform/discussions)
- [Issues & Bug Reports](https://github.com/your-org/swarm-platform/issues)
- [Discord Community](https://discord.gg/swarm-platform)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/swarm-platform)

### Platform Integrations

- [**Fly.io Machines API**](https://fly.io/docs/machines/) - Dynamic scaling and deployment
- [**Supabase**](https://supabase.com/docs) - Real-time database and authentication
- [**Langfuse**](https://langfuse.com/docs) - LLM observability and tracing
- [**Claude Flow**](claude-flow-analysis/README.md) - Advanced AI coordination
- [**Redis**](https://redis.io/docs) - Caching and session management
- [**Docker**](https://docs.docker.com/) - Containerization and deployment

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⭐ Technology Stack

Built with modern technologies and best practices:

### Frontend & UI
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern component library
- **TypeScript** - Type-safe JavaScript

### Backend & API
- **Express.js** - Fast, minimalist web framework
- **Supabase** - Real-time database and authentication
- **Redis** - In-memory data structure store
- **WebSockets** - Real-time bidirectional communication

### AI & Coordination
- **Claude Flow** - Advanced AI agent coordination
- **Langfuse** - LLM observability and tracing
- **Neural Patterns** - Machine learning optimization

### Infrastructure & Deployment
- **Fly.io** - Global application platform
- **Docker** - Containerization platform
- **pnpm** - Fast, disk space efficient package manager
- **GitHub Actions** - CI/CD automation

### Development Tools
- **Vitest** - Unit testing framework
- **Playwright** - End-to-end testing
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting

---

<div align="center">
  <sub>🚀 Dashboard Platform - Empowering the future of distributed AI computing</sub>
</div>