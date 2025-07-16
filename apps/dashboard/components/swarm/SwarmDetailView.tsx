'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import {
  Activity,
  Users,
  Cpu,
  Memory,
  Network,
  HardDrive,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Edit,
  Save,
  RefreshCw,
  Download,
  Upload,
  Zap,
  Shield,
  Target
} from 'lucide-react'

interface SwarmDetailViewProps {
  swarmId: string
  swarm?: {
    id: string
    name: string
    status: string
    agentCount: number
    activeAgents: number
    tasksCompleted: number
    averageResponseTime: number
    errorRate: number
    uptime: number
    lastActivity: Date
    resources: {
      cpu: number
      memory: number
      storage: number
    }
    configuration: {
      topology: string
      scalingEnabled: boolean
      loadBalancing: string
    }
  }
  agents: any[]
  traces: any[]
  metrics: any[]
}

export const SwarmDetailView: React.FC<SwarmDetailViewProps> = ({
  swarmId,
  swarm,
  agents,
  traces,
  metrics
}) => {
  const [activeDetailTab, setActiveDetailTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editedConfig, setEditedConfig] = useState(swarm?.configuration || {})

  // Generate mock performance data for charts
  const [performanceData, setPerformanceData] = useState(() => {
    const now = Date.now()
    return Array.from({ length: 24 }, (_, i) => ({
      time: new Date(now - (23 - i) * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cpu: Math.random() * 40 + 30,
      memory: Math.random() * 30 + 50,
      activeAgents: Math.floor(Math.random() * 3) + (swarm?.activeAgents || 4),
      throughput: Math.random() * 50 + 20,
      responseTime: Math.random() * 500 + 800,
      errorRate: Math.random() * 2
    }))
  })

  const [resourceData, setResourceData] = useState(() => [
    { name: 'CPU', value: swarm?.resources.cpu || 45, color: '#3B82F6' },
    { name: 'Memory', value: swarm?.resources.memory || 62, color: '#10B981' },
    { name: 'Storage', value: swarm?.resources.storage || 23, color: '#F59E0B' },
    { name: 'Network', value: 34, color: '#8B5CF6' }
  ])

  const agentTypeDistribution = agents.reduce((acc, agent) => {
    acc[agent.type] = (acc[agent.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const agentStatusDistribution = agents.reduce((acc, agent) => {
    acc[agent.status] = (acc[agent.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(agentStatusDistribution).map(([status, count], index) => ({
    name: status,
    value: count,
    color: ['#10B981', '#F59E0B', '#EF4444', '#6B7280'][index % 4]
  }))

  const handleSaveConfig = () => {
    // In real implementation, save to backend
    console.log('Saving config:', editedConfig)
    setIsEditing(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'idle':
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  if (!swarm) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Swarm Not Found</h3>
          <p className="text-gray-500">The selected swarm could not be loaded.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              {swarm.name}
              {getStatusIcon(swarm.status)}
            </h2>
            <p className="text-gray-600">Swarm ID: {swarm.id}</p>
          </div>
          <Badge variant={swarm.status === 'active' ? 'default' : 'secondary'}>
            {swarm.status.charAt(0).toUpperCase() + swarm.status.slice(1)}
          </Badge>
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

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Agents</p>
                <p className="text-2xl font-bold">{swarm.activeAgents}</p>
                <p className="text-xs text-gray-500">of {swarm.agentCount} total</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tasks Completed</p>
                <p className="text-2xl font-bold">{swarm.tasksCompleted}</p>
                <p className="text-xs text-gray-500">last 24h</p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Response Time</p>
                <p className="text-2xl font-bold">{swarm.averageResponseTime}ms</p>
                <p className="text-xs text-gray-500">{swarm.errorRate}% error rate</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uptime</p>
                <p className="text-2xl font-bold">{swarm.uptime}%</p>
                <p className="text-xs text-gray-500">last 30 days</p>
              </div>
              <Shield className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tabs */}
      <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="responseTime" stroke="#3B82F6" name="Response Time (ms)" />
                    <Line type="monotone" dataKey="throughput" stroke="#10B981" name="Throughput" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Agent Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Agent Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm capitalize">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {traces.slice(0, 5).map((trace, index) => (
                    <div key={trace.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-sm">{trace.trace_name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(trace.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge variant={trace.status === 'success' ? 'default' : 'destructive'}>
                        {trace.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Configuration Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Topology:</span>
                  <Badge variant="outline">{swarm.configuration.topology}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Load Balancing:</span>
                  <Badge variant="outline">{swarm.configuration.loadBalancing}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Auto Scaling:</span>
                  <Badge variant={swarm.configuration.scalingEnabled ? 'default' : 'secondary'}>
                    {swarm.configuration.scalingEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Last Activity:</span>
                  <span className="text-sm">{swarm.lastActivity.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="space-y-4">
            {/* Resource Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Usage Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="CPU %" />
                    <Area type="monotone" dataKey="memory" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Memory %" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Throughput & Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={performanceData.slice(-12)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="throughput" fill="#3B82F6" name="Throughput" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Rate Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={performanceData.slice(-12)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="errorRate" stroke="#EF4444" name="Error Rate %" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <div className="space-y-4">
            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <Card key={agent.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{agent.name}</CardTitle>
                      <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                        {agent.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">{agent.type}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Tasks:</span>
                        <span className="ml-1 font-medium">{agent.tasks_completed}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Response:</span>
                        <span className="ml-1 font-medium">{agent.average_response_time}ms</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>CPU: {agent.cpu_usage}%</span>
                      </div>
                      <Progress value={agent.cpu_usage} className="h-1" />
                      
                      <div className="flex justify-between text-xs">
                        <span>Memory: {agent.memory_usage}%</span>
                      </div>
                      <Progress value={agent.memory_usage} className="h-1" />
                    </div>

                    <div className="text-xs text-gray-500">
                      Last activity: {new Date(agent.last_activity).toLocaleTimeString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resources">
          <div className="space-y-4">
            {/* Resource Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Resource Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={resourceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resource Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={resourceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                      >
                        {resourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Resource Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {resourceData.map(resource => (
                <Card key={resource.name}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{resource.name}</h4>
                      <span className="text-sm text-gray-600">{resource.value}%</span>
                    </div>
                    <Progress value={resource.value} className="h-2" />
                    <p className="text-xs text-gray-500 mt-2">
                      {resource.value < 50 ? 'Normal' : resource.value < 80 ? 'High' : 'Critical'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Swarm Configuration</CardTitle>
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => isEditing ? handleSaveConfig() : setIsEditing(true)}
                >
                  {isEditing ? (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Topology</label>
                  {isEditing ? (
                    <select
                      value={editedConfig.topology}
                      onChange={(e) => setEditedConfig(prev => ({ ...prev, topology: e.target.value }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="mesh">Mesh</option>
                      <option value="hierarchical">Hierarchical</option>
                      <option value="star">Star</option>
                      <option value="ring">Ring</option>
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{swarm.configuration.topology}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Load Balancing</label>
                  {isEditing ? (
                    <select
                      value={editedConfig.loadBalancing}
                      onChange={(e) => setEditedConfig(prev => ({ ...prev, loadBalancing: e.target.value }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="round-robin">Round Robin</option>
                      <option value="least-connections">Least Connections</option>
                      <option value="weighted">Weighted</option>
                      <option value="hash">Hash-based</option>
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{swarm.configuration.loadBalancing}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Auto Scaling</label>
                  {isEditing ? (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editedConfig.scalingEnabled}
                        onChange={(e) => setEditedConfig(prev => ({ ...prev, scalingEnabled: e.target.checked }))}
                        className="mr-2"
                      />
                      Enable Auto Scaling
                    </label>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {swarm.configuration.scalingEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
                {traces.map(trace => (
                  <div key={trace.id} className="p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        [{new Date(trace.created_at).toLocaleString()}]
                      </span>
                      <Badge variant={trace.status === 'success' ? 'default' : 'destructive'}>
                        {trace.status}
                      </Badge>
                    </div>
                    <p className="mt-1">{trace.trace_name}</p>
                    {trace.duration_ms > 0 && (
                      <p className="text-xs text-gray-500">Duration: {trace.duration_ms}ms</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}