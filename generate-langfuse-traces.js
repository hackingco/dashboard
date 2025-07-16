#!/usr/bin/env node

/**
 * Generate Real Traces for Langfuse Dashboard
 * Creates various types of traced activities that will appear in Langfuse
 */

const http = require('http');
const crypto = require('crypto');

// Configuration
const LANGFUSE_HOST = process.env.LANGFUSE_HOST || 'http://localhost:3000';
const SWARM_ID = 'swarm_1752454839280_pw37vfa2h';

// Agent definitions
const AGENTS = [
  { id: 'agent_1752454839352_w1wfc0', name: 'SwarmCommander', type: 'coordinator' },
  { id: 'agent_1752454839484_n48vin', name: 'DataScout', type: 'researcher' },
  { id: 'agent_1752454839668_o7rlgx', name: 'IntelligenceGatherer', type: 'researcher' },
  { id: 'agent_1752454839800_i8tr7j', name: 'LiveTraceBuilder', type: 'coder' },
  { id: 'agent_1752454839960_95p7tf', name: 'SystemIntegrator', type: 'coder' },
  { id: 'agent_1752454840093_gyqkh6', name: 'PerformanceAnalyst', type: 'analyst' },
  { id: 'agent_1752454840228_it0ay6', name: 'QualityAssurance', type: 'tester' }
];

// Trace templates
const TRACE_TEMPLATES = [
  {
    name: 'Swarm Coordination Task',
    operation: 'swarm_coordination',
    agent: 'SwarmCommander',
    steps: [
      { name: 'Initialize coordination', duration: 150 },
      { name: 'Assign agent tasks', duration: 200 },
      { name: 'Monitor execution', duration: 500 },
      { name: 'Aggregate results', duration: 300 }
    ]
  },
  {
    name: 'Data Analysis Pipeline',
    operation: 'data_analysis',
    agent: 'DataScout',
    steps: [
      { name: 'Collect trace data', duration: 400 },
      { name: 'Pattern recognition', duration: 600 },
      { name: 'Statistical analysis', duration: 800 },
      { name: 'Generate insights', duration: 350 }
    ]
  },
  {
    name: 'Real-time Trace Generation',
    operation: 'trace_generation',
    agent: 'LiveTraceBuilder',
    steps: [
      { name: 'Create trace structure', duration: 100 },
      { name: 'Add metadata', duration: 150 },
      { name: 'Stream to Langfuse', duration: 250 },
      { name: 'Verify delivery', duration: 200 }
    ]
  },
  {
    name: 'Performance Optimization',
    operation: 'performance_analysis',
    agent: 'PerformanceAnalyst',
    steps: [
      { name: 'Measure latency', duration: 300 },
      { name: 'Identify bottlenecks', duration: 500 },
      { name: 'Generate recommendations', duration: 400 },
      { name: 'Apply optimizations', duration: 600 }
    ]
  },
  {
    name: 'Integration Testing',
    operation: 'integration_test',
    agent: 'QualityAssurance',
    steps: [
      { name: 'Setup test environment', duration: 200 },
      { name: 'Execute test suite', duration: 900 },
      { name: 'Validate results', duration: 400 },
      { name: 'Generate report', duration: 300 }
    ]
  }
];

class LangfuseTraceGenerator {
  constructor() {
    this.sessionId = `swarm_session_${Date.now()}`;
    this.traceCount = 0;
    this.startTime = Date.now();
  }

  async generateTraces() {
    console.log('🚀 LANGFUSE TRACE GENERATOR');
    console.log('=' .repeat(50));
    console.log(`Session ID: ${this.sessionId}`);
    console.log(`Swarm ID: ${SWARM_ID}`);
    console.log(`Target: ${LANGFUSE_HOST}`);
    console.log('=' .repeat(50));
    console.log();

    // Check Langfuse availability
    const isAvailable = await this.checkLangfuseAvailability();
    if (!isAvailable) {
      console.log('⚠️ Langfuse not responding - generating mock traces for demonstration');
      console.log('ℹ️ To see real traces, ensure Langfuse is configured with API keys\n');
    }

    // Generate initial batch of traces
    console.log('📊 Generating initial trace batch...\n');
    for (let i = 0; i < 5; i++) {
      await this.generateComplexTrace(i);
      await this.sleep(1000); // Space out trace generation
    }

    // Start continuous trace generation
    console.log('\n⚡ Starting continuous trace generation...');
    console.log('🔄 New traces will be generated every 5 seconds');
    console.log('🛑 Press Ctrl+C to stop\n');

    setInterval(async () => {
      await this.generateRandomTrace();
    }, 5000);
  }

  async generateComplexTrace(index) {
    const template = TRACE_TEMPLATES[index % TRACE_TEMPLATES.length];
    const agent = AGENTS.find(a => a.name === template.agent);
    const traceId = this.generateTraceId();
    
    console.log(`🔷 Creating ${template.name} (${traceId})`);
    console.log(`   Agent: ${agent.name} (${agent.type})`);
    
    const trace = {
      id: traceId,
      name: template.name,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        swarmId: SWARM_ID,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        operation: template.operation
      }
    };

    // Simulate step execution
    let totalDuration = 0;
    for (const step of template.steps) {
      console.log(`   📍 ${step.name} (${step.duration}ms)`);
      
      // Create sub-trace for each step
      const stepTrace = {
        id: `${traceId}_step_${step.name.replace(/\s+/g, '_')}`,
        parentId: traceId,
        name: step.name,
        timestamp: new Date().toISOString(),
        duration: step.duration,
        metadata: {
          stepType: 'execution',
          agentId: agent.id
        }
      };

      await this.sendToLangfuse(stepTrace, 'step');
      totalDuration += step.duration;
      await this.sleep(step.duration);
    }

    // Complete main trace
    trace.duration = totalDuration;
    trace.status = 'completed';
    trace.output = {
      steps_completed: template.steps.length,
      total_duration: totalDuration,
      success: true
    };

    await this.sendToLangfuse(trace, 'trace');
    console.log(`   ✅ Completed in ${totalDuration}ms\n`);
    this.traceCount++;
  }

  async generateRandomTrace() {
    const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    const operations = [
      'analyze_patterns',
      'coordinate_agents', 
      'generate_insights',
      'optimize_performance',
      'validate_integration',
      'process_data',
      'stream_traces'
    ];
    
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const duration = Math.floor(Math.random() * 2000) + 200;
    const traceId = this.generateTraceId();
    
    const trace = {
      id: traceId,
      name: `${agent.name}: ${operation}`,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      duration: duration,
      metadata: {
        swarmId: SWARM_ID,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        operation: operation,
        auto_generated: true
      },
      output: {
        status: 'success',
        processed: Math.floor(Math.random() * 100) + 1,
        efficiency: (Math.random() * 40 + 60).toFixed(1) + '%'
      }
    };

    console.log(`[${new Date().toISOString().slice(11,19)}] ${agent.name}: ${operation} (${duration}ms)`);
    await this.sendToLangfuse(trace, 'trace');
    this.traceCount++;
  }

  async sendToLangfuse(data, type = 'trace') {
    // In a real implementation with API keys, this would send to Langfuse
    // For now, we'll log the trace data structure
    
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      // Real Langfuse API call would go here
      try {
        const response = await this.makeHttpRequest(
          `${LANGFUSE_HOST}/api/public/traces`,
          'POST',
          data,
          {
            'Authorization': `Bearer ${process.env.LANGFUSE_PUBLIC_KEY}`,
            'Content-Type': 'application/json'
          }
        );
        
        if (response.status === 200) {
          console.log(`   ↗️ Sent to Langfuse: ${data.id}`);
        }
      } catch (error) {
        console.log(`   ⚠️ Langfuse API error: ${error.message}`);
      }
    } else {
      // Store trace locally for demonstration
      if (type === 'trace') {
        this.logTraceToFile(data);
      }
    }
  }

  async checkLangfuseAvailability() {
    try {
      const response = await this.makeHttpRequest(
        `${LANGFUSE_HOST}/api/public/health`,
        'GET'
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async makeHttpRequest(url, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'User-Agent': 'SwarmTraceGenerator/1.0',
          ...headers
        },
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: responseData
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  generateTraceId() {
    return `trace_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  logTraceToFile(trace) {
    const fs = require('fs');
    const logFile = 'langfuse-traces.jsonl';
    
    try {
      fs.appendFileSync(logFile, JSON.stringify(trace) + '\n');
    } catch (error) {
      // Ignore file write errors
    }
  }

  showSummary() {
    const runtime = Math.floor((Date.now() - this.startTime) / 1000);
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TRACE GENERATION SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total traces generated: ${this.traceCount}`);
    console.log(`Runtime: ${runtime} seconds`);
    console.log(`Average rate: ${(this.traceCount / runtime).toFixed(1)} traces/second`);
    console.log(`Session ID: ${this.sessionId}`);
    console.log('\n💡 To view traces in Langfuse:');
    console.log('   1. Open http://localhost:3000');
    console.log('   2. Navigate to Traces section');
    console.log('   3. Filter by session ID: ' + this.sessionId);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping trace generation...');
  const generator = global.generator;
  if (generator) {
    generator.showSummary();
  }
  process.exit(0);
});

// Start trace generation
console.log('🐝 SWARM TRACE GENERATOR FOR LANGFUSE');
console.log('=====================================\n');

const generator = new LangfuseTraceGenerator();
global.generator = generator; // Store for shutdown handler
generator.generateTraces().catch(console.error);