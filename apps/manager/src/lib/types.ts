export interface CreateSwarmRequest {
  name: string
  purpose: string
  workerCount?: number
  config?: {
    maxWorkers?: number
    taskTimeout?: number
    retryLimit?: number
    workerType?: string
    region?: string
    cpus?: number
    memory?: number
    minInstances?: number
    dockerImage?: string
    env?: Record<string, string>
  }
}

export interface Swarm {
  id: string
  name: string
  purpose: string
  status: 'initializing' | 'running' | 'stopped' | 'error'
  workerCount: number
  createdAt: Date
  updatedAt: Date
  config: {
    maxWorkers: number
    taskTimeout: number
    retryLimit: number
  }
  metrics: {
    tasksCompleted: number
    tasksFailed: number
    averageTaskTime: number
  }
  error?: string
}

export interface Worker {
  id: string
  swarmId: string
  machineId: string
  state: 'started' | 'stopped' | 'created' | 'destroyed'
  region: string
  type: string
  config: WorkerConfig
  metrics?: WorkerMetrics
  createdAt: string
  updatedAt: string
}

export interface WorkerConfig {
  image: string
  memory: number
  cpus: number
  env: Record<string, string>
}

export interface WorkerMetrics {
  cpu: number
  memory: number
  diskUsage: number
  networkIn: number
  networkOut: number
  timestamp: string
}

export interface Task {
  id: string
  type: string
  swarmId: string
  workerId?: string
  status: 'pending' | 'queued' | 'active' | 'completed' | 'failed'
  payload: any
  result?: any
  error?: string
  priority: number
  retries: number
  createdAt: string
  startedAt?: string
  completedAt?: string
}