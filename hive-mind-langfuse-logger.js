/**
 * Hive Mind Swarm Langfuse Logger
 * Comprehensive logging system for swarm ID: swarm_1752502984551_ne7n7cr24
 * Session ID: hive-mind-collective-1752503124
 */

const { Langfuse } = require('langfuse');
const { EventEmitter } = require('events');

class HiveMindSwarmLogger extends EventEmitter {
  constructor(swarmId, sessionId, config) {
    super();
    
    this.swarmId = swarmId;
    this.sessionId = sessionId;
    this.config = config;
    this.activeAgents = new Map();
    this.metrics = {
      totalTraces: 0,
      totalSpans: 0,
      totalErrors: 0,
      totalTokens: 0,
      totalCost: 0,
      startTime: Date.now()
    };
    
    // Initialize Langfuse client
    this.langfuse = new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.host,
      flushAt: config.batchSize || 50,
      flushInterval: config.flushInterval || 3000,
      requestTimeout: 30000,
      maxRetries: 3,
      debug: config.debug || false
    });
    
    // Batch tracer for efficient bulk operations
    this.batchQueue = [];
    this.batchTimer = null;
    this.maxBatchSize = config.batchSize || 50;
    this.batchFlushInterval = config.flushInterval || 3000;
    
    // Real-time metrics collection
    this.metricsInterval = null;
    this.startMetricsCollection();
    
    console.log(`🐝 Hive Mind Swarm Logger initialized for ${swarmId}`);
    console.log(`📊 Session: ${sessionId}`);
    console.log(`🔧 Config: ClickHouse=${!!config.clickhouseUrl}, Redis=${!!config.redisHost}, Batch=${config.batchSize}`);
  }
  
  // Initialize swarm logging
  async initializeSwarmLogging() {
    try {
      const initTrace = this.langfuse.trace({
        id: `${this.swarmId}-init-${Date.now()}`,
        name: '🐝 Hive Mind Swarm Initialization',
        sessionId: this.sessionId,
        userId: 'hive-mind-collective',
        input: {
          swarmId: this.swarmId,
          sessionId: this.sessionId,
          initializationTime: new Date().toISOString(),
          config: {
            clickhouseEnabled: !!this.config.clickhouseUrl,
            redisEnabled: !!this.config.redisHost,
            batchSize: this.config.batchSize,
            flushInterval: this.config.flushInterval,
            v3Enabled: this.config.v3Enabled
          }
        },
        metadata: {
          swarmId: this.swarmId,
          sessionId: this.sessionId,
          loggerType: 'hive-mind-collective',
          environment: process.env.NODE_ENV || 'development',
          claudeFlowVersion: '2.0.0',
          langfuseVersion: '3.0.0',
          features: {
            clickhouseAnalytics: !!this.config.clickhouseUrl,
            redisQueuing: !!this.config.redisHost,
            batchProcessing: true,
            realTimeMetrics: true,
            errorTracking: true
          }
        },
        tags: ['swarm', 'initialization', 'hive-mind', 'collective'],
        level: 'INFO'
      });
      
      await this.langfuse.flushAsync();
      this.metrics.totalTraces++;
      
      this.emit('swarm_initialized', {
        swarmId: this.swarmId,
        sessionId: this.sessionId,
        traceId: initTrace.id
      });
      
      console.log('✅ Hive Mind Swarm logging initialized successfully');
      return initTrace.id;
      
    } catch (error) {
      console.error('❌ Failed to initialize swarm logging:', error);
      await this.logError(null, error, 'swarm_initialization');
      throw error;
    }
  }
  
  // Log agent spawning with enhanced metadata
  async logAgentSpawn(agentId, agentName, agentType, capabilities = []) {
    try {
      const spawnTime = Date.now();
      const agentData = {
        id: agentId,
        name: agentName,
        type: agentType,
        capabilities,
        spawnTime,
        status: 'active',
        tasksCompleted: 0,
        totalLatency: 0,
        averageLatency: 0
      };
      
      this.activeAgents.set(agentId, agentData);
      
      const spawnTrace = this.langfuse.trace({
        id: `${this.swarmId}-agent-spawn-${agentId}-${spawnTime}`,
        name: `🤖 Agent Spawn: ${agentName}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          agentId,
          agentName,
          agentType,
          capabilities,
          spawnCommand: `Spawning ${agentType} agent with capabilities: ${capabilities.join(', ')}`
        },
        output: {
          status: 'spawned',
          agentId,
          spawnTime: new Date(spawnTime).toISOString(),
          assignedCapabilities: capabilities
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          agentName,
          agentType,
          capabilities,
          spawnTimestamp: new Date(spawnTime).toISOString(),
          activeAgentCount: this.activeAgents.size,
          agentSequenceNumber: this.activeAgents.size
        },
        tags: ['agent', 'spawn', agentType, 'hive-mind'],
        level: 'INFO'
      });
      
      // Create a span for agent lifecycle
      const lifecycleSpan = spawnTrace.span({
        name: `Agent Lifecycle: ${agentName}`,
        input: { phase: 'spawned' },
        metadata: {
          agentId,
          agentName,
          agentType,
          phase: 'spawned'
        }
      });
      
      // Store span for later updates
      agentData.lifecycleSpan = lifecycleSpan;
      this.activeAgents.set(agentId, agentData);
      
      await this.batchTrace(spawnTrace);
      this.metrics.totalSpans++;
      
      this.emit('agent_spawned', {
        swarmId: this.swarmId,
        agentId,
        agentName,
        agentType,
        capabilities
      });
      
      console.log(`🤖 Agent spawned: ${agentName} (${agentType}) - ${capabilities.join(', ')}`);
      return spawnTrace.id;
      
    } catch (error) {
      console.error(`❌ Failed to log agent spawn for ${agentId}:`, error);
      await this.logError(agentId, error, 'agent_spawn');
      return null;
    }
  }
  
  // Log agent task assignment
  async logAgentTask(agentId, taskDescription, priority = 'medium', taskId = null) {
    try {
      const agent = this.activeAgents.get(agentId);
      if (!agent) {
        console.warn(`⚠️ Agent ${agentId} not found in active agents`);
        return null;
      }
      
      const taskStartTime = Date.now();
      const finalTaskId = taskId || `${agentId}-task-${taskStartTime}`;
      
      const taskTrace = this.langfuse.trace({
        id: `${this.swarmId}-task-${finalTaskId}`,
        name: `📋 Task Assignment: ${agent.name}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          taskId: finalTaskId,
          taskDescription,
          priority,
          agentId,
          agentName: agent.name,
          agentType: agent.type,
          assignmentTime: new Date(taskStartTime).toISOString()
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          agentName: agent.name,
          agentType: agent.type,
          taskId: finalTaskId,
          taskDescription,
          priority,
          taskStartTime: new Date(taskStartTime).toISOString(),
          expectedDuration: this.estimateTaskDuration(taskDescription, priority)
        },
        tags: ['task', 'assignment', priority, agent.type],
        level: 'INFO'
      });
      
      // Create task execution span
      const executionSpan = taskTrace.span({
        name: 'Task Execution',
        input: {
          task: taskDescription,
          priority,
          startTime: new Date(taskStartTime).toISOString()
        },
        metadata: {
          taskId: finalTaskId,
          agentId,
          agentName: agent.name,
          phase: 'executing'
        }
      });
      
      // Store task info for completion tracking
      agent.currentTask = {
        id: finalTaskId,
        description: taskDescription,
        priority,
        startTime: taskStartTime,
        trace: taskTrace,
        span: executionSpan
      };
      
      this.activeAgents.set(agentId, agent);
      
      await this.batchTrace(taskTrace);
      this.metrics.totalSpans++;
      
      this.emit('task_assigned', {
        swarmId: this.swarmId,
        agentId,
        taskId: finalTaskId,
        taskDescription,
        priority
      });
      
      console.log(`📋 Task assigned to ${agent.name}: ${taskDescription} (${priority})`);
      return finalTaskId;
      
    } catch (error) {
      console.error(`❌ Failed to log task assignment for ${agentId}:`, error);
      await this.logError(agentId, error, 'task_assignment');
      return null;
    }
  }
  
  // Log task completion
  async logTaskCompletion(agentId, taskId, result, success = true) {
    try {
      const agent = this.activeAgents.get(agentId);
      if (!agent || !agent.currentTask) {
        console.warn(`⚠️ No current task found for agent ${agentId}`);
        return;
      }
      
      const completionTime = Date.now();
      const duration = completionTime - agent.currentTask.startTime;
      
      // End the execution span
      if (agent.currentTask.span) {
        agent.currentTask.span.end({
          output: {
            result,
            success,
            duration,
            completionTime: new Date(completionTime).toISOString()
          },
          metadata: {
            taskId,
            agentId,
            success,
            duration,
            completionTime: new Date(completionTime).toISOString()
          }
        });
      }
      
      // Update agent metrics
      agent.tasksCompleted++;
      agent.totalLatency += duration;
      agent.averageLatency = agent.totalLatency / agent.tasksCompleted;
      
      // Clear current task
      agent.currentTask = null;
      this.activeAgents.set(agentId, agent);
      
      // Log completion trace
      const completionTrace = this.langfuse.trace({
        id: `${this.swarmId}-completion-${taskId}`,
        name: `✅ Task Completion: ${agent.name}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          taskId,
          agentId,
          agentName: agent.name
        },
        output: {
          result,
          success,
          duration,
          completionTime: new Date(completionTime).toISOString()
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          agentName: agent.name,
          taskId,
          success,
          duration,
          completionTime: new Date(completionTime).toISOString(),
          agentTasksCompleted: agent.tasksCompleted,
          agentAverageLatency: agent.averageLatency
        },
        tags: ['task', 'completion', success ? 'success' : 'failure', agent.type],
        level: success ? 'INFO' : 'ERROR'
      });
      
      await this.batchTrace(completionTrace);
      
      this.emit('task_completed', {
        swarmId: this.swarmId,
        agentId,
        taskId,
        success,
        duration,
        result
      });
      
      console.log(`✅ Task completed by ${agent.name}: ${taskId} (${duration}ms)`);
      
    } catch (error) {
      console.error(`❌ Failed to log task completion for ${agentId}:`, error);
      await this.logError(agentId, error, 'task_completion');
    }
  }
  
  // Log swarm coordination events
  async logSwarmCoordination(event, participants = [], data = {}) {
    try {
      const coordinationTrace = this.langfuse.trace({
        id: `${this.swarmId}-coordination-${Date.now()}`,
        name: `🤝 Swarm Coordination: ${event}`,
        sessionId: this.sessionId,
        userId: 'hive-mind-coordinator',
        input: {
          event,
          participants,
          data,
          timestamp: new Date().toISOString()
        },
        output: {
          coordinationEvent: event,
          participantCount: participants.length,
          coordinationData: data
        },
        metadata: {
          swarmId: this.swarmId,
          coordinationEvent: event,
          participants,
          participantCount: participants.length,
          activeAgents: this.activeAgents.size,
          coordinationTimestamp: new Date().toISOString(),
          ...data
        },
        tags: ['coordination', 'swarm', event, 'hive-mind'],
        level: 'INFO'
      });
      
      await this.batchTrace(coordinationTrace);
      
      this.emit('swarm_coordination', {
        swarmId: this.swarmId,
        event,
        participants,
        data
      });
      
      console.log(`🤝 Swarm coordination: ${event} (${participants.length} participants)`);
      return coordinationTrace.id;
      
    } catch (error) {
      console.error(`❌ Failed to log swarm coordination:`, error);
      await this.logError(null, error, 'swarm_coordination');
      return null;
    }
  }
  
  // Log real-time metrics
  async logRealtimeMetrics(metricsData) {
    try {
      const metricsTrace = this.langfuse.trace({
        id: `${this.swarmId}-metrics-${Date.now()}`,
        name: '📊 Real-time Swarm Metrics',
        sessionId: this.sessionId,
        userId: 'metrics-collector',
        input: {
          metricsType: 'real-time',
          timestamp: new Date().toISOString()
        },
        output: metricsData,
        metadata: {
          swarmId: this.swarmId,
          metricsTimestamp: new Date().toISOString(),
          activeAgents: this.activeAgents.size,
          totalTraces: this.metrics.totalTraces,
          totalSpans: this.metrics.totalSpans,
          totalErrors: this.metrics.totalErrors,
          uptime: Date.now() - this.metrics.startTime,
          ...metricsData
        },
        tags: ['metrics', 'real-time', 'swarm', 'hive-mind'],
        level: 'INFO'
      });
      
      await this.batchTrace(metricsTrace);
      
      this.emit('metrics_updated', {
        swarmId: this.swarmId,
        metrics: metricsData
      });
      
    } catch (error) {
      console.error(`❌ Failed to log real-time metrics:`, error);
      await this.logError(null, error, 'metrics_logging');
    }
  }
  
  // Log errors with comprehensive context
  async logError(agentId, error, context = 'unknown') {
    try {
      const errorTrace = this.langfuse.trace({
        id: `${this.swarmId}-error-${Date.now()}`,
        name: `❌ Swarm Error: ${error.message}`,
        sessionId: this.sessionId,
        userId: agentId || 'swarm-system',
        input: {
          context,
          errorMessage: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString()
        },
        output: {
          errorType: error.name || 'Error',
          errorMessage: error.message,
          errorContext: context,
          affectedAgent: agentId
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          errorType: error.name || 'Error',
          errorMessage: error.message,
          errorStack: error.stack,
          errorContext: context,
          errorTimestamp: new Date().toISOString(),
          activeAgents: this.activeAgents.size,
          swarmUptime: Date.now() - this.metrics.startTime
        },
        tags: ['error', 'swarm', context, agentId ? 'agent-error' : 'system-error'],
        level: 'ERROR'
      });
      
      await this.langfuse.flushAsync(); // Immediate flush for errors
      this.metrics.totalErrors++;
      
      this.emit('error_logged', {
        swarmId: this.swarmId,
        agentId,
        error: error.message,
        context
      });
      
      console.error(`❌ Error logged: ${error.message} (${context})`);
      
    } catch (logError) {
      console.error(`❌ Failed to log error:`, logError);
    }
  }
  
  // Batch trace processing for performance
  async batchTrace(trace) {
    this.batchQueue.push(trace);
    this.metrics.totalTraces++;
    
    if (this.batchQueue.length >= this.maxBatchSize) {
      await this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), this.batchFlushInterval);
    }
  }
  
  // Flush batch queue
  async flushBatch() {
    if (this.batchQueue.length === 0) return;
    
    try {
      await this.langfuse.flushAsync();
      console.log(`📦 Flushed ${this.batchQueue.length} traces to Langfuse`);
      this.batchQueue = [];
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      
    } catch (error) {
      console.error('❌ Failed to flush batch:', error);
    }
  }
  
  // Start real-time metrics collection
  startMetricsCollection() {
    this.metricsInterval = setInterval(async () => {
      const currentTime = Date.now();
      const uptime = currentTime - this.metrics.startTime;
      
      const metricsData = {
        activeAgents: this.activeAgents.size,
        totalTraces: this.metrics.totalTraces,
        totalSpans: this.metrics.totalSpans,
        totalErrors: this.metrics.totalErrors,
        uptime,
        timestamp: new Date().toISOString(),
        avgLatency: this.calculateAverageLatency(),
        throughput: this.calculateThroughput(),
        errorRate: this.calculateErrorRate(),
        agentStatuses: this.getAgentStatuses()
      };
      
      await this.logRealtimeMetrics(metricsData);
    }, 10000); // Every 10 seconds
  }
  
  // Calculate average latency across all agents
  calculateAverageLatency() {
    let totalLatency = 0;
    let taskCount = 0;
    
    for (const agent of this.activeAgents.values()) {
      if (agent.tasksCompleted > 0) {
        totalLatency += agent.totalLatency;
        taskCount += agent.tasksCompleted;
      }
    }
    
    return taskCount > 0 ? totalLatency / taskCount : 0;
  }
  
  // Calculate throughput (tasks per minute)
  calculateThroughput() {
    const uptime = Date.now() - this.metrics.startTime;
    const totalTasks = Array.from(this.activeAgents.values()).reduce((sum, agent) => sum + agent.tasksCompleted, 0);
    const uptimeMinutes = uptime / (1000 * 60);
    
    return uptimeMinutes > 0 ? totalTasks / uptimeMinutes : 0;
  }
  
  // Calculate error rate
  calculateErrorRate() {
    const total = this.metrics.totalTraces;
    return total > 0 ? (this.metrics.totalErrors / total) * 100 : 0;
  }
  
  // Get agent statuses
  getAgentStatuses() {
    const statuses = {};
    for (const [agentId, agent] of this.activeAgents) {
      statuses[agentId] = {
        name: agent.name,
        type: agent.type,
        status: agent.status,
        tasksCompleted: agent.tasksCompleted,
        averageLatency: agent.averageLatency,
        hasCurrentTask: !!agent.currentTask
      };
    }
    return statuses;
  }
  
  // Estimate task duration based on description and priority
  estimateTaskDuration(description, priority) {
    const baseTime = 5000; // 5 seconds base
    const priorityMultiplier = { high: 0.8, medium: 1.0, low: 1.2 };
    const complexityMultiplier = description.length > 100 ? 1.5 : 1.0;
    
    return baseTime * (priorityMultiplier[priority] || 1.0) * complexityMultiplier;
  }
  
  // Test the logging system
  async testLogging() {
    console.log('🧪 Starting Langfuse logging test...');
    
    try {
      // Test swarm initialization
      await this.initializeSwarmLogging();
      
      // Test agent spawning
      await this.logAgentSpawn('test-agent-1', 'Test Agent 1', 'researcher', ['web-search', 'analysis']);
      await this.logAgentSpawn('test-agent-2', 'Test Agent 2', 'coder', ['javascript', 'python']);
      
      // Test task assignment
      const taskId1 = await this.logAgentTask('test-agent-1', 'Research AI trends', 'high');
      const taskId2 = await this.logAgentTask('test-agent-2', 'Implement authentication', 'medium');
      
      // Test coordination
      await this.logSwarmCoordination('load_balancing', ['test-agent-1', 'test-agent-2'], {
        balanceType: 'task-distribution',
        efficiency: 0.85
      });
      
      // Test task completion
      setTimeout(async () => {
        await this.logTaskCompletion('test-agent-1', taskId1, 'AI trends research completed', true);
        await this.logTaskCompletion('test-agent-2', taskId2, 'Authentication system implemented', true);
      }, 2000);
      
      // Test error logging
      setTimeout(async () => {
        await this.logError('test-agent-1', new Error('Test error for demonstration'), 'test_scenario');
      }, 3000);
      
      console.log('✅ Langfuse logging test completed successfully');
      
    } catch (error) {
      console.error('❌ Langfuse logging test failed:', error);
      throw error;
    }
  }
  
  // Get current metrics
  getCurrentMetrics() {
    return {
      swarmId: this.swarmId,
      sessionId: this.sessionId,
      activeAgents: this.activeAgents.size,
      totalTraces: this.metrics.totalTraces,
      totalSpans: this.metrics.totalSpans,
      totalErrors: this.metrics.totalErrors,
      uptime: Date.now() - this.metrics.startTime,
      avgLatency: this.calculateAverageLatency(),
      throughput: this.calculateThroughput(),
      errorRate: this.calculateErrorRate(),
      agentStatuses: this.getAgentStatuses()
    };
  }
  
  // Shutdown the logger
  async shutdown() {
    console.log('🛑 Shutting down Hive Mind Swarm Logger...');
    
    try {
      // Stop metrics collection
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      // Flush any remaining traces
      await this.flushBatch();
      
      // Log shutdown
      const shutdownTrace = this.langfuse.trace({
        id: `${this.swarmId}-shutdown-${Date.now()}`,
        name: '🛑 Hive Mind Swarm Shutdown',
        sessionId: this.sessionId,
        userId: 'hive-mind-system',
        input: {
          shutdownTime: new Date().toISOString(),
          finalMetrics: this.getCurrentMetrics()
        },
        output: {
          status: 'shutdown',
          finalActiveAgents: this.activeAgents.size,
          totalTracesProcessed: this.metrics.totalTraces,
          totalSpansProcessed: this.metrics.totalSpans,
          totalErrorsLogged: this.metrics.totalErrors,
          uptimeMs: Date.now() - this.metrics.startTime
        },
        metadata: {
          swarmId: this.swarmId,
          shutdownTimestamp: new Date().toISOString(),
          finalMetrics: this.getCurrentMetrics()
        },
        tags: ['shutdown', 'swarm', 'hive-mind'],
        level: 'INFO'
      });
      
      await this.langfuse.flushAsync();
      await this.langfuse.shutdownAsync();
      
      // Clear all listeners
      this.removeAllListeners();
      
      console.log('✅ Hive Mind Swarm Logger shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Factory function to create the hive mind logger
function createHiveMindLogger() {
  const config = {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-REDACTED',
    secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-cmd2y5m640009pw076fvuxp9s',
    host: process.env.LANGFUSE_HOST || 'http://localhost:3000',
    clickhouseUrl: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    redisHost: process.env.REDIS_HOST || 'localhost',
    batchSize: parseInt(process.env.CLAUDE_FLOW_BATCH_SIZE || '50'),
    flushInterval: parseInt(process.env.CLAUDE_FLOW_FLUSH_INTERVAL || '3000'),
    v3Enabled: process.env.LANGFUSE_V3_ENABLED === 'true',
    debug: process.env.CLAUDE_FLOW_DEBUG_MODE === 'true'
  };
  
  return new HiveMindSwarmLogger(
    'swarm_1752502984551_ne7n7cr24',
    'hive-mind-collective-1752503124',
    config
  );
}

module.exports = {
  HiveMindSwarmLogger,
  createHiveMindLogger
};

// If running directly, create and test the logger
if (require.main === module) {
  const logger = createHiveMindLogger();
  
  // Test the logger
  logger.testLogging().then(() => {
    console.log('🎉 Test completed successfully');
    
    // Display current metrics
    console.log('\n📊 Current Metrics:');
    console.log(JSON.stringify(logger.getCurrentMetrics(), null, 2));
    
    // Shutdown after 30 seconds
    setTimeout(() => {
      logger.shutdown().then(() => {
        process.exit(0);
      });
    }, 30000);
    
  }).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}