'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter } from 'recharts'
import {
  Users,
  Activity,
  Cpu,
  Memory,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Pause,
  Play,
  Square,
  RefreshCw,
  Filter,
  Download,
  Settings,
  Zap,
  Target,
  Shield,
  Network
} from 'lucide-react'

interface AgentPerformanceDashboardProps {
  agents: any[]
  metrics: any[]
  swarmId: string
  onUpdateAgent: (agentId: string, status: string, currentTask?: string) => Promise<void>
}

interface AgentMetrics {
  id: string
  name: string
  type: string
  status: 'active' | 'idle' | 'error' | 'offline'
  current_task?: string
  tasks_completed: number
  average_response_time: number
  memory_usage: number
  cpu_usage: number
  last_activity: string
  swarm_id: string
  efficiency: number
  loadFactor: number
  uptime: number
}

export const AgentPerformanceDashboard: React.FC<AgentPerformanceDashboardProps> = ({
  agents,
  metrics,
  swarmId,
  onUpdateAgent
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<string>('efficiency')
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  // Calculate enhanced agent metrics
  const enhancedAgents: AgentMetrics[] = useMemo(() => {
    return agents.map(agent => {
      // Calculate efficiency based on tasks completed vs response time
      const efficiency = agent.tasks_completed > 0 
        ? Math.min(100, (agent.tasks_completed * 1000) / Math.max(agent.average_response_time, 1))
        : 0

      // Calculate load factor based on CPU and memory usage
      const loadFactor = (agent.cpu_usage + agent.memory_usage) / 2

      // Calculate uptime based on last activity (mock calculation)
      const lastActivity = new Date(agent.last_activity).getTime()
      const now = Date.now()
      const hoursAgo = (now - lastActivity) / (1000 * 60 * 60)
      const uptime = Math.max(0, Math.min(100, 100 - (hoursAgo * 5)))

      return {
        ...agent,
        efficiency: Number(efficiency.toFixed(1)),
        loadFactor: Number(loadFactor.toFixed(1)),
        uptime: Number(uptime.toFixed(1))
      }
    })
  }, [agents])

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let filtered = enhancedAgents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           agent.type.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || agent.status === filterStatus
      const matchesType = filterType === 'all' || agent.type === filterType
      
      return matchesSearch && matchesStatus && matchesType
    })

    // Sort agents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'efficiency':
          return b.efficiency - a.efficiency
        case 'tasks':
          return b.tasks_completed - a.tasks_completed
        case 'response_time':
          return a.average_response_time - b.average_response_time
        case 'load':
          return a.loadFactor - b.loadFactor
        case 'uptime':
          return b.uptime - a.uptime
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return filtered
  }, [enhancedAgents, searchTerm, filterStatus, filterType, sortBy])

  // Generate performance history data
  const performanceHistory = useMemo(() => {
    const now = Date.now()
    return Array.from({ length: 20 }, (_, i) => {
      const time = new Date(now - (19 - i) * 5 * 60 * 1000)
      
      return {
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: time.getTime(),
        averageResponseTime: enhancedAgents.length > 0 
          ? enhancedAgents.reduce((sum, a) => sum + a.average_response_time, 0) / enhancedAgents.length
          : 0,
        averageEfficiency: enhancedAgents.length > 0
          ? enhancedAgents.reduce((sum, a) => sum + a.efficiency, 0) / enhancedAgents.length
          : 0,
        activeAgents: enhancedAgents.filter(a => a.status === 'active').length,
        totalTasks: enhancedAgents.reduce((sum, a) => sum + a.tasks_completed, 0),
        averageLoad: enhancedAgents.length > 0
          ? enhancedAgents.reduce((sum, a) => sum + a.loadFactor, 0) / enhancedAgents.length
          : 0
      }
    })
  }, [enhancedAgents])

  // Agent type distribution
  const typeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {}
    enhancedAgents.forEach(agent => {
      distribution[agent.type] = (distribution[agent.type] || 0) + 1
    })
    return Object.entries(distribution).map(([type, count]) => ({ type, count }))
  }, [enhancedAgents])

  // Performance scatter data
  const scatterData = useMemo(() => {
    return enhancedAgents.map(agent => ({
      name: agent.name,
      efficiency: agent.efficiency,
      responseTime: agent.average_response_time,
      tasks: agent.tasks_completed,
      status: agent.status
    }))
  }, [enhancedAgents])

  const handleAgentAction = async (agentId: string, action: 'start' | 'pause' | 'stop') => {
    setIsUpdating(agentId)
    try {
      const status = action === 'start' ? 'active' : action === 'pause' ? 'idle' : 'offline'
      await onUpdateAgent(agentId, status)
    } catch (error) {
      console.error(`Error ${action} agent:`, error)
    } finally {
      setIsUpdating(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'idle':
        return <Pause className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'offline':
        return <Square className="w-4 h-4 text-gray-500" />
      default:
        return <Activity className="w-4 h-4 text-blue-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200'
      case 'idle': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'error': return 'text-red-600 bg-red-50 border-red-200'
      case 'offline': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-600'
    if (efficiency >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent Performance Dashboard</h2>
          <p className="text-gray-600">Monitor and manage individual agent performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Performance Overview Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={performanceHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="averageEfficiency" stroke="#10B981" name="Avg Efficiency" />
                <Line type="monotone" dataKey="activeAgents" stroke="#3B82F6" name="Active Agents" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Efficiency vs Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart data={scatterData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="responseTime" name="Response Time (ms)" />
                <YAxis dataKey="efficiency" name="Efficiency" />
                <Tooltip />
                <Scatter dataKey="efficiency" fill="#3B82F6" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Array.from(new Set(enhancedAgents.map(a => a.type))).map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efficiency">Efficiency</SelectItem>
                <SelectItem value="tasks">Tasks Completed</SelectItem>
                <SelectItem value="response_time">Response Time</SelectItem>
                <SelectItem value="load">Load Factor</SelectItem>
                <SelectItem value="uptime">Uptime</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-sm text-gray-600">
              {filteredAgents.length} of {enhancedAgents.length} agents
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredAgents.map(agent => (
          <Card 
            key={agent.id} 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedAgent === agent.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(agent.status)}
                  <CardTitle className="text-sm truncate">{agent.name}</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">
                  {agent.type}
                </Badge>
              </div>
              <Badge className={`text-xs ${getStatusColor(agent.status)}`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </Badge>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Tasks:</span>
                  <span className="ml-1 font-medium">{agent.tasks_completed}</span>
                </div>
                <div>
                  <span className="text-gray-600">Response:</span>
                  <span className="ml-1 font-medium">{agent.average_response_time}ms</span>
                </div>
                <div>
                  <span className="text-gray-600">Efficiency:</span>
                  <span className={`ml-1 font-medium ${getEfficiencyColor(agent.efficiency)}`}>
                    {agent.efficiency}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Uptime:</span>
                  <span className="ml-1 font-medium">{agent.uptime}%</span>
                </div>
              </div>

              {/* Resource Usage */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">CPU</span>
                  <span>{agent.cpu_usage}%</span>
                </div>
                <Progress value={agent.cpu_usage} className="h-1" />
                
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Memory</span>
                  <span>{agent.memory_usage}%</span>
                </div>
                <Progress value={agent.memory_usage} className="h-1" />

                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Load Factor</span>
                  <span>{agent.loadFactor}%</span>
                </div>
                <Progress value={agent.loadFactor} className="h-1" />
              </div>

              {/* Current Task */}
              {agent.current_task && (
                <div className="text-xs">
                  <span className="text-gray-600">Current Task:</span>
                  <p className="font-medium truncate mt-1">{agent.current_task}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-2 border-t">
                <div className="flex space-x-1">
                  {agent.status !== 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAgentAction(agent.id, 'start')
                      }}
                      disabled={isUpdating === agent.id}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )}
                  {agent.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAgentAction(agent.id, 'pause')
                      }}
                      disabled={isUpdating === agent.id}
                    >
                      <Pause className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAgentAction(agent.id, 'stop')
                    }}
                    disabled={isUpdating === agent.id}
                  >
                    <Square className="w-3 h-3" />
                  </Button>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </div>

              {/* Last Activity */}
              <div className="text-xs text-gray-500">
                Last activity: {new Date(agent.last_activity).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Details Panel */}
      {selectedAgent && (
        <Card>
          <CardHeader>
            <CardTitle>
              Agent Details: {enhancedAgents.find(a => a.id === selectedAgent)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const agent = enhancedAgents.find(a => a.id === selectedAgent)
              if (!agent) return null

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Performance Chart */}
                  <div className="lg:col-span-2">
                    <h4 className="font-medium mb-2">Performance History</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={performanceHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Area 
                          type="monotone" 
                          dataKey="averageResponseTime" 
                          stroke="#3B82F6" 
                          fill="#3B82F6" 
                          fillOpacity={0.3}
                          name="Response Time (ms)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Agent Stats */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Statistics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Efficiency Score:</span>
                          <span className={getEfficiencyColor(agent.efficiency)}>
                            {agent.efficiency}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Load Factor:</span>
                          <span>{agent.loadFactor}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Uptime:</span>
                          <span>{agent.uptime}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tasks/Hour:</span>
                          <span>{Math.round(agent.tasks_completed / 24)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Resource Usage</h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>CPU Usage</span>
                            <span>{agent.cpu_usage}%</span>
                          </div>
                          <Progress value={agent.cpu_usage} />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Memory Usage</span>
                            <span>{agent.memory_usage}%</span>
                          </div>
                          <Progress value={agent.memory_usage} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}