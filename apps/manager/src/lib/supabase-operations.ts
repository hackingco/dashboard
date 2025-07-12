import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Client singleton
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const isBrowser = false; // Server-side only for this app
    
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: isBrowser,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  
  return supabaseClient;
}

// Service role client for server-side operations
export function getSupabaseServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service configuration');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
}

// Swarm operations
export const swarmOperations = {
  async create(data: any) {
    const client = getSupabaseClient();
    const { data: swarm, error } = await client
      .from('swarms')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return swarm;
  },

  async list() {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('swarms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async get(id: string) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('swarms')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: any) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('swarms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const client = getSupabaseClient();
    const { error } = await client
      .from('swarms')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Real-time subscription
  subscribe(callback: (payload: any) => void) {
    const client = getSupabaseClient();
    return client
      .channel('swarms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swarms' }, callback)
      .subscribe();
  },
};

// Worker operations
export const workerOperations = {
  async create(data: any) {
    const client = getSupabaseClient();
    const { data: worker, error } = await client
      .from('workers')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return worker;
  },

  async listBySwarm(swarmId: string) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('workers')
      .select('*')
      .eq('swarm_id', swarmId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async updateHeartbeat(workerId: string) {
    const client = getSupabaseClient();
    const { error } = await client
      .from('workers')
      .update({ last_heartbeat: new Date().toISOString() })
      .eq('id', workerId);
    
    if (error) throw error;
  },

  // Real-time subscription for workers
  subscribeToSwarm(swarmId: string, callback: (payload: any) => void) {
    const client = getSupabaseClient();
    return client
      .channel(`workers-${swarmId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers', filter: `swarm_id=eq.${swarmId}` },
        callback
      )
      .subscribe();
  },
};

// Task operations
export const taskOperations = {
  async create(data: any) {
    const client = getSupabaseClient();
    const { data: task, error } = await client
      .from('tasks')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return task;
  },

  async listBySwarm(swarmId: string, status?: string) {
    const client = getSupabaseClient();
    let query = client
      .from('tasks')
      .select('*')
      .eq('swarm_id', swarmId);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async assignToWorker(taskId: string, workerId: string) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tasks')
      .update({ 
        worker_id: workerId, 
        status: 'assigned',
        started_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async complete(taskId: string, output: any) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tasks')
      .update({ 
        status: 'completed',
        output,
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async fail(taskId: string, error: string) {
    const client = getSupabaseClient();
    const { data, error: updateError } = await client
      .from('tasks')
      .update({ 
        status: 'failed',
        error,
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    return data;
  },
};

// Log operations
export const logOperations = {
  async create(data: any) {
    const client = getSupabaseClient();
    const { error } = await client
      .from('logs')
      .insert(data);
    
    if (error) throw error;
  },

  async listBySwarm(swarmId: string, limit = 100) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('logs')
      .select('*')
      .eq('swarm_id', swarmId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  // Real-time log streaming
  subscribeToSwarm(swarmId: string, callback: (payload: any) => void) {
    const client = getSupabaseClient();
    return client
      .channel(`logs-${swarmId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'logs', filter: `swarm_id=eq.${swarmId}` },
        callback
      )
      .subscribe();
  },
};

// Metrics operations
export const metricsOperations = {
  async record(data: any) {
    const client = getSupabaseClient();
    const { error } = await client
      .from('metrics')
      .insert(data);
    
    if (error) throw error;
  },

  async query(swarmId: string, metricName: string, since: Date) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('metrics')
      .select('*')
      .eq('swarm_id', swarmId)
      .eq('metric_name', metricName)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },
};

// Stats and aggregations
export const statsOperations = {
  async getSwarmStats(swarmId?: string) {
    const client = getSupabaseClient();
    let query = client.from('swarm_stats').select('*');
    
    if (swarmId) {
      query = query.eq('id', swarmId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async getRecentActivity(limit = 20) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .rpc('get_recent_activity', { limit_count: limit });
    
    if (error) throw error;
    return data || [];
  },
};