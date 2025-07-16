# Hive Mind Service

**Advanced Swarm Coordination & Consensus Engine**

*Distributed intelligence coordination with neural patterns, consensus mechanisms, and performance optimization*

---

## 🚀 Overview

The Hive Mind Service represents the advanced coordination layer of the swarm intelligence platform. It provides sophisticated agent communication protocols, distributed consensus mechanisms, and neural pattern recognition for optimizing swarm performance. Built with Node.js and designed for high-throughput coordination, it enables emergent intelligent behavior across distributed agent networks.

## ✨ Key Features

### 🧠 Intelligent Coordination
- **Neural Pattern Recognition** - Learn and optimize coordination patterns
- **Distributed Consensus** - Byzantine fault-tolerant consensus algorithms
- **Adaptive Topology** - Dynamic network topology optimization
- **Emergent Behavior** - Enable swarm-level intelligent decision making
- **Performance Optimization** - Continuous learning and improvement

### 📡 Advanced Communication
- **Multi-Protocol Support** - WebSocket, HTTP, and custom protocols
- **Message Routing** - Intelligent message routing and optimization
- **Event Broadcasting** - Efficient event propagation across the swarm
- **Priority Queuing** - Priority-based message handling
- **Compression & Encryption** - Secure and efficient data transmission

### 🔗 Consensus Mechanisms
- **RAFT Consensus** - Leader election and log replication
- **Byzantine Fault Tolerance** - Handle malicious or faulty agents
- **Proof of Coordination** - Custom consensus for agent coordination
- **Conflict Resolution** - Automatic conflict detection and resolution
- **State Synchronization** - Maintain consistent global state

### 🎯 Hook Integration
- **Claude Flow Hooks** - Deep integration with Claude Flow coordination
- **Performance Monitoring** - Real-time performance tracking and optimization
- **Agent Hook Listeners** - Monitor and respond to agent lifecycle events
- **Swarm Hook Coordination** - Coordinate hooks across multiple agents
- **Neural Training** - Continuous learning from coordination patterns

---

## 🏗️ Architecture

### Service Structure
```
apps/hive-mind/
├── src/
│   ├── server.js                    # Main server and coordination engine
│   ├── communication/               # Communication protocols
│   │   ├── agent-protocols.js       # Agent communication protocols
│   │   ├── message-router.js        # Message routing and optimization
│   │   ├── event-broadcaster.js     # Event broadcasting system
│   │   └── priority-queue.js        # Priority-based message queuing
│   ├── consensus/                   # Consensus mechanisms
│   │   ├── raft-consensus.js        # RAFT consensus implementation
│   │   ├── byzantine-tolerance.js   # Byzantine fault tolerance
│   │   ├── conflict-resolver.js     # Conflict detection and resolution
│   │   └── hook-consensus-manager.js # Hook-based consensus
│   ├── hooks/                       # Hook integration system
│   │   ├── agent-hook-listeners.js  # Agent lifecycle hook listeners
│   │   ├── swarm-hook-coordinator.js # Swarm-wide hook coordination
│   │   ├── hook-performance-monitor.js # Hook performance monitoring
│   │   └── neural-hook-trainer.js   # Neural pattern training from hooks
│   ├── monitoring/                  # Performance monitoring
│   │   ├── performance-analyzer.js  # Performance analysis and optimization
│   │   ├── coordination-metrics.js  # Coordination effectiveness metrics
│   │   ├── neural-pattern-tracker.js # Neural pattern learning tracker
│   │   └── hook-performance-monitor.js # Hook-specific performance monitoring
│   ├── neural/                      # Neural pattern recognition
│   │   ├── pattern-recognizer.js    # Coordination pattern recognition
│   │   ├── learning-engine.js       # Machine learning for optimization
│   │   ├── adaptation-controller.js # Adaptive behavior controller
│   │   └── emergent-behavior.js     # Emergent behavior detection
│   └── utils/                       # Utility functions
│       ├── crypto.js                # Cryptographic utilities
│       ├── network.js               # Network utilities
│       └── state-manager.js         # Global state management
├── config/                          # Configuration files
│   ├── consensus-config.json        # Consensus algorithm configuration
│   ├── neural-config.json           # Neural network configuration
│   └── hook-config.json             # Hook integration configuration
├── tests/                           # Test suites
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── consensus/                   # Consensus algorithm tests
└── docs/                            # Documentation
    ├── consensus-protocols.md       # Consensus mechanism documentation
    ├── neural-patterns.md           # Neural pattern documentation
    └── hook-integration.md          # Hook integration guide
```

### Core Components

#### 🧠 Neural Pattern Engine
- **Pattern Recognition** - Identify effective coordination patterns
- **Learning Algorithm** - Continuous improvement through reinforcement learning
- **Adaptation Controller** - Real-time adaptation to changing conditions
- **Emergent Behavior Detection** - Identify and amplify beneficial emergent behaviors

#### 🤝 Consensus Engine
- **Leader Election** - Dynamic leader selection for coordination
- **State Replication** - Maintain consistent state across all nodes
- **Fault Tolerance** - Handle network partitions and node failures
- **Conflict Resolution** - Automatic resolution of coordination conflicts

#### 📡 Communication Hub
- **Protocol Abstraction** - Support multiple communication protocols
- **Message Optimization** - Optimize message routing and delivery
- **Event Coordination** - Coordinate events across the entire swarm
- **Priority Management** - Handle urgent coordination messages first

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **Redis** for state synchronization
- **Manager Service** running (see [../manager/README.md](../manager/README.md))
- **Claude Flow** configured for hook integration

### Environment Setup

Create `.env` file:

```env
# Hive Mind Configuration
NODE_ENV=development
PORT=3001
HIVE_MIND_ID=hive-001
CLUSTER_SIZE=5

# Consensus Configuration
CONSENSUS_ALGORITHM=raft
LEADER_ELECTION_TIMEOUT=5000
HEARTBEAT_INTERVAL=1000
REPLICATION_TIMEOUT=3000

# Neural Pattern Configuration
ENABLE_NEURAL_PATTERNS=true
LEARNING_RATE=0.01
PATTERN_RECOGNITION_THRESHOLD=0.8
ADAPTATION_INTERVAL=30000

# Communication Configuration
MAX_MESSAGE_SIZE=1048576
MESSAGE_COMPRESSION=true
ENCRYPTION_ENABLED=true
WEBSOCKET_PORT=3002

# Hook Integration
CLAUDE_FLOW_ENDPOINT=http://localhost:3000
HOOK_MONITORING_ENABLED=true
HOOK_PERFORMANCE_TRACKING=true
NEURAL_HOOK_TRAINING=true

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=hive:
STATE_SYNC_INTERVAL=5000

# Manager Service Integration
MANAGER_URL=http://localhost:8080
MANAGER_WS_URL=ws://localhost:8080/ws
MANAGER_API_KEY=your-manager-api-key

# Performance Monitoring
METRICS_COLLECTION_INTERVAL=10000
PERFORMANCE_ANALYSIS_INTERVAL=60000
COORDINATION_EFFECTIVENESS_THRESHOLD=0.85

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_COORDINATION_LOGS=true
```

### Installation & Development

```bash
# Navigate to hive-mind directory
cd apps/hive-mind

# Install dependencies
pnpm install

# Start Redis (if running locally)
redis-server

# Start development server
pnpm dev

# Hive Mind will be available at http://localhost:3001
```

### Development Commands

```bash
# Development
pnpm dev              # Start with hot reloading
pnpm dev:debug        # Start with debugging enabled
pnpm dev:neural       # Start with neural pattern debugging

# Testing
pnpm test             # Run all tests
pnpm test:consensus   # Test consensus mechanisms
pnpm test:neural      # Test neural pattern recognition
pnpm test:hooks       # Test hook integration
pnpm test:performance # Performance testing

# Monitoring
pnpm monitor:coordination # Monitor coordination effectiveness
pnpm monitor:consensus    # Monitor consensus performance
pnpm monitor:neural       # Monitor neural pattern learning

# Analysis
pnpm analyze:patterns     # Analyze coordination patterns
pnpm analyze:performance  # Analyze performance metrics
pnpm optimize:topology    # Optimize network topology
```

---

## 🧠 Neural Pattern Recognition

### Pattern Recognition Engine

```javascript
// Neural pattern recognition for coordination optimization
class PatternRecognizer {
  constructor(config) {
    this.learningRate = config.learningRate || 0.01;
    this.threshold = config.threshold || 0.8;
    this.patterns = new Map();
    this.neuralNetwork = new NeuralNetwork(config.networkConfig);
  }

  async recognizePattern(coordinationData) {
    // Extract features from coordination data
    const features = this.extractFeatures(coordinationData);
    
    // Use neural network to classify pattern
    const classification = await this.neuralNetwork.predict(features);
    
    // Check if pattern meets recognition threshold
    if (classification.confidence > this.threshold) {
      return {
        pattern: classification.pattern,
        confidence: classification.confidence,
        recommendations: this.generateRecommendations(classification)
      };
    }
    
    return null;
  }

  async learnFromCoordination(coordinationEvent, outcome) {
    // Extract training data
    const features = this.extractFeatures(coordinationEvent);
    const label = this.classifyOutcome(outcome);
    
    // Train neural network
    await this.neuralNetwork.train(features, label);
    
    // Update pattern database
    this.updatePatternDatabase(coordinationEvent, outcome);
  }

  generateRecommendations(classification) {
    const pattern = classification.pattern;
    
    return {
      topologyOptimization: this.recommendTopologyChanges(pattern),
      communicationOptimization: this.recommendCommunicationChanges(pattern),
      consensusOptimization: this.recommendConsensusChanges(pattern),
      resourceAllocation: this.recommendResourceAllocation(pattern)
    };
  }
}
```

### Adaptive Behavior Controller

```javascript
// Adaptive behavior controller for real-time optimization
class AdaptationController {
  constructor(patternRecognizer, consensusManager) {
    this.patternRecognizer = patternRecognizer;
    this.consensusManager = consensusManager;
    this.adaptationHistory = [];
    this.currentConfiguration = {};
  }

  async adaptToConditions(currentState, performanceMetrics) {
    // Analyze current coordination effectiveness
    const effectiveness = this.analyzeEffectiveness(performanceMetrics);
    
    if (effectiveness < this.effectivenessThreshold) {
      // Recognize patterns in current coordination
      const pattern = await this.patternRecognizer.recognizePattern(currentState);
      
      if (pattern) {
        // Apply recommended adaptations
        const adaptations = await this.applyAdaptations(pattern.recommendations);
        
        // Record adaptation for learning
        this.recordAdaptation({
          timestamp: Date.now(),
          pattern: pattern.pattern,
          adaptations,
          previousEffectiveness: effectiveness
        });
        
        return adaptations;
      }
    }
    
    return null;
  }

  async applyAdaptations(recommendations) {
    const adaptations = [];
    
    // Apply topology optimization
    if (recommendations.topologyOptimization) {
      const topologyChanges = await this.optimizeTopology(recommendations.topologyOptimization);
      adaptations.push({ type: 'topology', changes: topologyChanges });
    }
    
    // Apply communication optimization
    if (recommendations.communicationOptimization) {
      const commChanges = await this.optimizeCommunication(recommendations.communicationOptimization);
      adaptations.push({ type: 'communication', changes: commChanges });
    }
    
    // Apply consensus optimization
    if (recommendations.consensusOptimization) {
      const consensusChanges = await this.optimizeConsensus(recommendations.consensusOptimization);
      adaptations.push({ type: 'consensus', changes: consensusChanges });
    }
    
    return adaptations;
  }
}
```

---

## 🤝 Consensus Mechanisms

### RAFT Consensus Implementation

```javascript
// RAFT consensus for distributed coordination
class RaftConsensus {
  constructor(nodeId, peers, config) {
    this.nodeId = nodeId;
    this.peers = peers;
    this.config = config;
    
    this.state = 'follower'; // follower, candidate, leader
    this.currentTerm = 0;
    this.votedFor = null;
    this.log = [];
    this.commitIndex = 0;
    this.lastApplied = 0;
  }

  async startElection() {
    this.state = 'candidate';
    this.currentTerm++;
    this.votedFor = this.nodeId;
    
    let votes = 1; // Vote for self
    const promises = this.peers.map(peer => this.requestVote(peer));
    
    try {
      const results = await Promise.allSettled(promises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.voteGranted) {
          votes++;
        }
      });
      
      if (votes > Math.floor(this.peers.length / 2)) {
        await this.becomeLeader();
      } else {
        this.state = 'follower';
      }
    } catch (error) {
      this.state = 'follower';
    }
  }

  async becomeLeader() {
    this.state = 'leader';
    
    // Send heartbeats to maintain leadership
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);
    
    console.log(`Node ${this.nodeId} became leader for term ${this.currentTerm}`);
  }

  async appendEntry(entry) {
    if (this.state !== 'leader') {
      throw new Error('Only leader can append entries');
    }
    
    entry.term = this.currentTerm;
    entry.index = this.log.length;
    this.log.push(entry);
    
    // Replicate to followers
    const replicationPromises = this.peers.map(peer => 
      this.replicateEntry(peer, entry)
    );
    
    const results = await Promise.allSettled(replicationPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    if (successCount >= Math.floor(this.peers.length / 2)) {
      this.commitIndex = entry.index;
      await this.applyEntry(entry);
      return true;
    }
    
    return false;
  }
}
```

### Byzantine Fault Tolerance

```javascript
// Byzantine fault tolerance for malicious agent handling
class ByzantineFaultTolerance {
  constructor(nodeId, nodes, config) {
    this.nodeId = nodeId;
    this.nodes = nodes;
    this.faultThreshold = Math.floor((nodes.length - 1) / 3);
    this.viewNumber = 0;
    this.sequenceNumber = 0;
    this.messageLog = new Map();
  }

  async processRequest(request) {
    if (this.isPrimary()) {
      return this.processAsPrimary(request);
    } else {
      return this.processAsBackup(request);
    }
  }

  async processAsPrimary(request) {
    this.sequenceNumber++;
    
    const prepareMessage = {
      type: 'prepare',
      view: this.viewNumber,
      sequence: this.sequenceNumber,
      request: request,
      signature: this.sign(request)
    };
    
    // Send prepare to all backups
    await this.broadcast(prepareMessage);
    
    // Wait for prepare responses
    const prepareResponses = await this.collectResponses('prepare', this.sequenceNumber);
    
    if (prepareResponses.length >= 2 * this.faultThreshold) {
      // Send commit message
      const commitMessage = {
        type: 'commit',
        view: this.viewNumber,
        sequence: this.sequenceNumber,
        request: request
      };
      
      await this.broadcast(commitMessage);
      
      // Execute request
      return this.executeRequest(request);
    }
    
    throw new Error('Insufficient prepare responses');
  }

  async detectByzantineNode(nodeId, suspiciousActivity) {
    const evidence = {
      nodeId,
      activity: suspiciousActivity,
      timestamp: Date.now(),
      reporters: [this.nodeId]
    };
    
    // Collect evidence from other nodes
    const evidenceResponses = await this.collectEvidence(nodeId);
    
    if (evidenceResponses.length >= this.faultThreshold) {
      // Initiate view change to exclude Byzantine node
      await this.initiateViewChange(nodeId);
      return true;
    }
    
    return false;
  }
}
```

---

## 🔗 Hook Integration System

### Claude Flow Hook Coordination

```javascript
// Claude Flow hook coordination and monitoring
class SwarmHookCoordinator {
  constructor(config) {
    this.claudeFlowEndpoint = config.claudeFlowEndpoint;
    this.hookListeners = new Map();
    this.hookPerformanceMonitor = new HookPerformanceMonitor();
    this.neuralHookTrainer = new NeuralHookTrainer();
  }

  async initializeHookCoordination() {
    // Set up hook listeners for all agents
    await this.setupAgentHookListeners();
    
    // Initialize hook performance monitoring
    await this.hookPerformanceMonitor.initialize();
    
    // Start neural pattern training from hooks
    await this.neuralHookTrainer.startTraining();
    
    console.log('Hook coordination initialized');
  }

  async setupAgentHookListeners() {
    const hooks = [
      'pre-task',
      'post-task',
      'pre-edit',
      'post-edit',
      'agent-spawned',
      'task-orchestrated',
      'session-end'
    ];

    for (const hookType of hooks) {
      const listener = new AgentHookListener(hookType, this);
      this.hookListeners.set(hookType, listener);
      await listener.startListening();
    }
  }

  async coordinateHook(hookType, agentId, hookData) {
    const startTime = Date.now();
    
    try {
      // Record hook execution
      this.hookPerformanceMonitor.recordHookStart(hookType, agentId);
      
      // Process hook through coordination logic
      const result = await this.processHookCoordination(hookType, agentId, hookData);
      
      // Train neural patterns from hook execution
      await this.neuralHookTrainer.learnFromHook(hookType, hookData, result);
      
      // Record successful completion
      const duration = Date.now() - startTime;
      this.hookPerformanceMonitor.recordHookCompletion(hookType, agentId, duration, true);
      
      return result;
    } catch (error) {
      // Record hook failure
      const duration = Date.now() - startTime;
      this.hookPerformanceMonitor.recordHookCompletion(hookType, agentId, duration, false);
      
      throw error;
    }
  }

  async processHookCoordination(hookType, agentId, hookData) {
    switch (hookType) {
      case 'pre-task':
        return this.coordinatePreTask(agentId, hookData);
      case 'post-task':
        return this.coordinatePostTask(agentId, hookData);
      case 'agent-spawned':
        return this.coordinateAgentSpawned(agentId, hookData);
      case 'task-orchestrated':
        return this.coordinateTaskOrchestrated(agentId, hookData);
      default:
        return this.coordinateGenericHook(hookType, agentId, hookData);
    }
  }

  async coordinatePreTask(agentId, taskData) {
    // Coordinate with other agents before task execution
    const relevantAgents = await this.findRelevantAgents(taskData);
    
    // Share task context with relevant agents
    await this.shareTaskContext(relevantAgents, taskData);
    
    // Optimize task assignment based on agent capabilities
    const optimizedAssignment = await this.optimizeTaskAssignment(taskData);
    
    return {
      optimizedAssignment,
      coordinatedAgents: relevantAgents.length,
      coordinationTime: Date.now()
    };
  }
}
```

### Hook Performance Monitoring

```javascript
// Hook performance monitoring and optimization
class HookPerformanceMonitor {
  constructor() {
    this.hookMetrics = new Map();
    this.performanceThresholds = {
      'pre-task': 100,      // 100ms
      'post-task': 200,     // 200ms
      'pre-edit': 50,       // 50ms
      'post-edit': 150,     // 150ms
      'agent-spawned': 500, // 500ms
    };
  }

  recordHookStart(hookType, agentId) {
    const key = `${hookType}:${agentId}`;
    this.hookMetrics.set(key, {
      startTime: Date.now(),
      hookType,
      agentId,
      status: 'running'
    });
  }

  recordHookCompletion(hookType, agentId, duration, success) {
    const key = `${hookType}:${agentId}`;
    const metric = this.hookMetrics.get(key);
    
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = duration;
      metric.success = success;
      metric.status = 'completed';
      
      // Check if hook exceeded performance threshold
      const threshold = this.performanceThresholds[hookType];
      if (threshold && duration > threshold) {
        this.reportSlowHook(hookType, agentId, duration, threshold);
      }
      
      // Store historical data
      this.storeHookMetrics(metric);
    }
  }

  async reportSlowHook(hookType, agentId, duration, threshold) {
    const report = {
      type: 'slow_hook',
      hookType,
      agentId,
      duration,
      threshold,
      timestamp: Date.now(),
      severity: duration > threshold * 2 ? 'high' : 'medium'
    };
    
    // Report to coordination system for optimization
    await this.reportToCoordinator(report);
    
    console.warn(`Slow hook detected: ${hookType} for agent ${agentId} took ${duration}ms (threshold: ${threshold}ms)`);
  }

  async generatePerformanceReport() {
    const report = {
      totalHooks: this.hookMetrics.size,
      averageDurations: this.calculateAverageDurations(),
      slowHooks: this.identifySlowHooks(),
      failureRates: this.calculateFailureRates(),
      recommendations: this.generateOptimizationRecommendations()
    };
    
    return report;
  }

  generateOptimizationRecommendations() {
    const recommendations = [];
    
    // Analyze hook performance patterns
    const slowHookTypes = this.identifySlowHookTypes();
    slowHookTypes.forEach(hookType => {
      recommendations.push({
        type: 'performance',
        hookType,
        recommendation: `Optimize ${hookType} hook implementation`,
        priority: 'high'
      });
    });
    
    // Analyze agent-specific performance issues
    const problematicAgents = this.identifyProblematicAgents();
    problematicAgents.forEach(agentId => {
      recommendations.push({
        type: 'agent',
        agentId,
        recommendation: `Review agent ${agentId} hook performance`,
        priority: 'medium'
      });
    });
    
    return recommendations;
  }
}
```

---

## 📊 Performance Monitoring

### Coordination Effectiveness Metrics

```javascript
// Coordination effectiveness monitoring and analysis
class CoordinationMetrics {
  constructor() {
    this.metrics = {
      coordinationLatency: [],
      consensusTime: [],
      messageOverhead: [],
      agentSynchronization: [],
      conflictResolution: []
    };
    this.effectivenessThreshold = 0.85;
  }

  async measureCoordinationEffectiveness() {
    const metrics = {
      latency: await this.measureCoordinationLatency(),
      consensus: await this.measureConsensusEfficiency(),
      synchronization: await this.measureAgentSynchronization(),
      conflicts: await this.measureConflictResolution(),
      throughput: await this.measureCoordinationThroughput()
    };
    
    const effectiveness = this.calculateOverallEffectiveness(metrics);
    
    return {
      effectiveness,
      metrics,
      recommendations: this.generateImprovementRecommendations(metrics)
    };
  }

  calculateOverallEffectiveness(metrics) {
    // Weighted calculation of coordination effectiveness
    const weights = {
      latency: 0.25,
      consensus: 0.25,
      synchronization: 0.20,
      conflicts: 0.15,
      throughput: 0.15
    };
    
    let effectiveness = 0;
    for (const [metric, value] of Object.entries(metrics)) {
      effectiveness += weights[metric] * this.normalizeMetric(metric, value);
    }
    
    return Math.max(0, Math.min(1, effectiveness));
  }

  async measureCoordinationLatency() {
    // Measure average latency for coordination messages
    const samples = [];
    
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await this.sendCoordinationPing();
      const latency = Date.now() - start;
      samples.push(latency);
    }
    
    return {
      average: samples.reduce((a, b) => a + b) / samples.length,
      median: this.calculateMedian(samples),
      p95: this.calculatePercentile(samples, 0.95)
    };
  }

  async measureConsensusEfficiency() {
    // Measure consensus algorithm efficiency
    const consensusRounds = await this.getRecentConsensusRounds();
    
    return {
      averageRounds: consensusRounds.reduce((a, b) => a + b.rounds) / consensusRounds.length,
      averageTime: consensusRounds.reduce((a, b) => a + b.time) / consensusRounds.length,
      successRate: consensusRounds.filter(r => r.success).length / consensusRounds.length
    };
  }
}
```

### Neural Pattern Learning

```javascript
// Neural pattern learning from coordination data
class NeuralHookTrainer {
  constructor() {
    this.trainingData = [];
    this.neuralNetwork = new NeuralNetwork({
      inputSize: 50,
      hiddenLayers: [100, 50, 25],
      outputSize: 10,
      learningRate: 0.001
    });
    this.isTraining = false;
  }

  async startTraining() {
    this.isTraining = true;
    
    // Start continuous learning from hook executions
    setInterval(async () => {
      if (this.trainingData.length > 100) {
        await this.trainOnRecentData();
      }
    }, 30000); // Train every 30 seconds
    
    console.log('Neural hook training started');
  }

  async learnFromHook(hookType, hookData, result) {
    // Extract features from hook execution
    const features = this.extractHookFeatures(hookType, hookData, result);
    
    // Create training sample
    const sample = {
      input: features.input,
      output: features.output,
      hookType,
      timestamp: Date.now(),
      performance: result.performance || {}
    };
    
    this.trainingData.push(sample);
    
    // Limit training data size
    if (this.trainingData.length > 10000) {
      this.trainingData = this.trainingData.slice(-5000);
    }
  }

  extractHookFeatures(hookType, hookData, result) {
    const input = [];
    const output = [];
    
    // Hook type encoding
    const hookTypeEncoding = this.encodeHookType(hookType);
    input.push(...hookTypeEncoding);
    
    // Agent characteristics
    if (hookData.agentId) {
      const agentFeatures = this.encodeAgentFeatures(hookData.agentId);
      input.push(...agentFeatures);
    }
    
    // Task characteristics
    if (hookData.task) {
      const taskFeatures = this.encodeTaskFeatures(hookData.task);
      input.push(...taskFeatures);
    }
    
    // Performance metrics as output
    if (result.duration) {
      output.push(this.normalizePerformanceMetric('duration', result.duration));
    }
    
    if (result.success !== undefined) {
      output.push(result.success ? 1 : 0);
    }
    
    // Pad vectors to fixed size
    while (input.length < 50) input.push(0);
    while (output.length < 10) output.push(0);
    
    return { input: input.slice(0, 50), output: output.slice(0, 10) };
  }

  async trainOnRecentData() {
    if (!this.isTraining || this.trainingData.length < 50) {
      return;
    }
    
    console.log(`Training neural network on ${this.trainingData.length} samples`);
    
    // Prepare training batch
    const batchSize = Math.min(100, this.trainingData.length);
    const batch = this.trainingData.slice(-batchSize);
    
    // Train neural network
    for (const sample of batch) {
      await this.neuralNetwork.train(sample.input, sample.output);
    }
    
    // Evaluate training progress
    const accuracy = await this.evaluateModel();
    console.log(`Neural network accuracy: ${(accuracy * 100).toFixed(2)}%`);
  }

  async predictOptimalConfiguration(hookType, context) {
    // Use trained neural network to predict optimal configuration
    const features = this.extractContextFeatures(hookType, context);
    const prediction = await this.neuralNetwork.predict(features);
    
    return this.interpretPrediction(prediction);
  }
}
```

---

## 🧪 Testing

### Consensus Testing

```bash
# Run consensus mechanism tests
pnpm test:consensus

# Test specific consensus algorithms
pnpm test:raft           # RAFT consensus tests
pnpm test:byzantine      # Byzantine fault tolerance tests
pnpm test:conflict       # Conflict resolution tests

# Performance testing
pnpm test:consensus:load # Load testing for consensus
pnpm test:consensus:fault # Fault injection testing
```

### Neural Pattern Testing

```bash
# Test neural pattern recognition
pnpm test:neural

# Test specific neural components
pnpm test:pattern-recognition # Pattern recognition tests
pnpm test:learning-engine     # Learning algorithm tests
pnpm test:adaptation         # Adaptation controller tests

# Performance testing
pnpm test:neural:performance # Neural network performance tests
pnpm test:neural:accuracy    # Accuracy testing
```

### Hook Integration Testing

```bash
# Test hook integration
pnpm test:hooks

# Test specific hook components
pnpm test:hook-listeners    # Hook listener tests
pnpm test:hook-coordination # Hook coordination tests
pnpm test:hook-performance  # Hook performance tests

# Integration testing
pnpm test:claude-flow-integration # Claude Flow integration tests
```

### Example Test Suite

```javascript
// Example: Consensus mechanism testing
import { describe, it, expect, beforeEach } from 'vitest';
import { RaftConsensus } from '../src/consensus/raft-consensus';

describe('RaftConsensus', () => {
  let consensus;
  let mockPeers;

  beforeEach(() => {
    mockPeers = ['node-2', 'node-3', 'node-4', 'node-5'];
    consensus = new RaftConsensus('node-1', mockPeers, {
      heartbeatInterval: 100,
      electionTimeout: 500
    });
  });

  it('should elect leader successfully', async () => {
    const electionResult = await consensus.startElection();
    expect(consensus.state).toBe('leader');
    expect(consensus.currentTerm).toBeGreaterThan(0);
  });

  it('should replicate log entries', async () => {
    // First become leader
    await consensus.becomeLeader();
    
    const entry = {
      type: 'coordination_command',
      data: { action: 'optimize_topology' }
    };
    
    const result = await consensus.appendEntry(entry);
    expect(result).toBe(true);
    expect(consensus.log).toContain(entry);
  });

  it('should handle network partition', async () => {
    // Simulate network partition
    consensus.peers = ['node-2']; // Minority partition
    
    const entry = { type: 'test', data: {} };
    
    await expect(consensus.appendEntry(entry)).rejects.toThrow();
  });
});
```

---

## 🚢 Deployment

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S hive-mind -u 1001
USER hive-mind

EXPOSE 3001 3002

CMD ["node", "src/server.js"]
```

```bash
# Build and run with Docker
docker build -t hive-mind .
docker run -p 3001:3001 -p 3002:3002 --env-file .env hive-mind
```

### Production Configuration

```env
# Production environment
NODE_ENV=production
PORT=3001

# Scaled consensus configuration
CLUSTER_SIZE=10
CONSENSUS_ALGORITHM=raft
BYZANTINE_FAULT_TOLERANCE=true

# Performance optimization
ENABLE_NEURAL_PATTERNS=true
PATTERN_RECOGNITION_THRESHOLD=0.9
ADAPTATION_INTERVAL=15000

# Security
ENCRYPTION_ENABLED=true
AUTHENTICATION_REQUIRED=true

# Monitoring
METRICS_COLLECTION_INTERVAL=5000
PERFORMANCE_ANALYSIS_INTERVAL=30000
```

---

## 🤝 Contributing

### Development Guidelines

1. **Consensus Algorithms** - Implement formal verification tests
2. **Neural Patterns** - Maintain training data privacy
3. **Performance** - Ensure sub-millisecond coordination latency
4. **Testing** - 95%+ coverage for consensus mechanisms
5. **Documentation** - Document all algorithms and patterns

### Algorithm Implementation Template

```javascript
// Template for new consensus algorithms
class CustomConsensus {
  constructor(nodeId, peers, config) {
    this.nodeId = nodeId;
    this.peers = peers;
    this.config = config;
  }

  async processMessage(message) {
    // Implement message processing logic
    throw new Error('Not implemented');
  }

  async reachConsensus(proposal) {
    // Implement consensus reaching logic
    throw new Error('Not implemented');
  }

  async handleNodeFailure(failedNode) {
    // Implement node failure handling
    throw new Error('Not implemented');
  }
}
```

---

## 📚 Additional Resources

- [**Consensus Protocols**](docs/consensus-protocols.md) - Detailed algorithm documentation
- [**Neural Patterns**](docs/neural-patterns.md) - Pattern recognition guide
- [**Hook Integration**](docs/hook-integration.md) - Claude Flow integration guide
- [**Performance Tuning**](docs/performance-tuning.md) - Optimization strategies

### Related Services

- [**Manager Service**](../manager/README.md) - Central coordination API
- [**Worker Service**](../worker/README.md) - Distributed agent execution
- [**Dashboard Service**](../dashboard/README.md) - Monitoring interface
- [**Claude Flow**](../../claude-flow-analysis/README.md) - AI integration layer

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

---

<div align="center">
  <sub>🧠 Hive Mind Service - Collective intelligence through distributed coordination</sub>
</div>