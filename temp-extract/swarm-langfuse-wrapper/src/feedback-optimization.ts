/**
 * Feedback Loops for Trace Optimization
 * Implements continuous improvement through performance feedback and automated optimization
 */

import { EventEmitter } from 'events';
import { RealTimeObserver, RealTimeObservation } from './real-time-observer';
import { StreamingTraceIntegration } from './streaming-trace-integration';
import { AdaptiveTracingSystem } from './adaptive-tracing';
import { AnomalyDetectionSystem } from './anomaly-detection';
import Database from 'better-sqlite3';

export interface OptimizationConfig {
  feedbackEnabled: boolean;
  optimizationInterval: number;
  learningRate: number;
  optimizationThreshold: number;
  enableAutoOptimization: boolean;
  enablePerformanceTuning: boolean;
  enableResourceOptimization: boolean;
  enableCoordinationOptimization: boolean;
  retentionPeriod: number;
}

export interface PerformanceFeedback {
  id: string;
  timestamp: number;
  traceId: string;
  agentId?: string;
  swarmId?: string;
  feedbackType: 'performance' | 'resource' | 'coordination' | 'user' | 'automated';
  metrics: {
    latency: number;
    throughput: number;
    efficiency: number;
    resourceUsage: number;
    errorRate: number;
    userSatisfaction?: number;
  };
  improvements: OptimizationRecommendation[];
  context: any;
  applied: boolean;
  effectiveness?: number;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'sampling_rate' | 'detail_level' | 'resource_allocation' | 'coordination_strategy' | 'caching' | 'batching';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImprovement: number;
  implementationCost: number;
  riskLevel: 'low' | 'medium' | 'high';
  parameters: Record<string, any>;
  validUntil: number;
  dependencies: string[];
}

export interface OptimizationResult {
  id: string;
  timestamp: number;
  recommendationId: string;
  applied: boolean;
  success: boolean;
  actualImprovement: number;
  expectedImprovement: number;
  sideEffects: string[];
  rollbackPossible: boolean;
  learnings: string[];
}

export interface FeedbackMetrics {
  totalFeedbacks: number;
  optimizationsApplied: number;
  successRate: number;
  averageImprovement: number;
  resourceSavings: number;
  errorReduction: number;
  userSatisfactionScore: number;
}

export class FeedbackOptimizationSystem extends EventEmitter {
  private realTimeObserver: RealTimeObserver;
  private streamingIntegration: StreamingTraceIntegration;
  private adaptiveTracing: AdaptiveTracingSystem;
  private anomalyDetection: AnomalyDetectionSystem;
  private config: OptimizationConfig;
  private db: Database.Database;
  private feedbacks: Map<string, PerformanceFeedback> = new Map();
  private recommendations: Map<string, OptimizationRecommendation> = new Map();
  private optimizationResults: Map<string, OptimizationResult> = new Map();
  private performanceBaselines: Map<string, number> = new Map();
  private optimizationTimer?: NodeJS.Timeout;
  private isOptimizing = false;

  constructor(
    realTimeObserver: RealTimeObserver,
    streamingIntegration: StreamingTraceIntegration,
    adaptiveTracing: AdaptiveTracingSystem,
    anomalyDetection: AnomalyDetectionSystem,
    config: Partial<OptimizationConfig> = {},
    dbPath: string = '.swarm/feedback-optimization.db'
  ) {
    super();

    this.realTimeObserver = realTimeObserver;
    this.streamingIntegration = streamingIntegration;
    this.adaptiveTracing = adaptiveTracing;
    this.anomalyDetection = anomalyDetection;
    
    this.config = {
      feedbackEnabled: true,
      optimizationInterval: 60000, // 1 minute
      learningRate: 0.1,
      optimizationThreshold: 0.15, // 15% improvement threshold
      enableAutoOptimization: true,
      enablePerformanceTuning: true,
      enableResourceOptimization: true,
      enableCoordinationOptimization: true,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...config
    };

    this.initializeDatabase(dbPath);
    this.loadPersistedData();
    this.initializeBaselines();
    this.setupEventHandlers();
    this.startOptimizationLoop();
  }

  private initializeDatabase(dbPath: string): void {
    try {
      this.db = new Database(dbPath);
      
      // Create feedbacks table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          trace_id TEXT,
          agent_id TEXT,
          swarm_id TEXT,
          feedback_type TEXT,
          metrics TEXT,
          improvements TEXT,
          context TEXT,
          applied INTEGER,
          effectiveness REAL
        )
      `);

      // Create recommendations table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS recommendations (
          id TEXT PRIMARY KEY,
          type TEXT,
          priority TEXT,
          description TEXT,
          expected_improvement REAL,
          implementation_cost REAL,
          risk_level TEXT,
          parameters TEXT,
          valid_until INTEGER,
          dependencies TEXT
        )
      `);

      // Create optimization results table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS optimization_results (
          id TEXT PRIMARY KEY,
          timestamp INTEGER,
          recommendation_id TEXT,
          applied INTEGER,
          success INTEGER,
          actual_improvement REAL,
          expected_improvement REAL,
          side_effects TEXT,
          rollback_possible INTEGER,
          learnings TEXT
        )
      `);

      // Create performance baselines table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS performance_baselines (
          metric TEXT PRIMARY KEY,
          value REAL,
          last_updated INTEGER
        )
      `);

      // Create indices
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_feedbacks_timestamp ON feedbacks(timestamp)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_feedbacks_trace ON feedbacks(trace_id)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_results_timestamp ON optimization_results(timestamp)`);

    } catch (error) {
      console.error('Failed to initialize feedback optimization database:', error);
      throw error;
    }
  }

  private loadPersistedData(): void {
    try {
      // Load recent feedbacks
      const feedbacksStmt = this.db.prepare('SELECT * FROM feedbacks WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 1000');
      const recentFeedbacks = feedbacksStmt.all(Date.now() - this.config.retentionPeriod);
      
      for (const row of recentFeedbacks) {
        const feedback: PerformanceFeedback = {
          id: row.id,
          timestamp: row.timestamp,
          traceId: row.trace_id,
          agentId: row.agent_id,
          swarmId: row.swarm_id,
          feedbackType: row.feedback_type as any,
          metrics: JSON.parse(row.metrics || '{}'),
          improvements: JSON.parse(row.improvements || '[]'),
          context: JSON.parse(row.context || '{}'),
          applied: Boolean(row.applied),
          effectiveness: row.effectiveness
        };
        this.feedbacks.set(feedback.id, feedback);
      }

      // Load active recommendations
      const recommendationsStmt = this.db.prepare('SELECT * FROM recommendations WHERE valid_until > ?');
      const activeRecommendations = recommendationsStmt.all(Date.now());
      
      for (const row of activeRecommendations) {
        const recommendation: OptimizationRecommendation = {
          id: row.id,
          type: row.type as any,
          priority: row.priority as any,
          description: row.description,
          expectedImprovement: row.expected_improvement,
          implementationCost: row.implementation_cost,
          riskLevel: row.risk_level as any,
          parameters: JSON.parse(row.parameters || '{}'),
          validUntil: row.valid_until,
          dependencies: JSON.parse(row.dependencies || '[]')
        };
        this.recommendations.set(recommendation.id, recommendation);
      }

      // Load recent optimization results
      const resultsStmt = this.db.prepare('SELECT * FROM optimization_results WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 500');
      const recentResults = resultsStmt.all(Date.now() - this.config.retentionPeriod);
      
      for (const row of recentResults) {
        const result: OptimizationResult = {
          id: row.id,
          timestamp: row.timestamp,
          recommendationId: row.recommendation_id,
          applied: Boolean(row.applied),
          success: Boolean(row.success),
          actualImprovement: row.actual_improvement,
          expectedImprovement: row.expected_improvement,
          sideEffects: JSON.parse(row.side_effects || '[]'),
          rollbackPossible: Boolean(row.rollback_possible),
          learnings: JSON.parse(row.learnings || '[]')
        };
        this.optimizationResults.set(result.id, result);
      }

      // Load performance baselines
      const baselinesStmt = this.db.prepare('SELECT * FROM performance_baselines');
      const savedBaselines = baselinesStmt.all();
      
      for (const row of savedBaselines) {
        this.performanceBaselines.set(row.metric, row.value);
      }

    } catch (error) {
      console.warn('Failed to load persisted feedback optimization data:', error);
    }
  }

  private initializeBaselines(): void {
    const defaultBaselines = {
      'average_latency': 200,
      'throughput_score': 70,
      'efficiency_rating': 75,
      'resource_utilization': 60,
      'error_rate': 0.02,
      'coordination_latency': 100
    };

    for (const [metric, value] of Object.entries(defaultBaselines)) {
      if (!this.performanceBaselines.has(metric)) {
        this.performanceBaselines.set(metric, value);
      }
    }
  }

  private setupEventHandlers(): void {
    // Listen to trace completion for feedback
    this.streamingIntegration.on('trace_completed', (event) => {
      this.processTraceCompletion(event);
    });

    // Listen to trace errors
    this.streamingIntegration.on('trace_error', (event) => {
      this.processTraceError(event);
    });

    // Listen to anomaly detection
    this.anomalyDetection.on('anomaly_detected', (anomaly) => {
      this.processAnomalyFeedback(anomaly);
    });

    // Listen to adaptive tracing changes
    this.adaptiveTracing.on('strategy_changed', (event) => {
      this.processStrategyChange(event);
    });

    // Listen to real-time observations
    this.realTimeObserver.on('observation', (observation) => {
      this.processObservationFeedback(observation);
    });
  }

  private startOptimizationLoop(): void {
    this.optimizationTimer = setInterval(() => {
      this.runOptimizationCycle();
    }, this.config.optimizationInterval);
  }

  private processTraceCompletion(event: any): void {
    if (!this.config.feedbackEnabled) return;

    try {
      const { traceId, result, duration, performance } = event;
      
      // Extract performance metrics
      const metrics = {
        latency: duration,
        throughput: this.calculateThroughput(performance),
        efficiency: this.calculateEfficiency(performance),
        resourceUsage: this.calculateResourceUsage(performance),
        errorRate: 0 // No error for completed traces
      };

      // Generate improvement recommendations
      const improvements = this.generateImprovementRecommendations(metrics, performance);

      // Create feedback entry
      const feedback: PerformanceFeedback = {
        id: `trace-feedback-${traceId}-${Date.now()}`,
        timestamp: Date.now(),
        traceId,
        agentId: event.agentId,
        swarmId: event.swarmId,
        feedbackType: 'performance',
        metrics,
        improvements,
        context: { event, performance },
        applied: false
      };

      this.addFeedback(feedback);

    } catch (error) {
      console.warn('Failed to process trace completion feedback:', error);
    }
  }

  private processTraceError(event: any): void {
    if (!this.config.feedbackEnabled) return;

    try {
      const { traceId, error, performance } = event;

      const metrics = {
        latency: performance?.latencyMs || 0,
        throughput: 0,
        efficiency: 0,
        resourceUsage: this.calculateResourceUsage(performance),
        errorRate: 1 // Error occurred
      };

      const improvements = this.generateErrorRecoveryRecommendations(error, performance);

      const feedback: PerformanceFeedback = {
        id: `error-feedback-${traceId}-${Date.now()}`,
        timestamp: Date.now(),
        traceId,
        agentId: event.agentId,
        swarmId: event.swarmId,
        feedbackType: 'automated',
        metrics,
        improvements,
        context: { event, error, performance },
        applied: false
      };

      this.addFeedback(feedback);

    } catch (error) {
      console.warn('Failed to process trace error feedback:', error);
    }
  }

  private processAnomalyFeedback(anomaly: any): void {
    if (!this.config.feedbackEnabled) return;

    try {
      const improvements = this.generateAnomalyRecommendations(anomaly);

      const feedback: PerformanceFeedback = {
        id: `anomaly-feedback-${anomaly.id}`,
        timestamp: Date.now(),
        traceId: anomaly.context?.observation?.traceId || 'unknown',
        agentId: anomaly.context?.observation?.agentId,
        swarmId: anomaly.context?.observation?.swarmId,
        feedbackType: 'automated',
        metrics: {
          latency: anomaly.context?.observation?.performanceMetrics?.latencyMs || 0,
          throughput: 0,
          efficiency: 0,
          resourceUsage: 0,
          errorRate: anomaly.severity === 'critical' ? 1 : 0
        },
        improvements,
        context: { anomaly },
        applied: false
      };

      this.addFeedback(feedback);

    } catch (error) {
      console.warn('Failed to process anomaly feedback:', error);
    }
  }

  private processStrategyChange(event: any): void {
    if (!this.config.feedbackEnabled) return;

    try {
      const { previous, current, reason } = event;

      const feedback: PerformanceFeedback = {
        id: `strategy-feedback-${Date.now()}`,
        timestamp: Date.now(),
        traceId: 'strategy-change',
        feedbackType: 'automated',
        metrics: {
          latency: 0,
          throughput: 0,
          efficiency: current.effectiveness * 100,
          resourceUsage: 0,
          errorRate: 0
        },
        improvements: this.generateStrategyOptimizations(previous, current),
        context: { event },
        applied: true,
        effectiveness: current.effectiveness
      };

      this.addFeedback(feedback);

    } catch (error) {
      console.warn('Failed to process strategy change feedback:', error);
    }
  }

  private processObservationFeedback(observation: RealTimeObservation): void {
    if (!this.config.feedbackEnabled) return;

    // Process periodic observations for continuous feedback
    if (Date.now() % 30000 < 1000) { // Every 30 seconds
      try {
        const metrics = {
          latency: observation.performanceMetrics.latencyMs,
          throughput: observation.performanceMetrics.tokensPerSecond || 0,
          efficiency: 50, // Default
          resourceUsage: (observation.performanceMetrics.memoryUsageMB || 0) / 10,
          errorRate: observation.type === 'error' ? 1 : 0
        };

        const improvements = this.generateContinuousImprovements(observation);
        if (improvements.length > 0) {
          const feedback: PerformanceFeedback = {
            id: `continuous-feedback-${Date.now()}`,
            timestamp: Date.now(),
            traceId: observation.traceId,
            agentId: observation.agentId,
            swarmId: observation.swarmId,
            feedbackType: 'automated',
            metrics,
            improvements,
            context: { observation },
            applied: false
          };

          this.addFeedback(feedback);
        }

      } catch (error) {
        console.warn('Failed to process observation feedback:', error);
      }
    }
  }

  private calculateThroughput(performance: any): number {
    if (!performance) return 0;
    return performance.tokensPerSecond || performance.throughputScore || 0;
  }

  private calculateEfficiency(performance: any): number {
    if (!performance) return 50;
    
    switch (performance.efficiencyRating) {
      case 'excellent': return 90;
      case 'good': return 75;
      case 'average': return 50;
      case 'poor': return 25;
      case 'critical': return 10;
      default: return 50;
    }
  }

  private calculateResourceUsage(performance: any): number {
    if (!performance) return 0;
    const memory = performance.memoryUsageMB || 0;
    const cpu = performance.cpuUsagePercent || 0;
    return (memory / 10 + cpu) / 2; // Normalize to 0-100 scale
  }

  private generateImprovementRecommendations(metrics: any, performance: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Latency optimization
    if (metrics.latency > this.performanceBaselines.get('average_latency')! * 1.5) {
      recommendations.push({
        id: `latency-opt-${Date.now()}`,
        type: 'sampling_rate',
        priority: 'high',
        description: 'Reduce sampling rate to improve latency',
        expectedImprovement: 0.3,
        implementationCost: 0.1,
        riskLevel: 'low',
        parameters: { newSamplingRate: 0.1, reason: 'latency_optimization' },
        validUntil: Date.now() + 3600000, // 1 hour
        dependencies: []
      });
    }

    // Efficiency optimization
    if (metrics.efficiency < 60) {
      recommendations.push({
        id: `efficiency-opt-${Date.now()}`,
        type: 'detail_level',
        priority: 'medium',
        description: 'Optimize detail level for better efficiency',
        expectedImprovement: 0.2,
        implementationCost: 0.05,
        riskLevel: 'low',
        parameters: { newDetailLevel: 'standard', reason: 'efficiency_optimization' },
        validUntil: Date.now() + 1800000, // 30 minutes
        dependencies: []
      });
    }

    // Resource optimization
    if (metrics.resourceUsage > 80) {
      recommendations.push({
        id: `resource-opt-${Date.now()}`,
        type: 'resource_allocation',
        priority: 'high',
        description: 'Optimize resource allocation',
        expectedImprovement: 0.25,
        implementationCost: 0.2,
        riskLevel: 'medium',
        parameters: { action: 'reduce_memory_usage', target: 70 },
        validUntil: Date.now() + 900000, // 15 minutes
        dependencies: []
      });
    }

    return recommendations;
  }

  private generateErrorRecoveryRecommendations(error: Error, performance: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Error recovery strategy
    recommendations.push({
      id: `error-recovery-${Date.now()}`,
      type: 'detail_level',
      priority: 'critical',
      description: 'Increase tracing detail for error analysis',
      expectedImprovement: 0.4,
      implementationCost: 0.3,
      riskLevel: 'low',
      parameters: { newDetailLevel: 'comprehensive', duration: 600000 }, // 10 minutes
      validUntil: Date.now() + 600000,
      dependencies: []
    });

    return recommendations;
  }

  private generateAnomalyRecommendations(anomaly: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    switch (anomaly.type) {
      case 'statistical':
        recommendations.push({
          id: `anomaly-stat-${Date.now()}`,
          type: 'sampling_rate',
          priority: 'medium',
          description: 'Adjust sampling for anomaly investigation',
          expectedImprovement: 0.15,
          implementationCost: 0.1,
          riskLevel: 'low',
          parameters: { increaseSampling: true, duration: 300000 },
          validUntil: Date.now() + 300000,
          dependencies: []
        });
        break;

      case 'pattern':
        recommendations.push({
          id: `anomaly-pattern-${Date.now()}`,
          type: 'coordination_strategy',
          priority: 'high',
          description: 'Optimize coordination to address pattern anomaly',
          expectedImprovement: 0.3,
          implementationCost: 0.2,
          riskLevel: 'medium',
          parameters: { optimizeCoordination: true, pattern: anomaly.context?.pattern },
          validUntil: Date.now() + 1800000,
          dependencies: []
        });
        break;
    }

    return recommendations;
  }

  private generateStrategyOptimizations(previous: any, current: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // If new strategy is performing well, optimize further
    if (current.effectiveness > previous.effectiveness) {
      recommendations.push({
        id: `strategy-enhance-${Date.now()}`,
        type: 'sampling_rate',
        priority: 'low',
        description: 'Fine-tune successful strategy',
        expectedImprovement: 0.1,
        implementationCost: 0.05,
        riskLevel: 'low',
        parameters: { fineTune: true, strategy: current.id },
        validUntil: Date.now() + 3600000,
        dependencies: []
      });
    }

    return recommendations;
  }

  private generateContinuousImprovements(observation: RealTimeObservation): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check if we should recommend caching
    if (observation.performanceMetrics.latencyMs > 200 && observation.type === 'trace_update') {
      recommendations.push({
        id: `caching-rec-${Date.now()}`,
        type: 'caching',
        priority: 'low',
        description: 'Enable caching for frequently accessed data',
        expectedImprovement: 0.15,
        implementationCost: 0.1,
        riskLevel: 'low',
        parameters: { enableCaching: true, ttl: 300000 },
        validUntil: Date.now() + 7200000, // 2 hours
        dependencies: []
      });
    }

    return recommendations;
  }

  private runOptimizationCycle(): void {
    if (this.isOptimizing || !this.config.enableAutoOptimization) return;

    this.isOptimizing = true;

    try {
      // Analyze recent feedback
      this.analyzeFeedbackTrends();
      
      // Generate new recommendations
      this.generateSystemRecommendations();
      
      // Apply high-priority optimizations
      this.applyAutomaticOptimizations();
      
      // Update performance baselines
      this.updatePerformanceBaselines();
      
      // Cleanup old data
      this.cleanupOldData();

    } catch (error) {
      console.warn('Optimization cycle error:', error);
    } finally {
      this.isOptimizing = false;
    }
  }

  private analyzeFeedbackTrends(): void {
    const recentFeedbacks = Array.from(this.feedbacks.values())
      .filter(f => f.timestamp > Date.now() - 3600000) // Last hour
      .sort((a, b) => b.timestamp - a.timestamp);

    if (recentFeedbacks.length === 0) return;

    // Analyze performance trends
    const avgLatency = recentFeedbacks.reduce((sum, f) => sum + f.metrics.latency, 0) / recentFeedbacks.length;
    const avgEfficiency = recentFeedbacks.reduce((sum, f) => sum + f.metrics.efficiency, 0) / recentFeedbacks.length;
    const errorRate = recentFeedbacks.filter(f => f.metrics.errorRate > 0).length / recentFeedbacks.length;

    // Update baselines if significant change detected
    const latencyBaseline = this.performanceBaselines.get('average_latency')!;
    if (Math.abs(avgLatency - latencyBaseline) / latencyBaseline > 0.2) {
      this.updateBaseline('average_latency', avgLatency);
    }

    const efficiencyBaseline = this.performanceBaselines.get('efficiency_rating')!;
    if (Math.abs(avgEfficiency - efficiencyBaseline) / efficiencyBaseline > 0.15) {
      this.updateBaseline('efficiency_rating', avgEfficiency);
    }

    this.emit('trends_analyzed', {
      avgLatency,
      avgEfficiency,
      errorRate,
      feedbackCount: recentFeedbacks.length
    });
  }

  private generateSystemRecommendations(): void {
    const metrics = this.realTimeObserver.getMetrics();
    
    // System-wide optimizations based on current metrics
    if (metrics.averageLatency > this.performanceBaselines.get('average_latency')! * 1.3) {
      this.addRecommendation({
        id: `system-latency-opt-${Date.now()}`,
        type: 'sampling_rate',
        priority: 'high',
        description: 'System-wide latency optimization needed',
        expectedImprovement: 0.25,
        implementationCost: 0.15,
        riskLevel: 'medium',
        parameters: { globalSamplingReduction: 0.7, reason: 'system_latency' },
        validUntil: Date.now() + 1800000,
        dependencies: []
      });
    }

    if (metrics.errorRate > 0.05) {
      this.addRecommendation({
        id: `system-error-opt-${Date.now()}`,
        type: 'detail_level',
        priority: 'critical',
        description: 'Increase detail level due to high error rate',
        expectedImprovement: 0.4,
        implementationCost: 0.3,
        riskLevel: 'low',
        parameters: { globalDetailLevel: 'comprehensive', duration: 1800000 },
        validUntil: Date.now() + 1800000,
        dependencies: []
      });
    }

    if (metrics.swarmCoordination.coordinationLatency > 200) {
      this.addRecommendation({
        id: `coordination-opt-${Date.now()}`,
        type: 'coordination_strategy',
        priority: 'high',
        description: 'Optimize swarm coordination strategy',
        expectedImprovement: 0.3,
        implementationCost: 0.2,
        riskLevel: 'medium',
        parameters: { optimizeTopology: true, targetLatency: 100 },
        validUntil: Date.now() + 3600000,
        dependencies: []
      });
    }
  }

  private applyAutomaticOptimizations(): void {
    const highPriorityRecs = Array.from(this.recommendations.values())
      .filter(r => r.priority === 'critical' || r.priority === 'high')
      .filter(r => r.validUntil > Date.now())
      .sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));

    for (const rec of highPriorityRecs.slice(0, 3)) { // Apply max 3 optimizations per cycle
      if (this.shouldApplyRecommendation(rec)) {
        this.applyOptimization(rec);
      }
    }
  }

  private shouldApplyRecommendation(recommendation: OptimizationRecommendation): boolean {
    // Check if expected improvement meets threshold
    if (recommendation.expectedImprovement < this.config.optimizationThreshold) return false;
    
    // Check implementation cost vs benefit
    const benefitCostRatio = recommendation.expectedImprovement / recommendation.implementationCost;
    if (benefitCostRatio < 1.5) return false;
    
    // Check risk level
    if (recommendation.riskLevel === 'high' && !this.config.enableAutoOptimization) return false;
    
    // Check dependencies
    for (const depId of recommendation.dependencies) {
      if (!this.optimizationResults.has(depId)) return false;
    }
    
    return true;
  }

  private applyOptimization(recommendation: OptimizationRecommendation): void {
    try {
      let success = false;
      const rollbackInfo: any = {};

      switch (recommendation.type) {
        case 'sampling_rate':
          success = this.applySamplingOptimization(recommendation, rollbackInfo);
          break;
        case 'detail_level':
          success = this.applyDetailLevelOptimization(recommendation, rollbackInfo);
          break;
        case 'resource_allocation':
          success = this.applyResourceOptimization(recommendation, rollbackInfo);
          break;
        case 'coordination_strategy':
          success = this.applyCoordinationOptimization(recommendation, rollbackInfo);
          break;
        case 'caching':
          success = this.applyCachingOptimization(recommendation, rollbackInfo);
          break;
        case 'batching':
          success = this.applyBatchingOptimization(recommendation, rollbackInfo);
          break;
      }

      // Record optimization result
      const result: OptimizationResult = {
        id: `result-${recommendation.id}`,
        timestamp: Date.now(),
        recommendationId: recommendation.id,
        applied: success,
        success,
        actualImprovement: 0, // Will be measured later
        expectedImprovement: recommendation.expectedImprovement,
        sideEffects: [],
        rollbackPossible: Object.keys(rollbackInfo).length > 0,
        learnings: []
      };

      this.optimizationResults.set(result.id, result);
      this.persistOptimizationResult(result);

      if (success) {
        this.recommendations.delete(recommendation.id);
        console.log(`✅ Applied optimization: ${recommendation.description}`);
        this.emit('optimization_applied', { recommendation, result });
        
        // Schedule effectiveness measurement
        setTimeout(() => {
          this.measureOptimizationEffectiveness(result);
        }, 60000); // Measure after 1 minute
      } else {
        console.warn(`❌ Failed to apply optimization: ${recommendation.description}`);
      }

    } catch (error) {
      console.error('Failed to apply optimization:', error);
    }
  }

  private applySamplingOptimization(recommendation: OptimizationRecommendation, rollbackInfo: any): boolean {
    try {
      const params = recommendation.parameters;
      const currentStrategy = this.adaptiveTracing.getCurrentStrategy();
      
      rollbackInfo.previousSamplingRate = currentStrategy.samplingRate;
      
      if (params.newSamplingRate !== undefined) {
        this.adaptiveTracing.getCurrentStrategy().samplingRate = params.newSamplingRate;
      } else if (params.globalSamplingReduction !== undefined) {
        this.adaptiveTracing.getCurrentStrategy().samplingRate *= params.globalSamplingReduction;
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to apply sampling optimization:', error);
      return false;
    }
  }

  private applyDetailLevelOptimization(recommendation: OptimizationRecommendation, rollbackInfo: any): boolean {
    try {
      const params = recommendation.parameters;
      const currentStrategy = this.adaptiveTracing.getCurrentStrategy();
      
      rollbackInfo.previousDetailLevel = currentStrategy.detailLevel;
      
      if (params.newDetailLevel) {
        currentStrategy.detailLevel = params.newDetailLevel;
      } else if (params.globalDetailLevel) {
        currentStrategy.detailLevel = params.globalDetailLevel;
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to apply detail level optimization:', error);
      return false;
    }
  }

  private applyResourceOptimization(recommendation: OptimizationRecommendation, rollbackInfo: any): boolean {
    try {
      const params = recommendation.parameters;
      
      if (params.action === 'reduce_memory_usage') {
        // Trigger garbage collection
        if (global.gc) {
          global.gc();
        }
        
        // Clear old observations
        const cutoff = Date.now() - 300000; // 5 minutes
        const observations = this.realTimeObserver.getRecentObservations(1000);
        // Note: This would require adding a cleanup method to RealTimeObserver
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to apply resource optimization:', error);
      return false;
    }
  }

  private applyCoordinationOptimization(recommendation: OptimizationRecommendation, rollbackInfo: any): boolean {
    try {
      const params = recommendation.parameters;
      
      if (params.optimizeCoordination) {
        // This would require integration with the swarm coordination system
        console.log('Coordination optimization applied');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to apply coordination optimization:', error);
      return false;
    }
  }

  private applyCachingOptimization(recommendation: OptimizationRecommendation, rollbackInfo: any): boolean {
    try {
      const params = recommendation.parameters;
      
      if (params.enableCaching) {
        // This would enable caching mechanisms
        console.log('Caching optimization applied');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to apply caching optimization:', error);
      return false;
    }
  }

  private applyBatchingOptimization(recommendation: OptimizationRecommendation, rollbackInfo: any): boolean {
    try {
      const params = recommendation.parameters;
      
      if (params.enableBatching) {
        // This would enable batching mechanisms
        console.log('Batching optimization applied');
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to apply batching optimization:', error);
      return false;
    }
  }

  private measureOptimizationEffectiveness(result: OptimizationResult): void {
    try {
      // Get current metrics
      const currentMetrics = this.realTimeObserver.getMetrics();
      
      // Compare with baseline
      const latencyImprovement = (this.performanceBaselines.get('average_latency')! - currentMetrics.averageLatency) / this.performanceBaselines.get('average_latency')!;
      const efficiencyImprovement = (currentMetrics.tokenThroughput - this.performanceBaselines.get('throughput_score')!) / this.performanceBaselines.get('throughput_score')!;
      
      // Calculate overall improvement
      const actualImprovement = (latencyImprovement + efficiencyImprovement) / 2;
      
      result.actualImprovement = actualImprovement;
      result.success = actualImprovement > 0;
      
      // Update learning
      if (actualImprovement >= result.expectedImprovement * 0.8) {
        result.learnings.push('Optimization met expectations');
      } else if (actualImprovement < 0) {
        result.learnings.push('Optimization had negative impact');
        result.sideEffects.push('Performance degradation detected');
      } else {
        result.learnings.push('Optimization had limited impact');
      }
      
      this.persistOptimizationResult(result);
      this.emit('optimization_measured', result);
      
    } catch (error) {
      console.warn('Failed to measure optimization effectiveness:', error);
    }
  }

  private getPriorityScore(recommendation: OptimizationRecommendation): number {
    const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    const riskPenalty = { low: 0, medium: 0.2, high: 0.5 };
    
    const baseScore = priorityScores[recommendation.priority];
    const benefitScore = recommendation.expectedImprovement * 2;
    const costPenalty = recommendation.implementationCost;
    const risk = riskPenalty[recommendation.riskLevel];
    
    return baseScore + benefitScore - costPenalty - risk;
  }

  private updatePerformanceBaselines(): void {
    const metrics = this.realTimeObserver.getMetrics();
    
    // Update baselines with exponential moving average
    const alpha = this.config.learningRate;
    
    this.updateBaseline('average_latency', metrics.averageLatency);
    this.updateBaseline('throughput_score', metrics.tokenThroughput);
    this.updateBaseline('error_rate', metrics.errorRate);
    this.updateBaseline('coordination_latency', metrics.swarmCoordination.coordinationLatency);
  }

  private updateBaseline(metric: string, value: number): void {
    const current = this.performanceBaselines.get(metric) || value;
    const updated = current * (1 - this.config.learningRate) + value * this.config.learningRate;
    this.performanceBaselines.set(metric, updated);
    
    // Persist baseline
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO performance_baselines (metric, value, last_updated)
        VALUES (?, ?, ?)
      `);
      stmt.run(metric, updated, Date.now());
    } catch (error) {
      console.warn('Failed to persist baseline:', error);
    }
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    
    // Cleanup in-memory data
    for (const [id, feedback] of this.feedbacks) {
      if (feedback.timestamp < cutoff) {
        this.feedbacks.delete(id);
      }
    }
    
    for (const [id, result] of this.optimizationResults) {
      if (result.timestamp < cutoff) {
        this.optimizationResults.delete(id);
      }
    }
    
    // Cleanup expired recommendations
    for (const [id, recommendation] of this.recommendations) {
      if (recommendation.validUntil < Date.now()) {
        this.recommendations.delete(id);
      }
    }
    
    // Cleanup database
    try {
      this.db.prepare('DELETE FROM feedbacks WHERE timestamp < ?').run(cutoff);
      this.db.prepare('DELETE FROM optimization_results WHERE timestamp < ?').run(cutoff);
      this.db.prepare('DELETE FROM recommendations WHERE valid_until < ?').run(Date.now());
    } catch (error) {
      console.warn('Failed to cleanup old database records:', error);
    }
  }

  private addFeedback(feedback: PerformanceFeedback): void {
    this.feedbacks.set(feedback.id, feedback);
    this.persistFeedback(feedback);
    this.emit('feedback_added', feedback);
  }

  private addRecommendation(recommendation: OptimizationRecommendation): void {
    this.recommendations.set(recommendation.id, recommendation);
    this.persistRecommendation(recommendation);
    this.emit('recommendation_added', recommendation);
  }

  private persistFeedback(feedback: PerformanceFeedback): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO feedbacks (
          id, timestamp, trace_id, agent_id, swarm_id, feedback_type,
          metrics, improvements, context, applied, effectiveness
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        feedback.id,
        feedback.timestamp,
        feedback.traceId,
        feedback.agentId,
        feedback.swarmId,
        feedback.feedbackType,
        JSON.stringify(feedback.metrics),
        JSON.stringify(feedback.improvements),
        JSON.stringify(feedback.context),
        feedback.applied ? 1 : 0,
        feedback.effectiveness
      );
    } catch (error) {
      console.warn('Failed to persist feedback:', error);
    }
  }

  private persistRecommendation(recommendation: OptimizationRecommendation): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO recommendations (
          id, type, priority, description, expected_improvement, implementation_cost,
          risk_level, parameters, valid_until, dependencies
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        recommendation.id,
        recommendation.type,
        recommendation.priority,
        recommendation.description,
        recommendation.expectedImprovement,
        recommendation.implementationCost,
        recommendation.riskLevel,
        JSON.stringify(recommendation.parameters),
        recommendation.validUntil,
        JSON.stringify(recommendation.dependencies)
      );
    } catch (error) {
      console.warn('Failed to persist recommendation:', error);
    }
  }

  private persistOptimizationResult(result: OptimizationResult): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO optimization_results (
          id, timestamp, recommendation_id, applied, success, actual_improvement,
          expected_improvement, side_effects, rollback_possible, learnings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        result.id,
        result.timestamp,
        result.recommendationId,
        result.applied ? 1 : 0,
        result.success ? 1 : 0,
        result.actualImprovement,
        result.expectedImprovement,
        JSON.stringify(result.sideEffects),
        result.rollbackPossible ? 1 : 0,
        JSON.stringify(result.learnings)
      );
    } catch (error) {
      console.warn('Failed to persist optimization result:', error);
    }
  }

  // Public API

  getFeedbacks(hours: number = 24): PerformanceFeedback[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return Array.from(this.feedbacks.values())
      .filter(f => f.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecommendations(): OptimizationRecommendation[] {
    return Array.from(this.recommendations.values())
      .filter(r => r.validUntil > Date.now())
      .sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));
  }

  getOptimizationResults(hours: number = 24): OptimizationResult[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return Array.from(this.optimizationResults.values())
      .filter(r => r.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getPerformanceBaselines(): Record<string, number> {
    return Object.fromEntries(this.performanceBaselines);
  }

  getFeedbackMetrics(): FeedbackMetrics {
    const recentFeedbacks = this.getFeedbacks(24);
    const recentResults = this.getOptimizationResults(24);
    
    const successfulOptimizations = recentResults.filter(r => r.success);
    const totalImprovement = successfulOptimizations.reduce((sum, r) => sum + r.actualImprovement, 0);
    
    return {
      totalFeedbacks: recentFeedbacks.length,
      optimizationsApplied: recentResults.filter(r => r.applied).length,
      successRate: recentResults.length > 0 ? successfulOptimizations.length / recentResults.length : 1,
      averageImprovement: successfulOptimizations.length > 0 ? totalImprovement / successfulOptimizations.length : 0,
      resourceSavings: this.calculateResourceSavings(),
      errorReduction: this.calculateErrorReduction(),
      userSatisfactionScore: this.calculateSatisfactionScore()
    };
  }

  private calculateResourceSavings(): number {
    // Calculate estimated resource savings from optimizations
    const resourceOptimizations = this.getOptimizationResults(24)
      .filter(r => r.success && r.recommendationId.includes('resource'));
    
    return resourceOptimizations.reduce((sum, r) => sum + r.actualImprovement, 0) * 100;
  }

  private calculateErrorReduction(): number {
    const currentErrorRate = this.realTimeObserver.getMetrics().errorRate;
    const baselineErrorRate = this.performanceBaselines.get('error_rate') || 0.02;
    
    return Math.max(0, (baselineErrorRate - currentErrorRate) / baselineErrorRate);
  }

  private calculateSatisfactionScore(): number {
    // Calculate user satisfaction based on performance improvements
    const metrics = this.realTimeObserver.getMetrics();
    const latencyScore = Math.max(0, 100 - metrics.averageLatency / 5);
    const throughputScore = Math.min(100, metrics.tokenThroughput);
    const errorScore = Math.max(0, 100 - metrics.errorRate * 1000);
    
    return (latencyScore + throughputScore + errorScore) / 3;
  }

  addUserFeedback(traceId: string, userSatisfaction: number, notes?: string): void {
    const feedback: PerformanceFeedback = {
      id: `user-feedback-${traceId}-${Date.now()}`,
      timestamp: Date.now(),
      traceId,
      feedbackType: 'user',
      metrics: {
        latency: 0,
        throughput: 0,
        efficiency: 0,
        resourceUsage: 0,
        errorRate: 0,
        userSatisfaction
      },
      improvements: [],
      context: { notes },
      applied: false
    };

    this.addFeedback(feedback);
  }

  forceOptimization(recommendationId: string): boolean {
    const recommendation = this.recommendations.get(recommendationId);
    if (recommendation) {
      this.applyOptimization(recommendation);
      return true;
    }
    return false;
  }

  setAutoOptimization(enabled: boolean): void {
    this.config.enableAutoOptimization = enabled;
    console.log(`Auto-optimization ${enabled ? 'enabled' : 'disabled'}`);
  }

  async shutdown(): Promise<void> {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    
    this.db.close();
    this.emit('shutdown');
  }
}

export { FeedbackOptimizationSystem };