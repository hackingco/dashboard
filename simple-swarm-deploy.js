#!/usr/bin/env node

/**
 * Simple Swarm Deployment with Langfuse Integration
 * Deploys a coordinated swarm with observable tracing
 */

const { execSync } = require('child_process');

console.log('🚀 Deploying Simple Swarm with Coordination...');

// Configuration
const swarmConfig = {
  SWARM_ID: 'coordinated-deployment-swarm',
  AGENTS: [
    { name: 'Coordinator', role: 'coordinator', id: 'coord-001' },
    { name: 'Researcher', role: 'researcher', id: 'research-001' },
    { name: 'Coder', role: 'coder', id: 'coder-001' },
    { name: 'Analyst', role: 'analyst', id: 'analyst-001' },
    { name: 'Tester', role: 'tester', id: 'tester-001' }
  ]
};

async function deploySwarm() {
  try {
    console.log('📋 1. Starting deployment coordination...');
    
    // Pre-deployment hook
    execSync('npx claude-flow@alpha hooks pre-task --description "Deploy coordinated swarm with tracing"', { stdio: 'inherit' });
    
    console.log('🤖 2. Deploying swarm agents...');
    
    // Deploy each agent with coordination
    for (const agent of swarmConfig.AGENTS) {
      console.log(`   🟢 Deploying ${agent.name} (${agent.role})...`);
      
      // Store agent configuration in memory
      const memoryKey = `swarm/${swarmConfig.SWARM_ID}/agent/${agent.id}`;
      const agentData = JSON.stringify({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: 'deployed',
        deployedAt: new Date().toISOString(),
        swarmId: swarmConfig.SWARM_ID
      });
      
      // Use sqlite directly to store agent data
      const query = `sqlite3 .swarm/memory.db "INSERT OR REPLACE INTO memory_entries (key, value, namespace, metadata) VALUES ('${memoryKey}', '${agentData}', 'swarm_deployment', '{\\\"type\\\": \\\"agent_config\\\"}')"`;
      execSync(query, { stdio: 'pipe' });
      
      // Notification for each agent
      execSync(`npx claude-flow@alpha hooks notify --message "Agent ${agent.name} deployed successfully" --level "success"`, { stdio: 'inherit' });
    }
    
    console.log('💾 3. Setting up coordination memory...');
    
    // Store swarm configuration
    const swarmMemoryKey = `swarm/${swarmConfig.SWARM_ID}/config`;
    const swarmData = JSON.stringify({
      swarmId: swarmConfig.SWARM_ID,
      agentCount: swarmConfig.AGENTS.length,
      deployedAt: new Date().toISOString(),
      coordinationEnabled: true,
      langfuseEnabled: process.env.LANGFUSE_PUBLIC_KEY ? true : false,
      status: 'active'
    });
    
    const swarmQuery = `sqlite3 .swarm/memory.db "INSERT OR REPLACE INTO memory_entries (key, value, namespace, metadata) VALUES ('${swarmMemoryKey}', '${swarmData}', 'swarm_deployment', '{\\\"type\\\": \\\"swarm_config\\\"}')"`;
    execSync(swarmQuery, { stdio: 'pipe' });
    
    console.log('🔗 4. Verifying coordination setup...');
    
    // Verify memory storage
    const verifyQuery = `sqlite3 .swarm/memory.db "SELECT COUNT(*) FROM memory_entries WHERE namespace = 'swarm_deployment'"`;
    const entryCount = execSync(verifyQuery, { encoding: 'utf8' }).trim();
    
    console.log('✅ 5. Deployment completed successfully!');
    console.log(`   📊 Memory entries created: ${entryCount}`);
    
    // Post-deployment hook
    execSync('npx claude-flow@alpha hooks post-task --task-id "swarm-deployment" --analyze-performance true', { stdio: 'inherit' });
    
    // Display deployment summary
    console.log('\n🎯 DEPLOYMENT SUMMARY:');
    console.log(`   🆔 Swarm ID: ${swarmConfig.SWARM_ID}`);
    console.log(`   🤖 Agents Deployed: ${swarmConfig.AGENTS.length}`);
    console.log(`   💾 Coordination Memory: Active (${entryCount} entries)`);
    console.log(`   🔗 Langfuse Integration: ${process.env.LANGFUSE_PUBLIC_KEY ? 'Enabled' : 'Disabled'}`);
    
    // Show agent roster
    console.log('\n👥 AGENT ROSTER:');
    swarmConfig.AGENTS.forEach(agent => {
      console.log(`   🟢 ${agent.name} (${agent.role}) - ID: ${agent.id}`);
    });
    
    return {
      success: true,
      swarmId: swarmConfig.SWARM_ID,
      agentsDeployed: swarmConfig.AGENTS.length,
      memoryEntries: parseInt(entryCount)
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    
    // Error notification
    execSync(`npx claude-flow@alpha hooks notify --message "Swarm deployment failed: ${error.message}" --level "error"`, { stdio: 'inherit' });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute deployment
deploySwarm()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 Swarm deployment with coordination completed successfully!');
      process.exit(0);
    } else {
      console.error('\n💥 Deployment failed:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unexpected deployment error:', error);
    process.exit(1);
  });