#!/usr/bin/env node

/**
 * Activate Full Swarm with Comprehensive Langfuse Tracing
 * Now that we've confirmed tracing works, let's see the full swarm in action
 */

console.log('🐝 ACTIVATING FULL SWARM WITH LANGFUSE TRACING');
console.log('═══════════════════════════════════════════════');
console.log(`Time: ${new Date().toISOString()}`);
console.log('Coordinator: http://localhost:8000');
console.log('Langfuse Dashboard: http://localhost:3000');
console.log('Live Dashboard: http://localhost:3001');
console.log('');

const http = require('http');

// Create comprehensive swarm tasks that will generate rich traces
const swarmTasks = [
  {
    agentId: 'researcher-docker-alpha',
    task: {
      type: 'research',
      description: 'Analyze distributed system coordination patterns for optimal swarm performance',
      complexity: 'high',
      expectedDuration: 15000
    },
    priority: 'high'
  },
  {
    agentId: 'coder-docker-beta',
    task: {
      type: 'implementation',
      description: 'Implement real-time WebSocket coordination protocols for agent communication',
      complexity: 'high',
      expectedDuration: 20000
    },
    priority: 'high'
  },
  {
    agentId: 'coder-docker-gamma',
    task: {
      type: 'optimization',
      description: 'Optimize memory usage and performance bottlenecks in containerized agents',
      complexity: 'medium',
      expectedDuration: 12000
    },
    priority: 'medium'
  },
  {
    agentId: 'analyst-docker-delta',
    task: {
      type: 'analysis',
      description: 'Perform comprehensive performance analysis of swarm coordination metrics',
      complexity: 'medium',
      expectedDuration: 10000
    },
    priority: 'high'
  },
  {
    agentId: 'architect-docker-epsilon',
    task: {
      type: 'design',
      description: 'Design scalable architecture for multi-swarm coordination and orchestration',
      complexity: 'high',
      expectedDuration: 18000
    },
    priority: 'medium'
  },
  {
    agentId: 'tester-docker-zeta',
    task: {
      type: 'testing',
      description: 'Create comprehensive test suite for swarm coordination and fault tolerance',
      complexity: 'medium',
      expectedDuration: 14000
    },
    priority: 'medium'
  },
  {
    agentId: 'reviewer-docker-eta',
    task: {
      type: 'review',
      description: 'Review and audit swarm security protocols and best practices',
      complexity: 'medium',
      expectedDuration: 8000
    },
    priority: 'low'
  },
  {
    agentId: 'monitor-docker-theta',
    task: {
      type: 'monitoring',
      description: 'Monitor real-time swarm health and performance with Langfuse integration',
      complexity: 'low',
      expectedDuration: 6000
    },
    priority: 'high'
  }
];

function assignTask(taskData, index) {
  return new Promise((resolve, reject) => {
    const taskId = `swarm-production-${Date.now()}-${index}`;
    const postData = JSON.stringify({
      taskId,
      agentId: taskData.agentId,
      task: {
        ...taskData.task,
        langfuseTracing: true,
        productionSwarm: true
      },
      priority: taskData.priority,
      metadata: {
        swarmActivation: true,
        batchIndex: index,
        expectedTraces: true
      }
    });

    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/task/assign',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success) {
            console.log(`✅ Task ${index + 1}: ${taskId} → ${taskData.agentId}`);
            console.log(`   Trace ID: ${result.traceId}`);
            console.log(`   Expected completion: ${new Date(result.estimatedCompletion).toLocaleTimeString()}`);
            resolve({ taskId, traceId: result.traceId, agent: taskData.agentId });
          } else {
            reject(new Error(`Task assignment failed: ${data}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function activateSwarm() {
  console.log('🚀 Assigning tasks to all 8 agents...');
  console.log('');

  const results = [];
  
  // Assign tasks with staggered timing to avoid overwhelming
  for (let i = 0; i < swarmTasks.length; i++) {
    try {
      const result = await assignTask(swarmTasks[i], i);
      results.push(result);
      
      // Short delay between assignments
      if (i < swarmTasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log(`❌ Failed to assign task ${i + 1}: ${error.message}`);
    }
  }

  console.log('');
  console.log(`🎯 Successfully assigned ${results.length}/${swarmTasks.length} tasks`);
  
  return results;
}

async function monitorSwarmActivity(assignedTasks) {
  console.log('');
  console.log('📊 MONITORING SWARM ACTIVITY');
  console.log('═══════════════════════════');
  console.log('Watch your Langfuse dashboard for real-time traces!');
  console.log('');

  let monitorRound = 0;
  const monitorInterval = setInterval(() => {
    monitorRound++;
    
    // Get swarm status
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/dashboard/state',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const state = JSON.parse(data);
          const tasks = state.tasks || [];
          const agents = state.agents || [];
          
          const completed = tasks.filter(t => t.status === 'completed').length;
          const inProgress = tasks.filter(t => t.status !== 'completed').length;
          
          console.log(`[Round ${monitorRound}] Agents: ${agents.length}, Tasks: ${completed} completed, ${inProgress} active`);
          
          if (completed > 0) {
            console.log('🔥 Tasks completing - check Langfuse for new traces!');
          }
          
          // Stop monitoring after significant progress or 20 rounds
          if (completed >= assignedTasks.length || monitorRound >= 20) {
            clearInterval(monitorInterval);
            console.log('');
            console.log('🏁 MONITORING COMPLETE');
            console.log('═══════════════════════');
            console.log(`✅ Final status: ${completed} tasks completed`);
            console.log('');
            console.log('🎯 LANGFUSE DASHBOARD SHOULD NOW SHOW:');
            console.log('   - Multiple agent coordination traces');
            console.log('   - Task execution spans with performance data');
            console.log('   - Cross-agent communication traces');
            console.log('   - Real-time swarm intelligence traces');
            console.log('');
            console.log('🔍 VIEW YOUR TRACES:');
            console.log('   Langfuse: http://localhost:3000');
            console.log('   Live Dashboard: http://localhost:3001');
          }
        } catch (error) {
          console.log(`[Round ${monitorRound}] Monitor error: ${error.message}`);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`[Round ${monitorRound}] Request error: ${error.message}`);
    });

    req.end();
  }, 3000);
}

// Main execution
async function main() {
  try {
    console.log('Starting full swarm activation...');
    const assignedTasks = await activateSwarm();
    
    if (assignedTasks.length > 0) {
      await monitorSwarmActivity(assignedTasks);
    } else {
      console.log('❌ No tasks were assigned successfully');
    }
  } catch (error) {
    console.error('❌ Swarm activation failed:', error);
  }
}

main();