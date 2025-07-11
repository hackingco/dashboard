/**
 * Hooks Manager for Claude-Flow
 * Manages pre/post operation hooks for coordination
 */

import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

export class HooksManager {
  constructor(memory) {
    this.memory = memory;
    this.activeHooks = new Map();
    this.sessionId = null;
  }

  /**
   * Execute a hook by type
   * @param {string} hookType - The type of hook to execute
   * @param {Object} options - Hook options
   */
  async executeHook(hookType, options = {}) {
    const startTime = Date.now();
    const hookId = uuidv4();

    try {
      logger.info(`Executing ${hookType} hook`, { hookId, options });

      let result;
      switch (hookType) {
        case 'pre-task':
          result = await this.preTaskHook(options);
          break;
        
        case 'post-task':
          result = await this.postTaskHook(options);
          break;
        
        case 'pre-edit':
          result = await this.preEditHook(options);
          break;
        
        case 'post-edit':
          result = await this.postEditHook(options);
          break;
        
        case 'notification':
          result = await this.notificationHook(options);
          break;
        
        case 'pre-search':
          result = await this.preSearchHook(options);
          break;
        
        case 'session-start':
          result = await this.sessionStartHook(options);
          break;
        
        case 'session-end':
          result = await this.sessionEndHook(options);
          break;
        
        case 'session-restore':
          result = await this.sessionRestoreHook(options);
          break;
        
        default:
          throw new Error(`Unknown hook type: ${hookType}`);
      }

      const duration = Date.now() - startTime;
      
      // Log hook execution
      await this.memory.db.logHook(
        hookType,
        options,
        result,
        true,
        null,
        duration
      );

      return { success: true, data: result, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed hook
      await this.memory.db.logHook(
        hookType,
        options,
        null,
        false,
        error.message,
        duration
      );

      logger.error(`Hook ${hookType} failed`, error);
      return { success: false, error: error.message, duration };
    }
  }

  /**
   * Pre-task hook - executed before starting a task
   */
  async preTaskHook(options) {
    const {
      description,
      autoSpawnAgents = true,
      loadPreviousContext = true
    } = options;

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store task initialization
    await this.memory.store(
      `task/${taskId}/init`,
      {
        description,
        startTime: Date.now(),
        options
      },
      'hooks'
    );

    // Load previous context if requested
    let previousContext = null;
    if (loadPreviousContext) {
      const contexts = await this.memory.search('task/*/summary', 'hooks');
      if (contexts.length > 0) {
        previousContext = contexts[contexts.length - 1].value;
      }
    }

    // Auto-spawn agents if requested
    let suggestedAgents = [];
    if (autoSpawnAgents) {
      suggestedAgents = this.suggestAgentsForTask(description);
    }

    return {
      taskId,
      description,
      previousContext,
      suggestedAgents
    };
  }

  /**
   * Post-task hook - executed after completing a task
   */
  async postTaskHook(options) {
    const {
      taskId,
      analyzePerformance = true,
      generateSummary = true
    } = options;

    const taskData = await this.memory.retrieve(`task/${taskId}/init`, 'hooks');
    if (!taskData) {
      throw new Error(`Task ${taskId} not found`);
    }

    const endTime = Date.now();
    const duration = endTime - taskData.startTime;

    let performance = null;
    if (analyzePerformance) {
      // Analyze performance metrics
      const edits = await this.memory.search(`task/${taskId}/edit/*`, 'hooks');
      const searches = await this.memory.search(`task/${taskId}/search/*`, 'hooks');
      
      performance = {
        duration,
        editsCount: edits.length,
        searchesCount: searches.length,
        averageEditTime: edits.reduce((acc, e) => acc + (e.value.duration || 0), 0) / (edits.length || 1)
      };
    }

    let summary = null;
    if (generateSummary) {
      // Generate task summary
      const notifications = await this.memory.search(`task/${taskId}/notification/*`, 'hooks');
      summary = {
        description: taskData.description,
        startTime: taskData.startTime,
        endTime,
        duration,
        notificationsCount: notifications.length,
        keyDecisions: notifications.map(n => n.value.message).slice(0, 5)
      };
      
      // Store summary for future reference
      await this.memory.store(
        `task/${taskId}/summary`,
        summary,
        'hooks'
      );
    }

    return {
      taskId,
      duration,
      performance,
      summary
    };
  }

  /**
   * Pre-edit hook - executed before editing a file
   */
  async preEditHook(options) {
    const { file, autoAssignAgent = true } = options;
    
    let assignedAgent = null;
    if (autoAssignAgent) {
      // Determine best agent type for this file
      assignedAgent = this.getAgentForFile(file);
    }

    // Store pre-edit state
    await this.memory.store(
      `edit/${Date.now()}/pre`,
      {
        file,
        assignedAgent,
        timestamp: Date.now()
      },
      'hooks'
    );

    return {
      file,
      assignedAgent,
      suggestions: this.getEditSuggestions(file)
    };
  }

  /**
   * Post-edit hook - executed after editing a file
   */
  async postEditHook(options) {
    const {
      file,
      memoryKey,
      autoFormat = true,
      trackChanges = true
    } = options;

    const editId = `edit-${Date.now()}`;
    
    // Store edit record
    const editRecord = {
      file,
      timestamp: Date.now(),
      memoryKey
    };

    if (trackChanges) {
      // Track file changes (would need file content comparison in real implementation)
      editRecord.changes = 'tracked';
    }

    await this.memory.store(
      `edit/${editId}`,
      editRecord,
      'hooks'
    );

    // Store in specified memory key if provided
    if (memoryKey) {
      await this.memory.store(
        memoryKey,
        {
          file,
          editedAt: Date.now(),
          editId
        }
      );
    }

    // Auto-format if requested
    let formatted = false;
    if (autoFormat) {
      formatted = await this.autoFormatFile(file);
    }

    return {
      editId,
      file,
      formatted,
      memoryKey
    };
  }

  /**
   * Notification hook - for storing decisions and messages
   */
  async notificationHook(options) {
    const {
      message,
      telemetry = true,
      category = 'general'
    } = options;

    const notificationId = `notification-${Date.now()}`;
    
    const notification = {
      message,
      category,
      timestamp: Date.now()
    };

    // Store notification
    await this.memory.store(
      `notification/${notificationId}`,
      notification,
      'hooks'
    );

    // Track telemetry if enabled
    if (telemetry && this.sessionId) {
      await this.memory.store(
        `session/${this.sessionId}/notifications/${notificationId}`,
        notification,
        'telemetry'
      );
    }

    return {
      notificationId,
      stored: true,
      telemetryTracked: telemetry
    };
  }

  /**
   * Pre-search hook - executed before searching
   */
  async preSearchHook(options) {
    const {
      query,
      cacheResults = true,
      suggestOptimizations = true
    } = options;

    // Check cache
    let cached = null;
    if (cacheResults) {
      cached = await this.memory.retrieve(
        `search-cache/${Buffer.from(query).toString('base64')}`,
        'cache'
      );
    }

    // Suggest query optimizations
    let optimizations = null;
    if (suggestOptimizations) {
      optimizations = this.suggestSearchOptimizations(query);
    }

    return {
      query,
      cached,
      optimizations,
      fromCache: cached !== null
    };
  }

  /**
   * Session start hook
   */
  async sessionStartHook(options) {
    const { sessionName } = options;
    
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await this.memory.store(
      `session/${this.sessionId}/info`,
      {
        name: sessionName || 'Unnamed Session',
        startTime: Date.now(),
        options
      },
      'sessions'
    );

    return {
      sessionId: this.sessionId,
      started: true
    };
  }

  /**
   * Session end hook
   */
  async sessionEndHook(options) {
    const {
      exportMetrics = true,
      generateSummary = true
    } = options;

    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const sessionInfo = await this.memory.retrieve(
      `session/${this.sessionId}/info`,
      'sessions'
    );

    const endTime = Date.now();
    const duration = endTime - sessionInfo.startTime;

    let metrics = null;
    if (exportMetrics) {
      // Collect session metrics
      const notifications = await this.memory.search(
        `session/${this.sessionId}/notifications/*`,
        'telemetry'
      );
      
      metrics = {
        duration,
        notificationsCount: notifications.length,
        startTime: sessionInfo.startTime,
        endTime
      };
    }

    let summary = null;
    if (generateSummary) {
      summary = {
        sessionId: this.sessionId,
        name: sessionInfo.name,
        duration,
        metrics
      };
      
      // Store summary
      await this.memory.store(
        `session/${this.sessionId}/summary`,
        summary,
        'sessions'
      );
    }

    // Clear session ID
    this.sessionId = null;

    return {
      sessionId: this.sessionId,
      duration,
      metrics,
      summary
    };
  }

  /**
   * Session restore hook
   */
  async sessionRestoreHook(options) {
    const {
      sessionId,
      loadMemory = true
    } = options;

    const sessionInfo = await this.memory.retrieve(
      `session/${sessionId}/info`,
      'sessions'
    );

    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.sessionId = sessionId;

    let memoryData = null;
    if (loadMemory) {
      // Load session memory
      const summary = await this.memory.retrieve(
        `session/${sessionId}/summary`,
        'sessions'
      );
      
      memoryData = {
        info: sessionInfo,
        summary
      };
    }

    return {
      sessionId,
      restored: true,
      sessionInfo,
      memoryData
    };
  }

  /**
   * Helper: Suggest agents for a task
   */
  suggestAgentsForTask(description) {
    const suggestions = [];
    const desc = description.toLowerCase();

    if (desc.includes('api') || desc.includes('endpoint') || desc.includes('backend')) {
      suggestions.push({ type: 'coder', focus: 'backend' });
    }
    
    if (desc.includes('frontend') || desc.includes('ui') || desc.includes('component')) {
      suggestions.push({ type: 'coder', focus: 'frontend' });
    }
    
    if (desc.includes('database') || desc.includes('schema') || desc.includes('model')) {
      suggestions.push({ type: 'analyst', focus: 'database' });
    }
    
    if (desc.includes('test') || desc.includes('quality') || desc.includes('bug')) {
      suggestions.push({ type: 'tester', focus: 'quality' });
    }
    
    if (desc.includes('research') || desc.includes('analyze') || desc.includes('investigate')) {
      suggestions.push({ type: 'researcher', focus: 'analysis' });
    }
    
    if (desc.includes('optimize') || desc.includes('performance') || desc.includes('speed')) {
      suggestions.push({ type: 'optimizer', focus: 'performance' });
    }

    // Always include a coordinator for complex tasks
    if (suggestions.length > 2) {
      suggestions.push({ type: 'coordinator', focus: 'orchestration' });
    }

    return suggestions;
  }

  /**
   * Helper: Get appropriate agent for a file type
   */
  getAgentForFile(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    
    const agentMap = {
      // Backend
      'js': 'coder-backend',
      'ts': 'coder-backend',
      'py': 'coder-backend',
      'java': 'coder-backend',
      'go': 'coder-backend',
      'rs': 'coder-backend',
      
      // Frontend
      'jsx': 'coder-frontend',
      'tsx': 'coder-frontend',
      'vue': 'coder-frontend',
      'svelte': 'coder-frontend',
      'html': 'coder-frontend',
      'css': 'coder-frontend',
      'scss': 'coder-frontend',
      
      // Database
      'sql': 'analyst-database',
      'prisma': 'analyst-database',
      
      // Configuration
      'json': 'analyst-config',
      'yaml': 'analyst-config',
      'yml': 'analyst-config',
      'toml': 'analyst-config',
      
      // Documentation
      'md': 'researcher-docs',
      'txt': 'researcher-docs',
      'rst': 'researcher-docs',
      
      // Tests
      'test.js': 'tester',
      'spec.js': 'tester',
      'test.ts': 'tester',
      'spec.ts': 'tester'
    };

    // Check for test files
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return 'tester';
    }

    return agentMap[ext] || 'coder-general';
  }

  /**
   * Helper: Get edit suggestions for a file
   */
  getEditSuggestions(filePath) {
    const suggestions = [];
    const ext = filePath.split('.').pop().toLowerCase();

    // Language-specific suggestions
    if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
      suggestions.push('Consider using ESLint for code quality');
      suggestions.push('Check for unused imports');
    }
    
    if (['py'].includes(ext)) {
      suggestions.push('Consider using Black for formatting');
      suggestions.push('Check PEP 8 compliance');
    }

    // General suggestions
    suggestions.push('Ensure consistent indentation');
    suggestions.push('Add appropriate comments');
    suggestions.push('Check for potential security issues');

    return suggestions;
  }

  /**
   * Helper: Auto-format file (placeholder)
   */
  async autoFormatFile(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    
    try {
      // Language-specific formatters
      const formatters = {
        'js': 'prettier',
        'jsx': 'prettier',
        'ts': 'prettier',
        'tsx': 'prettier',
        'json': 'prettier',
        'css': 'prettier',
        'scss': 'prettier',
        'py': 'black',
        'go': 'gofmt',
        'rs': 'rustfmt'
      };

      const formatter = formatters[ext];
      if (formatter) {
        logger.info(`Would format ${filePath} with ${formatter}`);
        return true;
      }
    } catch (error) {
      logger.error(`Failed to format ${filePath}`, error);
    }

    return false;
  }

  /**
   * Helper: Suggest search optimizations
   */
  suggestSearchOptimizations(query) {
    const optimizations = [];

    // Check query length
    if (query.length < 3) {
      optimizations.push('Query too short - consider more specific terms');
    }

    // Suggest boolean operators
    if (!query.includes(' AND ') && !query.includes(' OR ')) {
      optimizations.push('Consider using AND/OR operators for better results');
    }

    // Suggest wildcards
    if (!query.includes('*') && !query.includes('?')) {
      optimizations.push('Consider using wildcards (* or ?) for flexible matching');
    }

    // Suggest quotes for exact phrases
    if (query.includes(' ') && !query.includes('"')) {
      optimizations.push('Use quotes for exact phrase matching');
    }

    return optimizations;
  }
}