# ⚡ Quick Reference Guide

## Dashboard Platform - Essential Commands & Procedures

**Repository:** https://github.com/hackingco/dashboard.git  
**Default Branch:** enterprise-swarm-platform  
**Development Branch:** dashboard

---

## 🚀 Quick Start

### First-Time Setup

```bash
# Clone repository
git clone https://github.com/hackingco/dashboard.git
cd dashboard

# Install dependencies
pnpm install

# Build project
pnpm build

# Start development
pnpm dev
```

### Existing Repository Update

```bash
# Update remote URL
git remote set-url origin https://github.com/hackingco/dashboard.git

# Fetch all branches
git fetch --all

# Switch to default branch
git checkout enterprise-swarm-platform
git pull origin enterprise-swarm-platform

# Switch to development branch
git checkout dashboard
git pull origin dashboard
```

---

## 🌿 Branch Workflow

### Branch Structure

```
enterprise-swarm-platform (default, production)
├── dashboard (development)
│   ├── feature/new-feature
│   ├── fix/bug-fix
│   └── hotfix/urgent-fix
└── backup/* (preserved branches)
```

### Common Git Commands

```bash
# Create feature branch
git checkout dashboard
git pull origin dashboard
git checkout -b feature/your-feature-name

# Push feature branch
git push origin feature/your-feature-name

# Create PR (target: dashboard branch)
gh pr create --base dashboard --title "Your feature title"

# Update feature branch with latest
git checkout dashboard
git pull origin dashboard
git checkout feature/your-feature-name
git rebase dashboard
```

---

## 🔧 Development Commands

### Package Management

```bash
# Install dependencies
pnpm install

# Add dependency
pnpm add package-name

# Add dev dependency
pnpm add -D package-name

# Update dependencies
pnpm update

# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Build & Test

```bash
# Build all applications
pnpm build

# Build specific app
pnpm build --filter=dashboard
pnpm build --filter=manager
pnpm build --filter=worker

# Run tests
pnpm test                    # All tests
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests
pnpm test:e2e              # End-to-end tests

# Test with coverage
pnpm test --coverage

# Test specific app
pnpm test --filter=dashboard
```

### Development Server

```bash
# Start all services
pnpm dev

# Start specific service
cd apps/dashboard && pnpm dev     # Dashboard (port 3000)
cd apps/manager && pnpm dev       # Manager API (port 8080)
cd apps/worker && pnpm dev        # Worker (port 8000)

# Start with specific port
cd apps/dashboard && pnpm dev --port 3001
```

---

## 🚢 Deployment

### Quick Deploy

```bash
# Deploy all services
pnpm deploy

# Deploy specific service
cd apps/dashboard && pnpm deploy
cd apps/manager && pnpm deploy
cd apps/worker && pnpm deploy
```

### Fly.io Commands

```bash
# Login to Fly.io
fly auth login

# Deploy dashboard
cd apps/dashboard
fly deploy

# Deploy manager
cd apps/manager
fly deploy

# Deploy worker
cd apps/worker
fly deploy

# Check status
fly status
fly logs

# Scale application
fly scale count 3
fly scale memory 1024
```

### Docker Commands

```bash
# Build Docker image
docker build -t dashboard-app .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 🔍 Monitoring & Debugging

### Health Checks

```bash
# Check application health
curl http://localhost:3000/api/health      # Dashboard
curl http://localhost:8080/api/health      # Manager
curl http://localhost:8000/api/health      # Worker

# Check production health
curl https://dashboard-platform.fly.dev/api/health
curl https://dashboard-manager.fly.dev/api/health
```

### Logs

```bash
# Local development logs
pnpm dev                        # All services
cd apps/dashboard && pnpm dev   # Dashboard logs
cd apps/manager && pnpm dev     # Manager logs

# Production logs (Fly.io)
fly logs -a dashboard-platform
fly logs -a dashboard-manager
fly logs -a dashboard-worker

# Docker logs
docker-compose logs dashboard
docker-compose logs manager
docker-compose logs worker
```

### Performance Monitoring

```bash
# Langfuse dashboard
open https://langfuse.com/dashboard

# TrustGraph monitoring
open https://trustgraph.com/dashboard

# Supabase dashboard
open https://app.supabase.com/project/your-project-id
```

---

## 🐛 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml .next
pnpm install
pnpm build

# TypeScript errors
pnpm type-check
pnpm lint
```

#### Git Issues
```bash
# Remote URL problems
git remote -v
git remote set-url origin https://github.com/hackingco/dashboard.git

# Branch tracking issues
git branch -vv
git checkout dashboard
git branch --set-upstream-to=origin/dashboard
```

#### Development Server Issues
```bash
# Port conflicts
lsof -i :3000
kill -9 $(lsof -t -i:3000)

# Clear Next.js cache
rm -rf .next
pnpm dev

# Reset development environment
docker-compose down
docker-compose up -d
```

#### Deployment Issues
```bash
# Fly.io deployment problems
fly doctor
fly auth whoami
fly deploy --verbose

# Docker build issues
docker system prune
docker build --no-cache -t dashboard-app .
```

---

## 🔧 Configuration

### Environment Variables

#### Dashboard (.env.local)
```env
NEXT_PUBLIC_MANAGER_URL=http://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=your-public-key
```

#### Manager (.env)
```env
PORT=8080
NODE_ENV=development
FLY_API_TOKEN=your-fly-token
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret
LANGFUSE_SECRET_KEY=your-secret-key
```

#### Worker (.env)
```env
PORT=8000
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
WORKER_TYPE=generic
WORKER_CONCURRENCY=4
```

### Service URLs

#### Development
- **Dashboard**: http://localhost:3000
- **Manager API**: http://localhost:8080
- **Worker**: http://localhost:8000
- **Redis**: localhost:6379
- **API Docs**: http://localhost:8080/api/docs

#### Production
- **Dashboard**: https://dashboard-platform.fly.dev
- **Manager API**: https://dashboard-manager.fly.dev
- **Worker**: Auto-scaled Fly.io machines
- **Monitoring**: Langfuse + TrustGraph dashboards

---

## 📋 Code Quality

### Linting & Formatting

```bash
# Lint code
pnpm lint

# Fix lint issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm type-check

# Pre-commit checks
pnpm pre-commit
```

### Git Hooks

```bash
# Install git hooks
npx husky install

# Manual pre-commit check
npx lint-staged

# Manual commit message check
npx commitlint --from HEAD~1 --to HEAD --verbose
```

### Commit Messages

```bash
# Conventional commit format
feat: add new swarm management feature
fix: resolve memory leak in worker agents
docs: update API documentation
style: format code with prettier
refactor: simplify agent coordination logic
test: add integration tests for swarm API
chore: update dependencies
```

---

## 🔐 Security

### Environment Security

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Check for secrets in code
git secret scan

# Validate environment
pnpm audit
pnpm audit fix
```

### API Security

```bash
# Test API security
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:8080/api/swarms

# Rate limiting test
for i in {1..110}; do
  curl http://localhost:8080/api/health
done
```

---

## 📊 Performance

### Performance Testing

```bash
# Load testing
npx autocannon http://localhost:8080/api/health

# Bundle analysis
cd apps/dashboard
pnpm analyze

# Performance monitoring
pnpm test:performance
```

### Optimization

```bash
# Bundle size analysis
cd apps/dashboard
npm install -g @next/bundle-analyzer
ANALYZE=true pnpm build

# Database query optimization
# Check Supabase dashboard for slow queries

# Redis cache monitoring
redis-cli monitor
redis-cli info memory
```

---

## 🔗 Useful Links

### Documentation
- [Repository Transition Guide](./REPOSITORY_TRANSITION_GUIDE.md)
- [Technical Changes Log](./TECHNICAL_CHANGES_LOG.md)
- [Team Announcement](./TEAM_ANNOUNCEMENT_TEMPLATE.md)
- [Main README](../README.md)

### External Services
- [Fly.io Dashboard](https://fly.io/dashboard)
- [Supabase Project](https://app.supabase.com)
- [Langfuse Dashboard](https://langfuse.com)
- [TrustGraph Dashboard](https://trustgraph.com)

### Tools
- [GitHub Repository](https://github.com/hackingco/dashboard)
- [GitHub Actions](https://github.com/hackingco/dashboard/actions)
- [GitHub Issues](https://github.com/hackingco/dashboard/issues)
- [GitHub Discussions](https://github.com/hackingco/dashboard/discussions)

---

## 🆘 Help & Support

### Getting Help

1. **Documentation**: Check `/docs` directory
2. **GitHub Issues**: Create issue for bugs
3. **Discussions**: Ask questions in GitHub Discussions
4. **Team Chat**: Use team communication channels

### Emergency Contacts

- **Production Issues**: Contact DevOps team immediately
- **Security Issues**: Contact security team
- **Build Issues**: Check GitHub Actions or contact dev team

### Quick Diagnostic

```bash
# System health check
git status
git remote -v
node --version
pnpm --version
docker --version
fly version

# Application health
pnpm install
pnpm build
pnpm test
curl http://localhost:8080/api/health
```

---

**⚡ Quick Reference Complete - Dashboard Platform Ready to Go**

*Keep this guide handy for daily development with the Dashboard platform.*