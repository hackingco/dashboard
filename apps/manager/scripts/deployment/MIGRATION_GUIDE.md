# Migration Guide: Legacy to Unified Deployment System

This guide helps you migrate from the scattered deployment scripts to the unified deployment system.

## 🎯 Quick Migration

### Before (Legacy)
```bash
# Old scattered scripts
./deploy.sh                    # Basic deployment
./deploy-bypass.sh            # Multi-method deployment
./deploy-docker-direct.sh     # Docker deployment
./deploy-api-direct.sh        # API debugging
./deploy-simple.sh            # New app creation
./deploy-troubleshoot.sh      # Diagnostics
```

### After (Unified)
```bash
# New unified system
./scripts/deployment/quick-deploy.sh standard      # Replaces deploy.sh
./scripts/deployment/quick-deploy.sh hotfix        # Replaces deploy-bypass.sh
./scripts/deployment/unified-deploy.sh --method docker  # Replaces deploy-docker-direct.sh
./scripts/deployment/unified-deploy.sh --method api     # Replaces deploy-api-direct.sh
./scripts/deployment/quick-deploy.sh new-app           # Replaces deploy-simple.sh
./scripts/deployment/unified-deploy.sh --troubleshoot  # Replaces deploy-troubleshoot.sh
```

## 📋 Migration Checklist

### ✅ Completed Automatically
- [x] All legacy scripts moved to `scripts/legacy/`
- [x] Unified deployment system created in `scripts/deployment/`
- [x] Backward compatibility wrapper created (`deploy.sh`)
- [x] All functionality preserved and enhanced
- [x] Documentation created

### 🔧 Manual Steps Required

1. **Update CI/CD Pipelines**
   - Replace legacy script calls with unified system
   - Update any automated deployment workflows

2. **Update Documentation**
   - Update any project documentation that references old scripts
   - Share new deployment guide with team

3. **Test New System**
   - Run dry-run deployments to verify functionality
   - Test all deployment scenarios you use

4. **Train Team**
   - Share the new deployment commands with the team
   - Demonstrate the new features and capabilities

## 🔄 Command Mappings

### deploy.sh → unified system
```bash
# Legacy
./deploy.sh

# Unified (automatic via wrapper)
./deploy.sh
# OR explicitly:
./scripts/deployment/quick-deploy.sh standard
```

### deploy-bypass.sh → unified system
```bash
# Legacy
./deploy-bypass.sh

# Unified
./scripts/deployment/quick-deploy.sh hotfix
# OR with options:
./scripts/deployment/unified-deploy.sh --method bypass --force
```

### deploy-docker-direct.sh → unified system
```bash
# Legacy
./deploy-docker-direct.sh

# Unified
./scripts/deployment/unified-deploy.sh --method docker
```

### deploy-api-direct.sh → unified system
```bash
# Legacy
./deploy-api-direct.sh

# Unified
./scripts/deployment/unified-deploy.sh --method api --troubleshoot --verbose
```

### deploy-simple.sh → unified system
```bash
# Legacy
./deploy-simple.sh

# Unified
./scripts/deployment/quick-deploy.sh new-app
# OR with custom name:
./scripts/deployment/unified-deploy.sh --method simple --generate-name
```

### deploy-troubleshoot.sh → unified system
```bash
# Legacy
./deploy-troubleshoot.sh

# Unified
./scripts/deployment/unified-deploy.sh --troubleshoot
```

## 🆕 New Features Available

### 1. Dry Run Mode
Test deployments without actually executing:
```bash
./scripts/deployment/unified-deploy.sh --method bypass --dry-run
```

### 2. Health Checks
Automatic post-deployment health verification:
```bash
# Enabled by default, or customize:
./scripts/deployment/unified-deploy.sh --method standard --bypass-healthcheck
```

### 3. Verbose Debugging
Enhanced debugging output:
```bash
./scripts/deployment/unified-deploy.sh --method api --verbose --troubleshoot
```

### 4. Flexible Configuration
Custom app names, regions, and configurations:
```bash
./scripts/deployment/unified-deploy.sh \
  --method standard \
  --app-name my-custom-app \
  --region iad \
  --dockerfile Dockerfile.production
```

### 5. Quick Scenarios
Predefined deployment scenarios:
```bash
./scripts/deployment/quick-deploy.sh hotfix     # Emergency deployment
./scripts/deployment/quick-deploy.sh new-app   # Create new app
./scripts/deployment/quick-deploy.sh rollback  # Emergency rollback
```

## 🔧 Configuration Changes

### Environment Variables
No changes required - all existing environment variables work:
- `FLY_API_TOKEN`
- Any variables from `.env` file
- Variables from `fly-auth-env.sh`

### Authentication
Authentication handling is improved but compatible:
- Still uses `setup-fly-auth.sh` and `test-fly-auth.sh`
- Automatic fallback to setup if not configured
- Better error messages and validation

### File Dependencies
All file dependencies are preserved:
- `fly.toml` - Fly configuration
- `Dockerfile.simple` - Default dockerfile
- `.env` - Environment variables
- `fly-auth-env.sh` - Authentication

## 🚨 Rollback Plan

If you need to rollback to legacy scripts:

1. **Immediate Rollback**
   ```bash
   # Use legacy scripts directly
   ./scripts/legacy/deploy.sh
   ./scripts/legacy/deploy-bypass.sh
   # etc.
   ```

2. **Restore Legacy Scripts**
   ```bash
   # Copy legacy scripts back to root
   cp scripts/legacy/deploy*.sh .
   ```

3. **Remove Unified System**
   ```bash
   # If needed (not recommended)
   rm -rf scripts/deployment/
   ```

## 🧪 Testing the Migration

### 1. Test Basic Deployment
```bash
# Test with dry run first
./scripts/deployment/quick-deploy.sh standard --dry-run

# Then real deployment
./scripts/deployment/quick-deploy.sh standard
```

### 2. Test All Methods
```bash
# Test each deployment method
for method in standard hotfix new-app troubleshoot; do
  echo "Testing $method..."
  ./scripts/deployment/quick-deploy.sh $method --dry-run
done
```

### 3. Test Backward Compatibility
```bash
# Test legacy wrapper
./deploy.sh --dry-run  # Should redirect to unified system
```

### 4. Verify Authentication
```bash
# Test authentication still works
./test-fly-auth.sh
```

## 📞 Support During Migration

### Getting Help
1. Check the troubleshooting section in [README.md](README.md)
2. Run deployments with `--troubleshoot` and `--verbose` flags
3. Fall back to legacy scripts if needed
4. Contact development team with specific error messages

### Common Migration Issues

**Issue: "Command not found"**
```bash
# Solution: Make sure scripts are executable
chmod +x scripts/deployment/*.sh
```

**Issue: "Authentication failed"**
```bash
# Solution: Re-run auth setup
./setup-fly-auth.sh
./test-fly-auth.sh
```

**Issue: "App not found"**
```bash
# Solution: Create new app or fix app name
./scripts/deployment/quick-deploy.sh new-app
```

## ✅ Verification Checklist

After migration, verify:

- [ ] Basic deployment works: `./scripts/deployment/quick-deploy.sh standard --dry-run`
- [ ] Emergency deployment works: `./scripts/deployment/quick-deploy.sh hotfix --dry-run`
- [ ] Authentication works: `./test-fly-auth.sh`
- [ ] Backward compatibility works: `./deploy.sh --dry-run`
- [ ] Team is trained on new commands
- [ ] CI/CD pipelines updated (if applicable)
- [ ] Documentation updated
- [ ] Legacy scripts backed up in `scripts/legacy/`

## 🎉 Benefits After Migration

1. **Consistency** - Single interface for all deployment methods
2. **Reliability** - Better error handling and fallback mechanisms
3. **Visibility** - Enhanced logging and debugging capabilities
4. **Safety** - Dry-run mode and health checks
5. **Maintainability** - Centralized deployment logic
6. **Flexibility** - Easy to add new deployment methods
7. **Documentation** - Comprehensive guides and examples

---

**Need help?** See [README.md](README.md) for detailed usage instructions.