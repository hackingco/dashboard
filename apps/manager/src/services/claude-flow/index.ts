/**
 * Claude Flow Lessons Learned System - Main Integration Module
 * Comprehensive lessons learned system with automated pattern recognition and recommendations
 */

import { EventEmitter } from 'events';
import { LessonsLearnedService, createLessonsLearnedService } from './LessonsLearnedService';
import { LessonsIntegration, createLessonsIntegration, LessonsConfig } from './LessonsIntegration';
import { LessonsRecommendationEngine, createRecommendationEngine } from './LessonsRecommendationEngine';
import { PatternRecognitionEngine, createPatternRecognitionEngine } from './PatternRecognitionEngine';
import { LessonsAPI, createLessonsAPI, LessonsAPIConfig } from './LessonsAPI';
import { MemoryService } from './MemoryService';
import { Router } from 'express';

export interface LessonsSystemConfig {
  // Core services configuration
  lessonsDb?: string;
  patternsDb?: string;
  enableAutoExtraction?: boolean;
  enableRecommendations?: boolean;
  enablePatternRecognition?: boolean;
  enableAPI?: boolean;
  
  // Analysis configuration
  analysisInterval?: number;
  minConfidenceThreshold?: number;
  maxLessonsPerTrace?: number;
  
  // API configuration
  apiConfig?: Partial<LessonsAPIConfig>;
  
  // Integration configuration
  integrationConfig?: Partial<LessonsConfig>;
  
  // Performance configuration
  batchSize?: number;
  cacheTimeout?: number;
  maxMemoryEntries?: number;
}

export interface LessonsSystemStatus {
  services: {
    lessonsService: 'active' | 'inactive' | 'error';
    integration: 'active' | 'inactive' | 'error';
    recommendationEngine: 'active' | 'inactive' | 'error';
    patternEngine: 'active' | 'inactive' | 'error';
    api: 'active' | 'inactive' | 'error';
  };
  statistics: {
    totalLessons: number;
    totalPatterns: number;
    totalRecommendations: number;
    activeAnalyses: number;
  };
  performance: {
    memoryUsage: number;
    averageResponseTime: number;
    successRate: number;
  };
  lastUpdate: number;
}

export interface LessonsSystemEvents {
  'system_initialized': { timestamp: number; config: LessonsSystemConfig };
  'lesson_created': { lessonId: string; category: string; confidence: number };
  'lesson_applied': { lessonId: string; applicationId: string; swarmId: string };
  'pattern_discovered': { patternId: string; type: string; confidence: number };
  'recommendation_generated': { count: number; swarmId: string; relevance: number };
  'analysis_completed': { type: string; duration: number; results: number };
  'error_occurred': { component: string; error: string; timestamp: number };
}

export class LessonsSystem extends EventEmitter {
  private config: LessonsSystemConfig;
  private memoryService: MemoryService;
  
  // Core services
  private lessonsService: LessonsLearnedService | null = null;
  private lessonsIntegration: LessonsIntegration | null = null;
  private recommendationEngine: LessonsRecommendationEngine | null = null;
  private patternEngine: PatternRecognitionEngine | null = null;
  private api: LessonsAPI | null = null;
  
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(memoryService: MemoryService, config: LessonsSystemConfig = {}) {
    super();
    
    this.memoryService = memoryService;
    this.config = {
      lessonsDb: '.swarm/lessons.db',
      patternsDb: '.swarm/patterns.db',
      enableAutoExtraction: true,
      enableRecommendations: true,
      enablePatternRecognition: true,
      enableAPI: true,
      analysisInterval: 30000, // 30 seconds
      minConfidenceThreshold: 0.6,
      maxLessonsPerTrace: 5,
      batchSize: 50,
      cacheTimeout: 300000, // 5 minutes
      maxMemoryEntries: 10000,
      ...config
    };
  }

  /**
   * Initialize the lessons learned system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  private async _performInitialization(): Promise<void> {
    try {
      console.log('Initializing Lessons Learned System...');
      
      // Initialize core lessons service
      this.lessonsService = createLessonsLearnedService(
        this.config.lessonsDb,
        this.memoryService
      );
      
      // Initialize pattern recognition engine
      if (this.config.enablePatternRecognition) {
        this.patternEngine = createPatternRecognitionEngine(this.memoryService);
      }
      
      // Initialize lessons integration
      this.lessonsIntegration = createLessonsIntegration(
        this.memoryService,
        this.config.integrationConfig
      );
      
      // Initialize recommendation engine
      if (this.config.enableRecommendations && this.lessonsService && this.lessonsIntegration) {
        this.recommendationEngine = createRecommendationEngine(
          this.lessonsService,
          this.lessonsIntegration,
          this.memoryService
        );
      }
      
      // Initialize API
      if (this.config.enableAPI && this.lessonsService && this.lessonsIntegration) {
        this.api = createLessonsAPI(
          this.lessonsService,
          this.lessonsIntegration,
          this.recommendationEngine!,
          this.patternEngine!,
          this.memoryService,
          this.config.apiConfig
        );
      }
      
      // Setup event forwarding
      this.setupEventForwarding();
      
      // Store system configuration
      await this.memoryService.store(
        'lessons_system_config',
        this.config,
        'system_configuration'
      );
      
      // Store initialization timestamp
      await this.memoryService.store(
        'lessons_system_initialized',
        {
          timestamp: Date.now(),
          version: '1.0.0',
          services: this.getEnabledServices()
        },
        'system_status'
      );
      
      this.isInitialized = true;
      
      this.emit('system_initialized', {
        timestamp: Date.now(),
        config: this.config
      });
      
      console.log('Lessons Learned System initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Lessons Learned System:', error);
      this.emit('error_occurred', {
        component: 'system_initialization',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Process a swarm trace for lesson extraction
   */
  async processTrace(traceData: any): Promise<any> {
    this.ensureInitialized();
    
    if (!this.lessonsIntegration || !this.config.enableAutoExtraction) {
      throw new Error('Trace processing is not enabled or integration not available');
    }
    
    try {
      const result = await this.lessonsIntegration.processSwarmTrace(traceData);
      
      this.emit('analysis_completed', {
        type: 'trace_analysis',
        duration: Date.now() - traceData.timestamp,
        results: result.lessonsExtracted
      });
      
      return result;
      
    } catch (error) {
      this.emit('error_occurred', {
        component: 'trace_processing',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Generate recommendations for a swarm context
   */
  async generateRecommendations(context: any): Promise<any> {
    this.ensureInitialized();
    
    if (!this.lessonsIntegration || !this.config.enableRecommendations) {
      throw new Error('Recommendations are not enabled or integration not available');
    }
    
    try {
      const result = await this.lessonsIntegration.generateRecommendationsForContext(context);
      
      this.emit('recommendation_generated', {
        count: result.recommendationCount,
        swarmId: context.swarmId,
        relevance: result.topRelevanceScore
      });
      
      return result;
      
    } catch (error) {
      this.emit('error_occurred', {
        component: 'recommendation_generation',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Record swarm behavior for pattern analysis
   */
  async recordBehavior(behaviorSnapshot: any): Promise<void> {
    this.ensureInitialized();
    
    if (!this.patternEngine || !this.config.enablePatternRecognition) {
      throw new Error('Pattern recognition is not enabled or engine not available');
    }
    
    try {
      await this.patternEngine.recordBehaviorSnapshot(behaviorSnapshot);
      
    } catch (error) {
      this.emit('error_occurred', {
        component: 'behavior_recording',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Get coordination patterns
   */
  getPatterns(criteria: any = {}): any[] {
    this.ensureInitialized();
    
    if (!this.patternEngine) {
      return [];
    }
    
    return this.patternEngine.getPatterns(criteria);
  }

  /**
   * Predict coordination success
   */
  async predictSuccess(strategy: any): Promise<any> {
    this.ensureInitialized();
    
    if (!this.patternEngine) {
      throw new Error('Pattern recognition engine not available');
    }
    
    return this.patternEngine.predictCoordinationSuccess(strategy);
  }

  /**
   * Apply a lesson to a swarm
   */
  async applyLesson(lessonId: string, applicationContext: any): Promise<string> {
    this.ensureInitialized();
    
    if (!this.lessonsIntegration) {
      throw new Error('Lessons integration not available');
    }
    
    try {
      const applicationId = await this.lessonsIntegration.applyLessonRecommendation(
        lessonId,
        applicationContext
      );
      
      this.emit('lesson_applied', {
        lessonId,
        applicationId,
        swarmId: applicationContext.swarmId
      });
      
      return applicationId;
      
    } catch (error) {
      this.emit('error_occurred', {
        component: 'lesson_application',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Record feedback on lesson application
   */
  async recordFeedback(applicationId: string, feedback: any): Promise<void> {
    this.ensureInitialized();
    
    if (!this.lessonsIntegration) {
      throw new Error('Lessons integration not available');
    }
    
    try {
      await this.lessonsIntegration.recordLessonFeedback(applicationId, feedback);
      
    } catch (error) {
      this.emit('error_occurred', {
        component: 'feedback_recording',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Get comprehensive system analytics
   */
  async getAnalytics(): Promise<any> {
    this.ensureInitialized();
    
    const analytics: any = {
      system: {
        uptime: Date.now() - (await this.getInitializationTime()),
        status: await this.getSystemStatus(),
        configuration: this.config
      }
    };
    
    if (this.lessonsService) {
      analytics.lessons = this.lessonsService.getLessonsAnalytics();
    }
    
    if (this.recommendationEngine) {
      analytics.recommendations = await this.recommendationEngine.getRecommendationAnalytics();
    }
    
    if (this.patternEngine) {
      analytics.patterns = this.patternEngine.getPatternAnalytics();
    }
    
    if (this.lessonsIntegration) {
      analytics.integration = this.lessonsIntegration.getIntegrationStatus();
    }
    
    return analytics;
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<LessonsSystemStatus> {
    const status: LessonsSystemStatus = {
      services: {
        lessonsService: this.lessonsService ? 'active' : 'inactive',
        integration: this.lessonsIntegration ? 'active' : 'inactive',
        recommendationEngine: this.recommendationEngine ? 'active' : 'inactive',
        patternEngine: this.patternEngine ? 'active' : 'inactive',
        api: this.api ? 'active' : 'inactive'
      },
      statistics: {
        totalLessons: 0,
        totalPatterns: 0,
        totalRecommendations: 0,
        activeAnalyses: 0
      },
      performance: {
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        averageResponseTime: 0,
        successRate: 0
      },
      lastUpdate: Date.now()
    };
    
    // Get statistics
    if (this.lessonsService) {
      const analytics = this.lessonsService.getLessonsAnalytics();
      status.statistics.totalLessons = analytics.summary?.totalLessons || 0;
    }
    
    if (this.patternEngine) {
      const patterns = this.patternEngine.getPatterns();
      status.statistics.totalPatterns = patterns.length;
    }
    
    if (this.recommendationEngine) {
      const analytics = await this.recommendationEngine.getRecommendationAnalytics();
      status.statistics.totalRecommendations = analytics.totalRecommendationsGenerated || 0;
    }
    
    return status;
  }

  /**
   * Get Express router for API endpoints
   */
  getAPIRouter(): Router | null {
    this.ensureInitialized();
    
    if (!this.api) {
      return null;
    }
    
    return this.api.getRouter();
  }

  /**
   * Search lessons with advanced criteria
   */
  async searchLessons(query: any): Promise<any[]> {
    this.ensureInitialized();
    
    if (!this.lessonsIntegration) {
      return [];
    }
    
    return this.lessonsIntegration.searchLessons(query);
  }

  /**
   * Export system data
   */
  async exportData(options: {
    includeLessons?: boolean;
    includePatterns?: boolean;
    includeRecommendations?: boolean;
    format?: 'json' | 'csv';
    dateRange?: { start: number; end: number };
  } = {}): Promise<any> {
    this.ensureInitialized();
    
    const exportData: any = {
      exportedAt: Date.now(),
      systemVersion: '1.0.0',
      config: this.config
    };
    
    if (options.includeLessons !== false && this.lessonsService) {
      exportData.lessons = this.lessonsService.exportLessons();
    }
    
    if (options.includePatterns !== false && this.patternEngine) {
      const patterns = this.patternEngine.getPatterns();
      exportData.patterns = {
        patterns,
        count: patterns.length,
        analytics: this.patternEngine.getPatternAnalytics()
      };
    }
    
    if (options.includeRecommendations !== false && this.recommendationEngine) {
      exportData.recommendations = await this.recommendationEngine.getRecommendationAnalytics();
    }
    
    return exportData;
  }

  /**
   * Update system configuration
   */
  async updateConfiguration(updates: Partial<LessonsSystemConfig>): Promise<void> {
    this.ensureInitialized();
    
    // Validate updates
    const validKeys = Object.keys(this.config);
    const invalidKeys = Object.keys(updates).filter(key => !validKeys.includes(key));
    
    if (invalidKeys.length > 0) {
      throw new Error(`Invalid configuration keys: ${invalidKeys.join(', ')}`);
    }
    
    // Apply updates
    Object.assign(this.config, updates);
    
    // Store updated configuration
    await this.memoryService.store(
      'lessons_system_config',
      this.config,
      'system_configuration'
    );
    
    console.log('Lessons system configuration updated');
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Lessons Learned System...');
    
    try {
      // Close all services
      if (this.lessonsService) {
        this.lessonsService.close();
      }
      
      if (this.lessonsIntegration) {
        this.lessonsIntegration.close();
      }
      
      if (this.recommendationEngine) {
        this.recommendationEngine.close();
      }
      
      if (this.patternEngine) {
        this.patternEngine.close();
      }
      
      // Store shutdown timestamp
      await this.memoryService.store(
        'lessons_system_shutdown',
        {
          timestamp: Date.now(),
          graceful: true
        },
        'system_status'
      );
      
      this.isInitialized = false;
      this.initializationPromise = null;
      
      console.log('Lessons Learned System shutdown complete');
      
    } catch (error) {
      console.error('Error during system shutdown:', error);
      throw error;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Lessons system not initialized. Call initialize() first.');
    }
  }

  private setupEventForwarding(): void {
    // Forward events from services
    if (this.lessonsService) {
      this.lessonsService.on('lesson_created', (data) => {
        this.emit('lesson_created', data);
      });
      
      this.lessonsService.on('lesson_applied', (data) => {
        this.emit('lesson_applied', data);
      });
    }
    
    if (this.patternEngine) {
      this.patternEngine.on('analysis_completed', (data) => {
        this.emit('pattern_discovered', {
          patternId: 'unknown', // Would be extracted from data
          type: 'coordination',
          confidence: 0.8
        });
      });
    }
    
    if (this.lessonsIntegration) {
      this.lessonsIntegration.on('recommendations_generated', (data) => {
        this.emit('recommendation_generated', data);
      });
      
      this.lessonsIntegration.on('lessons_extracted', (data) => {
        this.emit('analysis_completed', {
          type: 'lesson_extraction',
          duration: 0,
          results: data.lessons
        });
      });
    }
  }

  private getEnabledServices(): string[] {
    const services: string[] = ['lessonsService'];
    
    if (this.config.enablePatternRecognition) services.push('patternEngine');
    if (this.config.enableRecommendations) services.push('recommendationEngine');
    if (this.config.enableAPI) services.push('api');
    
    return services;
  }

  private async getInitializationTime(): Promise<number> {
    const initData = await this.memoryService.retrieve(
      'lessons_system_initialized',
      'system_status'
    );
    
    return initData?.timestamp || Date.now();
  }
}

// ===== FACTORY FUNCTIONS AND EXPORTS =====

/**
 * Create and initialize a complete lessons learned system
 */
export async function createLessonsSystem(
  memoryService: MemoryService,
  config: LessonsSystemConfig = {}
): Promise<LessonsSystem> {
  const system = new LessonsSystem(memoryService, config);
  await system.initialize();
  return system;
}

/**
 * Create a minimal lessons system (lessons service only)
 */
export function createMinimalLessonsSystem(
  memoryService: MemoryService,
  config: Partial<LessonsSystemConfig> = {}
): LessonsSystem {
  const minimalConfig = {
    ...config,
    enablePatternRecognition: false,
    enableRecommendations: false,
    enableAPI: false
  };
  
  return new LessonsSystem(memoryService, minimalConfig);
}

// Export individual services for advanced usage
export {
  LessonsLearnedService,
  LessonsIntegration,
  LessonsRecommendationEngine,
  PatternRecognitionEngine,
  LessonsAPI,
  createLessonsLearnedService,
  createLessonsIntegration,
  createRecommendationEngine,
  createPatternRecognitionEngine,
  createLessonsAPI
};

// Export types
export type {
  LessonsSystemConfig,
  LessonsSystemStatus,
  LessonsSystemEvents,
  LessonsConfig,
  LessonsAPIConfig
};

// Default export
export default LessonsSystem;