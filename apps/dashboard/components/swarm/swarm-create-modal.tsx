'use client'

import React, { useState } from 'react'
import { X, Plus, Minus, Settings, Code, Users, Activity, Zap, Target, Shield, BarChart3, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SwarmAgent {
  id: string
  name: string
  role: string
  tasks: string[]
  resources: {
    cpu: string
    memory: string
    priority: 'low' | 'medium' | 'high'
  }
}

interface SwarmConfiguration {
  name: string
  purpose: string
  priority: 'low' | 'medium' | 'high'
  scaling: {
    minAgents: number
    maxAgents: number
    autoScale: boolean
    scaleUpThreshold: number
    scaleDownThreshold: number
  }
  loadBalancing: {
    strategy: 'round-robin' | 'least-connections' | 'weighted' | 'hash'
    healthCheck: {
      enabled: boolean
      interval: number
      timeout: number
      retries: number
    }
  }
  orchestration: {
    taskTimeout: number
    maxRetries: number
    failureStrategy: 'retry' | 'skip' | 'abort'
    dependencies: boolean
    pipeline: boolean
  }
  resources: {
    cpu: string
    memory: string
    storage: string
    network: string
  }
  agents: SwarmAgent[]
  tags: string[]
  environment: Record<string, string>
}

interface SwarmCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (config: SwarmConfiguration) => void
}

export const SwarmCreateModal: React.FC<SwarmCreateModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [config, setConfig] = useState<SwarmConfiguration>({
    name: '',
    purpose: '',
    priority: 'medium',
    scaling: {
      minAgents: 1,
      maxAgents: 10,
      autoScale: true,
      scaleUpThreshold: 80,
      scaleDownThreshold: 20
    },
    loadBalancing: {
      strategy: 'round-robin',
      healthCheck: {
        enabled: true,
        interval: 30,
        timeout: 5,
        retries: 3
      }
    },
    orchestration: {
      taskTimeout: 300,
      maxRetries: 3,
      failureStrategy: 'retry',
      dependencies: true,
      pipeline: false
    },
    resources: {
      cpu: 'shared-cpu-1x',
      memory: '512MB',
      storage: '1GB',
      network: 'standard'
    },
    agents: [],
    tags: [],
    environment: {}
  })

  const [newAgent, setNewAgent] = useState<Partial<SwarmAgent>>({
    name: '',
    role: '',
    tasks: [],
    resources: {
      cpu: 'shared-cpu-1x',
      memory: '256MB',
      priority: 'medium'
    }
  })

  const [newTag, setNewTag] = useState('')
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')
  const [newTask, setNewTask] = useState('')

  const addAgent = () => {
    if (newAgent.name && newAgent.role) {
      const agent: SwarmAgent = {
        id: `agent-${Date.now()}`,
        name: newAgent.name!,
        role: newAgent.role!,
        tasks: newAgent.tasks || [],
        resources: newAgent.resources!
      }
      setConfig(prev => ({
        ...prev,
        agents: [...prev.agents, agent]
      }))
      setNewAgent({
        name: '',
        role: '',
        tasks: [],
        resources: {
          cpu: 'shared-cpu-1x',
          memory: '256MB',
          priority: 'medium'
        }
      })
    }
  }

  const removeAgent = (agentId: string) => {
    setConfig(prev => ({
      ...prev,
      agents: prev.agents.filter(a => a.id !== agentId)
    }))
  }

  const addTag = () => {
    if (newTag && !config.tags.includes(newTag)) {
      setConfig(prev => ({
        ...prev,
        tags: [...prev.tags, newTag]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setConfig(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const addEnvironmentVariable = () => {
    if (newEnvKey && newEnvValue) {
      setConfig(prev => ({
        ...prev,
        environment: {
          ...prev.environment,
          [newEnvKey]: newEnvValue
        }
      }))
      setNewEnvKey('')
      setNewEnvValue('')
    }
  }

  const removeEnvironmentVariable = (key: string) => {
    setConfig(prev => {
      const newEnv = { ...prev.environment }
      delete newEnv[key]
      return {
        ...prev,
        environment: newEnv
      }
    })
  }

  const addTaskToAgent = () => {
    if (newTask && newAgent.name) {
      setNewAgent(prev => ({
        ...prev,
        tasks: [...(prev.tasks || []), newTask]
      }))
      setNewTask('')
    }
  }

  const removeTaskFromAgent = (taskIndex: number) => {
    setNewAgent(prev => ({
      ...prev,
      tasks: prev.tasks?.filter((_, i) => i !== taskIndex) || []
    }))
  }

  const handleCreate = () => {
    if (config.name && config.purpose && config.agents.length > 0) {
      onCreate(config)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Create New Swarm</h2>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6">
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic" className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Agents
              </TabsTrigger>
              <TabsTrigger value="scaling" className="flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                Scaling
              </TabsTrigger>
              <TabsTrigger value="load-balancing" className="flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Load Balancing
              </TabsTrigger>
              <TabsTrigger value="orchestration" className="flex items-center">
                <Target className="w-4 h-4 mr-2" />
                Orchestration
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                Resources
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Swarm Name</label>
                      <Input
                        value={config.name}
                        onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="my-awesome-swarm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <Select
                        value={config.priority}
                        onValueChange={(value: 'low' | 'medium' | 'high') => 
                          setConfig(prev => ({ ...prev, priority: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Purpose</label>
                    <textarea
                      className="w-full mt-1 p-2 border rounded-md"
                      rows={3}
                      value={config.purpose}
                      onChange={(e) => setConfig(prev => ({ ...prev, purpose: e.target.value }))}
                      placeholder="Describe what this swarm will do..."
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tags</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag"
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button onClick={addTag} size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {config.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                          {tag} <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Environment Variables</label>
                    <div className="grid grid-cols-5 gap-2 mt-1">
                      <Input
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value)}
                        placeholder="Key"
                      />
                      <Input
                        value={newEnvValue}
                        onChange={(e) => setNewEnvValue(e.target.value)}
                        placeholder="Value"
                      />
                      <Button onClick={addEnvironmentVariable} size="sm" className="col-span-1">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2 mt-2">
                      {Object.entries(config.environment).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <code className="text-sm">{key}={value}</code>
                          <Button variant="ghost" size="sm" onClick={() => removeEnvironmentVariable(key)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agents" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Agent Name</label>
                      <Input
                        value={newAgent.name || ''}
                        onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="data-processor"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Input
                        value={newAgent.role || ''}
                        onChange={(e) => setNewAgent(prev => ({ ...prev, role: e.target.value }))}
                        placeholder="Data Processing Agent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">CPU</label>
                      <Select
                        value={newAgent.resources?.cpu}
                        onValueChange={(value) => setNewAgent(prev => ({
                          ...prev,
                          resources: { ...prev.resources!, cpu: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shared-cpu-1x">Shared CPU 1x</SelectItem>
                          <SelectItem value="shared-cpu-2x">Shared CPU 2x</SelectItem>
                          <SelectItem value="shared-cpu-4x">Shared CPU 4x</SelectItem>
                          <SelectItem value="performance-cpu-1x">Performance CPU 1x</SelectItem>
                          <SelectItem value="performance-cpu-2x">Performance CPU 2x</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Memory</label>
                      <Select
                        value={newAgent.resources?.memory}
                        onValueChange={(value) => setNewAgent(prev => ({
                          ...prev,
                          resources: { ...prev.resources!, memory: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="256MB">256MB</SelectItem>
                          <SelectItem value="512MB">512MB</SelectItem>
                          <SelectItem value="1GB">1GB</SelectItem>
                          <SelectItem value="2GB">2GB</SelectItem>
                          <SelectItem value="4GB">4GB</SelectItem>
                          <SelectItem value="8GB">8GB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <Select
                        value={newAgent.resources?.priority}
                        onValueChange={(value: 'low' | 'medium' | 'high') => setNewAgent(prev => ({
                          ...prev,
                          resources: { ...prev.resources!, priority: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tasks</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Add task"
                        onKeyPress={(e) => e.key === 'Enter' && addTaskToAgent()}
                      />
                      <Button onClick={addTaskToAgent} size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-1 mt-2">
                      {newAgent.tasks?.map((task, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{task}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeTaskFromAgent(index)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={addAgent} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Agent
                  </Button>

                  <div className="space-y-3">
                    <h4 className="font-medium">Configured Agents ({config.agents.length})</h4>
                    {config.agents.map(agent => (
                      <div key={agent.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{agent.name}</h5>
                            <p className="text-sm text-gray-600">{agent.role}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline">{agent.resources.cpu}</Badge>
                              <Badge variant="outline">{agent.resources.memory}</Badge>
                              <Badge variant="outline">{agent.resources.priority}</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{agent.tasks.length} tasks</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeAgent(agent.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scaling" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Scaling Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Minimum Agents</label>
                      <Input
                        type="number"
                        value={config.scaling.minAgents}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          scaling: { ...prev.scaling, minAgents: parseInt(e.target.value) || 1 }
                        }))}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Maximum Agents</label>
                      <Input
                        type="number"
                        value={config.scaling.maxAgents}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          scaling: { ...prev.scaling, maxAgents: parseInt(e.target.value) || 10 }
                        }))}
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.scaling.autoScale}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        scaling: { ...prev.scaling, autoScale: e.target.checked }
                      }))}
                      className="rounded"
                    />
                    <label className="text-sm font-medium">Enable Auto-Scaling</label>
                  </div>

                  {config.scaling.autoScale && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Scale Up Threshold (%)</label>
                        <Input
                          type="number"
                          value={config.scaling.scaleUpThreshold}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            scaling: { ...prev.scaling, scaleUpThreshold: parseInt(e.target.value) || 80 }
                          }))}
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Scale Down Threshold (%)</label>
                        <Input
                          type="number"
                          value={config.scaling.scaleDownThreshold}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            scaling: { ...prev.scaling, scaleDownThreshold: parseInt(e.target.value) || 20 }
                          }))}
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="load-balancing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Load Balancing Strategy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Strategy</label>
                    <Select
                      value={config.loadBalancing.strategy}
                      onValueChange={(value: 'round-robin' | 'least-connections' | 'weighted' | 'hash') =>
                        setConfig(prev => ({
                          ...prev,
                          loadBalancing: { ...prev.loadBalancing, strategy: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="round-robin">Round Robin</SelectItem>
                        <SelectItem value="least-connections">Least Connections</SelectItem>
                        <SelectItem value="weighted">Weighted</SelectItem>
                        <SelectItem value="hash">Hash-based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.loadBalancing.healthCheck.enabled}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        loadBalancing: {
                          ...prev.loadBalancing,
                          healthCheck: { ...prev.loadBalancing.healthCheck, enabled: e.target.checked }
                        }
                      }))}
                      className="rounded"
                    />
                    <label className="text-sm font-medium">Enable Health Checks</label>
                  </div>

                  {config.loadBalancing.healthCheck.enabled && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">Interval (seconds)</label>
                        <Input
                          type="number"
                          value={config.loadBalancing.healthCheck.interval}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            loadBalancing: {
                              ...prev.loadBalancing,
                              healthCheck: { ...prev.loadBalancing.healthCheck, interval: parseInt(e.target.value) || 30 }
                            }
                          }))}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Timeout (seconds)</label>
                        <Input
                          type="number"
                          value={config.loadBalancing.healthCheck.timeout}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            loadBalancing: {
                              ...prev.loadBalancing,
                              healthCheck: { ...prev.loadBalancing.healthCheck, timeout: parseInt(e.target.value) || 5 }
                            }
                          }))}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Retries</label>
                        <Input
                          type="number"
                          value={config.loadBalancing.healthCheck.retries}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            loadBalancing: {
                              ...prev.loadBalancing,
                              healthCheck: { ...prev.loadBalancing.healthCheck, retries: parseInt(e.target.value) || 3 }
                            }
                          }))}
                          min="0"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orchestration" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Task Orchestration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Task Timeout (seconds)</label>
                      <Input
                        type="number"
                        value={config.orchestration.taskTimeout}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          orchestration: { ...prev.orchestration, taskTimeout: parseInt(e.target.value) || 300 }
                        }))}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Retries</label>
                      <Input
                        type="number"
                        value={config.orchestration.maxRetries}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          orchestration: { ...prev.orchestration, maxRetries: parseInt(e.target.value) || 3 }
                        }))}
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Failure Strategy</label>
                    <Select
                      value={config.orchestration.failureStrategy}
                      onValueChange={(value: 'retry' | 'skip' | 'abort') =>
                        setConfig(prev => ({
                          ...prev,
                          orchestration: { ...prev.orchestration, failureStrategy: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retry">Retry Failed Tasks</SelectItem>
                        <SelectItem value="skip">Skip Failed Tasks</SelectItem>
                        <SelectItem value="abort">Abort on Failure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.orchestration.dependencies}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          orchestration: { ...prev.orchestration, dependencies: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      <label className="text-sm font-medium">Enable Task Dependencies</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.orchestration.pipeline}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          orchestration: { ...prev.orchestration, pipeline: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      <label className="text-sm font-medium">Enable Pipeline Mode</label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resources" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resource Allocation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">CPU</label>
                      <Select
                        value={config.resources.cpu}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          resources: { ...prev.resources, cpu: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shared-cpu-1x">Shared CPU 1x</SelectItem>
                          <SelectItem value="shared-cpu-2x">Shared CPU 2x</SelectItem>
                          <SelectItem value="shared-cpu-4x">Shared CPU 4x</SelectItem>
                          <SelectItem value="performance-cpu-1x">Performance CPU 1x</SelectItem>
                          <SelectItem value="performance-cpu-2x">Performance CPU 2x</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Memory</label>
                      <Select
                        value={config.resources.memory}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          resources: { ...prev.resources, memory: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="512MB">512MB</SelectItem>
                          <SelectItem value="1GB">1GB</SelectItem>
                          <SelectItem value="2GB">2GB</SelectItem>
                          <SelectItem value="4GB">4GB</SelectItem>
                          <SelectItem value="8GB">8GB</SelectItem>
                          <SelectItem value="16GB">16GB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Storage</label>
                      <Select
                        value={config.resources.storage}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          resources: { ...prev.resources, storage: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1GB">1GB</SelectItem>
                          <SelectItem value="5GB">5GB</SelectItem>
                          <SelectItem value="10GB">10GB</SelectItem>
                          <SelectItem value="25GB">25GB</SelectItem>
                          <SelectItem value="50GB">50GB</SelectItem>
                          <SelectItem value="100GB">100GB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Network</label>
                      <Select
                        value={config.resources.network}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          resources: { ...prev.resources, network: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="high-performance">High Performance</SelectItem>
                          <SelectItem value="dedicated">Dedicated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center pt-6 border-t">
            <div className="text-sm text-gray-600">
              {config.agents.length} agents configured
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!config.name || !config.purpose || config.agents.length === 0}
              >
                Create Swarm
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SwarmCreateModal