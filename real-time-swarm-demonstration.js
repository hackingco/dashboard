#!/usr/bin/env node

/**
 * Real-Time Swarm Demonstration for Dashboard
 * This script generates continuous real-time traces for demonstration
 */

// Simple UUID generator
function uuidv4() {
  return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class RealTimeSwarmDemo {
  constructor() {
    this.sessionId = `dashboard-demo-${Date.now()}`;
    this.agentIds = [];
    this.taskCounter = 0;
    this.isRunning = false;
    this.traces = [];
    
    console.log('🚀 Real-Time Swarm Dashboard Demonstration');
    console.log(`📊 Session ID: ${this.sessionId}`);
  }

  async createLangfuseTrace(traceName, data = {}) {
    const trace = {
      id: `trace-${uuidv4()}`,
      timestamp: new Date().toISOString(),
      name: traceName,
      sessionId: this.sessionId,
      metadata: {
        demo: true,
        realTime: true,
        dashboardIntegration: true,
        ...data
      },
      events: []
    };

    try {
      // Simulate API call to Langfuse
      console.log(`📝 Creating trace: ${traceName} (${trace.id})`);
      this.traces.push(trace);
      
      // Post to Langfuse using batch API
      const response = await fetch('http://localhost:3000/api/public/ingestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from('sk-lf-5e3c1f3e-6898-44a6-b041-df18ab0e9b35:').toString('base64')
        },
        body: JSON.stringify({
          batch: [{
            id: trace.id,
            type: 'trace-create',
            timestamp: trace.timestamp,
            body: {
              id: trace.id,
              name: traceName,
              sessionId: this.sessionId,
              metadata: trace.metadata
            }
          }]
        })
      });

      if (response.ok) {
        console.log(`✅ Trace logged to Langfuse: ${traceName}`);
      } else {
        console.log(`⚠️ Trace created locally: ${traceName}`);
      }
      
      return trace.id;
    } catch (error) {
      console.log(`📋 Trace recorded locally: ${traceName}`);
      return trace.id;
    }
  }

  async initializeSwarmAgents() {
    console.log('\n🤖 Initializing Swarm Agents...');
    
    const agents = [
      { name: 'Dashboard Monitor', role: 'monitoring', specialty: 'real-time-metrics' },
      { name: 'Trace Coordinator', role: 'coordination', specialty: 'trace-management' },
      { name: 'Performance Analyzer', role: 'analysis', specialty: 'performance-optimization' },
      { name: 'Load Balancer', role: 'optimization', specialty: 'resource-allocation' },
      { name: 'Health Checker', role: 'monitoring', specialty: 'system-health' }
    ];

    for (const agent of agents) {
      const agentId = `agent-${uuidv4().slice(0, 8)}`;
      this.agentIds.push(agentId);
      
      await this.createLangfuseTrace(`Agent Activation: ${agent.name}`, {
        agentId,
        agentName: agent.name,
        role: agent.role,
        specialty: agent.specialty,
        status: 'active',
        capabilities: [agent.specialty, 'real-time-processing', 'dashboard-integration']
      });
      
      console.log(`  ✅ ${agent.name} (${agentId}) - ${agent.specialty}`);
      await this.delay(200); // Small delay for realism
    }
    
    console.log(`🎉 ${this.agentIds.length} agents initialized and ready!`);
  }

  async generateContinuousTraces() {
    console.log('\n📈 Starting continuous trace generation...');
    console.log('🔄 Generating real-time swarm activity for dashboard...');
    
    this.isRunning = true;
    
    while (this.isRunning) {
      await Promise.all([
        this.simulateTaskExecution(),
        this.simulatePerformanceMonitoring(),
        this.simulateResourceAllocation(),
        this.simulateSwarmCommunication()
      ]);
      
      await this.delay(2000); // Generate new traces every 2 seconds
    }
  }

  async simulateTaskExecution() {
    const taskId = `task-${++this.taskCounter}`;
    const agentId = this.agentIds[Math.floor(Math.random() * this.agentIds.length)];
    
    const tasks = [
      'Data processing pipeline optimization',
      'Real-time metric collection',
      'Load balancing adjustment',
      'Performance threshold analysis',
      'System health validation',
      'Resource allocation review',
      'Communication protocol update',
      'Trace aggregation process'
    ];
    
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    
    await this.createLangfuseTrace(`Task Execution: ${task}`, {
      taskId,
      agentId,
      task,
      status: 'executing',
      priority: Math.random() > 0.5 ? 'high' : 'medium',
      estimatedDuration: Math.floor(Math.random() * 30) + 10, // 10-40 seconds
      resourcesUsed: {
        cpu: Math.floor(Math.random() * 80) + 20,
        memory: Math.floor(Math.random() * 60) + 40,
        network: Math.floor(Math.random() * 100)
      }
    });
  }

  async simulatePerformanceMonitoring() {
    const metrics = {
      avgResponseTime: Math.floor(Math.random() * 200) + 50, // 50-250ms
      throughput: Math.floor(Math.random() * 1000) + 500, // 500-1500 ops/sec
      errorRate: Math.random() * 0.05, // 0-5% error rate
      activeAgents: this.agentIds.length,
      queueLength: Math.floor(Math.random() * 20),
      memoryUsage: Math.floor(Math.random() * 40) + 60, // 60-100%
      cpuUsage: Math.floor(Math.random() * 50) + 30 // 30-80%
    };

    await this.createLangfuseTrace('Performance Monitoring Update', {
      type: 'performance-metrics',
      metrics,
      timestamp: new Date().toISOString(),
      swarmHealth: metrics.errorRate < 0.02 && metrics.avgResponseTime < 150 ? 'healthy' : 'warning'
    });
  }

  async simulateResourceAllocation() {
    const allocations = this.agentIds.map(agentId => ({
      agentId,
      cpu: Math.floor(Math.random() * 100),
      memory: Math.floor(Math.random() * 100),
      activeTasks: Math.floor(Math.random() * 5),
      status: Math.random() > 0.1 ? 'active' : 'idle'
    }));

    await this.createLangfuseTrace('Resource Allocation Update', {
      type: 'resource-allocation',
      allocations,
      totalResources: {
        totalCpu: allocations.reduce((sum, a) => sum + a.cpu, 0),
        totalMemory: allocations.reduce((sum, a) => sum + a.memory, 0),
        totalTasks: allocations.reduce((sum, a) => sum + a.activeTasks, 0),
        activeAgents: allocations.filter(a => a.status === 'active').length
      }
    });
  }

  async simulateSwarmCommunication() {
    const fromAgent = this.agentIds[Math.floor(Math.random() * this.agentIds.length)];
    const toAgent = this.agentIds[Math.floor(Math.random() * this.agentIds.length)];
    
    if (fromAgent === toAgent) return; // Don't communicate with self
    
    const messageTypes = [
      'coordination-request',
      'status-update',
      'resource-sharing',
      'task-delegation',
      'performance-alert',
      'health-check-response'
    ];
    
    const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];
    
    await this.createLangfuseTrace(`Swarm Communication: ${messageType}`, {
      type: 'inter-agent-communication',
      from: fromAgent,
      to: toAgent,
      messageType,
      priority: Math.random() > 0.7 ? 'urgent' : 'normal',
      responseTime: Math.floor(Math.random() * 100) + 10, // 10-110ms
      dataSize: Math.floor(Math.random() * 1024) + 256 // 256-1280 bytes
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    console.log('\n🛑 Stopping real-time demonstration...');
    this.isRunning = false;
    
    await this.createLangfuseTrace('Swarm Demonstration Complete', {
      type: 'demo-completion',
      totalTraces: this.traces.length,
      duration: Date.now() - parseInt(this.sessionId.split('-')[2]),
      agentsUsed: this.agentIds.length,
      summary: 'Real-time swarm dashboard demonstration completed successfully'
    });
    
    console.log(`📊 Generated ${this.traces.length} traces for dashboard demonstration`);
    console.log(`🔗 View traces at: http://localhost:3000`);
    console.log(`📱 Dashboard running at: http://localhost:3002`);
  }

  async displayStatus() {
    console.clear();
    console.log('🧠 REAL-TIME SWARM DASHBOARD DEMONSTRATION');
    console.log('=' .repeat(50));
    console.log(`📊 Session: ${this.sessionId}`);
    console.log(`🤖 Active Agents: ${this.agentIds.length}`);
    console.log(`📝 Traces Generated: ${this.traces.length}`);
    console.log(`⏱️  Runtime: ${Math.floor((Date.now() - parseInt(this.sessionId.split('-')[2])) / 1000)}s`);
    console.log('');
    console.log('🔗 Access Points:');
    console.log(`   Dashboard: http://localhost:3002`);
    console.log(`   Langfuse:  http://localhost:3000`);
    console.log('');
    console.log('📈 Live Activity:');
    console.log('   ✅ Task execution traces');
    console.log('   📊 Performance monitoring');
    console.log('   🔄 Resource allocation');
    console.log('   💬 Inter-agent communication');
    console.log('');
    console.log('Press Ctrl+C to stop demonstration');
  }
}

// Main execution
async function main() {
  const demo = new RealTimeSwarmDemo();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await demo.stop();
    process.exit(0);
  });
  
  try {
    await demo.initializeSwarmAgents();
    
    // Start status display updates
    const statusInterval = setInterval(() => {
      demo.displayStatus();
    }, 3000);
    
    await demo.generateContinuousTraces();
    
    clearInterval(statusInterval);
  } catch (error) {
    console.error('❌ Demo error:', error.message);
    await demo.stop();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RealTimeSwarmDemo;