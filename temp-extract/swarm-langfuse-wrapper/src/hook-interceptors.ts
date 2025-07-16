/**
 * Hook Interceptors for Claude Flow
 * Implements pre and post hook interceptors with comprehensive tracing
 */

import { hookTracer, HookMetadata } from './hook-tracer';
// import { enhanceHook } from './hook-enhancer';
import * as winston from 'winston';

// Create a simple logger if the complex path doesn't exist
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface HookInterceptor {
  before?: (args: any[], metadata: HookMetadata) => Promise<void>;
  after?: (result: any, args: any[], metadata: HookMetadata) => Promise<void>;
  onError?: (error: Error, args: any[], metadata: HookMetadata) => Promise<void>;
}

/**
 * Pre-task hook interceptor
 */
export const preTaskInterceptor: HookInterceptor = {
  before: async (args, metadata) => {
    const [options] = args;
    metadata.taskId = options?.taskId || options?.task_id;
    metadata.taskDescription = options?.description;
    metadata.autoSpawnAgents = options?.autoSpawnAgents;
    
    logger.info('Pre-task hook starting', {
      taskId: metadata.taskId,
      description: metadata.taskDescription
    });

    // Load previous context if requested
    if (options?.loadPreviousContext) {
      try {
        const { stdout } = await execAsync(
          `npx claude-flow@alpha memory usage --action retrieve --key "task/${metadata.taskId}/context"`
        );
        metadata.previousContext = stdout;
      } catch (error) {
        logger.debug('No previous context found for task');
      }
    }
  },

  after: async (_result, _args, metadata) => {
    logger.info('Pre-task hook completed', {
      taskId: metadata.taskId
    });

    // Store task initialization data
    if (metadata.taskId) {
      await execAsync(
        `npx claude-flow@alpha memory usage --action store --key "task/${metadata.taskId}/init" --value '${JSON.stringify({
          description: metadata.taskDescription,
          startTime: Date.now(),
          autoSpawnAgents: metadata.autoSpawnAgents
        })}'`
      );
    }
  }
};

/**
 * Pre-search hook interceptor
 */
export const preSearchInterceptor: HookInterceptor = {
  before: async (args, metadata) => {
    const [options] = args;
    metadata.query = options?.query;
    metadata.cacheResults = options?.cacheResults;
    metadata.suggestOptimizations = options?.suggestOptimizations;
    
    logger.info('Pre-search hook starting', {
      query: metadata.query,
      cacheResults: metadata.cacheResults
    });

    // Check cache if enabled
    if (metadata.cacheResults) {
      try {
        const cacheKey = `search/cache/${Buffer.from(metadata.query || '').toString('base64')}`;
        const { stdout } = await execAsync(
          `npx claude-flow@alpha memory usage --action retrieve --key "${cacheKey}"`
        );
        if (stdout && stdout !== 'null') {
          metadata.cachedResult = JSON.parse(stdout);
          logger.info('Found cached search result');
        }
      } catch (error) {
        logger.debug('No cached result found');
      }
    }
  },

  after: async (_result, _args, metadata) => {
    logger.info('Pre-search hook completed', {
      query: metadata.query,
      foundCache: !!metadata.cachedResult
    });

    // Cache the result if enabled
    // Cache disabled for now
    if (false && metadata.cacheResults && !metadata.cachedResult) {
      const cacheKey = `search/cache/${Buffer.from(metadata.query || '').toString('base64')}`;
      await execAsync(
        `npx claude-flow@alpha memory usage --action store --key "${cacheKey}" --value '${JSON.stringify({
          query: metadata.query,
          result: 'cached',
          cachedAt: Date.now()
        })}'`
      );
    }
  }
};

/**
 * Pre-edit hook interceptor
 */
export const preEditInterceptor: HookInterceptor = {
  before: async (args, metadata) => {
    const [options] = args;
    metadata.file = options?.file;
    metadata.autoAssignAgent = options?.autoAssignAgent;
    
    logger.info('Pre-edit hook starting', {
      file: metadata.file,
      autoAssignAgent: metadata.autoAssignAgent
    });

    // Validate file exists
    if (metadata.file) {
      try {
        await fs.access(metadata.file);
        const stats = await fs.stat(metadata.file);
        metadata.fileSize = stats.size;
        metadata.fileModified = stats.mtime.toISOString();
      } catch (error) {
        throw new Error(`File not found: ${metadata.file}`);
      }
    }

    // Auto-assign agent based on file type
    if (metadata.autoAssignAgent && metadata.file) {
      const ext = path.extname(metadata.file);
      const fileTypeAgents: Record<string, string> = {
        '.ts': 'typescript-specialist',
        '.js': 'javascript-developer',
        '.py': 'python-expert',
        '.md': 'documentation-writer',
        '.yml': 'devops-engineer',
        '.yaml': 'devops-engineer',
        '.json': 'configuration-manager'
      };
      
      metadata.assignedAgent = fileTypeAgents[ext] || 'general-coder';
      logger.info(`Auto-assigned agent: ${metadata.assignedAgent}`);
    }
  },

  after: async (_result, _args, metadata) => {
    logger.info('Pre-edit hook completed', {
      file: metadata.file,
      assignedAgent: metadata.assignedAgent
    });
  }
};

/**
 * Post-task hook interceptor
 */
export const postTaskInterceptor: HookInterceptor = {
  before: async (args, metadata) => {
    const [options] = args;
    metadata.taskId = options?.taskId || options?.task_id;
    metadata.analyzePerformance = options?.analyzePerformance;
    metadata.generateSummary = options?.generateSummary;
    
    logger.info('Post-task hook starting', {
      taskId: metadata.taskId,
      analyzePerformance: metadata.analyzePerformance
    });

    // Retrieve task start time
    if (metadata.taskId) {
      try {
        const { stdout } = await execAsync(
          `npx claude-flow@alpha memory usage --action retrieve --key "task/${metadata.taskId}/init"`
        );
        if (stdout && stdout !== 'null') {
          const initData = JSON.parse(stdout);
          metadata.taskStartTime = initData.startTime;
          metadata.taskDuration = Date.now() - initData.startTime;
        }
      } catch (error) {
        logger.debug('No task init data found');
      }
    }
  },

  after: async (_result, _args, metadata) => {
    logger.info('Post-task hook completed', {
      taskId: metadata.taskId,
      duration: metadata.taskDuration
    });

    // Store task completion data
    if (metadata.taskId) {
      const completionData = {
        completedAt: Date.now(),
        duration: metadata.taskDuration,
        performance: metadata.analyzePerformance ? await analyzeTaskPerformance(metadata.taskId) : null,
        summary: metadata.generateSummary ? await generateTaskSummary(metadata.taskId) : null
      };

      await execAsync(
        `npx claude-flow@alpha memory usage --action store --key "task/${metadata.taskId}/completion" --value '${JSON.stringify(completionData)}'`
      );
    }
  }
};

/**
 * Post-edit hook interceptor
 */
export const postEditInterceptor: HookInterceptor = {
  before: async (args, metadata) => {
    const [options] = args;
    metadata.file = options?.file;
    metadata.memoryKey = options?.memoryKey;
    metadata.autoFormat = options?.autoFormat;
    metadata.trackChanges = options?.trackChanges;
    
    logger.info('Post-edit hook starting', {
      file: metadata.file,
      memoryKey: metadata.memoryKey
    });

    // Get file content before formatting
    if (metadata.trackChanges && metadata.file) {
      try {
        metadata.originalContent = await fs.readFile(metadata.file, 'utf-8');
      } catch (error) {
        logger.warn('Could not read file for change tracking');
      }
    }
  },

  after: async (_result, _args, metadata) => {
    logger.info('Post-edit hook completed', {
      file: metadata.file,
      formatted: metadata.autoFormat
    });

    // Auto-format if requested
    if (metadata.autoFormat && metadata.file) {
      await autoFormatFile(metadata.file);
    }

    // Track changes if requested
    if (metadata.trackChanges && metadata.file && metadata.originalContent) {
      const newContent = await fs.readFile(metadata.file, 'utf-8');
      const changes = {
        file: metadata.file,
        originalSize: metadata.originalContent.length,
        newSize: newContent.length,
        sizeDelta: newContent.length - metadata.originalContent.length,
        editedAt: Date.now()
      };

      await execAsync(
        `npx claude-flow@alpha memory usage --action store --key "edits/${metadata.file.replace(/\//g, '_')}" --value '${JSON.stringify(changes)}'`
      );
    }

    // Store in custom memory key if provided
    if (metadata.memoryKey) {
      await execAsync(
        `npx claude-flow@alpha memory usage --action store --key "${metadata.memoryKey}" --value '${JSON.stringify({
          file: metadata.file,
          editedAt: Date.now(),
          formatted: metadata.autoFormat
        })}'`
      );
    }
  }
};

/**
 * Session-end hook interceptor
 */
export const sessionEndInterceptor: HookInterceptor = {
  before: async (args, metadata) => {
    const [options] = args;
    metadata.sessionId = options?.sessionId || options?.session_id;
    metadata.exportMetrics = options?.exportMetrics;
    metadata.generateSummary = options?.generateSummary;
    
    logger.info('Session-end hook starting', {
      sessionId: metadata.sessionId,
      exportMetrics: metadata.exportMetrics
    });
  },

  after: async (_result, _args, metadata) => {
    logger.info('Session-end hook completed', {
      sessionId: metadata.sessionId
    });

    // Export session traces
    if (metadata.sessionId) {
      const traces = hookTracer.exportTraces(metadata.sessionId);
      const exportPath = `.swarm/sessions/${metadata.sessionId}-traces.json`;
      
      await fs.mkdir(path.dirname(exportPath), { recursive: true });
      await fs.writeFile(exportPath, JSON.stringify(traces, null, 2));
      
      logger.info(`Exported session traces to ${exportPath}`);
    }

    // Generate session summary
    if (metadata.generateSummary && metadata.sessionId) {
      const summary = await generateSessionSummary(metadata.sessionId);
      await execAsync(
        `npx claude-flow@alpha memory usage --action store --key "session/${metadata.sessionId}/summary" --value '${JSON.stringify(summary)}'`
      );
    }
  }
};

/**
 * Helper function to analyze task performance
 */
async function analyzeTaskPerformance(taskId: string): Promise<any> {
  const metrics = hookTracer.getHookMetrics();
  const taskTraces = Array.from(hookTracer['traces'].values())
    .filter(t => t.metadata.taskId === taskId);

  return {
    totalHooks: taskTraces.length,
    avgHookDuration: metrics.avgDuration,
    totalDuration: taskTraces.reduce((sum, t) => sum + (t.duration || 0), 0),
    errorCount: taskTraces.filter(t => t.error).length,
    hookTypes: taskTraces.reduce((acc, t) => {
      acc[t.hookType] = (acc[t.hookType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}

/**
 * Helper function to generate task summary
 */
async function generateTaskSummary(taskId: string): Promise<any> {
  const performance = await analyzeTaskPerformance(taskId);
  
  return {
    taskId,
    summary: `Task ${taskId} completed with ${performance.totalHooks} hooks executed`,
    performance,
    generatedAt: Date.now()
  };
}

/**
 * Helper function to generate session summary
 */
async function generateSessionSummary(sessionId: string): Promise<any> {
  const traces = hookTracer.getSessionTraces(sessionId);
  const metrics = hookTracer.getHookMetrics();
  
  return {
    sessionId,
    totalHooks: traces.length,
    uniqueHookTypes: new Set(traces.map(t => t.hookType)).size,
    totalDuration: traces.reduce((sum, t) => sum + (t.duration || 0), 0),
    avgHookDuration: metrics.avgDuration,
    errorCount: traces.filter(t => t.error).length,
    generatedAt: Date.now()
  };
}

/**
 * Helper function to auto-format files
 */
async function autoFormatFile(filePath: string): Promise<void> {
  const ext = path.extname(filePath);
  
  try {
    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        await execAsync(`npx prettier --write "${filePath}"`);
        break;
      case '.py':
        await execAsync(`black "${filePath}" 2>/dev/null || true`);
        break;
      case '.go':
        await execAsync(`gofmt -w "${filePath}" 2>/dev/null || true`);
        break;
      case '.rs':
        await execAsync(`rustfmt "${filePath}" 2>/dev/null || true`);
        break;
      default:
        logger.debug(`No formatter configured for ${ext} files`);
    }
  } catch (error) {
    logger.warn(`Failed to format file: ${filePath}`, error);
  }
}

/**
 * Register all interceptors
 */
export function registerHookInterceptors(): void {
  const interceptors: Record<string, HookInterceptor> = {
    'pre-task': preTaskInterceptor,
    'pre-search': preSearchInterceptor,
    'pre-edit': preEditInterceptor,
    'post-task': postTaskInterceptor,
    'post-edit': postEditInterceptor,
    'session-end': sessionEndInterceptor
  };

  for (const [hookType, _interceptor] of Object.entries(interceptors)) {
    logger.info(`Registering interceptor for ${hookType} hook`);
  }

  return interceptors as any;
}