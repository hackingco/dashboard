import { HiveService } from './hive.service';
import { AgentService } from './agent.service';

/**
 * Initialize Claude Flow Hive Mind services
 * This should be called on application startup
 */
export async function initializeHiveMind() {
  console.log('🐝 Initializing Claude Flow Hive Mind...');
  
  try {
    // Get singleton instances to trigger initialization
    const hiveService = HiveService.getInstance();
    const agentService = AgentService.getInstance();
    
    // Verify services are ready
    if (hiveService && agentService) {
      console.log('✅ Hive Mind services initialized successfully');
      console.log('   - HiveService: Ready');
      console.log('   - AgentService: Ready');
      console.log('   - Memory Store: .hive-mind/hive.db');
      console.log('   - Claude Flow: .swarm/memory.db');
    }
    
    return { hiveService, agentService };
  } catch (error) {
    console.error('❌ Failed to initialize Hive Mind:', error);
    throw error;
  }
}