/**
 * Pattern Recognition Engine for Claude Flow
 * Automatically identifies and analyzes successful coordination strategies and patterns
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MemoryService } from './MemoryService';
import { performance } from 'perf_hooks';

export interface CoordinationPattern {
  id: string;
  patternType: 'topology' | 'task_distribution' | 'communication' | 'resource_allocation' | 'error_recovery' | 'optimization';
  signature: string; // Hash of the pattern characteristics
  name: string;
  description: string;
  
  characteristics: {
    conditions: Record<string, any>;
    behaviors: Record<string, any>;
    outcomes: Record<string, any>;
    metrics: Record<string, number>;
  };
  
  effectiveness: {
    successRate: number;
    avgPerformanceImprovement: number;
    consistencyScore: number;
    applicabilityScore: number;
  };
  
  context: {
    swarmSizes: number[];
    topologies: string[];
    taskTypes: string[];
    agentRoles: string[];
    environmentFactors: Record<string, any>;
  };
  
  occurrence: {
    frequency: number;
    firstSeen: number;
    lastSeen: number;
    swarmIds: string[];
    traceIds: string[];
  };
  
  learning: {
    confidence: number;
    stabilityScore: number; // How consistent the pattern is
    evolutionTrend: 'improving' | 'stable' | 'declining';
    refinementSuggestions: string[];
  };
}

export interface PatternAnalysisResult {
  patternsFound: CoordinationPattern[];
  newPatterns: CoordinationPattern[];
  evolvedPatterns: CoordinationPattern[];
  antiPatterns: CoordinationPattern[];
  insights: {
    mostEffectivePattern: CoordinationPattern | null;
    emergingTrends: string[];
    recommendedActions: string[];
    riskFactors: string[];
  };
  analysisMetrics: {
    processingTime: number;
    dataPointsAnalyzed: number;
    confidenceLevel: number;
    coveragePercentage: number;
  };
}

export interface SwarmBehaviorSnapshot {
  swarmId: string;
  timestamp: number;
  state: {
    topology: string;
    agentCount: number;
    agentRoles: Record<string, number>;
    currentTasks: number;
    resourceUtilization: Record<string, number>;
  };
  metrics: {
    throughput: number;
    responseTime: number;
    errorRate: number;
    coordinationOverhead: number;
    memoryUsage: number;
    tokenUsage: number;
  };
  behavior: {
    communicationPattern: string;
    taskDistributionStrategy: string;
    loadBalancingApproach: string;
    errorHandlingMethod: string;
  };
  outcome: {
    success: boolean;
    performanceScore: number;
    qualityScore: number;
    efficiencyScore: number;
    issues: string[];
  };
}

export interface PatternEvolution {
  patternId: string;
  evolutionType: 'improvement' | 'adaptation' | 'specialization' | 'generalization';
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
    delta: Record<string, number>;
  };
  trigger: string;
  impact: {
    performanceChange: number;
    applicabilityChange: number;
    confidenceChange: number;
  };
  timestamp: number;
}

export class PatternRecognitionEngine extends EventEmitter {
  private db: Database.Database;
  private memoryService: MemoryService;
  private patterns: Map<string, CoordinationPattern> = new Map();
  private behaviorHistory: SwarmBehaviorSnapshot[] = [];
  private analysisQueue: SwarmBehaviorSnapshot[] = [];
  private isAnalyzing = false;
  
  private config = {
    minOccurrencesForPattern: 3,
    minSuccessRateForPattern: 0.6,
    maxPatternAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    analysisInterval: 60000, // 1 minute
    batchSize: 50,
    confidenceThreshold: 0.7
  };

  constructor(dbPath: string = '.swarm/patterns.db', memoryService: MemoryService) {
    super();
    
    this.memoryService = memoryService;
    this.db = new Database(dbPath);
    this.initializeSchema();
    this.loadExistingPatterns();
    this.startPeriodicAnalysis();
  }

  private initializeSchema(): void {
    // Coordination patterns table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS coordination_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,
        signature TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        
        characteristics TEXT NOT NULL, -- JSON
        effectiveness TEXT NOT NULL, -- JSON
        context TEXT NOT NULL, -- JSON
        occurrence TEXT NOT NULL, -- JSON
        learning TEXT NOT NULL, -- JSON
        
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Behavior snapshots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swarm_behavior_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swarm_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        
        state TEXT NOT NULL, -- JSON
        metrics TEXT NOT NULL, -- JSON
        behavior TEXT NOT NULL, -- JSON
        outcome TEXT NOT NULL, -- JSON
        
        patterns_detected TEXT, -- JSON array of pattern IDs
        analysis_status TEXT DEFAULT 'pending',
        
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Pattern evolution tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_evolution (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT NOT NULL,
        evolution_type TEXT NOT NULL,
        changes TEXT NOT NULL, -- JSON
        trigger_event TEXT NOT NULL,
        impact TEXT NOT NULL, -- JSON
        timestamp INTEGER NOT NULL,
        
        FOREIGN KEY(pattern_id) REFERENCES coordination_patterns(id)
      )
    `);

    // Pattern relationships
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_pattern_id TEXT NOT NULL,
        target_pattern_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL, -- 'depends_on', 'conflicts_with', 'enhances', 'derived_from'
        strength REAL NOT NULL CHECK(strength >= 0 AND strength <= 1),
        discovered_at INTEGER DEFAULT (strftime('%s', 'now')),
        
        FOREIGN KEY(source_pattern_id) REFERENCES coordination_patterns(id),
        FOREIGN KEY(target_pattern_id) REFERENCES coordination_patterns(id),
        UNIQUE(source_pattern_id, target_pattern_id, relationship_type)
      )
    `);

    // Analysis cache for performance
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pattern_analysis_cache (
        id TEXT PRIMARY KEY,
        analysis_type TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        result TEXT NOT NULL, -- JSON
        confidence REAL NOT NULL,
        generated_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON coordination_patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_patterns_signature ON coordination_patterns(signature);
      CREATE INDEX IF NOT EXISTS idx_snapshots_swarm ON swarm_behavior_snapshots(swarm_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON swarm_behavior_snapshots(timestamp);
      CREATE INDEX IF NOT EXISTS idx_evolution_pattern ON pattern_evolution(pattern_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON pattern_relationships(source_pattern_id);
      CREATE INDEX IF NOT EXISTS idx_cache_type ON pattern_analysis_cache(analysis_type);
    `);

    console.log('Pattern recognition database schema initialized');
  }

  /**
   * Record a swarm behavior snapshot for analysis
   */
  async recordBehaviorSnapshot(snapshot: SwarmBehaviorSnapshot): Promise<void> {
    // Store in database
    this.db.prepare(`
      INSERT INTO swarm_behavior_snapshots 
      (swarm_id, timestamp, state, metrics, behavior, outcome)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.swarmId,
      snapshot.timestamp,
      JSON.stringify(snapshot.state),
      JSON.stringify(snapshot.metrics),
      JSON.stringify(snapshot.behavior),
      JSON.stringify(snapshot.outcome)
    );

    // Add to analysis queue
    this.analysisQueue.push(snapshot);
    this.behaviorHistory.push(snapshot);

    // Trigger immediate analysis if queue is large enough
    if (this.analysisQueue.length >= this.config.batchSize && !this.isAnalyzing) {
      await this.runPatternAnalysis();
    }

    this.emit('behavior_recorded', {
      swarmId: snapshot.swarmId,
      timestamp: snapshot.timestamp,
      queueSize: this.analysisQueue.length
    });
  }

  /**
   * Analyze patterns in recorded behavior data
   */
  async runPatternAnalysis(): Promise<PatternAnalysisResult> {
    if (this.isAnalyzing) {
      throw new Error('Pattern analysis already in progress');
    }

    this.isAnalyzing = true;
    const startTime = performance.now();

    try {
      const snapshots = this.analysisQueue.splice(0, this.config.batchSize);
      
      const result: PatternAnalysisResult = {
        patternsFound: [],
        newPatterns: [],
        evolvedPatterns: [],
        antiPatterns: [],
        insights: {
          mostEffectivePattern: null,
          emergingTrends: [],
          recommendedActions: [],
          riskFactors: []
        },
        analysisMetrics: {
          processingTime: 0,
          dataPointsAnalyzed: snapshots.length,
          confidenceLevel: 0,
          coveragePercentage: 0
        }
      };

      // Analyze different pattern types
      const topologyPatterns = await this.analyzeTopologyPatterns(snapshots);
      const taskPatterns = await this.analyzeTaskDistributionPatterns(snapshots);
      const communicationPatterns = await this.analyzeCommunicationPatterns(snapshots);
      const resourcePatterns = await this.analyzeResourceAllocationPatterns(snapshots);
      const errorPatterns = await this.analyzeErrorRecoveryPatterns(snapshots);

      result.patternsFound = [
        ...topologyPatterns,
        ...taskPatterns,
        ...communicationPatterns,
        ...resourcePatterns,
        ...errorPatterns
      ];

      // Identify new patterns
      for (const pattern of result.patternsFound) {
        if (!this.patterns.has(pattern.id)) {
          result.newPatterns.push(pattern);
          this.patterns.set(pattern.id, pattern);
          await this.storePattern(pattern);
        } else {
          // Check for pattern evolution
          const existingPattern = this.patterns.get(pattern.id)!;
          const evolution = this.detectPatternEvolution(existingPattern, pattern);
          
          if (evolution) {
            result.evolvedPatterns.push(pattern);
            await this.recordPatternEvolution(evolution);
            this.patterns.set(pattern.id, pattern);
            await this.updatePattern(pattern);
          }
        }
      }

      // Identify anti-patterns (consistently poor performing patterns)
      result.antiPatterns = await this.identifyAntiPatterns(snapshots);

      // Generate insights
      result.insights = await this.generateInsights(result.patternsFound, snapshots);

      // Calculate analysis metrics
      const endTime = performance.now();
      result.analysisMetrics.processingTime = endTime - startTime;
      result.analysisMetrics.confidenceLevel = this.calculateOverallConfidence(result.patternsFound);
      result.analysisMetrics.coveragePercentage = this.calculateCoveragePercentage(snapshots, result.patternsFound);

      // Store analysis results in memory
      await this.memoryService.store(
        `pattern_analysis_${Date.now()}`,
        result,
        'pattern_analysis'
      );

      this.emit('analysis_completed', {
        newPatterns: result.newPatterns.length,
        evolvedPatterns: result.evolvedPatterns.length,
        totalPatterns: result.patternsFound.length,
        processingTime: result.analysisMetrics.processingTime
      });

      return result;

    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Get patterns that match specific criteria
   */
  getPatterns(criteria: {
    type?: string;
    minSuccessRate?: number;
    minConfidence?: number;
    swarmId?: string;
    taskType?: string;
    topology?: string;
    recentOnly?: boolean;
  } = {}): CoordinationPattern[] {
    
    let patterns = Array.from(this.patterns.values());

    // Apply filters
    if (criteria.type) {
      patterns = patterns.filter(p => p.patternType === criteria.type);
    }

    if (criteria.minSuccessRate !== undefined) {
      patterns = patterns.filter(p => p.effectiveness.successRate >= criteria.minSuccessRate);
    }

    if (criteria.minConfidence !== undefined) {
      patterns = patterns.filter(p => p.learning.confidence >= criteria.minConfidence);
    }

    if (criteria.topology) {
      patterns = patterns.filter(p => p.context.topologies.includes(criteria.topology));
    }

    if (criteria.taskType) {
      patterns = patterns.filter(p => p.context.taskTypes.includes(criteria.taskType));
    }

    if (criteria.swarmId) {
      patterns = patterns.filter(p => p.occurrence.swarmIds.includes(criteria.swarmId));
    }

    if (criteria.recentOnly) {
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      patterns = patterns.filter(p => p.occurrence.lastSeen > cutoff);
    }

    // Sort by effectiveness and confidence
    return patterns.sort((a, b) => {
      const scoreA = (a.effectiveness.successRate * 0.6) + (a.learning.confidence * 0.4);
      const scoreB = (b.effectiveness.successRate * 0.6) + (b.learning.confidence * 0.4);
      return scoreB - scoreA;
    });
  }

  /**
   * Predict likely success of a coordination strategy
   */
  async predictCoordinationSuccess(strategy: {
    topology: string;
    agentRoles: string[];
    taskType: string;
    resourceConstraints: Record<string, number>;
    targetMetrics: Record<string, number>;
  }): Promise<{
    successProbability: number;
    confidence: number;
    supportingPatterns: CoordinationPattern[];
    riskFactors: string[];
    recommendations: string[];
  }> {
    
    // Find relevant patterns
    const relevantPatterns = this.getPatterns({
      topology: strategy.topology,
      taskType: strategy.taskType,
      minConfidence: 0.5
    });

    let successProbability = 0.5; // Base probability
    let confidence = 0.3; // Base confidence
    const supportingPatterns: CoordinationPattern[] = [];
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    for (const pattern of relevantPatterns) {
      const relevanceScore = this.calculatePatternRelevance(pattern, strategy);
      
      if (relevanceScore > 0.6) {
        supportingPatterns.push(pattern);
        
        // Adjust success probability based on pattern effectiveness
        const weightedContribution = pattern.effectiveness.successRate * relevanceScore * pattern.learning.confidence;
        successProbability = (successProbability + weightedContribution) / 2;
        
        // Increase confidence
        confidence = Math.min(confidence + (pattern.learning.confidence * relevanceScore * 0.1), 1.0);
        
        // Generate recommendations based on pattern insights
        if (pattern.learning.refinementSuggestions.length > 0) {
          recommendations.push(...pattern.learning.refinementSuggestions);
        }
      }
    }

    // Identify risk factors
    const antiPatterns = await this.identifyAntiPatterns([]);
    for (const antiPattern of antiPatterns) {
      const riskRelevance = this.calculatePatternRelevance(antiPattern, strategy);
      if (riskRelevance > 0.5) {
        riskFactors.push(`Risk of ${antiPattern.name}: ${antiPattern.description}`);
        successProbability *= (1 - (riskRelevance * 0.3)); // Reduce success probability
      }
    }

    // Store prediction in memory for learning
    await this.memoryService.store(
      `coordination_prediction_${Date.now()}`,
      {
        strategy,
        prediction: { successProbability, confidence },
        supportingPatterns: supportingPatterns.map(p => p.id),
        timestamp: Date.now()
      },
      'coordination_predictions'
    );

    return {
      successProbability: Math.max(0.1, Math.min(0.9, successProbability)),
      confidence: Math.max(0.1, Math.min(1.0, confidence)),
      supportingPatterns,
      riskFactors,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    };
  }

  /**
   * Get pattern evolution history
   */
  getPatternEvolution(patternId: string): PatternEvolution[] {
    const evolutions = this.db.prepare(`
      SELECT * FROM pattern_evolution 
      WHERE pattern_id = ? 
      ORDER BY timestamp ASC
    `).all(patternId);

    return evolutions.map(row => ({
      patternId: row.pattern_id,
      evolutionType: row.evolution_type,
      changes: JSON.parse(row.changes),
      trigger: row.trigger_event,
      impact: JSON.parse(row.impact),
      timestamp: row.timestamp
    }));
  }

  /**
   * Get pattern analytics
   */
  getPatternAnalytics(): any {
    const totalPatterns = this.patterns.size;
    const patternsByType = new Map<string, number>();
    let totalSuccessRate = 0;
    let totalConfidence = 0;

    for (const pattern of this.patterns.values()) {
      const count = patternsByType.get(pattern.patternType) || 0;
      patternsByType.set(pattern.patternType, count + 1);
      
      totalSuccessRate += pattern.effectiveness.successRate;
      totalConfidence += pattern.learning.confidence;
    }

    const avgSuccessRate = totalPatterns > 0 ? totalSuccessRate / totalPatterns : 0;
    const avgConfidence = totalPatterns > 0 ? totalConfidence / totalPatterns : 0;

    // Get recent analysis metrics
    const recentAnalyses = this.db.prepare(`
      SELECT * FROM pattern_analysis_cache 
      WHERE generated_at > ? 
      ORDER BY generated_at DESC 
      LIMIT 10
    `).all(Date.now() - (24 * 60 * 60 * 1000)); // Last 24 hours

    return {
      summary: {
        totalPatterns,
        avgSuccessRate,
        avgConfidence,
        analysesLast24h: recentAnalyses.length
      },
      distribution: Object.fromEntries(patternsByType),
      topPatterns: this.getPatterns({ minSuccessRate: 0.8, minConfidence: 0.7 }).slice(0, 10),
      recentEvolutions: this.db.prepare(`
        SELECT pattern_id, evolution_type, timestamp 
        FROM pattern_evolution 
        WHERE timestamp > ? 
        ORDER BY timestamp DESC 
        LIMIT 20
      `).all(Date.now() - (7 * 24 * 60 * 60 * 1000)), // Last 7 days
      generatedAt: Date.now()
    };
  }

  // ===== PRIVATE PATTERN ANALYSIS METHODS =====

  private async analyzeTopologyPatterns(snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern[]> {
    const patterns: CoordinationPattern[] = [];
    const topologyGroups = new Map<string, SwarmBehaviorSnapshot[]>();

    // Group by topology
    for (const snapshot of snapshots) {
      const topology = snapshot.state.topology;
      if (!topologyGroups.has(topology)) {
        topologyGroups.set(topology, []);
      }
      topologyGroups.get(topology)!.push(snapshot);
    }

    // Analyze each topology group
    for (const [topology, group] of topologyGroups) {
      if (group.length >= this.config.minOccurrencesForPattern) {
        const pattern = await this.extractTopologyPattern(topology, group);
        if (pattern && pattern.effectiveness.successRate >= this.config.minSuccessRateForPattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  private async extractTopologyPattern(topology: string, snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern | null> {
    const successfulSnapshots = snapshots.filter(s => s.outcome.success);
    const successRate = successfulSnapshots.length / snapshots.length;

    if (successRate < this.config.minSuccessRateForPattern) {
      return null;
    }

    // Calculate average metrics
    const avgMetrics = this.calculateAverageMetrics(successfulSnapshots);
    const commonBehaviors = this.identifyCommonBehaviors(successfulSnapshots);

    const signature = this.generatePatternSignature({
      type: 'topology',
      topology,
      behaviors: commonBehaviors,
      metrics: avgMetrics
    });

    return {
      id: `topology_${topology}_${signature.substring(0, 8)}`,
      patternType: 'topology',
      signature,
      name: `Effective ${topology} Topology Pattern`,
      description: `Successful coordination pattern using ${topology} topology with ${snapshots.length} observations`,

      characteristics: {
        conditions: { topology, minAgents: Math.min(...snapshots.map(s => s.state.agentCount)) },
        behaviors: commonBehaviors,
        outcomes: { successRate, avgPerformance: avgMetrics.performanceScore },
        metrics: avgMetrics
      },

      effectiveness: {
        successRate,
        avgPerformanceImprovement: this.calculatePerformanceImprovement(snapshots),
        consistencyScore: this.calculateConsistencyScore(snapshots),
        applicabilityScore: this.calculateApplicabilityScore(snapshots)
      },

      context: {
        swarmSizes: [...new Set(snapshots.map(s => s.state.agentCount))],
        topologies: [topology],
        taskTypes: [...new Set(snapshots.map(s => this.inferTaskType(s)))],
        agentRoles: this.getUniqueAgentRoles(snapshots),
        environmentFactors: this.extractEnvironmentFactors(snapshots)
      },

      occurrence: {
        frequency: snapshots.length,
        firstSeen: Math.min(...snapshots.map(s => s.timestamp)),
        lastSeen: Math.max(...snapshots.map(s => s.timestamp)),
        swarmIds: [...new Set(snapshots.map(s => s.swarmId))],
        traceIds: [] // Would be populated with actual trace IDs
      },

      learning: {
        confidence: this.calculatePatternConfidence(snapshots, successRate),
        stabilityScore: this.calculateStabilityScore(snapshots),
        evolutionTrend: this.determineEvolutionTrend(snapshots),
        refinementSuggestions: this.generateRefinementSuggestions(snapshots, topology)
      }
    };
  }

  private async analyzeTaskDistributionPatterns(snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern[]> {
    const patterns: CoordinationPattern[] = [];
    const distributionGroups = new Map<string, SwarmBehaviorSnapshot[]>();

    // Group by task distribution strategy
    for (const snapshot of snapshots) {
      const strategy = snapshot.behavior.taskDistributionStrategy;
      if (!distributionGroups.has(strategy)) {
        distributionGroups.set(strategy, []);
      }
      distributionGroups.get(strategy)!.push(snapshot);
    }

    for (const [strategy, group] of distributionGroups) {
      if (group.length >= this.config.minOccurrencesForPattern) {
        const pattern = await this.extractTaskDistributionPattern(strategy, group);
        if (pattern && pattern.effectiveness.successRate >= this.config.minSuccessRateForPattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  private async extractTaskDistributionPattern(strategy: string, snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern | null> {
    const successfulSnapshots = snapshots.filter(s => s.outcome.success);
    const successRate = successfulSnapshots.length / snapshots.length;

    if (successRate < this.config.minSuccessRateForPattern) {
      return null;
    }

    const avgMetrics = this.calculateAverageMetrics(successfulSnapshots);
    const signature = this.generatePatternSignature({
      type: 'task_distribution',
      strategy,
      metrics: avgMetrics
    });

    return {
      id: `task_dist_${strategy}_${signature.substring(0, 8)}`,
      patternType: 'task_distribution',
      signature,
      name: `Effective Task Distribution: ${strategy}`,
      description: `Task distribution pattern using ${strategy} strategy`,

      characteristics: {
        conditions: { strategy, minTasks: Math.min(...snapshots.map(s => s.state.currentTasks)) },
        behaviors: { taskDistributionStrategy: strategy },
        outcomes: { successRate, throughput: avgMetrics.throughput },
        metrics: avgMetrics
      },

      effectiveness: {
        successRate,
        avgPerformanceImprovement: this.calculatePerformanceImprovement(snapshots),
        consistencyScore: this.calculateConsistencyScore(snapshots),
        applicabilityScore: this.calculateApplicabilityScore(snapshots)
      },

      context: {
        swarmSizes: [...new Set(snapshots.map(s => s.state.agentCount))],
        topologies: [...new Set(snapshots.map(s => s.state.topology))],
        taskTypes: [...new Set(snapshots.map(s => this.inferTaskType(s)))],
        agentRoles: this.getUniqueAgentRoles(snapshots),
        environmentFactors: this.extractEnvironmentFactors(snapshots)
      },

      occurrence: {
        frequency: snapshots.length,
        firstSeen: Math.min(...snapshots.map(s => s.timestamp)),
        lastSeen: Math.max(...snapshots.map(s => s.timestamp)),
        swarmIds: [...new Set(snapshots.map(s => s.swarmId))],
        traceIds: []
      },

      learning: {
        confidence: this.calculatePatternConfidence(snapshots, successRate),
        stabilityScore: this.calculateStabilityScore(snapshots),
        evolutionTrend: this.determineEvolutionTrend(snapshots),
        refinementSuggestions: [`Optimize ${strategy} for specific task types`, 'Monitor task completion times']
      }
    };
  }

  private async analyzeCommunicationPatterns(snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern[]> {
    // Similar implementation for communication patterns
    return [];
  }

  private async analyzeResourceAllocationPatterns(snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern[]> {
    // Similar implementation for resource allocation patterns
    return [];
  }

  private async analyzeErrorRecoveryPatterns(snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern[]> {
    // Similar implementation for error recovery patterns
    return [];
  }

  private async identifyAntiPatterns(snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern[]> {
    const antiPatterns: CoordinationPattern[] = [];
    
    // Find patterns with consistently poor performance
    const failureSnapshots = snapshots.filter(s => !s.outcome.success || s.outcome.performanceScore < 0.3);
    
    if (failureSnapshots.length >= this.config.minOccurrencesForPattern) {
      // Group failures by common characteristics
      const failureGroups = this.groupSnapshotsByCharacteristics(failureSnapshots);
      
      for (const [characteristics, group] of failureGroups) {
        if (group.length >= this.config.minOccurrencesForPattern) {
          const antiPattern = await this.extractAntiPattern(characteristics, group);
          if (antiPattern) {
            antiPatterns.push(antiPattern);
          }
        }
      }
    }
    
    return antiPatterns;
  }

  private async extractAntiPattern(characteristics: string, snapshots: SwarmBehaviorSnapshot[]): Promise<CoordinationPattern | null> {
    const failureRate = snapshots.filter(s => !s.outcome.success).length / snapshots.length;
    
    if (failureRate < 0.7) return null; // Not a strong anti-pattern
    
    const signature = this.generatePatternSignature({
      type: 'anti_pattern',
      characteristics,
      failureRate
    });

    return {
      id: `anti_pattern_${signature.substring(0, 8)}`,
      patternType: 'error_recovery', // Categorize as error-related
      signature,
      name: `Anti-Pattern: ${characteristics}`,
      description: `Consistently poor performing pattern with ${(failureRate * 100).toFixed(1)}% failure rate`,

      characteristics: {
        conditions: JSON.parse(characteristics),
        behaviors: this.identifyCommonBehaviors(snapshots),
        outcomes: { failureRate, avgPerformance: this.calculateAverageMetrics(snapshots).performanceScore },
        metrics: this.calculateAverageMetrics(snapshots)
      },

      effectiveness: {
        successRate: 1 - failureRate,
        avgPerformanceImprovement: -0.5, // Negative improvement
        consistencyScore: this.calculateConsistencyScore(snapshots),
        applicabilityScore: 0.2 // Low applicability for anti-patterns
      },

      context: {
        swarmSizes: [...new Set(snapshots.map(s => s.state.agentCount))],
        topologies: [...new Set(snapshots.map(s => s.state.topology))],
        taskTypes: [...new Set(snapshots.map(s => this.inferTaskType(s)))],
        agentRoles: this.getUniqueAgentRoles(snapshots),
        environmentFactors: this.extractEnvironmentFactors(snapshots)
      },

      occurrence: {
        frequency: snapshots.length,
        firstSeen: Math.min(...snapshots.map(s => s.timestamp)),
        lastSeen: Math.max(...snapshots.map(s => s.timestamp)),
        swarmIds: [...new Set(snapshots.map(s => s.swarmId))],
        traceIds: []
      },

      learning: {
        confidence: this.calculatePatternConfidence(snapshots, 1 - failureRate),
        stabilityScore: this.calculateStabilityScore(snapshots),
        evolutionTrend: 'declining',
        refinementSuggestions: ['Avoid this pattern', 'Implement alternative approaches']
      }
    };
  }

  // ===== HELPER METHODS =====

  private calculateAverageMetrics(snapshots: SwarmBehaviorSnapshot[]): Record<string, number> {
    if (snapshots.length === 0) return {};

    const metrics = {
      throughput: 0,
      responseTime: 0,
      errorRate: 0,
      coordinationOverhead: 0,
      memoryUsage: 0,
      tokenUsage: 0,
      performanceScore: 0,
      qualityScore: 0,
      efficiencyScore: 0
    };

    for (const snapshot of snapshots) {
      metrics.throughput += snapshot.metrics.throughput;
      metrics.responseTime += snapshot.metrics.responseTime;
      metrics.errorRate += snapshot.metrics.errorRate;
      metrics.coordinationOverhead += snapshot.metrics.coordinationOverhead;
      metrics.memoryUsage += snapshot.metrics.memoryUsage;
      metrics.tokenUsage += snapshot.metrics.tokenUsage;
      metrics.performanceScore += snapshot.outcome.performanceScore;
      metrics.qualityScore += snapshot.outcome.qualityScore;
      metrics.efficiencyScore += snapshot.outcome.efficiencyScore;
    }

    const count = snapshots.length;
    Object.keys(metrics).forEach(key => {
      metrics[key as keyof typeof metrics] /= count;
    });

    return metrics;
  }

  private identifyCommonBehaviors(snapshots: SwarmBehaviorSnapshot[]): Record<string, any> {
    const behaviors: Record<string, any> = {};
    
    // Find most common communication pattern
    const commPatterns = snapshots.map(s => s.behavior.communicationPattern);
    behaviors.communicationPattern = this.findMostCommon(commPatterns);
    
    // Find most common task distribution strategy
    const taskStrategies = snapshots.map(s => s.behavior.taskDistributionStrategy);
    behaviors.taskDistributionStrategy = this.findMostCommon(taskStrategies);
    
    // Find most common load balancing approach
    const loadApproaches = snapshots.map(s => s.behavior.loadBalancingApproach);
    behaviors.loadBalancingApproach = this.findMostCommon(loadApproaches);
    
    return behaviors;
  }

  private findMostCommon<T>(items: T[]): T | null {
    if (items.length === 0) return null;
    
    const counts = new Map<T, number>();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    
    let maxCount = 0;
    let mostCommon: T | null = null;
    
    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }
    
    return mostCommon;
  }

  private generatePatternSignature(data: any): string {
    return require('crypto')
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private calculatePerformanceImprovement(snapshots: SwarmBehaviorSnapshot[]): number {
    if (snapshots.length < 2) return 0;
    
    const sorted = snapshots.sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0].outcome.performanceScore;
    const last = sorted[sorted.length - 1].outcome.performanceScore;
    
    return (last - first) / first;
  }

  private calculateConsistencyScore(snapshots: SwarmBehaviorSnapshot[]): number {
    const performanceScores = snapshots.map(s => s.outcome.performanceScore);
    const mean = performanceScores.reduce((sum, score) => sum + score, 0) / performanceScores.length;
    const variance = performanceScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / performanceScores.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency
    return Math.max(0, 1 - stdDev);
  }

  private calculateApplicabilityScore(snapshots: SwarmBehaviorSnapshot[]): number {
    // Based on diversity of contexts where pattern was successful
    const contexts = new Set();
    
    for (const snapshot of snapshots) {
      const context = `${snapshot.state.topology}_${snapshot.state.agentCount}_${this.inferTaskType(snapshot)}`;
      contexts.add(context);
    }
    
    // More diverse contexts = higher applicability
    return Math.min(1, contexts.size / 10);
  }

  private calculatePatternConfidence(snapshots: SwarmBehaviorSnapshot[], successRate: number): number {
    const sampleSize = snapshots.length;
    const recency = this.calculateRecencyScore(snapshots);
    const consistency = this.calculateConsistencyScore(snapshots);
    
    // Combine factors
    const sampleScore = Math.min(1, sampleSize / 20); // More samples = higher confidence
    
    return (successRate * 0.4) + (sampleScore * 0.3) + (recency * 0.2) + (consistency * 0.1);
  }

  private calculateRecencyScore(snapshots: SwarmBehaviorSnapshot[]): number {
    const now = Date.now();
    const recentThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    const recentSnapshots = snapshots.filter(s => (now - s.timestamp) < recentThreshold);
    return recentSnapshots.length / snapshots.length;
  }

  private calculateStabilityScore(snapshots: SwarmBehaviorSnapshot[]): number {
    // Measure how stable the pattern performance is over time
    if (snapshots.length < 3) return 0.5;
    
    const sorted = snapshots.sort((a, b) => a.timestamp - b.timestamp);
    const performances = sorted.map(s => s.outcome.performanceScore);
    
    let stabilitySum = 0;
    for (let i = 1; i < performances.length; i++) {
      const change = Math.abs(performances[i] - performances[i-1]);
      stabilitySum += (1 - change); // Lower change = higher stability
    }
    
    return Math.max(0, stabilitySum / (performances.length - 1));
  }

  private determineEvolutionTrend(snapshots: SwarmBehaviorSnapshot[]): 'improving' | 'stable' | 'declining' {
    if (snapshots.length < 3) return 'stable';
    
    const sorted = snapshots.sort((a, b) => a.timestamp - b.timestamp);
    const performances = sorted.map(s => s.outcome.performanceScore);
    
    // Simple linear trend calculation
    const n = performances.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = performances.reduce((sum, perf) => sum + perf, 0);
    const sumXY = performances.reduce((sum, perf, index) => sum + (perf * (index + 1)), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (slope > 0.05) return 'improving';
    if (slope < -0.05) return 'declining';
    return 'stable';
  }

  private generateRefinementSuggestions(snapshots: SwarmBehaviorSnapshot[], context: string): string[] {
    const suggestions: string[] = [];
    
    // Analyze failure cases for improvement opportunities
    const failures = snapshots.filter(s => !s.outcome.success);
    
    if (failures.length > 0) {
      const commonIssues = this.extractCommonIssues(failures);
      suggestions.push(...commonIssues.map(issue => `Address ${issue} to improve reliability`));
    }
    
    // Analyze performance opportunities
    const lowPerformance = snapshots.filter(s => s.outcome.performanceScore < 0.7);
    if (lowPerformance.length > snapshots.length * 0.3) {
      suggestions.push('Optimize performance for better results');
    }
    
    return suggestions;
  }

  private extractCommonIssues(snapshots: SwarmBehaviorSnapshot[]): string[] {
    const allIssues: string[] = [];
    
    for (const snapshot of snapshots) {
      allIssues.push(...snapshot.outcome.issues);
    }
    
    const issueCounts = new Map<string, number>();
    for (const issue of allIssues) {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    }
    
    // Return issues that appear in at least 30% of snapshots
    const threshold = snapshots.length * 0.3;
    return Array.from(issueCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([issue, _]) => issue);
  }

  private inferTaskType(snapshot: SwarmBehaviorSnapshot): string {
    // Infer task type from behavior and metrics
    if (snapshot.metrics.coordinationOverhead > 0.3) return 'coordination_heavy';
    if (snapshot.metrics.memoryUsage > 1000) return 'memory_intensive';
    if (snapshot.metrics.tokenUsage > 10000) return 'computation_heavy';
    return 'general';
  }

  private getUniqueAgentRoles(snapshots: SwarmBehaviorSnapshot[]): string[] {
    const roles = new Set<string>();
    
    for (const snapshot of snapshots) {
      Object.keys(snapshot.state.agentRoles).forEach(role => roles.add(role));
    }
    
    return Array.from(roles);
  }

  private extractEnvironmentFactors(snapshots: SwarmBehaviorSnapshot[]): Record<string, any> {
    // Extract common environment factors
    const factors: Record<string, any> = {
      avgAgentCount: snapshots.reduce((sum, s) => sum + s.state.agentCount, 0) / snapshots.length,
      avgTaskLoad: snapshots.reduce((sum, s) => sum + s.state.currentTasks, 0) / snapshots.length,
      resourceUtilization: this.calculateAverageResourceUtilization(snapshots)
    };
    
    return factors;
  }

  private calculateAverageResourceUtilization(snapshots: SwarmBehaviorSnapshot[]): Record<string, number> {
    const utilization: Record<string, number> = {};
    
    for (const snapshot of snapshots) {
      for (const [resource, value] of Object.entries(snapshot.state.resourceUtilization)) {
        utilization[resource] = (utilization[resource] || 0) + value;
      }
    }
    
    const count = snapshots.length;
    Object.keys(utilization).forEach(key => {
      utilization[key] /= count;
    });
    
    return utilization;
  }

  private groupSnapshotsByCharacteristics(snapshots: SwarmBehaviorSnapshot[]): Map<string, SwarmBehaviorSnapshot[]> {
    const groups = new Map<string, SwarmBehaviorSnapshot[]>();
    
    for (const snapshot of snapshots) {
      const characteristics = JSON.stringify({
        topology: snapshot.state.topology,
        agentCount: Math.floor(snapshot.state.agentCount / 5) * 5, // Group by 5s
        communicationPattern: snapshot.behavior.communicationPattern
      });
      
      if (!groups.has(characteristics)) {
        groups.set(characteristics, []);
      }
      groups.get(characteristics)!.push(snapshot);
    }
    
    return groups;
  }

  private calculatePatternRelevance(pattern: CoordinationPattern, strategy: any): number {
    let relevance = 0;
    
    // Topology match
    if (pattern.context.topologies.includes(strategy.topology)) {
      relevance += 0.3;
    }
    
    // Task type match
    if (pattern.context.taskTypes.includes(strategy.taskType)) {
      relevance += 0.2;
    }
    
    // Agent roles overlap
    const roleOverlap = strategy.agentRoles.filter((role: string) => 
      pattern.context.agentRoles.includes(role)
    ).length;
    relevance += (roleOverlap / Math.max(strategy.agentRoles.length, pattern.context.agentRoles.length)) * 0.3;
    
    // Swarm size similarity
    const avgSwarmSize = pattern.context.swarmSizes.reduce((sum, size) => sum + size, 0) / pattern.context.swarmSizes.length;
    const sizeDiff = Math.abs(avgSwarmSize - strategy.agentRoles.length) / avgSwarmSize;
    relevance += Math.max(0, (1 - sizeDiff)) * 0.2;
    
    return Math.min(1, relevance);
  }

  private detectPatternEvolution(existing: CoordinationPattern, updated: CoordinationPattern): PatternEvolution | null {
    // Check if significant changes occurred
    const performanceChange = updated.effectiveness.successRate - existing.effectiveness.successRate;
    const confidenceChange = updated.learning.confidence - existing.learning.confidence;
    
    if (Math.abs(performanceChange) < 0.1 && Math.abs(confidenceChange) < 0.1) {
      return null; // No significant evolution
    }
    
    let evolutionType: 'improvement' | 'adaptation' | 'specialization' | 'generalization' = 'adaptation';
    
    if (performanceChange > 0.1) evolutionType = 'improvement';
    if (updated.context.taskTypes.length < existing.context.taskTypes.length) evolutionType = 'specialization';
    if (updated.context.taskTypes.length > existing.context.taskTypes.length) evolutionType = 'generalization';
    
    return {
      patternId: existing.id,
      evolutionType,
      changes: {
        before: { 
          successRate: existing.effectiveness.successRate,
          confidence: existing.learning.confidence 
        },
        after: { 
          successRate: updated.effectiveness.successRate,
          confidence: updated.learning.confidence 
        },
        delta: { 
          performance: performanceChange,
          confidence: confidenceChange 
        }
      },
      trigger: 'pattern_analysis',
      impact: {
        performanceChange,
        applicabilityChange: updated.effectiveness.applicabilityScore - existing.effectiveness.applicabilityScore,
        confidenceChange
      },
      timestamp: Date.now()
    };
  }

  private async generateInsights(patterns: CoordinationPattern[], snapshots: SwarmBehaviorSnapshot[]): Promise<any> {
    const insights = {
      mostEffectivePattern: null as CoordinationPattern | null,
      emergingTrends: [] as string[],
      recommendedActions: [] as string[],
      riskFactors: [] as string[]
    };
    
    // Find most effective pattern
    if (patterns.length > 0) {
      insights.mostEffectivePattern = patterns.reduce((best, current) => 
        (current.effectiveness.successRate * current.learning.confidence) > 
        (best.effectiveness.successRate * best.learning.confidence) ? current : best
      );
    }
    
    // Identify emerging trends
    const recentPatterns = patterns.filter(p => 
      (Date.now() - p.occurrence.lastSeen) < (7 * 24 * 60 * 60 * 1000)
    );
    
    if (recentPatterns.length > patterns.length * 0.3) {
      insights.emergingTrends.push('Rapid pattern evolution detected');
    }
    
    // Generate recommendations
    const lowPerformanceSnapshots = snapshots.filter(s => s.outcome.performanceScore < 0.5);
    if (lowPerformanceSnapshots.length > snapshots.length * 0.2) {
      insights.recommendedActions.push('Focus on improving low-performing configurations');
    }
    
    return insights;
  }

  private calculateOverallConfidence(patterns: CoordinationPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const totalConfidence = patterns.reduce((sum, p) => sum + p.learning.confidence, 0);
    return totalConfidence / patterns.length;
  }

  private calculateCoveragePercentage(snapshots: SwarmBehaviorSnapshot[], patterns: CoordinationPattern[]): number {
    if (snapshots.length === 0) return 0;
    
    let coveredSnapshots = 0;
    
    for (const snapshot of snapshots) {
      const covered = patterns.some(pattern => 
        pattern.occurrence.swarmIds.includes(snapshot.swarmId)
      );
      
      if (covered) coveredSnapshots++;
    }
    
    return (coveredSnapshots / snapshots.length) * 100;
  }

  // ===== DATABASE OPERATIONS =====

  private loadExistingPatterns(): void {
    const rows = this.db.prepare('SELECT * FROM coordination_patterns').all();
    
    for (const row of rows) {
      const pattern: CoordinationPattern = {
        id: row.id,
        patternType: row.pattern_type,
        signature: row.signature,
        name: row.name,
        description: row.description,
        characteristics: JSON.parse(row.characteristics),
        effectiveness: JSON.parse(row.effectiveness),
        context: JSON.parse(row.context),
        occurrence: JSON.parse(row.occurrence),
        learning: JSON.parse(row.learning)
      };
      
      this.patterns.set(pattern.id, pattern);
    }
    
    console.log(`Loaded ${this.patterns.size} existing patterns`);
  }

  private async storePattern(pattern: CoordinationPattern): Promise<void> {
    this.db.prepare(`
      INSERT INTO coordination_patterns 
      (id, pattern_type, signature, name, description, characteristics, effectiveness, context, occurrence, learning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pattern.id,
      pattern.patternType,
      pattern.signature,
      pattern.name,
      pattern.description,
      JSON.stringify(pattern.characteristics),
      JSON.stringify(pattern.effectiveness),
      JSON.stringify(pattern.context),
      JSON.stringify(pattern.occurrence),
      JSON.stringify(pattern.learning)
    );
  }

  private async updatePattern(pattern: CoordinationPattern): Promise<void> {
    this.db.prepare(`
      UPDATE coordination_patterns 
      SET characteristics = ?, effectiveness = ?, context = ?, occurrence = ?, learning = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `).run(
      JSON.stringify(pattern.characteristics),
      JSON.stringify(pattern.effectiveness),
      JSON.stringify(pattern.context),
      JSON.stringify(pattern.occurrence),
      JSON.stringify(pattern.learning),
      pattern.id
    );
  }

  private async recordPatternEvolution(evolution: PatternEvolution): Promise<void> {
    this.db.prepare(`
      INSERT INTO pattern_evolution (pattern_id, evolution_type, changes, trigger_event, impact, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      evolution.patternId,
      evolution.evolutionType,
      JSON.stringify(evolution.changes),
      evolution.trigger,
      JSON.stringify(evolution.impact),
      evolution.timestamp
    );
  }

  private startPeriodicAnalysis(): void {
    setInterval(async () => {
      if (this.analysisQueue.length > 0 && !this.isAnalyzing) {
        try {
          await this.runPatternAnalysis();
        } catch (error) {
          console.error('Error in periodic pattern analysis:', error);
        }
      }
    }, this.config.analysisInterval);
  }

  /**
   * Close database and cleanup
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
    this.patterns.clear();
    this.behaviorHistory.length = 0;
    this.analysisQueue.length = 0;
  }
}

// Export factory function
export function createPatternRecognitionEngine(memoryService: MemoryService): PatternRecognitionEngine {
  return new PatternRecognitionEngine('.swarm/patterns.db', memoryService);
}