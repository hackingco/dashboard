'use client'

import React, { useState } from 'react'
import { Play, Pause, Square, RotateCcw, Clock, AlertTriangle, CheckCircle, XCircle, ArrowRight, GitBranch, Layers, Zap, Target, Settings, Filter, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface TaskDependency {
  id: string
  taskId: string
  dependsOn: string[]
  status: 'waiting' | 'ready' | 'running' | 'completed' | 'failed'
}

interface Task {
  id: string
  name: string
  type: 'api-call' | 'data-processing' | 'file-operation' | 'computation' | 'notification'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  progress: number
  startTime?: string
  endTime?: string
  duration?: number
  assignedAgent?: string
  retryCount: number
  maxRetries: number
  dependencies: string[]
  metadata: Record<string, any>
  pipeline?: string
  queuePosition?: number
}

interface Pipeline {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  tasks: string[]
  parallelStages: string[][]
  currentStage: number
  progress: number
  strategy: 'sequential' | 'parallel' | 'mixed'
  failureAction: 'abort' | 'continue' | 'retry-stage'
}

interface OrchestrationMetrics {
  totalTasks: number
  activeTasks: number
  completedTasks: number
  failedTasks: number
  avgExecutionTime: number
  successRate: number
  throughput: number
  queueLength: number
  pipelines: {
    active: number
    completed: number
    failed: number
  }
}

interface TaskOrchestrationData {
  swarmId: string
  swarmName: string
  tasks: Task[]
  pipelines: Pipeline[]
  dependencies: TaskDependency[]
  metrics: OrchestrationMetrics
  queueConfig: {
    maxConcurrent: number
    priorityWeights: Record<string, number>
    retryDelay: number
    timeouts: Record<string, number>
  }
}

interface TaskOrchestrationControlsProps {
  swarm: TaskOrchestrationData
  onStartTask: (taskId: string) => void
  onPauseTask: (taskId: string) => void
  onCancelTask: (taskId: string) => void
  onRetryTask: (taskId: string) => void
  onCreatePipeline: (tasks: string[], strategy: string) => void
  onStartPipeline: (pipelineId: string) => void
  onPausePipeline: (pipelineId: string) => void
  onUpdateQueueConfig: (config: any) => void
  onReorderTasks: (taskIds: string[]) => void
}

export const TaskOrchestrationControls: React.FC<TaskOrchestrationControlsProps> = ({
  swarm,
  onStartTask,
  onPauseTask,
  onCancelTask,
  onRetryTask,
  onCreatePipeline,
  onStartPipeline,
  onPausePipeline,
  onUpdateQueueConfig,
  onReorderTasks
}) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(new Set())
  const [newPipelineStrategy, setNewPipelineStrategy] = useState<'sequential' | 'parallel' | 'mixed'>('sequential')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': case 'active': return 'text-blue-600 bg-blue-50'
      case 'completed': return 'text-green-600 bg-green-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'paused': return 'text-yellow-600 bg-yellow-50'
      case 'pending': return 'text-gray-600 bg-gray-50'
      case 'cancelled': return 'text-red-400 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': case 'active': return <Play className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'paused': return <Pause className="w-4 h-4" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'cancelled': return <Square className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredTasks = swarm.tasks.filter(task => {
    if (filter === 'all') return true
    return task.status === filter
  })

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const createPipelineFromSelected = () => {
    if (selectedTasks.length > 1) {
      onCreatePipeline(selectedTasks, newPipelineStrategy)
      setSelectedTasks([])
    }
  }

  const togglePipelineExpansion = (pipelineId: string) => {
    setExpandedPipelines(prev => {
      const newSet = new Set(prev)
      if (newSet.has(pipelineId)) {
        newSet.delete(pipelineId)
      } else {
        newSet.add(pipelineId)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-6">
      {/* Orchestration Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Task Orchestration - {swarm.swarmName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{swarm.metrics.activeTasks}</div>
              <div className="text-sm text-gray-600">Active Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{swarm.metrics.completedTasks}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{swarm.metrics.failedTasks}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{swarm.metrics.queueLength}</div>
              <div className="text-sm text-gray-600">Queued</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-bold">{swarm.metrics.successRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-bold">{swarm.metrics.throughput}</div>
              <div className="text-sm text-gray-600">Tasks/Min</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-bold">{swarm.metrics.avgExecutionTime}s</div>
              <div className="text-sm text-gray-600">Avg Duration</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tasks" className="flex items-center">
            <Layers className="w-4 h-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="flex items-center">
            <GitBranch className="w-4 h-4 mr-2" />
            Pipelines
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="flex items-center">
            <ArrowRight className="w-4 h-4 mr-2" />
            Dependencies
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center">
            <Settings className="w-4 h-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Task Management</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tasks</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedTasks.length > 1 && (
                    <div className="flex items-center space-x-2">
                      <Select value={newPipelineStrategy} onValueChange={(value: 'sequential' | 'parallel' | 'mixed') => setNewPipelineStrategy(value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sequential">Sequential</SelectItem>
                          <SelectItem value="parallel">Parallel</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={createPipelineFromSelected} size="sm">
                        <GitBranch className="w-4 h-4 mr-2" />
                        Create Pipeline
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <div key={task.id} className="p-4 border rounded-lg transition-all duration-200 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={() => toggleTaskSelection(task.id)}
                          className="rounded"
                        />
                        <div className="flex items-center space-x-2">
                          <div className={`p-1 rounded ${getStatusColor(task.status)}`}>
                            {getStatusIcon(task.status)}
                          </div>
                          <div>
                            <div className="font-medium">{task.name}</div>
                            <div className="text-sm text-gray-600">{task.type.replace('-', ' ')}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        
                        {task.assignedAgent && (
                          <Badge variant="outline">
                            {task.assignedAgent}
                          </Badge>
                        )}

                        <div className="text-right text-sm">
                          <div className="font-medium">{task.progress}%</div>
                          {task.queuePosition && (
                            <div className="text-gray-500">#{task.queuePosition}</div>
                          )}
                        </div>

                        <div className="flex space-x-1">
                          {task.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => onStartTask(task.id)}>
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          {task.status === 'running' && (
                            <Button size="sm" variant="outline" onClick={() => onPauseTask(task.id)}>
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {(task.status === 'failed' || task.status === 'paused') && (
                            <Button size="sm" variant="outline" onClick={() => onRetryTask(task.id)}>
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {(task.status === 'pending' || task.status === 'running') && (
                            <Button size="sm" variant="outline" onClick={() => onCancelTask(task.id)}>
                              <Square className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {task.progress > 0 && task.progress < 100 && (
                      <div className="mt-3">
                        <Progress value={task.progress} className="h-2" />
                      </div>
                    )}

                    {task.dependencies.length > 0 && (
                      <div className="mt-3 text-sm text-gray-600">
                        <span>Dependencies: </span>
                        {task.dependencies.map(dep => (
                          <Badge key={dep} variant="outline" className="mr-1">
                            {swarm.tasks.find(t => t.id === dep)?.name || dep}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {task.retryCount > 0 && (
                      <div className="mt-2 text-sm text-orange-600">
                        Retry {task.retryCount}/{task.maxRetries}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {swarm.pipelines.map(pipeline => (
                  <div key={pipeline.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePipelineExpansion(pipeline.id)}
                        >
                          {expandedPipelines.has(pipeline.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                        <div>
                          <div className="font-medium">{pipeline.name}</div>
                          <div className="text-sm text-gray-600">
                            {pipeline.strategy} • {pipeline.tasks.length} tasks
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(pipeline.status)}>
                          {pipeline.status}
                        </Badge>
                        
                        <div className="text-right text-sm">
                          <div className="font-medium">{pipeline.progress}%</div>
                          <div className="text-gray-500">Stage {pipeline.currentStage + 1}</div>
                        </div>

                        <div className="flex space-x-1">
                          {pipeline.status === 'active' && (
                            <Button size="sm" variant="outline" onClick={() => onPausePipeline(pipeline.id)}>
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {pipeline.status === 'paused' && (
                            <Button size="sm" variant="outline" onClick={() => onStartPipeline(pipeline.id)}>
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Progress value={pipeline.progress} className="h-2" />
                    </div>

                    {expandedPipelines.has(pipeline.id) && (
                      <div className="mt-4 space-y-3">
                        <div className="text-sm font-medium">Pipeline Tasks:</div>
                        <div className="grid gap-2">
                          {pipeline.parallelStages.map((stage, stageIndex) => (
                            <div key={stageIndex} className="flex items-center space-x-2">
                              <div className="text-xs text-gray-500 w-16">Stage {stageIndex + 1}:</div>
                              <div className="flex items-center space-x-2">
                                {stage.map((taskId, taskIndex) => {
                                  const task = swarm.tasks.find(t => t.id === taskId)
                                  return (
                                    <div key={taskId} className="flex items-center space-x-1">
                                      {taskIndex > 0 && pipeline.strategy === 'parallel' && (
                                        <span className="text-gray-400">||</span>
                                      )}
                                      {taskIndex > 0 && pipeline.strategy === 'sequential' && (
                                        <ArrowRight className="w-3 h-3 text-gray-400" />
                                      )}
                                      <Badge 
                                        variant="outline" 
                                        className={task ? getStatusColor(task.status) : ''}
                                      >
                                        {task?.name || taskId}
                                      </Badge>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {swarm.pipelines.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No pipelines configured. Select multiple tasks to create a pipeline.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Task Dependencies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {swarm.dependencies.map(dep => {
                  const task = swarm.tasks.find(t => t.id === dep.taskId)
                  const dependsOnTasks = dep.dependsOn.map(id => swarm.tasks.find(t => t.id === id))
                  
                  return (
                    <div key={dep.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-1 rounded ${getStatusColor(dep.status)}`}>
                            {getStatusIcon(dep.status)}
                          </div>
                          <div>
                            <div className="font-medium">{task?.name || dep.taskId}</div>
                            <div className="text-sm text-gray-600">
                              Depends on: {dependsOnTasks.map(t => t?.name || 'Unknown').join(', ')}
                            </div>
                          </div>
                        </div>
                        <Badge className={getStatusColor(dep.status)}>
                          {dep.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })}

                {swarm.dependencies.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No task dependencies configured.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Queue Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Max Concurrent Tasks</label>
                  <Input
                    type="number"
                    value={swarm.queueConfig.maxConcurrent}
                    onChange={(e) => onUpdateQueueConfig({
                      ...swarm.queueConfig,
                      maxConcurrent: parseInt(e.target.value) || 1
                    })}
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Retry Delay (seconds)</label>
                  <Input
                    type="number"
                    value={swarm.queueConfig.retryDelay}
                    onChange={(e) => onUpdateQueueConfig({
                      ...swarm.queueConfig,
                      retryDelay: parseInt(e.target.value) || 30
                    })}
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Priority Weights</label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {Object.entries(swarm.queueConfig.priorityWeights).map(([priority, weight]) => (
                    <div key={priority}>
                      <label className="text-xs text-gray-600 capitalize">{priority}</label>
                      <Input
                        type="number"
                        value={weight}
                        onChange={(e) => onUpdateQueueConfig({
                          ...swarm.queueConfig,
                          priorityWeights: {
                            ...swarm.queueConfig.priorityWeights,
                            [priority]: parseFloat(e.target.value) || 1
                          }
                        })}
                        min="0.1"
                        step="0.1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Task Type Timeouts (seconds)</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(swarm.queueConfig.timeouts).map(([type, timeout]) => (
                    <div key={type}>
                      <label className="text-xs text-gray-600">{type.replace('-', ' ')}</label>
                      <Input
                        type="number"
                        value={timeout}
                        onChange={(e) => onUpdateQueueConfig({
                          ...swarm.queueConfig,
                          timeouts: {
                            ...swarm.queueConfig.timeouts,
                            [type]: parseInt(e.target.value) || 300
                          }
                        })}
                        min="1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TaskOrchestrationControls