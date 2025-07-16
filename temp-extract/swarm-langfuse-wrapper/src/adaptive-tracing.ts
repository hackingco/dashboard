/**
 * Adaptive Tracing System
 * Implements intelligent tracing based on performance patterns and learning
 */

import { EventEmitter } from 'events';
import { RealTimeObserver, RealTimeObservation } from './real-time-observer';
import { StreamingTraceIntegration } from './streaming-trace-integration';
import Database from 'better-sqlite3';

export interface AdaptiveConfig {
  learningRate: number;
  adaptationThreshold: number;
  performanceWindow: number;
  enablePredictiveTracing: boolean;
  enableSmartSampling: boolean;
  enableResourceOptimization: boolean;
  enableContextualAdaptation: boolean;
}

export interface TracingStrategy {
  id: string;
  name: string;
  description: string;
  samplingRate: number;
  detailLevel: 'minimal' | 'standard' | 'detailed' | 'comprehensive';
  conditions: TracingCondition[];
  priority: number;
  effectiveness: number;
  lastUsed: number;
  usageCount: number;
}

export interface TracingCondition {
  type: 'performance' | 'error_rate' | 'agent_role' | 'swarm_size' | 'resource_usage' | 'time_of_day';
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'range';
  value: any;
  weight: number;
}

export interface PerformancePattern {
  id: string;
  pattern: string;
  frequency: number;
  averageLatency: number;
  errorRate: number;
  resourceUsage: number;
  confidence: number;
  predictedStrategy: string;
  lastSeen: number;
}

export interface AdaptationEvent {
  timestamp: number;
  type: 'strategy_change' | 'sampling_adjustment' | 'pattern_detected' | 'optimization_applied';
  details: any;
  effectiveness: number;
  context: any;
}

export class AdaptiveTracingSystem extends EventEmitter {
  private realTimeObserver: RealTimeObserver;
  private streamingIntegration: StreamingTraceIntegration;
  private config: AdaptiveConfig;
  private db: Database.Database;
  private strategies: Map<string, TracingStrategy> = new Map();
  private patterns: Map<string, PerformancePattern> = new Map();
  private currentStrategy: TracingStrategy;
  private adaptationHistory: AdaptationEvent[] = [];
  private performanceBuffer: RealTimeObservation[] = [];
  private learningEnabled = true;
  private adaptationTimer?: NodeJS.Timeout;

  constructor(
    realTimeObserver: RealTimeObserver,
    streamingIntegration: StreamingTraceIntegration,
    config: Partial<AdaptiveConfig> = {},
    dbPath: string = '.swarm/adaptive-tracing.db'
  ) {
    super();

    this.realTimeObserver = realTimeObserver;
    this.streamingIntegration = streamingIntegration;
    
    this.config = {
      learningRate: 0.1,
      adaptationThreshold: 0.2,
      performanceWindow: 100,
      enablePredictiveTracing: true,
      enableSmartSampling: true,
      enableResourceOptimization: true,
      enableContextualAdaptation: true,
      ...config
    };

    this.initializeDatabase(dbPath);
    this.initializeStrategies();
    this.loadPersistedData();
    this.setupEventHandlers();
    this.startAdaptationLoop();
  }

  private initializeDatabase(dbPath: string): void {
    try {
      this.db = new Database(dbPath);
      
      // Create strategies table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS strategies (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          sampling_rate REAL,
          detail_level TEXT,
          conditions TEXT,
          priority INTEGER,
          effectiveness REAL,
          last_used INTEGER,
          usage_count INTEGER
        )
      `);

      // Create patterns table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS patterns (
          id TEXT PRIMARY KEY,
          pattern TEXT,
          frequency INTEGER,
          average_latency REAL,
          error_rate REAL,
          resource_usage REAL,
          confidence REAL,
          predicted_strategy TEXT,
          last_seen INTEGER
        )
      `);

      // Create adaptations table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS adaptations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER,
          type TEXT,
          details TEXT,
          effectiveness REAL,
          context TEXT
        )
      `);

      // Create indices
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_strategies_effectiveness ON strategies(effectiveness)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_adaptations_timestamp ON adaptations(timestamp)`);

    } catch (error) {
      console.error('Failed to initialize adaptive tracing database:', error);
      throw error;
    }
  }

  private initializeStrategies(): void {
    const defaultStrategies: TracingStrategy[] = [
      {
        id: 'high_performance',
        name: 'High Performance',
        description: 'Optimized for low latency and high throughput',
        samplingRate: 0.1,
        detailLevel: 'minimal',
        conditions: [
          { type: 'performance', operator: 'lt', value: 100, weight: 1.0 },
          { type: 'error_rate', operator: 'lt', value: 0.01, weight: 0.8 }
        ],
        priority: 1,
        effectiveness: 0.8,
        lastUsed: 0,
        usageCount: 0
      },
      {
        id: 'debugging',
        name: 'Debug Mode',
        description: 'Comprehensive tracing for debugging',
        samplingRate: 1.0,
        detailLevel: 'comprehensive',
        conditions: [
          { type: 'error_rate', operator: 'gt', value: 0.05, weight: 1.0 },
          { type: 'performance', operator: 'gt', value: 500, weight: 0.6 }
        ],
        priority: 3,
        effectiveness: 0.9,
        lastUsed: 0,
        usageCount: 0
      },
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Balanced tracing for general use',
        samplingRate: 0.3,
        detailLevel: 'standard',
        conditions: [
          { type: 'performance', operator: 'range', value: [100, 300], weight: 0.8 },
          { type: 'error_rate', operator: 'range', value: [0.01, 0.05], weight: 0.7 }
        ],
        priority: 2,
        effectiveness: 0.7,
        lastUsed: 0,
        usageCount: 0
      },
      {
        id: 'resource_constrained',
        name: 'Resource Constrained',
        description: 'Minimal tracing for resource-constrained environments',
        samplingRate: 0.05,
        detailLevel: 'minimal',
        conditions: [
          { type: 'resource_usage', operator: 'gt', value: 0.8, weight: 1.0 },
          { type: 'swarm_size', operator: 'gt', value: 10, weight: 0.6 }
        ],
        priority: 4,
        effectiveness: 0.6,
        lastUsed: 0,
        usageCount: 0
      },
      {
        id: 'coordination_focused',
        name: 'Coordination Focused',
        description: 'Optimized for swarm coordination tracking',
        samplingRate: 0.5,
        detailLevel: 'detailed',
        conditions: [
          { type: 'swarm_size', operator: 'gt', value: 5, weight: 1.0 },
          { type: 'agent_role', operator: 'contains', value: 'coordinator', weight: 0.8 }
        ],
        priority: 2,
        effectiveness: 0.75,
        lastUsed: 0,
        usageCount: 0
      }
    ];

    for (const strategy of defaultStrategies) {
      this.strategies.set(strategy.id, strategy);
    }

    // Set initial strategy
    this.currentStrategy = this.strategies.get('balanced')!;
  }

  private loadPersistedData(): void {
    try {
      // Load strategies
      const strategiesStmt = this.db.prepare('SELECT * FROM strategies');
      const savedStrategies = strategiesStmt.all();
      
      for (const row of savedStrategies) {
        const strategy: TracingStrategy = {
          id: row.id,
          name: row.name,
          description: row.description,
          samplingRate: row.sampling_rate,
          detailLevel: row.detail_level as any,
          conditions: JSON.parse(row.conditions || '[]'),
          priority: row.priority,
          effectiveness: row.effectiveness,
          lastUsed: row.last_used,
          usageCount: row.usage_count
        };
        this.strategies.set(strategy.id, strategy);
      }

      // Load patterns
      const patternsStmt = this.db.prepare('SELECT * FROM patterns');
      const savedPatterns = patternsStmt.all();
      
      for (const row of savedPatterns) {
        const pattern: PerformancePattern = {
          id: row.id,
          pattern: row.pattern,
          frequency: row.frequency,
          averageLatency: row.average_latency,
          errorRate: row.error_rate,
          resourceUsage: row.resource_usage,
          confidence: row.confidence,
          predictedStrategy: row.predicted_strategy,
          lastSeen: row.last_seen
        };
        this.patterns.set(pattern.id, pattern);
      }

      // Load recent adaptations
      const adaptationsStmt = this.db.prepare('SELECT * FROM adaptations WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 100');
      const recentAdaptations = adaptationsStmt.all(Date.now() - 86400000); // Last 24 hours
      
      this.adaptationHistory = recentAdaptations.map((row: any) => ({
        timestamp: row.timestamp,
        type: row.type,
        details: JSON.parse(row.details || '{}'),
        effectiveness: row.effectiveness,
        context: JSON.parse(row.context || '{}')
      }));

    } catch (error) {
      console.warn('Failed to load persisted adaptive tracing data:', error);
    }
  }

  private setupEventHandlers(): void {
    // Listen to real-time observations
    this.realTimeObserver.on('observation', (observation: RealTimeObservation) => {
      this.processObservation(observation);
    });

    // Listen to streaming events
    this.streamingIntegration.on('trace_completed', (event) => {
      this.evaluateTracePerformance(event);
    });

    this.streamingIntegration.on('streaming_anomaly', (event) => {
      this.handleAnomalyAdaptation(event);
    });
  }

  private startAdaptationLoop(): void {
    this.adaptationTimer = setInterval(() => {
      this.performAdaptation();
    }, 30000); // Every 30 seconds
  }

  private processObservation(observation: RealTimeObservation): void {
    if (!this.learningEnabled) return;

    // Add to performance buffer
    this.performanceBuffer.push(observation);
    
    // Keep buffer size manageable
    if (this.performanceBuffer.length > this.config.performanceWindow) {
      this.performanceBuffer.shift();
    }

    // Extract patterns
    if (this.config.enablePredictiveTracing) {
      this.extractPerformancePattern(observation);
    }

    // Apply smart sampling
    if (this.config.enableSmartSampling) {
      this.adjustSampling(observation);
    }

    // Check for immediate adaptation triggers
    this.checkImmediateAdaptation(observation);
  }

  private extractPerformancePattern(observation: RealTimeObservation): void {
    try {
      // Create pattern signature
      const signature = this.createPatternSignature(observation);
      
      let pattern = this.patterns.get(signature);
      if (!pattern) {
        pattern = {
          id: signature,
          pattern: signature,
          frequency: 0,
          averageLatency: observation.performanceMetrics.latencyMs,
          errorRate: observation.type === 'error' ? 1 : 0,
          resourceUsage: (observation.performanceMetrics.memoryUsageMB || 0) / 1000,
          confidence: 0.1,
          predictedStrategy: this.currentStrategy.id,
          lastSeen: observation.timestamp
        };
        this.patterns.set(signature, pattern);
      }

      // Update pattern
      pattern.frequency++;
      pattern.averageLatency = (pattern.averageLatency * 0.9) + (observation.performanceMetrics.latencyMs * 0.1);
      pattern.errorRate = (pattern.errorRate * 0.9) + ((observation.type === 'error' ? 1 : 0) * 0.1);
      pattern.resourceUsage = (pattern.resourceUsage * 0.9) + (((observation.performanceMetrics.memoryUsageMB || 0) / 1000) * 0.1);
      pattern.confidence = Math.min(1.0, pattern.confidence + this.config.learningRate);
      pattern.lastSeen = observation.timestamp;

      // Predict optimal strategy for this pattern
      pattern.predictedStrategy = this.predictOptimalStrategy(pattern);

      // Persist pattern
      this.persistPattern(pattern);

    } catch (error) {
      console.warn('Failed to extract performance pattern:', error);
    }
  }

  private createPatternSignature(observation: RealTimeObservation): string {
    const latencyBucket = Math.floor(observation.performanceMetrics.latencyMs / 100) * 100;
    const memoryBucket = Math.floor((observation.performanceMetrics.memoryUsageMB || 0) / 100) * 100;
    const agentRole = observation.agentRole || 'unknown';
    const hour = new Date().getHours();
    
    return `${agentRole}-${latencyBucket}ms-${memoryBucket}mb-${hour}h`;
  }

  private predictOptimalStrategy(pattern: PerformancePattern): string {
    const strategies = Array.from(this.strategies.values());
    let bestStrategy = strategies[0];
    let bestScore = -1;

    for (const strategy of strategies) {
      const score = this.calculateStrategyScore(strategy, pattern);
      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }

    return bestStrategy.id;
  }

  private calculateStrategyScore(strategy: TracingStrategy, pattern: PerformancePattern): number {
    let score = strategy.effectiveness;

    // Adjust based on pattern characteristics
    if (pattern.errorRate > 0.05 && strategy.detailLevel === 'comprehensive') {
      score += 0.3; // Prefer detailed tracing for high error rates
    }

    if (pattern.averageLatency > 500 && strategy.samplingRate < 0.2) {
      score += 0.2; // Prefer low sampling for high latency
    }

    if (pattern.resourceUsage > 0.8 && strategy.detailLevel === 'minimal') {
      score += 0.25; // Prefer minimal tracing for high resource usage
    }

    // Adjust based on recent effectiveness
    const recentUsage = strategy.usageCount > 0 ? strategy.effectiveness : 0.5;
    score = (score * 0.7) + (recentUsage * 0.3);

    return score;
  }

  private adjustSampling(observation: RealTimeObservation): void {
    if (!this.config.enableSmartSampling) return;

    const performance = observation.performanceMetrics;
    const currentSampling = this.currentStrategy.samplingRate;
    
    // Increase sampling if performance is degrading
    if (performance.latencyMs > 300 || observation.type === 'error') {
      const newSampling = Math.min(1.0, currentSampling * 1.2);
      if (newSampling !== currentSampling) {
        this.updateCurrentStrategy({ samplingRate: newSampling });
        this.recordAdaptation('sampling_adjustment', {
          from: currentSampling,
          to: newSampling,
          reason: 'performance_degradation'
        }, 0.8, { observation });
      }
    }
    // Decrease sampling if performance is good
    else if (performance.latencyMs < 100 && observation.type !== 'error') {
      const newSampling = Math.max(0.01, currentSampling * 0.9);
      if (newSampling !== currentSampling) {
        this.updateCurrentStrategy({ samplingRate: newSampling });
        this.recordAdaptation('sampling_adjustment', {
          from: currentSampling,
          to: newSampling,
          reason: 'performance_optimization'
        }, 0.7, { observation });
      }
    }
  }

  private checkImmediateAdaptation(observation: RealTimeObservation): void {
    // Critical error rate threshold
    if (observation.type === 'error' && observation.severity === 'critical') {
      this.switchToStrategy('debugging', 'critical_error_detected');
    }
    
    // Resource exhaustion
    if ((observation.performanceMetrics.memoryUsageMB || 0) > 800) {
      this.switchToStrategy('resource_constrained', 'memory_exhaustion');
    }
    
    // High performance mode
    if (observation.performanceMetrics.latencyMs < 50 && observation.type !== 'error') {
      const recentErrors = this.performanceBuffer.filter(obs => 
        obs.type === 'error' && obs.timestamp > Date.now() - 60000
      ).length;
      
      if (recentErrors === 0) {
        this.switchToStrategy('high_performance', 'optimal_conditions');
      }
    }
  }

  private performAdaptation(): void {
    if (!this.learningEnabled || this.performanceBuffer.length < 10) return;

    try {
      // Analyze recent performance
      const recentPerformance = this.analyzeRecentPerformance();
      
      // Find best strategy for current conditions
      const recommendedStrategy = this.findOptimalStrategy(recentPerformance);
      
      // Check if strategy change is warranted
      if (recommendedStrategy.id !== this.currentStrategy.id) {
        const improvement = this.estimateImprovement(recommendedStrategy, recentPerformance);
        
        if (improvement > this.config.adaptationThreshold) {
          this.switchToStrategy(recommendedStrategy.id, 'performance_optimization');
        }
      }

      // Update strategy effectiveness
      this.updateStrategyEffectiveness();
      
      // Optimize strategies based on learning
      if (this.config.enableContextualAdaptation) {
        this.optimizeStrategies();
      }

    } catch (error) {
      console.warn('Failed to perform adaptation:', error);
    }
  }

  private analyzeRecentPerformance(): any {
    const recent = this.performanceBuffer.slice(-50);
    
    const avgLatency = recent.reduce((sum, obs) => sum + obs.performanceMetrics.latencyMs, 0) / recent.length;
    const errorRate = recent.filter(obs => obs.type === 'error').length / recent.length;
    const avgMemory = recent.reduce((sum, obs) => sum + (obs.performanceMetrics.memoryUsageMB || 0), 0) / recent.length;
    
    const agentRoles = [...new Set(recent.map(obs => obs.agentRole).filter(Boolean))];
    const swarmSizes = [...new Set(recent.map(obs => obs.swarmId).filter(Boolean))].length;
    
    return {
      avgLatency,
      errorRate,
      avgMemory,
      agentRoles,
      swarmSizes,
      dataPoints: recent.length
    };
  }

  private findOptimalStrategy(performance: any): TracingStrategy {
    const strategies = Array.from(this.strategies.values());
    let bestStrategy = this.currentStrategy;
    let bestScore = -1;

    for (const strategy of strategies) {
      const score = this.evaluateStrategyForConditions(strategy, performance);
      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  private evaluateStrategyForConditions(strategy: TracingStrategy, performance: any): number {
    let score = 0;
    let totalWeight = 0;

    for (const condition of strategy.conditions) {
      const conditionMet = this.evaluateCondition(condition, performance);
      if (conditionMet) {
        score += condition.weight;
      }
      totalWeight += condition.weight;
    }

    // Normalize score and include strategy effectiveness
    const conditionScore = totalWeight > 0 ? score / totalWeight : 0;
    return (conditionScore * 0.7) + (strategy.effectiveness * 0.3);
  }

  private evaluateCondition(condition: TracingCondition, performance: any): boolean {
    let value: any;
    
    switch (condition.type) {
      case 'performance':
        value = performance.avgLatency;
        break;
      case 'error_rate':
        value = performance.errorRate;
        break;
      case 'resource_usage':
        value = performance.avgMemory / 1000; // Convert to 0-1 range
        break;
      case 'swarm_size':
        value = performance.swarmSizes;
        break;
      case 'agent_role':
        return performance.agentRoles.some((role: string) => 
          condition.operator === 'contains' ? role.includes(condition.value) : role === condition.value
        );
      default:
        return false;
    }

    switch (condition.operator) {
      case 'gt':
        return value > condition.value;
      case 'lt':
        return value < condition.value;
      case 'eq':
        return value === condition.value;
      case 'range':
        return value >= condition.value[0] && value <= condition.value[1];
      default:
        return false;
    }
  }

  private estimateImprovement(strategy: TracingStrategy, performance: any): number {
    // Estimate potential improvement based on strategy characteristics
    let improvement = 0;

    if (performance.errorRate > 0.05 && strategy.detailLevel === 'comprehensive') {
      improvement += 0.3; // Better debugging capability
    }

    if (performance.avgLatency > 300 && strategy.samplingRate < 0.2) {
      improvement += 0.25; // Reduced overhead
    }

    if (performance.avgMemory > 500 && strategy.detailLevel === 'minimal') {
      improvement += 0.2; // Resource optimization
    }

    // Factor in strategy's historical effectiveness
    improvement = (improvement * 0.6) + (strategy.effectiveness * 0.4);

    return improvement;
  }

  private switchToStrategy(strategyId: string, reason: string): void {
    const newStrategy = this.strategies.get(strategyId);
    if (!newStrategy || newStrategy.id === this.currentStrategy.id) return;

    const previousStrategy = this.currentStrategy;
    this.currentStrategy = { ...newStrategy };
    this.currentStrategy.lastUsed = Date.now();
    this.currentStrategy.usageCount++;

    this.recordAdaptation('strategy_change', {
      from: previousStrategy.id,
      to: newStrategy.id,
      reason
    }, 0.8, { previousStrategy, newStrategy });

    console.log(`🔄 Adaptive tracing switched to strategy: ${newStrategy.name} (${reason})`);
    this.emit('strategy_changed', { previous: previousStrategy, current: this.currentStrategy, reason });
  }

  private updateCurrentStrategy(updates: Partial<TracingStrategy>): void {
    Object.assign(this.currentStrategy, updates);
    this.persistStrategy(this.currentStrategy);
  }

  private updateStrategyEffectiveness(): void {
    if (this.performanceBuffer.length < 20) return;

    const recent = this.performanceBuffer.slice(-20);
    const avgLatency = recent.reduce((sum, obs) => sum + obs.performanceMetrics.latencyMs, 0) / recent.length;
    const errorRate = recent.filter(obs => obs.type === 'error').length / recent.length;

    // Calculate effectiveness based on performance
    let effectiveness = 1.0;
    effectiveness -= Math.min(0.5, avgLatency / 1000); // Penalty for high latency
    effectiveness -= Math.min(0.4, errorRate * 2); // Penalty for errors
    effectiveness = Math.max(0.1, effectiveness);

    // Update strategy effectiveness with exponential moving average
    this.currentStrategy.effectiveness = (this.currentStrategy.effectiveness * 0.8) + (effectiveness * 0.2);
    this.persistStrategy(this.currentStrategy);
  }

  private optimizeStrategies(): void {
    // Learning-based optimization of strategy parameters
    for (const [id, strategy] of this.strategies) {
      if (strategy.usageCount > 10) {
        // Optimize sampling rate based on performance
        if (strategy.effectiveness > 0.8) {
          strategy.samplingRate = Math.max(0.01, strategy.samplingRate * 0.95);
        } else if (strategy.effectiveness < 0.6) {
          strategy.samplingRate = Math.min(1.0, strategy.samplingRate * 1.05);
        }

        // Update effectiveness slowly
        if (strategy.id === this.currentStrategy.id) {
          const recentPerformance = this.analyzeRecentPerformance();
          const performanceScore = Math.max(0, 1 - (recentPerformance.avgLatency / 500) - recentPerformance.errorRate);
          strategy.effectiveness = (strategy.effectiveness * 0.95) + (performanceScore * 0.05);
        }

        this.persistStrategy(strategy);
      }
    }
  }

  private handleAnomalyAdaptation(event: any): void {
    // Rapid adaptation in response to anomalies
    const anomaly = event.anomaly;
    
    if (anomaly.severity === 'critical') {
      this.switchToStrategy('debugging', 'anomaly_detected');
    } else if (anomaly.description.includes('performance')) {
      // Temporarily increase sampling for better visibility
      const originalSampling = this.currentStrategy.samplingRate;
      this.updateCurrentStrategy({ samplingRate: Math.min(1.0, originalSampling * 2) });
      
      // Revert after 5 minutes
      setTimeout(() => {
        this.updateCurrentStrategy({ samplingRate: originalSampling });
      }, 300000);
    }
  }

  private recordAdaptation(type: AdaptationEvent['type'], details: any, effectiveness: number, context: any): void {
    const adaptation: AdaptationEvent = {
      timestamp: Date.now(),
      type,
      details,
      effectiveness,
      context
    };

    this.adaptationHistory.push(adaptation);
    
    // Keep only recent adaptations in memory
    if (this.adaptationHistory.length > 100) {
      this.adaptationHistory.shift();
    }

    // Persist to database
    try {
      const stmt = this.db.prepare(`
        INSERT INTO adaptations (timestamp, type, details, effectiveness, context)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(
        adaptation.timestamp,
        adaptation.type,
        JSON.stringify(adaptation.details),
        adaptation.effectiveness,
        JSON.stringify(adaptation.context)
      );
    } catch (error) {
      console.warn('Failed to persist adaptation:', error);
    }

    this.emit('adaptation', adaptation);
  }

  private persistStrategy(strategy: TracingStrategy): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO strategies 
        (id, name, description, sampling_rate, detail_level, conditions, priority, effectiveness, last_used, usage_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        strategy.id,
        strategy.name,
        strategy.description,
        strategy.samplingRate,
        strategy.detailLevel,
        JSON.stringify(strategy.conditions),
        strategy.priority,
        strategy.effectiveness,
        strategy.lastUsed,
        strategy.usageCount
      );
    } catch (error) {
      console.warn('Failed to persist strategy:', error);
    }
  }

  private persistPattern(pattern: PerformancePattern): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO patterns 
        (id, pattern, frequency, average_latency, error_rate, resource_usage, confidence, predicted_strategy, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        pattern.id,
        pattern.pattern,
        pattern.frequency,
        pattern.averageLatency,
        pattern.errorRate,
        pattern.resourceUsage,
        pattern.confidence,
        pattern.predictedStrategy,
        pattern.lastSeen
      );
    } catch (error) {
      console.warn('Failed to persist pattern:', error);
    }
  }

  private evaluateTracePerformance(event: any): void {
    const { traceId, result, duration, performance } = event;
    
    // Record trace performance for learning
    const effectiveness = this.calculateTraceEffectiveness(duration, performance);
    this.currentStrategy.effectiveness = (this.currentStrategy.effectiveness * 0.9) + (effectiveness * 0.1);
    
    this.persistStrategy(this.currentStrategy);
  }

  private calculateTraceEffectiveness(duration: number, performance: any): number {
    let effectiveness = 1.0;
    
    // Factor in duration (prefer shorter traces)
    effectiveness -= Math.min(0.4, duration / 5000);
    
    // Factor in efficiency rating
    if (performance.efficiencyRating === 'excellent') effectiveness += 0.1;
    else if (performance.efficiencyRating === 'poor') effectiveness -= 0.2;
    else if (performance.efficiencyRating === 'critical') effectiveness -= 0.4;
    
    return Math.max(0.1, Math.min(1.0, effectiveness));
  }

  // Public API

  getCurrentStrategy(): TracingStrategy {
    return { ...this.currentStrategy };
  }

  getStrategies(): TracingStrategy[] {
    return Array.from(this.strategies.values());
  }

  getPatterns(): PerformancePattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.confidence - a.confidence);
  }

  getAdaptationHistory(): AdaptationEvent[] {
    return [...this.adaptationHistory];
  }

  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    console.log(`Adaptive learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  forceStrategySwitch(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      this.switchToStrategy(strategyId, 'manual_override');
      return true;
    }
    return false;
  }

  addCustomStrategy(strategy: TracingStrategy): void {
    this.strategies.set(strategy.id, strategy);
    this.persistStrategy(strategy);
    console.log(`Added custom strategy: ${strategy.name}`);
  }

  removeStrategy(strategyId: string): boolean {
    if (this.strategies.size <= 1 || strategyId === this.currentStrategy.id) {
      return false; // Don't remove last strategy or current strategy
    }
    
    this.strategies.delete(strategyId);
    try {
      this.db.prepare('DELETE FROM strategies WHERE id = ?').run(strategyId);
    } catch (error) {
      console.warn('Failed to remove strategy from database:', error);
    }
    
    return true;
  }

  getAdaptiveMetrics(): any {
    return {
      currentStrategy: this.currentStrategy.name,
      strategiesCount: this.strategies.size,
      patternsCount: this.patterns.size,
      adaptationsCount: this.adaptationHistory.length,
      learningEnabled: this.learningEnabled,
      performanceBufferSize: this.performanceBuffer.length,
      averageEffectiveness: Array.from(this.strategies.values())
        .reduce((sum, s) => sum + s.effectiveness, 0) / this.strategies.size
    };
  }

  async shutdown(): Promise<void> {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
    }
    
    this.db.close();
    this.emit('shutdown');
  }
}

export { AdaptiveTracingSystem };