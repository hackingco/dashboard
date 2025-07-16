/**
 * Comprehensive Langfuse Tracing Configuration for Swarm Activities
 * Port: 3000 (http://localhost:3000)
 * Features: Agent lifecycle, consensus voting, memory operations, performance monitoring
 */

const { Langfuse } = require('langfuse');
const { EventEmitter } = require('events');

class SwarmActivityTracer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Swarm configuration
    this.swarmId = config.swarmId || `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId || `session_${Date.now()}`;
    this.tracePrefix = config.tracePrefix || 'swarm';
    
    // Langfuse configuration for port 3000
    this.langfuseConfig = {
      publicKey: config.publicKey || process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-REDACTED',
      secretKey: config.secretKey || process.env.LANGFUSE_SECRET_KEY || 'sk-lf-cmd2y5m640009pw076fvuxp9s',
      baseUrl: config.baseUrl || process.env.LANGFUSE_HOST || 'http://localhost:3000',
      flushAt: config.flushAt || 50,
      flushInterval: config.flushInterval || 3000,
      requestTimeout: config.requestTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      debug: config.debug || false
    };
    
    // Initialize Langfuse client
    this.langfuse = new Langfuse(this.langfuseConfig);
    
    // Activity tracking
    this.activities = {
      agents: new Map(),
      tasks: new Map(),
      consensusVotes: new Map(),
      memoryOperations: new Map(),
      performances: new Map()
    };
    
    // Metrics
    this.metrics = {
      totalAgents: 0,
      activeAgents: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      consensusRounds: 0,
      memoryOperations: 0,
      totalTraces: 0,
      totalSpans: 0,
      startTime: Date.now(),
      lastActivity: Date.now()
    };
    
    // Start monitoring
    this.startMonitoring();
    
    console.log(`🔍 Swarm Activity Tracer initialized`);
    console.log(`📊 Swarm ID: ${this.swarmId}`);
    console.log(`🌐 Langfuse URL: ${this.langfuseConfig.baseUrl}`);
    console.log(`🔗 Session ID: ${this.sessionId}`);
  }
  
  /**
   * 1. Agent Lifecycle Events
   */
  
  async traceAgentSpawn(agentId, agentName, agentType, capabilities = [], metadata = {}) {
    try {
      const spawnTime = Date.now();
      const traceId = `${this.tracePrefix}_agent_spawn_${agentId}_${spawnTime}`;
      
      // Store agent data
      this.activities.agents.set(agentId, {
        id: agentId,
        name: agentName,
        type: agentType,
        capabilities,
        spawnTime,
        status: 'active',
        tasksCompleted: 0,
        consensusVotes: 0,
        memoryWrites: 0,
        memoryReads: 0,
        ...metadata
      });
      
      // Create trace
      const trace = this.langfuse.trace({
        id: traceId,
        name: `🤖 Agent Spawned: ${agentName}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          agentId,
          agentName,
          agentType,
          capabilities,
          spawnTime: new Date(spawnTime).toISOString(),
          metadata
        },
        output: {
          status: 'spawned',
          assignedCapabilities: capabilities,
          readyForTasks: true
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          agentName,
          agentType,
          capabilities,
          spawnTimestamp: new Date(spawnTime).toISOString(),
          totalActiveAgents: this.activities.agents.size,
          ...metadata
        },
        tags: ['agent', 'spawn', agentType, 'lifecycle'],
        level: 'INFO'
      });
      
      // Create lifecycle span
      const lifecycleSpan = trace.span({
        name: `Agent Lifecycle: ${agentName}`,
        input: { phase: 'active', status: 'spawned' },
        metadata: {
          agentId,
          agentName,
          agentType,
          phase: 'active',
          capabilities
        }
      });
      
      // Update agent with span reference
      const agentData = this.activities.agents.get(agentId);
      agentData.lifecycleSpan = lifecycleSpan;
      agentData.trace = trace;
      this.activities.agents.set(agentId, agentData);
      
      this.metrics.totalAgents++;
      this.metrics.activeAgents++;
      this.metrics.totalTraces++;
      this.metrics.totalSpans++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('agent_spawned', {
        swarmId: this.swarmId,
        agentId,
        agentName,
        agentType,
        capabilities,
        traceId
      });
      
      console.log(`🤖 Agent spawned: ${agentName} (${agentType}) - ${capabilities.join(', ')}`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace agent spawn for ${agentId}:`, error);
      await this.traceError(agentId, error, 'agent_spawn');
      return null;
    }
  }
  
  async traceAgentActivation(agentId, taskId, activationData = {}) {
    try {
      const agent = this.activities.agents.get(agentId);
      if (!agent) {
        console.warn(`⚠️ Agent ${agentId} not found`);
        return null;
      }
      
      const activationTime = Date.now();
      const traceId = `${this.tracePrefix}_agent_activation_${agentId}_${activationTime}`;
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `⚡ Agent Activated: ${agent.name}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          agentId,
          taskId,
          activationTime: new Date(activationTime).toISOString(),
          ...activationData
        },
        output: {
          status: 'activated',
          readyForTask: true,
          taskId
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          agentName: agent.name,
          agentType: agent.type,
          taskId,
          activationTimestamp: new Date(activationTime).toISOString(),
          ...activationData
        },
        tags: ['agent', 'activation', agent.type, 'task'],
        level: 'INFO'
      });
      
      agent.status = 'active';
      agent.currentTask = taskId;
      this.activities.agents.set(agentId, agent);
      
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('agent_activated', {
        swarmId: this.swarmId,
        agentId,
        taskId,
        traceId
      });
      
      console.log(`⚡ Agent activated: ${agent.name} for task ${taskId}`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace agent activation for ${agentId}:`, error);
      await this.traceError(agentId, error, 'agent_activation');
      return null;
    }
  }
  
  async traceAgentCommunication(fromAgentId, toAgentId, message, messageType = 'coordination') {
    try {
      const fromAgent = this.activities.agents.get(fromAgentId);
      const toAgent = this.activities.agents.get(toAgentId);
      
      if (!fromAgent || !toAgent) {
        console.warn(`⚠️ Agent communication failed: agents not found`);
        return null;
      }
      
      const communicationTime = Date.now();
      const traceId = `${this.tracePrefix}_agent_comm_${fromAgentId}_${toAgentId}_${communicationTime}`;
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `📡 Agent Communication: ${fromAgent.name} → ${toAgent.name}`,
        sessionId: this.sessionId,
        userId: fromAgentId,
        input: {
          fromAgentId,
          toAgentId,
          message,
          messageType,
          timestamp: new Date(communicationTime).toISOString()
        },
        output: {
          status: 'sent',
          messageDelivered: true,
          responseExpected: messageType === 'request'
        },
        metadata: {
          swarmId: this.swarmId,
          fromAgentId,
          fromAgentName: fromAgent.name,
          toAgentId,
          toAgentName: toAgent.name,
          messageType,
          communicationTimestamp: new Date(communicationTime).toISOString(),
          messageLength: message.length
        },
        tags: ['agent', 'communication', messageType, 'inter-agent'],
        level: 'INFO'
      });
      
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('agent_communication', {
        swarmId: this.swarmId,
        fromAgentId,
        toAgentId,
        message,
        messageType,
        traceId
      });
      
      console.log(`📡 Agent communication: ${fromAgent.name} → ${toAgent.name} (${messageType})`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace agent communication:`, error);
      await this.traceError(fromAgentId, error, 'agent_communication');
      return null;
    }
  }
  
  async traceAgentComplete(agentId, finalStatus = 'completed', completionData = {}) {
    try {
      const agent = this.activities.agents.get(agentId);
      if (!agent) {
        console.warn(`⚠️ Agent ${agentId} not found`);
        return null;
      }
      
      const completionTime = Date.now();
      const totalTime = completionTime - agent.spawnTime;
      const traceId = `${this.tracePrefix}_agent_complete_${agentId}_${completionTime}`;
      
      // End lifecycle span
      if (agent.lifecycleSpan) {
        agent.lifecycleSpan.end({
          output: {
            status: finalStatus,
            totalTime,
            tasksCompleted: agent.tasksCompleted,
            completionTime: new Date(completionTime).toISOString()
          },
          metadata: {
            agentId,
            agentName: agent.name,
            finalStatus,
            totalTime,
            tasksCompleted: agent.tasksCompleted,
            completionTimestamp: new Date(completionTime).toISOString()
          }
        });
      }
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `🏁 Agent Completed: ${agent.name}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          agentId,
          finalStatus,
          completionTime: new Date(completionTime).toISOString(),
          ...completionData
        },
        output: {
          status: finalStatus,
          totalTime,
          tasksCompleted: agent.tasksCompleted,
          consensusVotes: agent.consensusVotes,
          memoryOperations: agent.memoryWrites + agent.memoryReads
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          agentName: agent.name,
          agentType: agent.type,
          finalStatus,
          totalTime,
          tasksCompleted: agent.tasksCompleted,
          consensusVotes: agent.consensusVotes,
          memoryWrites: agent.memoryWrites,
          memoryReads: agent.memoryReads,
          completionTimestamp: new Date(completionTime).toISOString(),
          ...completionData
        },
        tags: ['agent', 'complete', finalStatus, agent.type],
        level: finalStatus === 'completed' ? 'INFO' : 'ERROR'
      });
      
      agent.status = finalStatus;
      agent.completionTime = completionTime;
      this.activities.agents.set(agentId, agent);
      
      this.metrics.activeAgents--;
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('agent_completed', {
        swarmId: this.swarmId,
        agentId,
        finalStatus,
        totalTime,
        traceId
      });
      
      console.log(`🏁 Agent completed: ${agent.name} (${finalStatus}) - ${totalTime}ms`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace agent completion for ${agentId}:`, error);
      await this.traceError(agentId, error, 'agent_completion');
      return null;
    }
  }
  
  /**
   * 2. Consensus Voting Processes
   */
  
  async traceConsensusVotingRound(votingRoundId, topic, participants, proposalData = {}) {
    try {
      const votingStartTime = Date.now();
      const traceId = `${this.tracePrefix}_consensus_voting_${votingRoundId}_${votingStartTime}`;
      
      // Store voting round data
      this.activities.consensusVotes.set(votingRoundId, {
        id: votingRoundId,
        topic,
        participants,
        proposalData,
        startTime: votingStartTime,
        votes: new Map(),
        status: 'active',
        result: null
      });
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `🗳️ Consensus Voting: ${topic}`,
        sessionId: this.sessionId,
        userId: 'consensus-coordinator',
        input: {
          votingRoundId,
          topic,
          participants,
          proposalData,
          startTime: new Date(votingStartTime).toISOString()
        },
        output: {
          status: 'voting_started',
          participantCount: participants.length,
          expectedVotes: participants.length
        },
        metadata: {
          swarmId: this.swarmId,
          votingRoundId,
          topic,
          participants,
          participantCount: participants.length,
          votingStartTime: new Date(votingStartTime).toISOString(),
          proposalData
        },
        tags: ['consensus', 'voting', 'decision', 'coordination'],
        level: 'INFO'
      });
      
      // Create voting span
      const votingSpan = trace.span({
        name: `Voting Process: ${topic}`,
        input: {
          phase: 'collecting_votes',
          participants,
          expectedVotes: participants.length
        },
        metadata: {
          votingRoundId,
          topic,
          participants,
          phase: 'collecting_votes'
        }
      });
      
      // Store span reference
      const votingData = this.activities.consensusVotes.get(votingRoundId);
      votingData.trace = trace;
      votingData.span = votingSpan;
      this.activities.consensusVotes.set(votingRoundId, votingData);
      
      this.metrics.consensusRounds++;
      this.metrics.totalTraces++;
      this.metrics.totalSpans++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('consensus_voting_started', {
        swarmId: this.swarmId,
        votingRoundId,
        topic,
        participants,
        traceId
      });
      
      console.log(`🗳️ Consensus voting started: ${topic} (${participants.length} participants)`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace consensus voting:`, error);
      await this.traceError(null, error, 'consensus_voting');
      return null;
    }
  }
  
  async traceConsensusVote(votingRoundId, agentId, vote, reasoning = '') {
    try {
      const votingData = this.activities.consensusVotes.get(votingRoundId);
      if (!votingData) {
        console.warn(`⚠️ Voting round ${votingRoundId} not found`);
        return null;
      }
      
      const voteTime = Date.now();
      const traceId = `${this.tracePrefix}_consensus_vote_${votingRoundId}_${agentId}_${voteTime}`;
      
      // Store vote
      votingData.votes.set(agentId, {
        agentId,
        vote,
        reasoning,
        voteTime,
        timestamp: new Date(voteTime).toISOString()
      });
      
      const agent = this.activities.agents.get(agentId);
      if (agent) {
        agent.consensusVotes++;
        this.activities.agents.set(agentId, agent);
      }
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `✋ Consensus Vote: ${agent?.name || agentId}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          votingRoundId,
          agentId,
          vote,
          reasoning,
          voteTime: new Date(voteTime).toISOString()
        },
        output: {
          status: 'vote_recorded',
          vote,
          totalVotes: votingData.votes.size,
          remainingVotes: votingData.participants.length - votingData.votes.size
        },
        metadata: {
          swarmId: this.swarmId,
          votingRoundId,
          agentId,
          agentName: agent?.name || 'unknown',
          vote,
          reasoning,
          voteTimestamp: new Date(voteTime).toISOString(),
          totalVotes: votingData.votes.size,
          remainingVotes: votingData.participants.length - votingData.votes.size,
          topic: votingData.topic
        },
        tags: ['consensus', 'vote', 'decision', vote.toString()],
        level: 'INFO'
      });
      
      this.activities.consensusVotes.set(votingRoundId, votingData);
      
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('consensus_vote_cast', {
        swarmId: this.swarmId,
        votingRoundId,
        agentId,
        vote,
        reasoning,
        totalVotes: votingData.votes.size,
        traceId
      });
      
      console.log(`✋ Consensus vote cast: ${agent?.name || agentId} → ${vote} (${votingData.votes.size}/${votingData.participants.length})`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace consensus vote:`, error);
      await this.traceError(agentId, error, 'consensus_vote');
      return null;
    }
  }
  
  async traceConsensusResult(votingRoundId, result, outcome, statistics = {}) {
    try {
      const votingData = this.activities.consensusVotes.get(votingRoundId);
      if (!votingData) {
        console.warn(`⚠️ Voting round ${votingRoundId} not found`);
        return null;
      }
      
      const resultTime = Date.now();
      const totalTime = resultTime - votingData.startTime;
      const traceId = `${this.tracePrefix}_consensus_result_${votingRoundId}_${resultTime}`;
      
      // End voting span
      if (votingData.span) {
        votingData.span.end({
          output: {
            result,
            outcome,
            totalTime,
            totalVotes: votingData.votes.size,
            resultTime: new Date(resultTime).toISOString()
          },
          metadata: {
            votingRoundId,
            result,
            outcome,
            totalTime,
            totalVotes: votingData.votes.size,
            resultTimestamp: new Date(resultTime).toISOString(),
            statistics
          }
        });
      }
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `📊 Consensus Result: ${votingData.topic}`,
        sessionId: this.sessionId,
        userId: 'consensus-coordinator',
        input: {
          votingRoundId,
          totalVotes: votingData.votes.size,
          expectedVotes: votingData.participants.length
        },
        output: {
          result,
          outcome,
          totalTime,
          votingEfficiency: (votingData.votes.size / votingData.participants.length) * 100,
          consensusReached: outcome === 'consensus'
        },
        metadata: {
          swarmId: this.swarmId,
          votingRoundId,
          topic: votingData.topic,
          result,
          outcome,
          totalTime,
          totalVotes: votingData.votes.size,
          expectedVotes: votingData.participants.length,
          votingEfficiency: (votingData.votes.size / votingData.participants.length) * 100,
          consensusReached: outcome === 'consensus',
          resultTimestamp: new Date(resultTime).toISOString(),
          statistics
        },
        tags: ['consensus', 'result', outcome, 'decision'],
        level: outcome === 'consensus' ? 'INFO' : 'WARN'
      });
      
      votingData.status = 'completed';
      votingData.result = result;
      votingData.outcome = outcome;
      votingData.resultTime = resultTime;
      votingData.statistics = statistics;
      this.activities.consensusVotes.set(votingRoundId, votingData);
      
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('consensus_result', {
        swarmId: this.swarmId,
        votingRoundId,
        result,
        outcome,
        totalTime,
        traceId
      });
      
      console.log(`📊 Consensus result: ${votingData.topic} → ${result} (${outcome}) - ${totalTime}ms`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace consensus result:`, error);
      await this.traceError(null, error, 'consensus_result');
      return null;
    }
  }
  
  /**
   * 3. Memory Operations and Sharing
   */
  
  async traceMemoryOperation(operationType, agentId, key, value, metadata = {}) {
    try {
      const operationTime = Date.now();
      const operationId = `${operationType}_${agentId}_${key}_${operationTime}`;
      const traceId = `${this.tracePrefix}_memory_${operationType}_${operationId}`;
      
      // Store memory operation
      this.activities.memoryOperations.set(operationId, {
        id: operationId,
        type: operationType,
        agentId,
        key,
        value,
        timestamp: operationTime,
        metadata
      });
      
      const agent = this.activities.agents.get(agentId);
      if (agent) {
        if (operationType === 'store' || operationType === 'update') {
          agent.memoryWrites++;
        } else if (operationType === 'retrieve' || operationType === 'search') {
          agent.memoryReads++;
        }
        this.activities.agents.set(agentId, agent);
      }
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `🧠 Memory ${operationType.toUpperCase()}: ${key}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          operationType,
          agentId,
          key,
          value: operationType === 'retrieve' ? null : value,
          timestamp: new Date(operationTime).toISOString(),
          metadata
        },
        output: {
          status: 'success',
          operationType,
          key,
          valueSize: value ? JSON.stringify(value).length : 0,
          retrievedValue: operationType === 'retrieve' ? value : null
        },
        metadata: {
          swarmId: this.swarmId,
          operationType,
          agentId,
          agentName: agent?.name || 'unknown',
          key,
          valueSize: value ? JSON.stringify(value).length : 0,
          operationTimestamp: new Date(operationTime).toISOString(),
          totalMemoryOps: this.metrics.memoryOperations + 1,
          ...metadata
        },
        tags: ['memory', operationType, 'storage', 'sharing'],
        level: 'INFO'
      });
      
      this.metrics.memoryOperations++;
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('memory_operation', {
        swarmId: this.swarmId,
        operationType,
        agentId,
        key,
        value,
        traceId
      });
      
      console.log(`🧠 Memory ${operationType}: ${agent?.name || agentId} → ${key}`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace memory operation:`, error);
      await this.traceError(agentId, error, 'memory_operation');
      return null;
    }
  }
  
  /**
   * 4. Task Distribution and Completion
   */
  
  async traceTaskDistribution(taskId, description, assignedAgents, priority = 'medium', metadata = {}) {
    try {
      const distributionTime = Date.now();
      const traceId = `${this.tracePrefix}_task_distribution_${taskId}_${distributionTime}`;
      
      // Store task data
      this.activities.tasks.set(taskId, {
        id: taskId,
        description,
        assignedAgents,
        priority,
        distributionTime,
        status: 'distributed',
        completions: new Map(),
        metadata
      });
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `📋 Task Distribution: ${description}`,
        sessionId: this.sessionId,
        userId: 'task-coordinator',
        input: {
          taskId,
          description,
          assignedAgents,
          priority,
          distributionTime: new Date(distributionTime).toISOString(),
          metadata
        },
        output: {
          status: 'distributed',
          agentCount: assignedAgents.length,
          expectedCompletions: assignedAgents.length
        },
        metadata: {
          swarmId: this.swarmId,
          taskId,
          description,
          assignedAgents,
          priority,
          agentCount: assignedAgents.length,
          distributionTimestamp: new Date(distributionTime).toISOString(),
          expectedCompletions: assignedAgents.length,
          ...metadata
        },
        tags: ['task', 'distribution', priority, 'coordination'],
        level: 'INFO'
      });
      
      // Create task execution span
      const executionSpan = trace.span({
        name: `Task Execution: ${description}`,
        input: {
          phase: 'executing',
          assignedAgents,
          priority
        },
        metadata: {
          taskId,
          description,
          assignedAgents,
          priority,
          phase: 'executing'
        }
      });
      
      // Store span reference
      const taskData = this.activities.tasks.get(taskId);
      taskData.trace = trace;
      taskData.span = executionSpan;
      this.activities.tasks.set(taskId, taskData);
      
      this.metrics.totalTasks++;
      this.metrics.totalTraces++;
      this.metrics.totalSpans++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('task_distributed', {
        swarmId: this.swarmId,
        taskId,
        description,
        assignedAgents,
        priority,
        traceId
      });
      
      console.log(`📋 Task distributed: ${description} → ${assignedAgents.length} agents (${priority})`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace task distribution:`, error);
      await this.traceError(null, error, 'task_distribution');
      return null;
    }
  }
  
  async traceTaskCompletion(taskId, agentId, result, success = true, completionData = {}) {
    try {
      const taskData = this.activities.tasks.get(taskId);
      if (!taskData) {
        console.warn(`⚠️ Task ${taskId} not found`);
        return null;
      }
      
      const completionTime = Date.now();
      const executionTime = completionTime - taskData.distributionTime;
      const traceId = `${this.tracePrefix}_task_completion_${taskId}_${agentId}_${completionTime}`;
      
      // Store completion data
      taskData.completions.set(agentId, {
        agentId,
        result,
        success,
        completionTime,
        executionTime,
        ...completionData
      });
      
      const agent = this.activities.agents.get(agentId);
      if (agent) {
        agent.tasksCompleted++;
        this.activities.agents.set(agentId, agent);
      }
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `✅ Task Completion: ${taskData.description}`,
        sessionId: this.sessionId,
        userId: agentId,
        input: {
          taskId,
          agentId,
          description: taskData.description,
          completionTime: new Date(completionTime).toISOString()
        },
        output: {
          result,
          success,
          executionTime,
          completionsCount: taskData.completions.size,
          remainingAgents: taskData.assignedAgents.length - taskData.completions.size
        },
        metadata: {
          swarmId: this.swarmId,
          taskId,
          agentId,
          agentName: agent?.name || 'unknown',
          description: taskData.description,
          result,
          success,
          executionTime,
          completionTimestamp: new Date(completionTime).toISOString(),
          completionsCount: taskData.completions.size,
          expectedCompletions: taskData.assignedAgents.length,
          remainingAgents: taskData.assignedAgents.length - taskData.completions.size,
          ...completionData
        },
        tags: ['task', 'completion', success ? 'success' : 'failure', taskData.priority],
        level: success ? 'INFO' : 'ERROR'
      });
      
      // Check if all agents have completed
      const allCompleted = taskData.completions.size === taskData.assignedAgents.length;
      if (allCompleted) {
        taskData.status = 'completed';
        
        // End task execution span
        if (taskData.span) {
          const successfulCompletions = Array.from(taskData.completions.values()).filter(c => c.success).length;
          taskData.span.end({
            output: {
              status: 'completed',
              totalCompletions: taskData.completions.size,
              successfulCompletions,
              failedCompletions: taskData.completions.size - successfulCompletions,
              totalExecutionTime: completionTime - taskData.distributionTime
            },
            metadata: {
              taskId,
              status: 'completed',
              totalCompletions: taskData.completions.size,
              successfulCompletions,
              failedCompletions: taskData.completions.size - successfulCompletions,
              totalExecutionTime: completionTime - taskData.distributionTime,
              completionTimestamp: new Date(completionTime).toISOString()
            }
          });
        }
        
        this.metrics.completedTasks++;
      }
      
      this.activities.tasks.set(taskId, taskData);
      
      if (!success) {
        this.metrics.failedTasks++;
      }
      
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('task_completed', {
        swarmId: this.swarmId,
        taskId,
        agentId,
        result,
        success,
        executionTime,
        allCompleted,
        traceId
      });
      
      console.log(`✅ Task completion: ${agent?.name || agentId} → ${taskData.description} (${success ? 'success' : 'failure'}) - ${executionTime}ms`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace task completion:`, error);
      await this.traceError(agentId, error, 'task_completion');
      return null;
    }
  }
  
  /**
   * 5. Performance Metrics and Bottlenecks
   */
  
  async tracePerformanceMetrics(metricsData, source = 'system') {
    try {
      const metricsTime = Date.now();
      const traceId = `${this.tracePrefix}_performance_metrics_${metricsTime}`;
      
      // Store performance data
      this.activities.performances.set(metricsTime, {
        timestamp: metricsTime,
        source,
        data: metricsData,
        id: traceId
      });
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `📊 Performance Metrics: ${source}`,
        sessionId: this.sessionId,
        userId: 'performance-monitor',
        input: {
          source,
          timestamp: new Date(metricsTime).toISOString(),
          metricsType: 'performance'
        },
        output: metricsData,
        metadata: {
          swarmId: this.swarmId,
          source,
          metricsTimestamp: new Date(metricsTime).toISOString(),
          totalActiveAgents: this.metrics.activeAgents,
          totalTasks: this.metrics.totalTasks,
          totalMemoryOps: this.metrics.memoryOperations,
          swarmUptime: metricsTime - this.metrics.startTime,
          ...metricsData
        },
        tags: ['performance', 'metrics', source, 'monitoring'],
        level: 'INFO'
      });
      
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('performance_metrics', {
        swarmId: this.swarmId,
        source,
        metricsData,
        traceId
      });
      
      console.log(`📊 Performance metrics logged: ${source}`);
      return traceId;
      
    } catch (error) {
      console.error(`❌ Failed to trace performance metrics:`, error);
      await this.traceError(null, error, 'performance_metrics');
      return null;
    }
  }
  
  /**
   * 6. Error Handling and Recovery
   */
  
  async traceError(agentId, error, context = 'unknown', additionalData = {}) {
    try {
      const errorTime = Date.now();
      const traceId = `${this.tracePrefix}_error_${context}_${errorTime}`;
      
      const agent = agentId ? this.activities.agents.get(agentId) : null;
      
      const trace = this.langfuse.trace({
        id: traceId,
        name: `❌ Swarm Error: ${error.message}`,
        sessionId: this.sessionId,
        userId: agentId || 'swarm-system',
        input: {
          context,
          errorMessage: error.message,
          errorStack: error.stack,
          agentId,
          timestamp: new Date(errorTime).toISOString(),
          additionalData
        },
        output: {
          errorType: error.name || 'Error',
          errorMessage: error.message,
          errorContext: context,
          affectedAgent: agentId,
          errorHandled: true
        },
        metadata: {
          swarmId: this.swarmId,
          agentId,
          agentName: agent?.name || 'unknown',
          errorType: error.name || 'Error',
          errorMessage: error.message,
          errorStack: error.stack,
          errorContext: context,
          errorTimestamp: new Date(errorTime).toISOString(),
          activeAgents: this.metrics.activeAgents,
          totalTasks: this.metrics.totalTasks,
          swarmUptime: errorTime - this.metrics.startTime,
          ...additionalData
        },
        tags: ['error', 'swarm', context, agentId ? 'agent-error' : 'system-error'],
        level: 'ERROR'
      });
      
      this.metrics.totalTraces++;
      this.metrics.lastActivity = Date.now();
      
      await this.langfuse.flushAsync();
      
      this.emit('error', {
        swarmId: this.swarmId,
        agentId,
        error: error.message,
        context,
        traceId
      });
      
      console.error(`❌ Error traced: ${error.message} (${context})`);
      return traceId;
      
    } catch (traceError) {
      console.error(`❌ Failed to trace error:`, traceError);
      return null;
    }
  }
  
  /**
   * 7. Monitoring and Utilities
   */
  
  startMonitoring() {
    // Real-time metrics collection
    this.monitoringInterval = setInterval(async () => {
      const currentTime = Date.now();
      const uptime = currentTime - this.metrics.startTime;
      
      const metricsData = {
        activeAgents: this.metrics.activeAgents,
        totalAgents: this.metrics.totalAgents,
        totalTasks: this.metrics.totalTasks,
        completedTasks: this.metrics.completedTasks,
        failedTasks: this.metrics.failedTasks,
        consensusRounds: this.metrics.consensusRounds,
        memoryOperations: this.metrics.memoryOperations,
        totalTraces: this.metrics.totalTraces,
        totalSpans: this.metrics.totalSpans,
        uptime,
        timestamp: new Date().toISOString(),
        avgTaskCompletionTime: this.calculateAvgTaskCompletionTime(),
        consensusSuccessRate: this.calculateConsensusSuccessRate(),
        memoryOperationsPerSecond: this.calculateMemoryOpsPerSecond(),
        agentUtilization: this.calculateAgentUtilization(),
        systemHealth: this.calculateSystemHealth()
      };
      
      await this.tracePerformanceMetrics(metricsData, 'real-time-monitor');
    }, 10000); // Every 10 seconds
    
    console.log('🔍 Real-time monitoring started');
  }
  
  calculateAvgTaskCompletionTime() {
    let totalTime = 0;
    let taskCount = 0;
    
    for (const task of this.activities.tasks.values()) {
      for (const completion of task.completions.values()) {
        if (completion.success) {
          totalTime += completion.executionTime;
          taskCount++;
        }
      }
    }
    
    return taskCount > 0 ? totalTime / taskCount : 0;
  }
  
  calculateConsensusSuccessRate() {
    let successCount = 0;
    let totalCount = 0;
    
    for (const vote of this.activities.consensusVotes.values()) {
      if (vote.status === 'completed') {
        totalCount++;
        if (vote.outcome === 'consensus') {
          successCount++;
        }
      }
    }
    
    return totalCount > 0 ? (successCount / totalCount) * 100 : 0;
  }
  
  calculateMemoryOpsPerSecond() {
    const uptime = Date.now() - this.metrics.startTime;
    const uptimeSeconds = uptime / 1000;
    
    return uptimeSeconds > 0 ? this.metrics.memoryOperations / uptimeSeconds : 0;
  }
  
  calculateAgentUtilization() {
    let totalUtilization = 0;
    let agentCount = 0;
    
    for (const agent of this.activities.agents.values()) {
      if (agent.status === 'active') {
        const utilizationScore = agent.tasksCompleted > 0 ? 
          Math.min(agent.tasksCompleted / 10, 1) : 0; // Normalized to 0-1
        totalUtilization += utilizationScore;
        agentCount++;
      }
    }
    
    return agentCount > 0 ? (totalUtilization / agentCount) * 100 : 0;
  }
  
  calculateSystemHealth() {
    const errorRate = this.metrics.totalTraces > 0 ? 
      (this.metrics.failedTasks / this.metrics.totalTraces) * 100 : 0;
    
    const consensusRate = this.calculateConsensusSuccessRate();
    const utilization = this.calculateAgentUtilization();
    
    // Health score based on error rate, consensus success, and utilization
    const healthScore = Math.max(0, 100 - errorRate) * 0.4 + 
                        consensusRate * 0.3 + 
                        utilization * 0.3;
    
    return Math.round(healthScore);
  }
  
  getCurrentMetrics() {
    return {
      swarmId: this.swarmId,
      sessionId: this.sessionId,
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      avgTaskCompletionTime: this.calculateAvgTaskCompletionTime(),
      consensusSuccessRate: this.calculateConsensusSuccessRate(),
      memoryOperationsPerSecond: this.calculateMemoryOpsPerSecond(),
      agentUtilization: this.calculateAgentUtilization(),
      systemHealth: this.calculateSystemHealth(),
      langfuseUrl: this.langfuseConfig.baseUrl
    };
  }
  
  async shutdown() {
    console.log('🛑 Shutting down Swarm Activity Tracer...');
    
    try {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      
      // Final metrics
      const finalMetrics = this.getCurrentMetrics();
      
      // Shutdown trace
      const shutdownTrace = this.langfuse.trace({
        id: `${this.tracePrefix}_shutdown_${Date.now()}`,
        name: '🛑 Swarm Activity Tracer Shutdown',
        sessionId: this.sessionId,
        userId: 'swarm-system',
        input: {
          shutdownTime: new Date().toISOString(),
          finalMetrics
        },
        output: {
          status: 'shutdown',
          totalTracesProcessed: this.metrics.totalTraces,
          totalSpansProcessed: this.metrics.totalSpans,
          uptimeMs: Date.now() - this.metrics.startTime
        },
        metadata: {
          swarmId: this.swarmId,
          shutdownTimestamp: new Date().toISOString(),
          finalMetrics
        },
        tags: ['shutdown', 'swarm', 'tracer'],
        level: 'INFO'
      });
      
      await this.langfuse.flushAsync();
      await this.langfuse.shutdownAsync();
      
      this.removeAllListeners();
      
      console.log('✅ Swarm Activity Tracer shutdown completed');
      console.log('📊 Final metrics:', finalMetrics);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

module.exports = { SwarmActivityTracer };