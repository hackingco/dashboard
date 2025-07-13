# Unified Deployment System

This directory contains the consolidated deployment scripts for the Swarm Manager application, replacing the previous scattered deployment scripts.

## 🚀 Quick Start

### Standard Deployment
```bash
# Simple standard deployment
./scripts/deployment/quick-deploy.sh standard

# Force deployment if needed
./scripts/deployment/quick-deploy.sh standard --force
```

### Emergency Hotfix
```bash
# Emergency deployment with bypass methods
./scripts/deployment/quick-deploy.sh hotfix
```

### New App Creation
```bash
# Create new app with unique name
./scripts/deployment/quick-deploy.sh new-app
```

## 📁 File Structure

```
scripts/deployment/
├── README.md              # This documentation
├── unified-deploy.sh      # Main deployment script with all methods
├── deploy-utils.sh        # Common utilities and functions
├── quick-deploy.sh        # Simplified interface for common scenarios
└── legacy/               # Original scripts (archived)
    ├── deploy.sh
    ├── deploy-bypass.sh
    ├── deploy-docker-direct.sh
    ├── deploy-api-direct.sh
    ├── deploy-simple.sh
    └── deploy-troubleshoot.sh
```

## 🛠️ Scripts Overview

### unified-deploy.sh
The main deployment script that consolidates all functionality from the original scripts:

**Features:**
- Multiple deployment methods (standard, bypass, docker, api, simple)
- Comprehensive error handling and fallback mechanisms
- Health checks and post-deployment validation
- Dry-run mode for testing
- Verbose output for debugging
- Authentication management

**Usage:**
```bash
./scripts/deployment/unified-deploy.sh [OPTIONS]

OPTIONS:
    --method <method>       Deployment method (standard|bypass|docker|api|simple)
    --app-name <name>       App name (default: swarm-manager-live)
    --region <region>       Deployment region (default: ord)
    --dockerfile <file>     Dockerfile to use (default: Dockerfile.simple)
    --config <file>         Fly config file (default: fly.toml)
    --force                 Force deployment
    --bypass-healthcheck    Skip health checks
    --generate-name         Generate unique app name with timestamp
    --dry-run              Show what would be done without executing
    --verbose              Enable verbose output
    --troubleshoot         Run diagnostic checks first
    --help                 Show help message
```

### deploy-utils.sh
Common utilities and functions used by deployment scripts:

**Features:**
- Authentication loading and verification
- Health check functions
- Project file validation
- API helper functions
- Docker image building
- Logging and error handling

**Functions available:**
- `load_fly_auth()` - Load Fly.io authentication
- `verify_fly_auth()` - Verify authentication works
- `check_prerequisites()` - Check required tools
- `wait_for_health()` - Wait for app health check
- `build_and_push_image()` - Docker image operations
- And many more...

### quick-deploy.sh
Simplified interface for common deployment scenarios:

**Scenarios:**
- `standard` - Standard deployment
- `hotfix` - Emergency deployment with force flags
- `new-app` - Create new app with unique name
- `troubleshoot` - Diagnostic deployment with full checks
- `docker` - Docker-based deployment
- `rollback` - Rollback to previous version

## 🔧 Deployment Methods

### 1. Standard Method
Uses the standard `fly deploy` command with minimal configuration.
```bash
./scripts/deployment/unified-deploy.sh --method standard
```

### 2. Bypass Method
Tries multiple deployment approaches with fallback mechanisms:
1. Standard deploy with force
2. Deploy with minimal config
3. Raw flyctl commands
4. App restart fallback

```bash
./scripts/deployment/unified-deploy.sh --method bypass
```

### 3. Docker Method
Builds and pushes Docker image directly to Fly.io registry:
```bash
./scripts/deployment/unified-deploy.sh --method docker
```

### 4. API Method
Direct API testing and debugging for troubleshooting:
```bash
./scripts/deployment/unified-deploy.sh --method api
```

### 5. Simple Method
Creates new app with unique name and deploys:
```bash
./scripts/deployment/unified-deploy.sh --method simple --generate-name
```

## 🔐 Authentication

The scripts automatically handle authentication by:

1. Loading from `fly-auth-env.sh` (if exists)
2. Loading from `.env` file (if exists)
3. Running `setup-fly-auth.sh` if no token found
4. Verifying authentication with `fly auth whoami`

**Manual authentication setup:**
```bash
# Set up authentication
./setup-fly-auth.sh

# Test authentication
./test-fly-auth.sh
```

## 🧪 Testing and Validation

### Dry Run
Test what would happen without actually deploying:
```bash
./scripts/deployment/unified-deploy.sh --method bypass --dry-run
```

### Troubleshooting
Run diagnostic checks before deployment:
```bash
./scripts/deployment/unified-deploy.sh --troubleshoot
```

### Health Checks
All deployments (except API method) include automatic health checks:
- Waits up to 10 attempts (100 seconds total)
- Tests `/health` endpoint
- Can be bypassed with `--bypass-healthcheck`

## 📊 Migration from Legacy Scripts

The unified system preserves all functionality from the original scripts:

| Legacy Script | Unified Method | Functionality Preserved |
|---------------|----------------|------------------------|
| `deploy.sh` | `standard` | ✅ Standard deployment with auth |
| `deploy-bypass.sh` | `bypass` | ✅ Multi-method with fallbacks |
| `deploy-docker-direct.sh` | `docker` | ✅ Docker registry deployment |
| `deploy-api-direct.sh` | `api` | ✅ API debugging and testing |
| `deploy-simple.sh` | `simple` | ✅ New app creation |
| `deploy-troubleshoot.sh` | `--troubleshoot` | ✅ Diagnostic capabilities |

### Backward Compatibility

For teams still using legacy scripts, they are preserved in `scripts/legacy/` directory. However, we recommend migrating to the unified system for:

- Better error handling
- Consistent interface
- Improved logging
- Health checks
- Dry-run capabilities

## 🚨 Emergency Procedures

### Emergency Rollback
The emergency rollback script is preserved exactly as-is for production safety:
```bash
# Emergency rollback (preserved script)
/path/to/scripts/emergency-rollback.sh --service manager --reason "Critical issue"

# Via quick-deploy
./scripts/deployment/quick-deploy.sh rollback
```

### Critical Authentication Scripts
These scripts are preserved in their original location:
- `setup-fly-auth.sh` - Authentication setup
- `test-fly-auth.sh` - Authentication testing

## 📝 Examples

### Standard Production Deployment
```bash
./scripts/deployment/quick-deploy.sh standard --app-name swarm-manager-live
```

### Emergency Hotfix
```bash
./scripts/deployment/quick-deploy.sh hotfix --force
```

### Testing New Features
```bash
./scripts/deployment/quick-deploy.sh new-app --app-name swarm-test-feature
```

### Troubleshooting Issues
```bash
./scripts/deployment/unified-deploy.sh --method api --troubleshoot --verbose
```

### Docker Deployment
```bash
./scripts/deployment/unified-deploy.sh --method docker --dockerfile Dockerfile.standalone
```

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Failed**
   ```bash
   ./setup-fly-auth.sh
   ./test-fly-auth.sh
   ```

2. **App Not Found**
   ```bash
   ./scripts/deployment/unified-deploy.sh --method simple --generate-name
   ```

3. **Deployment Hangs**
   ```bash
   ./scripts/deployment/unified-deploy.sh --method bypass --force
   ```

4. **Health Check Fails**
   ```bash
   ./scripts/deployment/unified-deploy.sh --bypass-healthcheck
   ```

### Debug Information

Enable verbose output for detailed debugging:
```bash
./scripts/deployment/unified-deploy.sh --verbose --troubleshoot
```

## 🔗 Related Documentation

- [Emergency Rollback Documentation](../../emergency-rollback.sh)
- [Fly.io Configuration](../../fly.toml)
- [Docker Configuration](../../Dockerfile.simple)
- [Authentication Setup](../../setup-fly-auth.sh)

## 📞 Support

If you encounter issues with the unified deployment system:

1. Check the troubleshooting section above
2. Run with `--troubleshoot` and `--verbose` flags
3. Review logs in the terminal output
4. Fall back to legacy scripts if needed (in `scripts/legacy/`)
5. Contact the development team with detailed error messages