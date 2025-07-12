# Fly.io API Research and Deployment Patterns

## Table of Contents
1. [Fly Machines API](#fly-machines-api)
2. [Multi-App Orchestration](#multi-app-orchestration)
3. [Fly.toml Configuration](#flytoml-configuration)
4. [Private Networking](#private-networking)
5. [Scaling Patterns](#scaling-patterns)
6. [Volume Management](#volume-management)
7. [Secrets Management](#secrets-management)
8. [API Integration Examples](#api-integration-examples)

---

## Research Notes

This document contains comprehensive research on Fly.io's APIs and deployment patterns for the Hive Mind Swarm system.

---

## Fly Machines API

The Fly Machines REST API provides comprehensive control over Fly.io infrastructure through a simple and fast REST interface.

### API Endpoint
- Base URL: `https://api.machines.dev`
- Authentication: Bearer token via `FLY_API_TOKEN`

### Core Resources

#### 1. Apps Resource
- Create and manage Fly Apps to group and administer Machines
- App names must be unique across the platform
- Apps provide namespace and grouping for related Machines

**Example: Create App**
```bash
curl -i -X POST \
  -H "Authorization: Bearer ${FLY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "${FLY_API_HOSTNAME}/v1/apps" \
  -d '{
    "app_name": "hive-mind-dashboard",
    "org_slug": "personal",
    "network": "hive-internal"
  }'
```

#### 2. Machines Resource
- Full lifecycle control over individual Machines
- Configure CPU, memory, and other resources
- Control region placement
- Support for services configuration (HTTP/TCP)

**Example: List Machines**
```bash
curl -i -X GET \
  -H "Authorization: Bearer ${FLY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "${FLY_API_HOSTNAME}/v1/apps/my-app-name/machines"
```

#### 3. Volumes Resource
- Create and manage persistent storage
- Attach volumes to Machines for data persistence
- Support for volume snapshots and resizing

#### 4. Tokens Resource
- Request OpenID Connect tokens from 3rd-party providers
- Useful for integration with external services

### Key Features
- **Fast Boot Times**: Machines launch in milliseconds
- **Region Control**: Deploy to specific regions worldwide
- **Resource Configuration**: Fine-grained control over CPU/memory
- **Network Services**: Configure HTTP/TCP services with Fly Proxy
- **Skip Launch**: Create Machines without immediately booting

### Important Considerations
- All requests should include retry logic for resilience
- Machines must be associated with a Fly App
- The API provides low-level control - you manage orchestration

---

## Multi-App Orchestration

### Deployment Patterns

#### 1. Monorepo Support
Fly.io supports deploying multiple apps from a single repository:
- Use `fly deploy <path>` to specify app source directory
- Maintain separate fly.toml files for each app
- Deploy to specific apps with `fly deploy -a <app-name>`

#### 2. Process Groups
Run multiple processes within a single app using process groups:

```toml
[processes]
web = "/app/server"
worker = "/app/worker"
scheduler = "/app/scheduler"

[[services]]
processes = ["web"]
internal_port = 8080
protocol = "tcp"
```

#### 3. Multi-Environment Strategy
- Create separate Fly apps for staging/production
- Use consistent naming: `app-staging`, `app-production`
- Override app name during deployment: `fly deploy -a app-staging`

### Hive Mind Specific Architecture

For the Hive Mind Swarm system, we recommend:

1. **Dashboard App** (`hive-mind-dashboard`)
   - Web UI for monitoring and control
   - Stateless, can scale horizontally
   - Public-facing with authentication

2. **Manager App** (`hive-mind-manager`)
   - Orchestration and coordination
   - Manages worker lifecycle
   - API endpoints for dashboard

3. **Worker Apps** (`hive-mind-worker-N`)
   - Dynamic creation via Machines API
   - Task execution environments
   - Auto-scaling based on demand

---

## Fly.toml Configuration

### Basic Structure

```toml
app = "hive-mind-dashboard"
primary_region = "iad"
kill_signal = "SIGTERM"
kill_timeout = "5s"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[experimental]
  auto_rollback = true

[[services]]
  protocol = "tcp"
  internal_port = 8080
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "2s"
    grace_period = "1s"
    restart_limit = 0

[[mounts]]
  source = "data"
  destination = "/data"
```

### Deployment Strategies

```toml
[deploy]
  strategy = "rolling"  # or "immediate", "canary"
  max_unavailable = 0.33
  wait_timeout = "5m"
```

### Machine Configuration

```toml
[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### Environment-Specific Configs

For different environments, maintain separate fly.toml files:
- `fly.toml` (production)
- `fly.staging.toml`
- `fly.dev.toml`

Deploy with: `fly deploy -c fly.staging.toml -a app-staging`

---

## Private Networking

Fly.io's 6PN (IPv6 Private Networking) provides automatic, secure communication between apps in the same organization.

### Key Features

#### Automatic Setup
- No configuration required - enabled by default
- Every Machine gets a private IPv6 address (6PN address)
- Accessible via `fly-local-6pn` hostname or `FLY_PRIVATE_IP` env var

#### Internal DNS
- Apps accessible via `.internal` domain
- Format: `app-name.internal` resolves to all running Machines
- Regional queries: `region.app-name.internal` (e.g., `iad.hive-manager.internal`)
- Discover sibling apps: `_apps.internal` TXT record

#### Service Binding
To expose services on private network:
```javascript
// Bind to 6PN address
server.listen(PORT, 'fly-local-6pn');

// Or bind to IPv6 wildcard
server.listen(PORT, '::');
```

### Hive Mind Network Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  hive-dashboard     │     │   hive-manager      │
│  Public facing      │────▶│  Internal only      │
│  dashboard.internal │ 6PN │  manager.internal   │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │  hive-worker-1-N    │
                            │  worker-N.internal  │
                            └─────────────────────┘
```

### Example Inter-Service Communication

```javascript
// Dashboard calling Manager API
const managerUrl = 'http://hive-manager.internal:8080/api/workers';
const response = await fetch(managerUrl);

// Manager spawning workers
const workerUrl = `http://hive-worker-${id}.internal:8080/execute`;
```

### Custom Private Networks
- Create isolated networks within organization
- Useful for multi-tenant scenarios
- Specify network during app creation:
  ```bash
  fly apps create --network tenant-1-network
  ```

### External Access via WireGuard
- Connect development machines to 6PN
- Generate config: `fly wireguard create`
- Access internal services from local development

---

## Scaling Patterns

### Autoscaling Approaches

#### 1. Fly Proxy Autostop/Autostart
- Machines stop when idle, start on request
- Zero to hero in ~300ms
- Perfect for bursty workloads
- Configure in fly.toml:
  ```toml
  [services.concurrency]
    type = "connections"
    soft_limit = 20
    hard_limit = 25
  
  [[services.tcp_checks]]
    grace_period = "10s"
  ```

#### 2. Metrics-Based Autoscaler
- Scale based on CPU, memory, custom metrics
- Deploy autoscaler as separate app
- Supports creation/deletion of Machines
- Example configuration:
  ```javascript
  {
    "metric": "cpu",
    "target": 70,
    "min_machines": 2,
    "max_machines": 10,
    "scale_up_threshold": 80,
    "scale_down_threshold": 50
  }
  ```

### Hive Mind Scaling Strategy

#### Dashboard Scaling
- Horizontal scaling based on concurrent users
- Stateless design enables easy scaling
- Use Fly Proxy autostop for cost efficiency

#### Manager Scaling
- Generally single instance (coordination point)
- Can implement active/standby for HA
- Scale vertically for more workers

#### Worker Scaling
- Dynamic creation via Machines API
- Scale based on queue depth
- Pre-warm pool for faster response
- Implement task-based scaling:
  ```javascript
  async function scaleWorkers(taskCount) {
    const workersNeeded = Math.ceil(taskCount / TASKS_PER_WORKER);
    const currentWorkers = await getActiveWorkers();
    
    if (workersNeeded > currentWorkers) {
      await spawnWorkers(workersNeeded - currentWorkers);
    } else if (workersNeeded < currentWorkers) {
      await stopWorkers(currentWorkers - workersNeeded);
    }
  }
  ```

### Scaling Commands

```bash
# Manual scaling
fly scale count 3 -a hive-dashboard

# Scale by region
fly scale count 2 --region iad -a hive-dashboard
fly scale count 1 --region lhr -a hive-dashboard

# Scale machine size
fly scale vm shared-cpu-2x -a hive-manager
```

---

## Volume Management

### Volume Basics

Fly Volumes are local NVMe storage attached to Machines:
- One-to-one mapping: 1 Machine = 1 Volume
- Local to physical server (not network storage)
- No automatic replication between volumes
- Persistent across deployments and restarts

### Creating Volumes

```bash
# Create single volume
fly volumes create hive_data --size 10 --region iad

# Create multiple volumes for scaling
fly volumes create hive_data --count 3 --size 10 --region iad
```

### Mounting in fly.toml

```toml
[[mounts]]
  source = "hive_data"
  destination = "/data"
```

### Volume Strategies for Hive Mind

#### 1. Dashboard (Stateless)
- No volumes needed
- Use external storage (S3/Tigris) for assets

#### 2. Manager (Coordination State)
- Single volume for task queue persistence
- Regular snapshots for backup
- Consider PostgreSQL for complex state

#### 3. Workers (Task Data)
- Ephemeral volumes for task execution
- Clean up after task completion
- Example volume lifecycle:
  ```javascript
  async function createWorkerWithVolume(workerId) {
    // Create volume
    const volume = await fly.volumes.create({
      name: `worker-${workerId}-data`,
      size_gb: 5,
      region: 'iad'
    });
    
    // Create machine with volume
    const machine = await fly.machines.create({
      name: `hive-worker-${workerId}`,
      config: {
        mounts: [{
          volume: volume.id,
          path: '/workspace'
        }]
      }
    });
    
    return { machine, volume };
  }
  ```

### Volume Limitations & Solutions

#### Challenge: Volumes don't scale automatically
**Solution**: Pre-create volume pools
```bash
# Create volume pool for workers
for i in {1..10}; do
  fly volumes create worker_pool --size 5 --region iad
done
```

#### Challenge: No cross-region replication
**Solution**: Use Tigris for distributed storage
```javascript
// Use Tigris S3-compatible storage for shared data
const { S3Client } = require('@aws-sdk/client-s3');
const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://fly.storage.tigris.dev',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
```

### Volume Snapshots

```bash
# Create snapshot
fly volumes snapshots create vol_abc123

# List snapshots
fly volumes snapshots list vol_abc123
```

---

## Secrets Management

Fly.io provides secure secrets management through an encrypted vault system.

### Security Architecture
- **Encrypted Vault**: All secrets stored in encrypted vault
- **Write-Only API**: API servers can only encrypt, not decrypt
- **Runtime Injection**: Secrets decrypted only at Machine runtime
- **No Logging**: Secret values never logged
- **No Plaintext Access**: Cannot read secret values via API/CLI

### Setting Secrets

```bash
# Set single secret
fly secrets set DATABASE_URL=postgresql://user:pass@host/db

# Set multiple secrets
fly secrets set \
  REDIS_URL=redis://localhost:6379 \
  API_KEY=sk-1234567890 \
  JWT_SECRET=supersecret

# Stage secrets (update vault without deploying)
fly secrets set --stage NEW_SECRET=value

# Deploy staged secrets
fly deploy
```

### Managing Secrets

```bash
# List secrets (names only, no values)
fly secrets list

# Remove secret
fly secrets unset API_KEY

# Import from .env file
fly secrets import < .env.production
```

### Hive Mind Secrets Strategy

#### Dashboard Secrets
```bash
fly secrets set -a hive-dashboard \
  NEXTAUTH_SECRET=generated-secret \
  DATABASE_URL=postgres://internal-connection \
  MANAGER_API_URL=http://hive-manager.internal:8080 \
  SESSION_SECRET=random-session-key
```

#### Manager Secrets
```bash
fly secrets set -a hive-manager \
  FLY_API_TOKEN=your-fly-api-token \
  POSTGRES_URL=postgres://connection-string \
  WORKER_IMAGE=registry.fly.io/hive-worker:latest \
  ENCRYPTION_KEY=32-byte-key
```

#### Worker Secrets
```bash
# Set base secrets for worker template
fly secrets set -a hive-worker-template \
  TASK_TIMEOUT_MS=300000 \
  MANAGER_URL=http://hive-manager.internal:8080 \
  LOG_LEVEL=info
```

### Access Patterns

```javascript
// Secrets available as env vars at runtime
const config = {
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
  },
  auth: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d'
  },
  flyApi: {
    token: process.env.FLY_API_TOKEN,
    endpoint: 'https://api.machines.dev'
  }
};
```

### Build vs Runtime
- Secrets NOT available during Docker build
- Use build args for build-time config:
  ```dockerfile
  ARG NODE_ENV=production
  RUN npm ci --only=${NODE_ENV}
  ```

### Secret Rotation

```javascript
// Implement graceful secret rotation
async function rotateSecret(secretName: string) {
  // 1. Set new secret with temporary name
  await exec(`fly secrets set ${secretName}_NEW=${newValue}`);
  
  // 2. Update app to check both secrets
  // 3. Deploy with dual secret support
  // 4. Update to use new secret only
  // 5. Remove old secret
  await exec(`fly secrets unset ${secretName}_OLD`);
}
```

---

## API Integration Examples

### TypeScript SDK for Fly Machines API

```typescript
// fly-api-client.ts
import axios, { AxiosInstance } from 'axios';

export interface MachineConfig {
  image: string;
  guest: {
    cpu_kind: 'shared' | 'performance';
    cpus: number;
    memory_mb: number;
  };
  env?: Record<string, string>;
  services?: Service[];
  mounts?: Mount[];
  restart?: {
    policy: 'always' | 'on-failure' | 'no';
  };
}

export interface Service {
  protocol: 'tcp' | 'udp';
  internal_port: number;
  ports: Port[];
  concurrency?: {
    type: 'connections' | 'requests';
    soft_limit: number;
    hard_limit: number;
  };
}

export interface Port {
  port: number;
  handlers: ('http' | 'tls' | 'proxy_proto')[];
}

export interface Mount {
  volume: string;
  path: string;
}

export class FlyMachinesClient {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: 'https://api.machines.dev/v1',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Create new app
  async createApp(name: string, org: string = 'personal') {
    const response = await this.client.post('/apps', {
      app_name: name,
      org_slug: org
    });
    return response.data;
  }

  // List machines in app
  async listMachines(appName: string) {
    const response = await this.client.get(`/apps/${appName}/machines`);
    return response.data;
  }

  // Create machine
  async createMachine(appName: string, config: MachineConfig, region?: string) {
    const payload = {
      config,
      region: region || 'iad',
      name: `${appName}-${Date.now()}`
    };
    
    const response = await this.client.post(
      `/apps/${appName}/machines`,
      payload
    );
    return response.data;
  }

  // Start machine
  async startMachine(appName: string, machineId: string) {
    const response = await this.client.post(
      `/apps/${appName}/machines/${machineId}/start`
    );
    return response.data;
  }

  // Stop machine
  async stopMachine(appName: string, machineId: string) {
    const response = await this.client.post(
      `/apps/${appName}/machines/${machineId}/stop`
    );
    return response.data;
  }

  // Update machine
  async updateMachine(appName: string, machineId: string, config: Partial<MachineConfig>) {
    const response = await this.client.post(
      `/apps/${appName}/machines/${machineId}`,
      { config }
    );
    return response.data;
  }

  // Delete machine
  async deleteMachine(appName: string, machineId: string) {
    const response = await this.client.delete(
      `/apps/${appName}/machines/${machineId}`
    );
    return response.data;
  }

  // Wait for machine state
  async waitForState(appName: string, machineId: string, state: string, timeout: number = 60) {
    const response = await this.client.get(
      `/apps/${appName}/machines/${machineId}/wait`,
      {
        params: { state, timeout }
      }
    );
    return response.data;
  }
}
```

### Hive Mind Manager Integration

```typescript
// hive-manager/src/lib/fly-integration.ts
import { FlyMachinesClient, MachineConfig } from './fly-api-client';

export class HiveWorkerManager {
  private fly: FlyMachinesClient;
  private workerImage: string;
  private workerPool: Map<string, WorkerInfo> = new Map();

  constructor(token: string, workerImage: string) {
    this.fly = new FlyMachinesClient(token);
    this.workerImage = workerImage;
  }

  async spawnWorker(taskId: string, taskType: string): Promise<string> {
    const config: MachineConfig = {
      image: this.workerImage,
      guest: {
        cpu_kind: 'shared',
        cpus: taskType === 'heavy' ? 2 : 1,
        memory_mb: taskType === 'heavy' ? 2048 : 512
      },
      env: {
        TASK_ID: taskId,
        TASK_TYPE: taskType,
        MANAGER_URL: 'http://hive-manager.internal:8080',
        NODE_ENV: 'production'
      },
      services: [{
        protocol: 'tcp',
        internal_port: 8080,
        ports: []  // No public ports, internal only
      }],
      restart: {
        policy: 'no'  // One-shot tasks
      }
    };

    const machine = await this.fly.createMachine('hive-workers', config);
    
    this.workerPool.set(machine.id, {
      machineId: machine.id,
      taskId,
      status: 'starting',
      createdAt: new Date()
    });

    // Wait for worker to be ready
    await this.fly.waitForState('hive-workers', machine.id, 'started');
    
    return machine.id;
  }

  async scaleWorkers(count: number) {
    const currentWorkers = this.workerPool.size;
    
    if (count > currentWorkers) {
      // Spawn new workers
      const promises = [];
      for (let i = 0; i < count - currentWorkers; i++) {
        promises.push(this.spawnWorker(`pool-${Date.now()}-${i}`, 'standard'));
      }
      await Promise.all(promises);
    } else if (count < currentWorkers) {
      // Stop excess workers
      const toStop = Array.from(this.workerPool.values())
        .filter(w => w.status === 'idle')
        .slice(0, currentWorkers - count);
      
      for (const worker of toStop) {
        await this.stopWorker(worker.machineId);
      }
    }
  }

  async stopWorker(machineId: string) {
    await this.fly.stopMachine('hive-workers', machineId);
    await this.fly.deleteMachine('hive-workers', machineId);
    this.workerPool.delete(machineId);
  }

  async getWorkerStatus(machineId: string) {
    const machines = await this.fly.listMachines('hive-workers');
    return machines.find((m: any) => m.id === machineId);
  }
}

interface WorkerInfo {
  machineId: string;
  taskId: string;
  status: 'starting' | 'running' | 'idle' | 'stopping';
  createdAt: Date;
}
```

### Dashboard Integration

```typescript
// hive-dashboard/src/lib/api-client.ts
export class HiveApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async getSwarmStatus() {
    const response = await fetch(`${this.baseUrl}/swarm/status`);
    return response.json();
  }

  async spawnWorkers(count: number, taskType: string) {
    const response = await fetch(`${this.baseUrl}/workers/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, taskType })
    });
    return response.json();
  }

  async executeTask(task: TaskRequest) {
    const response = await fetch(`${this.baseUrl}/tasks/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    return response.json();
  }

  async getWorkerMetrics() {
    const response = await fetch(`${this.baseUrl}/metrics/workers`);
    return response.json();
  }
}

interface TaskRequest {
  type: string;
  payload: any;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}
```

### Complete Deployment Script

```typescript
// scripts/deploy-hive-mind.ts
import { FlyMachinesClient } from '../lib/fly-api-client';
import { execSync } from 'child_process';

async function deployHiveMind() {
  const fly = new FlyMachinesClient(process.env.FLY_API_TOKEN!);
  
  console.log('🚀 Deploying Hive Mind Swarm System...');
  
  // 1. Create apps
  console.log('📱 Creating Fly apps...');
  await fly.createApp('hive-dashboard');
  await fly.createApp('hive-manager');
  await fly.createApp('hive-workers');
  
  // 2. Set secrets
  console.log('🔐 Setting secrets...');
  execSync('fly secrets set -a hive-dashboard NEXTAUTH_SECRET=... DATABASE_URL=...');
  execSync('fly secrets set -a hive-manager FLY_API_TOKEN=... POSTGRES_URL=...');
  
  // 3. Create volumes
  console.log('💾 Creating volumes...');
  execSync('fly volumes create data --size 10 --region iad -a hive-manager');
  
  // 4. Deploy apps
  console.log('🚢 Deploying applications...');
  execSync('fly deploy --local-only -a hive-dashboard -c apps/dashboard/fly.toml');
  execSync('fly deploy --local-only -a hive-manager -c apps/manager/fly.toml');
  
  // 5. Scale dashboard
  console.log('📈 Scaling dashboard...');
  execSync('fly scale count 2 -a hive-dashboard');
  
  console.log('✅ Hive Mind deployed successfully!');
  console.log('🌐 Dashboard: https://hive-dashboard.fly.dev');
  console.log('🔧 Manager API: https://hive-manager.internal:8080 (internal only)');
}

deployHiveMind().catch(console.error);
```

## Summary

This research provides comprehensive coverage of:
1. **Fly Machines API** - Full programmatic control
2. **Multi-App Orchestration** - Deployment patterns for complex systems
3. **Fly.toml Configuration** - Detailed configuration options
4. **Private Networking (6PN)** - Secure inter-service communication
5. **Scaling Patterns** - Auto-scaling and manual scaling strategies
6. **Volume Management** - Persistent storage with limitations and solutions
7. **Secrets Management** - Secure configuration and credentials
8. **API Integration** - TypeScript SDK and implementation examples

The Hive Mind Swarm system can leverage these capabilities for a robust, scalable deployment on Fly.io.
