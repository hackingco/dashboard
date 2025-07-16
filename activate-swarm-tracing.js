#!/usr/bin/env node

/**
 * Automated Swarm Tracing Activator
 * Monitors and traces all swarm activities on port 3000
 */

const { SwarmActivityTracer } = require('./swarm-langfuse-tracing-config');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SwarmTracingActivator {
  constructor() {
    this.tracer = null;
    this.monitoredProcesses = new Map();
    this.isActive = false;
    this.activationTime = Date.now();
    
    // Configuration
    this.config = {
      swarmId: process.env.SWARM_ID || `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: process.env.SESSION_ID || `session_${Date.now()}`,
      langfuseHost: process.env.LANGFUSE_HOST || 'http://localhost:3000',
      publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-REDACTED',
      secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-cmd2y5m640009pw076fvuxp9s',
      debug: process.env.DEBUG === 'true'
    };
    
    console.log('🔍 Swarm Tracing Activator initialized');
    console.log(`📊 Swarm ID: ${this.config.swarmId}`);
    console.log(`🌐 Langfuse Host: ${this.config.langfuseHost}`);
    console.log(`🔗 Session ID: ${this.config.sessionId}`);
  }
  
  async start() {
    try {
      console.log('🚀 Starting comprehensive swarm tracing...');
      
      // Initialize tracer
      this.tracer = new SwarmActivityTracer(this.config);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start monitoring for swarm activities
      await this.startSwarmMonitoring();
      
      // Initialize demo agents and activities
      await this.initializeDemoActivities();
      
      this.isActive = true;
      console.log('✅ Swarm tracing activated successfully');
      
      // Keep the process alive
      this.keepAlive();
      
    } catch (error) {
      console.error('❌ Failed to start swarm tracing:', error);
      process.exit(1);
    }
  }
  
  setupEventListeners() {
    // Listen to tracer events
    this.tracer.on('agent_spawned', (data) => {
      console.log(`🤖 Agent spawned: ${data.agentName} (${data.agentType})`);
      this.updateDashboard('agent_spawned', data);
    });
    
    this.tracer.on('agent_activated', (data) => {
      console.log(`⚡ Agent activated: ${data.agentId} for task ${data.taskId}`);
      this.updateDashboard('agent_activated', data);
    });
    
    this.tracer.on('consensus_voting_started', (data) => {
      console.log(`🗳️ Consensus voting started: ${data.topic}`);
      this.updateDashboard('consensus_voting_started', data);
    });
    
    this.tracer.on('consensus_vote_cast', (data) => {
      console.log(`✋ Vote cast: ${data.agentId} → ${data.vote}`);
      this.updateDashboard('consensus_vote_cast', data);
    });
    
    this.tracer.on('consensus_result', (data) => {
      console.log(`📊 Consensus result: ${data.result} (${data.outcome})`);
      this.updateDashboard('consensus_result', data);
    });
    
    this.tracer.on('task_distributed', (data) => {
      console.log(`📋 Task distributed: ${data.description}`);
      this.updateDashboard('task_distributed', data);
    });
    
    this.tracer.on('task_completed', (data) => {
      console.log(`✅ Task completed: ${data.agentId} - ${data.success ? 'SUCCESS' : 'FAILURE'}`);
      this.updateDashboard('task_completed', data);
    });
    
    this.tracer.on('memory_operation', (data) => {
      console.log(`🧠 Memory operation: ${data.operationType} - ${data.key}`);
      this.updateDashboard('memory_operation', data);
    });
    
    this.tracer.on('performance_metrics', (data) => {
      console.log(`📊 Performance metrics updated: ${data.source}`);
      this.updateDashboard('performance_metrics', data);
    });
    
    this.tracer.on('error', (data) => {
      console.error(`❌ Error traced: ${data.error} (${data.context})`);
      this.updateDashboard('error', data);
    });
    
    // System signal handlers
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  async startSwarmMonitoring() {
    console.log('👁️ Starting swarm activity monitoring...');
    
    // Monitor for Claude Flow processes
    this.monitorClaudeFlowProcesses();
    
    // Monitor for swarm coordination
    this.monitorSwarmCoordination();
    
    // Monitor for agent communications
    this.monitorAgentCommunications();
    
    // Monitor for memory operations
    this.monitorMemoryOperations();
    
    console.log('✅ Swarm monitoring started');
  }
  
  monitorClaudeFlowProcesses() {
    // Monitor for claude-flow commands
    const processMonitor = setInterval(() => {
      // Check for active claude-flow processes
      const ps = spawn('ps', ['aux']);
      let output = '';
      
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ps.on('close', (code) => {
        if (code === 0) {
          const lines = output.split('\n');
          const claudeFlowProcesses = lines.filter(line => 
            line.includes('claude-flow') || 
            line.includes('npx claude-flow') ||
            line.includes('swarm')
          );
          
          if (claudeFlowProcesses.length > 0) {
            claudeFlowProcesses.forEach(process => {
              const processId = process.split(/\\s+/)[1];
              if (!this.monitoredProcesses.has(processId)) {
                this.monitoredProcesses.set(processId, {
                  id: processId,
                  command: process,
                  startTime: Date.now()
                });
                console.log(`🔍 Detected Claude Flow process: ${processId}`);
              }
            });
          }
        }
      });
    }, 5000); // Check every 5 seconds
    
    this.processMonitor = processMonitor;
  }
  
  monitorSwarmCoordination() {
    // Monitor swarm coordination files
    const coordinationPaths = [
      '.swarm/memory.db',
      '.hive-mind/hive.db',
      'coordination/orchestration',
      'coordination/memory_bank'
    ];
    
    coordinationPaths.forEach(watchPath => {
      const fullPath = path.join(process.cwd(), watchPath);
      if (fs.existsSync(fullPath)) {
        fs.watchFile(fullPath, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            console.log(`📁 Coordination file changed: ${watchPath}`);
            this.traceCoordinationActivity(watchPath, curr);
          }
        });
        console.log(`👁️ Watching coordination file: ${watchPath}`);
      }
    });
  }
  
  monitorAgentCommunications() {
    // Monitor agent communication patterns
    const communicationMonitor = setInterval(async () => {
      // Check for agent communication logs
      const logPaths = [
        'logs/agents',
        'logs/coordinator',
        'logs/hive-mind'
      ];
      
      for (const logPath of logPaths) {
        const fullPath = path.join(process.cwd(), logPath);
        if (fs.existsSync(fullPath)) {
          const files = fs.readdirSync(fullPath);
          files.forEach(file => {
            if (file.endsWith('.log')) {
              const filePath = path.join(fullPath, file);
              const stats = fs.statSync(filePath);
              
              // Check if file was recently modified
              if (Date.now() - stats.mtime.getTime() < 10000) {
                console.log(`📡 Agent communication detected: ${file}`);
                this.traceAgentCommunication(file, filePath);
              }
            }
          });
        }
      }
    }, 5000);
    
    this.communicationMonitor = communicationMonitor;
  }
  
  monitorMemoryOperations() {
    // Monitor memory operations
    const memoryPaths = [
      '.swarm/memory.db',
      'memory/agents',
      'memory/sessions',
      'memory/claude-flow-data.json'
    ];
    
    memoryPaths.forEach(memoryPath => {
      const fullPath = path.join(process.cwd(), memoryPath);
      if (fs.existsSync(fullPath)) {
        fs.watchFile(fullPath, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            console.log(`🧠 Memory operation detected: ${memoryPath}`);
            this.traceMemoryActivity(memoryPath, curr);
          }
        });
        console.log(`👁️ Watching memory path: ${memoryPath}`);
      }
    });
  }
  
  async initializeDemoActivities() {
    console.log('🎭 Initializing demo swarm activities...');
    
    try {
      // Spawn demo agents
      const demoAgents = [
        { id: 'coordinator-001', name: 'Swarm Coordinator', type: 'coordinator', capabilities: ['task-distribution', 'consensus-facilitation', 'performance-monitoring'] },
        { id: 'researcher-001', name: 'Research Agent', type: 'researcher', capabilities: ['web-search', 'data-analysis', 'knowledge-synthesis'] },
        { id: 'coder-001', name: 'Coding Agent', type: 'coder', capabilities: ['javascript', 'python', 'code-review'] },
        { id: 'analyst-001', name: 'Analysis Agent', type: 'analyst', capabilities: ['data-processing', 'pattern-recognition', 'reporting'] },
        { id: 'tester-001', name: 'Testing Agent', type: 'tester', capabilities: ['unit-testing', 'integration-testing', 'quality-assurance'] }
      ];
      
      for (const agent of demoAgents) {
        await this.tracer.traceAgentSpawn(agent.id, agent.name, agent.type, agent.capabilities);
        await this.sleep(500); // Small delay between spawns
      }
      
      // Simulate agent activation
      await this.tracer.traceAgentActivation('coordinator-001', 'task-001', {
        activationType: 'automatic',
        reason: 'swarm_initialization'
      });
      
      await this.tracer.traceAgentActivation('researcher-001', 'task-002', {
        activationType: 'manual',
        reason: 'research_request'
      });
      
      // Simulate consensus voting
      await this.tracer.traceConsensusVotingRound('vote-001', 'Task Priority Assessment', 
        ['coordinator-001', 'researcher-001', 'coder-001', 'analyst-001'], 
        { proposal: 'Prioritize performance optimization tasks', urgency: 'high' }
      );
      
      // Simulate votes
      await this.tracer.traceConsensusVote('vote-001', 'coordinator-001', 'approve', 'High priority tasks should be addressed first');
      await this.tracer.traceConsensusVote('vote-001', 'researcher-001', 'approve', 'Performance optimization is critical');
      await this.tracer.traceConsensusVote('vote-001', 'coder-001', 'approve', 'Code optimization needed');
      await this.tracer.traceConsensusVote('vote-001', 'analyst-001', 'approve', 'Data supports this decision');
      
      // Simulate consensus result
      await this.tracer.traceConsensusResult('vote-001', 'approved', 'consensus', {
        approveCount: 4,
        rejectCount: 0,
        abstainCount: 0,
        consensusReached: true
      });
      
      // Simulate task distribution
      await this.tracer.traceTaskDistribution('task-perf-001', 'Optimize swarm performance monitoring', 
        ['coder-001', 'analyst-001'], 'high', 
        { estimatedTime: 3600000, complexity: 'medium' }
      );
      
      // Simulate memory operations
      await this.tracer.traceMemoryOperation('store', 'coordinator-001', 'swarm/config/performance', 
        { monitoringInterval: 10000, metricsRetention: 86400000 });
      
      await this.tracer.traceMemoryOperation('store', 'researcher-001', 'swarm/research/findings', 
        { topic: 'performance-optimization', confidence: 0.85, sources: 5 });
      
      await this.tracer.traceMemoryOperation('retrieve', 'analyst-001', 'swarm/config/performance', 
        { monitoringInterval: 10000, metricsRetention: 86400000 });
      
      // Simulate agent communications
      await this.tracer.traceAgentCommunication('coordinator-001', 'coder-001', 
        'Please implement performance monitoring dashboard', 'task-assignment');
      
      await this.tracer.traceAgentCommunication('coder-001', 'analyst-001', 
        'Need metrics specification for dashboard', 'information-request');
      
      await this.tracer.traceAgentCommunication('analyst-001', 'coder-001', 
        'Metrics spec: CPU, memory, throughput, latency', 'information-response');
      
      // Simulate task completion
      setTimeout(async () => {
        await this.tracer.traceTaskCompletion('task-perf-001', 'coder-001', 
          'Performance monitoring dashboard implemented with real-time metrics', true, 
          { linesOfCode: 250, testsAdded: 12 });
        
        await this.tracer.traceTaskCompletion('task-perf-001', 'analyst-001', 
          'Performance analysis completed with optimization recommendations', true, 
          { metricsAnalyzed: 15, optimizationsSuggested: 8 });
      }, 5000);
      
      console.log('✅ Demo activities initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize demo activities:', error);
      await this.tracer.traceError(null, error, 'demo_initialization');
    }
  }
  
  async traceCoordinationActivity(filePath, fileStats) {
    try {
      // Determine coordination type based on file path
      let coordinationType = 'unknown';
      let agentId = 'system';
      
      if (filePath.includes('memory.db')) {
        coordinationType = 'memory_coordination';
      } else if (filePath.includes('hive.db')) {
        coordinationType = 'hive_coordination';
      } else if (filePath.includes('orchestration')) {
        coordinationType = 'task_orchestration';
      }
      
      await this.tracer.traceMemoryOperation('update', agentId, filePath, {
        fileSize: fileStats.size,
        lastModified: fileStats.mtime.toISOString(),
        coordinationType
      });
      
    } catch (error) {
      console.error('❌ Failed to trace coordination activity:', error);
    }
  }
  
  async traceAgentCommunication(logFile, filePath) {
    try {
      // Extract agent information from log file name
      const agentMatch = logFile.match(/([^/]+)\\.log$/);
      const agentId = agentMatch ? agentMatch[1] : 'unknown';
      
      // Read recent log entries
      const logContent = fs.readFileSync(filePath, 'utf8');
      const lines = logContent.split('\\n').slice(-10); // Last 10 lines
      
      for (const line of lines) {
        if (line.trim() && !line.startsWith('#')) {
          await this.tracer.traceAgentCommunication(agentId, 'system', line, 'log-entry');
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to trace agent communication:', error);
    }
  }
  
  async traceMemoryActivity(memoryPath, fileStats) {
    try {
      const operationType = fileStats.size > 0 ? 'update' : 'create';
      const agentId = 'memory-manager';
      
      await this.tracer.traceMemoryOperation(operationType, agentId, memoryPath, {
        fileSize: fileStats.size,
        lastModified: fileStats.mtime.toISOString(),
        memoryType: this.getMemoryType(memoryPath)
      });
      
    } catch (error) {
      console.error('❌ Failed to trace memory activity:', error);
    }
  }
  
  getMemoryType(path) {
    if (path.includes('memory.db')) return 'swarm_memory';
    if (path.includes('hive.db')) return 'hive_memory';
    if (path.includes('agents')) return 'agent_memory';
    if (path.includes('sessions')) return 'session_memory';
    return 'unknown';
  }
  
  updateDashboard(eventType, data) {
    // Update dashboard with real-time data
    const dashboardData = {
      timestamp: new Date().toISOString(),
      eventType,
      swarmId: this.config.swarmId,
      sessionId: this.config.sessionId,
      data,
      metrics: this.tracer.getCurrentMetrics()
    };
    
    // Write to dashboard data file
    const dashboardFile = path.join(process.cwd(), 'dashboard-data.json');
    fs.writeFileSync(dashboardFile, JSON.stringify(dashboardData, null, 2));
    
    // Optional: Send to dashboard API
    this.sendToDashboard(dashboardData);
  }
  
  sendToDashboard(data) {
    // Send data to dashboard API if available
    // This could be a WebSocket connection or HTTP POST
    try {
      // Example: POST to dashboard API
      // Implementation depends on dashboard setup
      console.log('📊 Dashboard updated:', data.eventType);
    } catch (error) {
      console.warn('⚠️ Failed to send to dashboard:', error.message);
    }
  }
  
  keepAlive() {
    // Display real-time metrics
    const metricsInterval = setInterval(() => {
      const metrics = this.tracer.getCurrentMetrics();
      console.log('\\n📊 Current Swarm Metrics:');
      console.log(`   Active Agents: ${metrics.activeAgents}/${metrics.totalAgents}`);
      console.log(`   Tasks: ${metrics.completedTasks}/${metrics.totalTasks} (${metrics.failedTasks} failed)`);
      console.log(`   Consensus Rounds: ${metrics.consensusRounds}`);
      console.log(`   Memory Operations: ${metrics.memoryOperations}`);
      console.log(`   Total Traces: ${metrics.totalTraces}`);
      console.log(`   System Health: ${metrics.systemHealth}%`);
      console.log(`   Uptime: ${Math.round(metrics.uptime / 1000)}s`);
      console.log(`   Langfuse URL: ${metrics.langfuseUrl}`);
      console.log('\\n🔍 Monitoring continues...');
    }, 30000); // Every 30 seconds
    
    this.metricsInterval = metricsInterval;
  }
  
  async shutdown() {
    console.log('\\n🛑 Shutting down swarm tracing...');
    
    try {
      // Clear intervals
      if (this.processMonitor) clearInterval(this.processMonitor);
      if (this.communicationMonitor) clearInterval(this.communicationMonitor);
      if (this.metricsInterval) clearInterval(this.metricsInterval);
      
      // Unwatchfiles
      // (fs.watchFile doesn't return a handle, so we can't clear them)
      
      // Shutdown tracer
      if (this.tracer) {
        await this.tracer.shutdown();
      }
      
      console.log('✅ Swarm tracing shutdown completed');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
if (require.main === module) {
  const activator = new SwarmTracingActivator();
  
  console.log('🚀 Starting Swarm Tracing Activator...');
  console.log('🌐 Langfuse URL: http://localhost:3000');
  console.log('📊 Real-time tracing will begin shortly...');
  
  activator.start().catch(error => {
    console.error('❌ Failed to start swarm tracing:', error);
    process.exit(1);
  });
}

module.exports = { SwarmTracingActivator };