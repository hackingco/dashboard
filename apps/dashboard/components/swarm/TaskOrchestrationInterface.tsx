'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import {
  Play,
  Pause,
  Square,
  Plus,
  Clock,
  Target,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Filter,
  ArrowRight,
  GitBranch,
  Zap,
  Settings,
  Download,
  Upload,
  Edit,
  Trash2,
  Copy
} from 'lucide-react'

interface TaskOrchestrationInterfaceProps {
  traces: any[]
  agents: any[]
  swarmId: string
  sessionId: string
  onAddTrace: (trace: any) => Promise<any>
  onRecordMetric: (metric: any) => Promise<any>
}

interface Task {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedAgent?: string
  dependencies: string[]
  estimatedDuration: number
  actualDuration?: number
  progress: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  result?: any
  error?: string
  metadata: Record<string, any>
}

interface Workflow {
  id: string
  name: string
  description: string
  tasks: Task[]
  status: 'draft' | 'running' | 'completed' | 'failed' | 'paused'
  progress: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export const TaskOrchestrationInterface: React.FC<TaskOrchestrationInterfaceProps> = ({
  traces,
  agents,
  swarmId,
  sessionId,
  onAddTrace,
  onRecordMetric
}) => {
  const [activeTab, setActiveTab] = useState('tasks')
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Mock tasks data - in real implementation, this would come from your task management system
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'task-1',
      name: 'Data Processing Pipeline',
      description: 'Process incoming data stream and apply ML transformations',
      status: 'running',
      priority: 'high',
      assignedAgent: agents[0]?.id,
      dependencies: [],
      estimatedDuration: 300000, // 5 minutes
      actualDuration: 180000, // 3 minutes so far
      progress: 60,
      createdAt: new Date(Date.now() - 600000),
      startedAt: new Date(Date.now() - 180000),
      metadata: { type: 'data_processing', category: 'ml' }
    },
    {
      id: 'task-2',
      name: 'Model Training',
      description: 'Train neural network on processed dataset',
      status: 'pending',
      priority: 'medium',
      dependencies: ['task-1'],
      estimatedDuration: 1800000, // 30 minutes
      progress: 0,
      createdAt: new Date(Date.now() - 300000),
      metadata: { type: 'ml_training', category: 'ml' }
    },
    {
      id: 'task-3',
      name: 'API Health Check',
      description: 'Verify all external API endpoints are responsive',
      status: 'completed',
      priority: 'low',
      assignedAgent: agents[1]?.id,
      dependencies: [],
      estimatedDuration: 60000, // 1 minute
      actualDuration: 45000,
      progress: 100,
      createdAt: new Date(Date.now() - 900000),
      startedAt: new Date(Date.now() - 600000),
      completedAt: new Date(Date.now() - 555000),
      result: { status: 'all_healthy', endpoints: 5 },
      metadata: { type: 'health_check', category: 'monitoring' }
    },
    {
      id: 'task-4',
      name: 'Database Optimization',
      description: 'Optimize database queries and rebuild indexes',
      status: 'failed',
      priority: 'medium',
      assignedAgent: agents[2]?.id,
      dependencies: [],
      estimatedDuration: 600000, // 10 minutes
      actualDuration: 300000,
      progress: 45,
      createdAt: new Date(Date.now() - 1200000),
      startedAt: new Date(Date.now() - 900000),
      error: 'Lock timeout exceeded',
      metadata: { type: 'database', category: 'optimization' }
    }
  ])

  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: 'workflow-1',
      name: 'ML Pipeline',
      description: 'Complete machine learning data processing and training pipeline',
      tasks: tasks.slice(0, 2),
      status: 'running',
      progress: 30,
      createdAt: new Date(Date.now() - 600000),
      startedAt: new Date(Date.now() - 180000)
    }
  ])

  const [newTask, setNewTask] = useState<Partial<Task>>({
    name: '',
    description: '',
    priority: 'medium',
    estimatedDuration: 300000,
    dependencies: [],
    metadata: {}
  })

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority
      
      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [tasks, searchTerm, filterStatus, filterPriority])

  // Task execution metrics
  const taskMetrics = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter(t => t.status === 'completed').length
    const running = tasks.filter(t => t.status === 'running').length
    const failed = tasks.filter(t => t.status === 'failed').length
    const pending = tasks.filter(t => t.status === 'pending').length
    
    const avgDuration = tasks
      .filter(t => t.actualDuration)
      .reduce((sum, t) => sum + (t.actualDuration || 0), 0) / Math.max(1, tasks.filter(t => t.actualDuration).length)
    
    const successRate = total > 0 ? (completed / total) * 100 : 0

    return {
      total,
      completed,
      running,
      failed,
      pending,
      avgDuration: Math.round(avgDuration / 1000), // Convert to seconds
      successRate: Number(successRate.toFixed(1))
    }
  }, [tasks])

  // Generate execution timeline data
  const timelineData = useMemo(() => {
    const now = Date.now()
    return Array.from({ length: 12 }, (_, i) => {
      const time = new Date(now - (11 - i) * 5 * 60 * 1000)
      const completedAtTime = tasks.filter(t => 
        t.completedAt && 
        Math.abs(t.completedAt.getTime() - time.getTime()) < 5 * 60 * 1000
      ).length
      
      return {
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        completed: completedAtTime,
        running: tasks.filter(t => t.status === 'running').length,
        failed: tasks.filter(t => t.status === 'failed').length
      }
    })
  }, [tasks])

  const handleCreateTask = async () => {
    if (!newTask.name || !newTask.description) return

    const task: Task = {
      id: `task-${Date.now()}`,
      name: newTask.name!,
      description: newTask.description!,
      status: 'pending',
      priority: newTask.priority || 'medium',
      dependencies: newTask.dependencies || [],
      estimatedDuration: newTask.estimatedDuration || 300000,
      progress: 0,
      createdAt: new Date(),
      metadata: newTask.metadata || {}
    }

    setTasks(prev => [...prev, task])

    // Record task creation in Supabase
    try {
      await onAddTrace({
        session_id: sessionId,
        trace_name: `Task Created: ${task.name}`,
        trace_data: { task, action: 'create' },
        status: 'success',
        duration_ms: 0,
        metadata: { type: 'task_creation', taskId: task.id }
      })

      await onRecordMetric({
        session_id: sessionId,
        metric_type: 'task_created',
        metric_value: 1,
        metric_data: { taskId: task.id, priority: task.priority },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error recording task creation:', error)
    }

    setNewTask({
      name: '',
      description: '',
      priority: 'medium',
      estimatedDuration: 300000,
      dependencies: [],
      metadata: {}
    })
    setShowCreateTask(false)
  }

  const handleTaskAction = async (taskId: string, action: 'start' | 'pause' | 'cancel' | 'retry') => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    let newStatus: Task['status']
    let updates: Partial<Task> = {}

    switch (action) {
      case 'start':
        newStatus = 'running'
        updates = { startedAt: new Date(), assignedAgent: agents[0]?.id }
        break
      case 'pause':
        newStatus = 'pending'
        break
      case 'cancel':
        newStatus = 'cancelled'
        break
      case 'retry':
        newStatus = 'pending'
        updates = { error: undefined, progress: 0 }
        break
      default:
        return
    }

    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: newStatus, ...updates }
        : t
    ))

    // Record action in Supabase
    try {
      await onAddTrace({
        session_id: sessionId,
        trace_name: `Task ${action}: ${task.name}`,
        trace_data: { taskId, action, previousStatus: task.status },
        status: 'success',
        duration_ms: 100,
        metadata: { type: 'task_action', taskId, action }
      })
    } catch (error) {
      console.error('Error recording task action:', error)
    }
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'running':
        return <Play className="w-4 h-4 text-blue-500" />
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'failed': return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Task Orchestration</h2>
          <p className="text-gray-600">Manage and monitor task execution across the swarm</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Task Name</label>
                  <Input
                    value={newTask.name || ''}
                    onChange={(e) => setNewTask(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter task name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Textarea
                    value={newTask.description || ''}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this task does"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value: Task['priority']) => setNewTask(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estimated Duration (minutes)</label>
                    <Input
                      type="number"
                      value={Math.round((newTask.estimatedDuration || 300000) / 60000)}
                      onChange={(e) => setNewTask(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) * 60000 }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateTask(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTask}>
                    Create Task
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold">{taskMetrics.total}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Running</p>
                <p className="text-2xl font-bold">{taskMetrics.running}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">{taskMetrics.successRate}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold">{taskMetrics.avgDuration}s</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execution Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Task Execution Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="completed" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.7} name="Completed" />
              <Area type="monotone" dataKey="running" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.7} name="Running" />
              <Area type="monotone" dataKey="failed" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.7} name="Failed" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search tasks..."
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-sm text-gray-600">
                  {filteredTasks.length} of {tasks.length} tasks
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <Card 
                key={task.id} 
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedTask === task.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium truncate">{task.name}</h3>
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{task.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Progress */}
                      {task.status === 'running' && (
                        <div className="w-24">
                          <Progress value={task.progress} className="h-2" />
                          <p className="text-xs text-gray-500 mt-1">{task.progress}%</p>
                        </div>
                      )}

                      {/* Duration */}
                      <div className="text-right text-sm">
                        {task.actualDuration ? (
                          <p className="text-gray-900">{formatDuration(task.actualDuration)}</p>
                        ) : (
                          <p className="text-gray-500">~{formatDuration(task.estimatedDuration)}</p>
                        )}
                        {task.assignedAgent && (
                          <p className="text-xs text-gray-500">
                            {agents.find(a => a.id === task.assignedAgent)?.name || 'Unknown Agent'}
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                        {task.status}
                      </Badge>

                      {/* Actions */}
                      <div className="flex space-x-1">
                        {task.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskAction(task.id, 'start')
                            }}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        )}
                        {task.status === 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskAction(task.id, 'pause')
                            }}
                          >
                            <Pause className="w-3 h-3" />
                          </Button>
                        )}
                        {task.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskAction(task.id, 'retry')
                            }}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        )}
                        {(task.status === 'pending' || task.status === 'running') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTaskAction(task.id, 'cancel')
                            }}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dependencies */}
                  {task.dependencies.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center space-x-2">
                        <GitBranch className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Dependencies:</span>
                        <div className="flex space-x-1">
                          {task.dependencies.map(depId => {
                            const depTask = tasks.find(t => t.id === depId)
                            return (
                              <Badge key={depId} variant="outline" className="text-xs">
                                {depTask?.name || depId}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {selectedTask === task.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Created:</span>
                          <span className="ml-2">{task.createdAt.toLocaleString()}</span>
                        </div>
                        {task.startedAt && (
                          <div>
                            <span className="text-gray-600">Started:</span>
                            <span className="ml-2">{task.startedAt.toLocaleString()}</span>
                          </div>
                        )}
                        {task.completedAt && (
                          <div>
                            <span className="text-gray-600">Completed:</span>
                            <span className="ml-2">{task.completedAt.toLocaleString()}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Estimated Duration:</span>
                          <span className="ml-2">{formatDuration(task.estimatedDuration)}</span>
                        </div>
                      </div>

                      {task.error && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm text-red-800">{task.error}</p>
                        </div>
                      )}

                      {task.result && (
                        <div className="p-2 bg-green-50 border border-green-200 rounded">
                          <pre className="text-sm text-green-800 overflow-auto">
                            {JSON.stringify(task.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workflows">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Workflows</CardTitle>
                <Button onClick={() => setShowCreateWorkflow(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workflow
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                Workflow management interface coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Task Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" fill="#10B981" name="Completed" />
                    <Bar dataKey="failed" fill="#EF4444" name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agents.slice(0, 5).map(agent => {
                    const assignedTasks = tasks.filter(t => t.assignedAgent === agent.id && t.status === 'running').length
                    const utilization = Math.min(100, assignedTasks * 25)
                    
                    return (
                      <div key={agent.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{agent.name}</span>
                          <span>{utilization}%</span>
                        </div>
                        <Progress value={utilization} />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}