/**
 * Custom React Hook: useRealtimeSwarm
 * Provides real-time Supabase subscriptions for swarm dashboard components
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, SwarmDatabase, type SwarmTrace, type SwarmAgent, type SwarmSession, type SwarmMetrics } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeSwarmOptions {
  sessionId?: string
  swarmId?: string
  enableTraces?: boolean
  enableAgents?: boolean
  enableMetrics?: boolean
  enableSessions?: boolean
  maxItems?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

interface SwarmRealtimeData {
  traces: SwarmTrace[]
  agents: SwarmAgent[]
  sessions: SwarmSession[]
  metrics: SwarmMetrics[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  subscriptionStatus: {
    traces: boolean
    agents: boolean
    sessions: boolean
    metrics: boolean
  }
}

interface SwarmMetricsAggregated {
  totalTraces: number
  activeTraces: number
  totalAgents: number
  activeAgents: number
  averageResponseTime: number
  errorRate: number
  throughput: number
  systemHealth: number
}

export function useRealtimeSwarm(options: UseRealtimeSwarmOptions = {}) {
  const {
    sessionId,
    swarmId = 'swarm_observability',
    enableTraces = true,
    enableAgents = true,
    enableMetrics = true,
    enableSessions = false,
    maxItems = 100,
    autoRefresh = true,
    refreshInterval = 5000
  } = options

  // State management
  const [data, setData] = useState<SwarmRealtimeData>({
    traces: [],
    agents: [],
    sessions: [],
    metrics: [],
    isConnected: false,
    isLoading: true,
    error: null,
    lastUpdate: null,
    subscriptionStatus: {
      traces: false,
      agents: false,
      sessions: false,
      metrics: false
    }
  })

  const [aggregatedMetrics, setAggregatedMetrics] = useState<SwarmMetricsAggregated | null>(null)

  // Refs for cleanup
  const channelsRef = useRef<RealtimeChannel[]>([])
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }))

      const promises = []

      if (enableTraces) {
        promises.push(SwarmDatabase.getTraces(sessionId, maxItems))
      }
      if (enableAgents) {
        promises.push(SwarmDatabase.getAgents(swarmId))
      }
      if (enableSessions) {
        promises.push(SwarmDatabase.getSessions(20))
      }
      if (enableMetrics && sessionId) {
        promises.push(SwarmDatabase.getMetrics(sessionId, undefined, maxItems))
      }

      const results = await Promise.all(promises)
      let tracesData = [], agentsData = [], sessionsData = [], metricsData = []

      let resultIndex = 0
      if (enableTraces) {
        tracesData = results[resultIndex++] || []
      }
      if (enableAgents) {
        agentsData = results[resultIndex++] || []
      }
      if (enableSessions) {
        sessionsData = results[resultIndex++] || []
      }
      if (enableMetrics && sessionId) {
        metricsData = results[resultIndex++] || []
      }

      setData(prev => ({
        ...prev,
        traces: tracesData,
        agents: agentsData,
        sessions: sessionsData,
        metrics: metricsData,
        isLoading: false,
        lastUpdate: new Date()
      }))

      // Calculate aggregated metrics
      updateAggregatedMetrics(tracesData, agentsData, metricsData)

    } catch (error) {
      console.error('Error fetching initial data:', error)
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch data'
      }))
    }
  }, [sessionId, swarmId, enableTraces, enableAgents, enableSessions, enableMetrics, maxItems])

  // Update aggregated metrics
  const updateAggregatedMetrics = useCallback((traces: SwarmTrace[], agents: SwarmAgent[], metrics: SwarmMetrics[]) => {
    const activeTraces = traces.filter(t => t.status === 'running' || t.status === 'pending').length
    const activeAgents = agents.filter(a => a.status === 'active').length
    const completedTraces = traces.filter(t => t.status === 'success' || t.status === 'error')
    const errorTraces = traces.filter(t => t.status === 'error')

    const avgResponseTime = agents.length > 0 
      ? agents.reduce((sum, a) => sum + a.average_response_time, 0) / agents.length 
      : 0

    const errorRate = traces.length > 0 ? (errorTraces.length / traces.length) * 100 : 0

    // Calculate throughput from recent metrics
    const recentMetrics = metrics.filter(m => 
      m.metric_type === 'task_throughput' && 
      Date.now() - new Date(m.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
    )
    const throughput = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.metric_value, 0) / recentMetrics.length
      : 0

    // Calculate system health score
    const healthFactors = [
      Math.max(0, 100 - errorRate * 2), // Error rate impact
      Math.min(100, (activeAgents / Math.max(agents.length, 1)) * 100), // Agent availability
      Math.max(0, 100 - Math.max(0, avgResponseTime - 1000) / 100), // Response time impact
      Math.min(100, throughput * 2) // Throughput impact
    ]
    const systemHealth = healthFactors.reduce((sum, factor) => sum + factor, 0) / healthFactors.length

    setAggregatedMetrics({
      totalTraces: traces.length,
      activeTraces,
      totalAgents: agents.length,
      activeAgents,
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: Number(errorRate.toFixed(2)),
      throughput: Number(throughput.toFixed(1)),
      systemHealth: Number(systemHealth.toFixed(1))
    })
  }, [])

  // Setup real-time subscriptions
  const setupSubscriptions = useCallback(() => {
    const channels: RealtimeChannel[] = []

    // Traces subscription
    if (enableTraces && sessionId) {
      const tracesChannel = supabase
        .channel(`traces-${sessionId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'swarm_traces',
          filter: `session_id=eq.${sessionId}`
        }, (payload) => {
          setData(prev => {
            let newTraces = [...prev.traces]

            if (payload.eventType === 'INSERT') {
              newTraces = [payload.new as SwarmTrace, ...newTraces.slice(0, maxItems - 1)]
            } else if (payload.eventType === 'UPDATE') {
              const index = newTraces.findIndex(t => t.id === payload.new.id)
              if (index >= 0) {
                newTraces[index] = payload.new as SwarmTrace
              }
            } else if (payload.eventType === 'DELETE') {
              newTraces = newTraces.filter(t => t.id !== payload.old.id)
            }

            const updated = {
              ...prev,
              traces: newTraces,
              lastUpdate: new Date(),
              subscriptionStatus: { ...prev.subscriptionStatus, traces: true }
            }

            // Update aggregated metrics
            updateAggregatedMetrics(newTraces, prev.agents, prev.metrics)

            return updated
          })
        })
        .subscribe()

      channels.push(tracesChannel)
    }

    // Agents subscription
    if (enableAgents) {
      const agentsChannel = supabase
        .channel(`agents-${swarmId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'swarm_agents',
          filter: `swarm_id=eq.${swarmId}`
        }, (payload) => {
          setData(prev => {
            let newAgents = [...prev.agents]

            if (payload.eventType === 'INSERT') {
              newAgents = [payload.new as SwarmAgent, ...newAgents]
            } else if (payload.eventType === 'UPDATE') {
              const index = newAgents.findIndex(a => a.id === payload.new.id)
              if (index >= 0) {
                newAgents[index] = payload.new as SwarmAgent
              }
            } else if (payload.eventType === 'DELETE') {
              newAgents = newAgents.filter(a => a.id !== payload.old.id)
            }

            const updated = {
              ...prev,
              agents: newAgents,
              lastUpdate: new Date(),
              subscriptionStatus: { ...prev.subscriptionStatus, agents: true }
            }

            // Update aggregated metrics
            updateAggregatedMetrics(prev.traces, newAgents, prev.metrics)

            return updated
          })
        })
        .subscribe()

      channels.push(agentsChannel)
    }

    // Metrics subscription
    if (enableMetrics && sessionId) {
      const metricsChannel = supabase
        .channel(`metrics-${sessionId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'swarm_metrics',
          filter: `session_id=eq.${sessionId}`
        }, (payload) => {
          setData(prev => {
            const newMetrics = [payload.new as SwarmMetrics, ...prev.metrics.slice(0, maxItems - 1)]

            const updated = {
              ...prev,
              metrics: newMetrics,
              lastUpdate: new Date(),
              subscriptionStatus: { ...prev.subscriptionStatus, metrics: true }
            }

            // Update aggregated metrics
            updateAggregatedMetrics(prev.traces, prev.agents, newMetrics)

            return updated
          })
        })
        .subscribe()

      channels.push(metricsChannel)
    }

    // Sessions subscription
    if (enableSessions) {
      const sessionsChannel = supabase
        .channel('sessions-global')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'swarm_sessions'
        }, (payload) => {
          setData(prev => {
            let newSessions = [...prev.sessions]

            if (payload.eventType === 'INSERT') {
              newSessions = [payload.new as SwarmSession, ...newSessions.slice(0, 19)]
            } else if (payload.eventType === 'UPDATE') {
              const index = newSessions.findIndex(s => s.id === payload.new.id)
              if (index >= 0) {
                newSessions[index] = payload.new as SwarmSession
              }
            }

            return {
              ...prev,
              sessions: newSessions,
              lastUpdate: new Date(),
              subscriptionStatus: { ...prev.subscriptionStatus, sessions: true }
            }
          })
        })
        .subscribe()

      channels.push(sessionsChannel)
    }

    channelsRef.current = channels

    // Mark as connected once subscriptions are set up
    setData(prev => ({ ...prev, isConnected: true }))

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel)
      })
      channelsRef.current = []
      setData(prev => ({ 
        ...prev, 
        isConnected: false,
        subscriptionStatus: {
          traces: false,
          agents: false,
          sessions: false,
          metrics: false
        }
      }))
    }
  }, [sessionId, swarmId, enableTraces, enableAgents, enableMetrics, enableSessions, maxItems, updateAggregatedMetrics])

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchInitialData()
      }, refreshInterval)

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    }
  }, [autoRefresh, refreshInterval, fetchInitialData])

  // Initialize data and subscriptions
  useEffect(() => {
    fetchInitialData()
    const cleanup = setupSubscriptions()

    return cleanup
  }, [fetchInitialData, setupSubscriptions])

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // Add new trace
  const addTrace = useCallback(async (trace: Omit<SwarmTrace, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const newTrace = await SwarmDatabase.insertTrace(trace)
      return newTrace
    } catch (error) {
      console.error('Error adding trace:', error)
      throw error
    }
  }, [])

  // Update agent status
  const updateAgentStatus = useCallback(async (agentId: string, status: SwarmAgent['status'], currentTask?: string) => {
    try {
      const updates: Partial<SwarmAgent> = { status }
      if (currentTask !== undefined) {
        updates.current_task = currentTask
      }
      
      const updatedAgent = await SwarmDatabase.updateAgent(agentId, updates)
      return updatedAgent
    } catch (error) {
      console.error('Error updating agent status:', error)
      throw error
    }
  }, [])

  // Record metric
  const recordMetric = useCallback(async (metric: Omit<SwarmMetrics, 'id' | 'created_at'>) => {
    try {
      const newMetric = await SwarmDatabase.insertMetrics(metric)
      return newMetric
    } catch (error) {
      console.error('Error recording metric:', error)
      throw error
    }
  }, [])

  return {
    // Data
    traces: data.traces,
    agents: data.agents,
    sessions: data.sessions,
    metrics: data.metrics,
    aggregatedMetrics,

    // Status
    isConnected: data.isConnected,
    isLoading: data.isLoading,
    error: data.error,
    lastUpdate: data.lastUpdate,
    subscriptionStatus: data.subscriptionStatus,

    // Actions
    refresh,
    addTrace,
    updateAgentStatus,
    recordMetric
  }
}