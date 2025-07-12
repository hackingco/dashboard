import fetch from 'node-fetch';
import { Machine } from '../types';
import { logger } from '../utils/logger';

export class FlyService {
  private apiToken: string;
  private apiUrl: string;
  private appName: string;
  private organization: string;

  constructor() {
    this.apiToken = process.env.FLY_API_TOKEN || '';
    this.apiUrl = process.env.FLY_API_URL || 'https://api.machines.dev/v1';
    this.appName = process.env.FLY_APP_NAME || 'hive-mind-swarm';
    this.organization = process.env.FLY_ORGANIZATION || 'personal';

    if (!this.apiToken) {
      throw new Error('FLY_API_TOKEN is required');
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    
    if (!response.ok) {
      logger.error('Fly API error', {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
      throw new Error(`Fly API error: ${response.status} ${response.statusText}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      logger.error('Failed to parse Fly API response', { text, error });
      throw new Error('Invalid response from Fly API');
    }
  }

  async createMachine(config: {
    name: string;
    region: string;
    image: string;
    cpus: number;
    memoryMb: number;
    env?: Record<string, string>;
    services?: Array<{
      ports: Array<{
        port: number;
        handlers: string[];
      }>;
      protocol: string;
      internal_port: number;
    }>;
  }): Promise<Machine> {
    const payload = {
      name: config.name,
      region: config.region,
      config: {
        image: config.image,
        guest: {
          cpu_kind: 'shared',
          cpus: config.cpus,
          memory_mb: config.memoryMb,
        },
        env: config.env || {},
        services: config.services || [],
        auto_destroy: false,
      },
    };

    logger.info('Creating Fly machine', { name: config.name, region: config.region });

    const response = await fetch(
      `${this.apiUrl}/apps/${this.appName}/machines`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    );

    const machine = await this.handleResponse<Machine>(response);
    logger.info('Machine created successfully', { machineId: machine.id });
    
    return machine;
  }

  async listMachines(): Promise<Machine[]> {
    logger.info('Listing Fly machines');

    const response = await fetch(
      `${this.apiUrl}/apps/${this.appName}/machines`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    const machines = await this.handleResponse<Machine[]>(response);
    logger.info(`Found ${machines.length} machines`);
    
    return machines;
  }

  async getMachine(machineId: string): Promise<Machine> {
    logger.info('Getting Fly machine', { machineId });

    const response = await fetch(
      `${this.apiUrl}/apps/${this.appName}/machines/${machineId}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<Machine>(response);
  }

  async updateMachine(machineId: string, config: Partial<{
    name: string;
    image: string;
    cpus: number;
    memoryMb: number;
    env: Record<string, string>;
  }>): Promise<Machine> {
    logger.info('Updating Fly machine', { machineId, config });

    const machine = await this.getMachine(machineId);
    
    const payload = {
      ...machine.config,
      guest: config.cpus || config.memoryMb ? {
        ...machine.config.guest,
        cpus: config.cpus || machine.config.guest?.cpus,
        memory_mb: config.memoryMb || machine.config.guest?.memory_mb,
      } : machine.config.guest,
      env: config.env ? { ...machine.config.env, ...config.env } : machine.config.env,
    };

    const response = await fetch(
      `${this.apiUrl}/apps/${this.appName}/machines/${machineId}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ config: payload }),
      }
    );

    const updatedMachine = await this.handleResponse<Machine>(response);
    logger.info('Machine updated successfully', { machineId });
    
    return updatedMachine;
  }

  async deleteMachine(machineId: string, force: boolean = false): Promise<void> {
    logger.info('Deleting Fly machine', { machineId, force });

    const url = `${this.apiUrl}/apps/${this.appName}/machines/${machineId}${force ? '?force=true' : ''}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Failed to delete machine', {
        machineId,
        status: response.status,
        body: text,
      });
      throw new Error(`Failed to delete machine: ${response.status}`);
    }

    logger.info('Machine deleted successfully', { machineId });
  }

  async startMachine(machineId: string): Promise<void> {
    logger.info('Starting Fly machine', { machineId });

    const response = await fetch(
      `${this.apiUrl}/apps/${this.appName}/machines/${machineId}/start`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      logger.error('Failed to start machine', {
        machineId,
        status: response.status,
        body: text,
      });
      throw new Error(`Failed to start machine: ${response.status}`);
    }

    logger.info('Machine started successfully', { machineId });
  }

  async stopMachine(machineId: string): Promise<void> {
    logger.info('Stopping Fly machine', { machineId });

    const response = await fetch(
      `${this.apiUrl}/apps/${this.appName}/machines/${machineId}/stop`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      logger.error('Failed to stop machine', {
        machineId,
        status: response.status,
        body: text,
      });
      throw new Error(`Failed to stop machine: ${response.status}`);
    }

    logger.info('Machine stopped successfully', { machineId });
  }

  async waitForMachineState(
    machineId: string,
    targetState: string,
    timeoutMs: number = 60000
  ): Promise<Machine> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const machine = await this.getMachine(machineId);
      
      if (machine.state === targetState) {
        return machine;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Machine ${machineId} did not reach state ${targetState} within ${timeoutMs}ms`);
  }
}