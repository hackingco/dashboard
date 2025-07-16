// Enhanced Swarm Coordination Hook
// Created: 2025-07-14
// Purpose: React hook for comprehensive swarm management

import { useState, useEffect, useCallback, useRef } from 'react';
import SwarmCoordinationClient from '@/lib/swarm-coordination-client';
import {
  SwarmNetwork,
  SwarmSession,
  SwarmAgent,
  SwarmTask,
  SwarmMemory,
  CoordinationEvent,
  PerformanceMetric,
  SwarmHealth,
  SwarmDashboardMetrics,
  SwarmRealtimeConfig,
  SwarmQueryConfig,
  SwarmOperationResult,
  PaginatedResponse
} from '@/lib/swarm-coordination-types';

interface UseSwarmCoordinationOptions {
  enableRealtime?: boolean;
  realtimeConfig?: SwarmRealtimeConfig;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface SwarmCoordinationState {
  // Data
  networks: SwarmNetwork[];
  sessions: SwarmSession[];
  agents: SwarmAgent[];
  tasks: SwarmTask[];
  memory: SwarmMemory[];
  events: CoordinationEvent[];
  metrics: PerformanceMetric[];
  health: SwarmHealth[];
  dashboardMetrics: SwarmDashboardMetrics | null;

  // Loading states
  loading: {
    networks: boolean;
    sessions: boolean;
    agents: boolean;
    tasks: boolean;
    memory: boolean;
    events: boolean;
    metrics: boolean;
    health: boolean;
    dashboard: boolean;
  };

  // Error states
  errors: {
    networks: string | null;
    sessions: string | null;
    agents: string | null;
    tasks: string | null;
    memory: string | null;
    events: string | null;
    metrics: string | null;
    health: string | null;
    dashboard: string | null;
  };

  // Connection state
  connected: boolean;
  lastUpdate: Date | null;
}

export function useSwarmCoordination(options: UseSwarmCoordinationOptions = {}) {
  const {
    enableRealtime = true,
    realtimeConfig = {
      enableNetworks: true,
      enableSessions: true,
      enableAgents: true,
      enableTasks: true,
      enableEvents: true,
      enableMetrics: true,
      enableHealth: true
    },
    autoRefresh = true,
    refreshInterval = 30000 // 30 seconds
  } = options;

  // Initialize client
  const clientRef = useRef<SwarmCoordinationClient | null>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize client on first render
  useEffect(() => {
    if (!clientRef.current && typeof window !== 'undefined') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      clientRef.current = new SwarmCoordinationClient(supabaseUrl, supabaseKey);
    }
  }, []);

  // State
  const [state, setState] = useState<SwarmCoordinationState>({
    networks: [],
    sessions: [],
    agents: [],
    tasks: [],
    memory: [],
    events: [],
    metrics: [],
    health: [],
    dashboardMetrics: null,
    loading: {
      networks: false,
      sessions: false,
      agents: false,
      tasks: false,
      memory: false,
      events: false,
      metrics: false,
      health: false,
      dashboard: false
    },
    errors: {
      networks: null,
      sessions: null,
      agents: null,
      tasks: null,
      memory: null,
      events: null,
      metrics: null,
      health: null,
      dashboard: null
    },
    connected: false,
    lastUpdate: null
  });

  // Helper to update loading state
  const setLoading = useCallback((entity: keyof SwarmCoordinationState['loading'], loading: boolean) => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, [entity]: loading }
    }));
  }, []);

  // Helper to update error state
  const setError = useCallback((entity: keyof SwarmCoordinationState['errors'], error: string | null) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [entity]: error }
    }));
  }, []);

  // Generic fetch function
  const fetchData = useCallback(async <T>(
    entity: keyof SwarmCoordinationState['loading'],
    fetchFn: () => Promise<SwarmOperationResult<PaginatedResponse<T> | T>>,
    updateFn: (data: T[] | T) => void
  ) => {
    if (!clientRef.current) return;

    setLoading(entity, true);
    setError(entity, null);

    try {
      const result = await fetchFn();
      
      if (result.success && result.data) {
        // Handle paginated response
        if ('data' in result.data && Array.isArray(result.data.data)) {
          updateFn(result.data.data);
        } else {
          updateFn(result.data);
        }
        
        setState(prev => ({ ...prev, lastUpdate: new Date(), connected: true }));
      } else {
        setError(entity, result.error || 'Unknown error');
      }
    } catch (error) {
      setError(entity, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(entity, false);
    }
  }, [setLoading, setError]);

  // Data fetching functions
  const fetchNetworks = useCallback((config?: SwarmQueryConfig) => {
    return fetchData(
      'networks',
      () => clientRef.current!.getNetworks(config),
      (data) => setState(prev => ({ ...prev, networks: data as SwarmNetwork[] }))
    );
  }, [fetchData]);

  const fetchSessions = useCallback((config?: SwarmQueryConfig) => {
    return fetchData(
      'sessions',
      () => clientRef.current!.getSessions(config),
      (data) => setState(prev => ({ ...prev, sessions: data as SwarmSession[] }))
    );
  }, [fetchData]);

  const fetchAgents = useCallback((config?: SwarmQueryConfig) => {
    return fetchData(
      'agents',
      () => clientRef.current!.getAgents(config),
      (data) => setState(prev => ({ ...prev, agents: data as SwarmAgent[] }))
    );
  }, [fetchData]);

  const fetchTasks = useCallback((config?: SwarmQueryConfig) => {
    return fetchData(
      'tasks',
      () => clientRef.current!.getTasks(config),
      (data) => setState(prev => ({ ...prev, tasks: data as SwarmTask[] }))
    );
  }, [fetchData]);

  const fetchEvents = useCallback((config?: SwarmQueryConfig) => {
    return fetchData(
      'events',
      () => clientRef.current!.getCoordinationEvents(config),
      (data) => setState(prev => ({ ...prev, events: data as CoordinationEvent[] }))
    );
  }, [fetchData]);

  const fetchMetrics = useCallback((config?: SwarmQueryConfig) => {
    return fetchData(
      'metrics',
      () => clientRef.current!.getMetrics(config),
      (data) => setState(prev => ({ ...prev, metrics: data as PerformanceMetric[] }))
    );
  }, [fetchData]);

  const fetchHealth = useCallback((config?: SwarmQueryConfig) => {
    return fetchData(
      'health',
      () => clientRef.current!.getHealthStatus(config),
      (data) => setState(prev => ({ ...prev, health: data as SwarmHealth[] }))
    );
  }, [fetchData]);

  const fetchDashboardMetrics = useCallback(() => {
    return fetchData(
      'dashboard',
      () => clientRef.current!.getDashboardMetrics(),
      (data) => setState(prev => ({ ...prev, dashboardMetrics: data as SwarmDashboardMetrics }))
    );
  }, [fetchData]);

  // Search memory
  const searchMemory = useCallback(async (pattern: string, namespace?: string) => {
    if (!clientRef.current) return;

    setLoading('memory', true);
    setError('memory', null);

    try {
      const result = await clientRef.current.searchMemory(pattern, namespace);
      
      if (result.success && result.data) {
        setState(prev => ({ ...prev, memory: result.data as SwarmMemory[] }));
      } else {
        setError('memory', result.error || 'Unknown error');
      }
    } catch (error) {
      setError('memory', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading('memory', false);
    }
  }, [setLoading, setError]);

  // Refresh all data
  const refreshAll = useCallback(() => {
    fetchNetworks();
    fetchSessions();
    fetchAgents();
    fetchTasks();
    fetchEvents();
    fetchMetrics();
    fetchHealth();
    fetchDashboardMetrics();
  }, [fetchNetworks, fetchSessions, fetchAgents, fetchTasks, fetchEvents, fetchMetrics, fetchHealth, fetchDashboardMetrics]);

  // Real-time subscription setup
  useEffect(() => {
    if (!enableRealtime || !clientRef.current) return;

    const unsubscribe = clientRef.current.subscribeToSwarmUpdates(
      realtimeConfig,
      (event) => {
        console.log('Real-time swarm update:', event);
        
        // Update state based on the event
        setState(prev => ({ ...prev, lastUpdate: new Date(), connected: true }));
        
        // Optionally refresh specific data based on the table that changed
        const table = event.table;
        switch (table) {
          case 'swarm_networks':
            fetchNetworks();
            break;
          case 'swarm_sessions':
            fetchSessions();
            break;
          case 'swarm_agents':
            fetchAgents();
            break;
          case 'swarm_tasks':
            fetchTasks();
            break;
          case 'coordination_events':
            fetchEvents();
            break;
          case 'performance_metrics':
            fetchMetrics();
            break;
          case 'swarm_health':
            fetchHealth();
            break;
        }
      }
    );

    subscriptionRef.current = unsubscribe;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [enableRealtime, realtimeConfig, fetchNetworks, fetchSessions, fetchAgents, fetchTasks, fetchEvents, fetchMetrics, fetchHealth]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    refreshIntervalRef.current = setInterval(() => {
      refreshAll();
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, refreshAll]);

  // Initial data fetch
  useEffect(() => {
    if (clientRef.current) {
      refreshAll();
    }
  }, [refreshAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Data fetching
    fetchNetworks,
    fetchSessions,
    fetchAgents,
    fetchTasks,
    fetchEvents,
    fetchMetrics,
    fetchHealth,
    fetchDashboardMetrics,
    searchMemory,
    refreshAll,
    
    // Client access for advanced operations
    client: clientRef.current
  };
}