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

export interface HiveMessage {
  id: string
  from: string
  to: string | string[]
  type: 'command' | 'query' | 'response' | 'event'
  action: string
  payload: any
  timestamp: string
}

export interface ClaudeFlowConfig {
  swarmId: string
  queenType: 'strategic' | 'tactical' | 'operational'
  consensusAlgorithm: 'majority' | 'unanimous' | 'weighted'
  workerDistribution: Record<string, number>
  objective: string
}

export interface TrustGraphNode {
  id: string
  type: 'task' | 'decision' | 'checkpoint'
  dependencies: string[]
  status: 'pending' | 'active' | 'completed'
  data: any
}

export interface LangfuseTrace {
  traceId: string
  sessionId: string
  userId?: string
  metadata: Record<string, any>
  spans: LangfuseSpan[]
}

export interface LangfuseSpan {
  spanId: string
  traceId: string
  parentSpanId?: string
  name: string
  startTime: string
  endTime?: string
  input?: any
  output?: any
  metadata?: Record<string, any>
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: string
  timestamp?: string
  [key: string]: any
}

export interface WebSocketLaunchMessage extends WebSocketMessage {
  type: 'launch'
  action: 'launch'
  payload: {
    name: string
    region?: string
    image?: string
    cpus?: number
    memory?: number
    env?: Record<string, string>
  }
}

export interface WebSocketScaleMessage extends WebSocketMessage {
  type: 'scale'
  swarmId: string
  count: number
}

export interface WebSocketStatusMessage extends WebSocketMessage {
  type: 'status'
  appName: string
}

export interface WebSocketMachineUpdate extends WebSocketMessage {
  type: 'machine_update'
  machineId: string
  appName?: string
  swarmId?: string
  status: 'created' | 'started' | 'stopped' | 'destroyed' | 'scaling' | 'running'
  cpus?: number
  memory?: number
  region?: string
  privateIp?: string
  correlationId?: string
  data?: any
}

export interface WebSocketSwarmUpdate extends WebSocketMessage {
  type: 'swarm_update' | 'swarm_scaled' | 'swarm_launched' | 'swarm_scaling'
  swarmId: string
  status: string
  correlationId?: string
  data?: {
    targetCount?: number
    currentCount?: number
    agents?: any[]
    metrics?: any
    error?: string
  }
}

export interface WebSocketAuthMessage extends WebSocketMessage {
  type: 'auth'
  token: string
}

export interface WebSocketErrorMessage extends WebSocketMessage {
  type: 'error'
  error: string
  details?: any
}