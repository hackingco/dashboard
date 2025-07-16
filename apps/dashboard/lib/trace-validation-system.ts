/**
 * Comprehensive Trace Validation System
 * 
 * This system provides:
 * - Real-time trace validation
 * - Schema validation and type checking
 * - Data integrity verification
 * - Performance validation
 * - Quality assurance metrics
 * - Validation reporting and alerts
 * - Auto-correction capabilities
 */

import { TraceMetadata, TraceHierarchy, TraceSpan, TraceGeneration } from './trace-structure-system';
import { SessionContext, SessionMetrics } from './session-management-system';
import { EventEmitter } from 'events';

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  corrected?: any;
}

export interface ValidationError {
  code: string;
  message: string;
  field: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fixable: boolean;
  context?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field: string;
  impact: 'performance' | 'accuracy' | 'analytics' | 'usability';
  recommendation: string;
}

export interface ValidationSuggestion {
  code: string;
  message: string;
  field: string;
  action: 'add' | 'modify' | 'remove' | 'format';
  value?: any;
  reason: string;
}

export interface ValidationConfig {
  strictMode: boolean;
  autoCorrect: boolean;
  performanceThresholds: {
    maxDuration: number;
    maxMemoryUsage: number;
    maxCpuUsage: number;
    maxTokens: number;
  };
  qualityThresholds: {
    minScore: number;
    maxErrors: number;
    maxWarnings: number;
  };
  requiredFields: string[];
  customValidators: Map<string, (value: any) => ValidationResult>;
}

export class TraceValidationSystem extends EventEmitter {
  private config: ValidationConfig;
  private validationStats: Map<string, { total: number; passed: number; failed: number; score: number }> = new Map();
  
  constructor(config: Partial<ValidationConfig> = {}) {
    super();
    
    this.config = {
      strictMode: config.strictMode ?? false,
      autoCorrect: config.autoCorrect ?? true,
      performanceThresholds: {
        maxDuration: 30000, // 30 seconds
        maxMemoryUsage: 90, // 90%
        maxCpuUsage: 90, // 90%
        maxTokens: 10000,
        ...config.performanceThresholds,
      },
      qualityThresholds: {
        minScore: 80,
        maxErrors: 0,
        maxWarnings: 5,
        ...config.qualityThresholds,
      },
      requiredFields: [
        'traceId', 'sessionId', 'operation', 'operationType', 'startTime', 'status',
        ...config.requiredFields || [],
      ],
      customValidators: config.customValidators || new Map(),
    };
  }
  
  /**
   * Validate a single trace
   */
  validateTrace(trace: TraceMetadata): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    
    // Core validation
    this.validateRequiredFields(trace, errors);
    this.validateIdFormats(trace, errors);
    this.validateTimeConsistency(trace, errors, warnings);
    this.validateStatus(trace, errors, warnings);
    this.validatePerformanceMetrics(trace, warnings);
    this.validateTokenUsage(trace, errors, warnings);
    this.validateTags(trace, warnings, suggestions);
    this.validateMetadata(trace, warnings, suggestions);
    
    // Custom validations
    this.runCustomValidations(trace, errors, warnings, suggestions);
    
    // Calculate score
    const score = this.calculateValidationScore(trace, errors, warnings);
    
    // Generate suggestions
    this.generateOptimizationSuggestions(trace, suggestions);
    
    // Auto-correct if enabled
    let corrected: TraceMetadata | undefined;
    if (this.config.autoCorrect) {
      corrected = this.autoCorrectTrace(trace, errors, warnings, suggestions);
    }
    
    const result: ValidationResult = {
      valid: errors.length === 0,
      score,
      errors,
      warnings,
      suggestions,
      corrected,
    };
    
    // Update statistics
    this.updateValidationStats(trace.operationType, result);
    
    // Emit validation event
    this.emit('trace-validated', trace, result);
    
    return result;
  }
  
  /**
   * Validate trace hierarchy
   */
  validateHierarchy(hierarchy: TraceHierarchy): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    
    // Validate root trace
    const traceResult = this.validateTrace(hierarchy.trace);
    errors.push(...traceResult.errors);
    warnings.push(...traceResult.warnings);
    suggestions.push(...traceResult.suggestions);
    
    // Validate spans
    this.validateSpans(hierarchy.spans, hierarchy.trace, errors, warnings);
    
    // Validate generations
    this.validateGenerations(hierarchy.generations, hierarchy.trace, errors, warnings);
    
    // Validate hierarchy relationships
    this.validateHierarchyRelationships(hierarchy, errors, warnings);
    
    // Calculate hierarchy score
    const score = this.calculateHierarchyScore(hierarchy, errors, warnings);
    
    return {
      valid: errors.length === 0,
      score,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Validate session context
   */
  validateSession(session: SessionContext): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    
    // Required fields
    if (!session.sessionId) {
      errors.push({
        code: 'MISSING_SESSION_ID',
        message: 'Session ID is required',
        field: 'sessionId',
        severity: 'critical',
        fixable: true,
      });
    }
    
    if (!session.sessionName) {
      warnings.push({
        code: 'MISSING_SESSION_NAME',
        message: 'Session name is recommended for better organization',
        field: 'sessionName',
        impact: 'usability',
        recommendation: 'Add a descriptive session name',
      });
    }
    
    // Validate session ID format
    if (session.sessionId && !session.sessionId.match(/^session-\w+-\d+-\w+$/)) {
      errors.push({
        code: 'INVALID_SESSION_ID_FORMAT',
        message: 'Session ID format is invalid',
        field: 'sessionId',
        severity: 'high',
        fixable: true,
      });
    }
    
    // Validate time consistency
    if (session.endTime && session.startTime && session.endTime < session.startTime) {
      errors.push({
        code: 'INVALID_SESSION_TIME',
        message: 'Session end time cannot be before start time',
        field: 'endTime',
        severity: 'medium',
        fixable: true,
      });
    }
    
    // Validate trace counts
    if (session.totalTraces < 0) {
      errors.push({
        code: 'NEGATIVE_TRACE_COUNT',
        message: 'Total traces cannot be negative',
        field: 'totalTraces',
        severity: 'high',
        fixable: true,
      });
    }
    
    if (session.activeTraces < 0) {
      errors.push({
        code: 'NEGATIVE_ACTIVE_TRACES',
        message: 'Active traces cannot be negative',
        field: 'activeTraces',
        severity: 'high',
        fixable: true,
      });
    }
    
    if (session.activeTraces > session.totalTraces) {
      errors.push({
        code: 'INCONSISTENT_TRACE_COUNTS',
        message: 'Active traces cannot exceed total traces',
        field: 'activeTraces',
        severity: 'medium',
        fixable: true,
      });
    }
    
    const score = this.calculateSessionScore(session, errors, warnings);
    
    return {
      valid: errors.length === 0,
      score,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Validate required fields
   */
  private validateRequiredFields(trace: TraceMetadata, errors: ValidationError[]): void {
    for (const field of this.config.requiredFields) {
      if (!trace[field as keyof TraceMetadata]) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing`,
          field,
          severity: 'critical',
          fixable: true,
        });
      }
    }
  }
  
  /**
   * Validate ID formats
   */
  private validateIdFormats(trace: TraceMetadata, errors: ValidationError[]): void {
    if (trace.traceId && !trace.traceId.match(/^trace-\w+-\d+-\w+$/)) {
      errors.push({
        code: 'INVALID_TRACE_ID_FORMAT',
        message: 'Trace ID format is invalid',
        field: 'traceId',
        severity: 'high',
        fixable: true,
      });
    }
    
    if (trace.sessionId && !trace.sessionId.match(/^session-\w+-\d+-\w+$/)) {
      errors.push({
        code: 'INVALID_SESSION_ID_FORMAT',
        message: 'Session ID format is invalid',
        field: 'sessionId',
        severity: 'high',
        fixable: true,
      });
    }
  }
  
  /**
   * Validate time consistency
   */
  private validateTimeConsistency(trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (trace.endTime && trace.startTime && trace.endTime < trace.startTime) {
      errors.push({
        code: 'INVALID_TIME_SEQUENCE',
        message: 'End time cannot be before start time',
        field: 'endTime',
        severity: 'medium',
        fixable: true,
      });
    }
    
    if (trace.duration && trace.endTime && trace.startTime) {
      const calculatedDuration = trace.endTime - trace.startTime;
      if (Math.abs(calculatedDuration - trace.duration) > 100) {
        warnings.push({
          code: 'DURATION_MISMATCH',
          message: 'Duration does not match calculated time difference',
          field: 'duration',
          impact: 'accuracy',
          recommendation: 'Ensure duration matches endTime - startTime',
        });
      }
    }
    
    if (trace.startTime > Date.now()) {
      warnings.push({
        code: 'FUTURE_START_TIME',
        message: 'Start time is in the future',
        field: 'startTime',
        impact: 'accuracy',
        recommendation: 'Verify system clock synchronization',
      });
    }
  }
  
  /**
   * Validate status
   */
  private validateStatus(trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const validStatuses = ['pending', 'running', 'success', 'error', 'cancelled'];
    if (!validStatuses.includes(trace.status)) {
      errors.push({
        code: 'INVALID_STATUS',
        message: `Invalid status: ${trace.status}`,
        field: 'status',
        severity: 'medium',
        fixable: true,
      });
    }
    
    // Check status consistency
    if (trace.status === 'success' && trace.error) {
      warnings.push({
        code: 'STATUS_ERROR_INCONSISTENCY',
        message: 'Status is success but error is present',
        field: 'status',
        impact: 'accuracy',
        recommendation: 'Remove error or change status to error',
      });
    }
    
    if (trace.status === 'error' && !trace.error) {
      warnings.push({
        code: 'ERROR_STATUS_NO_ERROR',
        message: 'Status is error but no error details provided',
        field: 'error',
        impact: 'analytics',
        recommendation: 'Add error details for better debugging',
      });
    }
  }
  
  /**
   * Validate performance metrics
   */
  private validatePerformanceMetrics(trace: TraceMetadata, warnings: ValidationWarning[]): void {
    if (trace.duration && trace.duration > this.config.performanceThresholds.maxDuration) {
      warnings.push({
        code: 'SLOW_OPERATION',
        message: `Operation duration (${trace.duration}ms) exceeds threshold (${this.config.performanceThresholds.maxDuration}ms)`,
        field: 'duration',
        impact: 'performance',
        recommendation: 'Optimize operation or increase timeout threshold',
      });
    }
    
    if (trace.memoryUsage && trace.memoryUsage > this.config.performanceThresholds.maxMemoryUsage) {
      warnings.push({
        code: 'HIGH_MEMORY_USAGE',
        message: `Memory usage (${trace.memoryUsage}%) exceeds threshold (${this.config.performanceThresholds.maxMemoryUsage}%)`,
        field: 'memoryUsage',
        impact: 'performance',
        recommendation: 'Optimize memory usage or increase memory limits',
      });
    }
    
    if (trace.cpuUsage && trace.cpuUsage > this.config.performanceThresholds.maxCpuUsage) {
      warnings.push({
        code: 'HIGH_CPU_USAGE',
        message: `CPU usage (${trace.cpuUsage}%) exceeds threshold (${this.config.performanceThresholds.maxCpuUsage}%)`,
        field: 'cpuUsage',
        impact: 'performance',
        recommendation: 'Optimize CPU usage or scale resources',
      });
    }
  }
  
  /**
   * Validate token usage
   */
  private validateTokenUsage(trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (trace.tokenUsage) {
      if (trace.tokenUsage.promptTokens < 0) {
        errors.push({
          code: 'NEGATIVE_PROMPT_TOKENS',
          message: 'Prompt tokens cannot be negative',
          field: 'tokenUsage.promptTokens',
          severity: 'medium',
          fixable: true,
        });
      }
      
      if (trace.tokenUsage.completionTokens < 0) {
        errors.push({
          code: 'NEGATIVE_COMPLETION_TOKENS',
          message: 'Completion tokens cannot be negative',
          field: 'tokenUsage.completionTokens',
          severity: 'medium',
          fixable: true,
        });
      }
      
      if (trace.tokenUsage.totalTokens !== trace.tokenUsage.promptTokens + trace.tokenUsage.completionTokens) {
        warnings.push({
          code: 'TOKEN_COUNT_MISMATCH',
          message: 'Total tokens does not match sum of prompt and completion tokens',
          field: 'tokenUsage.totalTokens',
          impact: 'accuracy',
          recommendation: 'Ensure totalTokens = promptTokens + completionTokens',
        });
      }
      
      if (trace.tokenUsage.totalTokens > this.config.performanceThresholds.maxTokens) {
        warnings.push({
          code: 'HIGH_TOKEN_USAGE',
          message: `Token usage (${trace.tokenUsage.totalTokens}) exceeds threshold (${this.config.performanceThresholds.maxTokens})`,
          field: 'tokenUsage.totalTokens',
          impact: 'performance',
          recommendation: 'Optimize prompt length or use model with higher token limits',
        });
      }
    }
  }
  
  /**
   * Validate tags
   */
  private validateTags(trace: TraceMetadata, warnings: ValidationWarning[], suggestions: ValidationSuggestion[]): void {
    if (!trace.tags || trace.tags.length === 0) {
      warnings.push({
        code: 'NO_TAGS',
        message: 'Trace has no tags',
        field: 'tags',
        impact: 'analytics',
        recommendation: 'Add relevant tags for better categorization',
      });
      
      suggestions.push({
        code: 'ADD_OPERATION_TAG',
        message: 'Add operation type as tag',
        field: 'tags',
        action: 'add',
        value: trace.operationType,
        reason: 'Improves categorization and filtering',
      });
    }
    
    // Check for duplicate tags
    if (trace.tags) {
      const uniqueTags = new Set(trace.tags);
      if (uniqueTags.size !== trace.tags.length) {
        warnings.push({
          code: 'DUPLICATE_TAGS',
          message: 'Trace has duplicate tags',
          field: 'tags',
          impact: 'analytics',
          recommendation: 'Remove duplicate tags',
        });
      }
    }
  }
  
  /**
   * Validate metadata
   */
  private validateMetadata(trace: TraceMetadata, warnings: ValidationWarning[], suggestions: ValidationSuggestion[]): void {
    if (trace.agentId && !trace.agentName) {
      suggestions.push({
        code: 'ADD_AGENT_NAME',
        message: 'Add agent name for better identification',
        field: 'agentName',
        action: 'add',
        value: `Agent ${trace.agentId}`,
        reason: 'Improves readability and debugging',
      });
    }
    
    if (trace.operationType === 'llm_generate' && !trace.tokenUsage) {
      warnings.push({
        code: 'MISSING_TOKEN_USAGE',
        message: 'LLM operation missing token usage information',
        field: 'tokenUsage',
        impact: 'analytics',
        recommendation: 'Add token usage for cost tracking',
      });
    }
  }
  
  /**
   * Validate spans
   */
  private validateSpans(spans: TraceSpan[], trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const span of spans) {
      if (!span.spanId) {
        errors.push({
          code: 'MISSING_SPAN_ID',
          message: 'Span missing spanId',
          field: 'spanId',
          severity: 'high',
          fixable: true,
        });
      }
      
      if (span.traceId !== trace.traceId) {
        errors.push({
          code: 'SPAN_TRACE_ID_MISMATCH',
          message: `Span traceId (${span.traceId}) does not match parent trace (${trace.traceId})`,
          field: 'traceId',
          severity: 'high',
          fixable: true,
        });
      }
      
      if (span.endTime && span.startTime && span.endTime < span.startTime) {
        errors.push({
          code: 'INVALID_SPAN_TIME',
          message: 'Span end time cannot be before start time',
          field: 'endTime',
          severity: 'medium',
          fixable: true,
        });
      }
    }
  }
  
  /**
   * Validate generations
   */
  private validateGenerations(generations: TraceGeneration[], trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const generation of generations) {
      if (!generation.generationId) {
        errors.push({
          code: 'MISSING_GENERATION_ID',
          message: 'Generation missing generationId',
          field: 'generationId',
          severity: 'high',
          fixable: true,
        });
      }
      
      if (generation.traceId !== trace.traceId) {
        errors.push({
          code: 'GENERATION_TRACE_ID_MISMATCH',
          message: `Generation traceId (${generation.traceId}) does not match parent trace (${trace.traceId})`,
          field: 'traceId',
          severity: 'high',
          fixable: true,
        });
      }
      
      if (!generation.model) {
        errors.push({
          code: 'MISSING_MODEL',
          message: 'Generation missing model',
          field: 'model',
          severity: 'medium',
          fixable: false,
        });
      }
      
      if (!generation.prompt) {
        errors.push({
          code: 'MISSING_PROMPT',
          message: 'Generation missing prompt',
          field: 'prompt',
          severity: 'medium',
          fixable: false,
        });
      }
    }
  }
  
  /**
   * Validate hierarchy relationships
   */
  private validateHierarchyRelationships(hierarchy: TraceHierarchy, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const child of hierarchy.children) {
      if (child.trace.parentTraceId !== hierarchy.trace.traceId) {
        errors.push({
          code: 'CHILD_PARENT_MISMATCH',
          message: 'Child trace parentTraceId does not match parent trace ID',
          field: 'parentTraceId',
          severity: 'high',
          fixable: true,
        });
      }
      
      if (child.trace.rootTraceId !== hierarchy.trace.rootTraceId) {
        warnings.push({
          code: 'ROOT_TRACE_MISMATCH',
          message: 'Child trace rootTraceId does not match parent root trace ID',
          field: 'rootTraceId',
          impact: 'analytics',
          recommendation: 'Ensure consistent root trace ID throughout hierarchy',
        });
      }
    }
  }
  
  /**
   * Run custom validations
   */
  private runCustomValidations(trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[], suggestions: ValidationSuggestion[]): void {
    for (const [field, validator] of this.config.customValidators) {
      try {
        const value = trace[field as keyof TraceMetadata];
        if (value !== undefined) {
          const result = validator(value);
          errors.push(...result.errors);
          warnings.push(...result.warnings);
          suggestions.push(...result.suggestions);
        }
      } catch (error) {
        errors.push({
          code: 'CUSTOM_VALIDATOR_ERROR',
          message: `Custom validator for '${field}' failed: ${error}`,
          field,
          severity: 'low',
          fixable: false,
        });
      }
    }
  }
  
  /**
   * Calculate validation score
   */
  private calculateValidationScore(trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100;
    
    // Deduct points for errors
    for (const error of errors) {
      switch (error.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    
    // Deduct points for warnings
    for (const warning of warnings) {
      switch (warning.impact) {
        case 'performance': score -= 5; break;
        case 'accuracy': score -= 3; break;
        case 'analytics': score -= 2; break;
        case 'usability': score -= 1; break;
      }
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Calculate hierarchy score
   */
  private calculateHierarchyScore(hierarchy: TraceHierarchy, errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = this.calculateValidationScore(hierarchy.trace, errors, warnings);
    
    // Bonus for well-structured hierarchy
    if (hierarchy.spans.length > 0) score += 2;
    if (hierarchy.generations.length > 0) score += 2;
    if (hierarchy.children.length > 0) score += 3;
    
    return Math.min(100, score);
  }
  
  /**
   * Calculate session score
   */
  private calculateSessionScore(session: SessionContext, errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100;
    
    for (const error of errors) {
      switch (error.severity) {
        case 'critical': score -= 20; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    
    for (const warning of warnings) {
      score -= 2;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(trace: TraceMetadata, suggestions: ValidationSuggestion[]): void {
    // Add category if missing
    if (!trace.category) {
      suggestions.push({
        code: 'ADD_CATEGORY',
        message: 'Add category for better organization',
        field: 'category',
        action: 'add',
        value: this.inferCategory(trace),
        reason: 'Improves filtering and analytics',
      });
    }
    
    // Add complexity if missing
    if (!trace.complexity) {
      suggestions.push({
        code: 'ADD_COMPLEXITY',
        message: 'Add complexity assessment',
        field: 'complexity',
        action: 'add',
        value: this.inferComplexity(trace),
        reason: 'Helps with performance analysis and optimization',
      });
    }
    
    // Add priority if missing
    if (!trace.priority) {
      suggestions.push({
        code: 'ADD_PRIORITY',
        message: 'Add priority for better task management',
        field: 'priority',
        action: 'add',
        value: 'medium',
        reason: 'Improves task scheduling and resource allocation',
      });
    }
  }
  
  /**
   * Auto-correct trace
   */
  private autoCorrectTrace(trace: TraceMetadata, errors: ValidationError[], warnings: ValidationWarning[], suggestions: ValidationSuggestion[]): TraceMetadata {
    const corrected = { ...trace };
    
    // Fix fixable errors
    for (const error of errors) {
      if (error.fixable) {
        switch (error.code) {
          case 'MISSING_REQUIRED_FIELD':
            this.fixMissingField(corrected, error.field);
            break;
          case 'INVALID_TIME_SEQUENCE':
            this.fixTimeSequence(corrected);
            break;
          case 'NEGATIVE_PROMPT_TOKENS':
            if (corrected.tokenUsage) corrected.tokenUsage.promptTokens = 0;
            break;
          case 'NEGATIVE_COMPLETION_TOKENS':
            if (corrected.tokenUsage) corrected.tokenUsage.completionTokens = 0;
            break;
        }
      }
    }
    
    // Apply suggestions
    for (const suggestion of suggestions) {
      if (suggestion.action === 'add' && suggestion.value !== undefined) {
        (corrected as any)[suggestion.field] = suggestion.value;
      }
    }
    
    return corrected;
  }
  
  /**
   * Fix missing field
   */
  private fixMissingField(trace: TraceMetadata, field: string): void {
    switch (field) {
      case 'traceId':
        trace.traceId = `trace-${trace.operationType || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
        break;
      case 'sessionId':
        trace.sessionId = `session-default-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
        break;
      case 'operation':
        trace.operation = trace.operationType || 'unknown_operation';
        break;
      case 'operationType':
        trace.operationType = 'custom';
        break;
      case 'startTime':
        trace.startTime = Date.now();
        break;
      case 'status':
        trace.status = 'pending';
        break;
    }
  }
  
  /**
   * Fix time sequence
   */
  private fixTimeSequence(trace: TraceMetadata): void {
    if (trace.endTime && trace.startTime && trace.endTime < trace.startTime) {
      trace.endTime = trace.startTime + (trace.duration || 1000);
    }
  }
  
  /**
   * Infer category
   */
  private inferCategory(trace: TraceMetadata): string {
    if (trace.operationType === 'swarm_coordinate') return 'swarm_coordination';
    if (trace.operationType === 'agent_spawn') return 'agent_management';
    if (trace.operationType === 'llm_generate') return 'llm_operations';
    if (trace.operationType === 'api_call') return 'api_operations';
    return 'general';
  }
  
  /**
   * Infer complexity
   */
  private inferComplexity(trace: TraceMetadata): 'simple' | 'medium' | 'complex' | 'high' {
    if (trace.duration && trace.duration > 10000) return 'complex';
    if (trace.tokenUsage && trace.tokenUsage.totalTokens > 2000) return 'complex';
    if (trace.operationType === 'swarm_coordinate') return 'complex';
    if (trace.operationType === 'llm_generate') return 'medium';
    return 'simple';
  }
  
  /**
   * Update validation statistics
   */
  private updateValidationStats(operationType: string, result: ValidationResult): void {
    const stats = this.validationStats.get(operationType) || { total: 0, passed: 0, failed: 0, score: 0 };
    
    stats.total++;
    if (result.valid) {
      stats.passed++;
    } else {
      stats.failed++;
    }
    stats.score = ((stats.score * (stats.total - 1)) + result.score) / stats.total;
    
    this.validationStats.set(operationType, stats);
  }
  
  /**
   * Get validation statistics
   */
  getValidationStats(): Map<string, { total: number; passed: number; failed: number; score: number }> {
    return new Map(this.validationStats);
  }
  
  /**
   * Update validation configuration
   */
  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }
  
  /**
   * Reset validation statistics
   */
  resetStats(): void {
    this.validationStats.clear();
    this.emit('stats-reset');
  }
}

// Export singleton instance
export const traceValidator = new TraceValidationSystem();

export default traceValidator;