/**
 * Lessons API and Management Interface
 * Comprehensive REST API for the lessons learned system
 */

import { Router, Request, Response } from 'express';
import { LessonsLearnedService } from './LessonsLearnedService';
import { LessonsIntegration } from './LessonsIntegration';
import { LessonsRecommendationEngine } from './LessonsRecommendationEngine';
import { PatternRecognitionEngine } from './PatternRecognitionEngine';
import { MemoryService } from './MemoryService';

export interface LessonsAPIConfig {
  enableRealTimeAnalysis: boolean;
  enableRecommendations: boolean;
  enablePatternRecognition: boolean;
  maxRecommendationsPerRequest: number;
  cacheTimeout: number;
  requireAuthentication: boolean;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: number;
    processingTime: number;
    version: string;
    requestId: string;
  };
}

export class LessonsAPI {
  private router: Router;
  private lessonsService: LessonsLearnedService;
  private lessonsIntegration: LessonsIntegration;
  private recommendationEngine: LessonsRecommendationEngine;
  private patternEngine: PatternRecognitionEngine;
  private memoryService: MemoryService;
  private config: LessonsAPIConfig;

  constructor(
    lessonsService: LessonsLearnedService,
    lessonsIntegration: LessonsIntegration,
    recommendationEngine: LessonsRecommendationEngine,
    patternEngine: PatternRecognitionEngine,
    memoryService: MemoryService,
    config: Partial<LessonsAPIConfig> = {}
  ) {
    this.lessonsService = lessonsService;
    this.lessonsIntegration = lessonsIntegration;
    this.recommendationEngine = recommendationEngine;
    this.patternEngine = patternEngine;
    this.memoryService = memoryService;
    
    this.config = {
      enableRealTimeAnalysis: true,
      enableRecommendations: true,
      enablePatternRecognition: true,
      maxRecommendationsPerRequest: 10,
      cacheTimeout: 300000, // 5 minutes
      requireAuthentication: false,
      ...config
    };

    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // ===== LESSONS MANAGEMENT ROUTES =====

    // Get all lessons
    this.router.get('/lessons', this.handleAsync(this.getLessons.bind(this)));
    
    // Get lesson by ID
    this.router.get('/lessons/:id', this.handleAsync(this.getLessonById.bind(this)));
    
    // Search lessons
    this.router.post('/lessons/search', this.handleAsync(this.searchLessons.bind(this)));
    
    // Get lessons by category
    this.router.get('/lessons/category/:category', this.handleAsync(this.getLessonsByCategory.bind(this)));
    
    // Extract lessons from trace
    this.router.post('/lessons/extract', this.handleAsync(this.extractLessonsFromTrace.bind(this)));
    
    // Apply lesson
    this.router.post('/lessons/:id/apply', this.handleAsync(this.applyLesson.bind(this)));
    
    // Record lesson feedback
    this.router.post('/lessons/applications/:applicationId/feedback', this.handleAsync(this.recordLessonFeedback.bind(this)));

    // ===== RECOMMENDATIONS ROUTES =====

    // Generate recommendations
    this.router.post('/recommendations/generate', this.handleAsync(this.generateRecommendations.bind(this)));
    
    // Get immediate recommendations
    this.router.post('/recommendations/immediate', this.handleAsync(this.getImmediateRecommendations.bind(this)));
    
    // Create optimization plan
    this.router.post('/recommendations/optimization-plan', this.handleAsync(this.createOptimizationPlan.bind(this)));
    
    // Track recommendation implementation
    this.router.post('/recommendations/:id/implement', this.handleAsync(this.trackRecommendationImplementation.bind(this)));
    
    // Get recommendation analytics
    this.router.get('/recommendations/analytics', this.handleAsync(this.getRecommendationAnalytics.bind(this)));

    // ===== PATTERN RECOGNITION ROUTES =====

    // Record behavior snapshot
    this.router.post('/patterns/behavior', this.handleAsync(this.recordBehaviorSnapshot.bind(this)));
    
    // Get patterns
    this.router.get('/patterns', this.handleAsync(this.getPatterns.bind(this)));
    
    // Run pattern analysis
    this.router.post('/patterns/analyze', this.handleAsync(this.runPatternAnalysis.bind(this)));
    
    // Predict coordination success
    this.router.post('/patterns/predict', this.handleAsync(this.predictCoordinationSuccess.bind(this)));
    
    // Get pattern evolution
    this.router.get('/patterns/:id/evolution', this.handleAsync(this.getPatternEvolution.bind(this)));
    
    // Get pattern analytics
    this.router.get('/patterns/analytics', this.handleAsync(this.getPatternAnalytics.bind(this)));

    // ===== ANALYTICS AND INSIGHTS ROUTES =====

    // Get overall analytics
    this.router.get('/analytics', this.handleAsync(this.getOverallAnalytics.bind(this)));
    
    // Get insights dashboard
    this.router.get('/insights/dashboard', this.handleAsync(this.getInsightsDashboard.bind(this)));
    
    // Get performance trends
    this.router.get('/analytics/trends', this.handleAsync(this.getPerformanceTrends.bind(this)));
    
    // Export lessons data
    this.router.get('/export/lessons', this.handleAsync(this.exportLessons.bind(this)));
    
    // Export patterns data
    this.router.get('/export/patterns', this.handleAsync(this.exportPatterns.bind(this)));

    // ===== INTEGRATION AND REAL-TIME ROUTES =====

    // Process swarm trace
    this.router.post('/integration/trace', this.handleAsync(this.processSwarmTrace.bind(this)));
    
    // Process hook trace
    this.router.post('/integration/hook', this.handleAsync(this.processHookTrace.bind(this)));
    
    // Get integration status
    this.router.get('/integration/status', this.handleAsync(this.getIntegrationStatus.bind(this)));
    
    // Health check
    this.router.get('/health', this.handleAsync(this.healthCheck.bind(this)));

    // ===== CONFIGURATION ROUTES =====

    // Get current configuration
    this.router.get('/config', this.handleAsync(this.getConfiguration.bind(this)));
    
    // Update configuration
    this.router.put('/config', this.handleAsync(this.updateConfiguration.bind(this)));
  }

  // ===== LESSONS MANAGEMENT HANDLERS =====

  private async getLessons(req: Request, res: Response): Promise<APIResponse> {
    const { category, confidence, limit, offset } = req.query;
    
    const filters: any = {};
    if (confidence) filters.minConfidence = parseFloat(confidence as string);
    if (limit) filters.limit = parseInt(limit as string);
    
    let lessons;
    if (category) {
      lessons = this.lessonsService.getLessonsByCategory(category as string, filters);
    } else {
      const analytics = this.lessonsService.getLessonsAnalytics();
      lessons = analytics.topPerformingLessons || [];
    }
    
    // Apply pagination
    const startIndex = offset ? parseInt(offset as string) : 0;
    const endIndex = startIndex + (filters.limit || 50);
    const paginatedLessons = lessons.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: {
        lessons: paginatedLessons,
        total: lessons.length,
        offset: startIndex,
        limit: filters.limit || 50
      }
    };
  }

  private async getLessonById(req: Request, res: Response): Promise<APIResponse> {
    const { id } = req.params;
    
    // Get lesson from service (implementation depends on service method)
    const lesson = await this.lessonsService.getLessonsByCategory('all').find(l => l.id === id);
    
    if (!lesson) {
      return {
        success: false,
        error: `Lesson not found: ${id}`
      };
    }
    
    // Get related data
    const applications = await this.memoryService.search(`lesson_application_${id}`, 'default');
    const feedback = await this.memoryService.search(`lesson_feedback_`, 'lesson_feedback');
    
    return {
      success: true,
      data: {
        lesson,
        applications: applications.length,
        recentFeedback: feedback.slice(0, 5)
      }
    };
  }

  private async searchLessons(req: Request, res: Response): Promise<APIResponse> {
    const { query, filters } = req.body;
    
    const searchResults = await this.lessonsIntegration.searchLessons({
      text: query?.text,
      category: query?.category,
      tags: query?.tags,
      swarmId: filters?.swarmId,
      dateRange: filters?.dateRange
    });
    
    return {
      success: true,
      data: {
        results: searchResults,
        count: searchResults.length
      }
    };
  }

  private async getLessonsByCategory(req: Request, res: Response): Promise<APIResponse> {
    const { category } = req.params;
    const { confidence, limit, applied } = req.query;
    
    const filters: any = {};
    if (confidence) filters.confidence = parseFloat(confidence as string);
    if (limit) filters.limit = parseInt(limit as string);
    if (applied !== undefined) filters.applied = applied === 'true';
    
    const lessons = await this.lessonsIntegration.getLessonsByCategory(category, filters);
    
    return {
      success: true,
      data: {
        category,
        lessons,
        count: lessons.length
      }
    };
  }

  private async extractLessonsFromTrace(req: Request, res: Response): Promise<APIResponse> {
    const traceData = req.body;
    
    if (!this.config.enableRealTimeAnalysis) {
      return {
        success: false,
        error: 'Real-time analysis is disabled'
      };
    }
    
    const analysisEvent = await this.lessonsIntegration.processSwarmTrace(traceData);
    
    return {
      success: true,
      data: {
        analysisEvent,
        lessonsExtracted: analysisEvent.lessonsExtracted,
        patternsFound: analysisEvent.patternsFound
      }
    };
  }

  private async applyLesson(req: Request, res: Response): Promise<APIResponse> {
    const { id } = req.params;
    const { swarmId, taskId, implementationDetails } = req.body;
    
    const applicationId = await this.lessonsIntegration.applyLessonRecommendation(id, {
      swarmId,
      taskId,
      implementationDetails
    });
    
    return {
      success: true,
      data: {
        applicationId,
        lessonId: id,
        swarmId,
        appliedAt: Date.now()
      }
    };
  }

  private async recordLessonFeedback(req: Request, res: Response): Promise<APIResponse> {
    const { applicationId } = req.params;
    const { outcome, improvementMetrics, qualitativeNotes, recommendForFuture } = req.body;
    
    await this.lessonsIntegration.recordLessonFeedback(applicationId, {
      outcome,
      improvementMetrics,
      qualitativeNotes,
      recommendForFuture
    });
    
    return {
      success: true,
      data: {
        applicationId,
        feedbackRecorded: true,
        timestamp: Date.now()
      }
    };
  }

  // ===== RECOMMENDATIONS HANDLERS =====

  private async generateRecommendations(req: Request, res: Response): Promise<APIResponse> {
    const context = req.body;
    
    if (!this.config.enableRecommendations) {
      return {
        success: false,
        error: 'Recommendations are disabled'
      };
    }
    
    const recommendationEvent = await this.lessonsIntegration.generateRecommendationsForContext(context);
    
    // Get detailed recommendations
    const detailedRecommendations = await this.memoryService.retrieveSwarmData(
      context.swarmId,
      'current_recommendations'
    );
    
    return {
      success: true,
      data: {
        event: recommendationEvent,
        recommendations: detailedRecommendations?.recommendations || [],
        context
      }
    };
  }

  private async getImmediateRecommendations(req: Request, res: Response): Promise<APIResponse> {
    const context = req.body;
    
    const immediateRecommendations = await this.recommendationEngine.getImmediateRecommendations(context);
    
    return {
      success: true,
      data: {
        recommendations: immediateRecommendations,
        count: immediateRecommendations.length,
        urgency: 'immediate'
      }
    };
  }

  private async createOptimizationPlan(req: Request, res: Response): Promise<APIResponse> {
    const context = req.body;
    
    const optimizationPlan = await this.recommendationEngine.generateOptimizationPlan(context);
    
    return {
      success: true,
      data: optimizationPlan
    };
  }

  private async trackRecommendationImplementation(req: Request, res: Response): Promise<APIResponse> {
    const { id } = req.params;
    const implementation = req.body;
    
    await this.recommendationEngine.trackRecommendationImplementation(id, implementation);
    
    return {
      success: true,
      data: {
        recommendationId: id,
        tracked: true,
        implementation
      }
    };
  }

  private async getRecommendationAnalytics(req: Request, res: Response): Promise<APIResponse> {
    const analytics = await this.recommendationEngine.getRecommendationAnalytics();
    
    return {
      success: true,
      data: analytics
    };
  }

  // ===== PATTERN RECOGNITION HANDLERS =====

  private async recordBehaviorSnapshot(req: Request, res: Response): Promise<APIResponse> {
    const snapshot = req.body;
    
    if (!this.config.enablePatternRecognition) {
      return {
        success: false,
        error: 'Pattern recognition is disabled'
      };
    }
    
    await this.patternEngine.recordBehaviorSnapshot(snapshot);
    
    return {
      success: true,
      data: {
        recorded: true,
        swarmId: snapshot.swarmId,
        timestamp: snapshot.timestamp
      }
    };
  }

  private async getPatterns(req: Request, res: Response): Promise<APIResponse> {
    const criteria = req.query;
    
    // Convert query parameters
    const searchCriteria: any = {};
    if (criteria.type) searchCriteria.type = criteria.type as string;
    if (criteria.minSuccessRate) searchCriteria.minSuccessRate = parseFloat(criteria.minSuccessRate as string);
    if (criteria.minConfidence) searchCriteria.minConfidence = parseFloat(criteria.minConfidence as string);
    if (criteria.swarmId) searchCriteria.swarmId = criteria.swarmId as string;
    if (criteria.topology) searchCriteria.topology = criteria.topology as string;
    if (criteria.recentOnly) searchCriteria.recentOnly = criteria.recentOnly === 'true';
    
    const patterns = this.patternEngine.getPatterns(searchCriteria);
    
    return {
      success: true,
      data: {
        patterns,
        count: patterns.length,
        criteria: searchCriteria
      }
    };
  }

  private async runPatternAnalysis(req: Request, res: Response): Promise<APIResponse> {
    const analysisResult = await this.patternEngine.runPatternAnalysis();
    
    return {
      success: true,
      data: analysisResult
    };
  }

  private async predictCoordinationSuccess(req: Request, res: Response): Promise<APIResponse> {
    const strategy = req.body;
    
    const prediction = await this.patternEngine.predictCoordinationSuccess(strategy);
    
    return {
      success: true,
      data: prediction
    };
  }

  private async getPatternEvolution(req: Request, res: Response): Promise<APIResponse> {
    const { id } = req.params;
    
    const evolution = this.patternEngine.getPatternEvolution(id);
    
    return {
      success: true,
      data: {
        patternId: id,
        evolution,
        count: evolution.length
      }
    };
  }

  private async getPatternAnalytics(req: Request, res: Response): Promise<APIResponse> {
    const analytics = this.patternEngine.getPatternAnalytics();
    
    return {
      success: true,
      data: analytics
    };
  }

  // ===== ANALYTICS AND INSIGHTS HANDLERS =====

  private async getOverallAnalytics(req: Request, res: Response): Promise<APIResponse> {
    const lessonsAnalytics = this.lessonsService.getLessonsAnalytics();
    const recommendationAnalytics = await this.recommendationEngine.getRecommendationAnalytics();
    const patternAnalytics = this.patternEngine.getPatternAnalytics();
    
    return {
      success: true,
      data: {
        lessons: lessonsAnalytics,
        recommendations: recommendationAnalytics,
        patterns: patternAnalytics,
        generatedAt: Date.now()
      }
    };
  }

  private async getInsightsDashboard(req: Request, res: Response): Promise<APIResponse> {
    const { timeframe = '24h' } = req.query;
    
    // Get recent activities
    const recentLessons = await this.memoryService.search('lessons_', 'lessons_events');
    const recentRecommendations = await this.memoryService.search('recommendation_', 'default');
    const recentPatterns = await this.memoryService.search('pattern_analysis_', 'pattern_analysis');
    
    const dashboard = {
      summary: {
        totalLessons: this.lessonsService.getLessonsAnalytics().summary.totalLessons,
        activeRecommendations: recentRecommendations.length,
        detectedPatterns: this.patternEngine.getPatterns().length,
        timeframe
      },
      recentActivity: {
        lessonsCreated: recentLessons.filter(l => l.value.eventType === 'lesson_created').length,
        recommendationsGenerated: recentRecommendations.length,
        patternsAnalyzed: recentPatterns.length
      },
      trends: await this.calculateTrends(timeframe as string),
      alerts: await this.generateAlerts()
    };
    
    return {
      success: true,
      data: dashboard
    };
  }

  private async getPerformanceTrends(req: Request, res: Response): Promise<APIResponse> {
    const { metric = 'all', period = '7d' } = req.query;
    
    const trends = await this.calculatePerformanceTrends(metric as string, period as string);
    
    return {
      success: true,
      data: {
        metric,
        period,
        trends
      }
    };
  }

  private async exportLessons(req: Request, res: Response): Promise<APIResponse> {
    const { format = 'json', category } = req.query;
    
    const filters = category ? { category: category as string } : undefined;
    const exportData = this.lessonsService.exportLessons(filters);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csv = this.convertToCSV(exportData.lessons);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=lessons-export.csv');
      return csv;
    }
    
    return {
      success: true,
      data: exportData
    };
  }

  private async exportPatterns(req: Request, res: Response): Promise<APIResponse> {
    const { format = 'json', type } = req.query;
    
    const criteria = type ? { type: type as string } : {};
    const patterns = this.patternEngine.getPatterns(criteria);
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      patterns,
      count: patterns.length,
      analytics: this.patternEngine.getPatternAnalytics()
    };
    
    if (format === 'csv') {
      const csv = this.convertToCSV(patterns);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=patterns-export.csv');
      return csv;
    }
    
    return {
      success: true,
      data: exportData
    };
  }

  // ===== INTEGRATION HANDLERS =====

  private async processSwarmTrace(req: Request, res: Response): Promise<APIResponse> {
    const traceData = req.body;
    
    const analysisEvent = await this.lessonsIntegration.processSwarmTrace(traceData);
    
    return {
      success: true,
      data: {
        processed: true,
        analysisEvent
      }
    };
  }

  private async processHookTrace(req: Request, res: Response): Promise<APIResponse> {
    const hookData = req.body;
    
    await this.lessonsIntegration.processHookTrace(hookData);
    
    return {
      success: true,
      data: {
        processed: true,
        hookId: hookData.id
      }
    };
  }

  private async getIntegrationStatus(req: Request, res: Response): Promise<APIResponse> {
    const status = this.lessonsIntegration.getIntegrationStatus();
    
    return {
      success: true,
      data: status
    };
  }

  private async healthCheck(req: Request, res: Response): Promise<APIResponse> {
    const health = {
      status: 'healthy',
      services: {
        lessonsService: 'active',
        lessonsIntegration: 'active',
        recommendationEngine: 'active',
        patternEngine: 'active',
        memoryService: 'active'
      },
      config: this.config,
      timestamp: Date.now()
    };
    
    return {
      success: true,
      data: health
    };
  }

  // ===== CONFIGURATION HANDLERS =====

  private async getConfiguration(req: Request, res: Response): Promise<APIResponse> {
    return {
      success: true,
      data: {
        config: this.config,
        features: {
          realTimeAnalysis: this.config.enableRealTimeAnalysis,
          recommendations: this.config.enableRecommendations,
          patternRecognition: this.config.enablePatternRecognition
        }
      }
    };
  }

  private async updateConfiguration(req: Request, res: Response): Promise<APIResponse> {
    const updates = req.body;
    
    // Validate updates
    const validKeys = Object.keys(this.config);
    const invalidKeys = Object.keys(updates).filter(key => !validKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      return {
        success: false,
        error: `Invalid configuration keys: ${invalidKeys.join(', ')}`
      };
    }
    
    // Apply updates
    Object.assign(this.config, updates);
    
    // Store updated configuration
    await this.memoryService.store('lessons_api_config', this.config, 'configuration');
    
    return {
      success: true,
      data: {
        updated: true,
        config: this.config
      }
    };
  }

  // ===== HELPER METHODS =====

  private handleAsync(fn: Function) {
    return async (req: Request, res: Response) => {
      const startTime = Date.now();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const result = await fn(req, res);
        
        // If result is a string (CSV), send it directly
        if (typeof result === 'string') {
          res.send(result);
          return;
        }
        
        const response: APIResponse = {
          ...result,
          metadata: {
            timestamp: Date.now(),
            processingTime: Date.now() - startTime,
            version: '1.0.0',
            requestId
          }
        };
        
        res.json(response);
        
      } catch (error) {
        console.error(`API Error in ${fn.name}:`, error);
        
        const errorResponse: APIResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            timestamp: Date.now(),
            processingTime: Date.now() - startTime,
            version: '1.0.0',
            requestId
          }
        };
        
        res.status(500).json(errorResponse);
      }
    };
  }

  private async calculateTrends(timeframe: string): Promise<any> {
    const now = Date.now();
    const timeMs = this.parseTimeframe(timeframe);
    const cutoff = now - timeMs;
    
    // Get trend data from memory
    const recentEvents = await this.memoryService.search('lessons_', 'lessons_events');
    const filteredEvents = recentEvents.filter(e => e.value.timestamp > cutoff);
    
    return {
      lessonsCreated: filteredEvents.filter(e => e.value.eventType === 'lesson_created').length,
      lessonsApplied: filteredEvents.filter(e => e.value.eventType === 'lesson_applied').length,
      feedbackCollected: filteredEvents.filter(e => e.value.eventType === 'feedback_recorded').length,
      timeframe
    };
  }

  private async generateAlerts(): Promise<string[]> {
    const alerts: string[] = [];
    
    // Check for concerning patterns
    const analytics = this.lessonsService.getLessonsAnalytics();
    
    if (analytics.summary.applicationSuccessRate < 0.5) {
      alerts.push('Low lesson application success rate detected');
    }
    
    const patterns = this.patternEngine.getPatterns({ minSuccessRate: 0.3 });
    const poorPatterns = patterns.filter(p => p.effectiveness.successRate < 0.5);
    
    if (poorPatterns.length > patterns.length * 0.3) {
      alerts.push('High number of poor-performing patterns detected');
    }
    
    return alerts;
  }

  private async calculatePerformanceTrends(metric: string, period: string): Promise<any> {
    // Implementation for calculating performance trends
    return {
      metric,
      period,
      dataPoints: [], // Would contain actual trend data
      trend: 'stable'
    };
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(item => 
        headers.map(header => {
          const value = item[header];
          if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/^(\d+)([hdw])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default to 24 hours
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Get the Express router for mounting
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get API documentation
   */
  getAPIDocumentation(): any {
    return {
      version: '1.0.0',
      title: 'Lessons Learned API',
      description: 'Comprehensive API for the lessons learned system',
      baseUrl: '/api/lessons',
      endpoints: {
        lessons: {
          'GET /lessons': 'Get all lessons with optional filtering',
          'GET /lessons/:id': 'Get specific lesson by ID',
          'POST /lessons/search': 'Search lessons with complex criteria',
          'GET /lessons/category/:category': 'Get lessons by category',
          'POST /lessons/extract': 'Extract lessons from trace data',
          'POST /lessons/:id/apply': 'Apply a lesson to a swarm',
          'POST /lessons/applications/:applicationId/feedback': 'Record feedback on lesson application'
        },
        recommendations: {
          'POST /recommendations/generate': 'Generate recommendations for context',
          'POST /recommendations/immediate': 'Get immediate action recommendations',
          'POST /recommendations/optimization-plan': 'Create comprehensive optimization plan',
          'POST /recommendations/:id/implement': 'Track recommendation implementation',
          'GET /recommendations/analytics': 'Get recommendation performance analytics'
        },
        patterns: {
          'POST /patterns/behavior': 'Record swarm behavior snapshot',
          'GET /patterns': 'Get coordination patterns with filtering',
          'POST /patterns/analyze': 'Run pattern analysis on recorded data',
          'POST /patterns/predict': 'Predict coordination success probability',
          'GET /patterns/:id/evolution': 'Get pattern evolution history',
          'GET /patterns/analytics': 'Get pattern recognition analytics'
        },
        analytics: {
          'GET /analytics': 'Get comprehensive system analytics',
          'GET /insights/dashboard': 'Get insights dashboard data',
          'GET /analytics/trends': 'Get performance trends analysis',
          'GET /export/lessons': 'Export lessons data',
          'GET /export/patterns': 'Export patterns data'
        },
        integration: {
          'POST /integration/trace': 'Process swarm trace for analysis',
          'POST /integration/hook': 'Process hook trace for analysis',
          'GET /integration/status': 'Get integration system status',
          'GET /health': 'System health check'
        },
        configuration: {
          'GET /config': 'Get current API configuration',
          'PUT /config': 'Update API configuration'
        }
      },
      authentication: this.config.requireAuthentication ? 'Required' : 'Optional',
      rateLimit: 'Standard rate limiting applies',
      responseFormat: {
        success: 'boolean',
        data: 'object | array | null',
        error: 'string | null',
        metadata: {
          timestamp: 'number',
          processingTime: 'number (ms)',
          version: 'string',
          requestId: 'string'
        }
      }
    };
  }
}

// Export factory function
export function createLessonsAPI(
  lessonsService: LessonsLearnedService,
  lessonsIntegration: LessonsIntegration,
  recommendationEngine: LessonsRecommendationEngine,
  patternEngine: PatternRecognitionEngine,
  memoryService: MemoryService,
  config?: Partial<LessonsAPIConfig>
): LessonsAPI {
  return new LessonsAPI(
    lessonsService,
    lessonsIntegration,
    recommendationEngine,
    patternEngine,
    memoryService,
    config
  );
}