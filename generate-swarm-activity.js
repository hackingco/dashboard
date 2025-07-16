#!/usr/bin/env node

/**
 * Generate comprehensive swarm activity traces for Langfuse
 */

const http = require('http');

const LANGFUSE_PUBLIC_KEY = 'pk-lf-REDACTED';
const LANGFUSE_SECRET_KEY = 'sk-lf-28a0e091-3cf7-4973-a1e1-030705b714da';
const LANGFUSE_HOST = 'localhost';
const LANGFUSE_PORT = 3000;

console.log('🐝 SWARM ACTIVITY GENERATOR FOR LANGFUSE');
console.log('========================================');

class SwarmActivityGenerator {
  constructor() {
    this.sessionId = `swarm-session-${Date.now()}`;
    this.traceCount = 0;
    this.auth = Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString('base64');
  }

  async sendToLangfuse(endpoint, data) {
    return new Promise((resolve) => {
      const jsonData = JSON.stringify(data);
      
      const options = {
        hostname: LANGFUSE_HOST,
        port: LANGFUSE_PORT,
        path: `/api/public/${endpoint}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': jsonData.length,
          'Authorization': `Basic ${this.auth}`
        }
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            const response = JSON.parse(responseData);
            console.log(`✅ Created: ${data.name} (${response.id})`);
            resolve(response);
          } else {
            console.log(`❌ Failed (${res.statusCode}):`, responseData);
            resolve(null);
          }
        });
      });

      req.on('error', (e) => {
        console.error('Request error:', e.message);
        resolve(null);
      });

      req.write(jsonData);
      req.end();
    });
  }

  async generateSwarmCoordinationTrace() {
    // Main coordination trace
    const trace = await this.sendToLangfuse('traces', {
      name: 'Swarm Coordination Cycle',
      userId: 'swarm-system',
      sessionId: this.sessionId,
      metadata: {
        agent: 'SwarmCommander',
        swarmId: 'swarm_1752454839280_pw37vfa2h',
        agentCount: 7,
        cycleNumber: ++this.traceCount
      },
      tags: ['swarm', 'coordination', 'live'],
      release: '1.0.0'
    });

    if (trace) {
      // Add spans for coordination steps
      const steps = [
        { name: 'Initialize Agents', duration: 150 },
        { name: 'Distribute Tasks', duration: 200 },
        { name: 'Monitor Progress', duration: 500 },
        { name: 'Aggregate Results', duration: 300 }
      ];

      for (const step of steps) {
        await this.sleep(step.duration);
        await this.sendToLangfuse('spans', {
          name: step.name,
          traceId: trace.id,
          userId: 'swarm-system',
          startTime: new Date(Date.now() - step.duration).toISOString(),
          endTime: new Date().toISOString(),
          metadata: {
            duration: step.duration,
            status: 'completed'
          }
        });
      }
    }
  }

  async generateAgentActivityTrace(agentName, agentType) {
    const operations = {
      'DataScout': ['Analyze Patterns', 'Mine Data', 'Extract Insights'],
      'LiveTraceBuilder': ['Generate Trace', 'Build Span', 'Stream Data'],
      'PerformanceAnalyst': ['Measure Latency', 'Analyze Bottlenecks', 'Optimize Performance'],
      'QualityAssurance': ['Run Tests', 'Validate Results', 'Generate Report']
    };

    const operation = operations[agentName]?.[Math.floor(Math.random() * operations[agentName].length)] || 'Process Task';
    
    const trace = await this.sendToLangfuse('traces', {
      name: `${agentName}: ${operation}`,
      userId: `agent-${agentName.toLowerCase()}`,
      sessionId: this.sessionId,
      metadata: {
        agent: agentName,
        agentType: agentType,
        operation: operation,
        swarmId: 'swarm_1752454839280_pw37vfa2h',
        duration: Math.floor(Math.random() * 2000) + 500,
        itemsProcessed: Math.floor(Math.random() * 100) + 10,
        successRate: (Math.random() * 20 + 80).toFixed(1) + '%'
      },
      tags: ['swarm', agentType, 'agent-activity'],
      release: '1.0.0'
    });

    return trace;
  }

  async generateCompleteSwarmActivity() {
    console.log('\n🎯 Generating complete swarm activity cycle...');
    
    // 1. Coordination trace
    await this.generateSwarmCoordinationTrace();
    
    // 2. Agent activities
    const agents = [
      { name: 'DataScout', type: 'researcher' },
      { name: 'LiveTraceBuilder', type: 'coder' },
      { name: 'PerformanceAnalyst', type: 'analyst' },
      { name: 'QualityAssurance', type: 'tester' }
    ];

    for (const agent of agents) {
      await this.sleep(1000);
      await this.generateAgentActivityTrace(agent.name, agent.type);
    }

    // 3. Generate a complex trace with generations
    await this.generateComplexTrace();
  }

  async generateComplexTrace() {
    // Create a trace that shows LLM usage
    const trace = await this.sendToLangfuse('traces', {
      name: 'Swarm Intelligence Analysis',
      userId: 'swarm-ai',
      sessionId: this.sessionId,
      metadata: {
        agent: 'IntelligenceGatherer',
        analysisType: 'comprehensive',
        dataPoints: Math.floor(Math.random() * 1000) + 500
      },
      tags: ['swarm', 'ai', 'analysis'],
      release: '1.0.0'
    });

    if (trace) {
      // Add a generation (LLM call)
      await this.sendToLangfuse('generations', {
        name: 'Generate Analysis Report',
        traceId: trace.id,
        userId: 'swarm-ai',
        model: 'gpt-4',
        modelParameters: {
          temperature: 0.7,
          maxTokens: 1000
        },
        prompt: 'Analyze the collected swarm data and generate insights...',
        completion: 'Based on the analysis of swarm patterns, the following insights were identified...',
        usage: {
          promptTokens: 150,
          completionTokens: 250,
          totalTokens: 400
        },
        metadata: {
          agent: 'IntelligenceGatherer',
          confidence: 0.95
        }
      });
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async startContinuousGeneration() {
    console.log('🔄 Starting continuous trace generation...');
    console.log('📊 Traces will be generated every 10 seconds');
    console.log('🛑 Press Ctrl+C to stop\n');

    // Initial generation
    await this.generateCompleteSwarmActivity();

    // Continuous generation
    setInterval(async () => {
      const activities = [
        () => this.generateSwarmCoordinationTrace(),
        () => this.generateAgentActivityTrace('DataScout', 'researcher'),
        () => this.generateAgentActivityTrace('LiveTraceBuilder', 'coder'),
        () => this.generateAgentActivityTrace('PerformanceAnalyst', 'analyst'),
        () => this.generateAgentActivityTrace('QualityAssurance', 'tester'),
        () => this.generateComplexTrace()
      ];

      const activity = activities[Math.floor(Math.random() * activities.length)];
      await activity();
    }, 10000);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping trace generation...');
  console.log('📊 Check Langfuse dashboard for all generated traces:');
  console.log('   http://localhost:3000\n');
  process.exit(0);
});

// Start the generator
const generator = new SwarmActivityGenerator();
generator.startContinuousGeneration().catch(console.error);