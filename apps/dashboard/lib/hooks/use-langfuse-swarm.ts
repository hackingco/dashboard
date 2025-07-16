/**
 * React hook for integrating Langfuse with swarm operations
 * Provides real-time tracing and monitoring for swarm activities
 */

import { useEffect, useRef, useCallback } from 'react'
import { createSwarmLogger, SwarmLangfuseLogger } from '@/lib/swarm-langfuse-logger'
import { getLangfuseServer } from '@/lib/langfuse-server'

interface UseLangfuseSwarmOptions {
  swarmId: string
  sessionId?: string
  enabled?: boolean
  onError?: (error: Error) => void
  onMetricsUpdate?: (metrics: any) => void
}

interface LangfuseSwarmHook {
  logger: SwarmLangfuseLogger | null
  logAgentSpawn: (agentId: string, agentName: string, type: string, capabilities: string[]) => Promise<void>
  logAgentTask: (agentId: string, task: string, priority: string) => Promise<void>
  logAgentComplete: (agentId: string, result: any, duration: number) => Promise<void>
  logSwarmCoordination: (event: string, participants: string[], data: any) => Promise<void>
  logError: (agentId: string | null, error: Error, context: any) => Promise<void>
  isInitialized: boolean
}

export function useLangfuseSwarm({
  swarmId,
  sessionId,
  enabled = true,
  onError,
  onMetricsUpdate,
}: UseLangfuseSwarmOptions): LangfuseSwarmHook {
  const loggerRef = useRef<SwarmLangfuseLogger | null>(null)
  const isInitializedRef = useRef(false)

  // Initialize logger
  useEffect(() => {
    if (!enabled || !swarmId) return

    try {
      // Initialize Langfuse server if needed
      getLangfuseServer()

      // Create swarm logger
      const logger = createSwarmLogger(swarmId, sessionId)
      loggerRef.current = logger
      isInitializedRef.current = true

      // Set up event listeners
      if (onMetricsUpdate) {
        logger.on('metrics_update', onMetricsUpdate)
      }

      logger.on('error_occurred', (data) => {
        if (onError) {
          onError(new Error(data.error))
        }
      })

      // Log swarm initialization
      logger.logSwarmInit('mesh', 5, 'balanced').catch(console.error)

      return () => {
        logger.close().catch(console.error)
        loggerRef.current = null
        isInitializedRef.current = false
      }
    } catch (error) {
      console.error('Failed to initialize Langfuse swarm logger:', error)
      if (onError && error instanceof Error) {
        onError(error)
      }
    }
  }, [swarmId, sessionId, enabled, onError, onMetricsUpdate])

  // Wrapped logging functions
  const logAgentSpawn = useCallback(
    async (agentId: string, agentName: string, type: string, capabilities: string[]) => {
      if (!loggerRef.current) return
      try {
        await loggerRef.current.logAgentSpawn(agentId, agentName, type, capabilities)
      } catch (error) {
        console.error('Failed to log agent spawn:', error)
        if (onError && error instanceof Error) {
          onError(error)
        }
      }
    },
    [onError]
  )

  const logAgentTask = useCallback(
    async (agentId: string, task: string, priority: string) => {
      if (!loggerRef.current) return
      try {
        await loggerRef.current.logAgentTask(agentId, task, priority)
      } catch (error) {
        console.error('Failed to log agent task:', error)
        if (onError && error instanceof Error) {
          onError(error)
        }
      }
    },
    [onError]
  )

  const logAgentComplete = useCallback(
    async (agentId: string, result: any, duration: number) => {
      if (!loggerRef.current) return
      try {
        await loggerRef.current.logAgentComplete(agentId, result, duration)
      } catch (error) {
        console.error('Failed to log agent completion:', error)
        if (onError && error instanceof Error) {
          onError(error)
        }
      }
    },
    [onError]
  )

  const logSwarmCoordination = useCallback(
    async (event: string, participants: string[], data: any) => {
      if (!loggerRef.current) return
      try {
        await loggerRef.current.logSwarmCoordination(event, participants, data)
      } catch (error) {
        console.error('Failed to log swarm coordination:', error)
        if (onError && error instanceof Error) {
          onError(error)
        }
      }
    },
    [onError]
  )

  const logError = useCallback(
    async (agentId: string | null, error: Error, context: any) => {
      if (!loggerRef.current) return
      try {
        await loggerRef.current.logError(agentId, error, context)
      } catch (errorLoggingError) {
        console.error('Failed to log error:', errorLoggingError)
        if (onError && errorLoggingError instanceof Error) {
          onError(errorLoggingError)
        }
      }
    },
    [onError]
  )

  return {
    logger: loggerRef.current,
    logAgentSpawn,
    logAgentTask,
    logAgentComplete,
    logSwarmCoordination,
    logError,
    isInitialized: isInitializedRef.current,
  }
}

// Hook for automatic swarm activity logging
export function useAutoSwarmLogging(swarmId: string, sessionId?: string) {
  const { logger, isInitialized } = useLangfuseSwarm({
    swarmId,
    sessionId,
    enabled: true,
  })

  useEffect(() => {
    if (!isInitialized || !logger) return

    // Set up automatic logging for common patterns
    const logActivity = async () => {
      // This would be replaced with actual swarm activity detection
      // For now, it's a placeholder for the pattern
      console.log('Auto-logging swarm activities for:', swarmId)
    }

    const interval = setInterval(logActivity, 10000)

    return () => {
      clearInterval(interval)
    }
  }, [isInitialized, logger, swarmId])

  return { logger, isInitialized }
}

// Hook for swarm performance monitoring
export function useSwarmPerformanceMonitoring(
  swarmId: string,
  thresholds: {
    responseTime?: number
    errorRate?: number
    throughput?: number
  } = {}
) {
  const [performanceWarnings, setPerformanceWarnings] = useState<string[]>([])

  const handleMetricsUpdate = useCallback(
    (data: any) => {
      const warnings: string[] = []
      const metrics = data.metrics

      if (thresholds.responseTime && metrics.averageResponseTime > thresholds.responseTime) {
        warnings.push(`Response time (${metrics.averageResponseTime}ms) exceeds threshold (${thresholds.responseTime}ms)`)
      }

      if (thresholds.errorRate && metrics.errorRate > thresholds.errorRate) {
        warnings.push(`Error rate (${metrics.errorRate}%) exceeds threshold (${thresholds.errorRate}%)`)
      }

      if (thresholds.throughput && metrics.throughput < thresholds.throughput) {
        warnings.push(`Throughput (${metrics.throughput} tasks/min) below threshold (${thresholds.throughput} tasks/min)`)
      }

      setPerformanceWarnings(warnings)
    },
    [thresholds]
  )

  const { logger, isInitialized } = useLangfuseSwarm({
    swarmId,
    enabled: true,
    onMetricsUpdate: handleMetricsUpdate,
  })

  return {
    logger,
    isInitialized,
    performanceWarnings,
  }
}

// Add missing import
import { useState } from 'react'