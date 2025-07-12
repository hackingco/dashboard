// Claude-Flow Integration Types
export type AgentType = 
  | 'researcher'
  | 'coder' 
  | 'analyst'
  | 'architect'
  | 'tester'
  | 'reviewer'
  | 'optimizer'
  | 'documenter'
  | 'monitor'
  | 'coordinator'
  | 'specialist';

export type QueenType = 'strategic' | 'tactical' | 'operational';
export type ConsensusAlgorithm = 'majority' | 'unanimous' | 'weighted';
export type TaskStrategy = 'parallel' | 'sequential' | 'adaptive';
export type SwarmTopology = 'mesh' | 'hierarchical' | 'ring' | 'star';

export interface HiveConfig {
  queenType: QueenType;
  consensusAlgorithm: ConsensusAlgorithm;
  workerDistribution: Record<AgentType, number>;
  topology: SwarmTopology;
  maxAgents: number;
}

export interface HiveTask {
  id: string;
  objective: string;
  strategy: TaskStrategy;
  requiredConsensus: number;
  maxIterations: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies?: string[];
}

export interface HiveAgent {
  id: string;
  type: AgentType;
  name: string;
  capabilities: string[];
  status: 'idle' | 'busy' | 'error';
  performance: {
    tasksCompleted: number;
    successRate: number;
    avgResponseTime: number;
  };
}

export interface HiveMemory {
  key: string;
  value: any;
  namespace: string;
  timestamp: number;
  ttl?: number;
  agent?: string;
}

export interface ConsensusVote {
  agentId: string;
  vote: boolean;
  confidence: number;
  reasoning?: string;
}

export interface ConsensusResult {
  taskId: string;
  consensus: boolean;
  votes: ConsensusVote[];
  algorithm: ConsensusAlgorithm;
  timestamp: number;
}

export interface NeuralPattern {
  id: string;
  pattern: string;
  confidence: number;
  frequency: number;
  lastSeen: number;
  agentTypes: AgentType[];
}

export interface HiveStatus {
  id: string;
  topology: SwarmTopology;
  agents: HiveAgent[];
  activeTasks: number;
  completedTasks: number;
  memoryUsage: number;
  consensusHistory: ConsensusResult[];
  performance: {
    avgTaskTime: number;
    successRate: number;
    throughput: number;
  };
}