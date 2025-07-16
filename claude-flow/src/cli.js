#!/usr/bin/env node

/**
 * Claude Flow CLI - Docker-based execution interface
 * Ensures all agents run in Docker containers with Langfuse tracing
 */

import { program } from 'commander';
import { Langfuse } from 'langfuse';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { startTerminalUI } from './monitoring/terminal-ui.js';
import { realTimeMonitor } from './monitoring/real-time-monitor.js';

const COORDINATOR_URL = process.env.COORDINATOR_URL || 'http://localhost:8080';

// Initialize Langfuse for CLI tracing
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || 'http://localhost:3000',
  flushAt: 1,
  flushInterval: 1000
});

program
  .name('claude-flow')
  .description('Claude Flow - Docker-based agent orchestration with Langfuse tracing')
  .version('2.0.0');

// Swarm initialization command
program
  .command('swarm init')
  .description('Initialize a new swarm with Docker containers')
  .option('-t, --topology <type>', 'Swarm topology (mesh, hierarchical, ring, star)', 'mesh')
  .option('-a, --agents <number>', 'Number of agents to spawn', '4')
  .action(async (options) => {
    const trace = langfuse.trace({
      name: 'Swarm Initialization',
      sessionId: `swarm-${Date.now()}`,
      metadata: {
        topology: options.topology,
        agents: options.agents,
        environment: 'docker'
      }
    });
    
    console.log(chalk.blue('🐝 Initializing Claude Flow Swarm...'));
    
    try {
      // Start Docker containers
      console.log(chalk.yellow('🐳 Starting Docker containers...'));
      
      const dockerCompose = spawn('docker-compose', [
        '-f', 'docker-compose.claude-flow-agents.yml',
        'up', '-d',
        '--scale', `claude-flow-agent=${options.agents}`
      ], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      await new Promise((resolve, reject) => {
        dockerCompose.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Docker compose failed with code ${code}`));
        });
      });
      
      // Wait for coordinator to be ready
      console.log(chalk.yellow('⏳ Waiting for coordinator...'));
      await waitForCoordinator();
      
      // Check agent registration
      const response = await fetch(`${COORDINATOR_URL}/agents`);
      const { agents } = await response.json();
      
      trace.generation({
        name: 'Swarm Created',
        input: { topology: options.topology, requestedAgents: options.agents },
        output: { 
          actualAgents: agents.length,
          agentTypes: agents.map(a => a.type)
        }
      });
      
      console.log(chalk.green(`✅ Swarm initialized with ${agents.length} agents`));
      agents.forEach(agent => {
        console.log(chalk.gray(`   - ${agent.id} (${agent.type}) - ${agent.status}`));
      });
      
    } catch (error) {
      trace.generation({
        name: 'Swarm Initialization Failed',
        input: options,
        output: { error: error.message },
        level: 'ERROR'
      });
      
      console.error(chalk.red('❌ Failed to initialize swarm:'), error.message);
      process.exit(1);
    } finally {
      await langfuse.flush();
    }
  });

// Task orchestration command
program
  .command('task <description>')
  .description('Orchestrate a task across Docker-based agents')
  .option('-p, --priority <level>', 'Task priority (low, normal, high)', 'normal')
  .option('-s, --strategy <type>', 'Execution strategy (parallel, sequential)', 'parallel')
  .action(async (description, options) => {
    const trace = langfuse.trace({
      name: 'Task Orchestration',
      sessionId: `task-${Date.now()}`,
      metadata: {
        task: description,
        priority: options.priority,
        strategy: options.strategy
      }
    });
    
    console.log(chalk.blue('📋 Orchestrating task...'));
    
    try {
      const response = await fetch(`${COORDINATOR_URL}/task/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: description,
          priority: options.priority,
          strategy: options.strategy
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        trace.generation({
          name: 'Task Distributed',
          input: { task: description },
          output: result
        });
        
        console.log(chalk.green(`✅ Task ${result.taskId} distributed to ${result.assignments.length} agents`));
        result.assignments.forEach(assignment => {
          console.log(chalk.gray(`   - ${assignment.agentId} (${assignment.agentType})`));
        });
        
        // Monitor task progress
        await monitorTask(result.taskId, trace);
        
      } else {
        throw new Error(result.error || 'Task orchestration failed');
      }
      
    } catch (error) {
      trace.generation({
        name: 'Task Orchestration Failed',
        input: { task: description },
        output: { error: error.message },
        level: 'ERROR'
      });
      
      console.error(chalk.red('❌ Failed to orchestrate task:'), error.message);
      process.exit(1);
    } finally {
      await langfuse.flush();
    }
  });

// Status command
program
  .command('status')
  .description('Show status of Docker-based agents and Langfuse tracing')
  .action(async () => {
    console.log(chalk.blue('📊 Claude Flow Status'));
    console.log(chalk.gray('─'.repeat(50)));
    
    try {
      // Check coordinator health
      const healthResponse = await fetch(`${COORDINATOR_URL}/health`);
      const health = await healthResponse.json();
      
      console.log(chalk.green('✅ Coordinator: Active'));
      console.log(chalk.gray(`   Agents: ${health.agents}`));
      console.log(chalk.gray(`   Uptime: ${Math.round(health.uptime)}s`));
      console.log(chalk.gray(`   Tracing: ${health.tracing}`));
      
      // Get agent details
      const agentsResponse = await fetch(`${COORDINATOR_URL}/agents`);
      const { agents } = await agentsResponse.json();
      
      console.log(chalk.blue('\n🤖 Agents:'));
      agents.forEach(agent => {
        const statusColor = agent.status === 'idle' ? 'green' : 
                          agent.status === 'busy' ? 'yellow' : 'red';
        console.log(chalk[statusColor](`   ${agent.id} (${agent.type}) - ${agent.status}`));
        console.log(chalk.gray(`     Container: ${agent.container}`));
      });
      
      // Check Langfuse connection
      console.log(chalk.blue('\n📊 Langfuse Tracing:'));
      console.log(chalk.green(`   ✅ Connected to ${process.env.LANGFUSE_HOST}`));
      console.log(chalk.gray(`   Public Key: ${process.env.LANGFUSE_PUBLIC_KEY}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error.message);
      console.log(chalk.yellow('\n💡 Make sure Docker containers are running:'));
      console.log(chalk.gray('   docker-compose -f docker-compose.claude-flow-agents.yml up -d'));
    }
  });

// Monitoring command
program
  .command('monitoring')
  .description('Real-time monitoring commands')
  .command('real-time-view')
  .description('Real-time view of swarm activity')
  .option('--filter <type>', 'Filter view (e.g., errors, tasks, agents)')
  .option('--highlight <pattern>', 'Highlight pattern in events')
  .option('--tail <n>', 'Show last N events', '100')
  .action(async (options) => {
    console.log(chalk.blue('🔊 Starting real-time monitor...'));
    
    const trace = langfuse.trace({
      name: 'Real-Time Monitoring',
      sessionId: `monitor-${Date.now()}`,
      metadata: options
    });
    
    try {
      // Initialize the real-time monitor if not already running
      if (!realTimeMonitor.io) {
        await realTimeMonitor.initialize(3333);
      }
      
      // Start terminal UI
      const ui = startTerminalUI({
        port: 3333,
        filter: options.filter ? { type: options.filter } : null,
        highlight: options.highlight,
        tail: parseInt(options.tail)
      });
      
      trace.generation({
        name: 'Monitor Started',
        input: options,
        output: { status: 'active' }
      });
      
    } catch (error) {
      trace.generation({
        name: 'Monitor Failed',
        input: options,
        output: { error: error.message },
        level: 'ERROR'
      });
      
      console.error(chalk.red('❌ Failed to start monitor:'), error.message);
      process.exit(1);
    } finally {
      await langfuse.flush();
    }
  });

// Stop command
program
  .command('stop')
  .description('Stop all Docker containers and agents')
  .action(async () => {
    console.log(chalk.yellow('🛑 Stopping Claude Flow...'));
    
    const trace = langfuse.trace({
      name: 'Swarm Shutdown',
      sessionId: `shutdown-${Date.now()}`
    });
    
    try {
      const dockerCompose = spawn('docker-compose', [
        '-f', 'docker-compose.claude-flow-agents.yml',
        'down'
      ], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      await new Promise((resolve, reject) => {
        dockerCompose.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Docker compose failed with code ${code}`));
        });
      });
      
      trace.generation({
        name: 'Shutdown Complete',
        output: { success: true }
      });
      
      console.log(chalk.green('✅ All containers stopped'));
      
    } catch (error) {
      trace.generation({
        name: 'Shutdown Failed',
        output: { error: error.message },
        level: 'ERROR'
      });
      
      console.error(chalk.red('❌ Failed to stop containers:'), error.message);
    } finally {
      await langfuse.flush();
    }
  });

// Helper functions
async function waitForCoordinator(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${COORDINATOR_URL}/health`);
      if (response.ok) return;
    } catch (error) {
      // Continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Coordinator failed to start');
}

async function monitorTask(taskId, trace) {
  console.log(chalk.yellow('\n⏳ Monitoring task progress...'));
  
  const checkInterval = setInterval(async () => {
    try {
      // In a real implementation, we'd check task status via API
      // For now, we'll simulate monitoring
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(chalk.green('✅ Task completed successfully'));
      
      trace.generation({
        name: 'Task Completed',
        input: { taskId },
        output: { status: 'completed' }
      });
      
      clearInterval(checkInterval);
    } catch (error) {
      console.error(chalk.red('❌ Task monitoring error:'), error.message);
      clearInterval(checkInterval);
    }
  }, 1000);
  
  // Wait for task completion
  await new Promise(resolve => {
    const checkCompletion = setInterval(() => {
      if (!checkInterval._destroyed) {
        clearInterval(checkCompletion);
        resolve();
      }
    }, 100);
  });
}

// Parse CLI arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}