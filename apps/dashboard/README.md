# Dashboard Service

**Modern Web Interface for Swarm Intelligence Platform**

*Real-time monitoring, agent management, and observability dashboard*

---

## 🚀 Overview

The Dashboard Service is a Next.js 14 web application that provides a comprehensive interface for managing and monitoring AI swarm orchestration. Built with TypeScript, Tailwind CSS, and modern React patterns, it offers real-time visualization of swarm activities, agent performance, and system metrics.

## ✨ Key Features

### 🎯 Swarm Management
- **Real-time Agent Monitoring** - Live status updates for all swarm agents
- **Interactive Topology Visualization** - Visual representation of agent relationships
- **Task Orchestration Interface** - Create, assign, and monitor distributed tasks
- **Performance Analytics** - Comprehensive metrics and performance insights
- **Resource Management** - Monitor and control resource allocation

### 📊 Observability & Analytics
- **Langfuse Integration** - LLM tracing and performance monitoring
- **Real-time Metrics** - Live performance dashboards with WebSocket updates
- **Supabase Real-time** - Instant data synchronization across all components
- **Custom Dashboards** - Configurable monitoring views for different use cases
- **Alert Management** - Custom notifications and escalation policies

### 🔧 Developer Experience
- **TypeScript** - Full type safety throughout the application
- **Tailwind CSS** - Utility-first styling with shadcn/ui components
- **Hot Reloading** - Instant feedback during development
- **Comprehensive Testing** - Unit, integration, and E2E test coverage
- **API Integration** - Seamless connection to Manager API and external services

---

## 🏗️ Architecture

### Component Structure
```
apps/dashboard/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes and webhooks
│   ├── swarm-management/  # Swarm management interface
│   ├── observability/     # Monitoring dashboards
│   └── machines/          # Fly.io machine management
├── components/            # Reusable React components
│   ├── swarm/            # Swarm-specific components
│   ├── observability/    # Monitoring components
│   ├── machines/         # Machine management components
│   └── ui/               # Base UI components
├── lib/                  # Utilities and integrations
│   ├── hooks/            # Custom React hooks
│   ├── supabase.ts       # Supabase client configuration
│   ├── langfuse-client.ts # Langfuse integration
│   └── machines-api.ts   # Fly.io Machines API client
├── tests/                # Test suites
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   ├── e2e/              # End-to-end tests
│   └── api/              # API integration tests
└── supabase/             # Database schema and functions
    ├── migrations/       # Database migrations
    ├── policies/         # Row Level Security policies
    └── types/            # TypeScript type definitions
```

### Key Integrations

#### 🗄️ Supabase Integration
- **Real-time Subscriptions** - Live data updates across all components
- **Authentication** - User authentication and session management
- **Database Operations** - CRUD operations for swarm data
- **Row Level Security** - Fine-grained access control

#### 📡 Langfuse Observability
- **LLM Tracing** - Track and analyze AI model performance
- **Performance Metrics** - Monitor response times and token usage
- **Session Management** - Group related AI operations
- **Custom Dashboards** - Visualize AI performance data

#### ⚡ Manager API Communication
- **RESTful API** - Standard HTTP API for swarm operations
- **WebSocket Connections** - Real-time updates and notifications
- **Authentication** - JWT-based secure communication
- **Error Handling** - Comprehensive error management and fallbacks

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **pnpm** 8+
- **Supabase** project configured
- **Manager API** running (see [../manager/README.md](../manager/README.md))

### Environment Setup

Create `.env.local` file:

```env
# Next.js Configuration
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Manager API Configuration
NEXT_PUBLIC_MANAGER_URL=http://localhost:8080
MANAGER_API_KEY=your-manager-api-key

# Langfuse Configuration (Optional)
NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
LANGFUSE_SECRET_KEY=your-langfuse-secret-key
NEXT_PUBLIC_LANGFUSE_HOST=https://cloud.langfuse.com

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Feature Flags
NEXT_PUBLIC_ENABLE_REAL_TIME=true
NEXT_PUBLIC_ENABLE_LANGFUSE=true
NEXT_PUBLIC_ENABLE_MACHINES_API=true
```

### Installation & Development

```bash
# Navigate to dashboard directory
cd apps/dashboard

# Install dependencies
pnpm install

# Set up Supabase database
pnpm supabase:setup

# Start development server
pnpm dev

# Open browser
open http://localhost:3000
```

### Database Setup

```bash
# Initialize Supabase
pnpm supabase:init

# Run migrations
pnpm supabase:migrate

# Generate types
pnpm supabase:types

# Seed development data (optional)
pnpm supabase:seed
```

---

## 🧪 Testing

### Test Suites

```bash
# Run all tests
pnpm test

# Run specific test types
pnpm test:unit           # Unit tests only
pnpm test:integration    # Integration tests
pnpm test:e2e           # End-to-end tests with Playwright
pnpm test:api           # API integration tests

# Development testing
pnpm test:watch         # Watch mode
pnpm test:coverage      # Generate coverage report
```

### API Integration Testing

The dashboard includes comprehensive API integration tests:

```bash
# Run Langfuse integration tests
pnpm test:langfuse

# Run Manager API tests
pnpm test:manager

# Run Supabase integration tests
pnpm test:supabase

# Generate test reports
pnpm test:report
```

For detailed testing documentation, see [tests/api/README.md](tests/api/README.md).

### Test Coverage Goals

- **Components**: 95%+ coverage for UI components
- **API Integration**: 90%+ coverage for external API calls
- **Real-time Features**: 85%+ coverage for WebSocket functionality
- **Authentication**: 100% coverage for auth flows

---

## 🚢 Deployment

### Production Build

```bash
# Build optimized production bundle
pnpm build

# Test production build locally
pnpm start

# Analyze bundle size
pnpm analyze
```

### Fly.io Deployment

```bash
# Deploy to Fly.io
pnpm deploy

# Deploy with specific configuration
pnpm deploy:production

# Deploy hotfix
pnpm deploy:hotfix

# Monitor deployment
pnpm deploy:status
```

### Environment Configuration

#### Production Environment Variables

```env
# Production URLs
NEXT_PUBLIC_APP_URL=https://your-dashboard.fly.dev
NEXT_PUBLIC_MANAGER_URL=https://your-manager.fly.dev

# Supabase Production
NEXT_PUBLIC_SUPABASE_URL=your-production-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-supabase-anon-key

# Langfuse Production
NEXT_PUBLIC_LANGFUSE_HOST=https://your-langfuse-instance.com

# Security
NEXTAUTH_SECRET=your-production-secret
```

#### Fly.io Configuration (`fly.toml`)

```toml
app = "swarm-dashboard"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  NEXT_PUBLIC_ENABLE_REAL_TIME = "true"

[[services]]
  http_checks = []
  internal_port = 3000
  processes = ["app"]
  protocol = "tcp"

  [services.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    grace_period = "1s"
    interval = "15s"
    restart_limit = 0
    timeout = "2s"
```

---

## 📊 Real-time Features

### WebSocket Integration

The dashboard maintains persistent WebSocket connections for real-time updates:

```typescript
// Example: Real-time swarm monitoring
import { useRealtimeSwarm } from '@/lib/hooks/use-realtime-swarm';

function SwarmDashboard() {
  const { agents, tasks, metrics, connectionState } = useRealtimeSwarm({
    swarmId: 'swarm-123',
    enableMetrics: true,
    reconnectAttempts: 5
  });

  return (
    <div>
      <SwarmTopology agents={agents} />
      <TaskList tasks={tasks} />
      <MetricsDashboard metrics={metrics} />
    </div>
  );
}
```

### Supabase Real-time

Live database updates using Supabase real-time subscriptions:

```typescript
// Example: Agent status updates
import { useSupabaseSwarm } from '@/lib/hooks/use-supabase-swarm';

function AgentMonitor() {
  const { agents, subscribe } = useSupabaseSwarm();

  useEffect(() => {
    const unsubscribe = subscribe('swarm_agents', {
      event: 'UPDATE',
      schema: 'public',
      filter: 'status=eq.active'
    }, (payload) => {
      console.log('Agent updated:', payload.new);
    });

    return () => unsubscribe();
  }, [subscribe]);

  return <AgentList agents={agents} />;
}
```

---

## 🔒 Security & Authentication

### Authentication Flow

1. **NextAuth.js Integration** - Secure authentication with multiple providers
2. **Supabase Auth** - Database-level user management
3. **JWT Tokens** - Secure API communication
4. **Row Level Security** - Database-level access control

### Security Features

- **CSRF Protection** - Built-in CSRF token validation
- **XSS Prevention** - Content Security Policy headers
- **Input Validation** - Zod schema validation for all forms
- **Rate Limiting** - API rate limiting to prevent abuse
- **Secure Headers** - Security headers for all responses

### Permission System

```typescript
// Example: Role-based access control
import { useAuth } from '@/lib/hooks/use-auth';

function AdminPanel() {
  const { user, hasPermission } = useAuth();

  if (!hasPermission('swarm:manage')) {
    return <AccessDenied />;
  }

  return <SwarmManagementInterface />;
}
```

---

## 🎨 UI Components

### Component Library

The dashboard uses a custom component library built on shadcn/ui:

```typescript
// Example: Swarm status component
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SwarmMetrics } from '@/components/swarm/swarm-metrics';

function SwarmCard({ swarm }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{swarm.name}</CardTitle>
        <Badge variant={swarm.status === 'active' ? 'success' : 'secondary'}>
          {swarm.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <SwarmMetrics swarmId={swarm.id} />
      </CardContent>
    </Card>
  );
}
```

### Theming & Styling

- **Dark/Light Mode** - Automatic theme switching
- **Responsive Design** - Mobile-first responsive layouts
- **Custom Variables** - CSS custom properties for consistent theming
- **Component Variants** - Flexible component styling system

---

## 📈 Performance Optimization

### Performance Features

- **Code Splitting** - Dynamic imports for optimal bundle size
- **Image Optimization** - Next.js Image component with WebP support
- **Caching Strategy** - Redis caching for API responses
- **Lazy Loading** - Lazy loading for non-critical components
- **Bundle Analysis** - Regular bundle size analysis and optimization

### Monitoring

```typescript
// Example: Performance monitoring
import { measurePerformance } from '@/lib/performance';

function DataTable({ data }) {
  const [renderTime, setRenderTime] = useState(0);

  useEffect(() => {
    const measure = measurePerformance('table-render');
    // Component rendering logic
    setRenderTime(measure.end());
  }, [data]);

  return <div>Render time: {renderTime}ms</div>;
}
```

---

## 🔧 Development Tools

### Development Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm dev:turbo        # Start with Turbo for faster builds
pnpm dev:debug        # Start with debugging enabled

# Building
pnpm build            # Production build
pnpm build:analyze    # Build with bundle analysis
pnpm build:standalone # Standalone build for Docker

# Code Quality
pnpm lint             # ESLint checking
pnpm lint:fix         # Auto-fix linting issues
pnpm type-check       # TypeScript checking
pnpm format           # Prettier formatting

# Database
pnpm supabase:start   # Start local Supabase
pnpm supabase:reset   # Reset local database
pnpm supabase:studio  # Open Supabase Studio
```

### VS Code Integration

Recommended VS Code extensions:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "supabase.supabase-vscode"
  ]
}
```

---

## 🤝 Contributing

### Development Workflow

1. **Create Feature Branch** - `git checkout -b feature/new-dashboard-feature`
2. **Implement Changes** - Follow TypeScript and React best practices
3. **Add Tests** - Ensure comprehensive test coverage
4. **Test Locally** - Run all test suites and manual testing
5. **Submit PR** - Include detailed description and screenshots

### Code Standards

- **TypeScript Strict Mode** - All code must pass strict type checking
- **ESLint Configuration** - Follow project ESLint rules
- **Prettier Formatting** - Consistent code formatting
- **Component Documentation** - JSDoc comments for all components
- **Accessibility** - WCAG 2.1 AA compliance for all UI components

### Component Guidelines

```typescript
// Example: Component template
import { FC } from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  /** The primary content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Component variant */
  variant?: 'default' | 'secondary';
}

/**
 * MyComponent provides...
 * 
 * @example
 * <MyComponent variant="secondary">
 *   Content here
 * </MyComponent>
 */
export const MyComponent: FC<MyComponentProps> = ({
  children,
  className,
  variant = 'default'
}) => {
  return (
    <div className={cn('base-classes', variant === 'secondary' && 'secondary-classes', className)}>
      {children}
    </div>
  );
};
```

---

## 🆘 Troubleshooting

### Common Issues

#### 1. Supabase Connection Issues
```bash
# Check Supabase status
pnpm supabase status

# Reset Supabase connection
pnpm supabase:reset

# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
```

#### 2. Build Failures
```bash
# Clear Next.js cache
pnpm clean

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Type check
pnpm type-check
```

#### 3. Real-time Features Not Working
```bash
# Check WebSocket connection
curl -H "Upgrade: websocket" http://localhost:8080/ws

# Verify Supabase real-time
pnpm supabase:logs --filter="realtime"
```

#### 4. Performance Issues
```bash
# Analyze bundle size
pnpm build:analyze

# Check for memory leaks
pnpm dev:debug

# Monitor performance
pnpm test:performance
```

### Debug Mode

Enable debug mode for detailed logging:

```env
# .env.local
DEBUG=true
NEXT_PUBLIC_DEBUG_REALTIME=true
NEXT_PUBLIC_DEBUG_API=true
```

---

## 📚 Additional Resources

- [**Next.js Documentation**](https://nextjs.org/docs) - Framework documentation
- [**Supabase Documentation**](https://supabase.com/docs) - Database and real-time features
- [**Tailwind CSS**](https://tailwindcss.com/docs) - Styling framework
- [**shadcn/ui**](https://ui.shadcn.com/) - Component library
- [**Langfuse Documentation**](https://langfuse.com/docs) - Observability integration

### Related Services

- [**Manager API**](../manager/README.md) - Backend API service
- [**Worker Service**](../worker/README.md) - Distributed worker agents
- [**Hive Mind**](../hive-mind/README.md) - Swarm coordination
- [**Claude Flow**](../../claude-flow-analysis/README.md) - AI integration layer

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

<div align="center">
  <sub>🚀 Dashboard Service - Real-time swarm intelligence at your fingertips</sub>
</div>