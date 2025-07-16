import { HiveService } from './hive.service';
import { AgentService } from './agent.service';
// Fixed: Re-enabled @swarm/langfuse-wrapper import now that package is properly built
import { autoRegisterLangfuse, isLangfuseConfigured } from '@swarm/langfuse-wrapper';

/**
 * Initialize Claude Flow Hive Mind services with Langfuse integration
 * This should be called on application startup
 */
export async function initializeHiveMindWithLangfuse() {
  console.log('🐝 Initializing Claude Flow Hive Mind with observability...');
  
  try {
    // Check if Langfuse is configured
    if (isLangfuseConfigured()) {
      console.log('🔍 Langfuse observability enabled');
      
      // Auto-register Langfuse with any existing hooks
      autoRegisterLangfuse({
        enableLangfuse: true,
        langfuseConfig: {
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          host: process.env.LANGFUSE_HOST
        }
      });
    } else {
      console.log('⚠️  Langfuse not configured - observability disabled');
      console.log('   Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable');
    }
    
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
      if (isLangfuseConfigured()) {
        console.log('   - Langfuse: Connected');
      }
    }
    
    return { hiveService, agentService };
  } catch (error) {
    console.error('❌ Failed to initialize Hive Mind:', error);
    throw error;
  }
}

/**
 * Original initialization function without Langfuse
 * @deprecated Use initializeHiveMindWithLangfuse instead
 */
export { initializeHiveMind } from './init';