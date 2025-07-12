# 🚀 Swarm Management System - Fly.io Deployment

## Quick Start

### 1. Prerequisites
- Fly.io account (sign up at https://fly.io)
- Fly CLI installed and authenticated

### 2. Install Fly CLI (if needed)
```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
fly auth login
```

### 3. Deploy Everything
```bash
# Option A: Quick automated deployment
chmod +x quick-deploy.sh
./quick-deploy.sh

# Option B: Complete deployment with CLI installation
chmod +x install-and-deploy.sh
./install-and-deploy.sh

# Option C: Manual step-by-step (see DEPLOYMENT_MANUAL.md)
```

### 4. Check Status
```bash
chmod +x check-deployment-status.sh
./check-deployment-status.sh
```

## Service URLs (after deployment)

- **🎯 Manager API**: https://swarm-manager.fly.dev
- **🎨 Dashboard**: https://swarm-admin.fly.dev  
- **🔴 Redis**: redis://swarm-redis.internal:6379

## Test Deployment

```bash
# Test API health
curl https://swarm-manager.fly.dev/health

# Test dashboard
open https://swarm-admin.fly.dev

# View logs
fly logs --app swarm-manager
fly logs --app swarm-admin
```

## Files Created for Deployment

- `quick-deploy.sh` - Automated deployment script
- `install-and-deploy.sh` - Install CLI and deploy
- `check-deployment-status.sh` - Status checker
- `DEPLOYMENT_MANUAL.md` - Manual step-by-step guide
- `DEPLOYMENT_FINAL_REPORT.md` - Complete deployment documentation
- `apps/manager/Dockerfile.standalone` - Fixed manager deployment
- `apps/manager/package.standalone.json` - Dependencies without workspace refs

## Troubleshooting

1. **Services not responding**: Check logs with `fly logs --app [app-name]`
2. **Dependencies issues**: Ensure shared packages are built with `pnpm run build`
3. **Redis connection**: Verify Redis app is running with `fly status --app swarm-redis`
4. **Authentication**: Run `fly auth login` if getting auth errors

## Support

- See `DEPLOYMENT_MANUAL.md` for detailed instructions
- See `DEPLOYMENT_FINAL_REPORT.md` for complete documentation
- Run `./check-deployment-status.sh` for current status

---

**Ready to deploy!** 🎉