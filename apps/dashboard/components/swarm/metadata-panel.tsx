'use client'

import React, { useState } from 'react'
import { 
  Info, 
  Settings, 
  Activity, 
  Users, 
  Clock, 
  TrendingUp, 
  Tag,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface SwarmMetadata {
  id: string
  name: string
  purpose: string
  status: string
  agents: Agent[]
  configuration?: {
    maxWorkers: number
    autoScale: boolean
    priority: 'low' | 'medium' | 'high'
    timeout: number
    retries: number
    environment?: Record<string, string>
    resources?: {
      cpu: string
      memory: string
      storage: string
    }
  }
  metrics?: {
    tasksCompleted: number
    tasksActive: number
    tasksFailed: number
    uptime: number
    avgResponseTime: number
  }
  tags?: string[]
  createdAt: string
  lastUpdated: string
  metadata?: Record<string, any>
}

interface Agent {
  id: string
  name: string
  role: string
  status: 'idle' | 'busy' | 'error' | 'offline'
  tasks: string[]
  metadata?: Record<string, any>
  lastActivity?: string
}

interface MetadataPanelProps {
  swarm: SwarmMetadata
  className?: string
}

const MetadataSection: React.FC<{
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultExpanded?: boolean
}> = ({ title, icon, children, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle 
          className="flex items-center justify-between cursor-pointer text-lg"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            {icon}
            <span>{title}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 transition-transform duration-200" />
          ) : (
            <ChevronDown className="w-4 h-4 transition-transform duration-200" />
          )}
        </CardTitle>
      </CardHeader>
      
      <div 
        className={cn(
          "transition-all duration-300 overflow-hidden",
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="pt-0">
          {children}
        </CardContent>
      </div>
    </Card>
  )
}

const CopyableValue: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
      <div className="flex-1 min-w-0">
        {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
        <code className="text-sm break-all">{value}</code>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={copyToClipboard}
        className="ml-2 h-8 w-8 p-0"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  )
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({ swarm, className }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800'
      case 'idle': return 'bg-blue-100 text-blue-800'
      case 'busy': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      case 'offline': return 'bg-gray-100 text-gray-800'
      case 'initializing': return 'bg-purple-100 text-purple-800'
      case 'scaling': return 'bg-orange-100 text-orange-800'
      case 'stopped': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const getHealthScore = () => {
    if (!swarm.metrics) return 0
    const { tasksCompleted, tasksFailed } = swarm.metrics
    const total = tasksCompleted + tasksFailed
    if (total === 0) return 100
    return Math.round((tasksCompleted / total) * 100)
  }

  const activeAgents = swarm.agents.filter(a => a.status === 'busy').length
  const healthScore = getHealthScore()

  return (
    <div className={cn("space-y-6", className)}>
      {/* Overview */}
      <MetadataSection
        title="Overview"
        icon={<Info className="w-5 h-5" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Name</label>
              <p className="font-semibold">{swarm.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <Badge className={getStatusColor(swarm.status)}>
                {swarm.status}
              </Badge>
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-500">Purpose</label>
            <p className="text-sm">{swarm.purpose}</p>
          </div>

          <CopyableValue value={swarm.id} label="Swarm ID" />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-gray-500">Created</label>
              <p>{new Date(swarm.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <label className="text-gray-500">Last Updated</label>
              <p>{new Date(swarm.lastUpdated).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </MetadataSection>

      {/* Configuration */}
      {swarm.configuration && (
        <MetadataSection
          title="Configuration"
          icon={<Settings className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Max Workers</label>
                <p className="font-semibold">{swarm.configuration.maxWorkers}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Priority</label>
                <Badge className={getPriorityColor(swarm.configuration.priority)}>
                  {swarm.configuration.priority}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Auto Scale</label>
                <p className="font-semibold">
                  {swarm.configuration.autoScale ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Timeout</label>
                <p className="font-semibold">{swarm.configuration.timeout}s</p>
              </div>
            </div>

            {swarm.configuration.resources && (
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">Resources</label>
                <div className="bg-gray-50 p-3 rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">CPU:</span>
                    <span className="text-sm font-medium">{swarm.configuration.resources.cpu}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Memory:</span>
                    <span className="text-sm font-medium">{swarm.configuration.resources.memory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Storage:</span>
                    <span className="text-sm font-medium">{swarm.configuration.resources.storage}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </MetadataSection>
      )}

      {/* Metrics */}
      {swarm.metrics && (
        <MetadataSection
          title="Performance Metrics"
          icon={<Activity className="w-5 h-5" />}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Health Score</label>
                <div className="flex items-center space-x-2">
                  <Progress value={healthScore} className="flex-1" />
                  <span className="text-sm font-bold">{healthScore}%</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Uptime</label>
                <p className="font-semibold">{formatUptime(swarm.metrics.uptime)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {swarm.metrics.tasksCompleted}
                </div>
                <div className="text-sm text-green-600">Completed</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {swarm.metrics.tasksActive}
                </div>
                <div className="text-sm text-yellow-600">Active</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {swarm.metrics.tasksFailed}
                </div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Avg Response Time</label>
              <p className="font-semibold">{swarm.metrics.avgResponseTime}ms</p>
            </div>
          </div>
        </MetadataSection>
      )}

      {/* Agents */}
      <MetadataSection
        title={`Agents (${swarm.agents.length})`}
        icon={<Users className="w-5 h-5" />}
      >
        <div className="space-y-3">
          {swarm.agents.map((agent) => (
            <div key={agent.id} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{agent.name}</div>
                <Badge className={getStatusColor(agent.status)}>
                  {agent.status}
                </Badge>
              </div>
              <div className="text-sm text-gray-600 mb-2">{agent.role}</div>
              <div className="text-xs text-gray-500">
                {agent.tasks.length} tasks assigned
              </div>
              {agent.lastActivity && (
                <div className="text-xs text-gray-500">
                  Last active: {new Date(agent.lastActivity).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </MetadataSection>

      {/* Tags */}
      {swarm.tags && swarm.tags.length > 0 && (
        <MetadataSection
          title="Tags"
          icon={<Tag className="w-5 h-5" />}
        >
          <div className="flex flex-wrap gap-2">
            {swarm.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </MetadataSection>
      )}

      {/* Additional Metadata */}
      {swarm.metadata && Object.keys(swarm.metadata).length > 0 && (
        <MetadataSection
          title="Additional Metadata"
          icon={<Info className="w-5 h-5" />}
          defaultExpanded={false}
        >
          <div className="space-y-2">
            {Object.entries(swarm.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium">{key}:</span>
                <span className="text-sm">{JSON.stringify(value)}</span>
              </div>
            ))}
          </div>
        </MetadataSection>
      )}
    </div>
  )
}

export default MetadataPanel