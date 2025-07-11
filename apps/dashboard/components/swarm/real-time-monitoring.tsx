'use client'

import React, { useState, useEffect } from 'react'
import { Activity, Zap, Cpu, HardDrive, Wifi, AlertTriangle, TrendingUp, TrendingDown, Eye, Bell, Pause, Play, Download, RefreshCw, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface MetricDataPoint {
  timestamp: string
  value: number
  label?: string
}

interface AgentMetrics {
  id: string
  name: string
  status: 'online' | 'offline' | 'error' | 'warning'
  cpu: MetricDataPoint[]
  memory: MetricDataPoint[]
  network: MetricDataPoint[]
  disk: MetricDataPoint[]
  tasks: {
    active: number
    completed: number
    failed: number
    queued: number
  }
  uptime: number
  lastSeen: string
  region: string
  version: string
  alerts: Alert[]
}

interface SwarmMetrics {
  totalAgents: number
  activeAgents: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  avgResponseTime: number
  throughput: number
  errorRate: number
  loadDistribution: Record<string, number>
  systemHealth: number
}

interface Alert {
  id: string
  level: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: string
  agentId?: string
  acknowledged: boolean
  resolved: boolean
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  message: string
  metadata?: Record<string, any>
}

interface MonitoringData {
  swarmId: string
  swarmName: string
  agents: AgentMetrics[]
  swarmMetrics: SwarmMetrics
  alerts: Alert[]
  logs: LogEntry[]
  isConnected: boolean
  lastUpdate: string
}

interface RealTimeMonitoringProps {
  swarm: MonitoringData
  onPauseMonitoring: () => void
  onResumeMonitoring: () => void
  onAcknowledgeAlert: (alertId: string) => void
  onExportLogs: (filters?: any) => void
  onUpdateAlertThresholds: (thresholds: any) => void
  updateInterval?: number
}

export const RealTimeMonitoring: React.FC<RealTimeMonitoringProps> = ({
  swarm,
  onPauseMonitoring,
  onResumeMonitoring,
  onAcknowledgeAlert,
  onExportLogs,
  onUpdateAlertThresholds,
  updateInterval = 5000
}) => {
  const [isPaused, setIsPaused] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h')
  const [logFilter, setLogFilter] = useState('all')
  const [alertFilter, setAlertFilter] = useState('all')
  const [selectedAgent, setSelectedAgent] = useState<string>('all')

  useEffect(() => {
    if (!isPaused && swarm.isConnected) {
      const interval = setInterval(() => {
        // In a real implementation, this would trigger data refresh
      }, updateInterval)
      return () => clearInterval(interval)
    }
  }, [isPaused, swarm.isConnected, updateInterval])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-50'
      case 'offline': return 'text-gray-600 bg-gray-50'
      case 'error': return 'text-red-600 bg-red-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200'
      case 'error': return 'text-red-600 bg-red-50 border-red-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600'
      case 'warn': return 'text-yellow-600'
      case 'info': return 'text-blue-600'
      case 'debug': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const filteredAlerts = swarm.alerts.filter(alert => {
    if (alertFilter === 'all') return true
    if (alertFilter === 'unacknowledged') return !alert.acknowledged
    if (alertFilter === 'unresolved') return !alert.resolved
    return alert.level === alertFilter
  })

  const filteredLogs = swarm.logs.filter(log => {
    if (logFilter === 'all') return true
    return log.level === logFilter
  }).filter(log => {
    if (selectedAgent === 'all') return true
    return log.source === selectedAgent
  })

  const getLatestMetricValue = (metrics: MetricDataPoint[]) => {
    return metrics.length > 0 ? metrics[metrics.length - 1].value : 0
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  return (
    <div className="space-y-6">
      {/* Connection Status & Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Real-Time Monitoring - {swarm.swarmName}
              <div className={`ml-3 w-2 h-2 rounded-full ${swarm.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5m">5m</SelectItem>
                  <SelectItem value="15m">15m</SelectItem>
                  <SelectItem value="1h">1h</SelectItem>
                  <SelectItem value="6h">6h</SelectItem>
                  <SelectItem value="24h">24h</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isPaused) {
                    onResumeMonitoring()
                    setIsPaused(false)
                  } else {
                    onPauseMonitoring()
                    setIsPaused(true)
                  }
                }}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onExportLogs()}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{swarm.swarmMetrics.activeAgents}</div>
              <div className="text-sm text-gray-600">Active Agents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{swarm.swarmMetrics.throughput}</div>
              <div className="text-sm text-gray-600">Tasks/min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{swarm.swarmMetrics.avgResponseTime}ms</div>
              <div className="text-sm text-gray-600">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{swarm.swarmMetrics.systemHealth}%</div>
              <div className="text-sm text-gray-600">System Health</div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500 text-center">
            Last updated: {new Date(swarm.lastUpdate).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agents" className="flex items-center">
            <Cpu className="w-4 h-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center">
            <Bell className="w-4 h-4 mr-2" />
            Alerts ({filteredAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center">
            <Eye className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {swarm.agents.map(agent => (
              <Card key={agent.id} className="transition-all duration-200 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1 rounded ${getStatusColor(agent.status)}`}>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-gray-600">{agent.region}</div>
                      </div>
                    </div>
                    <Badge variant="outline">{agent.version}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="font-bold text-blue-600">{agent.tasks.active}</div>
                      <div className="text-blue-600">Active</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="font-bold text-green-600">{agent.tasks.completed}</div>
                      <div className="text-green-600">Completed</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>CPU</span>
                        <span>{getLatestMetricValue(agent.cpu).toFixed(1)}%</span>
                      </div>
                      <Progress value={getLatestMetricValue(agent.cpu)} className="h-1.5" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Memory</span>
                        <span>{getLatestMetricValue(agent.memory).toFixed(1)}%</span>
                      </div>
                      <Progress value={getLatestMetricValue(agent.memory)} className="h-1.5" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Network</span>
                        <span>{getLatestMetricValue(agent.network).toFixed(1)} MB/s</span>
                      </div>
                      <Progress value={Math.min(getLatestMetricValue(agent.network) * 10, 100)} className="h-1.5" />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 border-t pt-2">
                    <div className="flex justify-between">
                      <span>Uptime</span>
                      <span>{formatUptime(agent.uptime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last seen</span>
                      <span>{new Date(agent.lastSeen).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {agent.alerts.length > 0 && (
                    <div className="text-xs">
                      <Badge variant="destructive" className="w-full justify-center">
                        {agent.alerts.length} Active Alert{agent.alerts.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>System Alerts</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={alertFilter} onValueChange={setAlertFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Alerts</SelectItem>
                      <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
                      <SelectItem value="unresolved">Unresolved</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${getAlertColor(alert.level)} ${
                      alert.acknowledged ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 mt-0.5" />
                        <div>
                          <div className="font-medium">{alert.message}</div>
                          <div className="text-sm mt-1">
                            {alert.agentId && (
                              <span className="mr-3">
                                Agent: {swarm.agents.find(a => a.id === alert.agentId)?.name || alert.agentId}
                              </span>
                            )}
                            <span>{new Date(alert.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getAlertColor(alert.level)}>{alert.level}</Badge>
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAcknowledgeAlert(alert.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredAlerts.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No alerts match the current filter.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>System Logs</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      {swarm.agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={logFilter} onValueChange={setLogFilter}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warn">Warn</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLogs.map(log => (
                  <div key={log.id} className="p-2 text-sm font-mono bg-gray-50 rounded border-l-4 border-gray-300">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`ml-3 font-medium ${getLogColor(log.level)}`}>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="ml-3 text-gray-600">
                          {log.source}:
                        </span>
                        <span className="ml-2">
                          {log.message}
                        </span>
                      </div>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-1 text-xs text-gray-500 pl-4">
                        {JSON.stringify(log.metadata, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
                
                {filteredLogs.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No logs match the current filters.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Average Response Time</span>
                      <span className="font-medium">{swarm.swarmMetrics.avgResponseTime}ms</span>
                    </div>
                    <Progress value={Math.min(swarm.swarmMetrics.avgResponseTime / 10, 100)} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Throughput</span>
                      <span className="font-medium">{swarm.swarmMetrics.throughput} tasks/min</span>
                    </div>
                    <Progress value={Math.min(swarm.swarmMetrics.throughput / 2, 100)} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Error Rate</span>
                      <span className="font-medium">{swarm.swarmMetrics.errorRate.toFixed(2)}%</span>
                    </div>
                    <Progress value={swarm.swarmMetrics.errorRate} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>System Health</span>
                      <span className="font-medium">{swarm.swarmMetrics.systemHealth}%</span>
                    </div>
                    <Progress value={swarm.swarmMetrics.systemHealth} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Task Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {swarm.swarmMetrics.totalTasks}
                    </div>
                    <div className="text-sm text-blue-600">Total Tasks</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {swarm.swarmMetrics.completedTasks}
                    </div>
                    <div className="text-sm text-green-600">Completed</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {swarm.swarmMetrics.failedTasks}
                    </div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {((swarm.swarmMetrics.completedTasks / swarm.swarmMetrics.totalTasks) * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-purple-600">Success Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RealTimeMonitoring