export interface Swarm {
  id: string
  name: string
  status: 'active' | 'inactive' | 'deploying' | 'error'
  workerCount: number
  workerType: 'researcher' | 'coder' | 'analyst' | 'tester' | 'generic'
  flyAppName: string
  createdAt: string
  updatedAt?: string
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