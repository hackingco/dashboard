import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import { Swarm, Worker } from '@swarm/types';
import { trustGraphService } from './trustgraph/trustgraph.service';
import { langfuseService } from './observability/langfuse.service';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export class FlyService {
  private flyApiToken: string;
  private flyApiUrl: string = 'https://api.machines.dev/v1';

  constructor() {
    this.flyApiToken = process.env.FLY_ACCESS_TOKEN || process.env.FLY_API_TOKEN || '';
    if (!this.flyApiToken) {
      logger.warn('FLY_ACCESS_TOKEN/FLY_API_TOKEN not set - Fly.io operations will fail');
    }
  }

  private async flyApiRequest(method: string, path: string, body?: any) {
    const response = await fetch(`${this.flyApiUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.flyApiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fly API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async createApp(appName: string, org = 'personal'): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync(
        `fly apps create ${appName} --org ${org}`,
        { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
      );
      logger.info(`Created Fly app: ${appName}`, { stdout, stderr });
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        logger.info(`App ${appName} already exists`);
      } else {
        throw error;
      }
    }
  }

  async createMachine(appName: string, config: any): Promise<any> {
    const correlationId = uuidv4();
    const traceId = langfuseService.startTrace(`create-machine-${appName}`, {
      app_name: appName,
      swarm_id: config.swarmId,
      correlation_id: correlationId
    });
    
    try {
      // Validate required configuration
      if (!config.swarmId) {
        throw new Error('swarmId is required for machine creation');
      }

      // Validate Fly API token
      if (!this.flyApiToken) {
        throw new Error('FLY_ACCESS_TOKEN/FLY_API_TOKEN is not configured');
      }

      // Create machine configuration
      const machineConfig = {
        name: `${appName}-worker`,
        region: config.region || 'dfw',
        config: {
          image: config.dockerImage || 'flyio/hellofly:latest',
          env: {
            NODE_ENV: 'production',
            WORKER_TYPE: config.workerType || 'general',
            SWARM_ID: config.swarmId,
            REDIS_URL: process.env.REDIS_URL || '',
            // Add observability env vars with fallback to process.env
            LANGFUSE_SECRET_KEY: config.env?.LANGFUSE_SECRET_KEY || process.env.LANGFUSE_SECRET_KEY || '',
            LANGFUSE_PUBLIC_KEY: config.env?.LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY || '',
            LANGFUSE_HOST: config.env?.LANGFUSE_HOST || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
            TRUSTGRAPH_API_KEY: config.env?.TRUSTGRAPH_API_KEY || process.env.TRUSTGRAPH_API_KEY || '',
            TRUSTGRAPH_API_URL: config.env?.TRUSTGRAPH_API_URL || process.env.TRUSTGRAPH_API_URL || '',
            // Supabase connection for workers
            SUPABASE_URL: process.env.SUPABASE_URL || '',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            // Add any custom env vars (these override defaults)
            ...config.env,
          },
          services: [
            {
              ports: [
                {
                  port: 80,
                  handlers: ['http'],
                },
                {
                  port: 443,
                  handlers: ['tls', 'http'],
                },
              ],
              protocol: 'tcp',
              internal_port: 3000,
            },
          ],
          guest: {
            cpu_kind: 'shared',
            cpus: config.cpus || 1,
            memory_mb: config.memory || 256,
          },
        },
      };

      // Create the machine
      const machine = await this.flyApiRequest('POST', `/apps/${appName}/machines`, machineConfig) as any;
      logger.info(`Created machine for app: ${appName}`, { 
        machineId: machine.id,
        region: machine.region,
        state: machine.state,
        cpus: config.cpus,
        memory: config.memory
      });
      
      // Create TrustGraph node for the new machine
      await trustGraphService.createNode({
        id: `machine-${machine.id}`,
        type: 'machine',
        label: `Machine: ${machine.id}`,
        metadata: {
          app_name: appName,
          swarm_id: config.swarmId,
          correlation_id: correlationId,
          region: machine.region,
          state: machine.state,
          cpus: config.cpus || 1,
          memory: config.memory || 256
        }
      });
      
      // Track successful machine creation
      await langfuseService.trackGeneration(
        traceId,
        'fly-machine-create',
        JSON.stringify(machineConfig),
        JSON.stringify(machine),
        { input: 100, output: 50 }, // Estimate tokens
        performance.now(),
        {
          machine_id: machine.id,
          app_name: appName,
          swarm_id: config.swarmId
        }
      );
      
      // Wait for machine to be ready with health check polling
      await this.waitForMachineReady(appName, machine.id);
      
      await langfuseService.endTrace(traceId, {
        status: 'success',
        machine_id: machine.id
      });
      
      // Return machine details with additional metadata
      return {
        id: machine.id,
        state: machine.state,
        region: machine.region,
        instance_id: machine.instance_id,
        private_ip: machine.private_ip,
        created_at: machine.created_at,
        config: {
          cpus: config.cpus || 1,
          memory: config.memory || 256,
          image: config.dockerImage || 'flyio/hellofly:latest',
        }
      };
    } catch (error) {
      logger.error('Failed to create machine', { appName, error });
      await langfuseService.endTrace(traceId, {
        status: 'error',
        error: (error as Error).message
      });
      throw error;
    }
  }

  async deployApp(appName: string, config: any): Promise<any> {
    try {
      // Use the Machines API to create a machine
      const machine = await this.createMachine(appName, config);
      logger.info(`Deployed app: ${appName} using Machines API`);
      return machine;
    } catch (error) {
      logger.error('Failed to deploy app', { appName, error });
      throw error;
    }
  }

  async scaleApp(appName: string, count: number): Promise<void> {
    try {
      // Get current machines
      const machines = await this.listMachines(appName);
      const currentCount = machines.length;
      
      if (currentCount === count) {
        logger.info(`App ${appName} already has ${count} machines`);
        return;
      }
      
      if (count > currentCount) {
        // Scale up - create new machines
        const promises = [];
        for (let i = currentCount; i < count; i++) {
          // Get config from first machine if exists
          const config = machines[0] ? {
            region: machines[0].region,
            dockerImage: machines[0].config.image,
            cpus: machines[0].config.guest?.cpus || 1,
            memory: machines[0].config.guest?.memory_mb || 256,
            env: machines[0].config.env,
            swarmId: machines[0].config.env?.SWARM_ID
          } : {
            region: 'dfw',
            swarmId: 'default'
          };
          
          promises.push(this.createMachine(appName, config));
        }
        await Promise.all(promises);
        logger.info(`Scaled up app ${appName} from ${currentCount} to ${count} machines`);
      } else {
        // Scale down - stop extra machines
        const toStop = currentCount - count;
        const promises = [];
        for (let i = 0; i < toStop; i++) {
          promises.push(this.stopMachine(appName, machines[i].id));
        }
        await Promise.all(promises);
        logger.info(`Scaled down app ${appName} from ${currentCount} to ${count} machines`);
      }
    } catch (error) {
      logger.error('Failed to scale app', { appName, count, error });
      throw error;
    }
  }

  async scaleMachine(appName: string, machineId: string, config: { cpus?: number; memory?: number }): Promise<any> {
    try {
      // Update machine configuration
      const updateConfig = {
        config: {
          guest: {
            cpus: config.cpus,
            memory_mb: config.memory
          }
        }
      };
      
      const response = await this.flyApiRequest('POST', `/apps/${appName}/machines/${machineId}`, updateConfig);
      logger.info(`Updated machine ${machineId} configuration`, { cpus: config.cpus, memory: config.memory });
      return response;
    } catch (error) {
      logger.error('Failed to scale machine', { appName, machineId, config, error });
      throw error;
    }
  }

  async getAppStatus(appName: string): Promise<any> {
    try {
      const { stdout } = await execAsync(
        `fly status --app ${appName} --json`,
        { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
      );
      return JSON.parse(stdout);
    } catch (error) {
      logger.error('Failed to get app status', { appName, error });
      throw error;
    }
  }

  async getAppLogs(appName: string, lines = 100): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `fly logs --app ${appName} -n ${lines}`,
        { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
      );
      return stdout.split('\n').filter(line => line.trim());
    } catch (error) {
      logger.error('Failed to get app logs', { appName, error });
      throw error;
    }
  }

  async getMachineMetadata(appName: string, machineId: string): Promise<any> {
    try {
      const machine = await this.flyApiRequest('GET', `/apps/${appName}/machines/${machineId}`, undefined, `get-metadata-${machineId}`) as any;
      logger.info(`Retrieved machine metadata`, { appName, machineId });
      
      return {
        id: machine.id,
        state: machine.state,
        region: machine.region,
        instance_id: machine.instance_id,
        private_ip: machine.private_ip,
        created_at: machine.created_at,
        updated_at: machine.updated_at,
        config: machine.config,
        events: machine.events,
      };
    } catch (error) {
      logger.error('Failed to get machine metadata', { appName, machineId, error });
      throw error;
    }
  }

  async listMachines(appName: string): Promise<any[]> {
    try {
      const machines = await this.flyApiRequest('GET', `/apps/${appName}/machines`, undefined, `list-machines-${appName}`) as any[];
      logger.info(`Listed machines for app: ${appName}`, { count: machines.length });
      return machines;
    } catch (error) {
      logger.error('Failed to list machines', { appName, error });
      throw error;
    }
  }

  async deleteApp(appName: string): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync(
        `fly apps destroy ${appName} --yes`,
        { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
      );
      logger.info(`Deleted app: ${appName}`, { stdout, stderr });
    } catch (error) {
      logger.error('Failed to delete app', { appName, error });
      throw error;
    }
  }

  private generateFlyConfig(appName: string, config: any): string {
    return `
app = "${appName}"
primary_region = "${config.region || 'dfw'}"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  WORKER_TYPE = "${config.workerType || 'general'}"
  SWARM_ID = "${config.swarmId}"
  REDIS_URL = "${process.env.REDIS_URL || ''}"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = ${config.minInstances || 0}

[[services]]
  protocol = "tcp"
  internal_port = 3000
  [[services.ports]]
    port = 80
    handlers = ["http"]
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[[vm]]
  cpu_kind = "shared"
  cpus = ${config.cpus || 1}
  memory_mb = ${config.memory || 256}
`;
  }

  private generateWorkerDockerfile(config: any): string {
    return `
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Set up health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000

CMD ["node", "src/index.js"]
`;
  }

  // Convert internal Swarm to Fly app
  swarmToFlyApp(swarm: Swarm): string {
    return `swarm-${swarm.name.toLowerCase().replace(/\s+/g, '-')}-${swarm.id.slice(0, 8)}`;
  }

  // Get all Fly apps that are swarm workers
  async listSwarmApps(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `fly apps list --json`,
        { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
      );
      const apps = JSON.parse(stdout);
      return apps
        .filter((app: any) => app.Name.startsWith('swarm-'))
        .map((app: any) => app.Name);
    } catch (error) {
      logger.error('Failed to list Fly apps', { error });
      return [];
    }
  }

  async getMachineStats(appName: string, machineId: string): Promise<any> {
    try {
      const stats = await this.flyApiRequest('GET', `/apps/${appName}/machines/${machineId}/stats`) as any;
      logger.info(`Retrieved machine stats`, { appName, machineId });
      
      return {
        cpu: {
          usage_percent: stats.cpu?.usage_percent || 0,
          cores: stats.cpu?.cores || 1
        },
        memory: {
          used_mb: stats.memory?.used_mb || 0,
          total_mb: stats.memory?.total_mb || 256,
          usage_percent: stats.memory?.usage_percent || 0
        },
        network: {
          rx_bytes: stats.network?.rx_bytes || 0,
          tx_bytes: stats.network?.tx_bytes || 0
        },
        disk: {
          used_mb: stats.disk?.used_mb || 0,
          total_mb: stats.disk?.total_mb || 0,
          usage_percent: stats.disk?.usage_percent || 0
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get machine stats', { appName, machineId, error });
      throw error;
    }
  }

  async waitForMachineReady(appName: string, machineId: string, maxAttempts = 30, intervalMs = 2000): Promise<void> {
    logger.info(`Waiting for machine ${machineId} to be ready...`);
    const spanId = `wait-machine-${machineId}`;
    
    // Start Langfuse span for waiting operation
    langfuseService.startSpan(spanId, 'Wait for Machine Ready', undefined, {
      app_name: appName,
      machine_id: machineId,
      max_attempts: maxAttempts
    });
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const machine = await this.getMachineMetadata(appName, machineId);
        
        // Check if machine is in a ready state
        if (machine.state === 'started' || machine.state === 'running') {
          // Check health endpoint if available
          const health = await this.checkMachineHealth(appName, machineId);
          if (health.status === 'passing') {
            logger.info(`Machine ${machineId} is ready and healthy`);
            
            // End span successfully
            langfuseService.endSpan(spanId, {
              status: 'ready',
              attempts: attempt + 1,
              total_wait_ms: (attempt + 1) * intervalMs
            });
            
            // Create TrustGraph edge for readiness
            await trustGraphService.createEdge({
              source: `machine-${machineId}`,
              target: `machine-ready-${machineId}`,
              label: 'became_ready',
              type: 'executes',
              metadata: {
                attempts: attempt + 1,
                health_status: health.status
              }
            });
            
            return;
          }
        }
        
        logger.info(`Machine ${machineId} state: ${machine.state}, attempt ${attempt + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        logger.warn(`Health check attempt ${attempt + 1} failed`, { error });
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    // End span with failure
    langfuseService.endSpan(spanId, undefined, 
      new Error(`Machine ${machineId} failed to become ready after ${maxAttempts} attempts`)
    );
    
    throw new Error(`Machine ${machineId} failed to become ready after ${maxAttempts} attempts`);
  }

  async checkMachineHealth(appName: string, machineId: string): Promise<{ status: string; checks: any[] }> {
    try {
      // Try to get machine health status
      const machine = await this.getMachineMetadata(appName, machineId);
      
      // Check if machine has health checks configured
      if (machine.checks && machine.checks.length > 0) {
        const passing = machine.checks.every((check: any) => check.status === 'passing');
        return {
          status: passing ? 'passing' : 'failing',
          checks: machine.checks
        };
      }
      
      // Default to checking machine state
      return {
        status: (machine.state === 'started' || machine.state === 'running') ? 'passing' : 'failing',
        checks: [{
          name: 'machine_state',
          status: machine.state,
          output: `Machine is ${machine.state}`
        }]
      };
    } catch (error) {
      logger.error('Failed to check machine health', { appName, machineId, error });
      return {
        status: 'failing',
        checks: [{
          name: 'health_check',
          status: 'error',
          output: error.message
        }]
      };
    }
  }

  async stopMachine(appName: string, machineId: string): Promise<void> {
    try {
      await this.flyApiRequest('POST', `/apps/${appName}/machines/${machineId}/stop`, undefined, `stop-${machineId}`);
      logger.info(`Stopped machine ${machineId}`);
    } catch (error) {
      logger.error('Failed to stop machine', { appName, machineId, error });
      throw error;
    }
  }

  async startMachine(appName: string, machineId: string): Promise<void> {
    try {
      await this.flyApiRequest('POST', `/apps/${appName}/machines/${machineId}/start`, undefined, `start-${machineId}`);
      logger.info(`Started machine ${machineId}`);
      
      // Wait for machine to be ready
      await this.waitForMachineReady(appName, machineId);
    } catch (error) {
      logger.error('Failed to start machine', { appName, machineId, error });
      throw error;
    }
  }

  async restartMachine(appName: string, machineId: string): Promise<void> {
    try {
      await this.flyApiRequest('POST', `/apps/${appName}/machines/${machineId}/restart`);
      logger.info(`Restarted machine ${machineId}`);
      
      // Wait for machine to be ready
      await this.waitForMachineReady(appName, machineId);
    } catch (error) {
      logger.error('Failed to restart machine', { appName, machineId, error });
      throw error;
    }
  }

  async destroyMachine(appName: string, machineId: string): Promise<void> {
    try {
      await this.flyApiRequest('DELETE', `/apps/${appName}/machines/${machineId}?force=true`);
      logger.info(`Destroyed machine ${machineId}`);
    } catch (error) {
      logger.error('Failed to destroy machine', { appName, machineId, error });
      throw error;
    }
  }
}