import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger';
import { Swarm, Worker } from '@swarm/types';

const execAsync = promisify(exec);

export class FlyService {
  private flyApiToken: string;
  private flyApiUrl: string = 'https://api.machines.dev/v1';

  constructor() {
    this.flyApiToken = process.env.FLY_API_TOKEN || '';
    if (!this.flyApiToken) {
      logger.warn('FLY_API_TOKEN not set - Fly.io operations will fail');
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
    try {
      // Validate required configuration
      if (!config.swarmId) {
        throw new Error('swarmId is required for machine creation');
      }

      // Validate Fly API token
      if (!this.flyApiToken) {
        throw new Error('FLY_API_TOKEN is not configured');
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
      const { stdout, stderr } = await execAsync(
        `fly scale count ${count} --app ${appName}`,
        { env: { ...process.env, FLY_API_TOKEN: this.flyApiToken } }
      );
      logger.info(`Scaled app ${appName} to ${count} instances`, { stdout, stderr });
    } catch (error) {
      logger.error('Failed to scale app', { appName, count, error });
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
      const machine = await this.flyApiRequest('GET', `/apps/${appName}/machines/${machineId}`) as any;
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
      const machines = await this.flyApiRequest('GET', `/apps/${appName}/machines`) as any[];
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
}