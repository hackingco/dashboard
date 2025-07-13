/**
 * Lessons Recommendation Engine
 * Advanced recommendation system that provides intelligent suggestions based on learned patterns
 */

import { EventEmitter } from 'events';
import { LessonsLearnedService } from './LessonsLearnedService';
import { LessonsIntegration } from './LessonsIntegration';
import { MemoryService } from './MemoryService';

export interface RecommendationContext {
  swarmId: string;
  currentTask?: {
    id: string;
    type: string;
    description: string;
    priority: string;
    estimatedDuration?: number;
  };
  swarmState: {
    topology: string;
    activeAgents: number;
    agentRoles: string[];
    currentLoad: number;
    resourceUtilization: Record<string, number>;
  };
  recentIssues?: {
    errors: string[];
    performanceIssues: string[];
    resourceConstraints: string[];
  };
  targetObjectives?: {
    performance: Record<string, number>;
    quality: Record<string, number>;
    efficiency: Record<string, number>;
  };
  preferences?: {
    riskTolerance: 'low' | 'medium' | 'high';
    optimizationFocus: 'speed' | 'quality' | 'cost' | 'reliability';
    acceptableComplexity: 'low' | 'medium' | 'high';
  };
}

export interface SmartRecommendation {
  id: string;
  lessonId: string;
  type: 'preventive' | 'corrective' | 'optimization' | 'enhancement';
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  title: string;
  description: string;
  rationale: string;
  expectedBenefit: string;
  implementationGuide: string;
  
  relevanceScore: number;
  confidenceScore: number;
  impactScore: number;
  complexityScore: number;
  
  timing: {
    urgency: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
    estimatedImplementationTime: number; // minutes
    prerequisiteRecommendations: string[];
  };
  
  implementation: {
    steps: string[];
    requiredResources: string[];
    riskFactors: string[];
    successMetrics: string[];
    rollbackPlan?: string;
  };
  
  evidence: {
    basedOnLessons: string[];
    similarSuccesses: number;
    confidenceFactors: string[];
    potentialRisks: string[];
  };
  
  monitoring: {
    keyMetrics: string[];
    checkpoints: string[];
    alertConditions: string[];
  };
}

export interface RecommendationStrategy {
  name: string;
  description: string;
  applicabilityConditions: Record<string, any>;
  weightingFactors: Record<string, number>;
  filterCriteria: Record<string, any>;
}

export interface OptimizationPlan {
  id: string;
  contextHash: string;
  recommendations: SmartRecommendation[];
  implementationOrder: string[];
  estimatedTotalTime: number;
  expectedImprovements: Record<string, number>;
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    riskFactors: string[];
    mitigationStrategies: string[];
  };
  generatedAt: number;
  validUntil: number;
}

export class LessonsRecommendationEngine extends EventEmitter {
  private lessonsService: LessonsLearnedService;
  private lessonsIntegration: LessonsIntegration;
  private memoryService: MemoryService;
  
  private strategies: Map<string, RecommendationStrategy> = new Map();
  private recommendationCache: Map<string, OptimizationPlan> = new Map();
  
  constructor(
    lessonsService: LessonsLearnedService,
    lessonsIntegration: LessonsIntegration,
    memoryService: MemoryService
  ) {
    super();
    
    this.lessonsService = lessonsService;
    this.lessonsIntegration = lessonsIntegration;
    this.memoryService = memoryService;
    
    this.initializeStrategies();
    this.setupCacheCleanup();
  }

  /**
   * Generate comprehensive optimization plan for a swarm
   */
  async generateOptimizationPlan(context: RecommendationContext): Promise<OptimizationPlan> {
    const contextHash = this.hashContext(context);
    
    // Check cache first
    const cached = this.recommendationCache.get(contextHash);
    if (cached && cached.validUntil > Date.now()) {
      this.emit('plan_retrieved_from_cache', { contextHash, swarmId: context.swarmId });
      return cached;
    }

    const startTime = Date.now();
    
    try {
      // Analyze current context
      const contextAnalysis = await this.analyzeContext(context);
      
      // Generate base recommendations
      const baseRecommendations = await this.generateBaseRecommendations(context);
      
      // Apply strategy-based filtering and enhancement
      const strategicRecommendations = await this.applyRecommendationStrategies(
        baseRecommendations,
        context,
        contextAnalysis
      );
      
      // Optimize recommendation order
      const implementationOrder = this.optimizeImplementationOrder(strategicRecommendations);
      
      // Calculate total time and improvements
      const estimatedTotalTime = this.calculateTotalImplementationTime(strategicRecommendations);
      const expectedImprovements = this.calculateExpectedImprovements(strategicRecommendations);
      
      // Assess risks
      const riskAssessment = this.assessOverallRisk(strategicRecommendations, context);
      
      const plan: OptimizationPlan = {
        id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        contextHash,
        recommendations: strategicRecommendations,
        implementationOrder,
        estimatedTotalTime,
        expectedImprovements,
        riskAssessment,
        generatedAt: Date.now(),
        validUntil: Date.now() + (30 * 60 * 1000) // Valid for 30 minutes
      };
      
      // Cache the plan
      this.recommendationCache.set(contextHash, plan);
      
      // Store in memory for persistence
      await this.memoryService.storeSwarmData(
        context.swarmId,
        `optimization_plan_${plan.id}`,
        plan
      );
      
      const generationTime = Date.now() - startTime;
      this.emit('plan_generated', {
        planId: plan.id,
        swarmId: context.swarmId,
        recommendationCount: strategicRecommendations.length,
        generationTime
      });
      
      return plan;
      
    } catch (error) {
      console.error('Error generating optimization plan:', error);
      throw error;
    }
  }

  /**
   * Get real-time recommendations for immediate action
   */
  async getImmediateRecommendations(context: RecommendationContext): Promise<SmartRecommendation[]> {
    const urgentRecommendations: SmartRecommendation[] = [];
    
    // Check for critical issues that need immediate attention
    if (context.recentIssues) {
      // Critical errors
      if (context.recentIssues.errors.length > 0) {
        const errorRecommendations = await this.generateErrorRecommendations(
          context.recentIssues.errors,
          context
        );
        urgentRecommendations.push(...errorRecommendations);
      }
      
      // Performance degradation
      if (context.recentIssues.performanceIssues.length > 0) {
        const performanceRecommendations = await this.generatePerformanceRecommendations(
          context.recentIssues.performanceIssues,
          context
        );
        urgentRecommendations.push(...performanceRecommendations);
      }
      
      // Resource constraints
      if (context.recentIssues.resourceConstraints.length > 0) {
        const resourceRecommendations = await this.generateResourceRecommendations(
          context.recentIssues.resourceConstraints,
          context
        );
        urgentRecommendations.push(...resourceRecommendations);
      }
    }
    
    // Filter for immediate action items
    const immediateRecommendations = urgentRecommendations.filter(
      rec => rec.timing.urgency === 'immediate' && rec.priority !== 'low'
    );
    
    this.emit('immediate_recommendations_generated', {
      swarmId: context.swarmId,
      count: immediateRecommendations.length,
      priorities: immediateRecommendations.map(r => r.priority)
    });
    
    return immediateRecommendations;
  }

  /**
   * Track recommendation implementation and effectiveness
   */
  async trackRecommendationImplementation(
    recommendationId: string,
    implementation: {
      swarmId: string;
      implementedAt: number;
      implementationNotes: string;
      actualSteps: string[];
      timeSpent: number;
      challengesFaced: string[];
    }
  ): Promise<void> {
    
    // Store implementation details
    await this.memoryService.storeSwarmData(
      implementation.swarmId,
      `recommendation_implementation_${recommendationId}`,
      {
        recommendationId,
        ...implementation,
        status: 'implemented'
      }
    );
    
    // Set up monitoring
    await this.setupRecommendationMonitoring(recommendationId, implementation.swarmId);
    
    this.emit('recommendation_implemented', {
      recommendationId,
      swarmId: implementation.swarmId,
      timeSpent: implementation.timeSpent
    });
  }

  /**
   * Collect feedback on recommendation effectiveness
   */
  async collectRecommendationFeedback(
    recommendationId: string,
    feedback: {
      swarmId: string;
      effectiveness: 'excellent' | 'good' | 'fair' | 'poor';
      actualImpact: Record<string, number>;
      unexpectedEffects: string[];
      improvementSuggestions: string[];
      wouldRecommendAgain: boolean;
      notes: string;
    }
  ): Promise<void> {
    
    // Store feedback
    await this.memoryService.storeSwarmData(
      feedback.swarmId,
      `recommendation_feedback_${recommendationId}`,
      {
        recommendationId,
        ...feedback,
        collectedAt: Date.now()
      }
    );
    
    // Update recommendation scoring model
    await this.updateRecommendationModel(recommendationId, feedback);
    
    this.emit('feedback_collected', {
      recommendationId,
      swarmId: feedback.swarmId,
      effectiveness: feedback.effectiveness
    });
  }

  /**
   * Get recommendation analytics and performance metrics
   */
  async getRecommendationAnalytics(): Promise<any> {
    const analytics = {
      totalRecommendationsGenerated: 0,
      totalPlansGenerated: 0,
      implementationRate: 0,
      averageEffectiveness: 0,
      topPerformingRecommendations: [],
      commonPatterns: [],
      improvementTrends: {},
      generatedAt: Date.now()
    };
    
    // Get implementation data from memory
    const implementations = await this.memoryService.search('recommendation_implementation_', 'default');
    const feedbacks = await this.memoryService.search('recommendation_feedback_', 'default');
    
    analytics.totalRecommendationsGenerated = implementations.length;
    analytics.implementationRate = implementations.length > 0 ? 
      feedbacks.length / implementations.length : 0;
    
    // Calculate average effectiveness
    if (feedbacks.length > 0) {
      const effectivenessScores = feedbacks.map(f => this.mapEffectivenessToScore(f.value.effectiveness));
      analytics.averageEffectiveness = effectivenessScores.reduce((sum, score) => sum + score, 0) / effectivenessScores.length;
    }
    
    // Identify top performing recommendations
    const recommendationPerformance = new Map();
    
    for (const feedback of feedbacks) {
      const recId = feedback.value.recommendationId;
      const score = this.mapEffectivenessToScore(feedback.value.effectiveness);
      
      if (!recommendationPerformance.has(recId)) {
        recommendationPerformance.set(recId, { scores: [], count: 0 });
      }
      
      const perf = recommendationPerformance.get(recId);
      perf.scores.push(score);
      perf.count++;
    }
    
    analytics.topPerformingRecommendations = Array.from(recommendationPerformance.entries())
      .map(([recId, perf]) => ({
        recommendationId: recId,
        averageScore: perf.scores.reduce((sum, s) => sum + s, 0) / perf.scores.length,
        implementationCount: perf.count
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);
    
    return analytics;
  }

  // ===== PRIVATE HELPER METHODS =====

  private initializeStrategies(): void {
    // Performance-focused strategy
    this.strategies.set('performance_optimization', {
      name: 'Performance Optimization',
      description: 'Focus on recommendations that improve speed and efficiency',
      applicabilityConditions: {
        hasPerformanceIssues: true,
        optimizationFocus: 'speed'
      },
      weightingFactors: {
        impactScore: 0.4,
        complexityScore: -0.2,
        relevanceScore: 0.3,
        confidenceScore: 0.1
      },
      filterCriteria: {
        minImpactScore: 0.6,
        maxComplexityScore: 0.8
      }
    });
    
    // Quality-focused strategy
    this.strategies.set('quality_enhancement', {
      name: 'Quality Enhancement',
      description: 'Focus on recommendations that improve reliability and quality',
      applicabilityConditions: {
        optimizationFocus: 'quality'
      },
      weightingFactors: {
        confidenceScore: 0.4,
        impactScore: 0.3,
        relevanceScore: 0.2,
        complexityScore: -0.1
      },
      filterCriteria: {
        minConfidenceScore: 0.7,
        maxComplexityScore: 0.7
      }
    });
    
    // Error prevention strategy
    this.strategies.set('error_prevention', {
      name: 'Error Prevention',
      description: 'Focus on preventing known error patterns',
      applicabilityConditions: {
        hasRecentErrors: true
      },
      weightingFactors: {
        relevanceScore: 0.5,
        impactScore: 0.3,
        confidenceScore: 0.2
      },
      filterCriteria: {
        recommendationType: 'preventive',
        minRelevanceScore: 0.8
      }
    });
    
    // Low-risk strategy
    this.strategies.set('low_risk', {
      name: 'Low Risk Optimization',
      description: 'Conservative approach with minimal risk',
      applicabilityConditions: {
        riskTolerance: 'low'
      },
      weightingFactors: {
        confidenceScore: 0.4,
        complexityScore: -0.4,
        impactScore: 0.2
      },
      filterCriteria: {
        maxComplexityScore: 0.5,
        minConfidenceScore: 0.8
      }
    });
  }

  private async analyzeContext(context: RecommendationContext): Promise<any> {
    const analysis = {
      urgencyLevel: 'low',
      complexityTolerance: context.preferences?.acceptableComplexity || 'medium',
      riskProfile: context.preferences?.riskTolerance || 'medium',
      focusAreas: [],
      constraints: [],
      opportunities: []
    };
    
    // Analyze urgency
    if (context.recentIssues) {
      if (context.recentIssues.errors.length > 0) {
        analysis.urgencyLevel = 'high';
        analysis.focusAreas.push('error_resolution');
      }
      
      if (context.recentIssues.performanceIssues.length > 0) {
        analysis.urgencyLevel = analysis.urgencyLevel === 'high' ? 'high' : 'medium';
        analysis.focusAreas.push('performance_improvement');
      }
    }
    
    // Analyze resource constraints
    if (context.swarmState.resourceUtilization) {
      const highUtilization = Object.values(context.swarmState.resourceUtilization)
        .some(util => util > 0.8);
      
      if (highUtilization) {
        analysis.constraints.push('resource_limited');
        analysis.focusAreas.push('resource_optimization');
      }
    }
    
    // Identify optimization opportunities
    if (context.swarmState.currentLoad < 0.6) {
      analysis.opportunities.push('underutilized_capacity');
    }
    
    return analysis;
  }

  private async generateBaseRecommendations(context: RecommendationContext): Promise<SmartRecommendation[]> {
    const recommendations: SmartRecommendation[] = [];
    
    // Get lessons from the lessons service
    const lessonsContext = {
      swarmId: context.swarmId,
      taskType: context.currentTask?.type,
      agentRoles: context.swarmState.agentRoles,
      topology: context.swarmState.topology,
      currentIssues: [
        ...(context.recentIssues?.errors || []),
        ...(context.recentIssues?.performanceIssues || []),
        ...(context.recentIssues?.resourceConstraints || [])
      ]
    };
    
    const lessonRecommendations = await this.lessonsIntegration.generateRecommendationsForContext(lessonsContext);
    
    // Convert lesson recommendations to smart recommendations
    for (const lessonRec of lessonRecommendations.recommendations || []) {
      const lesson = await this.getLessonDetails(lessonRec.lessonId);
      
      if (lesson) {
        const smartRec = await this.convertLessonToSmartRecommendation(lesson, lessonRec, context);
        recommendations.push(smartRec);
      }
    }
    
    return recommendations;
  }

  private async applyRecommendationStrategies(
    recommendations: SmartRecommendation[],
    context: RecommendationContext,
    contextAnalysis: any
  ): Promise<SmartRecommendation[]> {
    
    // Select applicable strategies
    const applicableStrategies = Array.from(this.strategies.values()).filter(
      strategy => this.isStrategyApplicable(strategy, context, contextAnalysis)
    );
    
    if (applicableStrategies.length === 0) {
      return recommendations; // No filtering if no strategies apply
    }
    
    let filteredRecommendations = [...recommendations];
    
    // Apply each strategy
    for (const strategy of applicableStrategies) {
      filteredRecommendations = this.applyStrategy(filteredRecommendations, strategy, context);
    }
    
    // Re-score based on strategy weighting
    for (const rec of filteredRecommendations) {
      rec.relevanceScore = this.calculateStrategicScore(rec, applicableStrategies);
    }
    
    // Sort by strategic relevance
    filteredRecommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return filteredRecommendations.slice(0, 10); // Return top 10
  }

  private optimizeImplementationOrder(recommendations: SmartRecommendation[]): string[] {
    // Create dependency graph
    const dependencyMap = new Map<string, string[]>();
    
    for (const rec of recommendations) {
      dependencyMap.set(rec.id, rec.timing.prerequisiteRecommendations);
    }
    
    // Topological sort with priority weighting
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (recId: string) => {
      if (visiting.has(recId)) {
        throw new Error(`Circular dependency detected: ${recId}`);
      }
      
      if (visited.has(recId)) return;
      
      visiting.add(recId);
      
      const dependencies = dependencyMap.get(recId) || [];
      for (const dep of dependencies) {
        if (recommendations.find(r => r.id === dep)) {
          visit(dep);
        }
      }
      
      visiting.delete(recId);
      visited.add(recId);
      sorted.push(recId);
    };
    
    // Sort by urgency and priority first, then apply topological sort
    const priorityOrder = recommendations
      .sort((a, b) => {
        const urgencyWeight = { immediate: 4, short_term: 3, medium_term: 2, long_term: 1 };
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        
        const aScore = urgencyWeight[a.timing.urgency] + priorityWeight[a.priority];
        const bScore = urgencyWeight[b.timing.urgency] + priorityWeight[b.priority];
        
        return bScore - aScore;
      })
      .map(r => r.id);
    
    for (const recId of priorityOrder) {
      if (!visited.has(recId)) {
        visit(recId);
      }
    }
    
    return sorted;
  }

  private calculateTotalImplementationTime(recommendations: SmartRecommendation[]): number {
    return recommendations.reduce((total, rec) => total + rec.timing.estimatedImplementationTime, 0);
  }

  private calculateExpectedImprovements(recommendations: SmartRecommendation[]): Record<string, number> {
    const improvements: Record<string, number> = {};
    
    for (const rec of recommendations) {
      // Extract improvement metrics from implementation success metrics
      for (const metric of rec.implementation.successMetrics) {
        if (metric.includes('%')) {
          const match = metric.match(/(\d+)%/);
          if (match) {
            const improvement = parseInt(match[1]) / 100;
            const metricName = metric.replace(/\d+%/, '').trim();
            
            if (!improvements[metricName]) {
              improvements[metricName] = 0;
            }
            
            improvements[metricName] += improvement * rec.impactScore;
          }
        }
      }
    }
    
    return improvements;
  }

  private assessOverallRisk(recommendations: SmartRecommendation[], context: RecommendationContext): any {
    const riskFactors: string[] = [];
    let riskScore = 0;
    
    for (const rec of recommendations) {
      riskScore += rec.complexityScore * 0.3;
      riskFactors.push(...rec.implementation.riskFactors);
    }
    
    // Normalize risk score
    riskScore = riskScore / recommendations.length;
    
    const overallRisk = riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';
    
    const mitigationStrategies = [
      'Implement recommendations incrementally',
      'Monitor key metrics closely during implementation',
      'Have rollback plans ready for each recommendation',
      'Test in non-production environment first'
    ];
    
    return {
      overallRisk,
      riskFactors: [...new Set(riskFactors)],
      mitigationStrategies
    };
  }

  private async generateErrorRecommendations(
    errors: string[],
    context: RecommendationContext
  ): Promise<SmartRecommendation[]> {
    
    const recommendations: SmartRecommendation[] = [];
    
    for (const error of errors) {
      // Look for lessons related to this error type
      const errorLessons = await this.lessonsIntegration.searchLessons({
        text: error,
        category: 'error_pattern',
        swarmId: context.swarmId
      });
      
      for (const lesson of errorLessons.slice(0, 2)) { // Max 2 per error
        const rec = await this.createErrorRecommendation(lesson, error, context);
        recommendations.push(rec);
      }
    }
    
    return recommendations;
  }

  private async generatePerformanceRecommendations(
    issues: string[],
    context: RecommendationContext
  ): Promise<SmartRecommendation[]> {
    
    const recommendations: SmartRecommendation[] = [];
    
    for (const issue of issues) {
      const performanceLessons = await this.lessonsIntegration.searchLessons({
        text: issue,
        category: 'optimization',
        swarmId: context.swarmId
      });
      
      for (const lesson of performanceLessons.slice(0, 1)) { // Max 1 per issue
        const rec = await this.createPerformanceRecommendation(lesson, issue, context);
        recommendations.push(rec);
      }
    }
    
    return recommendations;
  }

  private async generateResourceRecommendations(
    constraints: string[],
    context: RecommendationContext
  ): Promise<SmartRecommendation[]> {
    
    const recommendations: SmartRecommendation[] = [];
    
    for (const constraint of constraints) {
      const resourceLessons = await this.lessonsIntegration.searchLessons({
        text: constraint,
        category: 'resource_management',
        swarmId: context.swarmId
      });
      
      for (const lesson of resourceLessons.slice(0, 1)) { // Max 1 per constraint
        const rec = await this.createResourceRecommendation(lesson, constraint, context);
        recommendations.push(rec);
      }
    }
    
    return recommendations;
  }

  private async convertLessonToSmartRecommendation(
    lesson: any,
    lessonRec: any,
    context: RecommendationContext
  ): Promise<SmartRecommendation> {
    
    const recType = this.mapLessonCategoryToRecommendationType(lesson.metadata.category);
    const priority = this.mapImpactToPriority(lesson.metadata.impact);
    
    return {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lessonId: lesson.id,
      type: recType,
      priority,
      
      title: lesson.title,
      description: lesson.description,
      rationale: lesson.insight,
      expectedBenefit: lessonRec.expectedImpact,
      implementationGuide: lessonRec.implementationStrategy,
      
      relevanceScore: lessonRec.relevanceScore,
      confidenceScore: lesson.metadata.confidence,
      impactScore: this.mapImpactToScore(lesson.metadata.impact),
      complexityScore: this.estimateComplexityScore(lesson, context),
      
      timing: {
        urgency: this.determineUrgency(lesson, context),
        estimatedImplementationTime: this.estimateImplementationTime(lesson),
        prerequisiteRecommendations: []
      },
      
      implementation: {
        steps: this.generateImplementationSteps(lesson),
        requiredResources: this.identifyRequiredResources(lesson),
        riskFactors: lesson.evidence.errorLogs || [],
        successMetrics: this.generateSuccessMetrics(lesson),
        rollbackPlan: this.generateRollbackPlan(lesson)
      },
      
      evidence: {
        basedOnLessons: [lesson.id],
        similarSuccesses: lesson.effectiveness?.appliedCount || 0,
        confidenceFactors: lesson.evidence.successFactors || [],
        potentialRisks: lesson.evidence.errorLogs || []
      },
      
      monitoring: {
        keyMetrics: this.identifyKeyMetrics(lesson),
        checkpoints: this.generateCheckpoints(lesson),
        alertConditions: this.generateAlertConditions(lesson)
      }
    };
  }

  private async createErrorRecommendation(
    lesson: any,
    error: string,
    context: RecommendationContext
  ): Promise<SmartRecommendation> {
    
    return {
      id: `error_rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      lessonId: lesson.id,
      type: 'corrective',
      priority: 'critical',
      
      title: `Resolve ${error} Error`,
      description: `Immediate action needed to resolve ${error} error pattern`,
      rationale: `This error has been seen before and can be resolved using proven methods`,
      expectedBenefit: 'Eliminate error occurrences and improve system stability',
      implementationGuide: lesson.recommendation,
      
      relevanceScore: 0.95,
      confidenceScore: lesson.metadata.confidence,
      impactScore: 0.9,
      complexityScore: 0.4,
      
      timing: {
        urgency: 'immediate',
        estimatedImplementationTime: 15,
        prerequisiteRecommendations: []
      },
      
      implementation: {
        steps: [
          'Identify error source',
          'Apply proven resolution',
          'Verify error is resolved',
          'Monitor for recurrence'
        ],
        requiredResources: ['Developer time', 'System access'],
        riskFactors: ['Potential downtime during fix'],
        successMetrics: ['Error rate reduction', 'System stability improvement'],
        rollbackPlan: 'Revert changes if new issues arise'
      },
      
      evidence: {
        basedOnLessons: [lesson.id],
        similarSuccesses: lesson.effectiveness?.appliedCount || 0,
        confidenceFactors: ['Previous successful resolutions'],
        potentialRisks: ['System instability during fix']
      },
      
      monitoring: {
        keyMetrics: ['Error rate', 'System uptime'],
        checkpoints: ['After implementation', '1 hour later', '24 hours later'],
        alertConditions: ['Error recurrence', 'New related errors']
      }
    };
  }

  private async createPerformanceRecommendation(
    lesson: any,
    issue: string,
    context: RecommendationContext
  ): Promise<SmartRecommendation> {
    
    return {
      id: `perf_rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      lessonId: lesson.id,
      type: 'optimization',
      priority: 'high',
      
      title: `Optimize ${issue}`,
      description: `Performance optimization for ${issue}`,
      rationale: lesson.insight,
      expectedBenefit: 'Improved system performance and efficiency',
      implementationGuide: lesson.recommendation,
      
      relevanceScore: 0.85,
      confidenceScore: lesson.metadata.confidence,
      impactScore: 0.8,
      complexityScore: 0.6,
      
      timing: {
        urgency: 'short_term',
        estimatedImplementationTime: 30,
        prerequisiteRecommendations: []
      },
      
      implementation: {
        steps: [
          'Baseline current performance',
          'Apply optimization techniques',
          'Measure performance improvement',
          'Fine-tune if needed'
        ],
        requiredResources: ['Performance monitoring tools', 'System access'],
        riskFactors: ['Potential temporary performance impact'],
        successMetrics: ['Response time improvement', 'Resource utilization reduction'],
        rollbackPlan: 'Revert to previous configuration'
      },
      
      evidence: {
        basedOnLessons: [lesson.id],
        similarSuccesses: lesson.effectiveness?.appliedCount || 0,
        confidenceFactors: ['Proven optimization techniques'],
        potentialRisks: ['Temporary performance degradation']
      },
      
      monitoring: {
        keyMetrics: ['Response time', 'CPU usage', 'Memory usage'],
        checkpoints: ['Before optimization', 'During implementation', 'After completion'],
        alertConditions: ['Performance degradation', 'Resource spikes']
      }
    };
  }

  private async createResourceRecommendation(
    lesson: any,
    constraint: string,
    context: RecommendationContext
  ): Promise<SmartRecommendation> {
    
    return {
      id: `resource_rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      lessonId: lesson.id,
      type: 'optimization',
      priority: 'medium',
      
      title: `Address ${constraint} Constraint`,
      description: `Resource optimization for ${constraint}`,
      rationale: lesson.insight,
      expectedBenefit: 'Better resource utilization and cost efficiency',
      implementationGuide: lesson.recommendation,
      
      relevanceScore: 0.75,
      confidenceScore: lesson.metadata.confidence,
      impactScore: 0.7,
      complexityScore: 0.5,
      
      timing: {
        urgency: 'medium_term',
        estimatedImplementationTime: 45,
        prerequisiteRecommendations: []
      },
      
      implementation: {
        steps: [
          'Analyze current resource usage',
          'Implement resource optimization',
          'Monitor resource efficiency',
          'Adjust as needed'
        ],
        requiredResources: ['Resource monitoring tools', 'Configuration access'],
        riskFactors: ['Potential resource shortage during optimization'],
        successMetrics: ['Resource utilization improvement', 'Cost reduction'],
        rollbackPlan: 'Restore previous resource allocation'
      },
      
      evidence: {
        basedOnLessons: [lesson.id],
        similarSuccesses: lesson.effectiveness?.appliedCount || 0,
        confidenceFactors: ['Resource optimization best practices'],
        potentialRisks: ['Temporary resource constraints']
      },
      
      monitoring: {
        keyMetrics: ['Resource utilization', 'Cost metrics', 'Performance impact'],
        checkpoints: ['Pre-optimization', 'During changes', 'Post-optimization'],
        alertConditions: ['Resource exhaustion', 'Performance degradation']
      }
    };
  }

  // Additional helper methods for recommendation generation...
  
  private mapLessonCategoryToRecommendationType(category: string): 'preventive' | 'corrective' | 'optimization' | 'enhancement' {
    const mapping: Record<string, any> = {
      'error_pattern': 'corrective',
      'optimization': 'optimization',
      'success_pattern': 'enhancement',
      'resource_management': 'optimization',
      'coordination': 'enhancement'
    };
    
    return mapping[category] || 'enhancement';
  }

  private mapImpactToPriority(impact: string): 'critical' | 'high' | 'medium' | 'low' {
    const mapping: Record<string, any> = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    
    return mapping[impact] || 'medium';
  }

  private mapImpactToScore(impact: string): number {
    const mapping: Record<string, number> = {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.6,
      'low': 0.4
    };
    
    return mapping[impact] || 0.5;
  }

  private estimateComplexityScore(lesson: any, context: RecommendationContext): number {
    let complexity = 0.5; // Base complexity
    
    // Increase complexity based on lesson factors
    if (lesson.evidence.patterns && lesson.evidence.patterns.length > 3) {
      complexity += 0.2;
    }
    
    if (lesson.preventionStrategy) {
      complexity += 0.1;
    }
    
    // Adjust based on context
    if (context.preferences?.acceptableComplexity === 'low') {
      complexity *= 0.8;
    } else if (context.preferences?.acceptableComplexity === 'high') {
      complexity *= 1.2;
    }
    
    return Math.min(complexity, 1.0);
  }

  private determineUrgency(lesson: any, context: RecommendationContext): 'immediate' | 'short_term' | 'medium_term' | 'long_term' {
    if (lesson.metadata.impact === 'critical') return 'immediate';
    if (lesson.metadata.category === 'error_pattern') return 'immediate';
    if (context.recentIssues && context.recentIssues.errors.length > 0) return 'short_term';
    if (lesson.metadata.impact === 'high') return 'short_term';
    if (lesson.metadata.impact === 'medium') return 'medium_term';
    return 'long_term';
  }

  private estimateImplementationTime(lesson: any): number {
    // Base time in minutes
    let time = 30;
    
    if (lesson.metadata.category === 'error_pattern') time = 15;
    if (lesson.metadata.impact === 'critical') time = 10;
    if (lesson.preventionStrategy) time += 15;
    
    return time;
  }

  private generateImplementationSteps(lesson: any): string[] {
    const steps = [
      'Review lesson details and recommendations',
      'Prepare necessary resources and tools',
      'Implement the recommended changes',
      'Verify implementation success',
      'Monitor for expected improvements'
    ];
    
    if (lesson.preventionStrategy) {
      steps.push('Implement prevention strategy');
    }
    
    return steps;
  }

  private identifyRequiredResources(lesson: any): string[] {
    const resources = ['Developer time', 'System access'];
    
    if (lesson.metadata.category === 'resource_management') {
      resources.push('Resource monitoring tools');
    }
    
    if (lesson.metadata.category === 'optimization') {
      resources.push('Performance monitoring tools');
    }
    
    return resources;
  }

  private generateSuccessMetrics(lesson: any): string[] {
    const metrics = ['Implementation completed successfully'];
    
    switch (lesson.metadata.category) {
      case 'error_pattern':
        metrics.push('Error rate reduction');
        break;
      case 'optimization':
        metrics.push('Performance improvement');
        break;
      case 'resource_management':
        metrics.push('Resource utilization improvement');
        break;
      default:
        metrics.push('Expected outcome achieved');
    }
    
    return metrics;
  }

  private generateRollbackPlan(lesson: any): string {
    if (lesson.metadata.category === 'error_pattern') {
      return 'Document current state before changes, revert if new issues arise';
    }
    
    return 'Create backup of current configuration, revert if problems occur';
  }

  private identifyKeyMetrics(lesson: any): string[] {
    const metrics = ['System health'];
    
    switch (lesson.metadata.category) {
      case 'error_pattern':
        metrics.push('Error rate', 'System stability');
        break;
      case 'optimization':
        metrics.push('Performance metrics', 'Resource usage');
        break;
      case 'resource_management':
        metrics.push('Resource utilization', 'Cost metrics');
        break;
    }
    
    return metrics;
  }

  private generateCheckpoints(lesson: any): string[] {
    return [
      'Before implementation',
      'During implementation',
      'Immediately after implementation',
      '1 hour after implementation',
      '24 hours after implementation'
    ];
  }

  private generateAlertConditions(lesson: any): string[] {
    const conditions = ['System instability', 'Unexpected errors'];
    
    if (lesson.metadata.category === 'optimization') {
      conditions.push('Performance degradation');
    }
    
    if (lesson.metadata.category === 'resource_management') {
      conditions.push('Resource exhaustion');
    }
    
    return conditions;
  }

  private isStrategyApplicable(
    strategy: RecommendationStrategy,
    context: RecommendationContext,
    analysis: any
  ): boolean {
    
    for (const [condition, value] of Object.entries(strategy.applicabilityConditions)) {
      switch (condition) {
        case 'hasPerformanceIssues':
          if (value && (!context.recentIssues?.performanceIssues || context.recentIssues.performanceIssues.length === 0)) {
            return false;
          }
          break;
        case 'hasRecentErrors':
          if (value && (!context.recentIssues?.errors || context.recentIssues.errors.length === 0)) {
            return false;
          }
          break;
        case 'optimizationFocus':
          if (context.preferences?.optimizationFocus !== value) {
            return false;
          }
          break;
        case 'riskTolerance':
          if (context.preferences?.riskTolerance !== value) {
            return false;
          }
          break;
      }
    }
    
    return true;
  }

  private applyStrategy(
    recommendations: SmartRecommendation[],
    strategy: RecommendationStrategy,
    context: RecommendationContext
  ): SmartRecommendation[] {
    
    return recommendations.filter(rec => {
      // Apply filter criteria
      for (const [criterion, value] of Object.entries(strategy.filterCriteria)) {
        switch (criterion) {
          case 'minImpactScore':
            if (rec.impactScore < value) return false;
            break;
          case 'maxComplexityScore':
            if (rec.complexityScore > value) return false;
            break;
          case 'minConfidenceScore':
            if (rec.confidenceScore < value) return false;
            break;
          case 'minRelevanceScore':
            if (rec.relevanceScore < value) return false;
            break;
          case 'recommendationType':
            if (rec.type !== value) return false;
            break;
        }
      }
      
      return true;
    });
  }

  private calculateStrategicScore(
    recommendation: SmartRecommendation,
    strategies: RecommendationStrategy[]
  ): number {
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const strategy of strategies) {
      let strategyScore = 0;
      
      for (const [factor, weight] of Object.entries(strategy.weightingFactors)) {
        switch (factor) {
          case 'impactScore':
            strategyScore += recommendation.impactScore * weight;
            break;
          case 'complexityScore':
            strategyScore += recommendation.complexityScore * weight;
            break;
          case 'confidenceScore':
            strategyScore += recommendation.confidenceScore * weight;
            break;
          case 'relevanceScore':
            strategyScore += recommendation.relevanceScore * weight;
            break;
        }
      }
      
      totalScore += strategyScore;
      totalWeight += Object.values(strategy.weightingFactors).reduce((sum, w) => sum + Math.abs(w), 0);
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : recommendation.relevanceScore;
  }

  private async getLessonDetails(lessonId: string): Promise<any> {
    // This would fetch lesson details from the lessons service
    // For now, return a mock lesson
    return {
      id: lessonId,
      title: 'Sample Lesson',
      description: 'Sample lesson description',
      insight: 'Sample insight',
      recommendation: 'Sample recommendation',
      metadata: {
        category: 'optimization',
        impact: 'medium',
        confidence: 0.8
      },
      evidence: {
        patterns: [],
        errorLogs: [],
        successFactors: []
      },
      effectiveness: {
        appliedCount: 5
      }
    };
  }

  private async setupRecommendationMonitoring(recommendationId: string, swarmId: string): Promise<void> {
    // Set up monitoring for recommendation effectiveness
    setTimeout(async () => {
      await this.checkRecommendationProgress(recommendationId, swarmId);
    }, 300000); // Check after 5 minutes
  }

  private async checkRecommendationProgress(recommendationId: string, swarmId: string): Promise<void> {
    // Check implementation progress and collect initial feedback
    const implementation = await this.memoryService.retrieveSwarmData(
      swarmId,
      `recommendation_implementation_${recommendationId}`
    );
    
    if (implementation && !implementation.feedbackCollected) {
      // Schedule feedback collection reminder
      await this.memoryService.storeSwarmData(
        swarmId,
        `feedback_reminder_${recommendationId}`,
        {
          recommendationId,
          implementationId: implementation.id,
          reminderAt: Date.now(),
          status: 'pending_feedback'
        }
      );
    }
  }

  private async updateRecommendationModel(recommendationId: string, feedback: any): Promise<void> {
    // Update recommendation scoring model based on feedback
    // This would typically involve machine learning model updates
    
    const effectiveness = this.mapEffectivenessToScore(feedback.effectiveness);
    
    // Store model update data
    await this.memoryService.store(
      `model_update_${recommendationId}`,
      {
        recommendationId,
        effectiveness,
        actualImpact: feedback.actualImpact,
        modelUpdateAt: Date.now()
      },
      'recommendation_model_updates'
    );
  }

  private mapEffectivenessToScore(effectiveness: string): number {
    const mapping: Record<string, number> = {
      'excellent': 1.0,
      'good': 0.8,
      'fair': 0.6,
      'poor': 0.3
    };
    
    return mapping[effectiveness] || 0.5;
  }

  private hashContext(context: RecommendationContext): string {
    return require('crypto')
      .createHash('md5')
      .update(JSON.stringify({
        swarmId: context.swarmId,
        taskType: context.currentTask?.type,
        topology: context.swarmState.topology,
        agentRoles: context.swarmState.agentRoles,
        issues: context.recentIssues
      }))
      .digest('hex');
  }

  private setupCacheCleanup(): void {
    // Clean cache every 30 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [hash, plan] of this.recommendationCache.entries()) {
        if (plan.validUntil <= now) {
          this.recommendationCache.delete(hash);
        }
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Close and cleanup
   */
  close(): void {
    this.recommendationCache.clear();
  }
}

// Export factory function
export function createRecommendationEngine(
  lessonsService: LessonsLearnedService,
  lessonsIntegration: LessonsIntegration,
  memoryService: MemoryService
): LessonsRecommendationEngine {
  return new LessonsRecommendationEngine(lessonsService, lessonsIntegration, memoryService);
}