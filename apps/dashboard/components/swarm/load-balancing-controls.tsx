'use client'

import React, { useState } from 'react'
import { Zap, Activity, Shield, AlertTriangle, CheckCircle, BarChart3, Gauge, Router, Target, Settings, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Agent {
  id: string
  name: string
  status: 'healthy' | 'unhealthy' | 'draining' | 'maintenance'
  load: number
  connections: number
  responseTime: number
  successRate: number
  weight: number
  region: string
  cpu: number
  memory: number
  lastHealthCheck: string
  healthChecks: {
    total: number
    passed: number
    failed: number
    consecutive_failures: number
  }
}

interface LoadBalancingConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'hash' | 'random' | 'ip-hash'
  healthCheck: {
    enabled: boolean
    path: string
    interval: number
    timeout: number
    retries: number
    healthyThreshold: number
    unhealthyThreshold: number
  }
  stickySession: {
    enabled: boolean
    cookieName: string
    duration: number
  }
  circuitBreaker: {
    enabled: boolean
    failureThreshold: number
    recoveryTimeout: number
    halfOpenMax: number
  }
  weights: Record<string, number>
  rules: {
    id: string
    name: string
    condition: string
    action: string
    enabled: boolean
  }[]
}

interface LoadBalancingMetrics {
  totalRequests: number
  requestsPerSecond: number
  avgResponseTime: number
  successRate: number
  activeConnections: number
  distribution: Record<string, number>
  errors: {
    total: number
    rate: number
    types: Record<string, number>
  }
}

interface LoadBalancingData {
  swarmId: string
  swarmName: string
  agents: Agent[]
  config: LoadBalancingConfig
  metrics: LoadBalancingMetrics
  alertThresholds: {
    responseTime: number
    errorRate: number
    connectionLimit: number
  }
}

interface LoadBalancingControlsProps {
  swarm: LoadBalancingData
  onUpdateStrategy: (strategy: string) => void
  onUpdateHealthCheck: (config: any) => void
  onUpdateWeights: (weights: Record<string, number>) => void
  onToggleAgent: (agentId: string, enabled: boolean) => void
  onDrainAgent: (agentId: string) => void
  onTestHealthCheck: (agentId?: string) => void
  onUpdateRule: (ruleId: string, rule: any) => void
  onToggleCircuitBreaker: (enabled: boolean) => void
  onRebalance: () => void
}

export const LoadBalancingControls: React.FC<LoadBalancingControlsProps> = ({
  swarm,
  onUpdateStrategy,
  onUpdateHealthCheck,
  onUpdateWeights,
  onToggleAgent,
  onDrainAgent,
  onTestHealthCheck,
  onUpdateRule,
  onToggleCircuitBreaker,
  onRebalance
}) => {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [newWeight, setNewWeight] = useState<Record<string, number>>({})

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50'
      case 'unhealthy': return 'text-red-600 bg-red-50'
      case 'draining': return 'text-yellow-600 bg-yellow-50'
      case 'maintenance': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />
      case 'unhealthy': return <AlertTriangle className="w-4 h-4" />
      case 'draining': return <TrendingDown className="w-4 h-4" />
      case 'maintenance': return <Settings className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getLoadColor = (load: number) => {
    if (load >= 80) return 'text-red-600'
    if (load >= 60) return 'text-yellow-600'
    return 'text-green-600'
  }

  const healthyAgents = swarm.agents.filter(a => a.status === 'healthy').length
  const totalDistribution = Object.values(swarm.metrics.distribution).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Load Balancing Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Load Balancing - {swarm.swarmName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{swarm.metrics.activeConnections}</div>
              <div className="text-sm text-gray-600">Active Connections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{swarm.metrics.requestsPerSecond}</div>
              <div className="text-sm text-gray-600">Requests/sec</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{swarm.metrics.avgResponseTime}ms</div>
              <div className="text-sm text-gray-600">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{swarm.metrics.successRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current Strategy</span>
                <Badge variant="secondary">{swarm.config.strategy.replace('-', ' ')}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Healthy Agents</span>
                <span className="font-medium">{healthyAgents}/{swarm.agents.length}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Circuit Breaker</span>
                <Badge variant={swarm.config.circuitBreaker.enabled ? 'default' : 'outline'}>
                  {swarm.config.circuitBreaker.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Health Checks</span>
                <Badge variant={swarm.config.healthCheck.enabled ? 'default' : 'outline'}>
                  {swarm.config.healthCheck.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agents" className="flex items-center">
            <Router className="w-4 h-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="strategy" className="flex items-center">
            <Target className="w-4 h-4 mr-2" />
            Strategy
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            Health Checks
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Agent Management</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => onTestHealthCheck()}>
                    <Shield className="w-4 h-4 mr-2" />
                    Test All Health Checks
                  </Button>
                  <Button variant="outline" size="sm" onClick={onRebalance}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rebalance
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {swarm.agents.map(agent => (
                  <div key={agent.id} className="p-4 border rounded-lg transition-all duration-200 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedAgents.includes(agent.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgents([...selectedAgents, agent.id])
                            } else {
                              setSelectedAgents(selectedAgents.filter(id => id !== agent.id))
                            }
                          }}
                          className="rounded"
                        />
                        <div className={`p-1 rounded ${getStatusColor(agent.status)}`}>
                          {getStatusIcon(agent.status)}
                        </div>
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-gray-600">{agent.region}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className={`text-sm font-medium ${getLoadColor(agent.load)}`}>
                            {agent.load}%
                          </div>
                          <div className="text-xs text-gray-500">Load</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm font-medium">{agent.connections}</div>
                          <div className="text-xs text-gray-500">Connections</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm font-medium">{agent.responseTime}ms</div>
                          <div className="text-xs text-gray-500">Response</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm font-medium">{agent.successRate.toFixed(1)}%</div>
                          <div className="text-xs text-gray-500">Success</div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <Input
                            type="number"
                            value={newWeight[agent.id] || agent.weight}
                            onChange={(e) => setNewWeight({
                              ...newWeight,
                              [agent.id]: parseFloat(e.target.value) || 1
                            })}
                            className="w-16 text-xs"
                            min="0"
                            step="0.1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onUpdateWeights({
                                ...swarm.config.weights,
                                [agent.id]: newWeight[agent.id] || agent.weight
                              })
                            }}
                          >
                            Set
                          </Button>
                        </div>

                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onTestHealthCheck(agent.id)}
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                          
                          {agent.status === 'healthy' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDrainAgent(agent.id)}
                            >
                              <TrendingDown className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onToggleAgent(agent.id, agent.status !== 'healthy')}
                          >
                            {agent.status === 'maintenance' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Settings className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>CPU Usage</span>
                          <span>{agent.cpu}%</span>
                        </div>
                        <Progress value={agent.cpu} className="h-1" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Memory Usage</span>
                          <span>{agent.memory}%</span>
                        </div>
                        <Progress value={agent.memory} className="h-1" />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-between text-xs text-gray-500">
                      <span>
                        Health: {agent.healthChecks.passed}/{agent.healthChecks.total} passed
                        {agent.healthChecks.consecutive_failures > 0 && (
                          <span className="text-red-500 ml-2">
                            ({agent.healthChecks.consecutive_failures} consecutive failures)
                          </span>
                        )}
                      </span>
                      <span>Last check: {new Date(agent.lastHealthCheck).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Load Balancing Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Strategy</label>
                <Select value={swarm.config.strategy} onValueChange={onUpdateStrategy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round-robin">Round Robin</SelectItem>
                    <SelectItem value="least-connections">Least Connections</SelectItem>
                    <SelectItem value="weighted">Weighted Round Robin</SelectItem>
                    <SelectItem value="hash">Hash-based</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="ip-hash">IP Hash</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-gray-500 mt-1">
                  {swarm.config.strategy === 'round-robin' && 'Requests are distributed evenly across all healthy agents'}
                  {swarm.config.strategy === 'least-connections' && 'Routes to the agent with the fewest active connections'}
                  {swarm.config.strategy === 'weighted' && 'Distributes requests based on agent weights'}
                  {swarm.config.strategy === 'hash' && 'Uses request hash to determine agent selection'}
                  {swarm.config.strategy === 'random' && 'Randomly selects from healthy agents'}
                  {swarm.config.strategy === 'ip-hash' && 'Routes based on client IP hash for session persistence'}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={swarm.config.circuitBreaker.enabled}
                  onChange={(e) => onToggleCircuitBreaker(e.target.checked)}
                  className="rounded"
                />
                <label className="text-sm font-medium">Enable Circuit Breaker</label>
              </div>

              {swarm.config.circuitBreaker.enabled && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
                  <div>
                    <label className="text-sm font-medium">Failure Threshold</label>
                    <Input
                      type="number"
                      value={swarm.config.circuitBreaker.failureThreshold}
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Recovery Timeout (s)</label>
                    <Input
                      type="number"
                      value={swarm.config.circuitBreaker.recoveryTimeout}
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Half-Open Max</label>
                    <Input
                      type="number"
                      value={swarm.config.circuitBreaker.halfOpenMax}
                      min="1"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={swarm.config.stickySession.enabled}
                  className="rounded"
                />
                <label className="text-sm font-medium">Enable Sticky Sessions</label>
              </div>

              {swarm.config.stickySession.enabled && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                  <div>
                    <label className="text-sm font-medium">Cookie Name</label>
                    <Input value={swarm.config.stickySession.cookieName} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Duration (minutes)</label>
                    <Input
                      type="number"
                      value={swarm.config.stickySession.duration}
                      min="1"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Health Check Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={swarm.config.healthCheck.enabled}
                  onChange={(e) => onUpdateHealthCheck({
                    ...swarm.config.healthCheck,
                    enabled: e.target.checked
                  })}
                  className="rounded"
                />
                <label className="text-sm font-medium">Enable Health Checks</label>
              </div>

              {swarm.config.healthCheck.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Health Check Path</label>
                    <Input
                      value={swarm.config.healthCheck.path}
                      onChange={(e) => onUpdateHealthCheck({
                        ...swarm.config.healthCheck,
                        path: e.target.value
                      })}
                      placeholder="/health"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Interval (seconds)</label>
                      <Input
                        type="number"
                        value={swarm.config.healthCheck.interval}
                        onChange={(e) => onUpdateHealthCheck({
                          ...swarm.config.healthCheck,
                          interval: parseInt(e.target.value) || 30
                        })}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Timeout (seconds)</label>
                      <Input
                        type="number"
                        value={swarm.config.healthCheck.timeout}
                        onChange={(e) => onUpdateHealthCheck({
                          ...swarm.config.healthCheck,
                          timeout: parseInt(e.target.value) || 5
                        })}
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Retries</label>
                      <Input
                        type="number"
                        value={swarm.config.healthCheck.retries}
                        onChange={(e) => onUpdateHealthCheck({
                          ...swarm.config.healthCheck,
                          retries: parseInt(e.target.value) || 3
                        })}
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Healthy Threshold</label>
                      <Input
                        type="number"
                        value={swarm.config.healthCheck.healthyThreshold}
                        onChange={(e) => onUpdateHealthCheck({
                          ...swarm.config.healthCheck,
                          healthyThreshold: parseInt(e.target.value) || 2
                        })}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Unhealthy Threshold</label>
                      <Input
                        type="number"
                        value={swarm.config.healthCheck.unhealthyThreshold}
                        onChange={(e) => onUpdateHealthCheck({
                          ...swarm.config.healthCheck,
                          unhealthyThreshold: parseInt(e.target.value) || 3
                        })}
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Load Distribution Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">Request Distribution</h4>
                  <div className="space-y-2">
                    {Object.entries(swarm.metrics.distribution).map(([agentId, requests]) => {
                      const agent = swarm.agents.find(a => a.id === agentId)
                      const percentage = totalDistribution > 0 ? (requests / totalDistribution) * 100 : 0
                      
                      return (
                        <div key={agentId} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded ${getStatusColor(agent?.status || 'unknown')}`} />
                            <span className="text-sm">{agent?.name || agentId}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-32">
                              <Progress value={percentage} className="h-2" />
                            </div>
                            <span className="text-sm font-medium w-12 text-right">
                              {percentage.toFixed(1)}%
                            </span>
                            <span className="text-xs text-gray-500 w-16 text-right">
                              {requests} reqs
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Error Analysis</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Errors</span>
                        <span className="font-medium">{swarm.metrics.errors.total}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Error Rate</span>
                        <span className="font-medium">{swarm.metrics.errors.rate.toFixed(2)}%</span>
                      </div>
                      {Object.entries(swarm.metrics.errors.types).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-xs text-gray-600">
                          <span>{type}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Performance Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Requests</span>
                        <span className="font-medium">{swarm.metrics.totalRequests.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Avg Response Time</span>
                        <span className="font-medium">{swarm.metrics.avgResponseTime}ms</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Success Rate</span>
                        <span className="font-medium">{swarm.metrics.successRate.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default LoadBalancingControls