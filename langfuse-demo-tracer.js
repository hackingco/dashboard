#!/usr/bin/env node

/**
 * Langfuse Demo Tracer - Working demonstration of swarm tracing
 * Creates mock traces that demonstrate all swarm activity types
 */

const { EventEmitter } = require('events');

class MockLangfuseClient {
  constructor(config) {
    this.config = config;
    this.traces = [];
    this.spans = [];
    this.flushCount = 0;
    
    console.log(`✅ Mock Langfuse client initialized`);
    console.log(`🌐 Target URL: ${config.baseUrl}`);
    console.log(`🔑 Public Key: ${config.publicKey}`);
  }
  
  trace(data) {
    const traceId = data.id || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trace = {
      id: traceId,
      ...data,
      timestamp: new Date().toISOString(),
      spans: []
    };
    
    this.traces.push(trace);
    
    return {
      id: traceId,
      span: (spanData) => {
        const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const span = {
          id: spanId,
          traceId: traceId,
          ...spanData,
          timestamp: new Date().toISOString(),
          ended: false
        };
        
        this.spans.push(span);
        trace.spans.push(span);
        
        return {
          id: spanId,
          end: (endData) => {
            span.ended = true;
            span.endData = endData;
            span.endTimestamp = new Date().toISOString();
            span.duration = Date.now() - new Date(span.timestamp).getTime();
            console.log(`   📊 Span ended: ${span.name || spanId} (${span.duration}ms)`);
          }
        };
      }
    };
  }
  
  async flushAsync() {
    this.flushCount++;
    console.log(`🔄 Flush #${this.flushCount}: ${this.traces.length} traces, ${this.spans.length} spans`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  }
  
  async shutdownAsync() {
    console.log(`🛑 Shutting down mock client: ${this.traces.length} traces processed`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  getTraces() {
    return this.traces;
  }
  
  getSpans() {
    return this.spans;
  }
}

class SwarmTracingDemo extends EventEmitter {
  constructor() {
    super();
    
    this.config = {
      swarmId: `demo_swarm_${Date.now()}`,
      sessionId: `demo_session_${Date.now()}`,
      baseUrl: 'http://localhost:3000',
      publicKey: 'pk-lf-demo-key',
      secretKey: 'sk-lf-demo-secret'
    };
    
    // Use mock client for demonstration
    this.langfuse = new MockLangfuseClient(this.config);
    
    // Tracking
    this.agents = new Map();
    this.tasks = new Map();
    this.consensusVotes = new Map();
    this.memoryOps = new Map();
    
    // Metrics
    this.metrics = {
      totalTraces: 0,
      totalSpans: 0,
      totalAgents: 0,
      activeAgents: 0,
      totalTasks: 0,
      completedTasks: 0,
      consensusRounds: 0,
      memoryOperations: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    console.log('🎭 Swarm Tracing Demo initialized');
    console.log(`📊 Swarm ID: ${this.config.swarmId}`);
    console.log(`🔗 Session ID: ${this.config.sessionId}`);
  }
  
  async runComprehensiveDemo() {
    console.log('\\n🚀 Starting Comprehensive Swarm Tracing Demo...');
    console.log('🎯 This demonstrates all swarm activity types that would be sent to Langfuse');
    
    try {
      // 1. Agent Lifecycle Events
      await this.demoAgentLifecycle();
      
      // 2. Consensus Voting Processes
      await this.demoConsensusVoting();
      
      // 3. Memory Operations
      await this.demoMemoryOperations();
      
      // 4. Task Distribution and Completion
      await this.demoTaskDistribution();
      
      // 5. Agent Communications
      await this.demoAgentCommunications();
      
      // 6. Performance Monitoring
      await this.demoPerformanceMonitoring();
      
      // 7. Error Handling
      await this.demoErrorHandling();
      
      // 8. Real-time Metrics
      await this.demoRealTimeMetrics();
      
      // Final results
      await this.showResults();
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
      await this.traceError(null, error, 'demo_execution');
    }
  }
  
  async demoAgentLifecycle() {
    console.log('\\n🤖 Demonstrating Agent Lifecycle Events...');
    
    // Spawn agents
    const agents = [
      { id: 'coordinator-001', name: 'Swarm Coordinator', type: 'coordinator', capabilities: ['coordination', 'monitoring'] },
      { id: 'researcher-001', name: 'Research Agent', type: 'researcher', capabilities: ['web-search', 'analysis'] },
      { id: 'coder-001', name: 'Code Agent', type: 'coder', capabilities: ['python', 'javascript'] },
      { id: 'analyst-001', name: 'Data Analyst', type: 'analyst', capabilities: ['data-processing', 'visualization'] },
      { id: 'tester-001', name: 'Testing Agent', type: 'tester', capabilities: ['unit-testing', 'integration-testing'] }
    ];
    
    for (const agent of agents) {
      await this.traceAgentSpawn(agent.id, agent.name, agent.type, agent.capabilities);
      await this.sleep(200);
    }
    
    // Activate agents
    await this.traceAgentActivation('coordinator-001', 'coord-task-001');
    await this.traceAgentActivation('researcher-001', 'research-task-001');
    await this.traceAgentActivation('coder-001', 'code-task-001');
    
    // Agent communications
    await this.traceAgentCommunication('coordinator-001', 'researcher-001', 'Start research on performance optimization', 'task-assignment');
    await this.traceAgentCommunication('researcher-001', 'coordinator-001', 'Research completed, findings available', 'task-completion');
    await this.traceAgentCommunication('coordinator-001', 'coder-001', 'Implement optimization based on research', 'task-assignment');
    
    // Complete agents
    await this.traceAgentComplete('researcher-001', 'completed');
    await this.traceAgentComplete('coder-001', 'completed');
    
    console.log('✅ Agent lifecycle demonstration completed');
  }
  
  async demoConsensusVoting() {
    console.log('\\n🗳️ Demonstrating Consensus Voting Processes...');
    
    // Start voting round
    await this.traceConsensusVotingRound(
      'vote-001', 
      'Task Priority Optimization',
      ['coordinator-001', 'researcher-001', 'coder-001', 'analyst-001'],
      { proposal: 'Prioritize performance tasks over feature development', urgency: 'high' }
    );
    
    // Cast votes
    await this.traceConsensusVote('vote-001', 'coordinator-001', 'approve', 'Performance is critical for user experience');
    await this.traceConsensusVote('vote-001', 'researcher-001', 'approve', 'Research supports this decision');
    await this.traceConsensusVote('vote-001', 'coder-001', 'approve', 'Code optimization is needed');
    await this.traceConsensusVote('vote-001', 'analyst-001', 'approve', 'Data shows performance bottlenecks');
    
    // Record result
    await this.traceConsensusResult('vote-001', 'approved', 'unanimous', {
      approveCount: 4,
      rejectCount: 0,
      abstainCount: 0,
      consensusReached: true
    });
    
    console.log('✅ Consensus voting demonstration completed');
  }
  
  async demoMemoryOperations() {
    console.log('\\n🧠 Demonstrating Memory Operations...');
    
    // Store operations
    await this.traceMemoryOperation('store', 'coordinator-001', 'swarm/config/priorities', 
      { performance: 'high', features: 'medium', testing: 'high' });
    
    await this.traceMemoryOperation('store', 'researcher-001', 'research/performance/findings', 
      { bottlenecks: 3, optimizations: 8, impact: 'high' });
    
    await this.traceMemoryOperation('store', 'coder-001', 'code/optimizations/implemented', 
      { functions: 12, performance_gain: '25%', tests_added: 8 });
    
    // Retrieve operations
    await this.traceMemoryOperation('retrieve', 'analyst-001', 'research/performance/findings', 
      { bottlenecks: 3, optimizations: 8, impact: 'high' });
    
    await this.traceMemoryOperation('retrieve', 'tester-001', 'code/optimizations/implemented', 
      { functions: 12, performance_gain: '25%', tests_added: 8 });
    
    // Update operations
    await this.traceMemoryOperation('update', 'coordinator-001', 'swarm/config/priorities', 
      { performance: 'completed', features: 'high', testing: 'in_progress' });
    
    // Search operations
    await this.traceMemoryOperation('search', 'analyst-001', 'research/*/findings', 
      ['research/performance/findings', 'research/user_experience/findings']);
    
    console.log('✅ Memory operations demonstration completed');
  }
  
  async demoTaskDistribution() {
    console.log('\\n📋 Demonstrating Task Distribution and Completion...');
    
    // Distribute tasks
    await this.traceTaskDistribution('task-perf-001', 'Optimize database queries', 
      ['coder-001', 'analyst-001'], 'high', 
      { estimatedTime: 7200000, complexity: 'high' });
    
    await this.traceTaskDistribution('task-test-001', 'Add performance benchmarks', 
      ['tester-001'], 'medium', 
      { estimatedTime: 3600000, complexity: 'medium' });
    
    await this.traceTaskDistribution('task-monitor-001', 'Setup monitoring dashboard', 
      ['coordinator-001', 'analyst-001'], 'high', 
      { estimatedTime: 5400000, complexity: 'medium' });
    
    // Complete tasks
    await this.traceTaskCompletion('task-perf-001', 'coder-001', 
      'Database query optimization completed - 40% performance improvement', true, 
      { queriesOptimized: 15, performanceGain: '40%', testsAdded: 10 });
    
    await this.traceTaskCompletion('task-perf-001', 'analyst-001', 
      'Performance analysis completed - identified 3 more optimization opportunities', true, 
      { analysisCompleted: true, additionalOptimizations: 3, reportGenerated: true });
    
    await this.traceTaskCompletion('task-test-001', 'tester-001', 
      'Performance benchmark suite implemented with 25 test cases', true, 
      { testCasesAdded: 25, benchmarkSuite: true, automatedReporting: true });
    
    await this.traceTaskCompletion('task-monitor-001', 'coordinator-001', 
      'Monitoring dashboard deployed with real-time metrics', true, 
      { dashboardDeployed: true, realTimeMetrics: true, alertsConfigured: true });
    
    console.log('✅ Task distribution demonstration completed');
  }
  
  async demoAgentCommunications() {
    console.log('\\n📡 Demonstrating Agent Communications...');
    
    // Task assignments
    await this.traceAgentCommunication('coordinator-001', 'researcher-001', 
      'Research machine learning optimization techniques', 'task-assignment');
    
    await this.traceAgentCommunication('coordinator-001', 'coder-001', 
      'Implement ML-based query optimization', 'task-assignment');
    
    // Information requests
    await this.traceAgentCommunication('coder-001', 'researcher-001', 
      'Can you provide specifics on gradient descent optimization?', 'information-request');
    
    await this.traceAgentCommunication('researcher-001', 'coder-001', 
      'Here are the gradient descent parameters: learning_rate=0.01, momentum=0.9', 'information-response');
    
    // Status updates
    await this.traceAgentCommunication('coder-001', 'coordinator-001', 
      'ML optimization implementation 75% complete', 'status-update');
    
    await this.traceAgentCommunication('tester-001', 'coordinator-001', 
      'All performance tests passing with 30% improvement', 'status-update');
    
    // Coordination
    await this.traceAgentCommunication('coordinator-001', 'all-agents', 
      'Daily standup: Share progress and blockers', 'coordination');
    
    console.log('✅ Agent communications demonstration completed');
  }
  
  async demoPerformanceMonitoring() {
    console.log('\\n📊 Demonstrating Performance Monitoring...');
    
    // System metrics
    await this.tracePerformanceMetrics({
      cpuUsage: 35.2,
      memoryUsage: 62.8,
      diskUsage: 45.3,
      networkTraffic: 1450,
      swarmThroughput: 28.5,
      averageLatency: 156,
      errorRate: 0.02,
      activeConnections: 18
    }, 'system-monitor');
    
    // Agent performance
    await this.tracePerformanceMetrics({
      agentUtilization: 78.5,
      taskCompletionRate: 92.3,
      consensusEfficiency: 96.7,
      memoryOperationsPerSecond: 15.2,
      communicationLatency: 45,
      coordinationEfficiency: 89.1
    }, 'agent-monitor');
    
    // Swarm intelligence metrics
    await this.tracePerformanceMetrics({
      collectiveIQ: 87.3,
      emergentBehaviors: 4,
      adaptationRate: 0.85,
      learningEfficiency: 76.2,
      decisionQuality: 91.8,
      selfHealingEvents: 2
    }, 'swarm-intelligence');
    
    console.log('✅ Performance monitoring demonstration completed');
  }
  
  async demoErrorHandling() {
    console.log('\\n❌ Demonstrating Error Handling...');
    
    // Agent errors
    await this.traceError('coder-001', new Error('Database connection timeout'), 'database_connection');
    await this.traceError('researcher-001', new Error('API rate limit exceeded'), 'api_rate_limit');
    await this.traceError('tester-001', new Error('Test environment unavailable'), 'test_environment');
    
    // System errors
    await this.traceError(null, new Error('Memory allocation failed'), 'system_memory');
    await this.traceError(null, new Error('Network partition detected'), 'network_partition');
    
    // Recovery events
    await this.traceError('coordinator-001', new Error('Recovery: Database connection restored'), 'recovery');
    await this.traceError('coordinator-001', new Error('Recovery: Network partition healed'), 'recovery');
    
    console.log('✅ Error handling demonstration completed');
  }
  
  async demoRealTimeMetrics() {
    console.log('\\n⏱️ Demonstrating Real-time Metrics...');
    
    // Simulate real-time metrics updates
    for (let i = 0; i < 5; i++) {
      const timestamp = Date.now() + (i * 5000);
      await this.tracePerformanceMetrics({
        timestamp: new Date(timestamp).toISOString(),
        activeAgents: 5 - i,
        tasksInProgress: Math.max(0, 8 - i * 2),
        completedTasks: 15 + i * 3,
        throughput: 25.5 + i * 2.3,
        systemHealth: Math.max(75, 95 - i * 3),
        consensusRounds: 3 + i,
        memoryOperations: 145 + i * 12
      }, 'real-time-update');
      
      await this.sleep(500);
    }
    
    console.log('✅ Real-time metrics demonstration completed');
  }
  
  async showResults() {
    console.log('\\n📊 Demonstration Results Summary:');
    console.log('================================');
    
    const traces = this.langfuse.getTraces();
    const spans = this.langfuse.getSpans();
    
    console.log(`✅ Total Traces Generated: ${traces.length}`);
    console.log(`✅ Total Spans Created: ${spans.length}`);
    console.log(`✅ Total Agents: ${this.metrics.totalAgents}`);
    console.log(`✅ Total Tasks: ${this.metrics.totalTasks}`);
    console.log(`✅ Consensus Rounds: ${this.metrics.consensusRounds}`);
    console.log(`✅ Memory Operations: ${this.metrics.memoryOperations}`);
    console.log(`✅ Errors Traced: ${this.metrics.errors}`);
    console.log(`✅ Session Duration: ${Date.now() - this.metrics.startTime}ms`);
    
    console.log('\\n🎯 Trace Types Demonstrated:');
    const traceTypes = {};
    traces.forEach(trace => {
      const type = trace.name.split(':')[0].trim();
      traceTypes[type] = (traceTypes[type] || 0) + 1;
    });
    
    Object.entries(traceTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} traces`);
    });
    
    console.log('\\n🌐 Langfuse Integration:');
    console.log(`   Target URL: ${this.config.baseUrl}`);
    console.log(`   Session ID: ${this.config.sessionId}`);
    console.log(`   Swarm ID: ${this.config.swarmId}`);
    console.log(`   Flushes: ${this.langfuse.flushCount}`);
    
    console.log('\\n📈 Sample Trace Data:');
    console.log('Recent traces (last 3):');
    traces.slice(-3).forEach(trace => {
      console.log(`   🔍 ${trace.name}`);
      console.log(`      ID: ${trace.id}`);
      console.log(`      Time: ${trace.timestamp}`);
      console.log(`      Tags: ${trace.tags ? trace.tags.join(', ') : 'none'}`);
      console.log(`      Spans: ${trace.spans.length}`);
      console.log('');
    });
    
    console.log('\\n🎉 Comprehensive Swarm Tracing Demo Complete!');
    console.log('\\n💡 What this demonstrates:');
    console.log('   ✅ Agent lifecycle events (spawn, activate, communicate, complete)');
    console.log('   ✅ Consensus voting processes with real-time vote tracking');
    console.log('   ✅ Memory operations and knowledge sharing between agents');
    console.log('   ✅ Task distribution and completion tracking');
    console.log('   ✅ Inter-agent communication patterns');
    console.log('   ✅ Performance metrics and bottleneck identification');
    console.log('   ✅ Error handling and recovery processes');
    console.log('   ✅ Real-time monitoring and analytics');
    console.log('');
    console.log('🔧 In a real deployment, all this data would be sent to:');
    console.log(`   🌐 Langfuse: ${this.config.baseUrl}`);
    console.log('   📊 Available for analysis in the Langfuse dashboard');
    console.log('   🔍 Searchable by tags, agents, sessions, and time ranges');
    console.log('   📈 Visualized with charts and performance metrics');
    
    // Save demonstration data
    await this.saveDemoData();
  }
  
  async saveDemoData() {
    const fs = require('fs');
    const demoData = {
      config: this.config,
      metrics: this.metrics,
      traces: this.langfuse.getTraces(),
      spans: this.langfuse.getSpans(),
      generated: new Date().toISOString()
    };
    
    fs.writeFileSync('swarm-tracing-demo-data.json', JSON.stringify(demoData, null, 2));
    console.log('\\n💾 Demo data saved to: swarm-tracing-demo-data.json');
  }
  
  // Tracing methods (similar to the original but with mock client)
  async traceAgentSpawn(agentId, agentName, agentType, capabilities) {
    const trace = this.langfuse.trace({
      id: `agent_spawn_${agentId}_${Date.now()}`,
      name: `🤖 Agent Spawned: ${agentName}`,
      sessionId: this.config.sessionId,
      userId: agentId,
      input: { agentId, agentName, agentType, capabilities },
      output: { status: 'spawned', capabilities },
      metadata: { swarmId: this.config.swarmId, agentId, agentName, agentType },
      tags: ['agent', 'spawn', agentType],
      level: 'INFO'
    });
    
    this.agents.set(agentId, {
      id: agentId,
      name: agentName,
      type: agentType,
      capabilities,
      status: 'spawned',
      spawnTime: Date.now()
    });
    
    this.metrics.totalAgents++;
    this.metrics.activeAgents++;
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`🤖 Agent spawned: ${agentName} (${agentType})`);
    return trace.id;
  }
  
  async traceAgentActivation(agentId, taskId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    const trace = this.langfuse.trace({
      id: `agent_activation_${agentId}_${Date.now()}`,
      name: `⚡ Agent Activated: ${agent.name}`,
      sessionId: this.config.sessionId,
      userId: agentId,
      input: { agentId, taskId },
      output: { status: 'activated', taskId },
      metadata: { swarmId: this.config.swarmId, agentId, taskId },
      tags: ['agent', 'activation', agent.type],
      level: 'INFO'
    });
    
    agent.status = 'active';
    agent.currentTask = taskId;
    this.agents.set(agentId, agent);
    
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`⚡ Agent activated: ${agent.name} for task ${taskId}`);
    return trace.id;
  }
  
  async traceAgentCommunication(fromAgentId, toAgentId, message, messageType) {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);
    
    if (!fromAgent && fromAgentId !== 'all-agents') return null;
    
    const trace = this.langfuse.trace({
      id: `agent_comm_${fromAgentId}_${toAgentId}_${Date.now()}`,
      name: `📡 Agent Communication: ${fromAgent?.name || fromAgentId} → ${toAgent?.name || toAgentId}`,
      sessionId: this.config.sessionId,
      userId: fromAgentId,
      input: { fromAgentId, toAgentId, message, messageType },
      output: { status: 'sent', messageDelivered: true },
      metadata: { swarmId: this.config.swarmId, fromAgentId, toAgentId, messageType },
      tags: ['agent', 'communication', messageType],
      level: 'INFO'
    });
    
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`📡 Communication: ${fromAgent?.name || fromAgentId} → ${toAgent?.name || toAgentId} (${messageType})`);
    return trace.id;
  }
  
  async traceAgentComplete(agentId, status) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    const trace = this.langfuse.trace({
      id: `agent_complete_${agentId}_${Date.now()}`,
      name: `🏁 Agent Completed: ${agent.name}`,
      sessionId: this.config.sessionId,
      userId: agentId,
      input: { agentId, status },
      output: { status, totalTime: Date.now() - agent.spawnTime },
      metadata: { swarmId: this.config.swarmId, agentId, status },
      tags: ['agent', 'complete', status],
      level: 'INFO'
    });
    
    agent.status = status;
    agent.completionTime = Date.now();
    this.agents.set(agentId, agent);
    this.metrics.activeAgents--;
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`🏁 Agent completed: ${agent.name} (${status})`);
    return trace.id;
  }
  
  async traceConsensusVotingRound(votingRoundId, topic, participants, proposalData) {
    const trace = this.langfuse.trace({
      id: `consensus_voting_${votingRoundId}_${Date.now()}`,
      name: `🗳️ Consensus Voting: ${topic}`,
      sessionId: this.config.sessionId,
      userId: 'consensus-coordinator',
      input: { votingRoundId, topic, participants, proposalData },
      output: { status: 'voting_started', participantCount: participants.length },
      metadata: { swarmId: this.config.swarmId, votingRoundId, topic },
      tags: ['consensus', 'voting', 'decision'],
      level: 'INFO'
    });
    
    this.consensusVotes.set(votingRoundId, {
      id: votingRoundId,
      topic,
      participants,
      proposalData,
      votes: new Map(),
      startTime: Date.now(),
      status: 'active'
    });
    
    this.metrics.consensusRounds++;
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`🗳️ Consensus voting started: ${topic} (${participants.length} participants)`);
    return trace.id;
  }
  
  async traceConsensusVote(votingRoundId, agentId, vote, reasoning) {
    const votingData = this.consensusVotes.get(votingRoundId);
    if (!votingData) return null;
    
    const agent = this.agents.get(agentId);
    
    const trace = this.langfuse.trace({
      id: `consensus_vote_${votingRoundId}_${agentId}_${Date.now()}`,
      name: `✋ Consensus Vote: ${agent?.name || agentId}`,
      sessionId: this.config.sessionId,
      userId: agentId,
      input: { votingRoundId, agentId, vote, reasoning },
      output: { status: 'vote_recorded', vote, totalVotes: votingData.votes.size + 1 },
      metadata: { swarmId: this.config.swarmId, votingRoundId, agentId, vote },
      tags: ['consensus', 'vote', 'decision', vote.toString()],
      level: 'INFO'
    });
    
    votingData.votes.set(agentId, { agentId, vote, reasoning, timestamp: Date.now() });
    this.consensusVotes.set(votingRoundId, votingData);
    
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`✋ Vote cast: ${agent?.name || agentId} → ${vote} (${votingData.votes.size}/${votingData.participants.length})`);
    return trace.id;
  }
  
  async traceConsensusResult(votingRoundId, result, outcome, statistics) {
    const votingData = this.consensusVotes.get(votingRoundId);
    if (!votingData) return null;
    
    const trace = this.langfuse.trace({
      id: `consensus_result_${votingRoundId}_${Date.now()}`,
      name: `📊 Consensus Result: ${votingData.topic}`,
      sessionId: this.config.sessionId,
      userId: 'consensus-coordinator',
      input: { votingRoundId, totalVotes: votingData.votes.size },
      output: { result, outcome, statistics },
      metadata: { swarmId: this.config.swarmId, votingRoundId, result, outcome },
      tags: ['consensus', 'result', outcome],
      level: 'INFO'
    });
    
    votingData.result = result;
    votingData.outcome = outcome;
    votingData.statistics = statistics;
    votingData.status = 'completed';
    this.consensusVotes.set(votingRoundId, votingData);
    
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`📊 Consensus result: ${result} (${outcome})`);
    return trace.id;
  }
  
  async traceMemoryOperation(operationType, agentId, key, value, metadata = {}) {
    const agent = this.agents.get(agentId);
    
    const trace = this.langfuse.trace({
      id: `memory_${operationType}_${agentId}_${Date.now()}`,
      name: `🧠 Memory ${operationType.toUpperCase()}: ${key}`,
      sessionId: this.config.sessionId,
      userId: agentId,
      input: { operationType, agentId, key, value, metadata },
      output: { status: 'success', operationType, key },
      metadata: { swarmId: this.config.swarmId, operationType, agentId, key },
      tags: ['memory', operationType, 'storage'],
      level: 'INFO'
    });
    
    this.memoryOps.set(`${operationType}_${agentId}_${key}_${Date.now()}`, {
      type: operationType,
      agentId,
      key,
      value,
      timestamp: Date.now(),
      metadata
    });
    
    this.metrics.memoryOperations++;
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`🧠 Memory ${operationType}: ${agent?.name || agentId} → ${key}`);
    return trace.id;
  }
  
  async traceTaskDistribution(taskId, description, assignedAgents, priority, metadata = {}) {
    const trace = this.langfuse.trace({
      id: `task_distribution_${taskId}_${Date.now()}`,
      name: `📋 Task Distribution: ${description}`,
      sessionId: this.config.sessionId,
      userId: 'task-coordinator',
      input: { taskId, description, assignedAgents, priority, metadata },
      output: { status: 'distributed', agentCount: assignedAgents.length },
      metadata: { swarmId: this.config.swarmId, taskId, description, priority },
      tags: ['task', 'distribution', priority],
      level: 'INFO'
    });
    
    this.tasks.set(taskId, {
      id: taskId,
      description,
      assignedAgents,
      priority,
      metadata,
      distributionTime: Date.now(),
      status: 'distributed',
      completions: new Map()
    });
    
    this.metrics.totalTasks++;
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`📋 Task distributed: ${description} → ${assignedAgents.length} agents`);
    return trace.id;
  }
  
  async traceTaskCompletion(taskId, agentId, result, success, completionData = {}) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    const agent = this.agents.get(agentId);
    
    const trace = this.langfuse.trace({
      id: `task_completion_${taskId}_${agentId}_${Date.now()}`,
      name: `✅ Task Completion: ${task.description}`,
      sessionId: this.config.sessionId,
      userId: agentId,
      input: { taskId, agentId, description: task.description },
      output: { result, success, completionData },
      metadata: { swarmId: this.config.swarmId, taskId, agentId, success },
      tags: ['task', 'completion', success ? 'success' : 'failure'],
      level: success ? 'INFO' : 'ERROR'
    });
    
    task.completions.set(agentId, {
      agentId,
      result,
      success,
      completionTime: Date.now(),
      completionData
    });
    
    if (success) {
      this.metrics.completedTasks++;
    }
    
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`✅ Task completion: ${agent?.name || agentId} - ${success ? 'SUCCESS' : 'FAILURE'}`);
    return trace.id;
  }
  
  async tracePerformanceMetrics(metricsData, source) {
    const trace = this.langfuse.trace({
      id: `performance_metrics_${Date.now()}`,
      name: `📊 Performance Metrics: ${source}`,
      sessionId: this.config.sessionId,
      userId: 'performance-monitor',
      input: { source, metricsType: 'performance' },
      output: metricsData,
      metadata: { swarmId: this.config.swarmId, source },
      tags: ['performance', 'metrics', source],
      level: 'INFO'
    });
    
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`📊 Performance metrics: ${source}`);
    return trace.id;
  }
  
  async traceError(agentId, error, context) {
    const agent = this.agents.get(agentId);
    
    const trace = this.langfuse.trace({
      id: `error_${context}_${Date.now()}`,
      name: `❌ Error: ${error.message}`,
      sessionId: this.config.sessionId,
      userId: agentId || 'system',
      input: { context, errorMessage: error.message, agentId },
      output: { errorType: error.name, errorMessage: error.message },
      metadata: { swarmId: this.config.swarmId, agentId, context },
      tags: ['error', context, agentId ? 'agent-error' : 'system-error'],
      level: 'ERROR'
    });
    
    this.metrics.errors++;
    this.metrics.totalTraces++;
    
    await this.langfuse.flushAsync();
    
    console.log(`❌ Error traced: ${error.message} (${context})`);
    return trace.id;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async shutdown() {
    console.log('🛑 Shutting down demo...');
    await this.langfuse.shutdownAsync();
    console.log('✅ Demo shutdown complete');
  }
}

// Main execution
if (require.main === module) {
  const demo = new SwarmTracingDemo();
  
  console.log('🎭 Starting Comprehensive Swarm Tracing Demo...');
  console.log('🌐 This simulates what would be sent to Langfuse at http://localhost:3000');
  console.log('📊 All swarm activity types will be demonstrated...');
  
  demo.runComprehensiveDemo().then(() => {
    console.log('🎉 Demo completed successfully!');
    demo.shutdown().then(() => {
      process.exit(0);
    });
  }).catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { SwarmTracingDemo };