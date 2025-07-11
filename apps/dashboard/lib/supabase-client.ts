import { getSupabaseClient } from '@swarm/supabase';

// Re-export the client and operations
export const supabase = getSupabaseClient();
export { swarmOperations, workerOperations, taskOperations, logOperations, statsOperations } from '@swarm/supabase';