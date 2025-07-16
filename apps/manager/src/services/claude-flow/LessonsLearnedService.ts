/**
 * Lessons Learned Service for Claude Flow
 * Comprehensive system for capturing, analyzing, and applying swarm coordination insights
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface LessonMetadata {
  id: string;
  category: 'coordination' | 'optimization' | 'error_pattern' | 'success_pattern' | 'resource_management' | 'task_strategy';
  subcategory: string;
  confidence: number; // 0-1 score
  impact: 'low' | 'medium' | 'high' | 'critical';
  source: 'trace_analysis' | 'pattern_recognition' | 'manual_entry' | 'feedback_loop';
  timestamp: number;
  tags: string[];
}

export interface LessonContext {
  swarmId?: string;
  taskType?: string;
  agentRoles?: string[];
  topology?: string;
  resourceConstraints?: Record<string, any>;
  environmentInfo?: Record<string, any>;
}

export interface LessonEvidence {
  traceIds: string[];
  metrics: Record<string, number>;
  patterns: string[];
  errorLogs?: string[];
  successFactors?: string[];
}

export interface ApplicabilityRule {
  conditions: Record<string, any>;
  weightFactor: number;
  priority: 'always' | 'recommended' | 'optional' | 'avoid';
}

export interface LessonLearned {
  id: string;
  title: string;
  description: string;
  insight: string;
  recommendation: string;
  preventionStrategy?: string;
  
  metadata: LessonMetadata;
  context: LessonContext;
  evidence: LessonEvidence;
  applicability: ApplicabilityRule[];
  
  effectiveness?: {
    appliedCount: number;
    successRate: number;
    avgImprovement: number;
    lastApplied?: number;
  };
  
  relatedLessons?: string[];
  supersededBy?: string;
  supersedes?: string[];
}

export interface LessonRecommendation {
  lessonId: string;
  relevanceScore: number;
  applicabilityReason: string;
  expectedImpact: string;
  implementationStrategy: string;
}

export interface LearningPattern {
  patternType: string;
  frequency: number;
  conditions: Record<string, any>;
  outcomes: Record<string, any>;
  confidence: number;
}

export class LessonsLearnedService extends EventEmitter {
  private db: Database.Database;
  private memoryStore: any;
  private patterns: Map<string, LearningPattern> = new Map();
  private recommendations: Map<string, LessonRecommendation[]> = new Map();
  
  constructor(dbPath: string = '.swarm/lessons.db', memoryStore?: any) {
    super();
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.memoryStore = memoryStore;
    this.initializeSchema();
    this.startPeriodicAnalysis();
  }

  private initializeSchema(): void {
    // Main lessons learned table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lessons_learned (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        insight TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        prevention_strategy TEXT,
        
        -- Metadata
        category TEXT NOT NULL,
        subcategory TEXT,
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        impact TEXT NOT NULL CHECK(impact IN ('low', 'medium', 'high', 'critical')),
        source TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        tags TEXT, -- JSON array
        
        -- Context
        context TEXT, -- JSON object
        evidence TEXT, -- JSON object
        applicability_rules TEXT, -- JSON array
        
        -- Effectiveness tracking
        applied_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0,
        avg_improvement REAL DEFAULT 0,
        last_applied INTEGER,
        
        -- Relationships
        related_lessons TEXT, -- JSON array
        superseded_by TEXT,
        supersedes TEXT, -- JSON array
        
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Pattern recognition table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,
        pattern_signature TEXT NOT NULL, -- Hash of conditions
        frequency INTEGER DEFAULT 1,
        conditions TEXT NOT NULL, -- JSON object
        outcomes TEXT NOT NULL, -- JSON object
        confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
        first_seen INTEGER DEFAULT (strftime('%s', 'now')),
        last_seen INTEGER DEFAULT (strftime('%s', 'now')),
        
        UNIQUE(pattern_type, pattern_signature)
      )
    `);

    // Lesson applications log
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lesson_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        swarm_id TEXT,
        task_id TEXT,
        application_context TEXT, -- JSON object
        implementation_details TEXT, -- JSON object
        outcome TEXT NOT NULL CHECK(outcome IN ('success', 'partial', 'failure')),
        improvement_metrics TEXT, -- JSON object
        feedback TEXT,
        applied_at INTEGER DEFAULT (strftime('%s', 'now')),
        
        FOREIGN KEY(lesson_id) REFERENCES lessons_learned(id)
      )
    `);

    // Trace analysis cache
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trace_analysis_cache (
        trace_id TEXT PRIMARY KEY,
        swarm_id TEXT,
        analysis_results TEXT NOT NULL, -- JSON object
        patterns_found TEXT, -- JSON array
        lessons_triggered TEXT, -- JSON array of lesson IDs
        analyzed_at INTEGER DEFAULT (strftime('%s', 'now')),
        
        -- Performance data
        duration_ms INTEGER,
        memory_usage_mb REAL,
        token_usage INTEGER,
        success_rate REAL
      )
    `);

    // Knowledge graph for lesson relationships
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lesson_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_lesson_id TEXT NOT NULL,
        target_lesson_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL CHECK(relationship_type IN (
          'similar', 'opposite', 'prerequisite', 'enhancement', 'conflict', 'derived_from'
        )),
        strength REAL NOT NULL CHECK(strength >= 0 AND strength <= 1),
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        
        FOREIGN KEY(source_lesson_id) REFERENCES lessons_learned(id),
        FOREIGN KEY(target_lesson_id) REFERENCES lessons_learned(id),
        UNIQUE(source_lesson_id, target_lesson_id, relationship_type)
      )
    `);

    // Recommendation cache
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recommendation_cache (
        id TEXT PRIMARY KEY, -- Hash of context
        context_hash TEXT NOT NULL,
        context_data TEXT NOT NULL, -- JSON object
        recommendations TEXT NOT NULL, -- JSON array
        generated_at INTEGER DEFAULT (strftime('%s', 'now')),
        validity_period INTEGER DEFAULT 3600, -- 1 hour default
        
        UNIQUE(context_hash)
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons_learned(category, subcategory);
      CREATE INDEX IF NOT EXISTS idx_lessons_impact ON lessons_learned(impact);
      CREATE INDEX IF NOT EXISTS idx_lessons_timestamp ON lessons_learned(timestamp);
      CREATE INDEX IF NOT EXISTS idx_lessons_confidence ON lessons_learned(confidence);
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON learning_patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_patterns_frequency ON learning_patterns(frequency);
      CREATE INDEX IF NOT EXISTS idx_applications_lesson ON lesson_applications(lesson_id);
      CREATE INDEX IF NOT EXISTS idx_applications_outcome ON lesson_applications(outcome);
      CREATE INDEX IF NOT EXISTS idx_trace_analysis_swarm ON trace_analysis_cache(swarm_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON lesson_relationships(source_lesson_id);
      CREATE INDEX IF NOT EXISTS idx_recommendations_context ON recommendation_cache(context_hash);
    `);

    console.log('Lessons learned database schema initialized');
  }

  /**
   * Extract lessons from trace data automatically
   */
  async extractLessonsFromTrace(traceData: any): Promise<LessonLearned[]> {
    const lessons: LessonLearned[] = [];
    const traceId = traceData.id || traceData.traceId;
    
    // Check if already analyzed
    const existing = this.db.prepare(`
      SELECT * FROM trace_analysis_cache WHERE trace_id = ?
    `).get(traceId);
    
    if (existing && (Date.now() - existing.analyzed_at * 1000) < 3600000) {
      // Return cached lessons if analysis is less than 1 hour old
      const cachedLessons = JSON.parse(existing.lessons_triggered);
      return this.getLessonsByIds(cachedLessons);
    }

    const analysis = await this.analyzeTracePatterns(traceData);
    
    // Pattern 1: High coordination overhead
    if (analysis.coordinationOverhead > 0.3) {
      const lesson = await this.createLessonFromPattern(
        'high_coordination_overhead',
        {
          title: 'High Coordination Overhead Detected',
          description: `Swarm ${traceData.swarmId} showed excessive coordination overhead (${(analysis.coordinationOverhead * 100).toFixed(1)}%)`,
          insight: 'Frequent inter-agent communication without productive work indicates inefficient task distribution or unclear agent responsibilities',
          recommendation: 'Consider simplifying agent roles, reducing communication frequency, or switching to hierarchical topology',
          category: 'optimization',
          subcategory: 'coordination_efficiency',
          impact: analysis.coordinationOverhead > 0.5 ? 'high' : 'medium',
          confidence: Math.min(analysis.coordinationOverhead * 2, 1)
        },
        traceData,
        analysis
      );
      
      if (lesson) lessons.push(lesson);
    }

    // Pattern 2: Memory usage patterns
    if (analysis.memoryGrowthRate > 0.1) {
      const lesson = await this.createLessonFromPattern(
        'memory_growth_issue',
        {
          title: 'Memory Growth Issue Detected',
          description: `Swarm showed rapid memory growth: ${(analysis.memoryGrowthRate * 100).toFixed(1)}% per minute`,
          insight: 'Rapid memory growth indicates potential memory leaks or inefficient data handling in agent operations',
          recommendation: 'Implement memory cleanup hooks, reduce data caching, or optimize agent lifecycle management',
          category: 'resource_management',
          subcategory: 'memory_optimization',
          impact: analysis.memoryGrowthRate > 0.2 ? 'critical' : 'high',
          confidence: Math.min(analysis.memoryGrowthRate * 5, 1)
        },
        traceData,
        analysis
      );
      
      if (lesson) lessons.push(lesson);
    }

    // Pattern 3: Error clustering
    if (analysis.errorClusters && analysis.errorClusters.length > 0) {
      for (const cluster of analysis.errorClusters) {
        const lesson = await this.createLessonFromPattern(
          `error_cluster_${cluster.type}`,
          {
            title: `Recurring Error Pattern: ${cluster.type}`,
            description: `${cluster.count} similar errors occurred in ${cluster.timespan}ms: ${cluster.message}`,
            insight: `Error clustering suggests systematic issue rather than random failures`,
            recommendation: cluster.recommendation || 'Investigate root cause and implement preventive measures',
            preventionStrategy: cluster.prevention || 'Add validation, improve error handling, or modify approach',
            category: 'error_pattern',
            subcategory: cluster.type,
            impact: cluster.count > 5 ? 'critical' : 'high',
            confidence: Math.min(cluster.count / 10, 1)
          },
          traceData,
          analysis
        );
        
        if (lesson) lessons.push(lesson);
      }
    }

    // Pattern 4: Success optimization opportunities
    if (analysis.successPatterns && analysis.successPatterns.length > 0) {
      for (const pattern of analysis.successPatterns) {
        const lesson = await this.createLessonFromPattern(
          `success_pattern_${pattern.type}`,
          {
            title: `Optimization Opportunity: ${pattern.type}`,
            description: `Successful pattern identified with ${(pattern.efficiency * 100).toFixed(1)}% efficiency`,
            insight: pattern.insight,
            recommendation: `Replicate this pattern: ${pattern.recommendation}`,
            category: 'success_pattern',
            subcategory: pattern.type,
            impact: pattern.efficiency > 0.8 ? 'high' : 'medium',
            confidence: pattern.confidence
          },
          traceData,
          analysis
        );
        
        if (lesson) lessons.push(lesson);
      }
    }

    // Cache the analysis results
    this.db.prepare(`
      INSERT OR REPLACE INTO trace_analysis_cache 
      (trace_id, swarm_id, analysis_results, patterns_found, lessons_triggered, duration_ms, memory_usage_mb, token_usage, success_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      traceId,
      traceData.swarmId,
      JSON.stringify(analysis),
      JSON.stringify(analysis.patterns || []),
      JSON.stringify(lessons.map(l => l.id)),
      traceData.duration || null,
      analysis.peakMemoryMB || null,
      analysis.totalTokens || null,
      analysis.successRate || null
    );

    this.emit('lessons_extracted', { traceId, lessons: lessons.length, swarmId: traceData.swarmId });
    
    return lessons;
  }

  /**
   * Analyze trace data for patterns and insights
   */
  private async analyzeTracePatterns(traceData: any): Promise<any> {
    const analysis: any = {
      patterns: [],
      coordinationOverhead: 0,
      memoryGrowthRate: 0,
      errorClusters: [],
      successPatterns: [],
      totalTokens: 0,
      successRate: 1,
      peakMemoryMB: 0
    };

    // Analyze coordination overhead
    if (traceData.spans) {
      const coordSpans = traceData.spans.filter((s: any) => 
        s.name.includes('coordination') || s.name.includes('communication')
      );
      const totalTime = traceData.spans.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
      const coordTime = coordSpans.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
      
      analysis.coordinationOverhead = totalTime > 0 ? coordTime / totalTime : 0;
    }

    // Analyze memory patterns
    if (traceData.metadata && traceData.metadata.memoryUsage) {
      const memUsage = traceData.metadata.memoryUsage;
      if (Array.isArray(memUsage) && memUsage.length > 1) {
        const duration = (memUsage[memUsage.length - 1].timestamp - memUsage[0].timestamp) / 60000; // minutes
        const growth = memUsage[memUsage.length - 1].heapUsed - memUsage[0].heapUsed;
        analysis.memoryGrowthRate = duration > 0 ? (growth / memUsage[0].heapUsed) / duration : 0;
        analysis.peakMemoryMB = Math.max(...memUsage.map((m: any) => m.heapUsed)) / 1024 / 1024;
      }
    }

    // Analyze error patterns
    if (traceData.errors && Array.isArray(traceData.errors)) {
      const errorsByType = new Map();
      
      for (const error of traceData.errors) {
        const key = error.type || error.name || 'unknown';
        if (!errorsByType.has(key)) {
          errorsByType.set(key, []);
        }
        errorsByType.get(key).push(error);
      }

      for (const [type, errors] of errorsByType.entries()) {
        if (errors.length >= 2) {
          const timespan = Math.max(...errors.map((e: any) => e.timestamp)) - 
                          Math.min(...errors.map((e: any) => e.timestamp));
          
          analysis.errorClusters.push({
            type,
            count: errors.length,
            message: errors[0].message,
            timespan,
            recommendation: this.generateErrorRecommendation(type, errors),
            prevention: this.generatePreventionStrategy(type, errors)
          });
        }
      }
    }

    // Analyze success patterns
    if (traceData.tasks && Array.isArray(traceData.tasks)) {
      const successfulTasks = traceData.tasks.filter((t: any) => t.status === 'completed');
      analysis.successRate = traceData.tasks.length > 0 ? successfulTasks.length / traceData.tasks.length : 1;

      if (successfulTasks.length > 0) {
        const avgDuration = successfulTasks.reduce((sum: number, t: any) => sum + (t.duration || 0), 0) / successfulTasks.length;
        const fastTasks = successfulTasks.filter((t: any) => (t.duration || Infinity) < avgDuration * 0.8);
        
        if (fastTasks.length > 0) {
          analysis.successPatterns.push({
            type: 'fast_completion',
            efficiency: 0.9,
            insight: 'Some tasks completed significantly faster than average',
            recommendation: 'Analyze fast task patterns and apply to slower tasks',
            confidence: Math.min(fastTasks.length / successfulTasks.length * 2, 1)
          });
        }
      }
    }

    // Count tokens if available
    if (traceData.tokenUsage) {
      analysis.totalTokens = traceData.tokenUsage.total || 
                           (traceData.tokenUsage.input || 0) + (traceData.tokenUsage.output || 0);
    }

    return analysis;
  }

  /**
   * Create a lesson from a detected pattern
   */
  private async createLessonFromPattern(
    patternId: string,
    lessonData: Partial<LessonLearned>,
    traceData: any,
    analysis: any
  ): Promise<LessonLearned | null> {
    // Check if similar lesson already exists
    const existing = this.db.prepare(`
      SELECT id FROM lessons_learned 
      WHERE category = ? AND subcategory = ? AND confidence > 0.5
      ORDER BY confidence DESC, timestamp DESC
      LIMIT 1
    `).get(lessonData.category, lessonData.subcategory);

    if (existing) {
      // Update existing lesson with new evidence
      await this.enhanceLessonWithEvidence(existing.id, traceData, analysis);
      return null;
    }

    const lesson: LessonLearned = {
      id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: lessonData.title!,
      description: lessonData.description!,
      insight: lessonData.insight!,
      recommendation: lessonData.recommendation!,
      preventionStrategy: lessonData.preventionStrategy,
      
      metadata: {
        id: `meta_${Date.now()}`,
        category: lessonData.category as any,
        subcategory: lessonData.subcategory || 'general',
        confidence: lessonData.confidence || 0.7,
        impact: lessonData.impact as any,
        source: 'trace_analysis',
        timestamp: Date.now(),
        tags: this.generateLessonTags(lessonData, traceData)
      },
      
      context: {
        swarmId: traceData.swarmId,
        taskType: traceData.taskType,
        agentRoles: traceData.agentRoles,
        topology: traceData.topology,
        resourceConstraints: analysis.resourceConstraints,
        environmentInfo: traceData.metadata?.environment
      },
      
      evidence: {
        traceIds: [traceData.id || traceData.traceId],
        metrics: this.extractRelevantMetrics(analysis),
        patterns: analysis.patterns || [],
        errorLogs: analysis.errorClusters?.map((e: any) => e.message) || [],
        successFactors: analysis.successPatterns?.map((p: any) => p.insight) || []
      },
      
      applicability: this.generateApplicabilityRules(lessonData, traceData),
      
      effectiveness: {
        appliedCount: 0,
        successRate: 0,
        avgImprovement: 0
      },
      
      relatedLessons: [],
      supersededBy: undefined,
      supersedes: []
    };

    // Store the lesson
    this.storeLessonInDatabase(lesson);
    
    // Find and create relationships with existing lessons
    await this.findAndCreateRelationships(lesson.id);
    
    this.emit('lesson_created', { lessonId: lesson.id, category: lesson.metadata.category });
    
    return lesson;
  }

  /**
   * Generate recommendations based on current context
   */
  async generateRecommendations(context: {
    swarmId?: string;
    taskType?: string;
    agentRoles?: string[];
    topology?: string;
    currentIssues?: string[];
    targetMetrics?: Record<string, number>;
  }): Promise<LessonRecommendation[]> {
    
    const contextHash = this.hashContext(context);
    
    // Check cache first
    const cached = this.db.prepare(`
      SELECT recommendations FROM recommendation_cache 
      WHERE context_hash = ? AND (strftime('%s', 'now') - generated_at) < validity_period
    `).get(contextHash);
    
    if (cached) {
      return JSON.parse(cached.recommendations);
    }

    const recommendations: LessonRecommendation[] = [];
    
    // Query relevant lessons
    const lessons = this.queryRelevantLessons(context);
    
    for (const lesson of lessons) {
      const relevanceScore = this.calculateRelevanceScore(lesson, context);
      
      if (relevanceScore > 0.3) { // Threshold for relevance
        const recommendation: LessonRecommendation = {
          lessonId: lesson.id,
          relevanceScore,
          applicabilityReason: this.explainApplicability(lesson, context),
          expectedImpact: this.estimateImpact(lesson, context),
          implementationStrategy: this.generateImplementationStrategy(lesson, context)
        };
        
        recommendations.push(recommendation);
      }
    }
    
    // Sort by relevance score
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Cache the results
    this.db.prepare(`
      INSERT OR REPLACE INTO recommendation_cache 
      (id, context_hash, context_data, recommendations)
      VALUES (?, ?, ?, ?)
    `).run(
      `rec_${Date.now()}`,
      contextHash,
      JSON.stringify(context),
      JSON.stringify(recommendations)
    );

    this.emit('recommendations_generated', { 
      contextHash, 
      count: recommendations.length,
      topScore: recommendations[0]?.relevanceScore || 0 
    });
    
    return recommendations.slice(0, 10); // Return top 10
  }

  /**
   * Apply a lesson and track its effectiveness
   */
  async applyLesson(
    lessonId: string,
    applicationContext: {
      swarmId: string;
      taskId?: string;
      implementationDetails: Record<string, any>;
    }
  ): Promise<string> {
    const lesson = this.getLessonById(lessonId);
    if (!lesson) {
      throw new Error(`Lesson not found: ${lessonId}`);
    }

    // Record the application
    const applicationId = this.db.prepare(`
      INSERT INTO lesson_applications 
      (lesson_id, swarm_id, task_id, application_context, implementation_details, outcome)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(
      lessonId,
      applicationContext.swarmId,
      applicationContext.taskId || null,
      JSON.stringify(applicationContext),
      JSON.stringify(applicationContext.implementationDetails)
    ).lastInsertRowid as number;

    // Update lesson application count
    this.db.prepare(`
      UPDATE lessons_learned 
      SET applied_count = applied_count + 1, last_applied = strftime('%s', 'now')
      WHERE id = ?
    `).run(lessonId);

    // Store application context in memory for quick access
    if (this.memoryStore) {
      await this.memoryStore.store(
        `lesson_application_${applicationId}`,
        {
          lessonId,
          applicationContext,
          appliedAt: Date.now(),
          status: 'pending'
        },
        'lesson_applications'
      );
    }

    this.emit('lesson_applied', { lessonId, applicationId, swarmId: applicationContext.swarmId });
    
    return applicationId.toString();
  }

  /**
   * Record feedback on lesson application
   */
  async recordApplicationFeedback(
    applicationId: string,
    outcome: 'success' | 'partial' | 'failure',
    improvementMetrics: Record<string, number>,
    feedback?: string
  ): Promise<void> {
    
    // Update application record
    this.db.prepare(`
      UPDATE lesson_applications 
      SET outcome = ?, improvement_metrics = ?, feedback = ?
      WHERE id = ?
    `).run(
      outcome,
      JSON.stringify(improvementMetrics),
      feedback || null,
      applicationId
    );

    // Get lesson ID to update effectiveness
    const application = this.db.prepare(`
      SELECT lesson_id FROM lesson_applications WHERE id = ?
    `).get(applicationId);

    if (application) {
      await this.updateLessonEffectiveness(application.lesson_id);
    }

    // Update memory store
    if (this.memoryStore) {
      await this.memoryStore.store(
        `lesson_feedback_${applicationId}`,
        {
          outcome,
          improvementMetrics,
          feedback,
          recordedAt: Date.now()
        },
        'lesson_feedback'
      );
    }

    this.emit('application_feedback', { applicationId, outcome, improvement: Object.keys(improvementMetrics).length });
  }

  /**
   * Get lessons by category with filtering
   */
  getLessonsByCategory(
    category: string,
    filters: {
      minConfidence?: number;
      impact?: string[];
      subcategory?: string;
      tags?: string[];
      limit?: number;
    } = {}
  ): LessonLearned[] {
    
    let query = 'SELECT * FROM lessons_learned WHERE category = ?';
    const params: any[] = [category];

    if (filters.minConfidence) {
      query += ' AND confidence >= ?';
      params.push(filters.minConfidence);
    }

    if (filters.impact && filters.impact.length > 0) {
      query += ` AND impact IN (${filters.impact.map(() => '?').join(',')})`;
      params.push(...filters.impact);
    }

    if (filters.subcategory) {
      query += ' AND subcategory = ?';
      params.push(filters.subcategory);
    }

    query += ' ORDER BY confidence DESC, timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(query).all(...params);
    return rows.map(row => this.rowToLesson(row));
  }

  /**
   * Get analytics on lessons learned
   */
  getLessonsAnalytics(): any {
    const totalLessons = this.db.prepare('SELECT COUNT(*) as count FROM lessons_learned').get().count;
    
    const byCategory = this.db.prepare(`
      SELECT category, COUNT(*) as count, AVG(confidence) as avg_confidence
      FROM lessons_learned GROUP BY category ORDER BY count DESC
    `).all();

    const byImpact = this.db.prepare(`
      SELECT impact, COUNT(*) as count FROM lessons_learned GROUP BY impact
    `).all();

    const applicationStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN outcome = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN outcome = 'partial' THEN 1 END) as partial,
        COUNT(CASE WHEN outcome = 'failure' THEN 1 END) as failed
      FROM lesson_applications
    `).get();

    const topLessons = this.db.prepare(`
      SELECT l.id, l.title, l.category, l.applied_count, l.success_rate
      FROM lessons_learned l
      WHERE l.applied_count > 0
      ORDER BY l.success_rate DESC, l.applied_count DESC
      LIMIT 10
    `).all();

    const recentPatterns = this.db.prepare(`
      SELECT pattern_type, frequency, confidence, last_seen
      FROM learning_patterns
      ORDER BY last_seen DESC
      LIMIT 20
    `).all();

    return {
      summary: {
        totalLessons,
        avgConfidence: byCategory.reduce((sum, cat) => sum + cat.avg_confidence, 0) / byCategory.length || 0,
        applicationSuccessRate: applicationStats.total_applications > 0 ? 
          applicationStats.successful / applicationStats.total_applications : 0
      },
      distribution: {
        byCategory,
        byImpact
      },
      applications: applicationStats,
      topPerformingLessons: topLessons,
      recentPatterns,
      generatedAt: new Date().toISOString()
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private storeLessonInDatabase(lesson: LessonLearned): void {
    this.db.prepare(`
      INSERT INTO lessons_learned (
        id, title, description, insight, recommendation, prevention_strategy,
        category, subcategory, confidence, impact, source, timestamp, tags,
        context, evidence, applicability_rules, related_lessons, superseded_by, supersedes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lesson.id,
      lesson.title,
      lesson.description,
      lesson.insight,
      lesson.recommendation,
      lesson.preventionStrategy || null,
      lesson.metadata.category,
      lesson.metadata.subcategory,
      lesson.metadata.confidence,
      lesson.metadata.impact,
      lesson.metadata.source,
      lesson.metadata.timestamp,
      JSON.stringify(lesson.metadata.tags),
      JSON.stringify(lesson.context),
      JSON.stringify(lesson.evidence),
      JSON.stringify(lesson.applicability),
      JSON.stringify(lesson.relatedLessons || []),
      lesson.supersededBy || null,
      JSON.stringify(lesson.supersedes || [])
    );
  }

  private async enhanceLessonWithEvidence(
    lessonId: string,
    traceData: any,
    analysis: any
  ): Promise<void> {
    const lesson = this.getLessonById(lessonId);
    if (!lesson) return;

    // Add new trace to evidence
    lesson.evidence.traceIds.push(traceData.id || traceData.traceId);
    
    // Merge metrics
    const newMetrics = this.extractRelevantMetrics(analysis);
    Object.assign(lesson.evidence.metrics, newMetrics);

    // Update confidence based on recurring pattern
    const newConfidence = Math.min(lesson.metadata.confidence + 0.1, 1.0);

    // Update in database
    this.db.prepare(`
      UPDATE lessons_learned 
      SET evidence = ?, confidence = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `).run(
      JSON.stringify(lesson.evidence),
      newConfidence,
      lessonId
    );
  }

  private generateLessonTags(lessonData: any, traceData: any): string[] {
    const tags: string[] = [];
    
    if (traceData.topology) tags.push(`topology:${traceData.topology}`);
    if (traceData.agentRoles) traceData.agentRoles.forEach((role: string) => tags.push(`role:${role}`));
    if (lessonData.category) tags.push(`category:${lessonData.category}`);
    if (lessonData.impact) tags.push(`impact:${lessonData.impact}`);
    
    return tags;
  }

  private generateApplicabilityRules(lessonData: any, traceData: any): ApplicabilityRule[] {
    const rules: ApplicabilityRule[] = [];

    // Always applicable if same category and high confidence
    if (lessonData.confidence > 0.8) {
      rules.push({
        conditions: { category: lessonData.category },
        weightFactor: 1.0,
        priority: 'recommended'
      });
    }

    // Topology-specific rules
    if (traceData.topology) {
      rules.push({
        conditions: { topology: traceData.topology },
        weightFactor: 0.8,
        priority: 'recommended'
      });
    }

    // Impact-based rules
    if (lessonData.impact === 'critical') {
      rules.push({
        conditions: {},
        weightFactor: 1.0,
        priority: 'always'
      });
    }

    return rules;
  }

  private extractRelevantMetrics(analysis: any): Record<string, number> {
    const metrics: Record<string, number> = {};
    
    if (analysis.coordinationOverhead !== undefined) {
      metrics.coordinationOverhead = analysis.coordinationOverhead;
    }
    
    if (analysis.memoryGrowthRate !== undefined) {
      metrics.memoryGrowthRate = analysis.memoryGrowthRate;
    }
    
    if (analysis.successRate !== undefined) {
      metrics.successRate = analysis.successRate;
    }
    
    if (analysis.totalTokens !== undefined) {
      metrics.totalTokens = analysis.totalTokens;
    }

    return metrics;
  }

  private generateErrorRecommendation(errorType: string, errors: any[]): string {
    const commonPatterns: Record<string, string> = {
      'connection': 'Implement retry logic with exponential backoff',
      'timeout': 'Increase timeout values or optimize operation performance',
      'memory': 'Add memory monitoring and cleanup procedures',
      'validation': 'Strengthen input validation and error handling',
      'permission': 'Review and update access permissions and authentication'
    };

    return commonPatterns[errorType.toLowerCase()] || 'Investigate root cause and implement appropriate error handling';
  }

  private generatePreventionStrategy(errorType: string, errors: any[]): string {
    const preventionStrategies: Record<string, string> = {
      'connection': 'Add health checks and circuit breaker patterns',
      'timeout': 'Implement async operations and progress monitoring',
      'memory': 'Add memory limits and garbage collection triggers',
      'validation': 'Implement schema validation and sanitization',
      'permission': 'Add role-based access control and audit logging'
    };

    return preventionStrategies[errorType.toLowerCase()] || 'Add comprehensive monitoring and alerting';
  }

  private queryRelevantLessons(context: any): LessonLearned[] {
    let query = 'SELECT * FROM lessons_learned WHERE 1=1';
    const params: any[] = [];

    // Filter by context attributes
    if (context.taskType) {
      query += ' AND json_extract(context, "$.taskType") = ?';
      params.push(context.taskType);
    }

    if (context.topology) {
      query += ' AND json_extract(context, "$.topology") = ?';
      params.push(context.topology);
    }

    query += ' ORDER BY confidence DESC, applied_count DESC LIMIT 50';

    const rows = this.db.prepare(query).all(...params);
    return rows.map(row => this.rowToLesson(row));
  }

  private calculateRelevanceScore(lesson: LessonLearned, context: any): number {
    let score = lesson.metadata.confidence * 0.4; // Base confidence score

    // Context matching
    if (lesson.context.taskType === context.taskType) score += 0.2;
    if (lesson.context.topology === context.topology) score += 0.15;
    
    // Agent role overlap
    if (lesson.context.agentRoles && context.agentRoles) {
      const overlap = lesson.context.agentRoles.filter(role => 
        context.agentRoles.includes(role)
      ).length;
      score += (overlap / Math.max(lesson.context.agentRoles.length, context.agentRoles.length)) * 0.15;
    }

    // Issue relevance
    if (context.currentIssues && lesson.metadata.tags) {
      const issueMatch = context.currentIssues.some((issue: string) =>
        lesson.metadata.tags.some(tag => tag.includes(issue.toLowerCase()))
      );
      if (issueMatch) score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private explainApplicability(lesson: LessonLearned, context: any): string {
    const reasons: string[] = [];

    if (lesson.context.taskType === context.taskType) {
      reasons.push(`Same task type: ${context.taskType}`);
    }

    if (lesson.context.topology === context.topology) {
      reasons.push(`Same topology: ${context.topology}`);
    }

    if (lesson.metadata.impact === 'critical') {
      reasons.push('Critical impact lesson - broadly applicable');
    }

    return reasons.join('; ') || 'General applicability based on pattern matching';
  }

  private estimateImpact(lesson: LessonLearned, context: any): string {
    if (lesson.effectiveness && lesson.effectiveness.appliedCount > 0) {
      const avgImprovement = lesson.effectiveness.avgImprovement;
      if (avgImprovement > 0.2) return 'High positive impact expected';
      if (avgImprovement > 0.1) return 'Moderate positive impact expected';
      return 'Low positive impact expected';
    }

    // Estimate based on lesson metadata
    switch (lesson.metadata.impact) {
      case 'critical': return 'Critical impact - immediate attention required';
      case 'high': return 'High impact - significant improvement expected';
      case 'medium': return 'Medium impact - moderate improvement expected';
      case 'low': return 'Low impact - minor improvement expected';
      default: return 'Impact assessment pending';
    }
  }

  private generateImplementationStrategy(lesson: LessonLearned, context: any): string {
    const strategies: Record<string, string> = {
      'coordination': 'Adjust agent communication patterns and topology',
      'optimization': 'Apply performance tuning and resource management',
      'error_pattern': 'Implement error prevention and handling measures',
      'success_pattern': 'Replicate successful patterns and approaches',
      'resource_management': 'Optimize resource allocation and monitoring'
    };

    return strategies[lesson.metadata.category] || 'Follow lesson recommendation with careful monitoring';
  }

  private hashContext(context: any): string {
    return require('crypto')
      .createHash('md5')
      .update(JSON.stringify(context))
      .digest('hex');
  }

  private getLessonById(id: string): LessonLearned | null {
    const row = this.db.prepare('SELECT * FROM lessons_learned WHERE id = ?').get(id);
    return row ? this.rowToLesson(row) : null;
  }

  private getLessonsByIds(ids: string[]): LessonLearned[] {
    if (ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT * FROM lessons_learned WHERE id IN (${placeholders})
    `).all(...ids);
    
    return rows.map(row => this.rowToLesson(row));
  }

  private rowToLesson(row: any): LessonLearned {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      insight: row.insight,
      recommendation: row.recommendation,
      preventionStrategy: row.prevention_strategy,
      
      metadata: {
        id: row.id,
        category: row.category,
        subcategory: row.subcategory,
        confidence: row.confidence,
        impact: row.impact,
        source: row.source,
        timestamp: row.timestamp,
        tags: JSON.parse(row.tags || '[]')
      },
      
      context: JSON.parse(row.context || '{}'),
      evidence: JSON.parse(row.evidence || '{}'),
      applicability: JSON.parse(row.applicability_rules || '[]'),
      
      effectiveness: {
        appliedCount: row.applied_count,
        successRate: row.success_rate,
        avgImprovement: row.avg_improvement,
        lastApplied: row.last_applied
      },
      
      relatedLessons: JSON.parse(row.related_lessons || '[]'),
      supersededBy: row.superseded_by,
      supersedes: JSON.parse(row.supersedes || '[]')
    };
  }

  private async updateLessonEffectiveness(lessonId: string): Promise<void> {
    const applications = this.db.prepare(`
      SELECT outcome, improvement_metrics FROM lesson_applications WHERE lesson_id = ?
    `).all(lessonId);

    if (applications.length === 0) return;

    const successCount = applications.filter(app => app.outcome === 'success').length;
    const successRate = successCount / applications.length;

    // Calculate average improvement
    let totalImprovement = 0;
    let improvementCount = 0;

    for (const app of applications) {
      if (app.improvement_metrics) {
        try {
          const metrics = JSON.parse(app.improvement_metrics);
          const improvements = Object.values(metrics).filter(val => typeof val === 'number' && val > 0);
          if (improvements.length > 0) {
            totalImprovement += improvements.reduce((sum: number, val: any) => sum + val, 0) / improvements.length;
            improvementCount++;
          }
        } catch (e) {
          // Skip invalid metrics
        }
      }
    }

    const avgImprovement = improvementCount > 0 ? totalImprovement / improvementCount : 0;

    this.db.prepare(`
      UPDATE lessons_learned 
      SET success_rate = ?, avg_improvement = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `).run(successRate, avgImprovement, lessonId);
  }

  private async findAndCreateRelationships(lessonId: string): Promise<void> {
    const lesson = this.getLessonById(lessonId);
    if (!lesson) return;

    // Find similar lessons
    const similarLessons = this.db.prepare(`
      SELECT id, category, subcategory, confidence FROM lessons_learned 
      WHERE id != ? AND category = ? 
      ORDER BY confidence DESC LIMIT 5
    `).all(lessonId, lesson.metadata.category);

    for (const similar of similarLessons) {
      const strength = this.calculateRelationshipStrength(lesson, similar);
      if (strength > 0.3) {
        this.db.prepare(`
          INSERT OR IGNORE INTO lesson_relationships 
          (source_lesson_id, target_lesson_id, relationship_type, strength)
          VALUES (?, ?, 'similar', ?)
        `).run(lessonId, similar.id, strength);
      }
    }
  }

  private calculateRelationshipStrength(lesson1: any, lesson2: any): number {
    let strength = 0;

    if (lesson1.metadata.category === lesson2.category) strength += 0.3;
    if (lesson1.metadata.subcategory === lesson2.subcategory) strength += 0.4;
    
    // Additional similarity calculations could be added here
    
    return Math.min(strength, 1.0);
  }

  private startPeriodicAnalysis(): void {
    // Run pattern analysis every 30 minutes
    setInterval(() => {
      this.runPatternAnalysis();
    }, 30 * 60 * 1000);

    // Run cleanup every 6 hours
    setInterval(() => {
      this.runCleanup();
    }, 6 * 60 * 60 * 1000);
  }

  private async runPatternAnalysis(): Promise<void> {
    // Analyze recent traces for new patterns
    console.log('Running periodic pattern analysis...');
    this.emit('pattern_analysis_started');
    
    // Implementation for periodic pattern analysis
    // This would analyze recent traces and update patterns
    
    this.emit('pattern_analysis_completed');
  }

  private runCleanup(): void {
    // Clean up old cache entries
    this.db.prepare(`
      DELETE FROM recommendation_cache 
      WHERE (strftime('%s', 'now') - generated_at) > validity_period * 2
    `).run();

    // Clean up old trace analysis cache (keep for 7 days)
    this.db.prepare(`
      DELETE FROM trace_analysis_cache 
      WHERE (strftime('%s', 'now') - analyzed_at) > 604800
    `).run();

    console.log('Lessons learned cleanup completed');
  }

  /**
   * Export lessons for external analysis or backup
   */
  exportLessons(filters?: any): any {
    const lessons = this.getLessonsByCategory(filters?.category || 'all', filters);
    const analytics = this.getLessonsAnalytics();
    
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      filters,
      lessonsCount: lessons.length,
      lessons,
      analytics,
      metadata: {
        systemVersion: 'claude-flow-v2',
        exportFormat: 'lessons-learned-standard'
      }
    };
  }

  /**
   * Close database connections
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Export singleton instance
let lessonsService: LessonsLearnedService | null = null;

export function createLessonsLearnedService(dbPath?: string, memoryStore?: any): LessonsLearnedService {
  if (!lessonsService) {
    lessonsService = new LessonsLearnedService(dbPath, memoryStore);
  }
  return lessonsService;
}

export function getLessonsLearnedService(): LessonsLearnedService | null {
  return lessonsService;
}