'use client'

import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TreeView } from '@/components/ui/tree-view'
import { SwarmCRUD } from '@/components/swarm/swarm-crud'
import { MetadataPanel } from '@/components/swarm/metadata-panel'
import { SwarmCreateModal } from '@/components/swarm/swarm-create-modal'
import { SwarmScalingControls } from '@/components/swarm/swarm-scaling-controls'
import { TaskOrchestrationControls } from '@/components/swarm/task-orchestration-controls'
import { LoadBalancingControls } from '@/components/swarm/load-balancing-controls'
import { RealTimeMonitoring } from '@/components/swarm/real-time-monitoring'
import { SwarmLifecycleControls } from '@/components/swarm/swarm-lifecycle-controls'
import { ResourceAllocationControls } from '@/components/swarm/resource-allocation-controls'
import { 
  Activity, 
  Server, 
  Users, 
  TrendingUp, 
  RefreshCw,
  Network,
  BarChart3,
  Settings,
  Eye,
  Plus,
  Zap,
  Target,
  Shield,
  Monitor,
  Archive,
  Cpu
} from 'lucide-react'

interface TreeNode {
  id: string
  name: string
  type: 'root' | 'swarm' | 'agent'
  status?: string
  metadata?: Record<string, any>
  children?: TreeNode[]
}

interface SwarmData {
  id: string
  name: string
  purpose: string
  status: string
  agents: any[]
  configuration?: any
  tags?: string[]
  createdAt: string
  lastUpdated: string
  metrics?: any
  metadata?: Record<string, any>
}

const statsData = {
  totalSwarms: 3,
  activeSwarms: 2,
  totalAgents: 8,
  activeTasks: 12
}

const mockTreeData: TreeNode = {
  id: 'root',
  name: 'Swarm Orchestrator',
  type: 'root',
  metadata: {
    totalSwarms: 3,
    activeSwarms: 2,
    totalAgents: 8
  },
  children: [
    {
      id: '1',
      name: 'fly-api-research-swarm',
      type: 'swarm',
      status: 'running',
      metadata: {
        purpose: 'Research Fly.io API capabilities',
        agentCount: 4,
        priority: 'high',
        tags: ['research', 'api', 'ui'],
        createdAt: '2025-07-11T16:00:00Z'
      },
      children: [
        {
          id: 'a1',
          name: 'api-researcher',
          type: 'agent',
          status: 'busy',
          metadata: {
            role: 'API Analysis',
            taskCount: 3,
            lastActivity: '2025-07-11T16:45:00Z'
          }
        },
        {
          id: 'a2',
          name: 'ui-designer',
          type: 'agent',
          status: 'idle',
          metadata: {
            role: 'UI Design',
            taskCount: 2,
            lastActivity: '2025-07-11T16:30:00Z'
          }
        },
        {
          id: 'a3',
          name: 'backend-engineer',
          type: 'agent',
          status: 'busy',
          metadata: {
            role: 'Backend Development',
            taskCount: 4,
            lastActivity: '2025-07-11T16:50:00Z'
          }
        },
        {
          id: 'a4',
          name: 'frontend-engineer',
          type: 'agent',
          status: 'busy',
          metadata: {
            role: 'Frontend Development',
            taskCount: 5,
            lastActivity: '2025-07-11T16:48:00Z'
          }
        }
      ]
    },
    {
      id: '2',
      name: 'data-processing-swarm',
      type: 'swarm',
      status: 'scaling',
      metadata: {
        purpose: 'Process large datasets',
        agentCount: 3,
        priority: 'medium',
        tags: ['data', 'processing'],
        createdAt: '2025-07-11T15:00:00Z'
      },
      children: [
        {
          id: 'a5',
          name: 'data-processor-1',
          type: 'agent',
          status: 'busy',
          metadata: {
            role: 'Data Processing',
            taskCount: 2,
            lastActivity: '2025-07-11T16:40:00Z'
          }
        },
        {
          id: 'a6',
          name: 'data-processor-2',
          type: 'agent',
          status: 'busy',
          metadata: {
            role: 'Data Processing',
            taskCount: 2,
            lastActivity: '2025-07-11T16:42:00Z'
          }
        },
        {
          id: 'a7',
          name: 'data-validator',
          type: 'agent',
          status: 'idle',
          metadata: {
            role: 'Data Validation',
            taskCount: 1,
            lastActivity: '2025-07-11T16:20:00Z'
          }
        }
      ]
    },
    {
      id: '3',
      name: 'monitoring-swarm',
      type: 'swarm',
      status: 'stopped',
      metadata: {
        purpose: 'System monitoring and alerts',
        agentCount: 1,
        priority: 'low',
        tags: ['monitoring', 'alerts'],
        createdAt: '2025-07-11T14:00:00Z'
      },
      children: [
        {
          id: 'a8',
          name: 'system-monitor',
          type: 'agent',
          status: 'offline',
          metadata: {
            role: 'System Monitoring',
            taskCount: 0,
            lastActivity: '2025-07-11T15:30:00Z'
          }
        }
      ]
    }
  ]
}

export default function EnhancedDashboard() {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [selectedSwarm, setSelectedSwarm] = useState<SwarmData | null>(null)
  const [treeData, setTreeData] = useState<TreeNode>(mockTreeData)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node)
    
    // If it's a swarm node, prepare swarm data for metadata panel
    if (node.type === 'swarm') {
      const swarmData: SwarmData = {
        id: node.id,
        name: node.name,
        purpose: node.metadata?.purpose || '',
        status: node.status || 'unknown',
        agents: node.children?.map(child => ({
          id: child.id,
          name: child.name,
          role: child.metadata?.role || '',
          status: child.status || 'unknown',
          tasks: Array.from({ length: child.metadata?.taskCount || 0 }, (_, i) => `Task ${i + 1}`),
          lastActivity: child.metadata?.lastActivity
        })) || [],
        configuration: {
          maxWorkers: 10,
          autoScale: true,
          priority: node.metadata?.priority || 'medium',
          timeout: 300,
          retries: 3,
          resources: {
            cpu: 'shared-cpu-1x',
            memory: '256MB',
            storage: '1GB'
          }
        },
        tags: node.metadata?.tags || [],
        createdAt: node.metadata?.createdAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        metrics: {
          tasksCompleted: Math.floor(Math.random() * 100),
          tasksActive: Math.floor(Math.random() * 10),
          tasksFailed: Math.floor(Math.random() * 5),
          uptime: Math.floor(Math.random() * 86400),
          avgResponseTime: Math.floor(Math.random() * 1000)
        }
      }
      setSelectedSwarm(swarmData)
    }
  }

  const handleSwarmSelect = (swarm: any) => {
    setSelectedSwarm(swarm)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between space-y-2">
          <div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Enhanced Swarm Dashboard</h2>
              <div className="flex space-x-4 mt-2">
                <a href="/" className="text-sm text-blue-600 hover:text-blue-800">Dashboard</a>
                <a href="/enhanced" className="text-sm text-blue-600 hover:text-blue-800">Enhanced</a>
                <a href="/machines" className="text-sm text-blue-600 hover:text-blue-800">Fly Machines</a>
              </div>
              <p className="text-muted-foreground mt-2">
                Advanced swarm orchestration with comprehensive management and monitoring
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="transition-all duration-200 hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Swarm
            </Button>
            <Button 
              variant="outline"
              onClick={handleRefresh} 
              disabled={refreshing}
              className="transition-all duration-200 hover:scale-105"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Swarms</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalSwarms}</div>
              <p className="text-xs text-muted-foreground">
                +2 from last week
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Swarms</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.activeSwarms}</div>
              <p className="text-xs text-muted-foreground">
                +1 from yesterday
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalAgents}</div>
              <p className="text-xs text-muted-foreground">
                +3 from last hour
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.activeTasks}</div>
              <p className="text-xs text-muted-foreground">
                +5 from last hour
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="overview" className="flex items-center">
              <Eye className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tree" className="flex items-center">
              <Network className="w-4 h-4 mr-2" />
              Tree View
            </TabsTrigger>
            <TabsTrigger value="scaling" className="flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              Scaling
            </TabsTrigger>
            <TabsTrigger value="orchestration" className="flex items-center">
              <Target className="w-4 h-4 mr-2" />
              Orchestration
            </TabsTrigger>
            <TabsTrigger value="load-balancing" className="flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Load Balancing
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center">
              <Monitor className="w-4 h-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="lifecycle" className="flex items-center">
              <Archive className="w-4 h-4 mr-2" />
              Lifecycle
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center">
              <Cpu className="w-4 h-4 mr-2" />
              Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>System Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">System Health</label>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full w-4/5"></div>
                          </div>
                          <span className="text-sm font-medium">85%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Resource Usage</label>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full w-3/5"></div>
                          </div>
                          <span className="text-sm font-medium">60%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">98.5%</div>
                        <div className="text-sm text-gray-600">Uptime</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">235ms</div>
                        <div className="text-sm text-gray-600">Avg Response</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">1.2K</div>
                        <div className="text-sm text-gray-600">Tasks/Hour</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1 text-sm">
                        <div className="font-medium">Swarm Created</div>
                        <div className="text-gray-500">fly-api-research-swarm</div>
                      </div>
                      <div className="text-xs text-gray-500">2m ago</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1 text-sm">
                        <div className="font-medium">Agent Scaled</div>
                        <div className="text-gray-500">data-processing-swarm</div>
                      </div>
                      <div className="text-xs text-gray-500">5m ago</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <div className="flex-1 text-sm">
                        <div className="font-medium">Task Completed</div>
                        <div className="text-gray-500">API documentation</div>
                      </div>
                      <div className="text-xs text-gray-500">8m ago</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tree" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Swarm Hierarchy</CardTitle>
                </CardHeader>
                <CardContent>
                  <TreeView
                    data={treeData}
                    onNodeSelect={handleNodeSelect}
                    onNodeExpand={(node, expanded) => {
                      console.log(`Node ${node.name} ${expanded ? 'expanded' : 'collapsed'}`)
                    }}
                  />
                </CardContent>
              </Card>
              
              {selectedNode && (
                <Card>
                  <CardHeader>
                    <CardTitle>Selected Node</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Name</label>
                        <p className="font-semibold">{selectedNode.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Type</label>
                        <Badge variant="outline">{selectedNode.type}</Badge>
                      </div>
                      {selectedNode.status && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Status</label>
                          <Badge className={
                            selectedNode.status === 'running' ? 'bg-green-100 text-green-800' :
                            selectedNode.status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                            selectedNode.status === 'idle' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {selectedNode.status}
                          </Badge>
                        </div>
                      )}
                      {selectedNode.metadata && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 mb-2 block">Metadata</label>
                          <div className="bg-gray-50 p-3 rounded-md text-xs">
                            <pre>{JSON.stringify(selectedNode.metadata, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="scaling" className="space-y-4">
            <SwarmScalingControls 
              swarm={{
                swarmId: "1",
                name: "fly-api-research-swarm",
                currentAgents: 4,
                minAgents: 2,
                maxAgents: 10,
                targetAgents: 4,
                autoScalingEnabled: true,
                scaleUpThreshold: 80,
                scaleDownThreshold: 20,
                currentLoad: 65,
                pendingScaling: false,
                scalingHistory: [
                  {
                    timestamp: new Date().toISOString(),
                    action: 'scale_up',
                    fromAgents: 3,
                    toAgents: 4,
                    reason: 'High load detected (85%)',
                    success: true
                  }
                ],
                metrics: {
                  cpu: 65,
                  memory: 72,
                  tasks: { active: 12, completed: 45, failed: 2, queued: 3 },
                  throughput: 25,
                  responseTime: 240
                }
              }}
              onScaleUp={() => {}}
              onScaleDown={() => {}}
              onToggleAutoScaling={() => {}}
              onUpdateScalingThresholds={() => {}}
              onSetTargetAgents={() => {}}
              onForceRebalance={() => {}}
            />
          </TabsContent>

          <TabsContent value="orchestration" className="space-y-4">
            <TaskOrchestrationControls 
              swarm={{
                swarmId: "1",
                swarmName: "fly-api-research-swarm",
                tasks: [
                  {
                    id: "task1",
                    name: "API Documentation Analysis",
                    type: "api-call",
                    status: "running",
                    priority: "high",
                    progress: 65,
                    startTime: new Date().toISOString(),
                    assignedAgent: "api-researcher",
                    retryCount: 0,
                    maxRetries: 3,
                    dependencies: [],
                    metadata: {},
                    queuePosition: 1
                  }
                ],
                pipelines: [],
                dependencies: [],
                metrics: {
                  totalTasks: 50,
                  activeTasks: 12,
                  completedTasks: 35,
                  failedTasks: 3,
                  avgExecutionTime: 180,
                  successRate: 92.5,
                  throughput: 25,
                  queueLength: 3,
                  pipelines: { active: 2, completed: 8, failed: 0 }
                },
                queueConfig: {
                  maxConcurrent: 5,
                  priorityWeights: { critical: 4, high: 3, medium: 2, low: 1 },
                  retryDelay: 30,
                  timeouts: { "api-call": 300, "data-processing": 600 }
                }
              }}
              onStartTask={() => {}}
              onPauseTask={() => {}}
              onCancelTask={() => {}}
              onRetryTask={() => {}}
              onCreatePipeline={() => {}}
              onStartPipeline={() => {}}
              onPausePipeline={() => {}}
              onUpdateQueueConfig={() => {}}
              onReorderTasks={() => {}}
            />
          </TabsContent>

          <TabsContent value="load-balancing" className="space-y-4">
            <LoadBalancingControls 
              swarm={{
                swarmId: "1",
                swarmName: "fly-api-research-swarm",
                agents: [
                  {
                    id: "a1",
                    name: "api-researcher",
                    status: "healthy",
                    load: 65,
                    connections: 15,
                    responseTime: 240,
                    successRate: 98.5,
                    weight: 1.0,
                    region: "us-east",
                    cpu: 65,
                    memory: 72,
                    lastHealthCheck: new Date().toISOString(),
                    healthChecks: { total: 100, passed: 98, failed: 2, consecutive_failures: 0 }
                  }
                ],
                config: {
                  strategy: "round-robin",
                  healthCheck: {
                    enabled: true,
                    path: "/health",
                    interval: 30,
                    timeout: 5,
                    retries: 3,
                    healthyThreshold: 2,
                    unhealthyThreshold: 3
                  },
                  stickySession: {
                    enabled: false,
                    cookieName: "swarm_session",
                    duration: 60
                  },
                  circuitBreaker: {
                    enabled: true,
                    failureThreshold: 5,
                    recoveryTimeout: 60,
                    halfOpenMax: 3
                  },
                  weights: {},
                  rules: []
                },
                metrics: {
                  totalRequests: 1250,
                  requestsPerSecond: 25,
                  avgResponseTime: 240,
                  successRate: 98.5,
                  activeConnections: 45,
                  distribution: { "a1": 400, "a2": 380, "a3": 470 },
                  errors: { total: 18, rate: 1.5, types: { "timeout": 12, "503": 6 } }
                },
                alertThresholds: {
                  responseTime: 1000,
                  errorRate: 5,
                  connectionLimit: 100
                }
              }}
              onUpdateStrategy={() => {}}
              onUpdateHealthCheck={() => {}}
              onUpdateWeights={() => {}}
              onToggleAgent={() => {}}
              onDrainAgent={() => {}}
              onTestHealthCheck={() => {}}
              onUpdateRule={() => {}}
              onToggleCircuitBreaker={() => {}}
              onRebalance={() => {}}
            />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <RealTimeMonitoring 
              swarm={{
                swarmId: "1",
                swarmName: "fly-api-research-swarm",
                agents: [
                  {
                    id: "a1",
                    name: "api-researcher",
                    status: "online",
                    cpu: [{ timestamp: new Date().toISOString(), value: 65 }],
                    memory: [{ timestamp: new Date().toISOString(), value: 72 }],
                    network: [{ timestamp: new Date().toISOString(), value: 2.5 }],
                    disk: [{ timestamp: new Date().toISOString(), value: 45 }],
                    tasks: { active: 3, completed: 15, failed: 1, queued: 2 },
                    uptime: 86400,
                    lastSeen: new Date().toISOString(),
                    region: "us-east",
                    version: "1.0.0",
                    alerts: []
                  }
                ],
                swarmMetrics: {
                  totalAgents: 4,
                  activeAgents: 4,
                  totalTasks: 50,
                  completedTasks: 35,
                  failedTasks: 3,
                  avgResponseTime: 240,
                  throughput: 25,
                  errorRate: 1.5,
                  loadDistribution: {},
                  systemHealth: 92
                },
                alerts: [],
                logs: [
                  {
                    id: "log1",
                    timestamp: new Date().toISOString(),
                    level: "info",
                    source: "api-researcher",
                    message: "Task completed successfully"
                  }
                ],
                isConnected: true,
                lastUpdate: new Date().toISOString()
              }}
              onPauseMonitoring={() => {}}
              onResumeMonitoring={() => {}}
              onAcknowledgeAlert={() => {}}
              onExportLogs={() => {}}
              onUpdateAlertThresholds={() => {}}
            />
          </TabsContent>

          <TabsContent value="lifecycle" className="space-y-4">
            <SwarmLifecycleControls 
              swarm={{
                swarmId: "1",
                swarmName: "fly-api-research-swarm",
                status: "running",
                uptime: 86400,
                lastAction: "Agent scaled up",
                lastActionTime: new Date().toISOString(),
                snapshots: [
                  {
                    id: "snap1",
                    name: "pre-scaling-snapshot",
                    timestamp: new Date().toISOString(),
                    version: "1.0.0",
                    size: "2.5GB",
                    agentCount: 3,
                    status: "ready",
                    metadata: {
                      creator: "admin",
                      description: "Before scaling operation",
                      tags: ["scaling", "backup"]
                    }
                  }
                ],
                backups: [],
                migrations: [],
                schedules: {
                  autoBackup: {
                    enabled: true,
                    frequency: "daily",
                    retention: 30,
                    time: "02:00"
                  },
                  autoSnapshot: {
                    enabled: true,
                    frequency: "hourly",
                    retention: 24
                  },
                  maintenance: {
                    enabled: false,
                    schedule: "0 2 * * 0",
                    duration: 60,
                    autoApprove: false
                  }
                },
                permissions: {
                  canStart: true,
                  canStop: true,
                  canDelete: true,
                  canBackup: true,
                  canRestore: true,
                  canMigrate: true
                }
              }}
              onStart={() => {}}
              onStop={() => {}}
              onRestart={() => {}}
              onDelete={() => {}}
              onCreateSnapshot={() => {}}
              onRestoreSnapshot={() => {}}
              onDeleteSnapshot={() => {}}
              onCreateBackup={() => {}}
              onRestoreBackup={() => {}}
              onDeleteBackup={() => {}}
              onStartMigration={() => {}}
              onCloneSwarm={() => {}}
              onUpdateSchedules={() => {}}
              onEnterMaintenance={() => {}}
              onExitMaintenance={() => {}}
            />
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <ResourceAllocationControls 
              swarm={{
                swarmId: "1",
                swarmName: "fly-api-research-swarm",
                agents: [
                  {
                    id: "a1",
                    name: "api-researcher",
                    region: "us-east",
                    status: "online",
                    quotas: {
                      cpu: { allocated: 2, used: 1.3, limit: 2, unit: "cores" },
                      memory: { allocated: 2048, used: 1474, limit: 2048, unit: "MB" },
                      storage: { allocated: 10, used: 4.5, limit: 10, unit: "GB" },
                      network: { allocated: 100, used: 25, limit: 100, unit: "Mbps" }
                    },
                    cost: { hourly: 0.15, monthly: 108, currency: "USD" },
                    efficiency: 85,
                    recommendations: ["Consider upgrading to performance CPU", "Optimize memory usage"],
                    lastOptimized: new Date().toISOString()
                  }
                ],
                pools: [],
                costAnalysis: {
                  totalCost: { daily: 3.6, monthly: 108, projected: 120 },
                  breakdown: { compute: 90, storage: 12, network: 6, other: 0 },
                  trends: { period: "7 days", change: -5.2, direction: "down" },
                  recommendations: { potential_savings: 25, actions: ["Use spot instances", "Optimize resource allocation"] }
                },
                globalLimits: {
                  cpu: { allocated: 0, used: 0, limit: 50, unit: "cores" },
                  memory: { allocated: 0, used: 0, limit: 100, unit: "GB" },
                  storage: { allocated: 0, used: 0, limit: 500, unit: "GB" },
                  network: { allocated: 0, used: 0, limit: 1000, unit: "Mbps" }
                },
                optimization: {
                  enabled: true,
                  strategy: "balanced",
                  schedule: "0 2 * * *",
                  lastRun: new Date().toISOString(),
                  nextRun: new Date(Date.now() + 86400000).toISOString()
                },
                alerts: {
                  thresholds: { cpu: 80, memory: 80, storage: 80, cost: 150 },
                  notifications: true
                }
              }}
              onUpdateAgentQuota={() => {}}
              onOptimizeResources={() => {}}
              onCreatePool={() => {}}
              onUpdatePool={() => {}}
              onDeletePool={() => {}}
              onMoveAgentToPool={() => {}}
              onUpdateGlobalLimits={() => {}}
              onUpdateAlertThresholds={() => {}}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Swarm Modal */}
      <SwarmCreateModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(config) => {
          console.log('Creating swarm with config:', config)
          setShowCreateModal(false)
        }}
      />
    </div>
  )
}