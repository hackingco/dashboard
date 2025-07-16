/**
 * Langfuse Timing Optimization System
 * Optimizes flush timing for maximum trace delivery reliability
 */

import { EventEmitter } from 'events';

// Types for timing optimization
interface TimingProfile {
  id: string;
  name: string;
  flushDelay: number;
  retryDelay: number;
  batchSize: number;
  successRate: number;
  averageLatency: number;
  lastUsed: number;
}

interface TimingMetrics {
  totalOperations: number;
  successfulOperations: number;
  averageSuccessRate: number;
  optimalFlushDelay: number;
  optimalBatchSize: number;
  peakPerformanceTime: number;
  worstPerformanceTime: number;
}

interface FlushSchedule {
  traceCount: number;
  estimatedFlushTime: number;
  optimalDelay: number;
  confidence: number;
  reasoning: string;
}

/**
 * Intelligent timing optimizer for Langfuse flushes
 */
export class LangfuseTimingOptimizer extends EventEmitter {
  private profiles: Map<string, TimingProfile> = new Map();
  private metrics: TimingMetrics;
  private currentProfile: TimingProfile | null = null;
  private learningEnabled: boolean = true;
  private adaptiveMode: boolean = true;

  constructor() {
    super();
    
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      averageSuccessRate: 0,
      optimalFlushDelay: 100, // Default optimal delay
      optimalBatchSize: 50,   // Default optimal batch size
      peakPerformanceTime: Date.now(),
      worstPerformanceTime: Date.now(),
    };

    this.initializeDefaultProfiles();
  }

  /**
   * Get optimal flush timing for given trace count
   */
  public getOptimalTiming(traceCount: number, context?: {
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    systemLoad?: number;
    networkLatency?: number;
  }): FlushSchedule {
    const profile = this.selectOptimalProfile(traceCount, context);
    
    let delay = profile.flushDelay;
    let confidence = 0.8; // Base confidence
    let reasoning = `Using ${profile.name} profile`;

    // Adjust based on context
    if (context?.urgency) {
      switch (context.urgency) {
        case 'critical':
          delay = 0; // Immediate flush
          confidence = 0.9;
          reasoning += ' with critical urgency override';
          break;
        case 'high':
          delay = Math.min(delay, 50);
          confidence = 0.85;
          reasoning += ' with high urgency adjustment';
          break;
        case 'low':
          delay = Math.max(delay, 500);
          confidence = 0.75;
          reasoning += ' with low urgency relaxation';
          break;
      }
    }

    // System load adjustments
    if (context?.systemLoad) {
      if (context.systemLoad > 0.8) {
        delay += 200; // Delay more under high load
        confidence -= 0.1;
        reasoning += ', adjusted for high system load';
      } else if (context.systemLoad < 0.3) {
        delay = Math.max(0, delay - 100); // Faster under low load
        confidence += 0.05;
        reasoning += ', optimized for low system load';
      }
    }

    // Network latency adjustments
    if (context?.networkLatency) {
      if (context.networkLatency > 200) {
        delay += context.networkLatency * 0.5; // Account for slow network
        confidence -= 0.1;
        reasoning += ', adjusted for network latency';
      }
    }

    return {
      traceCount,
      estimatedFlushTime: this.estimateFlushTime(traceCount, delay),
      optimalDelay: Math.max(0, delay),
      confidence: Math.max(0.3, Math.min(1.0, confidence)),
      reasoning,
    };
  }

  /**
   * Smart delay calculation based on trace characteristics
   */
  public calculateSmartDelay(traces: any[]): number {
    if (!traces || traces.length === 0) return 0;

    let baseDelay = 100; // Base delay in ms
    const traceCount = traces.length;

    // Adjust based on trace count
    if (traceCount <= 5) {
      baseDelay = 50; // Quick flush for small batches
    } else if (traceCount <= 20) {
      baseDelay = 100; // Standard delay
    } else if (traceCount <= 50) {
      baseDelay = 200; // Longer delay for large batches
    } else {
      baseDelay = 500; // Extended delay for very large batches
    }

    // Analyze trace complexity
    const complexityScore = this.analyzeTraceComplexity(traces);
    const complexityAdjustment = complexityScore * 50; // Up to 50ms additional delay

    // Check for dependent traces
    const dependencyDelay = this.calculateDependencyDelay(traces);

    // Historical performance adjustment
    const historicalAdjustment = this.getHistoricalAdjustment();

    const totalDelay = baseDelay + complexityAdjustment + dependencyDelay + historicalAdjustment;

    console.log(`⏱️ Smart delay calculation:
      Base: ${baseDelay}ms
      Complexity: +${complexityAdjustment}ms
      Dependencies: +${dependencyDelay}ms
      Historical: +${historicalAdjustment}ms
      Total: ${totalDelay}ms`);

    return Math.max(0, Math.min(2000, totalDelay)); // Cap at 2 seconds
  }

  /**
   * Optimal batch sizing for flush operations
   */
  public getOptimalBatchSize(totalTraces: number, context?: {
    memoryLimit?: number;
    timeLimit?: number;
    reliability?: 'high' | 'medium' | 'low';
  }): number[] {
    let batchSize = this.metrics.optimalBatchSize;

    // Adjust based on context
    if (context?.reliability === 'high') {
      batchSize = Math.min(batchSize, 25); // Smaller batches for higher reliability
    } else if (context?.reliability === 'low') {
      batchSize = Math.min(batchSize * 2, 100); // Larger batches for speed
    }

    // Memory limit adjustments
    if (context?.memoryLimit) {
      const memoryBasedBatch = Math.floor(context.memoryLimit / 1024); // Estimate 1KB per trace
      batchSize = Math.min(batchSize, memoryBasedBatch);
    }

    // Time limit adjustments
    if (context?.timeLimit) {
      const timeBasedBatch = Math.floor(context.timeLimit / 100); // Estimate 100ms per batch
      batchSize = Math.min(batchSize, timeBasedBatch);
    }

    // Calculate batch distribution
    const batches: number[] = [];
    let remaining = totalTraces;
    
    while (remaining > 0) {
      const currentBatch = Math.min(remaining, batchSize);
      batches.push(currentBatch);
      remaining -= currentBatch;
    }

    return batches;
  }

  /**
   * Adaptive timing based on real-time conditions
   */
  public async getAdaptiveTiming(): Promise<{
    delay: number;
    confidence: number;
    factors: Record<string, number>;
  }> {
    const factors: Record<string, number> = {};
    
    // Measure current system performance
    const systemMetrics = await this.measureSystemPerformance();
    factors.systemLoad = systemMetrics.cpuUsage;
    factors.memoryUsage = systemMetrics.memoryUsage;
    
    // Network latency test
    const networkLatency = await this.measureNetworkLatency();
    factors.networkLatency = networkLatency;
    
    // Historical success rate
    const historicalFactor = this.metrics.averageSuccessRate;
    factors.historicalSuccess = historicalFactor;
    
    // Time of day performance (some hours might be better)
    const timeOfDayFactor = this.getTimeOfDayFactor();
    factors.timeOfDay = timeOfDayFactor;
    
    // Calculate adaptive delay
    let delay = this.metrics.optimalFlushDelay;
    let confidence = 0.8;
    
    // System load adjustment
    if (factors.systemLoad > 0.8) {
      delay += 300;
      confidence -= 0.2;
    } else if (factors.systemLoad < 0.3) {
      delay = Math.max(0, delay - 100);
      confidence += 0.1;
    }
    
    // Network adjustment
    if (factors.networkLatency > 200) {
      delay += factors.networkLatency * 0.5;
      confidence -= 0.1;
    }
    
    // Historical adjustment
    if (factors.historicalSuccess < 0.8) {
      delay += 200;
      confidence -= 0.1;
    }
    
    // Time of day adjustment
    delay += timeOfDayFactor * 100;
    
    return {
      delay: Math.max(0, Math.min(2000, delay)),
      confidence: Math.max(0.3, Math.min(1.0, confidence)),
      factors,
    };
  }

  /**
   * Learn from flush operation results
   */
  public learnFromResult(operation: {
    traceCount: number;
    flushDelay: number;
    success: boolean;
    duration: number;
    error?: Error;
  }): void {
    if (!this.learningEnabled) return;

    this.metrics.totalOperations++;
    if (operation.success) {
      this.metrics.successfulOperations++;
    }

    this.metrics.averageSuccessRate = 
      this.metrics.successfulOperations / this.metrics.totalOperations;

    // Update optimal values based on success
    if (operation.success) {
      // Successful operations influence optimal values
      this.metrics.optimalFlushDelay = 
        (this.metrics.optimalFlushDelay * 0.8) + (operation.flushDelay * 0.2);
      
      // Update peak performance tracking
      if (operation.duration < 1000) { // Consider fast operations as peak
        this.metrics.peakPerformanceTime = Date.now();
      }
    } else {
      // Failed operations suggest we need more delay
      this.metrics.optimalFlushDelay = Math.min(
        this.metrics.optimalFlushDelay * 1.2, 
        2000
      );
      
      this.metrics.worstPerformanceTime = Date.now();
    }

    // Update or create profile
    this.updateProfile(operation);

    console.log(`📊 Learning from operation: ${operation.success ? 'SUCCESS' : 'FAILURE'}
      Delay: ${operation.flushDelay}ms
      Duration: ${operation.duration}ms
      New optimal delay: ${this.metrics.optimalFlushDelay}ms
      Success rate: ${(this.metrics.averageSuccessRate * 100).toFixed(1)}%`);
  }

  /**
   * Get comprehensive timing recommendations
   */
  public getTimingRecommendations(traces: any[]): {
    immediate: FlushSchedule;
    optimal: FlushSchedule;
    safe: FlushSchedule;
    recommendations: string[];
  } {
    const traceCount = traces.length;
    
    const immediate = this.getOptimalTiming(traceCount, { urgency: 'critical' });
    const optimal = this.getOptimalTiming(traceCount, { urgency: 'medium' });
    const safe = this.getOptimalTiming(traceCount, { urgency: 'low' });

    const recommendations: string[] = [];

    if (traceCount < 5) {
      recommendations.push('Small batch detected - consider immediate flush');
    } else if (traceCount > 100) {
      recommendations.push('Large batch detected - consider splitting into smaller batches');
    }

    if (this.metrics.averageSuccessRate < 0.8) {
      recommendations.push('Recent failures detected - recommend safe timing');
    }

    const currentHour = new Date().getHours();
    if (currentHour >= 9 && currentHour <= 17) {
      recommendations.push('Peak hours - system may be under higher load');
    }

    return {
      immediate,
      optimal,
      safe,
      recommendations,
    };
  }

  /**
   * Monitor timing performance
   */
  public async monitorPerformance(duration: number = 60000): Promise<void> {
    console.log(`📊 Starting timing performance monitoring for ${duration}ms...`);
    
    const startTime = Date.now();
    const interval = setInterval(async () => {
      const adaptive = await this.getAdaptiveTiming();
      
      console.log(`⏱️ Current timing state:
        Optimal delay: ${adaptive.delay}ms
        Confidence: ${(adaptive.confidence * 100).toFixed(1)}%
        Success rate: ${(this.metrics.averageSuccessRate * 100).toFixed(1)}%
        System load: ${adaptive.factors.systemLoad?.toFixed(2) || 'N/A'}
        Network latency: ${adaptive.factors.networkLatency?.toFixed(0) || 'N/A'}ms`);
      
      this.emit('performance-update', {
        timestamp: Date.now(),
        metrics: this.metrics,
        adaptive,
      });
    }, 5000);

    setTimeout(() => {
      clearInterval(interval);
      console.log('✅ Performance monitoring complete');
    }, duration);
  }

  // Private helper methods

  private initializeDefaultProfiles(): void {
    const profiles: TimingProfile[] = [
      {
        id: 'fast',
        name: 'Fast Flush',
        flushDelay: 50,
        retryDelay: 500,
        batchSize: 25,
        successRate: 0.9,
        averageLatency: 200,
        lastUsed: 0,
      },
      {
        id: 'standard',
        name: 'Standard Flush',
        flushDelay: 100,
        retryDelay: 1000,
        batchSize: 50,
        successRate: 0.95,
        averageLatency: 300,
        lastUsed: 0,
      },
      {
        id: 'reliable',
        name: 'Reliable Flush',
        flushDelay: 200,
        retryDelay: 2000,
        batchSize: 75,
        successRate: 0.98,
        averageLatency: 500,
        lastUsed: 0,
      },
      {
        id: 'bulk',
        name: 'Bulk Flush',
        flushDelay: 500,
        retryDelay: 3000,
        batchSize: 100,
        successRate: 0.92,
        averageLatency: 800,
        lastUsed: 0,
      },
    ];

    profiles.forEach(profile => {
      this.profiles.set(profile.id, profile);
    });
  }

  private selectOptimalProfile(traceCount: number, context?: any): TimingProfile {
    const profiles = Array.from(this.profiles.values());
    
    // Score each profile based on current conditions
    const scoredProfiles = profiles.map(profile => {
      let score = profile.successRate; // Base score on success rate
      
      // Adjust for trace count suitability
      const batchFit = Math.abs(profile.batchSize - traceCount) / traceCount;
      score -= batchFit * 0.2; // Penalize poor batch fit
      
      // Boost recently successful profiles
      const timeSinceUsed = Date.now() - profile.lastUsed;
      if (timeSinceUsed < 300000) { // 5 minutes
        score += 0.1;
      }
      
      return { profile, score };
    });

    // Sort by score and return best
    scoredProfiles.sort((a, b) => b.score - a.score);
    const selected = scoredProfiles[0].profile;
    
    // Update last used time
    selected.lastUsed = Date.now();
    this.currentProfile = selected;
    
    return selected;
  }

  private analyzeTraceComplexity(traces: any[]): number {
    if (!traces || traces.length === 0) return 0;
    
    let complexity = 0;
    
    traces.forEach(trace => {
      // Size complexity
      const size = JSON.stringify(trace).length;
      complexity += size / 10000; // Normalize to 0-1 range
      
      // Metadata complexity
      if (trace.metadata && Object.keys(trace.metadata).length > 10) {
        complexity += 0.2;
      }
      
      // Nested structure complexity
      if (trace.spans && trace.spans.length > 5) {
        complexity += 0.3;
      }
    });
    
    return Math.min(complexity / traces.length, 1.0);
  }

  private calculateDependencyDelay(traces: any[]): number {
    // Check for traces that might have dependencies
    const dependentTraces = traces.filter(trace => 
      trace.parentObservationId || trace.sessionId
    );
    
    if (dependentTraces.length > traces.length * 0.5) {
      return 100; // Add delay for dependent traces
    }
    
    return 0;
  }

  private getHistoricalAdjustment(): number {
    const successRate = this.metrics.averageSuccessRate;
    
    if (successRate < 0.7) {
      return 200; // Significant delay for poor performance
    } else if (successRate < 0.8) {
      return 100; // Moderate delay for average performance
    } else if (successRate > 0.95) {
      return -50; // Reduce delay for excellent performance
    }
    
    return 0;
  }

  private estimateFlushTime(traceCount: number, delay: number): number {
    // Base flush time estimation
    const baseTime = 100; // Base 100ms
    const traceTime = traceCount * 5; // 5ms per trace
    const networkTime = 50; // Network overhead
    
    return delay + baseTime + traceTime + networkTime;
  }

  private async measureSystemPerformance(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
  }> {
    // Simple system metrics (would be more sophisticated in production)
    const memoryUsage = process.memoryUsage();
    const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    return {
      cpuUsage: Math.random() * 0.8, // Mock CPU usage
      memoryUsage: memoryPercent,
    };
  }

  private async measureNetworkLatency(): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Simple ping-like measurement
      const response = await fetch('https://httpbin.org/delay/0', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        return Date.now() - startTime;
      }
    } catch (error) {
      // Fallback to default
    }
    
    return 100; // Default latency
  }

  private getTimeOfDayFactor(): number {
    const hour = new Date().getHours();
    
    // Peak hours (9-17) get penalty
    if (hour >= 9 && hour <= 17) {
      return 0.5; // Increase delay during peak hours
    }
    
    // Off hours get bonus
    if (hour >= 22 || hour <= 6) {
      return -0.3; // Decrease delay during off hours
    }
    
    return 0; // Neutral for other hours
  }

  private updateProfile(operation: any): void {
    if (!this.currentProfile) return;
    
    const profile = this.currentProfile;
    
    // Update success rate with exponential moving average
    const alpha = 0.2; // Learning rate
    profile.successRate = (1 - alpha) * profile.successRate + alpha * (operation.success ? 1 : 0);
    
    // Update average latency
    profile.averageLatency = (1 - alpha) * profile.averageLatency + alpha * operation.duration;
    
    // Update last used
    profile.lastUsed = Date.now();
    
    console.log(`📊 Updated profile ${profile.name}:
      Success rate: ${(profile.successRate * 100).toFixed(1)}%
      Average latency: ${profile.averageLatency.toFixed(0)}ms`);
  }
}

// Export singleton instance
export const timingOptimizer = new LangfuseTimingOptimizer();

// Export for testing
export default timingOptimizer;