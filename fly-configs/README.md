# Hive Mind Fly.io Deployment Configuration

This directory contains all the configuration files needed to deploy the Hive Mind swarm system to Fly.io.

## 📁 Directory Structure

```
fly-configs/
├── dashboard/
│   ├── fly.toml          # Dashboard app configuration
│   └── Dockerfile        # Multi-stage build for Next.js
├── manager/
│   ├── fly.toml          # Manager API configuration
│   └── Dockerfile        # Multi-stage build for Node.js API
├── worker/
│   ├── fly.toml          # Worker template configuration
│   └── Dockerfile        # Multi-stage build for workers
├── deploy-dashboard.sh   # Deploy dashboard individually
├── deploy-manager.sh     # Deploy manager API individually
├── deploy-worker.sh      # Deploy worker instances
├── deploy-all.sh         # Deploy entire system
├── manage-secrets.sh     # Secrets management utility
└── secrets-config.yml    # Secrets documentation
```

## 🚀 Quick Start

1. **Prerequisites**
   - Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
   - Login to Fly: `fly auth login`
   - Have your Supabase and API credentials ready

2. **Deploy Everything**
   ```bash
   cd fly-configs
   ./deploy-all.sh
   ```

3. **Access Your Apps**
   - Dashboard: https://dashboard-app.fly.dev
   - Manager API: https://manager-app.fly.dev
   - Health Check: https://manager-app.fly.dev/health

## 🔐 Secrets Management

### Required Secrets

**Manager App:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (full access)
- `FLY_API_TOKEN` - Fly.io API token for managing machines

**Dashboard App:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key (public)

### Setting Secrets

Interactive mode:
```bash
./manage-secrets.sh
```

Command line:
```bash
./manage-secrets.sh set manager-app SUPABASE_URL "https://xxx.supabase.co"
```

Import from .env:
```bash
./manage-secrets.sh import manager-app .env.production
```

## 🏗️ Architecture

### Network Topology
- All apps communicate via Fly's private network (`.internal` domains)
- Dashboard → Manager: via public HTTPS
- Manager → Workers: via private network
- Workers → Manager: via private network

### Scaling Configuration
- **Dashboard**: 1-3 instances, auto-stop enabled
- **Manager**: 2+ instances, always running
- **Workers**: 0-10 instances per type, auto-scale

### Persistent Storage
- **Manager**: 5GB volume at `/data`
- **Dashboard**: 1GB volume at `/data`
- **Workers**: 1GB volume per instance at `/data`

## 🛠️ Individual Deployments

### Deploy Manager Only
```bash
cd ../apps/manager
cp ../../fly-configs/manager/* .
../../fly-configs/deploy-manager.sh
```

### Deploy Dashboard Only
```bash
cd ../apps/dashboard
cp ../../fly-configs/dashboard/* .
../../fly-configs/deploy-dashboard.sh
```

### Deploy New Worker Type
```bash
cd ../apps/worker
cp ../../fly-configs/worker/* .
../../fly-configs/deploy-worker.sh "ml-processor" "machine-learning" 3
```

## 📊 Monitoring

### View Logs
```bash
fly logs -a manager-app
fly logs -a dashboard-app
fly logs -a worker-sample-xxxxx
```

### Check Status
```bash
fly status -a manager-app
fly status -a dashboard-app
```

### SSH Access
```bash
fly ssh console -a manager-app
fly ssh console -a dashboard-app
```

## 🔧 Configuration Details

### Dashboard Configuration
- **Port**: 3000
- **Framework**: Next.js with standalone output
- **Build**: Multi-stage Docker with caching
- **Health Check**: `/api/health`
- **Auto-scaling**: 1-3 instances based on traffic

### Manager Configuration
- **Port**: 8080
- **Framework**: Express.js with TypeScript
- **Build**: Multi-stage Docker with production deps only
- **Health Check**: `/health`
- **Metrics**: Prometheus endpoint at `:9090/metrics`
- **Always On**: Minimum 2 instances

### Worker Configuration
- **Port**: 3000
- **Framework**: Flexible (Node.js/TypeScript)
- **Build**: Multi-stage with dynamic command
- **Health Check**: `/health`
- **Auto-scaling**: 0-10 instances based on load
- **Registration**: Auto-registers with manager on startup

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Docker build logs: `fly deploy --local-only`
   - Ensure all dependencies are in package.json

2. **Secret Errors**
   - List secrets: `fly secrets list -a <app-name>`
   - Check required secrets in `secrets-config.yml`

3. **Network Issues**
   - Verify internal DNS: `fly ssh console -a <app> -C "nslookup manager-app.internal"`
   - Check firewall rules in fly.toml

4. **Volume Issues**
   - List volumes: `fly volumes list -a <app-name>`
   - Create missing volumes: `fly volumes create <name> --size 1 -a <app>`

### Debug Commands
```bash
# Check recent deployments
fly releases -a manager-app

# Monitor real-time logs
fly logs -a manager-app --tail

# Check machine status
fly machine list -a manager-app

# Test internal connectivity
fly ssh console -a dashboard-app -C "curl http://manager-app.internal:8080/health"
```

## 📈 Performance Optimization

1. **Use Rolling Deployments**
   - Configured by default in scripts
   - Zero-downtime updates

2. **Enable Metrics**
   - Prometheus endpoints configured
   - Use Grafana for visualization

3. **Optimize Images**
   - Multi-stage builds reduce size
   - Only production dependencies included
   - Alpine Linux for minimal footprint

4. **Scale Appropriately**
   - Start small, scale based on metrics
   - Use auto-scaling for workers
   - Keep manager redundant (2+ instances)

## 🔄 Updates and Maintenance

### Update Configuration
1. Edit fly.toml files in this directory
2. Copy to app directory
3. Run deployment script

### Update Code
1. Make changes in app directory
2. Run deployment script (picks up changes)

### Update Secrets
```bash
./manage-secrets.sh set <app> <key> <new-value>
```

### Rollback
```bash
fly deploy -a <app-name> --image <previous-image>
```

## 📞 Support

- Fly.io Status: https://status.flyio.net/
- Fly.io Community: https://community.fly.io/
- Fly.io Docs: https://fly.io/docs/