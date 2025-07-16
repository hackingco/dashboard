/**
 * Enhanced Supabase Swarm Management Hook
 * Provides comprehensive swarm management functionality with Supabase integration
 */

import { useState, useEffect, useCallback } from 'react'
import { useRealtimeSwarm } from './use-realtime-swarm'
import { SwarmDatabase } from '@/lib/supabase'

interface SwarmConfig {
  id: string
  name: string
  description: string
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star'
  maxAgents: number
  autoScaling: boolean
  loadBalancing: string
  status: 'active' | 'idle' | 'stopped' | 'error'
}

interface UseSupabaseSwarmOptions {
  swarmId?: string
  sessionId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useSupabaseSwarm(options: UseSupabaseSwarmOptions = {}) {
  const {
    swarmId = 'swarm_observability',
    sessionId,
    autoRefresh = true,
    refreshInterval = 5000
  } = options

  const [swarmConfigs, setSwarmConfigs] = useState<SwarmConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Use the real-time swarm hook for live data
  const {
    traces,
    agents,
    sessions,
    metrics,
    aggregatedMetrics,
    isConnected,
    refresh: refreshRealtime,
    addTrace,
    updateAgentStatus,
    recordMetric
  } = useRealtimeSwarm({
    sessionId,
    swarmId,
    enableTraces: true,
    enableAgents: true,
    enableMetrics: true,
    enableSessions: true,
    autoRefresh,
    refreshInterval
  })

  // Create a new swarm session
  const createSwarmSession = useCallback(async (config: {
    name: string
    description?: string
    agentCount: number
  }) => {
    try {
      const sessionData = {
        id: `session_${Date.now()}`,
        session_name: config.name,
        description: config.description || '',
        total_traces: 0,
        active_traces: 0,
        total_agents: config.agentCount,
        active_agents: 0,
        start_time: new Date().toISOString(),
        status: 'active' as const
      }

      const newSession = await SwarmDatabase.createSession(sessionData)
      return newSession
    } catch (error) {
      console.error('Error creating swarm session:', error)
      throw error
    }
  }, [])

  // Create a new agent
  const createAgent = useCallback(async (agentData: {
    name: string
    type: string
    swarmId: string
    metadata?: any
  }) => {
    try {
      const agent = {
        name: agentData.name,
        type: agentData.type,
        status: 'idle' as const,
        current_task: null,
        tasks_completed: 0,
        average_response_time: 0,
        memory_usage: 0,
        cpu_usage: 0,
        last_activity: new Date().toISOString(),
        swarm_id: agentData.swarmId,
        metadata: agentData.metadata || {}
      }

      const newAgent = await SwarmDatabase.insertAgent(agent)
      return newAgent
    } catch (error) {
      console.error('Error creating agent:', error)
      throw error
    }
  }, [])

  // Update agent performance metrics
  const updateAgentMetrics = useCallback(async (agentId: string, metrics: {
    tasks_completed?: number
    average_response_time?: number
    memory_usage?: number
    cpu_usage?: number
  }) => {
    try {
      const updates = {
        ...metrics,
        last_activity: new Date().toISOString()
      }

      const updatedAgent = await SwarmDatabase.updateAgent(agentId, updates)
      return updatedAgent
    } catch (error) {
      console.error('Error updating agent metrics:', error)
      throw error
    }
  }, [])

  // Create a task trace
  const createTaskTrace = useCallback(async (traceData: {
    sessionId: string
    name: string
    data: any
    status?: 'pending' | 'running' | 'success' | 'error'
    duration?: number
  }) => {
    try {
      const trace = {
        session_id: traceData.sessionId,
        trace_name: traceData.name,
        trace_data: traceData.data,
        status: traceData.status || 'pending',
        duration_ms: traceData.duration || 0,
        metadata: {
          timestamp: new Date().toISOString(),
          swarm_id: swarmId
        }
      }

      const newTrace = await addTrace(trace)
      return newTrace
    } catch (error) {
      console.error('Error creating task trace:', error)
      throw error
    }
  }, [addTrace, swarmId])

  // Record performance metric
  const recordPerformanceMetric = useCallback(async (metricData: {
    sessionId: string
    type: string
    value: number
    data?: any
  }) => {
    try {
      const metric = {
        session_id: metricData.sessionId,
        metric_type: metricData.type,
        metric_value: metricData.value,
        metric_data: metricData.data || {},
        timestamp: new Date().toISOString()
      }

      const newMetric = await recordMetric(metric)
      return newMetric
    } catch (error) {
      console.error('Error recording performance metric:', error)
      throw error
    }
  }, [recordMetric])

  // Calculate swarm health score
  const calculateSwarmHealth = useCallback(() => {
    if (!aggregatedMetrics) return 0

    const factors = [
      // Agent availability (30%)
      (aggregatedMetrics.activeAgents / Math.max(aggregatedMetrics.totalAgents, 1)) * 30,
      
      // Error rate (25%) - inverse relationship
      Math.max(0, (100 - aggregatedMetrics.errorRate * 5)) * 0.25,
      
      // Response time (25%) - inverse relationship  
      Math.max(0, (100 - Math.min(100, aggregatedMetrics.averageResponseTime / 50))) * 0.25,
      
      // Throughput (20%)
      Math.min(100, aggregatedMetrics.throughput * 2) * 0.20
    ]

    return Math.round(factors.reduce((sum, factor) => sum + factor, 0))
  }, [aggregatedMetrics])

  // Start/stop swarm operations
  const controlSwarm = useCallback(async (action: 'start' | 'stop' | 'pause', swarmId: string) => {
    try {
      // Update all agents in the swarm
      const swarmAgents = agents.filter(agent => agent.swarm_id === swarmId)
      
      const newStatus = action === 'start' ? 'active' : action === 'stop' ? 'offline' : 'idle'
      
      await Promise.all(
        swarmAgents.map(agent => 
          updateAgentStatus(agent.id, newStatus)
        )
      )

      // Record control action as metric
      if (sessionId) {
        await recordPerformanceMetric({
          sessionId,
          type: 'swarm_control',
          value: 1,
          data: { action, swarmId, timestamp: new Date().toISOString() }
        })
      }

      return { success: true, action, affectedAgents: swarmAgents.length }
    } catch (error) {
      console.error(`Error ${action} swarm:`, error)
      throw error
    }
  }, [agents, updateAgentStatus, recordPerformanceMetric, sessionId])

  // Scale swarm (add/remove agents)
  const scaleSwarm = useCallback(async (swarmId: string, targetAgentCount: number) => {
    try {
      const currentAgents = agents.filter(agent => agent.swarm_id === swarmId)
      const currentCount = currentAgents.length
      
      if (targetAgentCount > currentCount) {
        // Scale up - create new agents
        const agentsToCreate = targetAgentCount - currentCount
        const newAgents = []
        
        for (let i = 0; i < agentsToCreate; i++) {
          const agent = await createAgent({
            name: `agent-${swarmId}-${Date.now()}-${i}`,
            type: 'worker',
            swarmId,
            metadata: { autoScaled: true, created: new Date().toISOString() }
          })
          newAgents.push(agent)
        }
        
        return { success: true, action: 'scale_up', newAgents }
      } else if (targetAgentCount < currentCount) {
        // Scale down - this would need to be implemented based on your agent removal strategy
        console.log('Scale down not implemented - would remove agents')
        return { success: true, action: 'scale_down', message: 'Scale down not implemented' }
      }
      
      return { success: true, action: 'no_change', message: 'Target count matches current count' }
    } catch (error) {
      console.error('Error scaling swarm:', error)
      throw error
    }
  }, [agents, createAgent])

  // Auto-refresh swarm configurations
  useEffect(() => {
    const loadSwarmConfigs = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // In a real implementation, this would fetch from your swarm management API
        const mockConfigs: SwarmConfig[] = [
          {
            id: 'swarm_observability',
            name: 'Observability Swarm',
            description: 'Monitors and analyzes system performance',
            topology: 'mesh',
            maxAgents: 8,
            autoScaling: true,
            loadBalancing: 'round-robin',
            status: 'active'
          },
          {
            id: 'swarm_ml_training',
            name: 'ML Training Swarm',
            description: 'Handles machine learning model training',
            topology: 'hierarchical',
            maxAgents: 12,
            autoScaling: true,
            loadBalancing: 'least-connections',
            status: 'active'
          }
        ]
        
        setSwarmConfigs(mockConfigs)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load swarm configs')
      } finally {
        setIsLoading(false)
      }
    }

    loadSwarmConfigs()
  }, [])

  const swarmHealth = calculateSwarmHealth()

  return {
    // Data
    traces,
    agents,
    sessions,
    metrics,
    aggregatedMetrics,
    swarmConfigs,
    swarmHealth,
    
    // Status
    isConnected,
    isLoading,
    error,
    
    // Actions
    createSwarmSession,
    createAgent,
    updateAgentMetrics,
    createTaskTrace,
    recordPerformanceMetric,
    controlSwarm,
    scaleSwarm,
    refreshRealtime,
    
    // Agent management
    updateAgentStatus
  }
}