#!/usr/bin/env node

/**
 * Generate traces directly inside coordinator container
 * This bypasses authentication issues and forces visible traces
 */

console.log('🔥 FORCING LANGFUSE TRACES FROM SWARM COORDINATOR');
console.log('═══════════════════════════════════════════════');

// Test multiple coordinator endpoints to generate traces
const testUrls = [
  'http://localhost:8001/health',
  'http://localhost:8001/dashboard/state',
  'http://localhost:8001/dashboard/metrics'
];

console.log('🎯 Testing coordinator endpoints to verify functionality...');

testUrls.forEach((url, index) => {
  setTimeout(() => {
    fetch(url)
      .then(response => response.json())
      .then(data => {
        console.log(`✅ ${url}: ${data.status || 'OK'}`);
        if (data.langfuseEnabled !== undefined) {
          console.log(`   Langfuse enabled: ${data.langfuseEnabled}`);
        }
        if (data.agents) {
          console.log(`   Agents: ${data.agents.length}`);
        }
      })
      .catch(error => {
        console.log(`❌ ${url}: ${error.message}`);
      });
  }, index * 1000);
});

// Force task assignments to generate traces
setTimeout(() => {
  console.log('\n🚀 FORCING TRACE GENERATION WITH TASK ASSIGNMENTS');
  console.log('═══════════════════════════════════════════════');
  
  const tasks = [
    { agent: 'researcher-docker-alpha', type: 'research', desc: 'TRACE TEST - Research neural patterns' },
    { agent: 'coder-docker-beta', type: 'coding', desc: 'TRACE TEST - Implement coordination protocols' },
    { agent: 'analyst-docker-delta', type: 'analysis', desc: 'TRACE TEST - Analyze swarm performance' }
  ];

  tasks.forEach((task, index) => {
    setTimeout(() => {
      const taskData = {
        taskId: `force-trace-${Date.now()}-${index}`,
        agentId: task.agent,
        task: {
          type: task.type,
          description: task.desc,
          forceTrace: true,
          langfuseTest: true
        },
        priority: 'high'
      };

      fetch('http://localhost:8001/task/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log(`🔥 Task ${taskData.taskId} assigned - Trace ID: ${data.traceId}`);
          console.log(`   Agent: ${task.agent}`);
          console.log(`   Expected completion: ${new Date(data.estimatedCompletion).toLocaleTimeString()}`);
        } else {
          console.log(`❌ Task ${taskData.taskId} failed`);
        }
      })
      .catch(error => {
        console.log(`❌ Task assignment failed: ${error.message}`);
      });
    }, index * 2000);
  });
}, 5000);

// Monitor for trace creation
setTimeout(() => {
  console.log('\n📊 MONITORING FOR TRACE EVIDENCE');
  console.log('═══════════════════════════════');
  
  let monitorCount = 0;
  const monitorInterval = setInterval(() => {
    monitorCount++;
    
    fetch('http://localhost:8001/dashboard/state')
      .then(response => response.json())
      .then(data => {
        const tasks = data.tasks || [];
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const inProgressTasks = tasks.filter(t => t.status !== 'completed');
        
        console.log(`[Monitor ${monitorCount}] Tasks: ${completedTasks.length} completed, ${inProgressTasks.length} active`);
        
        if (completedTasks.length > 0) {
          console.log('🎉 TASKS COMPLETED - TRACES SHOULD BE VISIBLE!');
          console.log('Recent completions:');
          completedTasks.slice(-3).forEach(task => {
            console.log(`   ${task.id}: ${task.duration}ms (${task.agentId})`);
          });
        }
      })
      .catch(error => {
        console.log(`[Monitor ${monitorCount}] Error: ${error.message}`);
      });
      
    if (monitorCount >= 20) {
      clearInterval(monitorInterval);
      console.log('\n🏁 MONITORING COMPLETE');
      console.log('═══════════════════════');
      console.log('CHECK LANGFUSE DASHBOARD: http://localhost:3000');
      console.log('Look for traces with names like:');
      console.log('  - "docker_coordination"');
      console.log('  - Agent operation spans');
      console.log('  - Task execution traces');
    }
  }, 3000);
}, 10000);