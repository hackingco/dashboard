#!/usr/bin/env node

/**
 * Docker Swarm Agent with Enhanced Langfuse Integration
 * Containerized agent with real-time tracing and lessons learned
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration from environment
const config = {
  agentId: process.env.AGENT_ID || `agent-${Date.now()}`,
  agentType: process.env.AGENT_TYPE || 'general',
  coordinatorUrl: process.env.COORDINATOR_URL || 'http://swarm-coordinator:8000',
  langfuseHost: process.env.LANGFUSE_HOST || 'http://langfuse:3000',
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk_lf_demo',
  secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk_lf_demo',
  memoryPath: process.env.MEMORY_DB_PATH || '/app/data/memory.db',
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3')
};

console.log('🤖 DOCKER SWARM AGENT STARTING');
console.log('═══════════════════════════════');
console.log(`Agent ID: ${config.agentId}`);
console.log(`Agent Type: ${config.agentType}`);
console.log(`Coordinator: ${config.coordinatorUrl}`);
console.log(`Langfuse Host: ${config.langfuseHost}`);

// Initialize Langfuse wrapper with fallback
let LangfuseWrapper;
try {
  // Try to use real Langfuse if available
  const Langfuse = require('langfuse').Langfuse;
  const client = new Langfuse({
    publicKey: config.publicKey,
    secretKey: config.secretKey,
    baseUrl: config.langfuseHost,
    flushAt: 5,
    flushInterval: 3000
  });
  
  LangfuseWrapper = {
    isEnabled: () => true,
    preHook: async (context) => {
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const trace = client.trace({
        id: traceId,
        name: context.hookType,
        metadata: context.metadata
      });
      return traceId;
    },
    postHook: async (traceId, result, tokenUsage) => {
      if (traceId) {
        client.trace({ id: traceId, output: result });
        await client.flushAsync();
      }
    },
    errorHook: async (traceId, error) => {
      if (traceId) {
        client.trace({ id: traceId, output: { error: error.message } });
        await client.flushAsync();
      }
    },
    shutdown: async () => {
      await client.shutdownAsync();
    }
  };
  console.log('✅ Langfuse client initialized');
} catch (error) {
  console.log('⚠️  Using fallback wrapper (Langfuse not available):', error.message);
  LangfuseWrapper = {
    isEnabled: () => false,
    preHook: async () => null,
    postHook: async () => {},
    errorHook: async () => {},
    shutdown: async () => {}
  };
}

// Agent state
const agentState = {
  status: 'initializing',
  registeredAt: null,
  lastHeartbeat: null,
  tasksCompleted: 0,
  errors: 0,
  performance: {
    avgResponseTime: 0,
    totalResponseTime: 0,
    taskCount: 0
  },
  lessons: new Map(),
  observations: []
};

// Enhanced tracing and lessons learned
async function startTrace(context) {
  const traceId = await LangfuseWrapper.preHook({
    hookType: 'agent_operation',
    swarmId: context.swarmId,
    agentId: config.agentId,
    agentRole: config.agentType,
    operationType: context.operation,
    metadata: {
      containerized: true,
      dockerized: true,
      agentType: config.agentType,
      coordinatorUrl: config.coordinatorUrl,
      ...context.metadata
    }
  });

  return traceId;
}

async function addObservation(observation) {
  agentState.observations.push({
    timestamp: Date.now(),
    agentId: config.agentId,
    ...observation
  });

  // Keep only recent observations
  if (agentState.observations.length > 100) {
    agentState.observations = agentState.observations.slice(-50);
  }

  console.log(`📊 Observation: ${observation.type} - ${observation.details}`);
}

async function learnLesson(category, lesson, context, confidence = 0.8) {
  const lessonData = {
    category,
    lesson,
    context: JSON.stringify(context),
    confidence,
    timestamp: Date.now(),
    agentId: config.agentId,
    agentType: config.agentType
  };

  agentState.lessons.set(`${category}-${Date.now()}`, lessonData);
  console.log(`📚 Lesson learned [${category}]: ${lesson}`);

  // Store in local memory if available
  try {
    const { execSync } = require('child_process');
    if (fs.existsSync(config.memoryPath)) {
      execSync(`sqlite3 ${config.memoryPath} "CREATE TABLE IF NOT EXISTS agent_lessons (id INTEGER PRIMARY KEY, agent_id TEXT, category TEXT, lesson TEXT, context TEXT, confidence REAL, timestamp INTEGER)"`);
      execSync(`sqlite3 ${config.memoryPath} "INSERT INTO agent_lessons (agent_id, category, lesson, context, confidence, timestamp) VALUES ('${config.agentId}', '${category}', '${lesson.replace(/'/g, "''")}', '${lessonData.context}', ${confidence}, ${Date.now()})"`);
    }
  } catch (error) {
    console.warn('Failed to store lesson locally:', error.message);
  }
}

async function completeTrace(traceId, result, metrics) {
  if (traceId) {
    await LangfuseWrapper.postHook(
      traceId,
      result,
      {
        input: metrics?.inputTokens || 0,
        output: metrics?.outputTokens || 50,
        total: (metrics?.inputTokens || 0) + (metrics?.outputTokens || 50)
      },
      {
        agentType: config.agentType,
        containerized: true,
        observations: agentState.observations.slice(-10), // Recent observations
        lessonCount: agentState.lessons.size
      }
    );
  }
}

// HTTP client with retries
async function makeRequest(method, url, data = null, retries = config.maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        method,
        url,
        data,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `SwarmAgent/${config.agentId}`
        }
      });
      return response.data;
    } catch (error) {
      console.warn(`Attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

// Agent registration
async function registerAgent() {
  console.log('📝 Registering with coordinator...');
  
  const traceId = await startTrace({
    operation: 'agent_registration',
    metadata: { coordinatorUrl: config.coordinatorUrl }
  });

  try {
    const capabilities = getAgentCapabilities(config.agentType);
    const containerInfo = {
      hostname: require('os').hostname(),
      platform: require('os').platform(),
      arch: require('os').arch(),
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    const result = await makeRequest('POST', `${config.coordinatorUrl}/agent/register`, {
      agentId: config.agentId,
      agentType: config.agentType,
      capabilities,
      containerInfo
    });

    agentState.status = 'registered';
    agentState.registeredAt = Date.now();

    await addObservation({
      type: 'registration',
      details: 'Successfully registered with coordinator',
      success: true,
      capabilities
    });

    await learnLesson(
      'registration',
      `Agent type ${config.agentType} successfully registered with ${capabilities.length} capabilities`,
      { capabilities, containerInfo, coordinatorUrl: config.coordinatorUrl },
      0.9
    );

    await completeTrace(traceId, { 
      status: 'registered', 
      capabilities,
      swarmId: result.swarmId 
    });

    console.log(`✅ Registered successfully. Swarm ID: ${result.swarmId}`);
    return result.swarmId;

  } catch (error) {
    agentState.status = 'registration_failed';
    agentState.errors++;

    await addObservation({
      type: 'registration_error',
      details: `Registration failed: ${error.message}`,
      success: false,
      error: error.message
    });

    await LangfuseWrapper.errorHook(traceId, error, {
      operation: 'agent_registration',
      coordinatorUrl: config.coordinatorUrl
    });

    throw error;
  }
}

// Agent capabilities based on type
function getAgentCapabilities(agentType) {
  const capabilities = {
    researcher: ['data_analysis', 'pattern_recognition', 'information_synthesis', 'research_planning'],
    coder: ['code_implementation', 'debugging', 'optimization', 'testing', 'refactoring'],
    analyst: ['performance_analysis', 'requirements_analysis', 'bottleneck_detection', 'metrics_collection'],
    architect: ['system_design', 'scalability_planning', 'architecture_patterns', 'technology_selection'],
    tester: ['test_automation', 'quality_assurance', 'bug_detection', 'test_planning'],
    reviewer: ['code_review', 'security_audit', 'best_practices', 'quality_assessment'],
    coordinator: ['task_management', 'resource_allocation', 'progress_tracking', 'team_coordination'],
    monitor: ['system_monitoring', 'health_checks', 'alerting', 'performance_tracking'],
    general: ['task_execution', 'problem_solving', 'coordination', 'adaptability']
  };

  return capabilities[agentType] || capabilities.general;
}

// Task execution simulation
async function executeTask(taskData) {
  const startTime = Date.now();
  const traceId = await startTrace({
    operation: 'task_execution',
    metadata: { 
      taskId: taskData.id,
      priority: taskData.priority,
      taskType: taskData.task?.type || 'unknown'
    }
  });

  try {
    console.log(`📋 Executing task: ${taskData.id}`);

    await addObservation({
      type: 'task_start',
      details: `Started task ${taskData.id} with priority ${taskData.priority}`,
      taskId: taskData.id,
      priority: taskData.priority
    });

    // Simulate task execution based on type and priority
    const executionTime = calculateExecutionTime(config.agentType, taskData.priority);
    await simulateWork(executionTime);

    // Generate realistic result
    const result = generateTaskResult(config.agentType, taskData);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Update performance metrics
    agentState.performance.taskCount++;
    agentState.performance.totalResponseTime += duration;
    agentState.performance.avgResponseTime = agentState.performance.totalResponseTime / agentState.performance.taskCount;
    agentState.tasksCompleted++;

    await addObservation({
      type: 'task_completion',
      details: `Completed task ${taskData.id} in ${duration}ms`,
      taskId: taskData.id,
      duration,
      success: true
    });

    // Learn from execution patterns
    const performanceCategory = duration < 5000 ? 'fast_execution' : 
                               duration < 15000 ? 'normal_execution' : 'slow_execution';
    
    await learnLesson(
      performanceCategory,
      `Task ${taskData.task?.type || 'unknown'} took ${duration}ms with priority ${taskData.priority}`,
      { 
        taskType: taskData.task?.type,
        priority: taskData.priority,
        agentType: config.agentType,
        duration,
        executionTime
      },
      0.8
    );

    await completeTrace(traceId, result, {
      inputTokens: Math.ceil(JSON.stringify(taskData).length / 4),
      outputTokens: Math.ceil(JSON.stringify(result).length / 4),
      duration
    });

    // Report completion to coordinator
    await makeRequest('POST', `${config.coordinatorUrl}/task/complete`, {
      taskId: taskData.id,
      agentId: config.agentId,
      result,
      metrics: {
        duration,
        avgResponseTime: agentState.performance.avgResponseTime,
        errorRate: agentState.errors / (agentState.tasksCompleted + agentState.errors || 1)
      }
    });

    console.log(`✅ Task ${taskData.id} completed in ${duration}ms`);
    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    agentState.errors++;

    await addObservation({
      type: 'task_error',
      details: `Task ${taskData.id} failed: ${error.message}`,
      taskId: taskData.id,
      duration,
      success: false,
      error: error.message
    });

    await learnLesson(
      'task_failure',
      `Task execution failed for ${config.agentType} agent: ${error.message}`,
      { 
        taskId: taskData.id,
        agentType: config.agentType,
        error: error.message,
        duration
      },
      0.9
    );

    await LangfuseWrapper.errorHook(traceId, error, {
      taskId: taskData.id,
      agentType: config.agentType,
      duration
    });

    throw error;
  }
}

// Calculate realistic execution time
function calculateExecutionTime(agentType, priority) {
  const baseTimes = {
    researcher: 8000,   // Research takes time
    coder: 12000,       // Coding is complex
    analyst: 6000,      // Analysis is moderate
    architect: 15000,   // Architecture is complex
    tester: 10000,      // Testing is thorough
    reviewer: 7000,     // Review is careful
    coordinator: 3000,  // Coordination is quick
    monitor: 2000,      // Monitoring is fast
    general: 5000       // General purpose
  };

  const priorityMultipliers = {
    high: 0.7,    // High priority gets more resources
    medium: 1.0,  // Normal time
    low: 1.5      // Low priority gets less resources
  };

  const baseTime = baseTimes[agentType] || baseTimes.general;
  const multiplier = priorityMultipliers[priority] || 1.0;
  const randomFactor = 0.8 + (Math.random() * 0.4); // ±20% variance

  return Math.round(baseTime * multiplier * randomFactor);
}

// Simulate work with realistic progress
async function simulateWork(duration) {
  const steps = 5;
  const stepDuration = duration / steps;

  for (let i = 0; i < steps; i++) {
    await new Promise(resolve => setTimeout(resolve, stepDuration));
    
    await addObservation({
      type: 'task_progress',
      details: `Task progress: ${((i + 1) / steps * 100).toFixed(0)}%`,
      progress: (i + 1) / steps
    });
  }
}

// Generate realistic task results
function generateTaskResult(agentType, taskData) {
  const results = {
    researcher: {
      type: 'research_report',
      findings: [`Research finding for ${taskData.id}`, 'Data analysis complete', 'Patterns identified'],
      confidence: 0.85,
      sources: 3,
      recommendations: ['Implement optimization', 'Monitor performance']
    },
    coder: {
      type: 'code_implementation',
      status: 'completed',
      linesOfCode: Math.floor(Math.random() * 200) + 50,
      testsAdded: Math.floor(Math.random() * 10) + 2,
      coverage: 0.85 + (Math.random() * 0.1)
    },
    analyst: {
      type: 'analysis_report',
      metrics: {
        performance: 0.8 + (Math.random() * 0.15),
        efficiency: 0.75 + (Math.random() * 0.2),
        bottlenecks: Math.floor(Math.random() * 3)
      },
      recommendations: ['Optimize memory usage', 'Improve coordination']
    },
    architect: {
      type: 'design_specification',
      components: Math.floor(Math.random() * 5) + 3,
      scalability: 'high',
      patterns: ['microservices', 'event-driven', 'distributed'],
      complexity: 'moderate'
    },
    tester: {
      type: 'test_results',
      testsRun: Math.floor(Math.random() * 50) + 20,
      passed: Math.floor(Math.random() * 45) + 18,
      coverage: 0.8 + (Math.random() * 0.15),
      bugsFound: Math.floor(Math.random() * 3)
    },
    reviewer: {
      type: 'review_report',
      issues: Math.floor(Math.random() * 5),
      suggestions: Math.floor(Math.random() * 8) + 2,
      quality: 'good',
      securityScore: 0.9 + (Math.random() * 0.1)
    },
    coordinator: {
      type: 'coordination_summary',
      tasksManaged: Math.floor(Math.random() * 10) + 5,
      efficiency: 0.85 + (Math.random() * 0.1),
      conflicts: Math.floor(Math.random() * 2),
      recommendations: ['Improve task distribution']
    },
    monitor: {
      type: 'monitoring_report',
      alerts: Math.floor(Math.random() * 3),
      uptime: 0.99 + (Math.random() * 0.01),
      performance: 'optimal',
      issues: []
    }
  };

  const result = results[agentType] || {
    type: 'general_result',
    status: 'completed',
    output: `Task ${taskData.id} completed successfully`,
    quality: 0.8 + (Math.random() * 0.15)
  };

  return {
    ...result,
    taskId: taskData.id,
    agentId: config.agentId,
    agentType: config.agentType,
    completedAt: new Date().toISOString(),
    executionTime: Date.now()
  };
}

// Heartbeat with enhanced metrics
async function sendHeartbeat() {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    await makeRequest('POST', `${config.coordinatorUrl}/agent/heartbeat`, {
      agentId: config.agentId,
      status: agentState.status,
      metrics: {
        ...agentState.performance,
        tasksCompleted: agentState.tasksCompleted,
        errors: agentState.errors,
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        observations: agentState.observations.length,
        lessons: agentState.lessons.size
      }
    });

    agentState.lastHeartbeat = Date.now();
    
    await addObservation({
      type: 'heartbeat',
      details: 'Heartbeat sent successfully',
      uptime: process.uptime(),
      memory: memoryUsage.heapUsed
    });

  } catch (error) {
    console.warn('Heartbeat failed:', error.message);
    agentState.errors++;

    await addObservation({
      type: 'heartbeat_error',
      details: `Heartbeat failed: ${error.message}`,
      error: error.message
    });
  }
}

// Task polling (simplified - in real implementation would use WebSocket or queue)
async function pollForTasks() {
  try {
    // This is a simulation - real implementation would have proper task queue
    if (Math.random() < 0.3) { // 30% chance of having a task
      const taskData = {
        id: `task-${Date.now()}`,
        task: {
          type: config.agentType,
          description: `Sample task for ${config.agentType} agent`
        },
        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        assignedAt: Date.now()
      };

      await executeTask(taskData);
    }
  } catch (error) {
    console.warn('Task execution failed:', error.message);
  }
}

// Main agent loop
async function runAgent() {
  try {
    // Register with coordinator
    const swarmId = await registerAgent();
    console.log(`🚀 Agent operational in swarm ${swarmId}`);

    // Start heartbeat
    const heartbeatTimer = setInterval(sendHeartbeat, config.heartbeatInterval);

    // Start task polling (in real implementation, would listen for assignments)
    const taskTimer = setInterval(pollForTasks, 10000); // Check every 10 seconds

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down agent...');
      
      clearInterval(heartbeatTimer);
      clearInterval(taskTimer);
      
      agentState.status = 'shutting_down';
      await sendHeartbeat();
      
      await LangfuseWrapper.shutdown();
      process.exit(0);
    });

    // Keep alive
    process.on('SIGINT', async () => {
      console.log('🛑 Interrupted, shutting down...');
      process.emit('SIGTERM');
    });

    console.log('⚡ Agent ready for tasks...');

  } catch (error) {
    console.error('❌ Agent startup failed:', error);
    process.exit(1);
  }
}

// Start the agent
runAgent().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});