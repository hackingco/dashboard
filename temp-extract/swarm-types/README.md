# @swarm-orchestration/types

[![npm version](https://badge.fury.io/js/%40swarm-orchestration%2Ftypes.svg)](https://badge.fury.io/js/%40swarm-orchestration%2Ftypes)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Complete TypeScript type definitions for the Swarm Orchestration Platform.

## 🌟 Features

- **Complete Type Coverage**: 100% TypeScript coverage for all platform components
- **Strict Type Safety**: Comprehensive interfaces with strict validation
- **Modular Design**: Import only the types you need
- **Version Compatibility**: Backward compatible type definitions
- **Documentation**: Extensive JSDoc comments for all types
- **IDE Support**: Full IntelliSense and autocomplete support

## 📦 Installation

```bash
npm install @swarm-orchestration/types
```

## 🚀 Quick Start

### Basic Types

```typescript
import type { 
  Swarm,
  Agent,
  Task,
  SwarmTopology,
  AgentStatus
} from '@swarm-orchestration/types';

// Define a swarm
const swarm: Swarm = {
  id: 'swarm-123',
  name: 'Data Processing Swarm',
  topology: 'hierarchical',
  maxAgents: 8,
  createdAt: new Date(),
  status: 'active'
};

// Define an agent
const agent: Agent = {
  id: 'agent-456',
  name: 'Data Processor',
  type: 'processor',
  status: 'active',
  swarmId: 'swarm-123',
  capabilities: ['data-processing', 'analysis'],
  createdAt: new Date()
};
```

### Advanced Types with Generics

```typescript
import type { 
  TaskResult,
  SwarmEvent,
  AgentMetrics
} from '@swarm-orchestration/types';

// Generic task result
interface DataProcessingResult {
  processedRecords: number;
  errors: string[];
  duration: number;
}

const taskResult: TaskResult<DataProcessingResult> = {
  taskId: 'task-789',
  agentId: 'agent-456',
  status: 'completed',
  result: {
    processedRecords: 1000,
    errors: [],
    duration: 5000
  },
  completedAt: new Date()
};
```

## 📋 Core Type Categories

### 1. Swarm Types

```typescript
export interface Swarm {
  id: string;
  name: string;
  description?: string;
  topology: SwarmTopology;
  maxAgents: number;
  currentAgents: number;
  status: SwarmStatus;
  configuration: SwarmConfiguration;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>;
}

export type SwarmTopology = 'hierarchical' | 'mesh' | 'ring' | 'star';
export type SwarmStatus = 'initializing' | 'active' | 'paused' | 'stopped' | 'error';

export interface SwarmConfiguration {
  coordinationStrategy: CoordinationStrategy;
  memoryEnabled: boolean;
  neuralNetworksEnabled: boolean;
  autoScaling: AutoScalingConfig;
  monitoring: MonitoringConfig;
}
```

### 2. Agent Types

```typescript
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  swarmId: string;
  parentAgentId?: string;
  capabilities: string[];
  configuration: AgentConfiguration;
  metrics: AgentMetrics;
  createdAt: Date;
  lastActiveAt?: Date;
}

export type AgentType = 
  | 'coordinator' 
  | 'processor' 
  | 'analyzer' 
  | 'monitor' 
  | 'custom';

export type AgentStatus = 
  | 'initializing' 
  | 'active' 
  | 'idle' 
  | 'busy' 
  | 'error' 
  | 'offline';

export interface AgentMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  averageTaskDuration: number;
  errorRate: number;
  cpuUsage?: number;
  memoryUsage?: number;
  lastUpdate: Date;
}
```

### 3. Task Types

```typescript
export interface Task<TData = any, TResult = any> {
  id: string;
  name: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  data: TData;
  result?: TResult;
  agentId?: string;
  swarmId: string;
  dependencies: string[];
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export type TaskType = 
  | 'data-processing' 
  | 'analysis' 
  | 'coordination' 
  | 'monitoring' 
  | 'custom';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus = 
  | 'pending' 
  | 'scheduled' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface TaskResult<TResult = any> {
  taskId: string;
  agentId: string;
  status: 'completed' | 'failed';
  result?: TResult;
  error?: TaskError;
  duration: number;
  completedAt: Date;
  metadata?: Record<string, any>;
}
```

### 4. Observability Types

```typescript
export interface TraceEvent {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  type: TraceEventType;
  timestamp: Date;
  duration?: number;
  status: TraceStatus;
  data: Record<string, any>;
  tags: Record<string, string>;
}

export type TraceEventType = 
  | 'task-start' 
  | 'task-end' 
  | 'agent-communication' 
  | 'swarm-coordination' 
  | 'error' 
  | 'custom';

export type TraceStatus = 'ok' | 'error' | 'timeout' | 'cancelled';

export interface LangfuseTrace {
  id: string;
  name: string;
  userId?: string;
  sessionId?: string;
  version?: string;
  release?: string;
  timestamp: Date;
  observations: LangfuseObservation[];
  metadata?: Record<string, any>;
}

export interface LangfuseObservation {
  id: string;
  traceId: string;
  parentObservationId?: string;
  type: 'span' | 'generation' | 'event';
  name: string;
  startTime: Date;
  endTime?: Date;
  completionStartTime?: Date;
  model?: string;
  modelParameters?: Record<string, any>;
  input?: any;
  output?: any;
  usage?: TokenUsage;
  level: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
  version?: string;
  metadata?: Record<string, any>;
}
```

### 5. Database Types

```typescript
export interface SwarmEntity {
  id: string;
  created_at: Date;
  updated_at?: Date;
}

export interface SwarmTable extends SwarmEntity {
  name: string;
  description?: string;
  topology: SwarmTopology;
  max_agents: number;
  current_agents: number;
  status: SwarmStatus;
  configuration: Json;
  metadata?: Json;
}

export interface AgentTable extends SwarmEntity {
  name: string;
  type: AgentType;
  status: AgentStatus;
  swarm_id: string;
  parent_agent_id?: string;
  capabilities: string[];
  configuration: Json;
  metrics: Json;
  last_active_at?: Date;
}

export interface TaskTable extends SwarmEntity {
  name: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  data: Json;
  result?: Json;
  agent_id?: string;
  swarm_id: string;
  dependencies: string[];
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  metadata?: Json;
}
```

### 6. API Types

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationInfo;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Request types
export interface CreateSwarmRequest {
  name: string;
  description?: string;
  topology: SwarmTopology;
  maxAgents: number;
  configuration?: Partial<SwarmConfiguration>;
  metadata?: Record<string, any>;
}

export interface CreateAgentRequest {
  name: string;
  type: AgentType;
  swarmId: string;
  parentAgentId?: string;
  capabilities: string[];
  configuration?: Partial<AgentConfiguration>;
}

export interface CreateTaskRequest {
  name: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  data: any;
  swarmId: string;
  agentId?: string;
  dependencies?: string[];
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}
```

### 7. WebSocket Types

```typescript
export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: Date;
  requestId?: string;
}

export type WebSocketMessageType = 
  | 'swarm-status-update'
  | 'agent-status-update'
  | 'task-update'
  | 'metrics-update'
  | 'error'
  | 'heartbeat';

export interface SwarmStatusUpdate {
  swarmId: string;
  status: SwarmStatus;
  agentCount: number;
  taskCount: number;
  metrics: SwarmMetrics;
}

export interface AgentStatusUpdate {
  agentId: string;
  swarmId: string;
  status: AgentStatus;
  metrics: AgentMetrics;
  lastActiveAt: Date;
}

export interface TaskUpdate {
  taskId: string;
  status: TaskStatus;
  agentId?: string;
  progress?: number;
  result?: any;
  error?: TaskError;
}
```

## 🔧 Utility Types

### Generic Helpers

```typescript
// Utility types for common patterns
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type Required<T> = {
  [P in keyof T]-?: T[P];
};

export type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Swarm-specific utility types
export type SwarmEntityId = string;
export type Timestamp = Date;
export type Json = any;

export type CreateEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEntity<T> = Partial<Omit<T, 'id' | 'createdAt'>>;

// Event types
export type SwarmEventHandler<T = any> = (event: SwarmEvent<T>) => void | Promise<void>;

export interface SwarmEvent<T = any> {
  type: string;
  source: string;
  timestamp: Date;
  data: T;
  metadata?: Record<string, any>;
}
```

## 🧪 Type Guards

```typescript
// Type guard functions for runtime type checking
export function isSwarm(obj: any): obj is Swarm {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    ['hierarchical', 'mesh', 'ring', 'star'].includes(obj.topology);
}

export function isAgent(obj: any): obj is Agent {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.swarmId === 'string' &&
    Array.isArray(obj.capabilities);
}

export function isTask(obj: any): obj is Task {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.swarmId === 'string' &&
    ['pending', 'scheduled', 'running', 'completed', 'failed', 'cancelled'].includes(obj.status);
}
```

## 📚 Usage Examples

### Swarm Management

```typescript
import type { 
  Swarm, 
  CreateSwarmRequest, 
  SwarmConfiguration 
} from '@swarm-orchestration/types';

// Create a new swarm
const createSwarmRequest: CreateSwarmRequest = {
  name: 'Data Processing Pipeline',
  description: 'Processes large datasets in parallel',
  topology: 'hierarchical',
  maxAgents: 12,
  configuration: {
    coordinationStrategy: 'adaptive',
    memoryEnabled: true,
    neuralNetworksEnabled: true,
    autoScaling: {
      enabled: true,
      minAgents: 2,
      maxAgents: 12,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.3
    },
    monitoring: {
      enabled: true,
      metricsInterval: 5000,
      tracingEnabled: true
    }
  }
};
```

### Agent Coordination

```typescript
import type { 
  Agent, 
  AgentMetrics, 
  AgentConfiguration 
} from '@swarm-orchestration/types';

// Configure an agent
const agentConfig: AgentConfiguration = {
  maxConcurrentTasks: 3,
  timeout: 30000,
  retryAttempts: 3,
  heartbeatInterval: 5000,
  capabilities: {
    'data-processing': { level: 'advanced', version: '1.0' },
    'analysis': { level: 'intermediate', version: '1.0' }
  }
};

// Monitor agent performance
const processAgentMetrics = (metrics: AgentMetrics) => {
  console.log(`Agent performance:
    Tasks completed: ${metrics.tasksCompleted}
    Average duration: ${metrics.averageTaskDuration}ms
    Error rate: ${(metrics.errorRate * 100).toFixed(2)}%
    CPU usage: ${metrics.cpuUsage?.toFixed(1)}%
  `);
};
```

### Task Processing

```typescript
import type { 
  Task, 
  TaskResult, 
  TaskError 
} from '@swarm-orchestration/types';

// Define custom task data and result types
interface DataProcessingTask {
  inputFiles: string[];
  outputFormat: 'json' | 'csv' | 'xml';
  transformations: string[];
}

interface DataProcessingResult {
  outputFiles: string[];
  recordsProcessed: number;
  duration: number;
  warnings: string[];
}

// Type-safe task handling
const handleTaskResult = (result: TaskResult<DataProcessingResult>) => {
  if (result.status === 'completed' && result.result) {
    console.log(`Processed ${result.result.recordsProcessed} records`);
    console.log(`Output files: ${result.result.outputFiles.join(', ')}`);
  } else if (result.status === 'failed' && result.error) {
    console.error(`Task failed: ${result.error.message}`);
  }
};
```

## 🔍 Type Validation

### Runtime Validation with Zod

```typescript
import { z } from 'zod';
import type { Swarm } from '@swarm-orchestration/types';

// Create Zod schema from TypeScript types
const SwarmSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  topology: z.enum(['hierarchical', 'mesh', 'ring', 'star']),
  maxAgents: z.number().positive(),
  status: z.enum(['initializing', 'active', 'paused', 'stopped', 'error']),
  createdAt: z.date()
});

// Validate data at runtime
function validateSwarm(data: unknown): Swarm {
  return SwarmSchema.parse(data);
}
```

## 🧪 Testing with Types

```typescript
import type { 
  Swarm, 
  Agent, 
  Task 
} from '@swarm-orchestration/types';

// Type-safe test data factories
export const createMockSwarm = (overrides?: Partial<Swarm>): Swarm => ({
  id: 'test-swarm-1',
  name: 'Test Swarm',
  topology: 'hierarchical',
  maxAgents: 4,
  currentAgents: 0,
  status: 'active',
  configuration: {
    coordinationStrategy: 'parallel',
    memoryEnabled: true,
    neuralNetworksEnabled: false,
    autoScaling: { enabled: false },
    monitoring: { enabled: false }
  },
  createdAt: new Date(),
  ...overrides
});

export const createMockAgent = (overrides?: Partial<Agent>): Agent => ({
  id: 'test-agent-1',
  name: 'Test Agent',
  type: 'processor',
  status: 'active',
  swarmId: 'test-swarm-1',
  capabilities: ['data-processing'],
  configuration: {
    maxConcurrentTasks: 1,
    timeout: 30000,
    retryAttempts: 3,
    heartbeatInterval: 5000
  },
  metrics: {
    tasksCompleted: 0,
    tasksInProgress: 0,
    averageTaskDuration: 0,
    errorRate: 0,
    lastUpdate: new Date()
  },
  createdAt: new Date(),
  ...overrides
});
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Add your types to the appropriate category
4. Include comprehensive JSDoc comments
5. Add examples and tests
6. Update this README if needed
7. Commit your changes (`git commit -m 'Add some amazing types'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Packages

- [@swarm-orchestration/config](https://github.com/ruvnet/swarm-config) - Configuration management
- [@swarm-orchestration/utils](https://github.com/ruvnet/swarm-utils) - Utility functions
- [claude-flow](https://github.com/ruvnet/claude-flow) - Core orchestration engine

## 📞 Support

- [Documentation](https://github.com/ruvnet/swarm-types/docs)
- [Issues](https://github.com/ruvnet/swarm-types/issues)
- [Discussions](https://github.com/ruvnet/swarm-types/discussions)
- Email: support@swarm-orchestration.com