# Deployment Consolidation Guide

## Overview

This guide documents the consolidation of redundant GitHub workflows and deployment scripts for the Swarm Orchestrator project. The consolidation improves maintainability, reduces duplication, and provides a unified deployment and testing experience.

## Changes Made

### 📁 GitHub Workflows Consolidation

#### ✅ **Enhanced Main CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)

The main CI/CD workflow has been enhanced to include all deployment and testing functionality:

**Key Features:**
- **Unified Deployment**: Supports both Fly.io (Manager API) and Vercel (Dashboard) deployments
- **Enhanced Security**: Integrated dependency scanning, secret detection, and container security scans
- **Comprehensive Performance Testing**: Load tests, memory profiling, and regression detection
- **Multi-Environment Support**: Staging and production deployments with environment-specific configurations
- **Robust Health Checks**: Comprehensive validation for all deployed services
- **Emergency Rollback**: Automated rollback capabilities on deployment failures

**Workflow Jobs:**
1. `security-scan` - Enhanced security scanning with multiple tools
2. `code-quality` - ESLint, Prettier, TypeScript validation
3. `unit-tests` - Comprehensive unit and integration testing
4. `e2e-tests` - End-to-end testing across browsers
5. `performance-tests` - Load testing and performance regression detection
6. `build` - Unified build process for all services
7. `deploy-staging` - Unified staging deployment (Fly.io + Vercel)
8. `deploy-production` - Unified production deployment with canary strategy
9. `post-deployment` - Monitoring and validation
10. `rollback` - Emergency rollback procedures

#### 🗃️ **Archived Redundant Workflows**

The following workflows have been moved to `.github/workflows/archive/`:

- `deploy-production.yml` → **Functionality merged into main CI/CD**
- `enhanced-fly-deployment.yml` → **Functionality merged into main CI/CD**
- `staging-deployment.yml` → **Functionality merged into main CI/CD**
- `vercel-deployment.yml` → **Functionality merged into main CI/CD**
- `performance-monitoring.yml` → **Core features integrated into main CI/CD**
- `security-scan.yml` → **Core features integrated into main CI/CD**

#### ✅ **Preserved Essential Workflows**

- `manual-rollback.yml` - **Enhanced for emergency procedures**
  - Improved Vercel rollback instructions
  - Better error handling and validation
  - Comprehensive audit trail

### 🛠️ Scripts Consolidation

#### ✅ **New Unified Scripts**

**1. `scripts/unified-deploy.sh`** - Comprehensive deployment script
```bash
# Examples:
./scripts/unified-deploy.sh -e production -a           # Deploy all to production
./scripts/unified-deploy.sh -e staging -m             # Deploy only manager to staging
./scripts/unified-deploy.sh --dry-run -e production   # Show deployment plan
```

**Features:**
- Multi-service deployment (Manager, Dashboard, Worker)
- Environment-specific configurations
- Comprehensive health checks
- Emergency rollback capabilities
- Dry-run mode for validation

**2. `scripts/unified-test.sh`** - Comprehensive testing script
```bash
# Examples:
./scripts/unified-test.sh                             # Run all tests
./scripts/unified-test.sh -t unit -c                  # Unit tests with coverage
./scripts/unified-test.sh -t e2e -e staging           # E2E tests against staging
```

**Features:**
- Multiple test types (unit, integration, e2e, performance, security)
- Coverage reporting
- Environment-specific testing
- Comprehensive reporting

#### 🗃️ **Archived Redundant Scripts**

The following scripts have been moved to `scripts/archive/`:

- `deploy-to-fly.sh`
- `deploy-fly-apps.sh`
- `simple-deploy.sh`
- `quick-deploy.sh`
- `deploy-dashboard-static.sh`
- `deploy-dashboard-nextjs.sh`
- `run-tests.sh`
- `run-all-tests.sh`
- `run-comprehensive-tests.sh`

## Usage Guide

### 🚀 Deployment

#### Using GitHub Actions (Recommended)

**Automatic Deployment:**
- Push to `main` → Production deployment
- Push to `develop` → Staging deployment
- Pull requests → Staging preview deployment

**Manual Deployment:**
1. Go to **Actions** → **Comprehensive CI/CD Pipeline**
2. Click **Run workflow**
3. Select environment and options
4. Monitor deployment progress

#### Using Scripts

**Deploy to Production:**
```bash
./scripts/unified-deploy.sh -e production -a
```

**Deploy Only Manager to Staging:**
```bash
./scripts/unified-deploy.sh -e staging -m
```

**Dry Run (Show Plan):**
```bash
./scripts/unified-deploy.sh --dry-run -e production
```

### 🧪 Testing

#### Using GitHub Actions

Tests run automatically on all pushes and pull requests.

#### Using Scripts

**Run All Tests:**
```bash
./scripts/unified-test.sh
```

**Unit Tests with Coverage:**
```bash
./scripts/unified-test.sh -t unit -c
```

**E2E Tests Against Staging:**
```bash
./scripts/unified-test.sh -t e2e -e staging
```

### 🔄 Emergency Procedures

#### Rollback via GitHub Actions

1. Go to **Actions** → **Manual Rollback**
2. Click **Run workflow**
3. Select service to rollback
4. Enter rollback reason
5. Type "CONFIRM" to proceed

#### Manual Rollback

**Fly.io Services:**
```bash
flyctl releases rollback --app swarm-manager-live
flyctl releases rollback --app swarm-worker
```

**Vercel Dashboard:**
1. Go to Vercel dashboard
2. Select deployment to promote
3. Set as production alias

## Configuration

### Required Environment Variables

**GitHub Secrets:**
```
FLY_API_TOKEN              # Fly.io API token
VERCEL_TOKEN               # Vercel deployment token
VERCEL_ORG_ID              # Vercel organization ID
VERCEL_PROJECT_ID          # Vercel project ID
SUPABASE_URL               # Supabase project URL
SUPABASE_ANON_KEY          # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY  # Supabase service role key
LANGFUSE_PUBLIC_KEY        # Langfuse public key
LANGFUSE_SECRET_KEY        # Langfuse secret key
LANGFUSE_HOST              # Langfuse host URL
SLACK_WEBHOOK              # Slack notifications (optional)
SNYK_TOKEN                 # Snyk security scanning (optional)
```

**Local Development:**
```bash
export FLY_API_TOKEN="your_fly_token"
export VERCEL_TOKEN="your_vercel_token"
export VERCEL_ORG_ID="your_org_id"
export VERCEL_PROJECT_ID="your_project_id"
```

## Benefits of Consolidation

### ✅ **Improved Maintainability**
- Single source of truth for deployment logic
- Reduced code duplication
- Easier updates and bug fixes

### ✅ **Enhanced Reliability**
- Consistent deployment procedures
- Comprehensive health checks
- Automated rollback capabilities

### ✅ **Better Developer Experience**
- Unified command-line interface
- Clear documentation and examples
- Comprehensive error handling

### ✅ **Cost Optimization**
- Reduced GitHub Actions usage
- Faster deployment times
- Efficient resource utilization

### ✅ **Security Improvements**
- Integrated security scanning
- Consistent security policies
- Automated vulnerability detection

## Migration Notes

### For Existing Deployments

**No immediate action required** - existing deployments will continue to work.

**To use new workflows:**
1. Update any custom deployment scripts to use `unified-deploy.sh`
2. Update CI/CD references to use the main workflow
3. Remove any custom workflow files that duplicate functionality

### For Development Teams

**Update documentation** to reference the new unified scripts and workflows.

**Training recommendations:**
1. Review the new workflow structure
2. Practice with dry-run deployments
3. Familiarize with emergency procedures

## Troubleshooting

### Common Issues

**1. Deployment Failures**
- Check GitHub Actions logs for detailed error messages
- Verify all required environment variables are set
- Ensure Fly.io and Vercel tokens have proper permissions

**2. Test Failures**
- Run tests locally using `unified-test.sh`
- Check for environment-specific issues
- Review test output files in `test-results/` directory

**3. Rollback Issues**
- Use manual rollback workflow for complex situations
- Check Fly.io release history: `flyctl releases list`
- Verify Vercel deployment status in dashboard

### Getting Help

1. Check GitHub Actions logs for detailed error information
2. Review the consolidated documentation in this guide
3. Use dry-run mode to validate deployment plans
4. Contact the development team for complex rollback scenarios

## Future Improvements

### Planned Enhancements

1. **Blue-Green Deployments** - Zero-downtime deployment strategy
2. **Advanced Monitoring** - Enhanced observability and alerting
3. **Automated Testing** - Expanded test coverage and automation
4. **Multi-Region Support** - Geographic deployment distribution
5. **Disaster Recovery** - Comprehensive backup and recovery procedures

### Maintenance Schedule

- **Weekly**: Review deployment metrics and optimize
- **Monthly**: Update dependencies and security scans
- **Quarterly**: Comprehensive workflow review and improvements

---

*This consolidation was implemented to improve the reliability, maintainability, and developer experience of the Swarm Orchestrator deployment pipeline.*