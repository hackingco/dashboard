# Fly.io Quick Reference for Hive Mind Swarm

## Essential Commands

### App Management
```bash
# Create apps
fly apps create hive-dashboard
fly apps create hive-manager
fly apps create hive-workers

# Deploy apps
fly deploy -a hive-dashboard
fly deploy -a hive-manager --local-only
fly deploy -c fly.staging.toml -a app-staging

# Check app status
fly status -a hive-dashboard
fly apps list
```

### Secrets Management
```bash
# Set secrets
fly secrets set DATABASE_URL=postgres://... -a hive-manager
fly secrets set API_KEY=sk-123 JWT_SECRET=abc -a hive-dashboard

# List secrets (names only)
fly secrets list -a hive-dashboard

# Import from .env
fly secrets import < .env.production -a hive-manager
```

### Scaling
```bash
# Scale horizontally
fly scale count 3 -a hive-dashboard

# Scale vertically
fly scale vm shared-cpu-2x -a hive-manager

# Scale by region
fly scale count 2 --region iad -a hive-dashboard
fly scale count 1 --region lhr -a hive-dashboard
```

### Volumes
```bash
# Create volume
fly volumes create data --size 10 --region iad -a hive-manager

# Create multiple volumes
fly volumes create worker_data --count 5 --size 5 --region iad -a hive-workers

# List volumes
fly volumes list -a hive-manager
```

### Monitoring
```bash
# View logs
fly logs -a hive-dashboard

# SSH into machine
fly ssh console -a hive-manager

# List machines
fly machines list -a hive-workers
```

## Key API Endpoints

### Machines API
- Base URL: `https://api.machines.dev/v1`
- Auth: `Authorization: Bearer ${FLY_API_TOKEN}`

### Create Machine
```bash
POST /apps/{app_name}/machines
{
  "config": {
    "image": "registry.fly.io/my-app:latest",
    "guest": {
      "cpu_kind": "shared",
      "cpus": 1,
      "memory_mb": 512
    },
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

### List Machines
```bash
GET /apps/{app_name}/machines
```

### Stop/Start Machine
```bash
POST /apps/{app_name}/machines/{machine_id}/stop
POST /apps/{app_name}/machines/{machine_id}/start
```

## Internal Networking

### DNS Names
- Dashboard: `hive-dashboard.internal`
- Manager: `hive-manager.internal`
- Workers: `hive-worker-{id}.internal`

### Regional Access
- `iad.hive-manager.internal` (specific region)
- `regions.hive-manager.internal` (list all regions)

### Service Binding
```javascript
// Bind to private network
server.listen(8080, 'fly-local-6pn');
// or
server.listen(8080, '::');
```

## fly.toml Templates

### Dashboard (Public)
```toml
app = "hive-dashboard"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[[services]]
  internal_port = 3000
  protocol = "tcp"
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### Manager (Internal)
```toml
app = "hive-manager"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"
  # No ports = internal only

[[mounts]]
  source = "data"
  destination = "/data"
```

### Worker (Dynamic)
```toml
app = "hive-worker"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile.worker"

[env]
  NODE_ENV = "production"

# No services - created dynamically
```

## Deployment Checklist

1. ✅ Create Fly apps
2. ✅ Set all required secrets
3. ✅ Create volumes if needed
4. ✅ Build Docker images
5. ✅ Deploy manager first (internal services)
6. ✅ Deploy dashboard
7. ✅ Test internal connectivity
8. ✅ Scale as needed
9. ✅ Monitor logs and metrics

## Common Issues & Solutions

### Issue: Can't connect to internal service
```bash
# Check if service is running
fly status -a hive-manager

# Verify internal DNS
fly ssh console -a hive-dashboard
> nslookup hive-manager.internal
```

### Issue: Volume not mounting
```bash
# Verify volume exists
fly volumes list -a hive-manager

# Check mount in fly.toml matches volume name
```

### Issue: Secrets not available
```bash
# Redeploy after setting secrets
fly deploy -a hive-manager

# Or trigger manual restart
fly apps restart hive-manager
```

## Support Resources
- Fly.io Status: https://status.fly.io
- Community: https://community.fly.io
- Docs: https://fly.io/docs
- Machines API Ref: https://docs.machines.dev