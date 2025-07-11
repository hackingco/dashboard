'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Machine, MachinesAPI } from '@/lib/machines-api'

interface MachineMonitoringProps {
  appName: string
  machine: Machine
  apiToken: string
}

interface ProcessStat {
  pid: number
  command: string
  cpu_time: string
  directory: string
  rss: number
  rtime: string
  stime: string
  vsz: number
}

interface MachineEvent {
  id: string
  type: string
  status: string
  timestamp: string
  request?: Record<string, any>
}

export function MachineMonitoring({ appName, machine, apiToken }: MachineMonitoringProps) {
  const [processes, setProcesses] = useState<ProcessStat[]>([])
  const [events, setEvents] = useState<MachineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [machinesApi] = useState(() => new MachinesAPI({ apiToken }))
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadData()
  }, [machine.id])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadProcesses, refreshInterval)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval])

  const loadData = async () => {
    await Promise.all([loadProcesses(), loadEvents()])
  }

  const loadProcesses = async () => {
    if (machine.state !== 'started') {
      setProcesses([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const processList = await machinesApi.listMachineProcesses(appName, machine.id)
      setProcesses(processList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load processes')
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const eventList = await machinesApi.getMachineEvents(appName, machine.id)
      setEvents(eventList.slice(0, 50)) // Show last 50 events
    } catch (err) {
      // Events might not be available for all machines
      console.warn('Failed to load events:', err)
    }
  }

  const formatMemory = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatTime = (timeStr: string) => {
    try {
      return new Date(timeStr).toLocaleString()
    } catch {
      return timeStr
    }
  }

  const getEventColor = (type: string, status: string) => {
    if (status === 'error') return 'text-red-600'
    if (type === 'start') return 'text-green-600'
    if (type === 'stop') return 'text-red-600'
    if (type === 'restart') return 'text-blue-600'
    return 'text-gray-600'
  }

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      start: '▶️',
      stop: '⏹️',
      restart: '🔄',
      create: '✨',
      destroy: '💥',
      update: '📝',
      scale: '📊',
    }
    return icons[type] || '📋'
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">
            Real-time Monitoring
          </h3>
          <p className="text-sm text-muted-foreground">
            Monitor machine processes and events in real-time
          </p>
        </div>
        
        <div className="p-6 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="autoRefresh" className="text-sm font-medium">
                  Auto-refresh
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm">Interval:</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  disabled={!autoRefresh}
                  className="h-8 rounded border border-input bg-background px-2 text-sm"
                >
                  <option value={1000}>1s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={30000}>30s</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processes */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h4 className="text-lg font-semibold">Running Processes ({processes.length})</h4>
            {machine.state !== 'started' && (
              <p className="text-sm text-muted-foreground">
                Machine must be started to show processes
              </p>
            )}
          </div>
          
          <div className="p-6 pt-0">
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 mb-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm">Loading processes...</span>
              </div>
            )}

            {machine.state === 'started' && processes.length === 0 && !loading && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No processes found</p>
              </div>
            )}

            {processes.length > 0 && (
              <div className="space-y-3">
                {processes.map((process) => (
                  <div key={process.pid} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h5 className="font-medium text-sm truncate">
                          {process.command}
                        </h5>
                        <p className="text-xs text-muted-foreground">
                          PID: {process.pid} • {process.directory}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{formatMemory(process.rss)}</p>
                        <p className="text-xs text-muted-foreground">RSS</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">VSZ:</span>
                        <span className="ml-1">{formatMemory(process.vsz)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">RTIME:</span>
                        <span className="ml-1">{process.rtime}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">STIME:</span>
                        <span className="ml-1">{process.stime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Events */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h4 className="text-lg font-semibold">Recent Events ({events.length})</h4>
            <p className="text-sm text-muted-foreground">
              Machine lifecycle and operational events
            </p>
          </div>
          
          <div className="p-6 pt-0">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No events found</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex items-start space-x-3">
                      <span className="text-sm">{getEventIcon(event.type)}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h5 className={`font-medium text-sm ${getEventColor(event.type, event.status)}`}>
                            {event.type}: {event.status}
                          </h5>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                        
                        {event.request && Object.keys(event.request).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                              View details
                            </summary>
                            <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(event.request, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resource Summary */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h4 className="text-lg font-semibold">Resource Summary</h4>
        </div>
        
        <div className="p-6 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {processes.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Processes</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {processes.reduce((sum, p) => sum + p.rss, 0) > 0 
                  ? formatMemory(processes.reduce((sum, p) => sum + p.rss, 0))
                  : '0 B'
                }
              </div>
              <div className="text-sm text-muted-foreground">Total RSS</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {machine.config.guest?.cpus || 1}
              </div>
              <div className="text-sm text-muted-foreground">Allocated CPUs</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">
                {machine.config.guest?.memory_mb || 256} MB
              </div>
              <div className="text-sm text-muted-foreground">Allocated Memory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}