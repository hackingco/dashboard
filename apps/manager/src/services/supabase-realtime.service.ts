import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import logger from './logger';
import { langfuseService } from './langfuse/langfuse.service';
import { trustGraphService } from './trustgraph/trustgraph.service';
import { WebSocketService } from './websocket.service';

export interface MachineState {
  id: string;
  swarm_id: string;
  worker_id: string | null;
  machine_id: string;
  status: 'initializing' | 'running' | 'stopped' | 'failed' | 'destroyed';
  region: string;
  fly_app_name: string;
  config: Record<string, any>;
  metrics: Record<string, any>;
  private_ip: string | null;
  public_ip: string | null;
  cpu_count: number;
  memory_mb: number;
  langfuse_trace_id: string | null;
  trustgraph_node_id: string | null;
  last_heartbeat: string | null;
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  created_at: string;
  updated_at: string;
}

export interface StateSyncEvent {
  id: string;
  machine_state_id: string;
  swarm_id: string;
  event_type: string;
  old_state: Record<string, any> | null;
  new_state: Record<string, any>;
  delta: Record<string, any>;
  source: string;
  correlation_id: string | null;
  broadcast_attempted: boolean;
  broadcast_success: boolean;
  created_at: string;
}

export interface WSBroadcastChannel {
  id: string;
  channel_name: string;
  swarm_id: string | null;
  channel_type: 'swarm_updates' | 'machine_states' | 'task_progress' | 'system_events';
  active_subscribers: number;
  total_messages_sent: number;
  created_at: string;
}

export interface RealtimeStateDelta {
  event_type: 'state_change' | 'machine_created' | 'machine_destroyed';
  machine_id: string;
  swarm_id: string;
  old_status?: string;
  new_status?: string;
  changes: Record<string, any>;
  timestamp: string;
}

export class SupabaseRealtimeService extends EventEmitter {
  private client: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private wsService: WebSocketService | null = null;

  constructor() {
    super();
    
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10 // Rate limiting for realtime events
        }
      }
    });

    this.setupConnectionMonitoring();
  }

  private setupConnectionMonitoring(): void {
    // Monitor connection status
    // TODO: Update to use new Supabase Realtime API
    // The onOpen, onClose, and onError methods are not available in the current API
    // For now, we'll rely on channel-level monitoring
    this.connectionStatus = 'connected';
    logger.info('Supabase Realtime monitoring initialized');
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit('max_reconnects_reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connectionStatus = 'connecting';
      // Channels will auto-reconnect
    }, delay);
  }

  // Set WebSocket service for real-time broadcasting
  setWebSocketService(wsService: WebSocketService): void {
    this.wsService = wsService;
    logger.info('WebSocket service connected to Supabase Realtime');
  }

  // Machine State Management
  async createMachineState(data: Partial<MachineState>): Promise<MachineState> {
    const traceId = langfuseService.startTrace('create_machine_state', {
      machine_id: data.machine_id,
      swarm_id: data.swarm_id
    });

    try {
      const { data: machineState, error } = await this.client
        .from('machine_states')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Create TrustGraph node for machine creation
      await trustGraphService.createNode({
        id: `machine_${machineState.machine_id}`,
        type: 'machine',
        label: `Machine ${machineState.machine_id}`,
        metadata: {
          swarm_id: machineState.swarm_id,
          region: machineState.region,
          status: machineState.status
        }
      });

      await langfuseService.endTrace(traceId, { machine_state_id: machineState.id });
      
      logger.info('Machine state created', { 
        machine_id: machineState.machine_id,
        swarm_id: machineState.swarm_id 
      });

      return machineState;
    } catch (error) {
      await langfuseService.trackError(traceId, error as Error);
      throw error;
    }
  }

  async updateMachineState(
    machineId: string, 
    updates: Partial<MachineState>
  ): Promise<MachineState> {
    const traceId = langfuseService.startTrace('update_machine_state', {
      machine_id: machineId,
      updates: Object.keys(updates)
    });

    try {
      const { data: machineState, error } = await this.client
        .from('machine_states')
        .update(updates)
        .eq('machine_id', machineId)
        .select()
        .single();

      if (error) throw error;

      await langfuseService.endTrace(traceId, { updated_fields: Object.keys(updates) });
      
      logger.debug('Machine state updated', { 
        machine_id: machineId,
        fields: Object.keys(updates)
      });

      return machineState;
    } catch (error) {
      await langfuseService.trackError(traceId, error as Error);
      throw error;
    }
  }

  async getMachineState(machineId: string): Promise<MachineState | null> {
    const { data, error } = await this.client
      .from('machine_states')
      .select('*')
      .eq('machine_id', machineId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data;
  }

  async getSwarmMachineStates(swarmId: string): Promise<MachineState[]> {
    const { data, error } = await this.client
      .from('machine_states')
      .select('*')
      .eq('swarm_id', swarmId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Realtime Subscriptions
  async subscribeToMachineStates(
    swarmId: string,
    callback: (event: RealtimeStateDelta) => void
  ): Promise<string> {
    const channelName = `swarm:${swarmId}:machine_states`;
    
    if (this.channels.has(channelName)) {
      logger.warn(`Already subscribed to channel: ${channelName}`);
      return channelName;
    }

    const channel = this.client
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'machine_states',
        filter: `swarm_id=eq.${swarmId}`
      }, (payload) => {
        this.handleMachineStateChange(payload, callback);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'state_sync_events',
        filter: `swarm_id=eq.${swarmId}`
      }, (payload) => {
        this.handleStateSyncEvent(payload, callback);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Subscribed to machine states for swarm: ${swarmId}`);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(`Failed to subscribe to machine states for swarm: ${swarmId}`);
        }
      });

    this.channels.set(channelName, channel);
    
    // Register WebSocket broadcast channel
    await this.registerWSChannel(channelName, swarmId, 'machine_states');

    return channelName;
  }

  private async handleMachineStateChange(
    payload: any,
    callback: (event: RealtimeStateDelta) => void
  ): Promise<void> {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      let delta: RealtimeStateDelta;
      
      if (eventType === 'INSERT') {
        delta = {
          event_type: 'machine_created',
          machine_id: newRecord.machine_id,
          swarm_id: newRecord.swarm_id,
          new_status: newRecord.status,
          changes: { created: newRecord },
          timestamp: newRecord.created_at
        };
      } else if (eventType === 'UPDATE') {
        const changes: Record<string, any> = {};
        
        // Compare relevant fields for changes
        ['status', 'health_status', 'metrics', 'last_heartbeat'].forEach(field => {
          if (oldRecord[field] !== newRecord[field]) {
            changes[field] = {
              from: oldRecord[field],
              to: newRecord[field]
            };
          }
        });

        delta = {
          event_type: 'state_change',
          machine_id: newRecord.machine_id,
          swarm_id: newRecord.swarm_id,
          old_status: oldRecord.status,
          new_status: newRecord.status,
          changes,
          timestamp: newRecord.updated_at
        };
      } else {
        return; // DELETE events handled separately
      }

      // Emit TrustGraph node for WebSocket broadcast
      await this.emitTrustGraphWSNode(
        delta.swarm_id,
        'ws_broadcast',
        delta.event_type,
        `swarm:${delta.swarm_id}:machine_states`,
        delta
      );

      callback(delta);
      this.emit('machine_state_change', delta);
      
      // Forward state change to WebSocket clients
      if (this.wsService) {
        this.wsService.broadcastMachineUpdate(
          `swarm-${delta.swarm_id}`,
          delta.machine_id,
          delta.new_status || delta.event_type,
          {
            delta,
            swarmId: delta.swarm_id,
            correlationId: newRecord.langfuse_trace_id || delta.correlation_id,
            timestamp: delta.timestamp
          }
        );
        
        logger.debug('Forwarded machine state change to WebSocket clients', {
          swarmId: delta.swarm_id,
          machineId: delta.machine_id,
          eventType: delta.event_type
        });
      }
      
    } catch (error) {
      logger.error('Error handling machine state change', { error, payload });
    }
  }

  private async handleStateSyncEvent(
    payload: any,
    callback: (event: RealtimeStateDelta) => void
  ): Promise<void> {
    try {
      const { new: syncEvent } = payload;
      
      if (syncEvent.delta) {
        callback(syncEvent.delta);
        this.emit('state_sync_event', syncEvent);
      }
    } catch (error) {
      logger.error('Error handling state sync event', { error, payload });
    }
  }

  async subscribeToAllMachineStates(
    callback: (event: RealtimeStateDelta) => void
  ): Promise<string> {
    const channelName = 'global:machine_states';
    
    if (this.channels.has(channelName)) {
      logger.warn(`Already subscribed to global machine states`);
      return channelName;
    }

    const channel = this.client
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'machine_states'
      }, (payload) => {
        this.handleMachineStateChange(payload, callback);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to global machine states');
        }
      });

    this.channels.set(channelName, channel);
    return channelName;
  }

  async unsubscribe(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName);
    if (channel) {
      await this.client.removeChannel(channel);
      this.channels.delete(channelName);
      logger.info(`Unsubscribed from channel: ${channelName}`);
    }
  }

  async unsubscribeAll(): Promise<void> {
    for (const [channelName, channel] of this.channels) {
      await this.client.removeChannel(channel);
    }
    this.channels.clear();
    logger.info('Unsubscribed from all channels');
  }

  // WebSocket Broadcast Channel Management
  private async registerWSChannel(
    channelName: string,
    swarmId: string | null,
    channelType: WSBroadcastChannel['channel_type']
  ): Promise<void> {
    try {
      const { error } = await this.client
        .from('ws_broadcast_channels')
        .upsert({
          channel_name: channelName,
          swarm_id: swarmId,
          channel_type: channelType,
          active_subscribers: 1
        }, {
          onConflict: 'channel_name'
        });

      if (error) throw error;
      
      logger.debug('Registered WebSocket broadcast channel', { channelName, channelType });
    } catch (error) {
      logger.error('Failed to register WebSocket channel', { channelName, error });
    }
  }

  private async emitTrustGraphWSNode(
    swarmId: string,
    nodeType: string,
    eventType: string,
    wsChannel: string,
    payload: any
  ): Promise<void> {
    try {
      // Call the database function to emit TrustGraph node
      const { error } = await this.client.rpc('emit_trustgraph_ws_node', {
        p_swarm_id: swarmId,
        p_node_type: nodeType,
        p_ws_event_type: eventType,
        p_ws_channel: wsChannel,
        p_ws_payload: payload
      });

      if (error) throw error;
      
      logger.debug('Emitted TrustGraph WebSocket node', { 
        swarmId, 
        eventType, 
        wsChannel 
      });
    } catch (error) {
      logger.error('Failed to emit TrustGraph WebSocket node', { error });
    }
  }

  // State Sync Event Queries
  async getStateSyncEvents(
    swarmId?: string,
    machineStateId?: string,
    eventType?: string,
    limit: number = 100
  ): Promise<StateSyncEvent[]> {
    let query = this.client
      .from('state_sync_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (swarmId) {
      query = query.eq('swarm_id', swarmId);
    }

    if (machineStateId) {
      query = query.eq('machine_state_id', machineStateId);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  }

  // Health and Monitoring
  async getSwarmHealthRealtime(swarmId: string): Promise<any> {
    const { data, error } = await this.client
      .rpc('get_swarm_health_realtime', { p_swarm_id: swarmId });

    if (error) throw error;
    return data?.[0] || null;
  }

  async getMachineStateMonitoring(): Promise<any[]> {
    const { data, error } = await this.client
      .from('machine_state_monitoring')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Connection Status
  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  // Get Supabase client for external use
  getClient(): SupabaseClient {
    return this.client;
  }

  // Cleanup
  async destroy(): Promise<void> {
    await this.unsubscribeAll();
    this.client.realtime.disconnect();
    this.removeAllListeners();
    logger.info('Supabase Realtime service destroyed');
  }
}

// Export singleton instance
export const supabaseRealtimeService = new SupabaseRealtimeService();