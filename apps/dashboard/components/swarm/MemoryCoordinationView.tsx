'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TreeMap, Cell } from 'recharts'
import {
  Brain,
  Database,
  Share2,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Clock,
  Users,
  Activity,
  BarChart3,
  Network,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Archive,
  Tag
} from 'lucide-react'

interface MemoryCoordinationViewProps {
  metrics: any[]
  traces: any[]
  swarmId: string
  sessionId: string
}

interface MemoryEntry {
  id: string
  key: string
  value: any
  type: 'coordination' | 'state' | 'knowledge' | 'decision' | 'context'
  namespace: string
  agentId?: string
  created: Date
  updated: Date
  accessCount: number
  size: number
  tags: string[]
  metadata: Record<string, any>
  expires?: Date
  shared: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface CoordinationChannel {
  id: string
  name: string
  type: 'broadcast' | 'direct' | 'group'
  participants: string[]
  messageCount: number
  lastActivity: Date
  active: boolean
}

interface KnowledgeGraph {
  nodes: {
    id: string
    label: string
    type: string
    value: number
    connections: number
  }[]
  links: {
    source: string
    target: string
    strength: number
    type: string
  }[]
}

export const MemoryCoordinationView: React.FC<MemoryCoordinationViewProps> = ({
  metrics,
  traces,
  swarmId,
  sessionId
}) => {
  const [activeTab, setActiveTab] = useState('memory')
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null)
  const [showCreateMemory, setShowCreateMemory] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterNamespace, setFilterNamespace] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('updated')

  // Mock memory data - in real implementation, this would come from your memory system
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([
    {
      id: 'mem-1',
      key: 'agent_coordination_state',
      value: {
        coordinatingAgents: ['agent-1', 'agent-2', 'agent-3'],
        currentTask: 'data_processing',
        synchronizationPoint: 'phase_2_complete',
        nextAction: 'model_training'
      },
      type: 'coordination',
      namespace: 'swarm/coordination',
      agentId: 'coordinator',
      created: new Date(Date.now() - 3600000),
      updated: new Date(Date.now() - 300000),
      accessCount: 15,
      size: 256,
      tags: ['coordination', 'state', 'active'],
      metadata: { version: '1.2', criticalPath: true },
      shared: true,
      priority: 'high'
    },
    {
      id: 'mem-2',
      key: 'model_training_progress',
      value: {
        epoch: 15,
        loss: 0.23,
        accuracy: 0.87,
        estimatedTimeRemaining: '45m',
        checkpointSaved: true
      },
      type: 'state',
      namespace: 'ml/training',
      agentId: 'trainer-agent',
      created: new Date(Date.now() - 7200000),
      updated: new Date(Date.now() - 60000),
      accessCount: 42,
      size: 128,
      tags: ['ml', 'training', 'progress'],
      metadata: { model: 'neural_net_v2', dataset: 'prod_data' },
      shared: false,
      priority: 'medium'
    },
    {
      id: 'mem-3',
      key: 'error_patterns_learned',
      value: {
        patterns: [
          { type: 'timeout', frequency: 12, mitigation: 'retry_with_backoff' },
          { type: 'memory_pressure', frequency: 8, mitigation: 'garbage_collect' },
          { type: 'network_partition', frequency: 3, mitigation: 'failover_to_backup' }
        ],
        confidence: 0.92,
        lastUpdated: new Date()
      },
      type: 'knowledge',
      namespace: 'learning/patterns',
      created: new Date(Date.now() - 86400000),
      updated: new Date(Date.now() - 1800000),
      accessCount: 28,
      size: 512,
      tags: ['learning', 'errors', 'patterns', 'mitigation'],
      metadata: { algorithm: 'pattern_recognition', confidence_threshold: 0.85 },
      shared: true,
      priority: 'high'
    },
    {
      id: 'mem-4',
      key: 'agent_performance_baseline',
      value: {
        averageResponseTime: 1250,
        throughput: 45.6,
        errorRate: 0.021,
        resourceUtilization: { cpu: 65, memory: 78, network: 23 },
        benchmark: 'week_2024_28'
      },
      type: 'context',
      namespace: 'metrics/baseline',
      created: new Date(Date.now() - 172800000),
      updated: new Date(Date.now() - 3600000),
      accessCount: 67,
      size: 192,
      tags: ['performance', 'baseline', 'metrics'],
      metadata: { period: '7d', samples: 1440 },
      shared: true,
      priority: 'medium'
    },
    {
      id: 'mem-5',
      key: 'deployment_decisions',
      value: {
        lastDeployment: {
          version: 'v2.1.0',
          strategy: 'blue_green',
          rollback: false,
          performance: 'improved'
        },
        nextDeployment: {
          scheduledFor: new Date(Date.now() + 86400000),
          version: 'v2.1.1',
          changes: ['bug_fixes', 'performance_improvements'],
          riskLevel: 'low'
        }
      },
      type: 'decision',
      namespace: 'deployment/strategy',
      created: new Date(Date.now() - 259200000),
      updated: new Date(Date.now() - 7200000),
      accessCount: 23,
      size: 320,
      tags: ['deployment', 'strategy', 'planning'],
      metadata: { approver: 'system', automated: true },
      shared: true,
      priority: 'critical'
    }
  ])

  const [coordinationChannels, setCoordinationChannels] = useState<CoordinationChannel[]>([
    {
      id: 'channel-1',
      name: 'Main Coordination',
      type: 'broadcast',
      participants: ['coordinator', 'agent-1', 'agent-2', 'agent-3'],
      messageCount: 156,
      lastActivity: new Date(Date.now() - 30000),
      active: true
    },
    {
      id: 'channel-2',
      name: 'ML Training Group',
      type: 'group',
      participants: ['trainer-agent', 'data-agent', 'validator-agent'],
      messageCount: 89,
      lastActivity: new Date(Date.now() - 120000),
      active: true
    },
    {
      id: 'channel-3',
      name: 'Error Handling',
      type: 'broadcast',
      participants: ['all'],
      messageCount: 34,
      lastActivity: new Date(Date.now() - 600000),
      active: false
    }
  ])

  const [newMemory, setNewMemory] = useState<Partial<MemoryEntry>>({
    key: '',
    value: '',
    type: 'state',
    namespace: 'swarm/general',
    tags: [],
    priority: 'medium',
    shared: false
  })

  // Filter and sort memory entries
  const filteredMemories = useMemo(() => {
    let filtered = memoryEntries.filter(memory => {
      const matchesSearch = memory.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           memory.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType = filterType === 'all' || memory.type === filterType
      const matchesNamespace = filterNamespace === 'all' || memory.namespace === filterNamespace
      
      return matchesSearch && matchesType && matchesNamespace
    })

    // Sort memories
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return b.updated.getTime() - a.updated.getTime()
        case 'created':
          return b.created.getTime() - a.created.getTime()
        case 'accessed':
          return b.accessCount - a.accessCount
        case 'size':
          return b.size - a.size
        case 'key':
          return a.key.localeCompare(b.key)
        default:
          return 0
      }
    })

    return filtered
  }, [memoryEntries, searchTerm, filterType, filterNamespace, sortBy])

  // Memory usage metrics
  const memoryMetrics = useMemo(() => {
    const totalEntries = memoryEntries.length
    const totalSize = memoryEntries.reduce((sum, entry) => sum + entry.size, 0)
    const sharedEntries = memoryEntries.filter(entry => entry.shared).length
    const criticalEntries = memoryEntries.filter(entry => entry.priority === 'critical').length
    const recentlyAccessed = memoryEntries.filter(entry => 
      Date.now() - entry.updated.getTime() < 3600000 // Last hour
    ).length

    const typeDistribution = memoryEntries.reduce((acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalEntries,
      totalSize: Math.round(totalSize / 1024), // Convert to KB
      sharedEntries,
      criticalEntries,
      recentlyAccessed,
      typeDistribution
    }
  }, [memoryEntries])

  // Generate access pattern data
  const accessPatternData = useMemo(() => {
    const now = Date.now()
    return Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now - (23 - i) * 60 * 60 * 1000)
      const accessCount = Math.floor(Math.random() * 20) + 5
      
      return {
        time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        reads: accessCount,
        writes: Math.floor(accessCount * 0.3),
        synchronizations: Math.floor(Math.random() * 5)
      }
    })
  }, [])

  // Generate knowledge graph data
  const knowledgeGraph: KnowledgeGraph = useMemo(() => {
    const nodes = memoryEntries.map(entry => ({
      id: entry.id,
      label: entry.key,
      type: entry.type,
      value: entry.accessCount,
      connections: entry.shared ? 3 : 1
    }))

    const links = memoryEntries
      .filter(entry => entry.shared)
      .flatMap(entry => 
        memoryEntries
          .filter(other => other.id !== entry.id && other.namespace === entry.namespace)
          .map(other => ({
            source: entry.id,
            target: other.id,
            strength: Math.random() * 10,
            type: 'namespace'
          }))
      )

    return { nodes, links }
  }, [memoryEntries])

  const handleCreateMemory = () => {
    if (!newMemory.key || !newMemory.value) return

    const memory: MemoryEntry = {
      id: `mem-${Date.now()}`,
      key: newMemory.key!,
      value: typeof newMemory.value === 'string' ? JSON.parse(newMemory.value) : newMemory.value,
      type: newMemory.type || 'state',
      namespace: newMemory.namespace || 'swarm/general',
      created: new Date(),
      updated: new Date(),
      accessCount: 0,
      size: JSON.stringify(newMemory.value).length,
      tags: newMemory.tags || [],
      metadata: {},
      shared: newMemory.shared || false,
      priority: newMemory.priority || 'medium'
    }

    setMemoryEntries(prev => [...prev, memory])
    setNewMemory({
      key: '',
      value: '',
      type: 'state',
      namespace: 'swarm/general',
      tags: [],
      priority: 'medium',
      shared: false
    })
    setShowCreateMemory(false)
  }

  const handleDeleteMemory = (memoryId: string) => {
    setMemoryEntries(prev => prev.filter(entry => entry.id !== memoryId))
    if (selectedMemory === memoryId) {
      setSelectedMemory(null)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'coordination': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'state': return 'bg-green-100 text-green-800 border-green-200'
      case 'knowledge': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'decision': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'context': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Memory Coordination</h2>
          <p className="text-gray-600">Manage shared memory and inter-agent coordination</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={showCreateMemory} onOpenChange={setShowCreateMemory}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Memory
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Memory Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Key</label>
                    <Input
                      value={newMemory.key || ''}
                      onChange={(e) => setNewMemory(prev => ({ ...prev, key: e.target.value }))}
                      placeholder="memory_key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <Select
                      value={newMemory.type}
                      onValueChange={(value: MemoryEntry['type']) => setNewMemory(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coordination">Coordination</SelectItem>
                        <SelectItem value="state">State</SelectItem>
                        <SelectItem value="knowledge">Knowledge</SelectItem>
                        <SelectItem value="decision">Decision</SelectItem>
                        <SelectItem value="context">Context</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Namespace</label>
                    <Input
                      value={newMemory.namespace || ''}
                      onChange={(e) => setNewMemory(prev => ({ ...prev, namespace: e.target.value }))}
                      placeholder="swarm/general"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <Select
                      value={newMemory.priority}
                      onValueChange={(value: MemoryEntry['priority']) => setNewMemory(prev => ({ ...prev, priority: value }))}
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
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Value (JSON)</label>
                  <Textarea
                    value={typeof newMemory.value === 'string' ? newMemory.value : JSON.stringify(newMemory.value, null, 2)}
                    onChange={(e) => setNewMemory(prev => ({ ...prev, value: e.target.value }))}
                    placeholder='{"key": "value"}'
                    rows={6}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newMemory.shared}
                    onChange={(e) => setNewMemory(prev => ({ ...prev, shared: e.target.checked }))}
                    className="rounded"
                  />
                  <label className="text-sm font-medium">Shared across agents</label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateMemory(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateMemory}>
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold">{memoryMetrics.totalEntries}</p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Memory Used</p>
                <p className="text-2xl font-bold">{memoryMetrics.totalSize}KB</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Shared</p>
                <p className="text-2xl font-bold">{memoryMetrics.sharedEntries}</p>
              </div>
              <Share2 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical</p>
                <p className="text-2xl font-bold">{memoryMetrics.criticalEntries}</p>
              </div>
              <Activity className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recently Accessed</p>
                <p className="text-2xl font-bold">{memoryMetrics.recentlyAccessed}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Access Pattern Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Access Patterns (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={accessPatternData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="reads" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Reads" />
              <Area type="monotone" dataKey="writes" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Writes" />
              <Area type="monotone" dataKey="synchronizations" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Sync" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="memory">Memory Store</TabsTrigger>
          <TabsTrigger value="coordination">Coordination</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Graph</TabsTrigger>
        </TabsList>

        <TabsContent value="memory" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search memory..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48"
                  />
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="coordination">Coordination</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="knowledge">Knowledge</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="context">Context</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterNamespace} onValueChange={setFilterNamespace}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Namespace" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Namespaces</SelectItem>
                    {Array.from(new Set(memoryEntries.map(e => e.namespace))).map(ns => (
                      <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Updated</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="accessed">Accessed</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="key">Key</SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-sm text-gray-600">
                  {filteredMemories.length} of {memoryEntries.length} entries
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memory Entries */}
          <div className="space-y-3">
            {filteredMemories.map(memory => (
              <Card 
                key={memory.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedMemory === memory.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedMemory(selectedMemory === memory.id ? null : memory.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(memory.priority)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium truncate">{memory.key}</h3>
                          <Badge className={`text-xs ${getTypeColor(memory.type)}`}>
                            {memory.type}
                          </Badge>
                          {memory.shared && (
                            <Badge variant="outline" className="text-xs">
                              <Share2 className="w-3 h-3 mr-1" />
                              Shared
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{memory.namespace}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Stats */}
                      <div className="text-right text-sm">
                        <p className="text-gray-900">{formatBytes(memory.size)}</p>
                        <p className="text-xs text-gray-500">{memory.accessCount} accesses</p>
                      </div>

                      {/* Updated */}
                      <div className="text-right text-sm">
                        <p className="text-gray-900">{memory.updated.toLocaleTimeString()}</p>
                        <p className="text-xs text-gray-500">{memory.updated.toLocaleDateString()}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-1">
                        <Button size="sm" variant="ghost">
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteMemory(memory.id)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {memory.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {memory.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Expanded Details */}
                  {selectedMemory === memory.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Created:</span>
                          <span className="ml-2">{memory.created.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Updated:</span>
                          <span className="ml-2">{memory.updated.toLocaleString()}</span>
                        </div>
                        {memory.agentId && (
                          <div>
                            <span className="text-gray-600">Agent:</span>
                            <span className="ml-2">{memory.agentId}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Priority:</span>
                          <span className="ml-2 capitalize">{memory.priority}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Value:</h4>
                        <div className="p-3 bg-gray-50 border rounded overflow-auto">
                          <pre className="text-sm">
                            {JSON.stringify(memory.value, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {Object.keys(memory.metadata).length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Metadata:</h4>
                          <div className="p-3 bg-gray-50 border rounded overflow-auto">
                            <pre className="text-sm">
                              {JSON.stringify(memory.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="coordination">
          <div className="space-y-4">
            {/* Coordination Channels */}
            <Card>
              <CardHeader>
                <CardTitle>Active Coordination Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coordinationChannels.map(channel => (
                    <div key={channel.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${channel.active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <div>
                          <h4 className="font-medium">{channel.name}</h4>
                          <p className="text-sm text-gray-600">{channel.type} - {channel.participants.length} participants</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-gray-900">{channel.messageCount} messages</p>
                        <p className="text-xs text-gray-500">
                          Last: {channel.lastActivity.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Synchronization Status */}
            <Card>
              <CardHeader>
                <CardTitle>Synchronization Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-gray-500 py-8">
                  Synchronization monitoring interface coming soon...
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Graph Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                Knowledge graph visualization coming soon...
                <br />
                <small>Will show relationships between memory entries, agents, and learned patterns</small>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}