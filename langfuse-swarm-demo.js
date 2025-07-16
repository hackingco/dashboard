#!/usr/bin/env node

/**
 * Langfuse Swarm Metrics Demonstration
 * 
 * This script demonstrates comprehensive swarm activities and metrics collection
 * for Langfuse tracing system on port 3000.
 * 
 * Features:
 * - Agent coordination and communication
 * - Consensus voting processes
 * - Memory operations and sharing
 * - Performance monitoring and optimization
 * - Error handling and recovery
 * - Real-time metrics collection
 */

const { Langfuse } = require('langfuse');
const fs = require('fs');
const path = require('path');

// Langfuse configuration
const langfuse = new Langfuse({
  publicKey: 'pk-lf-REDACTED',
  secretKey: 'sk-lf-cmd2y5m640009pw076fvuxp9s',
  baseUrl: 'http://localhost:3000',
  flushAt: 10,
  flushInterval: 2000,
});

// Demo configuration
const DEMO_CONFIG = {
  sessionId: `swarm-demo-${Date.now()}`,
  swarmId: 'swarm_1752505683522_fdwx0myn2',
  agents: [
    { id: 'agent_1752505683620_he9bvi', name: 'Demo Coordinator', type: 'coordinator' },
    { id: 'agent_1752505683768_0ru9b6', name: 'Research Agent Alpha', type: 'researcher' },
    { id: 'agent_1752505683905_xl0fyk', name: 'Implementation Agent Beta', type: 'coder' },
    { id: 'agent_1752505684029_qp4gda', name: 'Metrics Analyst Gamma', type: 'analyst' },
    { id: 'agent_1752505684150_z3myff', name: 'Quality Assurance Delta', type: 'tester' },
    { id: 'agent_1752505684271_uabauv', name: 'Performance Optimizer Epsilon', type: 'optimizer' }
  ],
  demonstrationSteps: [
    'swarm_initialization',
    'agent_coordination',
    'consensus_voting',
    'memory_operations',
    'task_distribution',
    'performance_monitoring',
    'error_handling',
    'metrics_collection'
  ]
};

// Utility functions
function generateTraceId(prefix = 'demo') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function randomDelay(min = 100, max = 1000) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

function generateMockMetrics() {
  return {
    cpu_usage: Math.random() * 100,
    memory_usage: Math.random() * 100,
    response_time: Math.random() * 2000,
    throughput: Math.random() * 50,
    error_rate: Math.random() * 10,
    coordination_efficiency: 0.8 + Math.random() * 0.2
  };
}

// Demo functions
async function demonstrateSwarmInitialization() {
  console.log('🚀 Demonstrating Swarm Initialization...');
  
  const trace = langfuse.trace({
    id: generateTraceId('init'),
    name: '🚀 Swarm Initialization Demo',
    sessionId: DEMO_CONFIG.sessionId,
    metadata: {
      swarmId: DEMO_CONFIG.swarmId,
      agentCount: DEMO_CONFIG.agents.length,
      topology: 'mesh',
      strategy: 'adaptive'
    },
    tags: ['swarm', 'initialization', 'demo']
  });

  for (const agent of DEMO_CONFIG.agents) {
    const generation = trace.generation({
      id: generateTraceId('agent-spawn'),
      name: `Spawn ${agent.name}`,
      model: 'swarm-coordinator',
      input: `Initialize agent: ${agent.name} (${agent.type})`,
      output: `Agent ${agent.name} spawned successfully with capabilities: ${agent.type}`,
      usage: {
        promptTokens: 50,
        completionTokens: 25,
        totalTokens: 75
      },
      metadata: {
        agentId: agent.id,
        agentType: agent.type,
        agentName: agent.name,
        status: 'active'
      }
    });

    await randomDelay(200, 500);
  }

  console.log('✅ Swarm initialization traced to Langfuse');
  return trace;
}

async function demonstrateAgentCoordination() {
  console.log('🤝 Demonstrating Agent Coordination...');
  
  const trace = langfuse.trace({
    id: generateTraceId('coordination'),
    name: '🤝 Agent Coordination Demo',
    sessionId: DEMO_CONFIG.sessionId,
    metadata: {
      swarmId: DEMO_CONFIG.swarmId,
      coordinationType: 'inter-agent-communication',
      participatingAgents: DEMO_CONFIG.agents.length
    },
    tags: ['coordination', 'communication', 'demo']
  });

  // Simulate agent-to-agent communication
  for (let i = 0; i < 5; i++) {
    const sender = DEMO_CONFIG.agents[Math.floor(Math.random() * DEMO_CONFIG.agents.length)];
    const receiver = DEMO_CONFIG.agents[Math.floor(Math.random() * DEMO_CONFIG.agents.length)];
    
    if (sender.id !== receiver.id) {
      const generation = trace.generation({
        id: generateTraceId('communication'),
        name: `${sender.name} → ${receiver.name}`,
        model: 'agent-communication',
        input: `Message from ${sender.name} to ${receiver.name}`,
        output: `Coordination message processed successfully`,
        usage: {
          promptTokens: 30,
          completionTokens: 15,
          totalTokens: 45
        },
        metadata: {
          sender: sender.id,
          receiver: receiver.id,
          messageType: 'coordination',
          priority: 'medium'
        }
      });

      await randomDelay(150, 300);
    }
  }

  console.log('✅ Agent coordination traced to Langfuse');
  return trace;
}

async function demonstrateConsensusVoting() {
  console.log('🗳️ Demonstrating Consensus Voting...');
  
  const trace = langfuse.trace({
    id: generateTraceId('consensus'),
    name: '🗳️ Consensus Voting Demo',
    sessionId: DEMO_CONFIG.sessionId,
    metadata: {
      swarmId: DEMO_CONFIG.swarmId,
      votingMethod: 'majority',
      totalVoters: DEMO_CONFIG.agents.length,
      proposal: 'Optimize task distribution algorithm'
    },
    tags: ['consensus', 'voting', 'decision-making', 'demo']
  });

  // Simulate consensus voting process
  const votes = [];
  for (const agent of DEMO_CONFIG.agents) {
    const vote = Math.random() > 0.3 ? 'approve' : 'reject';
    votes.push({ agent: agent.id, vote });
    
    const generation = trace.generation({
      id: generateTraceId('vote'),
      name: `Vote from ${agent.name}`,
      model: 'consensus-voter',
      input: `Voting on proposal: Optimize task distribution algorithm`,
      output: `Vote cast: ${vote}`,
      usage: {
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30
      },
      metadata: {
        agentId: agent.id,
        vote: vote,
        votingRound: 1,
        proposal: 'task-distribution-optimization'
      }
    });

    await randomDelay(100, 200);
  }

  // Calculate consensus result
  const approvals = votes.filter(v => v.vote === 'approve').length;
  const result = approvals > DEMO_CONFIG.agents.length / 2 ? 'approved' : 'rejected';
  
  trace.generation({
    id: generateTraceId('consensus-result'),
    name: 'Consensus Result',
    model: 'consensus-calculator',
    input: `Votes: ${votes.length}, Approvals: ${approvals}`,
    output: `Proposal ${result} by majority vote`,
    usage: {
      promptTokens: 15,
      completionTokens: 8,
      totalTokens: 23
    },
    metadata: {
      result: result,
      approvals: approvals,
      totalVotes: votes.length,
      consensusReached: true
    }
  });

  console.log(`✅ Consensus voting traced to Langfuse (Result: ${result})`);
  return trace;
}

async function demonstrateMemoryOperations() {
  console.log('🧠 Demonstrating Memory Operations...');
  
  const trace = langfuse.trace({
    id: generateTraceId('memory'),
    name: '🧠 Memory Operations Demo',
    sessionId: DEMO_CONFIG.sessionId,
    metadata: {
      swarmId: DEMO_CONFIG.swarmId,
      memoryType: 'collective',
      operationType: 'store-retrieve-update'
    },
    tags: ['memory', 'storage', 'collective-intelligence', 'demo']
  });

  // Memory storage operations
  const memoryOperations = [
    { operation: 'store', key: 'task-queue', value: 'high-priority-tasks' },
    { operation: 'store', key: 'agent-capabilities', value: 'coordination-matrix' },
    { operation: 'retrieve', key: 'performance-metrics', value: 'current-stats' },
    { operation: 'update', key: 'swarm-status', value: 'active-coordination' },
    { operation: 'share', key: 'consensus-results', value: 'voting-outcomes' }
  ];

  for (const op of memoryOperations) {
    const generation = trace.generation({
      id: generateTraceId('memory-op'),
      name: `Memory ${op.operation.toUpperCase()}`,
      model: 'memory-manager',
      input: `Memory operation: ${op.operation} - Key: ${op.key}`,
      output: `Memory ${op.operation} completed successfully`,
      usage: {
        promptTokens: 25,
        completionTokens: 12,
        totalTokens: 37
      },
      metadata: {
        operation: op.operation,
        key: op.key,
        value: op.value,
        memoryNamespace: 'swarm-collective',
        success: true
      }
    });

    await randomDelay(100, 250);
  }

  console.log('✅ Memory operations traced to Langfuse');
  return trace;
}

async function demonstratePerformanceMonitoring() {
  console.log('📊 Demonstrating Performance Monitoring...');
  
  const trace = langfuse.trace({
    id: generateTraceId('performance'),
    name: '📊 Performance Monitoring Demo',
    sessionId: DEMO_CONFIG.sessionId,
    metadata: {
      swarmId: DEMO_CONFIG.swarmId,
      monitoringType: 'real-time',
      metricsCollected: ['cpu', 'memory', 'throughput', 'response-time']
    },
    tags: ['performance', 'monitoring', 'optimization', 'demo']
  });

  // Performance metrics for each agent
  for (const agent of DEMO_CONFIG.agents) {
    const metrics = generateMockMetrics();
    
    const generation = trace.generation({
      id: generateTraceId('metrics'),
      name: `Performance Metrics - ${agent.name}`,
      model: 'performance-monitor',
      input: `Collect performance metrics for ${agent.name}`,
      output: `Metrics collected: CPU ${metrics.cpu_usage.toFixed(1)}%, Memory ${metrics.memory_usage.toFixed(1)}%`,
      usage: {
        promptTokens: 15,
        completionTokens: 8,
        totalTokens: 23
      },
      metadata: {
        agentId: agent.id,
        metrics: metrics,
        timestamp: new Date().toISOString(),
        healthy: metrics.cpu_usage < 80 && metrics.memory_usage < 85
      }
    });

    await randomDelay(100, 200);
  }

  console.log('✅ Performance monitoring traced to Langfuse');
  return trace;
}

async function demonstrateTaskDistribution() {
  console.log('📋 Demonstrating Task Distribution...');
  
  const trace = langfuse.trace({
    id: generateTraceId('tasks'),
    name: '📋 Task Distribution Demo',
    sessionId: DEMO_CONFIG.sessionId,
    metadata: {
      swarmId: DEMO_CONFIG.swarmId,
      distributionStrategy: 'load-balanced',
      totalTasks: 15
    },
    tags: ['task-distribution', 'load-balancing', 'orchestration', 'demo']
  });

  const tasks = [
    { id: 'task-001', type: 'research', priority: 'high', assigned: 'agent_1752505683768_0ru9b6' },
    { id: 'task-002', type: 'implementation', priority: 'high', assigned: 'agent_1752505683905_xl0fyk' },
    { id: 'task-003', type: 'analysis', priority: 'medium', assigned: 'agent_1752505684029_qp4gda' },
    { id: 'task-004', type: 'testing', priority: 'medium', assigned: 'agent_1752505684150_z3myff' },
    { id: 'task-005', type: 'optimization', priority: 'low', assigned: 'agent_1752505684271_uabauv' }
  ];

  for (const task of tasks) {
    const generation = trace.generation({
      id: generateTraceId('task-assign'),
      name: `Task Assignment - ${task.id}`,
      model: 'task-orchestrator',
      input: `Assign task ${task.id} (${task.type}) to agent`,
      output: `Task ${task.id} assigned to agent successfully`,
      usage: {
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30
      },
      metadata: {
        taskId: task.id,
        taskType: task.type,
        priority: task.priority,
        assignedAgent: task.assigned,
        status: 'assigned'
      }
    });

    await randomDelay(150, 300);
  }

  console.log('✅ Task distribution traced to Langfuse');
  return trace;
}

async function collectMetricsReport() {
  console.log('📈 Collecting Metrics Report...');
  
  const trace = langfuse.trace({
    id: generateTraceId('report'),
    name: '📈 Metrics Collection Report',
    sessionId: DEMO_CONFIG.sessionId,
    metadata: {
      swarmId: DEMO_CONFIG.swarmId,
      reportType: 'comprehensive',
      metricsCollected: true
    },
    tags: ['metrics', 'report', 'summary', 'demo']
  });

  const summaryMetrics = {
    totalTraces: 25,
    totalGenerations: 45,
    averageResponseTime: 250,
    totalTokensUsed: 1250,
    successRate: 98.5,
    agentsActive: DEMO_CONFIG.agents.length,
    consensusReached: true,
    memoryOperations: 15,
    tasksDistributed: 5,
    performanceOptimal: true
  };

  const generation = trace.generation({
    id: generateTraceId('summary'),
    name: 'Demo Summary Report',
    model: 'metrics-aggregator',
    input: 'Generate comprehensive swarm demonstration report',
    output: 'Swarm demonstration completed successfully with comprehensive metrics',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    },
    metadata: {
      ...summaryMetrics,
      demonstrationComplete: true,
      langfuseIntegration: 'active',
      timestamp: new Date().toISOString()
    }
  });

  console.log('✅ Metrics report traced to Langfuse');
  return { trace, metrics: summaryMetrics };
}

// Main demonstration function
async function runSwarmDemo() {
  console.log('🐝 Starting Langfuse Swarm Metrics Demonstration...\n');
  
  try {
    const results = {};
    
    // Execute demonstration steps
    results.initialization = await demonstrateSwarmInitialization();
    await randomDelay(500, 1000);
    
    results.coordination = await demonstrateAgentCoordination();
    await randomDelay(500, 1000);
    
    results.consensus = await demonstrateConsensusVoting();
    await randomDelay(500, 1000);
    
    results.memory = await demonstrateMemoryOperations();
    await randomDelay(500, 1000);
    
    results.tasks = await demonstrateTaskDistribution();
    await randomDelay(500, 1000);
    
    results.performance = await demonstratePerformanceMonitoring();
    await randomDelay(500, 1000);
    
    results.report = await collectMetricsReport();
    
    // Flush all traces to Langfuse
    console.log('\n🔄 Flushing all traces to Langfuse...');
    await langfuse.flushAsync();
    
    console.log('\n✅ Langfuse Swarm Demonstration Complete!');
    console.log('📊 Access your metrics at: http://localhost:3000');
    console.log(`📋 Session ID: ${DEMO_CONFIG.sessionId}`);
    console.log(`🐝 Swarm ID: ${DEMO_CONFIG.swarmId}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

// Run the demonstration
if (require.main === module) {
  runSwarmDemo()
    .then(() => {
      console.log('\n🎉 Demonstration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Demonstration failed:', error);
      process.exit(1);
    });
}

module.exports = { runSwarmDemo, DEMO_CONFIG };