/**
 * Lessons Integration Service
 * Connects the LessonsLearnedService with existing trace systems and memory stores
 */

import { EventEmitter } from 'events';
import { LessonsLearnedService, createLessonsLearnedService } from './LessonsLearnedService';
import { SwarmTracer } from '../../../../shared/langfuse-wrapper/src/swarm-tracer';
import { hookTracer } from '../../../../shared/langfuse-wrapper/src/hook-tracer';
import { MemoryService } from './MemoryService';

export interface LessonsConfig {
  enableAutoExtraction: boolean;
  analysisInterval: number; // milliseconds
  minConfidenceThreshold: number;
  maxLessonsPerTrace: number;
  enableRecommendations: boolean;
  enableFeedbackLoop: boolean;
}

export interface TraceAnalysisEvent {
  traceId: string;
  swarmId: string;
  analysisType: 'real_time' | 'batch' | 'manual';
  lessonsExtracted: number;
  patternsFound: string[];
  timestamp: number;
}

export interface RecommendationEvent {
  contextHash: string;
  swarmId: string;
  recommendationCount: number;
  topRelevanceScore: number;
  appliedRecommendations: string[];
  timestamp: number;
}

export class LessonsIntegration extends EventEmitter {
  private lessonsService: LessonsLearnedService;
  private memoryService: MemoryService;
  private config: LessonsConfig;
  private analysisQueue: Map<string, any> = new Map();
  private processingBatch = false;

  constructor(
    memoryService: MemoryService,
    config: Partial<LessonsConfig> = {}
  ) {
    super();

    this.memoryService = memoryService;
    this.config = {
      enableAutoExtraction: true,
      analysisInterval: 30000, // 30 seconds
      minConfidenceThreshold: 0.6,
      maxLessonsPerTrace: 5,
      enableRecommendations: true,
      enableFeedbackLoop: true,
      ...config
    };

    // Initialize lessons service with memory store integration
    this.lessonsService = createLessonsLearnedService('.swarm/lessons.db', memoryService);
    
    this.setupIntegrations();
    this.startPeriodicProcessing();
  }

  /**
   * Setup integrations with existing trace systems
   */
  private setupIntegrations(): void {
    // Listen to SwarmTracer events
    this.setupSwarmTracerIntegration();
    
    // Listen to HookTracer events
    this.setupHookTracerIntegration();
    
    // Listen to memory store events
    this.setupMemoryStoreIntegration();
    
    // Setup lessons service event forwarding
    this.setupLessonsServiceEvents();
  }

  private setupSwarmTracerIntegration(): void {
    // Hook into swarm completion events for comprehensive analysis
    // Note: This would normally listen to SwarmTracer events, but we'll simulate the integration
    
    console.log('Setting up SwarmTracer integration for lessons extraction...');
    
    // Store integration setup in memory
    this.memoryService.storeSwarmData('lessons_integration', 'swarm_tracer_setup', {
      setupAt: Date.now(),
      config: this.config,
      status: 'active'
    });
  }

  private setupHookTracerIntegration(): void {
    // Real-time hook analysis for immediate lesson extraction
    console.log('Setting up HookTracer integration for real-time lesson extraction...');
    
    // Store hook tracer configuration
    this.memoryService.storeSwarmData('lessons_integration', 'hook_tracer_setup', {
      setupAt: Date.now(),
      realTimeAnalysis: true,
      thresholds: {
        errorFrequency: 3,
        performanceDegradation: 0.2,
        memoryGrowth: 0.15
      }
    });
  }

  private setupMemoryStoreIntegration(): void {
    // Listen for coordination patterns in memory
    console.log('Setting up memory store integration for pattern recognition...');
    
    this.memoryService.store('lessons_integration_config', {
      coordinationPatterns: true,
      taskPatterns: true,
      errorPatterns: true,
      successPatterns: true,
      setupAt: Date.now()
    }, 'lessons_system');
  }

  private setupLessonsServiceEvents(): void {
    // Forward lessons service events
    this.lessonsService.on('lesson_created', (data) => {
      this.emit('lesson_created', data);
      this.storeEventInMemory('lesson_created', data);
    });

    this.lessonsService.on('lesson_applied', (data) => {
      this.emit('lesson_applied', data);
      this.storeEventInMemory('lesson_applied', data);
    });

    this.lessonsService.on('recommendations_generated', (data) => {
      this.emit('recommendations_generated', data);
      this.storeEventInMemory('recommendations_generated', data);
    });

    this.lessonsService.on('lessons_extracted', (data) => {
      this.emit('lessons_extracted', data);
      this.broadcastLessonsUpdate(data);
    });
  }

  /**
   * Process a swarm trace for lesson extraction
   */
  async processSwarmTrace(traceData: {
    id: string;
    swarmId: string;
    spans?: any[];
    tasks?: any[];
    errors?: any[];
    metadata?: any;
    duration?: number;
    tokenUsage?: any;
  }): Promise<TraceAnalysisEvent> {
    
    if (!this.config.enableAutoExtraction) {
      throw new Error('Auto-extraction is disabled');
    }

    const startTime = Date.now();
    
    try {
      // Extract lessons from the trace
      const lessons = await this.lessonsService.extractLessonsFromTrace(traceData);
      
      // Filter by confidence threshold
      const qualifiedLessons = lessons.filter(
        lesson => lesson.metadata.confidence >= this.config.minConfidenceThreshold
      );

      // Limit lessons per trace
      const finalLessons = qualifiedLessons.slice(0, this.config.maxLessonsPerTrace);

      // Extract patterns found
      const patternsFound = lessons.map(lesson => lesson.metadata.subcategory);

      const analysisEvent: TraceAnalysisEvent = {
        traceId: traceData.id,
        swarmId: traceData.swarmId,
        analysisType: 'real_time',
        lessonsExtracted: finalLessons.length,
        patternsFound,
        timestamp: Date.now()
      };

      // Store analysis results in memory
      await this.storeAnalysisResults(analysisEvent, finalLessons);

      // Generate recommendations if enabled
      if (this.config.enableRecommendations && finalLessons.length > 0) {
        await this.generateContextualRecommendations(traceData);
      }

      this.emit('trace_analyzed', analysisEvent);
      
      return analysisEvent;

    } catch (error) {
      console.error('Error processing swarm trace for lessons:', error);
      throw error;
    }
  }

  /**
   * Analyze hook trace data for immediate lessons
   */
  async processHookTrace(hookData: {
    id: string;
    hookType: string;
    hookPhase: 'pre' | 'post' | 'error';
    duration?: number;
    error?: Error;
    metadata: any;
  }): Promise<void> {
    
    if (!this.config.enableAutoExtraction) return;

    // Immediate analysis for critical patterns
    if (hookData.hookPhase === 'error' || (hookData.duration && hookData.duration > 10000)) {
      // Queue for batch processing
      this.analysisQueue.set(hookData.id, {
        type: 'hook',
        data: hookData,
        queuedAt: Date.now()
      });

      // Store hook pattern in memory for pattern recognition
      await this.memoryService.store(
        `hook_pattern_${hookData.hookType}_${hookData.hookPhase}`,
        {
          hookId: hookData.id,
          hookType: hookData.hookType,
          phase: hookData.hookPhase,
          duration: hookData.duration,
          error: hookData.error?.message,
          timestamp: Date.now(),
          metadata: hookData.metadata
        },
        'hook_patterns'
      );
    }
  }

  /**
   * Generate recommendations for a specific context
   */
  async generateRecommendationsForContext(context: {
    swarmId: string;
    taskType?: string;
    agentRoles?: string[];
    topology?: string;
    currentIssues?: string[];
    targetMetrics?: Record<string, number>;
  }): Promise<RecommendationEvent> {
    
    if (!this.config.enableRecommendations) {
      throw new Error('Recommendations are disabled');
    }

    const recommendations = await this.lessonsService.generateRecommendations(context);
    
    const event: RecommendationEvent = {
      contextHash: this.hashContext(context),
      swarmId: context.swarmId,
      recommendationCount: recommendations.length,
      topRelevanceScore: recommendations[0]?.relevanceScore || 0,
      appliedRecommendations: [], // Will be populated when recommendations are applied
      timestamp: Date.now()
    };

    // Store recommendations in memory for quick access
    await this.memoryService.storeSwarmData(
      context.swarmId,
      'current_recommendations',
      {
        recommendations,
        generatedAt: Date.now(),
        context
      }
    );

    this.emit('recommendations_ready', { event, recommendations });
    
    return event;
  }

  /**
   * Apply a lesson and track its effectiveness
   */
  async applyLessonRecommendation(
    lessonId: string,
    applicationContext: {
      swarmId: string;
      taskId?: string;
      implementationDetails: Record<string, any>;
      expectedOutcome?: string;
    }
  ): Promise<string> {
    
    const applicationId = await this.lessonsService.applyLesson(lessonId, applicationContext);
    
    // Store application tracking in memory
    await this.memoryService.storeSwarmData(
      applicationContext.swarmId,
      `lesson_application_${applicationId}`,
      {
        lessonId,
        applicationId,
        implementationDetails: applicationContext.implementationDetails,
        expectedOutcome: applicationContext.expectedOutcome,
        appliedAt: Date.now(),
        status: 'monitoring'
      }
    );

    // Set up monitoring for feedback collection
    if (this.config.enableFeedbackLoop) {
      this.setupApplicationMonitoring(applicationId, applicationContext.swarmId);
    }

    return applicationId;
  }

  /**
   * Record feedback on lesson application effectiveness
   */
  async recordLessonFeedback(
    applicationId: string,
    feedback: {
      outcome: 'success' | 'partial' | 'failure';
      improvementMetrics: Record<string, number>;
      qualitativeNotes?: string;
      recommendForFuture?: boolean;
    }
  ): Promise<void> {
    
    await this.lessonsService.recordApplicationFeedback(
      applicationId,
      feedback.outcome,
      feedback.improvementMetrics,
      feedback.qualitativeNotes
    );

    // Store feedback in memory for quick access
    await this.memoryService.store(
      `lesson_feedback_${applicationId}`,
      {
        ...feedback,
        recordedAt: Date.now()
      },
      'lesson_feedback'
    );

    this.emit('feedback_recorded', { applicationId, outcome: feedback.outcome });
  }

  /**
   * Get lessons analytics and insights
   */
  async getLessonsAnalytics(): Promise<any> {
    const analytics = this.lessonsService.getLessonsAnalytics();
    
    // Enhance with memory store data
    const memoryStats = await this.getMemoryStoreLessonsData();
    
    return {
      ...analytics,
      memoryIntegration: memoryStats,
      integrationStatus: {
        autoExtraction: this.config.enableAutoExtraction,
        recommendations: this.config.enableRecommendations,
        feedbackLoop: this.config.enableFeedbackLoop,
        analysisQueueSize: this.analysisQueue.size
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get lessons by category with real-time filtering
   */
  async getLessonsByCategory(
    category: string,
    filters: {
      swarmId?: string;
      confidence?: number;
      recent?: boolean;
      applied?: boolean;
    } = {}
  ): Promise<any[]> {
    
    const baseFilters: any = {
      minConfidence: filters.confidence || this.config.minConfidenceThreshold
    };

    if (filters.recent) {
      const recentThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      baseFilters.since = recentThreshold;
    }

    const lessons = this.lessonsService.getLessonsByCategory(category, baseFilters);
    
    // Enhance with memory data if swarmId is provided
    if (filters.swarmId) {
      const swarmContext = await this.memoryService.retrieveSwarmData(filters.swarmId, 'context');
      return lessons.map(lesson => ({
        ...lesson,
        swarmContext,
        isApplicableToCurrentSwarm: this.isLessonApplicable(lesson, swarmContext)
      }));
    }

    return lessons;
  }

  /**
   * Search lessons with enhanced context
   */
  async searchLessons(query: {
    text?: string;
    category?: string;
    tags?: string[];
    swarmId?: string;
    dateRange?: { start: number; end: number };
  }): Promise<any[]> {
    
    // Get base lessons from service
    let lessons: any[] = [];
    
    if (query.category) {
      lessons = this.lessonsService.getLessonsByCategory(query.category);
    } else {
      // Get all lessons and filter
      const analytics = this.lessonsService.getLessonsAnalytics();
      lessons = analytics.topPerformingLessons || [];
    }

    // Apply filters
    if (query.text) {
      lessons = lessons.filter(lesson => 
        lesson.title.toLowerCase().includes(query.text!.toLowerCase()) ||
        lesson.description.toLowerCase().includes(query.text!.toLowerCase())
      );
    }

    if (query.tags && query.tags.length > 0) {
      lessons = lessons.filter(lesson =>
        lesson.metadata.tags.some((tag: string) => query.tags!.includes(tag))
      );
    }

    if (query.dateRange) {
      lessons = lessons.filter(lesson =>
        lesson.metadata.timestamp >= query.dateRange!.start &&
        lesson.metadata.timestamp <= query.dateRange!.end
      );
    }

    // Enhance with memory context if swarmId provided
    if (query.swarmId) {
      const swarmMemory = await this.getSwarmLessonsContext(query.swarmId);
      lessons = lessons.map(lesson => ({
        ...lesson,
        swarmRelevance: this.calculateSwarmRelevance(lesson, swarmMemory)
      }));
    }

    return lessons.sort((a, b) => b.metadata.confidence - a.metadata.confidence);
  }

  // ===== PRIVATE HELPER METHODS =====

  private async generateContextualRecommendations(traceData: any): Promise<void> {
    const context = {
      swarmId: traceData.swarmId,
      taskType: traceData.metadata?.taskType,
      agentRoles: traceData.metadata?.agentRoles,
      topology: traceData.metadata?.topology,
      currentIssues: this.extractIssuesFromTrace(traceData)
    };

    try {
      await this.generateRecommendationsForContext(context);
    } catch (error) {
      console.warn('Failed to generate contextual recommendations:', error);
    }
  }

  private extractIssuesFromTrace(traceData: any): string[] {
    const issues: string[] = [];
    
    if (traceData.errors && traceData.errors.length > 0) {
      issues.push('errors_detected');
    }
    
    if (traceData.metadata?.performanceIssues) {
      issues.push('performance_degradation');
    }
    
    if (traceData.metadata?.memoryIssues) {
      issues.push('memory_issues');
    }

    return issues;
  }

  private async storeAnalysisResults(event: TraceAnalysisEvent, lessons: any[]): Promise<void> {
    // Store in memory for quick access
    await this.memoryService.storeSwarmData(
      event.swarmId,
      `trace_analysis_${event.traceId}`,
      {
        ...event,
        lessons: lessons.map(l => ({ id: l.id, title: l.title, confidence: l.metadata.confidence }))
      }
    );

    // Store patterns for pattern recognition
    for (const pattern of event.patternsFound) {
      await this.memoryService.store(
        `pattern_occurrence_${pattern}`,
        {
          pattern,
          swarmId: event.swarmId,
          traceId: event.traceId,
          timestamp: event.timestamp
        },
        'pattern_tracking'
      );
    }
  }

  private async storeEventInMemory(eventType: string, data: any): Promise<void> {
    const eventKey = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    await this.memoryService.store(
      eventKey,
      {
        eventType,
        data,
        timestamp: Date.now()
      },
      'lessons_events'
    );
  }

  private async broadcastLessonsUpdate(data: any): Promise<void> {
    // Broadcast to all active swarms about new lessons
    await this.memoryService.store(
      `lessons_broadcast_${Date.now()}`,
      {
        type: 'lessons_update',
        swarmId: data.swarmId,
        lessonsCount: data.lessons,
        timestamp: Date.now()
      },
      'swarm_broadcasts'
    );
  }

  private setupApplicationMonitoring(applicationId: string, swarmId: string): void {
    // Set up monitoring timer
    setTimeout(async () => {
      await this.checkApplicationProgress(applicationId, swarmId);
    }, 300000); // Check after 5 minutes
  }

  private async checkApplicationProgress(applicationId: string, swarmId: string): Promise<void> {
    // Check if feedback has been provided
    const feedback = await this.memoryService.retrieve(`lesson_feedback_${applicationId}`, 'lesson_feedback');
    
    if (!feedback) {
      // No feedback yet, schedule reminder
      await this.memoryService.storeSwarmData(
        swarmId,
        `feedback_reminder_${applicationId}`,
        {
          applicationId,
          reminderCount: 1,
          lastReminder: Date.now(),
          needsFeedback: true
        }
      );
    }
  }

  private async getMemoryStoreLessonsData(): Promise<any> {
    // Get lessons-related data from memory store
    const patterns = await this.memoryService.search('pattern_', 'pattern_tracking');
    const events = await this.memoryService.search('lessons_', 'lessons_events');
    const applications = await this.memoryService.search('lesson_application_', 'default');

    return {
      patternsTracked: patterns.length,
      eventsRecorded: events.length,
      applicationsMonitored: applications.length,
      lastUpdate: Date.now()
    };
  }

  private isLessonApplicable(lesson: any, swarmContext: any): boolean {
    if (!swarmContext) return false;
    
    // Check applicability rules
    if (lesson.applicability && Array.isArray(lesson.applicability)) {
      return lesson.applicability.some((rule: any) => {
        return this.evaluateApplicabilityRule(rule, swarmContext);
      });
    }
    
    return true; // Default to applicable if no rules
  }

  private evaluateApplicabilityRule(rule: any, context: any): boolean {
    // Simple rule evaluation - can be enhanced
    if (rule.conditions.topology && context.topology) {
      return rule.conditions.topology === context.topology;
    }
    
    return rule.priority !== 'avoid';
  }

  private calculateSwarmRelevance(lesson: any, swarmMemory: any): number {
    let relevance = lesson.metadata.confidence * 0.5;
    
    // Add relevance based on swarm-specific factors
    if (swarmMemory.patterns && lesson.evidence.patterns) {
      const commonPatterns = swarmMemory.patterns.filter((p: string) =>
        lesson.evidence.patterns.includes(p)
      );
      relevance += (commonPatterns.length / lesson.evidence.patterns.length) * 0.3;
    }
    
    // Recent application success in this swarm
    if (swarmMemory.successfulApplications && 
        swarmMemory.successfulApplications.includes(lesson.id)) {
      relevance += 0.2;
    }
    
    return Math.min(relevance, 1.0);
  }

  private async getSwarmLessonsContext(swarmId: string): Promise<any> {
    const patterns = await this.memoryService.retrieveSwarmData(swarmId, 'patterns') || { patterns: [] };
    const applications = await this.memoryService.search(`lesson_application_`, 'default');
    
    const swarmApplications = applications.filter((app: any) => 
      app.value && app.value.swarmId === swarmId
    );
    
    const successfulApplications = swarmApplications
      .filter((app: any) => app.value.outcome === 'success')
      .map((app: any) => app.value.lessonId);

    return {
      ...patterns,
      successfulApplications,
      totalApplications: swarmApplications.length
    };
  }

  private hashContext(context: any): string {
    return require('crypto')
      .createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex');
  }

  private startPeriodicProcessing(): void {
    // Process analysis queue periodically
    setInterval(() => {
      if (!this.processingBatch && this.analysisQueue.size > 0) {
        this.processBatchAnalysis();
      }
    }, this.config.analysisInterval);
  }

  private async processBatchAnalysis(): Promise<void> {
    if (this.processingBatch) return;
    
    this.processingBatch = true;
    
    try {
      const items = Array.from(this.analysisQueue.entries()).slice(0, 10); // Process up to 10 items
      
      for (const [id, item] of items) {
        try {
          if (item.type === 'hook') {
            await this.analyzeHookForPatterns(item.data);
          }
          
          this.analysisQueue.delete(id);
        } catch (error) {
          console.warn(`Failed to analyze item ${id}:`, error);
        }
      }
      
    } finally {
      this.processingBatch = false;
    }
  }

  private async analyzeHookForPatterns(hookData: any): Promise<void> {
    // Analyze hook data for patterns that could become lessons
    const patternKey = `${hookData.hookType}_${hookData.hookPhase}`;
    
    // Get similar hooks from memory
    const similarHooks = await this.memoryService.search(patternKey, 'hook_patterns');
    
    if (similarHooks.length >= 3) {
      // Enough occurrences to potentially create a lesson
      const pattern = this.analyzeHookPattern(similarHooks);
      
      if (pattern.confidence > this.config.minConfidenceThreshold) {
        // Create a lesson from the pattern
        const mockTraceData = {
          id: `hook_pattern_${Date.now()}`,
          swarmId: 'pattern_analysis',
          metadata: {
            hookPattern: pattern,
            hookType: hookData.hookType,
            occurrences: similarHooks.length
          }
        };
        
        await this.lessonsService.extractLessonsFromTrace(mockTraceData);
      }
    }
  }

  private analyzeHookPattern(hooks: any[]): any {
    // Analyze pattern in hook occurrences
    const errors = hooks.filter(h => h.value.error).length;
    const avgDuration = hooks.reduce((sum, h) => sum + (h.value.duration || 0), 0) / hooks.length;
    
    return {
      errorRate: errors / hooks.length,
      avgDuration,
      frequency: hooks.length,
      confidence: Math.min((hooks.length / 10) * 0.8, 1.0), // Higher confidence with more occurrences
      timespan: hooks[hooks.length - 1].value.timestamp - hooks[0].value.timestamp
    };
  }

  /**
   * Get integration status
   */
  getIntegrationStatus(): any {
    return {
      config: this.config,
      analysisQueueSize: this.analysisQueue.size,
      processingBatch: this.processingBatch,
      lastUpdate: Date.now(),
      memoryIntegration: 'active',
      lessonsService: 'active'
    };
  }

  /**
   * Close all connections
   */
  close(): void {
    this.lessonsService.close();
    this.analysisQueue.clear();
  }
}

// Export singleton integration instance
let lessonsIntegration: LessonsIntegration | null = null;

export function createLessonsIntegration(
  memoryService: MemoryService,
  config?: Partial<LessonsConfig>
): LessonsIntegration {
  if (!lessonsIntegration) {
    lessonsIntegration = new LessonsIntegration(memoryService, config);
  }
  return lessonsIntegration;
}

export function getLessonsIntegration(): LessonsIntegration | null {
  return lessonsIntegration;
}