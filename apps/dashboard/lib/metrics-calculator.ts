/**
 * Metrics Calculator for Swarm Monitoring System
 * Provides comprehensive metric calculations and aggregations
 */

import { LiveTrace, LiveAgent, SwarmMetrics } from './langfuse-client';

export interface PerformanceMetrics {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
}

export interface CostMetrics {
  total: number;
  perTrace: number;
  perSuccessfulTrace: number;
  perHour: number;
  perModel: Record<string, number>;
  projectedDaily: number;
  projectedMonthly: number;
}

export interface HealthScore {
  overall: number;
  components: {
    availability: number;
    performance: number;
    errorRate: number;
    resourceUtilization: number;
    costEfficiency: number;
  };
  trend: 'improving' | 'stable' | 'degrading';
  recommendations: string[];
}

export interface CapacityMetrics {
  currentUtilization: {
    cpu: number;
    memory: number;
    agents: number;
    throughput: number;
  };
  maxCapacity: {
    agents: number;
    tracesPerMinute: number;
    concurrentTasks: number;
  };
  headroom: {
    percentage: number;
    estimatedTracesRemaining: number;
    timeToExhaustion: number; // minutes
  };
}

export class MetricsCalculator {
  /**
   * Calculate performance percentiles from trace durations
   */
  static calculatePerformanceMetrics(traces: LiveTrace[]): PerformanceMetrics {
    if (traces.length === 0) {
      return {
        p50: 0, p75: 0, p90: 0, p95: 0, p99: 0,
        min: 0, max: 0, mean: 0, stdDev: 0
      };
    }

    const durations = traces
      .filter(t => t.duration > 0)
      .map(t => t.duration)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return {
        p50: 0, p75: 0, p90: 0, p95: 0, p99: 0,
        min: 0, max: 0, mean: 0, stdDev: 0
      };
    }

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * durations.length) - 1;
      return durations[Math.max(0, Math.min(index, durations.length - 1))];
    };

    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    return {
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      min: durations[0],
      max: durations[durations.length - 1],
      mean: Math.round(mean),
      stdDev: Math.round(stdDev)
    };
  }

  /**
   * Calculate comprehensive cost metrics
   */
  static calculateCostMetrics(traces: LiveTrace[], timeWindowHours: number = 1): CostMetrics {
    const totalCost = traces.reduce((sum, t) => sum + t.totalCost, 0);
    const successfulTraces = traces.filter(t => t.status === 'success');
    const costPerTrace = traces.length > 0 ? totalCost / traces.length : 0;
    const costPerSuccessfulTrace = successfulTraces.length > 0 
      ? successfulTraces.reduce((sum, t) => sum + t.totalCost, 0) / successfulTraces.length 
      : 0;

    // Calculate per-model costs
    const costPerModel: Record<string, number> = {};
    traces.forEach(trace => {
      costPerModel[trace.model] = (costPerModel[trace.model] || 0) + trace.totalCost;
    });

    // Calculate hourly rate
    const costPerHour = timeWindowHours > 0 ? totalCost / timeWindowHours : totalCost;

    return {
      total: totalCost,
      perTrace: costPerTrace,
      perSuccessfulTrace: costPerSuccessfulTrace,
      perHour: costPerHour,
      perModel: costPerModel,
      projectedDaily: costPerHour * 24,
      projectedMonthly: costPerHour * 24 * 30
    };
  }

  /**
   * Calculate overall system health score
   */
  static calculateHealthScore(
    traces: LiveTrace[],
    agents: LiveAgent[],
    uptimeHours: number
  ): HealthScore {
    // Availability score (uptime-based)
    const targetUptime = 0.999; // 99.9% SLA
    const actualUptime = Math.min(uptimeHours / (uptimeHours + 0.1), 1); // Assume 0.1h downtime
    const availabilityScore = (actualUptime / targetUptime) * 100;

    // Performance score (based on latency)
    const perfMetrics = this.calculatePerformanceMetrics(traces);
    const targetP95 = 2000; // 2 second target
    const performanceScore = Math.max(0, 100 - ((perfMetrics.p95 - targetP95) / targetP95) * 50);

    // Error rate score
    const errorCount = traces.filter(t => t.status === 'error').length;
    const errorRate = traces.length > 0 ? errorCount / traces.length : 0;
    const targetErrorRate = 0.01; // 1% target
    const errorRateScore = Math.max(0, 100 - (errorRate / targetErrorRate) * 50);

    // Resource utilization score
    const avgCpuUsage = agents.length > 0 
      ? agents.reduce((sum, a) => sum + a.cpuUsage, 0) / agents.length 
      : 0;
    const avgMemoryUsage = agents.length > 0 
      ? agents.reduce((sum, a) => sum + a.memoryUsage, 0) / agents.length 
      : 0;
    const resourceScore = 100 - ((avgCpuUsage + avgMemoryUsage) / 2);

    // Cost efficiency score
    const costMetrics = this.calculateCostMetrics(traces);
    const targetCostPerTrace = 0.01; // $0.01 target
    const costScore = Math.max(0, 100 - ((costMetrics.perSuccessfulTrace - targetCostPerTrace) / targetCostPerTrace) * 50);

    // Calculate overall score (weighted average)
    const weights = {
      availability: 0.3,
      performance: 0.25,
      errorRate: 0.2,
      resource: 0.15,
      cost: 0.1
    };

    const overall = 
      availabilityScore * weights.availability +
      performanceScore * weights.performance +
      errorRateScore * weights.errorRate +
      resourceScore * weights.resource +
      costScore * weights.cost;

    // Determine trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (overall > 85) trend = 'improving';
    else if (overall < 70) trend = 'degrading';

    // Generate recommendations
    const recommendations: string[] = [];
    if (performanceScore < 80) {
      recommendations.push('Consider scaling up agents to improve response times');
    }
    if (errorRateScore < 80) {
      recommendations.push('Investigate and address sources of errors');
    }
    if (resourceScore < 70) {
      recommendations.push('Resource utilization is high, consider adding capacity');
    }
    if (costScore < 80) {
      recommendations.push('Review model usage to optimize costs');
    }

    return {
      overall: Math.round(overall),
      components: {
        availability: Math.round(availabilityScore),
        performance: Math.round(performanceScore),
        errorRate: Math.round(errorRateScore),
        resourceUtilization: Math.round(resourceScore),
        costEfficiency: Math.round(costScore)
      },
      trend,
      recommendations
    };
  }

  /**
   * Calculate capacity metrics and headroom
   */
  static calculateCapacityMetrics(
    traces: LiveTrace[],
    agents: LiveAgent[],
    timeWindowMinutes: number = 60
  ): CapacityMetrics {
    // Current utilization
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const avgCpu = agents.length > 0 
      ? agents.reduce((sum, a) => sum + a.cpuUsage, 0) / agents.length 
      : 0;
    const avgMemory = agents.length > 0 
      ? agents.reduce((sum, a) => sum + a.memoryUsage, 0) / agents.length 
      : 0;
    const throughput = traces.length / timeWindowMinutes;

    // Max capacity (configurable, using defaults here)
    const maxAgents = 50;
    const maxTracesPerMinute = 1000;
    const maxConcurrentTasks = maxAgents * 10;

    // Calculate headroom
    const agentHeadroom = ((maxAgents - activeAgents) / maxAgents) * 100;
    const throughputHeadroom = ((maxTracesPerMinute - throughput) / maxTracesPerMinute) * 100;
    const overallHeadroom = Math.min(agentHeadroom, throughputHeadroom);

    // Estimate time to exhaustion based on growth rate
    const recentGrowthRate = 0.05; // 5% per hour (would be calculated from historical data)
    const currentUtilizationPercent = 100 - overallHeadroom;
    const hoursToExhaustion = currentUtilizationPercent > 0 
      ? Math.log(100 / currentUtilizationPercent) / Math.log(1 + recentGrowthRate)
      : Infinity;

    return {
      currentUtilization: {
        cpu: avgCpu,
        memory: avgMemory,
        agents: (activeAgents / maxAgents) * 100,
        throughput: (throughput / maxTracesPerMinute) * 100
      },
      maxCapacity: {
        agents: maxAgents,
        tracesPerMinute: maxTracesPerMinute,
        concurrentTasks: maxConcurrentTasks
      },
      headroom: {
        percentage: overallHeadroom,
        estimatedTracesRemaining: (maxTracesPerMinute - throughput) * 60, // per hour
        timeToExhaustion: hoursToExhaustion * 60 // convert to minutes
      }
    };
  }

  /**
   * Calculate error distribution and patterns
   */
  static calculateErrorMetrics(traces: LiveTrace[]) {
    const errors = traces.filter(t => t.status === 'error');
    const errorsByType: Record<string, number> = {};
    const errorsByAgent: Record<string, number> = {};
    const errorsByModel: Record<string, number> = {};

    errors.forEach(trace => {
      // Extract error type from output or metadata
      const errorType = trace.output?.includes('timeout') ? 'timeout' 
        : trace.output?.includes('rate limit') ? 'rate_limit'
        : trace.output?.includes('invalid') ? 'validation'
        : 'unknown';
      
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      
      if (trace.agentId) {
        errorsByAgent[trace.agentId] = (errorsByAgent[trace.agentId] || 0) + 1;
      }
      
      errorsByModel[trace.model] = (errorsByModel[trace.model] || 0) + 1;
    });

    return {
      total: errors.length,
      rate: traces.length > 0 ? (errors.length / traces.length) * 100 : 0,
      byType: errorsByType,
      byAgent: errorsByAgent,
      byModel: errorsByModel,
      trends: this.calculateErrorTrends(traces)
    };
  }

  /**
   * Calculate error trends over time
   */
  private static calculateErrorTrends(traces: LiveTrace[]) {
    const now = Date.now();
    const intervals = [5, 15, 30, 60]; // minutes
    const trends: Record<string, number> = {};

    intervals.forEach(interval => {
      const cutoff = now - (interval * 60 * 1000);
      const recentTraces = traces.filter(t => t.timestamp.getTime() > cutoff);
      const recentErrors = recentTraces.filter(t => t.status === 'error');
      trends[`${interval}m`] = recentTraces.length > 0 
        ? (recentErrors.length / recentTraces.length) * 100 
        : 0;
    });

    return trends;
  }

  /**
   * Calculate agent efficiency metrics
   */
  static calculateAgentEfficiency(agents: LiveAgent[], traces: LiveTrace[]) {
    const agentMetrics: Record<string, any> = {};

    agents.forEach(agent => {
      const agentTraces = traces.filter(t => t.agentId === agent.id);
      const successfulTraces = agentTraces.filter(t => t.status === 'success');
      
      agentMetrics[agent.id] = {
        name: agent.name,
        status: agent.status,
        tasksCompleted: agent.tasksCompleted,
        successRate: agentTraces.length > 0 
          ? (successfulTraces.length / agentTraces.length) * 100 
          : 0,
        avgResponseTime: agent.averageResponseTime,
        efficiency: this.calculateEfficiencyScore(agent, agentTraces),
        utilization: (agent.cpuUsage + agent.memoryUsage) / 2,
        costPerTask: agentTraces.length > 0
          ? agentTraces.reduce((sum, t) => sum + t.totalCost, 0) / agentTraces.length
          : 0
      };
    });

    return {
      byAgent: agentMetrics,
      overall: {
        avgEfficiency: Object.values(agentMetrics).reduce((sum: number, m: any) => sum + m.efficiency, 0) / agents.length,
        avgUtilization: agents.reduce((sum, a) => sum + (a.cpuUsage + a.memoryUsage) / 2, 0) / agents.length,
        totalTasksCompleted: agents.reduce((sum, a) => sum + a.tasksCompleted, 0)
      }
    };
  }

  /**
   * Calculate efficiency score for an agent
   */
  private static calculateEfficiencyScore(agent: LiveAgent, traces: LiveTrace[]): number {
    const weights = {
      successRate: 0.4,
      speed: 0.3,
      resourceUsage: 0.2,
      availability: 0.1
    };

    const successRate = traces.length > 0 
      ? traces.filter(t => t.status === 'success').length / traces.length 
      : 0;
    
    const speedScore = agent.averageResponseTime > 0 
      ? Math.max(0, 1 - (agent.averageResponseTime / 2000)) 
      : 0;
    
    const resourceScore = 1 - ((agent.cpuUsage + agent.memoryUsage) / 200);
    
    const availabilityScore = agent.status === 'active' ? 1 : 0;

    const efficiency = 
      successRate * weights.successRate +
      speedScore * weights.speed +
      resourceScore * weights.resourceUsage +
      availabilityScore * weights.availability;

    return Math.round(efficiency * 100);
  }
}