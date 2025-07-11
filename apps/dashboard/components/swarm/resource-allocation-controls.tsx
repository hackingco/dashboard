'use client'

import React, { useState } from 'react'
import { Cpu, HardDrive, Wifi, Zap, BarChart3, Settings, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, Target, Activity, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'

interface ResourceQuota {
  cpu: {
    allocated: number
    used: number
    limit: number
    unit: 'cores' | 'millicores'
  }
  memory: {
    allocated: number
    used: number
    limit: number
    unit: 'MB' | 'GB'
  }
  storage: {
    allocated: number
    used: number
    limit: number
    unit: 'GB' | 'TB'
  }
  network: {
    allocated: number
    used: number
    limit: number
    unit: 'Mbps' | 'Gbps'
  }
}

interface AgentResource {
  id: string
  name: string
  region: string
  status: 'online' | 'offline' | 'overloaded' | 'underutilized'
  quotas: ResourceQuota
  cost: {
    hourly: number
    monthly: number
    currency: string
  }
  efficiency: number
  recommendations: string[]
  lastOptimized: string
}

interface ResourcePool {
  id: string
  name: string
  type: 'shared' | 'dedicated' | 'spot'
  region: string
  totalResources: ResourceQuota
  availableResources: ResourceQuota
  agents: string[]
  priority: 'low' | 'medium' | 'high'
  autoscaling: {
    enabled: boolean
    minCapacity: number
    maxCapacity: number
    targetUtilization: number
  }
}

interface CostAnalysis {
  totalCost: {
    daily: number
    monthly: number
    projected: number
  }
  breakdown: {
    compute: number
    storage: number
    network: number
    other: number
  }
  trends: {
    period: string
    change: number
    direction: 'up' | 'down' | 'stable'
  }
  recommendations: {
    potential_savings: number
    actions: string[]
  }
}

interface ResourceAllocationData {
  swarmId: string
  swarmName: string
  agents: AgentResource[]
  pools: ResourcePool[]
  costAnalysis: CostAnalysis
  globalLimits: ResourceQuota
  optimization: {
    enabled: boolean
    strategy: 'cost' | 'performance' | 'balanced'
    schedule: string
    lastRun: string
    nextRun: string
  }
  alerts: {
    thresholds: {
      cpu: number
      memory: number
      storage: number
      cost: number
    }
    notifications: boolean
  }
}

interface ResourceAllocationControlsProps {
  swarm: ResourceAllocationData
  onUpdateAgentQuota: (agentId: string, resource: string, value: number) => void
  onOptimizeResources: (strategy: string) => void
  onCreatePool: (poolConfig: any) => void
  onUpdatePool: (poolId: string, config: any) => void
  onDeletePool: (poolId: string) => void
  onMoveAgentToPool: (agentId: string, poolId: string) => void
  onUpdateGlobalLimits: (limits: ResourceQuota) => void
  onUpdateAlertThresholds: (thresholds: any) => void
}

export const ResourceAllocationControls: React.FC<ResourceAllocationControlsProps> = ({
  swarm,
  onUpdateAgentQuota,
  onOptimizeResources,
  onCreatePool,
  onUpdatePool,
  onDeletePool,
  onMoveAgentToPool,
  onUpdateGlobalLimits,
  onUpdateAlertThresholds
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [optimizationStrategy, setOptimizationStrategy] = useState<'cost' | 'performance' | 'balanced'>('balanced')
  const [newPoolName, setNewPoolName] = useState('')
  const [newPoolType, setNewPoolType] = useState<'shared' | 'dedicated' | 'spot'>('shared')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-50'
      case 'offline': return 'text-gray-600 bg-gray-50'
      case 'overloaded': return 'text-red-600 bg-red-50'
      case 'underutilized': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-600'
    if (efficiency >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getUtilizationColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  const calculateUtilization = (used: number, limit: number) => {
    return limit > 0 ? (used / limit) * 100 : 0
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const totalUtilization = {
    cpu: swarm.agents.reduce((sum, agent) => sum + agent.quotas.cpu.used, 0) / 
         swarm.agents.reduce((sum, agent) => sum + agent.quotas.cpu.limit, 0) * 100,
    memory: swarm.agents.reduce((sum, agent) => sum + agent.quotas.memory.used, 0) / 
            swarm.agents.reduce((sum, agent) => sum + agent.quotas.memory.limit, 0) * 100,
    storage: swarm.agents.reduce((sum, agent) => sum + agent.quotas.storage.used, 0) / 
             swarm.agents.reduce((sum, agent) => sum + agent.quotas.storage.limit, 0) * 100
  }

  return (
    <div className="space-y-6">
      {/* Resource Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Resource Allocation - {swarm.swarmName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalUtilization.cpu.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">CPU Utilization</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{totalUtilization.memory.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Memory Utilization</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{totalUtilization.storage.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Storage Utilization</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(swarm.costAnalysis.totalCost.daily)}
              </div>
              <div className="text-sm text-gray-600">Daily Cost</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>CPU</span>
                <span>{totalUtilization.cpu.toFixed(1)}%</span>
              </div>
              <Progress value={totalUtilization.cpu} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Memory</span>
                <span>{totalUtilization.memory.toFixed(1)}%</span>
              </div>
              <Progress value={totalUtilization.memory} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage</span>
                <span>{totalUtilization.storage.toFixed(1)}%</span>
              </div>
              <Progress value={totalUtilization.storage} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agents" className="flex items-center">
            <Monitor className="w-4 h-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="pools" className="flex items-center">
            <Target className="w-4 h-4 mr-2" />
            Resource Pools
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Cost Analysis
          </TabsTrigger>
          <TabsTrigger value="optimization" className="flex items-center">
            <Zap className="w-4 h-4 mr-2" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="limits" className="flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Limits & Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
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
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getEfficiencyColor(agent.efficiency)}`}>
                        {agent.efficiency}% Efficient
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatCurrency(agent.cost.hourly)}/hr
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center">
                          <Cpu className="w-3 h-3 mr-1" />
                          CPU
                        </span>
                        <span className={getUtilizationColor(agent.quotas.cpu.used, agent.quotas.cpu.limit)}>
                          {agent.quotas.cpu.used}/{agent.quotas.cpu.limit} {agent.quotas.cpu.unit}
                        </span>
                      </div>
                      <Progress 
                        value={calculateUtilization(agent.quotas.cpu.used, agent.quotas.cpu.limit)} 
                        className="h-1.5" 
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center">
                          <HardDrive className="w-3 h-3 mr-1" />
                          Memory
                        </span>
                        <span className={getUtilizationColor(agent.quotas.memory.used, agent.quotas.memory.limit)}>
                          {agent.quotas.memory.used}/{agent.quotas.memory.limit} {agent.quotas.memory.unit}
                        </span>
                      </div>
                      <Progress 
                        value={calculateUtilization(agent.quotas.memory.used, agent.quotas.memory.limit)} 
                        className="h-1.5" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center">
                          <HardDrive className="w-3 h-3 mr-1" />
                          Storage
                        </span>
                        <span className={getUtilizationColor(agent.quotas.storage.used, agent.quotas.storage.limit)}>
                          {agent.quotas.storage.used}/{agent.quotas.storage.limit} {agent.quotas.storage.unit}
                        </span>
                      </div>
                      <Progress 
                        value={calculateUtilization(agent.quotas.storage.used, agent.quotas.storage.limit)} 
                        className="h-1.5" 
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center">
                          <Wifi className="w-3 h-3 mr-1" />
                          Network
                        </span>
                        <span className={getUtilizationColor(agent.quotas.network.used, agent.quotas.network.limit)}>
                          {agent.quotas.network.used}/{agent.quotas.network.limit} {agent.quotas.network.unit}
                        </span>
                      </div>
                      <Progress 
                        value={calculateUtilization(agent.quotas.network.used, agent.quotas.network.limit)} 
                        className="h-1.5" 
                      />
                    </div>
                  </div>

                  {agent.recommendations.length > 0 && (
                    <div className="bg-blue-50 p-2 rounded text-xs">
                      <div className="font-medium text-blue-800 mb-1">Recommendations:</div>
                      <ul className="text-blue-700 space-y-1">
                        {agent.recommendations.slice(0, 2).map((rec, index) => (
                          <li key={index}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-gray-500 border-t pt-2">
                    <span>Last optimized: {new Date(agent.lastOptimized).toLocaleDateString()}</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedAgent(agent.id)}
                    >
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pools" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Resource Pools</CardTitle>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Pool name"
                    value={newPoolName}
                    onChange={(e) => setNewPoolName(e.target.value)}
                    className="w-32"
                  />
                  <Select value={newPoolType} onValueChange={(value: 'shared' | 'dedicated' | 'spot') => setNewPoolType(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">Shared</SelectItem>
                      <SelectItem value="dedicated">Dedicated</SelectItem>
                      <SelectItem value="spot">Spot</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => {
                      if (newPoolName) {
                        onCreatePool({ name: newPoolName, type: newPoolType })
                        setNewPoolName('')
                      }
                    }}
                    disabled={!newPoolName}
                  >
                    Create Pool
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {swarm.pools.map(pool => (
                  <div key={pool.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">{pool.name}</div>
                        <div className="text-sm text-gray-600">
                          {pool.type} • {pool.region} • {pool.agents.length} agents
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{pool.priority}</Badge>
                        <Badge variant={pool.autoscaling.enabled ? 'default' : 'outline'}>
                          {pool.autoscaling.enabled ? 'Auto-scaling' : 'Manual'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-sm font-medium">
                          {pool.totalResources.cpu.allocated - pool.availableResources.cpu.allocated}/
                          {pool.totalResources.cpu.allocated}
                        </div>
                        <div className="text-xs text-gray-600">CPU</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-sm font-medium">
                          {pool.totalResources.memory.allocated - pool.availableResources.memory.allocated}/
                          {pool.totalResources.memory.allocated}
                        </div>
                        <div className="text-xs text-gray-600">Memory</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-sm font-medium">
                          {pool.totalResources.storage.allocated - pool.availableResources.storage.allocated}/
                          {pool.totalResources.storage.allocated}
                        </div>
                        <div className="text-xs text-gray-600">Storage</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-sm font-medium">
                          {pool.totalResources.network.allocated - pool.availableResources.network.allocated}/
                          {pool.totalResources.network.allocated}
                        </div>
                        <div className="text-xs text-gray-600">Network</div>
                      </div>
                    </div>

                    {pool.autoscaling.enabled && (
                      <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                        <div className="flex justify-between">
                          <span>Auto-scaling: {pool.autoscaling.minCapacity}-{pool.autoscaling.maxCapacity} agents</span>
                          <span>Target: {pool.autoscaling.targetUtilization}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Cost Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(swarm.costAnalysis.totalCost.daily)}
                      </div>
                      <div className="text-sm text-blue-600">Daily</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(swarm.costAnalysis.totalCost.monthly)}
                      </div>
                      <div className="text-sm text-green-600">Monthly</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Compute</span>
                      <span className="font-medium">
                        {formatCurrency(swarm.costAnalysis.breakdown.compute)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Storage</span>
                      <span className="font-medium">
                        {formatCurrency(swarm.costAnalysis.breakdown.storage)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Network</span>
                      <span className="font-medium">
                        {formatCurrency(swarm.costAnalysis.breakdown.network)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Other</span>
                      <span className="font-medium">
                        {formatCurrency(swarm.costAnalysis.breakdown.other)}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Trend ({swarm.costAnalysis.trends.period})</span>
                      <div className="flex items-center space-x-1">
                        {swarm.costAnalysis.trends.direction === 'up' && (
                          <TrendingUp className="w-4 h-4 text-red-600" />
                        )}
                        {swarm.costAnalysis.trends.direction === 'down' && (
                          <TrendingDown className="w-4 h-4 text-green-600" />
                        )}
                        <span className={`text-sm font-medium ${
                          swarm.costAnalysis.trends.direction === 'up' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {swarm.costAnalysis.trends.change > 0 ? '+' : ''}{swarm.costAnalysis.trends.change}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Optimization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 rounded">
                    <div className="font-medium text-green-800">Potential Savings</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(swarm.costAnalysis.recommendations.potential_savings)}
                    </div>
                    <div className="text-sm text-green-700">per month</div>
                  </div>

                  <div>
                    <div className="font-medium mb-2">Recommended Actions:</div>
                    <ul className="space-y-1 text-sm">
                      {swarm.costAnalysis.recommendations.actions.map((action, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button className="w-full" onClick={() => onOptimizeResources('cost')}>
                    Apply Cost Optimizations
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Optimization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Optimization Strategy</label>
                <Select value={optimizationStrategy} onValueChange={(value: 'cost' | 'performance' | 'balanced') => setOptimizationStrategy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cost">Cost Optimization</SelectItem>
                    <SelectItem value="performance">Performance Optimization</SelectItem>
                    <SelectItem value="balanced">Balanced Approach</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500 mt-1">
                  {optimizationStrategy === 'cost' && 'Minimize costs while maintaining performance requirements'}
                  {optimizationStrategy === 'performance' && 'Maximize performance regardless of cost'}
                  {optimizationStrategy === 'balanced' && 'Balance cost and performance optimization'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm font-medium">Auto-optimization</div>
                  <div className="text-lg font-bold">
                    {swarm.optimization.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                  <div className="text-xs text-gray-600">
                    {swarm.optimization.schedule || 'No schedule set'}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm font-medium">Last Run</div>
                  <div className="text-sm">
                    {new Date(swarm.optimization.lastRun).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    Next: {new Date(swarm.optimization.nextRun).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={() => onOptimizeResources(optimizationStrategy)}
                  className="flex-1"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Run Optimization Now
                </Button>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Global Resource Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">CPU Limit (cores)</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Slider
                      value={[swarm.globalLimits.cpu.limit]}
                      onValueChange={([value]) => onUpdateGlobalLimits({
                        ...swarm.globalLimits,
                        cpu: { ...swarm.globalLimits.cpu, limit: value }
                      })}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">{swarm.globalLimits.cpu.limit}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Memory Limit (GB)</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Slider
                      value={[swarm.globalLimits.memory.limit]}
                      onValueChange={([value]) => onUpdateGlobalLimits({
                        ...swarm.globalLimits,
                        memory: { ...swarm.globalLimits.memory, limit: value }
                      })}
                      max={1000}
                      step={10}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">{swarm.globalLimits.memory.limit}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Storage Limit (GB)</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Slider
                      value={[swarm.globalLimits.storage.limit]}
                      onValueChange={([value]) => onUpdateGlobalLimits({
                        ...swarm.globalLimits,
                        storage: { ...swarm.globalLimits.storage, limit: value }
                      })}
                      max={10000}
                      step={100}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">{swarm.globalLimits.storage.limit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Thresholds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">CPU Threshold (%)</label>
                  <Input
                    type="number"
                    value={swarm.alerts.thresholds.cpu}
                    onChange={(e) => onUpdateAlertThresholds({
                      ...swarm.alerts.thresholds,
                      cpu: parseInt(e.target.value) || 80
                    })}
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Memory Threshold (%)</label>
                  <Input
                    type="number"
                    value={swarm.alerts.thresholds.memory}
                    onChange={(e) => onUpdateAlertThresholds({
                      ...swarm.alerts.thresholds,
                      memory: parseInt(e.target.value) || 80
                    })}
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Storage Threshold (%)</label>
                  <Input
                    type="number"
                    value={swarm.alerts.thresholds.storage}
                    onChange={(e) => onUpdateAlertThresholds({
                      ...swarm.alerts.thresholds,
                      storage: parseInt(e.target.value) || 80
                    })}
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Cost Threshold ($/day)</label>
                  <Input
                    type="number"
                    value={swarm.alerts.thresholds.cost}
                    onChange={(e) => onUpdateAlertThresholds({
                      ...swarm.alerts.thresholds,
                      cost: parseFloat(e.target.value) || 100
                    })}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={swarm.alerts.notifications}
                    className="rounded"
                  />
                  <label className="text-sm font-medium">Enable alert notifications</label>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ResourceAllocationControls