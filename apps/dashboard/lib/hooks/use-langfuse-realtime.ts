/**
 * React Hook for Real-time Langfuse Integration
 * Provides real-time trace streaming and agent monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { langfuseClient, LiveTrace, LiveAgent, SwarmMetrics } from '../langfuse-client';

interface UseLangfuseRealtimeOptions {
  sessionId?: string;
  swarmId?: string;
  maxTraces?: number;
  enableAutoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseLangfuseRealtimeReturn {
  // Connection state
  isConnected: boolean;
  isInitializing: boolean;
  error: string | null;
  
  // Data
  traces: LiveTrace[];
  agents: LiveAgent[];
  metrics: SwarmMetrics | null;
  
  // Stats
  totalTraces: number;
  activeTraces: number;
  recentActivity: number;
  
  // Control functions
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  refresh: () => Promise<void>;
  createTrace: (trace: Partial<LiveTrace>) => Promise<string | null>;
  clearTraces: () => void;
  
  // Real-time event handlers
  onTrace: (callback: (trace: LiveTrace) => void) => () => void;
  onAgent: (callback: (agent: LiveAgent) => void) => () => void;
  onMetrics: (callback: (metrics: SwarmMetrics) => void) => () => void;
}

export function useLangfuseRealtime(options: UseLangfuseRealtimeOptions = {}): UseLangfuseRealtimeReturn {
  const {
    sessionId,
    swarmId,
    maxTraces = 100,
    enableAutoRefresh = true,
    refreshInterval = 5000,
  } = options;

  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traces, setTraces] = useState<LiveTrace[]>([]);
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [metrics, setMetrics] = useState<SwarmMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState(0);

  // Refs for cleanup and performance
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventCallbacksRef = useRef({
    trace: new Set<(trace: LiveTrace) => void>(),
    agent: new Set<(agent: LiveAgent) => void>(),
    metrics: new Set<(metrics: SwarmMetrics) => void>(),
  });

  // Initialize connection and event listeners
  useEffect(() => {
    setIsInitializing(true);
    
    const handleConnected = () => {
      setIsConnected(true);
      setError(null);
      setIsInitializing(false);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    const handleError = (err: Error) => {
      setError(err.message);
      setIsInitializing(false);
    };

    const handleTrace = (trace: LiveTrace) => {
      // Filter by sessionId or swarmId if specified
      if (sessionId && trace.sessionId !== sessionId) return;
      if (swarmId && trace.swarmId !== swarmId) return;

      setTraces(prev => {
        const filtered = prev.filter(t => t.id !== trace.id);
        const updated = [trace, ...filtered].slice(0, maxTraces);
        return updated;
      });

      // Trigger activity indicator
      setRecentActivity(prev => prev + 1);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = setTimeout(() => setRecentActivity(0), 2000);

      // Notify subscribers
      eventCallbacksRef.current.trace.forEach(callback => callback(trace));
    };

    const handleAgent = (agent: LiveAgent) => {
      // Filter by swarmId if specified
      if (swarmId && agent.swarmId !== swarmId) return;

      setAgents(prev => {
        const filtered = prev.filter(a => a.id !== agent.id);
        return [agent, ...filtered];
      });

      // Notify subscribers
      eventCallbacksRef.current.agent.forEach(callback => callback(agent));
    };

    const handleMetrics = (newMetrics: SwarmMetrics) => {
      setMetrics(newMetrics);
      
      // Notify subscribers
      eventCallbacksRef.current.metrics.forEach(callback => callback(newMetrics));
    };

    // Attach event listeners
    langfuseClient.on('connected', handleConnected);
    langfuseClient.on('disconnected', handleDisconnected);
    langfuseClient.on('error', handleError);
    langfuseClient.on('trace', handleTrace);
    langfuseClient.on('agent', handleAgent);
    langfuseClient.on('metrics', handleMetrics);

    // Set initial connection state
    setIsConnected(langfuseClient.isRealtimeConnected());
    setIsInitializing(false);

    // Cleanup function
    return () => {
      langfuseClient.off('connected', handleConnected);
      langfuseClient.off('disconnected', handleDisconnected);
      langfuseClient.off('error', handleError);
      langfuseClient.off('trace', handleTrace);
      langfuseClient.off('agent', handleAgent);
      langfuseClient.off('metrics', handleMetrics);
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [sessionId, swarmId, maxTraces]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!enableAutoRefresh) return;

    const startAutoRefresh = () => {
      const refresh = async () => {
        try {
          // Fetch initial data
          const [fetchedTraces, fetchedMetrics] = await Promise.all([
            langfuseClient.getTraces({
              sessionId,
              limit: maxTraces,
              fromTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            }),
            langfuseClient.getSwarmMetrics(swarmId),
          ]);

          // Only update if we don't have real-time connection
          if (!isConnected) {
            setTraces(fetchedTraces);
            setMetrics(fetchedMetrics);
          }

        } catch (err) {
          console.error('Auto-refresh failed:', err);
          // Don't update error state for auto-refresh failures
        }

        // Schedule next refresh
        refreshTimeoutRef.current = setTimeout(refresh, refreshInterval);
      };

      // Initial refresh
      refresh();
    };

    startAutoRefresh();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [enableAutoRefresh, refreshInterval, sessionId, swarmId, maxTraces, isConnected]);

  // Control functions
  const connect = useCallback(() => {
    langfuseClient.reconnect();
  }, []);

  const disconnect = useCallback(() => {
    langfuseClient.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    langfuseClient.reconnect();
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [fetchedTraces, fetchedMetrics] = await Promise.all([
        langfuseClient.getTraces({
          sessionId,
          limit: maxTraces,
          fromTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }),
        langfuseClient.getSwarmMetrics(swarmId),
      ]);

      setTraces(fetchedTraces);
      setMetrics(fetchedMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    }
  }, [sessionId, swarmId, maxTraces]);

  const createTrace = useCallback(async (trace: Partial<LiveTrace>) => {
    try {
      const traceId = await langfuseClient.createTrace({
        ...trace,
        sessionId: trace.sessionId || sessionId,
        swarmId: trace.swarmId || swarmId,
        timestamp: trace.timestamp || new Date(),
      });
      return traceId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trace');
      return null;
    }
  }, [sessionId, swarmId]);

  const clearTraces = useCallback(() => {
    setTraces([]);
    setRecentActivity(0);
  }, []);

  // Event subscription functions
  const onTrace = useCallback((callback: (trace: LiveTrace) => void) => {
    eventCallbacksRef.current.trace.add(callback);
    
    return () => {
      eventCallbacksRef.current.trace.delete(callback);
    };
  }, []);

  const onAgent = useCallback((callback: (agent: LiveAgent) => void) => {
    eventCallbacksRef.current.agent.add(callback);
    
    return () => {
      eventCallbacksRef.current.agent.delete(callback);
    };
  }, []);

  const onMetrics = useCallback((callback: (metrics: SwarmMetrics) => void) => {
    eventCallbacksRef.current.metrics.add(callback);
    
    return () => {
      eventCallbacksRef.current.metrics.delete(callback);
    };
  }, []);

  // Computed values
  const totalTraces = traces.length;
  const activeTraces = traces.filter(trace => 
    trace.status === 'running' || 
    (trace.status === 'pending' && Date.now() - trace.timestamp.getTime() < 300000) // 5 minutes
  ).length;

  return {
    // Connection state
    isConnected,
    isInitializing,
    error,
    
    // Data
    traces,
    agents,
    metrics,
    
    // Stats
    totalTraces,
    activeTraces,
    recentActivity,
    
    // Control functions
    connect,
    disconnect,
    reconnect,
    refresh,
    createTrace,
    clearTraces,
    
    // Event handlers
    onTrace,
    onAgent,
    onMetrics,
  };
}

// Additional hook for simplified trace monitoring
export function useTraceMonitor(sessionId?: string) {
  const { traces, isConnected, onTrace } = useLangfuseRealtime({ sessionId });
  
  const [latestTrace, setLatestTrace] = useState<LiveTrace | null>(null);
  const [traceCount, setTraceCount] = useState(0);

  useEffect(() => {
    if (traces.length > 0) {
      setLatestTrace(traces[0]);
      setTraceCount(traces.length);
    }
  }, [traces]);

  useEffect(() => {
    return onTrace((trace) => {
      setLatestTrace(trace);
      setTraceCount(prev => prev + 1);
    });
  }, [onTrace]);

  return {
    latestTrace,
    traceCount,
    isConnected,
    traces: traces.slice(0, 10), // Return only recent traces
  };
}

// Hook for agent monitoring
export function useAgentMonitor(swarmId?: string) {
  const { agents, isConnected, onAgent } = useLangfuseRealtime({ swarmId });
  
  const activeAgents = agents.filter(agent => agent.status === 'active');
  const idleAgents = agents.filter(agent => agent.status === 'idle');
  const errorAgents = agents.filter(agent => agent.status === 'error');

  return {
    agents,
    activeAgents,
    idleAgents,
    errorAgents,
    totalAgents: agents.length,
    isConnected,
  };
}