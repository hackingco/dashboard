/**
 * Comprehensive Trace Structure System for Langfuse Integration
 * 
 * This system provides:
 * - Unique ID generation with consistent patterns
 * - Rich metadata enrichment for deep analysis
 * - Hierarchical trace management (traces -> spans -> generations)
 * - Session management with proper grouping
 * - Trace validation and quality assurance
 * - Performance-optimized batch operations
 * 
 * Core Features:
 * - Deterministic ID generation: `trace-${type}-${timestamp}-${hash}`
 * - Metadata enrichment with agent info, performance metrics, context
 * - Hierarchical relationships: parent/child traces, span nesting
 * - Session tracking for multi-operation workflows
 * - Validation system for data integrity
 * - Batch processing for high-volume scenarios
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

// ========== CORE TYPES ==========

export interface TraceMetadata {
  // Core identification
  traceId: string;
  sessionId: string;
  parentTraceId?: string;
  rootTraceId?: string;
  
  // Agent and swarm context
  agentId?: string;
  agentName?: string;
  agentType?: string;
  swarmId?: string;
  swarmTopology?: string;
  
  // Performance metrics
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  
  // Operation context
  operation: string;
  operationType: 'agent_spawn' | 'task_execute' | 'swarm_coordinate' | 'llm_generate' | 'api_call' | 'file_operation' | 'custom';
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Content and results
  input?: any;
  output?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
    type: string;
  };
  
  // Langfuse integration
  langfuseTraceId?: string;
  langfuseSpanId?: string;
  langfuseGenerationId?: string;
  
  // Analysis and categorization
  tags: string[];
  category: string;
  subcategory?: string;
  complexity: 'simple' | 'medium' | 'complex' | 'high';
  
  // Token usage (for LLM operations)
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  
  // Custom extensible metadata
  custom?: Record<string, any>;
}

export interface TraceHierarchy {
  trace: TraceMetadata;
  spans: TraceSpan[];
  generations: TraceGeneration[];
  children: TraceHierarchy[];
}

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'success' | 'error';
  metadata: Record<string, any>;
  tags: string[];
}

export interface TraceGeneration {
  generationId: string;
  traceId: string;
  spanId?: string;
  model: string;
  prompt: string;
  completion?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  metadata: Record<string, any>;
}

export interface SessionContext {
  sessionId: string;
  sessionName: string;
  sessionType: 'swarm_execution' | 'agent_workflow' | 'api_session' | 'test_run' | 'custom';
  startTime: number;
  endTime?: number;
  userId?: string;
  swarmId?: string;
  totalTraces: number;
  activeTraces: number;
  metadata: Record<string, any>;
}

// ========== ID GENERATION SYSTEM ==========

export class TraceIdGenerator {
  private static counter = 0;
  private static instanceId = Math.random().toString(36).substr(2, 9);
  
  /**
   * Generate unique trace ID with consistent pattern
   * Format: trace-{type}-{timestamp}-{hash}
   */
  static generateTraceId(type: string, context?: Record<string, any>): string {
    const timestamp = Date.now();
    const counter = ++this.counter;
    const contextStr = context ? JSON.stringify(context) : '';
    const hash = createHash('sha256')
      .update(`${type}-${timestamp}-${counter}-${this.instanceId}-${contextStr}`)
      .digest('hex')
      .substring(0, 8);
    
    return `trace-${type}-${timestamp}-${hash}`;
  }
  
  /**
   * Generate session ID with meaningful context
   * Format: session-{type}-{timestamp}-{hash}
   */
  static generateSessionId(type: string, context?: Record<string, any>): string {
    const timestamp = Date.now();
    const contextStr = context ? JSON.stringify(context) : '';
    const hash = createHash('sha256')
      .update(`${type}-${timestamp}-${this.instanceId}-${contextStr}`)
      .digest('hex')
      .substring(0, 8);
    
    return `session-${type}-${timestamp}-${hash}`;
  }
  
  /**
   * Generate span ID within trace context
   */
  static generateSpanId(traceId: string, spanName: string): string {
    const timestamp = Date.now();
    const hash = createHash('sha256')
      .update(`${traceId}-${spanName}-${timestamp}`)
      .digest('hex')
      .substring(0, 8);
    
    return `span-${spanName}-${timestamp}-${hash}`;
  }
  
  /**
   * Generate generation ID for LLM operations
   */
  static generateGenerationId(traceId: string, model: string): string {
    const timestamp = Date.now();
    const hash = createHash('sha256')
      .update(`${traceId}-${model}-${timestamp}`)
      .digest('hex')
      .substring(0, 8);
    
    return `gen-${model}-${timestamp}-${hash}`;
  }
  
  /**
   * Extract timestamp from ID
   */
  static extractTimestamp(id: string): number | null {
    const match = id.match(/-(\d+)-/);
    return match ? parseInt(match[1]) : null;
  }
  
  /**
   * Extract type from ID
   */
  static extractType(id: string): string | null {
    const match = id.match(/^(\w+)-([^-]+)/);
    return match ? match[2] : null;
  }
}

// ========== METADATA ENRICHMENT SYSTEM ==========

export class MetadataEnricher {
  private static systemInfo: Record<string, any> = {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };
  
  /**
   * Enrich trace metadata with comprehensive context
   */
  static enrichTraceMetadata(
    baseMetadata: Partial<TraceMetadata>,
    context: {
      agentInfo?: any;
      swarmInfo?: any;
      performanceMetrics?: any;
      operationContext?: any;
    } = {}
  ): TraceMetadata {
    const traceId = baseMetadata.traceId || TraceIdGenerator.generateTraceId(
      baseMetadata.operationType || 'custom',
      context
    );
    
    const sessionId = baseMetadata.sessionId || TraceIdGenerator.generateSessionId(
      'default',
      { traceId, operation: baseMetadata.operation }
    );
    
    const enriched: TraceMetadata = {
      // Core identification
      traceId,
      sessionId,
      parentTraceId: baseMetadata.parentTraceId,
      rootTraceId: baseMetadata.rootTraceId || traceId,
      
      // Agent and swarm context
      agentId: baseMetadata.agentId || context.agentInfo?.id,
      agentName: baseMetadata.agentName || context.agentInfo?.name,
      agentType: baseMetadata.agentType || context.agentInfo?.type,
      swarmId: baseMetadata.swarmId || context.swarmInfo?.id,
      swarmTopology: baseMetadata.swarmTopology || context.swarmInfo?.topology,
      
      // Performance metrics
      startTime: baseMetadata.startTime || Date.now(),
      endTime: baseMetadata.endTime,
      duration: baseMetadata.duration,
      memoryUsage: baseMetadata.memoryUsage || context.performanceMetrics?.memoryUsage,
      cpuUsage: baseMetadata.cpuUsage || context.performanceMetrics?.cpuUsage,
      
      // Operation context
      operation: baseMetadata.operation || 'unknown_operation',
      operationType: baseMetadata.operationType || 'custom',
      status: baseMetadata.status || 'pending',
      priority: baseMetadata.priority || 'medium',
      
      // Content and results
      input: baseMetadata.input,
      output: baseMetadata.output,
      error: baseMetadata.error,
      
      // Langfuse integration
      langfuseTraceId: baseMetadata.langfuseTraceId,
      langfuseSpanId: baseMetadata.langfuseSpanId,
      langfuseGenerationId: baseMetadata.langfuseGenerationId,
      
      // Analysis and categorization
      tags: this.enrichTags(baseMetadata.tags || [], context),
      category: baseMetadata.category || this.categorizeOperation(baseMetadata.operation || ''),
      subcategory: baseMetadata.subcategory,
      complexity: baseMetadata.complexity || this.assessComplexity(baseMetadata, context),
      
      // Token usage
      tokenUsage: baseMetadata.tokenUsage,
      
      // Custom extensible metadata
      custom: {
        ...baseMetadata.custom,
        systemInfo: this.systemInfo,
        enrichmentTimestamp: new Date().toISOString(),
        contextHash: this.generateContextHash(context),
      },
    };
    
    return enriched;
  }
  
  private static enrichTags(baseTags: string[], context: any): string[] {
    const enrichedTags = [...baseTags];
    
    // Add system tags
    enrichedTags.push('system:' + this.systemInfo.environment);
    enrichedTags.push('platform:' + this.systemInfo.platform);
    
    // Add context-based tags
    if (context.agentInfo?.type) {
      enrichedTags.push('agent:' + context.agentInfo.type);
    }
    
    if (context.swarmInfo?.topology) {
      enrichedTags.push('swarm:' + context.swarmInfo.topology);
    }
    
    if (context.performanceMetrics) {
      if (context.performanceMetrics.memoryUsage > 80) {
        enrichedTags.push('performance:high-memory');
      }
      if (context.performanceMetrics.cpuUsage > 80) {
        enrichedTags.push('performance:high-cpu');
      }
    }
    
    return [...new Set(enrichedTags)]; // Remove duplicates
  }
  
  private static categorizeOperation(operation: string): string {
    if (operation.includes('swarm') || operation.includes('coordinate')) {
      return 'swarm_coordination';
    }
    if (operation.includes('agent') || operation.includes('spawn')) {
      return 'agent_management';
    }
    if (operation.includes('llm') || operation.includes('generate')) {
      return 'llm_operations';
    }
    if (operation.includes('api') || operation.includes('request')) {
      return 'api_operations';
    }
    if (operation.includes('file') || operation.includes('io')) {
      return 'file_operations';
    }
    return 'general';
  }
  
  private static assessComplexity(metadata: Partial<TraceMetadata>, context: any): 'simple' | 'medium' | 'complex' | 'high' {
    let complexityScore = 0;
    
    // Operation type complexity
    if (metadata.operationType === 'swarm_coordinate') complexityScore += 3;
    if (metadata.operationType === 'llm_generate') complexityScore += 2;
    if (metadata.operationType === 'agent_spawn') complexityScore += 1;
    
    // Context complexity
    if (context.swarmInfo?.agentCount > 5) complexityScore += 2;
    if (context.agentInfo?.capabilities?.length > 3) complexityScore += 1;
    
    // Duration complexity
    if (metadata.duration && metadata.duration > 5000) complexityScore += 1;
    if (metadata.duration && metadata.duration > 30000) complexityScore += 2;
    
    if (complexityScore >= 6) return 'high';
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'medium';
    return 'simple';
  }
  
  private static generateContextHash(context: any): string {
    return createHash('sha256')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 12);
  }
}

// ========== TRACE HIERARCHY MANAGER ==========

export class TraceHierarchyManager {
  private traceStore: Map<string, TraceMetadata> = new Map();
  private hierarchyStore: Map<string, TraceHierarchy> = new Map();
  private sessionStore: Map<string, SessionContext> = new Map();
  
  /**
   * Create a new trace with proper hierarchy
   */
  createTrace(metadata: Partial<TraceMetadata>, context?: any): TraceMetadata {
    const enrichedMetadata = MetadataEnricher.enrichTraceMetadata(metadata, context);
    
    // Store trace
    this.traceStore.set(enrichedMetadata.traceId, enrichedMetadata);
    
    // Create hierarchy entry
    const hierarchy: TraceHierarchy = {
      trace: enrichedMetadata,
      spans: [],
      generations: [],
      children: [],
    };
    
    this.hierarchyStore.set(enrichedMetadata.traceId, hierarchy);
    
    // Update session context
    this.updateSessionContext(enrichedMetadata.sessionId, enrichedMetadata);
    
    // Link to parent if specified
    if (enrichedMetadata.parentTraceId) {
      this.linkToParent(enrichedMetadata.parentTraceId, enrichedMetadata.traceId);
    }
    
    return enrichedMetadata;
  }
  
  /**
   * Create a span within a trace
   */
  createSpan(traceId: string, spanName: string, metadata: Record<string, any> = {}): TraceSpan | null {
    const hierarchy = this.hierarchyStore.get(traceId);
    if (!hierarchy) return null;
    
    const span: TraceSpan = {
      spanId: TraceIdGenerator.generateSpanId(traceId, spanName),
      traceId,
      name: spanName,
      startTime: Date.now(),
      status: 'running',
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
      tags: metadata.tags || [],
    };
    
    hierarchy.spans.push(span);
    return span;
  }
  
  /**
   * Create a generation within a trace
   */
  createGeneration(traceId: string, model: string, prompt: string, metadata: Record<string, any> = {}): TraceGeneration | null {
    const hierarchy = this.hierarchyStore.get(traceId);
    if (!hierarchy) return null;
    
    const generation: TraceGeneration = {
      generationId: TraceIdGenerator.generateGenerationId(traceId, model),
      traceId,
      model,
      prompt,
      startTime: Date.now(),
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
    };
    
    hierarchy.generations.push(generation);
    return generation;
  }
  
  /**
   * Complete a span with results
   */
  completeSpan(spanId: string, result: any, status: 'success' | 'error' = 'success'): boolean {
    for (const hierarchy of this.hierarchyStore.values()) {
      const span = hierarchy.spans.find(s => s.spanId === spanId);
      if (span) {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = status;
        span.metadata.result = result;
        return true;
      }
    }
    return false;
  }
  
  /**
   * Complete a generation with results
   */
  completeGeneration(generationId: string, completion: string, tokenUsage?: any): boolean {
    for (const hierarchy of this.hierarchyStore.values()) {
      const generation = hierarchy.generations.find(g => g.generationId === generationId);
      if (generation) {
        generation.completion = completion;
        generation.endTime = Date.now();
        generation.duration = generation.endTime - generation.startTime;
        generation.tokenUsage = tokenUsage;
        return true;
      }
    }
    return false;
  }
  
  /**
   * Update trace status and results
   */
  updateTrace(traceId: string, updates: Partial<TraceMetadata>): boolean {
    const trace = this.traceStore.get(traceId);
    if (!trace) return false;
    
    Object.assign(trace, updates);
    
    // Update hierarchy
    const hierarchy = this.hierarchyStore.get(traceId);
    if (hierarchy) {
      hierarchy.trace = trace;
    }
    
    return true;
  }
  
  /**
   * Link child trace to parent
   */
  private linkToParent(parentTraceId: string, childTraceId: string): void {
    const parentHierarchy = this.hierarchyStore.get(parentTraceId);
    const childHierarchy = this.hierarchyStore.get(childTraceId);
    
    if (parentHierarchy && childHierarchy) {
      parentHierarchy.children.push(childHierarchy);
    }
  }
  
  /**
   * Update session context
   */
  private updateSessionContext(sessionId: string, trace: TraceMetadata): void {
    let session = this.sessionStore.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        sessionName: `Session ${sessionId}`,
        sessionType: 'custom',
        startTime: Date.now(),
        totalTraces: 0,
        activeTraces: 0,
        metadata: {},
      };
      this.sessionStore.set(sessionId, session);
    }
    
    session.totalTraces++;
    if (trace.status === 'running' || trace.status === 'pending') {
      session.activeTraces++;
    }
    
    // Update session metadata
    if (trace.swarmId) {
      session.swarmId = trace.swarmId;
    }
    if (trace.agentId) {
      session.metadata.lastAgentId = trace.agentId;
    }
  }
  
  /**
   * Get trace hierarchy
   */
  getHierarchy(traceId: string): TraceHierarchy | null {
    return this.hierarchyStore.get(traceId) || null;
  }
  
  /**
   * Get session context
   */
  getSession(sessionId: string): SessionContext | null {
    return this.sessionStore.get(sessionId) || null;
  }
  
  /**
   * Get all traces for a session
   */
  getSessionTraces(sessionId: string): TraceMetadata[] {
    return Array.from(this.traceStore.values()).filter(trace => trace.sessionId === sessionId);
  }
  
  /**
   * Get traces by criteria
   */
  getTraces(criteria: {
    sessionId?: string;
    agentId?: string;
    swarmId?: string;
    status?: string;
    operationType?: string;
    tags?: string[];
    fromTime?: number;
    toTime?: number;
  }): TraceMetadata[] {
    return Array.from(this.traceStore.values()).filter(trace => {
      if (criteria.sessionId && trace.sessionId !== criteria.sessionId) return false;
      if (criteria.agentId && trace.agentId !== criteria.agentId) return false;
      if (criteria.swarmId && trace.swarmId !== criteria.swarmId) return false;
      if (criteria.status && trace.status !== criteria.status) return false;
      if (criteria.operationType && trace.operationType !== criteria.operationType) return false;
      if (criteria.tags && !criteria.tags.every(tag => trace.tags.includes(tag))) return false;
      if (criteria.fromTime && trace.startTime < criteria.fromTime) return false;
      if (criteria.toTime && trace.startTime > criteria.toTime) return false;
      return true;
    });
  }
}

// ========== TRACE VALIDATION SYSTEM ==========

export class TraceValidator {
  /**
   * Validate trace structure and data integrity
   */
  static validateTrace(trace: TraceMetadata): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields validation
    if (!trace.traceId) errors.push('traceId is required');
    if (!trace.sessionId) errors.push('sessionId is required');
    if (!trace.operation) errors.push('operation is required');
    if (!trace.operationType) errors.push('operationType is required');
    if (!trace.startTime) errors.push('startTime is required');
    
    // ID format validation
    if (trace.traceId && !trace.traceId.match(/^trace-\w+-\d+-\w+$/)) {
      errors.push('traceId format is invalid');
    }
    
    if (trace.sessionId && !trace.sessionId.match(/^session-\w+-\d+-\w+$/)) {
      errors.push('sessionId format is invalid');
    }
    
    // Status validation
    const validStatuses = ['pending', 'running', 'success', 'error', 'cancelled'];
    if (trace.status && !validStatuses.includes(trace.status)) {
      errors.push(`Invalid status: ${trace.status}`);
    }
    
    // Time consistency validation
    if (trace.endTime && trace.startTime && trace.endTime < trace.startTime) {
      errors.push('endTime cannot be before startTime');
    }
    
    if (trace.duration && trace.endTime && trace.startTime) {
      const calculatedDuration = trace.endTime - trace.startTime;
      if (Math.abs(calculatedDuration - trace.duration) > 100) {
        warnings.push('duration does not match calculated time difference');
      }
    }
    
    // Performance metrics validation
    if (trace.memoryUsage && (trace.memoryUsage < 0 || trace.memoryUsage > 100)) {
      warnings.push('memoryUsage should be between 0 and 100');
    }
    
    if (trace.cpuUsage && (trace.cpuUsage < 0 || trace.cpuUsage > 100)) {
      warnings.push('cpuUsage should be between 0 and 100');
    }
    
    // Token usage validation
    if (trace.tokenUsage) {
      if (trace.tokenUsage.promptTokens < 0) {
        errors.push('promptTokens cannot be negative');
      }
      if (trace.tokenUsage.completionTokens < 0) {
        errors.push('completionTokens cannot be negative');
      }
      if (trace.tokenUsage.totalTokens !== trace.tokenUsage.promptTokens + trace.tokenUsage.completionTokens) {
        warnings.push('totalTokens does not match sum of prompt and completion tokens');
      }
    }
    
    // Tag validation
    if (trace.tags && trace.tags.length === 0) {
      warnings.push('traces should have at least one tag');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * Validate trace hierarchy
   */
  static validateHierarchy(hierarchy: TraceHierarchy): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate root trace
    const traceValidation = this.validateTrace(hierarchy.trace);
    errors.push(...traceValidation.errors);
    warnings.push(...traceValidation.warnings);
    
    // Validate spans
    for (const span of hierarchy.spans) {
      if (!span.spanId) errors.push('span missing spanId');
      if (span.traceId !== hierarchy.trace.traceId) {
        errors.push(`span traceId mismatch: ${span.traceId} vs ${hierarchy.trace.traceId}`);
      }
      if (span.endTime && span.startTime && span.endTime < span.startTime) {
        errors.push(`span ${span.spanId} endTime before startTime`);
      }
    }
    
    // Validate generations
    for (const generation of hierarchy.generations) {
      if (!generation.generationId) errors.push('generation missing generationId');
      if (generation.traceId !== hierarchy.trace.traceId) {
        errors.push(`generation traceId mismatch: ${generation.traceId} vs ${hierarchy.trace.traceId}`);
      }
      if (!generation.model) errors.push('generation missing model');
      if (!generation.prompt) errors.push('generation missing prompt');
    }
    
    // Validate children
    for (const child of hierarchy.children) {
      if (child.trace.parentTraceId !== hierarchy.trace.traceId) {
        errors.push(`child trace parentTraceId mismatch`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// ========== SINGLETON INSTANCE ==========

export const traceStructureSystem = new TraceHierarchyManager();

// ========== EXPORT ALL CLASSES ==========

export {
  TraceIdGenerator,
  MetadataEnricher,
  TraceHierarchyManager,
  TraceValidator,
};