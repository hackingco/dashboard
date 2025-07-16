#!/usr/bin/env node

/**
 * Claude Flow Agent Worker
 * Runs as a Docker container with full Langfuse tracing
 */

import { Langfuse } from 'langfuse';
import Redis from 'redis';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

// Agent configuration from environment
const AGENT_ID = process.env.AGENT_ID || `agent-${Date.now()}`;
const AGENT_TYPE = process.env.AGENT_TYPE || 'general';
const COORDINATOR_URL = 'http://claude-flow-coordinator:8080';

// Initialize Langfuse for tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
  flushAt: 1,
  flushInterval: 1000
});

// Initialize Redis for task queue
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

await redis.connect();

// Create main agent trace
const agentTrace = langfuse.trace({
  name: `Claude Flow Agent: ${AGENT_TYPE}`,
  sessionId: `agent-${AGENT_ID}-${Date.now()}`,
  metadata: {
    agentId: AGENT_ID,
    agentType: AGENT_TYPE,
    container: process.env.HOSTNAME || 'unknown',
    environment: 'docker'
  }
});

// Agent capabilities based on type
const capabilities = {
  researcher: ['web_search', 'document_analysis', 'data_gathering'],
  coder: ['code_generation', 'code_review', 'debugging'],
  analyst: ['data_analysis', 'pattern_recognition', 'reporting'],
  tester: ['test_generation', 'test_execution', 'validation'],
  general: ['task_execution', 'coordination', 'reporting']
};

// Register with coordinator
async function registerAgent() {
  const registrationSpan = agentTrace.span({
    name: 'Agent Registration',
    input: { agentId: AGENT_ID, agentType: AGENT_TYPE }
  });
  
  try {
    const response = await fetch(`${COORDINATOR_URL}/agent/register`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Container-Id': process.env.HOSTNAME
      },
      body: JSON.stringify({
        agentId: AGENT_ID,
        agentType: AGENT_TYPE,
        capabilities: capabilities[AGENT_TYPE] || capabilities.general
      })
    });
    
    const result = await response.json();
    
    registrationSpan.end({
      output: { success: result.success }
    });
    
    console.log(`✅ Agent ${AGENT_ID} registered successfully`);
    return result;
  } catch (error) {
    registrationSpan.end({
      output: { error: error.message },
      level: 'ERROR'
    });
    throw error;
  }
}

// Update agent status
async function updateStatus(status, taskId = null, result = null) {
  await fetch(`${COORDINATOR_URL}/agent/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: AGENT_ID,
      status,
      taskId,
      result
    })
  });
}

// Execute task based on agent type
async function executeTask(task, taskId, traceId) {
  const taskTrace = langfuse.trace({
    id: traceId,
    name: `Task Execution: ${AGENT_TYPE}`,
    sessionId: taskId,
    metadata: {
      agentId: AGENT_ID,
      task: task.substring(0, 100) // Truncate for metadata
    }
  });
  
  const executionSpan = taskTrace.span({
    name: 'Task Processing',
    input: { task, agentType: AGENT_TYPE }
  });
  
  let result = {};
  
  try {
    // Simulate task execution based on agent type
    switch (AGENT_TYPE) {
      case 'researcher':
        result = await performResearch(task, taskTrace);
        break;
      case 'coder':
        result = await generateCode(task, taskTrace);
        break;
      case 'analyst':
        result = await analyzeData(task, taskTrace);
        break;
      case 'tester':
        result = await runTests(task, taskTrace);
        break;
      default:
        result = await generalExecution(task, taskTrace);
    }
    
    executionSpan.end({
      output: { success: true, resultSummary: result.summary }
    });
    
    return result;
  } catch (error) {
    executionSpan.end({
      output: { error: error.message },
      level: 'ERROR'
    });
    throw error;
  }
}

// Agent-specific task implementations
async function performResearch(task, trace) {
  const researchSpan = trace.span({
    name: 'Research Task',
    input: { task }
  });
  
  // Simulate research activity
  console.log(`🔍 Researching: ${task}`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const result = {
    summary: 'Research completed',
    findings: [
      'Found relevant documentation',
      'Identified key patterns',
      'Compiled reference list'
    ],
    timestamp: new Date().toISOString()
  };
  
  researchSpan.end({
    output: result
  });
  
  return result;
}

async function generateCode(task, trace) {
  const codeSpan = trace.span({
    name: 'Code Generation',
    input: { task }
  });
  
  console.log(`💻 Generating code for: ${task}`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const result = {
    summary: 'Code generated successfully',
    files: ['main.js', 'utils.js', 'test.js'],
    linesOfCode: 150,
    timestamp: new Date().toISOString()
  };
  
  codeSpan.end({
    output: result
  });
  
  return result;
}

async function analyzeData(task, trace) {
  const analysisSpan = trace.span({
    name: 'Data Analysis',
    input: { task }
  });
  
  console.log(`📊 Analyzing: ${task}`);
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  const result = {
    summary: 'Analysis complete',
    metrics: {
      dataPoints: 1000,
      patterns: 5,
      confidence: 0.95
    },
    timestamp: new Date().toISOString()
  };
  
  analysisSpan.end({
    output: result
  });
  
  return result;
}

async function runTests(task, trace) {
  const testSpan = trace.span({
    name: 'Test Execution',
    input: { task }
  });
  
  console.log(`🧪 Testing: ${task}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const result = {
    summary: 'Tests completed',
    stats: {
      total: 25,
      passed: 23,
      failed: 2,
      coverage: '85%'
    },
    timestamp: new Date().toISOString()
  };
  
  testSpan.end({
    output: result
  });
  
  return result;
}

async function generalExecution(task, trace) {
  const generalSpan = trace.span({
    name: 'General Task Execution',
    input: { task }
  });
  
  console.log(`⚙️ Executing: ${task}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const result = {
    summary: 'Task executed',
    status: 'completed',
    timestamp: new Date().toISOString()
  };
  
  generalSpan.end({
    output: result
  });
  
  return result;
}

// Main agent loop
async function startAgent() {
  console.log(`🤖 Starting Claude Flow Agent: ${AGENT_ID} (${AGENT_TYPE})`);
  console.log(`📊 Langfuse tracing enabled`);
  console.log(`🐳 Running in Docker container: ${process.env.HOSTNAME}`);
  
  // Register with coordinator
  await registerAgent();
  await updateStatus('idle');
  
  // Subscribe to task channel
  const subscriber = redis.duplicate();
  await subscriber.connect();
  await subscriber.subscribe(`agent:${AGENT_ID}:tasks`, async (message) => {
    const taskData = JSON.parse(message);
    console.log(`📋 Received task: ${taskData.taskId}`);
    
    try {
      await updateStatus('busy', taskData.taskId);
      
      const result = await executeTask(
        taskData.task,
        taskData.taskId,
        taskData.traceId
      );
      
      await updateStatus('completed', taskData.taskId, result);
      console.log(`✅ Task ${taskData.taskId} completed`);
      
      // Store result in Redis
      await redis.hSet(`results:${taskData.taskId}`, {
        agentId: AGENT_ID,
        result: JSON.stringify(result),
        completedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`❌ Task ${taskData.taskId} failed:`, error);
      await updateStatus('error', taskData.taskId, { error: error.message });
    }
    
    // Return to idle state
    await updateStatus('idle');
  });
  
  console.log(`👂 Listening for tasks...`);
  
  // Send heartbeat every 30 seconds
  setInterval(async () => {
    agentTrace.generation({
      name: 'Agent Heartbeat',
      input: { agentId: AGENT_ID },
      output: { 
        status: 'alive',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
    await langfuse.flush();
  }, 30000);
}

// Start the agent
startAgent().catch(error => {
  console.error('Failed to start agent:', error);
  agentTrace.generation({
    name: 'Agent Startup Failed',
    input: { agentId: AGENT_ID },
    output: { error: error.message },
    level: 'ERROR'
  });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down agent...');
  
  agentTrace.generation({
    name: 'Agent Shutdown',
    input: { agentId: AGENT_ID },
    output: { graceful: true }
  });
  
  await updateStatus('offline');
  await langfuse.flush();
  await redis.quit();
  process.exit(0);
});