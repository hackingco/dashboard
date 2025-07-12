#!/usr/bin/env tsx

import { HiveService, AgentService } from './apps/manager/src/services/claude-flow';

async function testHiveIntegration() {
  console.log('🧪 Testing Claude Flow Hive Mind Integration...\n');

  const hiveService = HiveService.getInstance();
  const agentService = AgentService.getInstance();

  try {
    // Test 1: Create a swarm
    console.log('1️⃣ Creating a test swarm...');
    const swarm = await hiveService.createSwarm({
      name: 'Test Swarm',
      purpose: 'Integration testing for Claude Flow',
      topology: 'hierarchical',
      maxAgents: 5,
      strategy: 'adaptive',
      enableMemory: true,
      enableNeural: true
    });
    console.log('✅ Swarm created:', swarm.id);
    console.log('   Status:', swarm.status);
    console.log('   Topology:', swarm.topology);

    // Test 2: Spawn agents
    console.log('\n2️⃣ Spawning agents...');
    const agents = await Promise.all([
      hiveService.spawnAgent(swarm.id, 'coordinator', 'Lead Agent'),
      hiveService.spawnAgent(swarm.id, 'researcher', 'Research Agent'),
      hiveService.spawnAgent(swarm.id, 'coder', 'Dev Agent'),
      hiveService.spawnAgent(swarm.id, 'analyst', 'Data Agent')
    ]);
    console.log('✅ Spawned', agents.length, 'agents');
    agents.forEach(agent => {
      console.log(`   - ${agent.name} (${agent.type}): ${agent.status}`);
    });

    // Test 3: Scale swarm
    console.log('\n3️⃣ Scaling swarm to 7 agents...');
    await hiveService.scaleSwarm(swarm.id, 7);
    const scaledSwarm = hiveService.getSwarm(swarm.id);
    console.log('✅ Swarm scaled to', scaledSwarm?.agents.length, 'agents');

    // Test 4: Assign a task
    console.log('\n4️⃣ Assigning task to coordinator...');
    const coordinatorAgent = scaledSwarm?.agents.find(a => a.type === 'coordinator');
    if (coordinatorAgent) {
      const task = await agentService.assignTask(swarm.id, coordinatorAgent.id, {
        description: 'Coordinate integration test workflow',
        priority: 'high',
        status: 'pending'
      });
      console.log('✅ Task assigned:', task.id);
      console.log('   Description:', task.description);
      console.log('   Priority:', task.priority);
    }

    // Test 5: Store and retrieve memory
    console.log('\n5️⃣ Testing memory storage...');
    await hiveService.storeMemory(swarm.id, 'test/integration', {
      timestamp: new Date().toISOString(),
      test: 'success',
      data: { foo: 'bar', count: 42 }
    });
    const retrieved = await hiveService.retrieveMemory(swarm.id, 'test/integration');
    console.log('✅ Memory stored and retrieved:');
    console.log('   Data:', JSON.stringify(retrieved, null, 2));

    // Test 6: Get swarm intelligence
    console.log('\n6️⃣ Getting swarm intelligence...');
    const intelligence = await hiveService.getSwarmIntelligence(swarm.id);
    console.log('✅ Intelligence data retrieved:');
    console.log('   Neural accuracy:', intelligence.neural.accuracy);
    console.log('   Memory size:', intelligence.memory.size);
    console.log('   Agent count:', intelligence.agents.length);

    // Test 7: Train neural patterns
    console.log('\n7️⃣ Training neural patterns...');
    await hiveService.trainNeuralPatterns(swarm.id, 5);
    console.log('✅ Neural patterns trained');

    // Test 8: Analyze performance
    console.log('\n8️⃣ Analyzing performance...');
    const performance = await agentService.analyzePerformance(swarm.id);
    console.log('✅ Performance analysis:');
    console.log('   Active tasks:', performance.tasks.active);
    console.log('   Completed tasks:', performance.tasks.completed);
    console.log('   Failed tasks:', performance.tasks.failed);

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Swarm ID:', swarm.id);
    console.log('- Total agents:', scaledSwarm?.agents.length);
    console.log('- Memory entries:', scaledSwarm?.memory.size);
    console.log('- Neural accuracy:', scaledSwarm?.neural.accuracy);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testHiveIntegration().catch(console.error);