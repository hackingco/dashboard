# Vercel Deployment Guide

This guide covers the automated deployment setup for the Swarm Control Dashboard using Vercel with comprehensive CI/CD integration.

## 🚀 Deployment Overview

The dashboard deployment supports multiple environments with automated workflows:

- **Preview Deployments**: Automatic deployments for all pull requests
- **Production Deployments**: Automatic deployments to production on main branch merges
- **Manual Deployments**: On-demand deployments using scripts or CLI

## 📋 Prerequisites

### Required Tools
- Node.js 18+ 
- Vercel CLI (`npm install -g vercel@latest`)
- Git

### Required Environment Variables
```bash
# Vercel Configuration
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id

# Optional Monitoring
MONITORING_WEBHOOK_URL=your_webhook_url
SENTRY_DSN=your_sentry_dsn
ANALYTICS_ID=your_analytics_id
```

## 🔧 Setup Instructions

### 1. Initial Vercel Setup

```bash
# Install Vercel CLI
npm install -g vercel@latest

# Login to Vercel
vercel login

# Link the project
cd admin-dashboard
vercel link

# Setup environment variables
npm run deploy:setup
```

### 2. GitHub Repository Setup

Ensure these secrets are configured in your GitHub repository:

```bash
# Go to: Settings > Secrets and variables > Actions
VERCEL_TOKEN        # Your Vercel authentication token
VERCEL_ORG_ID       # Your Vercel organization ID  
VERCEL_PROJECT_ID   # Your Vercel project ID

# Optional monitoring secrets
MONITORING_WEBHOOK_URL  # Webhook for deployment notifications
SENTRY_DSN             # Sentry error tracking DSN
ANALYTICS_ID           # Analytics tracking ID
```

### 3. Environment Configuration

The deployment uses environment-specific configurations:

#### Production (`.env.production`)
- Optimized performance settings
- Error tracking enabled
- Analytics enabled
- Debug mode disabled

#### Preview (`.env.preview`)
- Extended timeouts for testing
- Debug mode enabled
- Preview features enabled
- Console logging enabled

## 🔄 Deployment Workflows

### Automatic Deployments

#### Preview Deployments (Pull Requests)
```yaml
Trigger: Pull request to main branch
Steps:
1. Build and test verification
2. Deploy to Vercel preview environment
3. Health and performance validation
4. Comment PR with preview link
5. Run integration tests
```

#### Production Deployments (Main Branch)
```yaml
Trigger: Push to main branch
Steps:
1. Build and test verification
2. Deploy to Vercel production
3. Comprehensive validation suite
4. CDN cache warming
5. Monitoring system notification
6. Performance benchmarking
```

### Manual Deployments

#### Using Scripts
```bash
# Deploy to preview
npm run deploy:preview

# Deploy to production
npm run deploy:production

# Setup environment variables
npm run deploy:setup
```

#### Using Vercel CLI
```bash
# Preview deployment
vercel deploy

# Production deployment
vercel deploy --prod

# Local development with Vercel
vercel dev
```

## 🏥 Health Checks and Monitoring

### Automated Health Checks

The deployment includes comprehensive health checking:

1. **Basic Health Check** (`/api/health-check`)
   - Application status
   - Environment information
   - Response time measurement
   - External dependency checks

2. **Performance Validation**
   - Response time thresholds (< 3 seconds)
   - Static asset delivery
   - API connectivity
   - WebSocket availability

3. **Security Validation**
   - Security headers verification
   - CORS configuration
   - Content security policy

### Monitoring Integration

Post-deployment monitoring includes:

- Real-time health monitoring with 5-minute intervals
- Performance benchmarking
- Error tracking and alerting
- CDN cache optimization
- Automatic rollback triggers

## 📊 Validation and Testing

### Post-Deployment Validation

```bash
# Run comprehensive validation
npm run validate:deployment https://your-deployment-url.vercel.app

# Manual validation script
node scripts/post-deploy-validation.js https://your-deployment-url.vercel.app
```

### Validation Checks Include:

1. **Health Checks**
   - Application availability
   - API endpoint functionality
   - Static asset delivery
   - WebSocket connectivity

2. **Performance Tests**
   - Page load times
   - API response times
   - Cache effectiveness
   - CDN performance

3. **Functional Tests**
   - Dashboard navigation
   - Real-time data updates
   - Machine scaling controls
   - WebSocket connections

4. **Security Tests**
   - Security headers
   - CORS configuration
   - Content security policy
   - Authentication endpoints

## 🔧 Configuration Files

### Core Configuration
- `vercel.json` - Vercel platform configuration
- `.env.production` - Production environment variables
- `.env.preview` - Preview environment variables
- `.vercelignore` - Files to exclude from deployment

### Scripts
- `scripts/deploy.sh` - Comprehensive deployment script
- `scripts/post-deploy-validation.js` - Validation automation
- `scripts/vercel-env-setup.sh` - Environment setup automation

### GitHub Workflows
- `.github/workflows/vercel-deployment.yml` - Main deployment workflow

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs
vercel logs <deployment-url>

# Local build test
npm run build

# Type checking
npm run type-check
```

#### Environment Variables
```bash
# List current variables
vercel env ls

# Add missing variable
vercel env add VARIABLE_NAME production

# Pull environment for local testing
vercel env pull .env.local
```

#### Deployment Validation Failures
```bash
# Check deployment health
curl https://your-deployment.vercel.app/api/health-check

# Run local validation
node scripts/post-deploy-validation.js https://your-deployment.vercel.app

# Check Vercel function logs
vercel logs --limit=50
```

### Performance Issues

#### Slow Response Times
1. Check CDN cache configuration
2. Verify static asset optimization
3. Review API endpoint performance
4. Check WebSocket connection efficiency

#### Failed Health Checks
1. Verify external API availability
2. Check environment variable configuration
3. Review security header setup
4. Validate WebSocket endpoint configuration

## 📈 Performance Optimization

### Build Optimization
- Automatic code splitting by vendor
- Terser minification
- Source map generation (disabled in production)
- Asset optimization and compression

### Runtime Optimization
- CDN edge caching
- Automatic cache warming
- Performance monitoring
- Response time tracking

### Security Hardening
- Security headers implementation
- CORS configuration
- Content security policy
- Request timeout management

## 🔄 Continuous Integration

The deployment workflow integrates with:

- **GitHub Actions** for CI/CD automation
- **Vercel Preview** for PR deployments  
- **Health Monitoring** for uptime tracking
- **Performance Monitoring** for optimization
- **Error Tracking** for issue detection

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Build Configuration](https://vitejs.dev/config/)
- [GitHub Actions Workflows](https://docs.github.com/en/actions)
- [Performance Monitoring Best Practices](https://web.dev/performance/)

## 🆘 Support

For deployment issues:

1. Check the deployment logs in Vercel dashboard
2. Review GitHub Actions workflow runs
3. Run local validation scripts
4. Check external service status (Fly.io API)
5. Verify environment configuration

## 🔄 Updates and Maintenance

### Regular Maintenance
- Monitor deployment success rates
- Review performance metrics
- Update security configurations
- Optimize cache strategies
- Update dependencies

### Environment Updates
```bash
# Update environment variables
scripts/vercel-env-setup.sh

# Redeploy with new configuration
npm run deploy:production
```