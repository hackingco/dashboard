export interface SwarmConfig {
  id: string;
  name: string;
  workerCount: number;
  region: string;
  image: string;
  cpus: number;
  memoryMb: number;
  env?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  status: SwarmStatus;
}

export enum SwarmStatus {
  CREATING = 'creating',
  RUNNING = 'running',
  SCALING = 'scaling',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export interface Worker {
  id: string;
  swarmId: string;
  machineId: string;
  status: WorkerStatus;
  region: string;
  privateIp?: string;
  createdAt: Date;
  lastHeartbeat?: Date;
}

export enum WorkerStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export interface Machine {
  id: string;
  name: string;
  state: string;
  region: string;
  image_ref: {
    registry: string;
    repository: string;
    tag: string;
    digest: string;
  };
  instance_id: string;
  private_ip: string;
  created_at: string;
  updated_at: string;
  config: {
    init: {
      exec?: string[];
      entrypoint?: string[];
      cmd?: string[];
    };
    services?: Array<{
      ports: Array<{
        port: number;
        handlers: string[];
      }>;
      protocol: string;
      internal_port: number;
    }>;
    env?: Record<string, string>;
    guest?: {
      cpu_kind: string;
      cpus: number;
      memory_mb: number;
    };
  };
}

export interface CreateSwarmRequest {
  name: string;
  workerCount: number;
  region?: string;
  image?: string;
  cpus?: number;
  memoryMb?: number;
  env?: Record<string, string>;
}

export interface ScaleSwarmRequest {
  targetWorkerCount: number;
}

export interface SwarmMetrics {
  swarmId: string;
  timestamp: Date;
  workers: {
    total: number;
    running: number;
    stopped: number;
    error: number;
  };
  resources: {
    totalCpus: number;
    totalMemoryMb: number;
    usedCpus?: number;
    usedMemoryMb?: number;
  };
  performance?: {
    avgResponseTime?: number;
    requestsPerSecond?: number;
    errorRate?: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}