'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useRealtimeSwarm } from '@/lib/hooks/use-realtime-swarm'
import { SwarmDatabase } from '@/lib/supabase'
import {
  Activity,
  Users,
  Cpu,
  Memory,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Settings,
  Play,
  Pause,
  Square,
  RefreshCw,
  Plus,
  Filter,
  Download,
  Upload
} from 'lucide-react'
import { SwarmCreateModal } from './swarm-create-modal'
import { SwarmDetailView } from './SwarmDetailView'
import { AgentPerformanceDashboard } from './AgentPerformanceDashboard'
import { TaskOrchestrationInterface } from './TaskOrchestrationInterface'
import { MemoryCoordinationView } from './MemoryCoordinationView'

interface SwarmMetrics {
  id: string
  name: string
  status: 'active' | 'idle' | 'error' | 'stopped'
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

export const SwarmManagementHub: React.FC = () => {
  const [selectedSwarmId, setSelectedSwarmId] = useState<string>('swarm_observability')
  const [selectedSessionId, setSelectedSessionId] = useState<string>('550e8400-e29b-41d4-a716-446655440000')
  const [activeTab, setActiveTab] = useState('overview')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Real-time data from Supabase
  const {
    traces,
    agents,
    sessions,
    metrics,
    aggregatedMetrics,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    refresh,
    addTrace,
    updateAgentStatus,
    recordMetric
  } = useRealtimeSwarm({
    sessionId: selectedSessionId,
    swarmId: selectedSwarmId,
    enableTraces: true,
    enableAgents: true,
    enableMetrics: true,
    enableSessions: true,
    maxItems: 50,
    autoRefresh: true,
    refreshInterval: 3000
  })

  // Mock swarm data - in real implementation, this would come from your swarm management API
  const [swarms, setSwarms] = useState<SwarmMetrics[]>([
    {
      id: 'swarm_observability',
      name: 'Observability Swarm',
      status: 'active',
      agentCount: 5,
      activeAgents: 4,
      tasksCompleted: 127,
      averageResponseTime: 1200,
      errorRate: 2.1,
      uptime: 95.6,
      lastActivity: new Date(),
      resources: { cpu: 45, memory: 62, storage: 23 },
      configuration: { topology: 'mesh', scalingEnabled: true, loadBalancing: 'round-robin' }
    },
    {
      id: 'swarm_production',
      name: 'Production Swarm',
      status: 'active',
      agentCount: 8,
      activeAgents: 7,
      tasksCompleted: 245,
      averageResponseTime: 890,
      errorRate: 1.2,
      uptime: 98.2,
      lastActivity: new Date(Date.now() - 30000),
      resources: { cpu: 67, memory: 78, storage: 34 },
      configuration: { topology: 'hierarchical', scalingEnabled: true, loadBalancing: 'least-connections' }
    },
    {
      id: 'swarm_development',
      name: 'Development Swarm',
      status: 'idle',
      agentCount: 3,
      activeAgents: 1,
      tasksCompleted: 89,
      averageResponseTime: 1456,
      errorRate: 4.8,
      uptime: 87.3,
      lastActivity: new Date(Date.now() - 120000),
      resources: { cpu: 23, memory: 34, storage: 12 },
      configuration: { topology: 'star', scalingEnabled: false, loadBalancing: 'weighted' }
    }
  ])

  const filteredSwarms = swarms.filter(swarm =>
    swarm.name.toLowerCase().includes(filter.toLowerCase()) ||
    swarm.status.toLowerCase().includes(filter.toLowerCase())
  )

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
      // Also refresh swarm list - in real implementation, this would call your API
      console.log('Refreshed swarm data')
    } catch (error) {
      console.error('Error refreshing:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSwarmAction = async (swarmId: string, action: 'start' | 'pause' | 'stop') => {
    try {
      // In real implementation, call your swarm management API
      console.log(`${action} swarm:`, swarmId)
      
      // Update local state for demo
      setSwarms(prev => prev.map(swarm => 
        swarm.id === swarmId 
          ? { 
              ...swarm, 
              status: action === 'start' ? 'active' : action === 'pause' ? 'idle' : 'stopped',
              lastActivity: new Date()
            }
          : swarm
      ))

      // Record metric in Supabase
      await recordMetric({
        session_id: selectedSessionId,
        metric_type: 'swarm_action',
        metric_value: 1,
        metric_data: { action, swarmId },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error(`Error ${action} swarm:`, error)
    }
  }

  const handleCreateSwarm = async (config: any) => {
    try {
      // In real implementation, call your swarm creation API
      const newSwarm: SwarmMetrics = {
        id: `swarm_${Date.now()}`,
        name: config.name,
        status: 'idle',
        agentCount: config.agents.length,
        activeAgents: 0,
        tasksCompleted: 0,
        averageResponseTime: 0,
        errorRate: 0,
        uptime: 100,
        lastActivity: new Date(),
        resources: { cpu: 0, memory: 0, storage: 0 },
        configuration: {
          topology: 'mesh',
          scalingEnabled: config.scaling.autoScale,
          loadBalancing: config.loadBalancing.strategy
        }
      }

      setSwarms(prev => [...prev, newSwarm])

      // Create session in Supabase
      await SwarmDatabase.createSession({
        id: newSwarm.id,
        session_name: config.name,
        description: config.purpose,
        total_traces: 0,
        active_traces: 0,
        total_agents: config.agents.length,
        active_agents: 0,
        start_time: new Date().toISOString(),
        status: 'active'
      })

      console.log('Created new swarm:', newSwarm)
    } catch (error) {
      console.error('Error creating swarm:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'idle': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      case 'stopped': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'idle': return 'secondary'
      case 'error': return 'destructive'
      case 'stopped': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Swarm Management Hub</h1>
          <p className="text-gray-600 mt-1">Monitor and manage your swarm intelligence systems</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Swarm
          </Button>
        </div>
      </div>

      {/* Connection Status & Last Update */}
      {lastUpdate && (
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {aggregatedMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Agents</p>
                  <p className="text-2xl font-bold">{aggregatedMetrics.totalAgents}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {aggregatedMetrics.activeAgents} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Traces</p>
                  <p className="text-2xl font-bold">{aggregatedMetrics.activeTraces}</p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {aggregatedMetrics.totalTraces} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Response</p>
                  <p className="text-2xl font-bold">{aggregatedMetrics.averageResponseTime}ms</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {aggregatedMetrics.errorRate}% error rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">System Health</p>
                  <p className="text-2xl font-bold">{aggregatedMetrics.systemHealth}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {aggregatedMetrics.throughput} tasks/min
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="tasks">Task Orchestration</TabsTrigger>
          <TabsTrigger value="memory">Memory Coordination</TabsTrigger>
          <TabsTrigger value="details">Swarm Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Filter swarms..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Swarms Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSwarms.map(swarm => (
              <Card key={swarm.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{swarm.name}</CardTitle>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(swarm.status)}`} />
                      <Badge variant={getStatusBadgeVariant(swarm.status)}>
                        {swarm.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Agent Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Agents:</span>
                      <span className="ml-1 font-medium">{swarm.activeAgents}/{swarm.agentCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Tasks:</span>
                      <span className="ml-1 font-medium">{swarm.tasksCompleted}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Response:</span>
                      <span className="ml-1 font-medium">{swarm.averageResponseTime}ms</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Uptime:</span>
                      <span className="ml-1 font-medium">{swarm.uptime}%</span>
                    </div>
                  </div>

                  {/* Resource Usage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">CPU</span>
                      <span>{swarm.resources.cpu}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${swarm.resources.cpu}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Memory</span>
                      <span>{swarm.resources.memory}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${swarm.resources.memory}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex space-x-1">
                      {swarm.status !== 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSwarmAction(swarm.id, 'start')}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      {swarm.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSwarmAction(swarm.id, 'pause')}
                        >
                          <Pause className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSwarmAction(swarm.id, 'stop')}
                      >
                        <Square className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedSwarmId(swarm.id)
                        setActiveTab('details')
                      }}
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Details
                    </Button>
                  </div>

                  {/* Last Activity */}
                  <div className="text-xs text-gray-500">
                    Last activity: {swarm.lastActivity.toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <AgentPerformanceDashboard
            agents={agents}
            metrics={metrics}
            swarmId={selectedSwarmId}
            onUpdateAgent={updateAgentStatus}
          />
        </TabsContent>

        <TabsContent value="tasks">
          <TaskOrchestrationInterface
            traces={traces}
            agents={agents}
            swarmId={selectedSwarmId}
            sessionId={selectedSessionId}
            onAddTrace={addTrace}
            onRecordMetric={recordMetric}
          />
        </TabsContent>

        <TabsContent value="memory">
          <MemoryCoordinationView
            metrics={metrics}
            traces={traces}
            swarmId={selectedSwarmId}
            sessionId={selectedSessionId}
          />
        </TabsContent>

        <TabsContent value="details">
          <SwarmDetailView
            swarmId={selectedSwarmId}
            swarm={swarms.find(s => s.id === selectedSwarmId)}
            agents={agents}
            traces={traces}
            metrics={metrics}
          />
        </TabsContent>
      </Tabs>

      {/* Create Swarm Modal */}
      <SwarmCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateSwarm}
      />
    </div>
  )
}