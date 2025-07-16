/**
 * Performance Tracer Interface
 * Defines the contract for tracing performance metrics in the swarm
 */

export interface PerformanceMetric {
  metricType: 'latency' | 'throughput' | 'resource' | 'efficiency';
  name: string;
  value: number;
  unit: string;
  swarmId?: string;
  agentId?: string;
  taskId?: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface ResourceUsage {
  agentId: string;
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  tokenUsage: number;
  apiCalls: number;
  estimatedCost: number;
  timestamp: Date;
}

export interface BottleneckAnalysis {
  bottleneckType: 'agent' | 'memory' | 'api' | 'coordination';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  impact: string;
  recommendation: string;
  metrics: Record<string, number>;
  timestamp: Date;
}

export interface PerformanceProfile {
  profileId: string;
  swarmId: string;
  duration: number;
  operations: Array<{
    name: string;
    startTime: number;
    duration: number;
    tokenUsage?: number;
    children?: string[]; // Child operation IDs
  }>;
  criticalPath: string[]; // Operation IDs on critical path
  totalCost: number;
  efficiency: number;
  timestamp: Date;
}

export interface PerformanceTracer {
  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): Promise<void>;
  
  /**
   * Record resource usage for an agent
   */
  recordResourceUsage(usage: ResourceUsage): Promise<void>;
  
  /**
   * Analyze and record bottlenecks
   */
  analyzeBottlenecks(
    swarmId: string,
    timeWindow?: number // minutes
  ): Promise<BottleneckAnalysis[]>;
  
  /**
   * Create a performance profile for a swarm execution
   */
  createPerformanceProfile(
    swarmId: string,
    startTime: Date,
    endTime: Date
  ): Promise<PerformanceProfile>;
  
  /**
   * Get performance trends
   */
  getPerformanceTrends(
    metricType: string,
    timeRange: { start: Date; end: Date },
    aggregation: 'avg' | 'max' | 'min' | 'p95' | 'p99'
  ): Promise<Array<{
    timestamp: Date;
    value: number;
  }>>;
  
  /**
   * Compare agent performance
   */
  compareAgentPerformance(
    swarmId: string,
    metrics: string[]
  ): Promise<Record<string, {
    agentId: string;
    role: string;
    metrics: Record<string, number>;
    rank: number;
  }>>;
  
  /**
   * Set performance alerts
   */
  setPerformanceAlert(
    condition: {
      metric: string;
      threshold: number;
      operator: '>' | '<' | '>=' | '<=';
      duration?: number; // How long condition must be true (seconds)
    },
    callback: (alert: {
      metric: string;
      currentValue: number;
      threshold: number;
      swarmId?: string;
      agentId?: string;
    }) => void
  ): string; // Returns alert ID
  
  /**
   * Remove performance alert
   */
  removePerformanceAlert(alertId: string): void;
  
  /**
   * Generate performance report
   */
  generatePerformanceReport(
    swarmId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    summary: {
      totalOperations: number;
      avgLatency: number;
      totalTokens: number;
      totalCost: number;
      efficiency: number;
    };
    topOperations: Array<{ name: string; count: number; avgDuration: number }>;
    bottlenecks: BottleneckAnalysis[];
    recommendations: string[];
  }>;
}