'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit3, Trash2, Save, X, Filter, Search, SortAsc, SortDesc } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Swarm {
  id: string
  name: string
  purpose: string
  status: 'initializing' | 'running' | 'scaling' | 'stopped' | 'error'
  agents: Agent[]
  configuration?: {
    maxWorkers: number
    autoScale: boolean
    priority: 'low' | 'medium' | 'high'
    timeout: number
    retries: number
  }
  tags?: string[]
  createdAt: string
  lastUpdated: string
}

interface Agent {
  id: string
  name: string
  role: string
  status: 'idle' | 'busy' | 'error' | 'offline'
  tasks: string[]
}

interface FilterOptions {
  status: string[]
  priority: string[]
  tags: string[]
  search: string
  sortBy: 'name' | 'created' | 'status' | 'priority' | 'agentCount'
  sortOrder: 'asc' | 'desc'
}

interface SwarmCRUDProps {
  onSwarmSelect?: (swarm: Swarm) => void
}

const statusColors = {
  initializing: 'bg-purple-100 text-purple-800',
  running: 'bg-green-100 text-green-800',
  scaling: 'bg-orange-100 text-orange-800',
  stopped: 'bg-gray-100 text-gray-800',
  error: 'bg-red-100 text-red-800'
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800'
}

export const SwarmCRUD: React.FC<SwarmCRUDProps> = ({ onSwarmSelect }) => {
  const [swarms, setSwarms] = useState<Swarm[]>([])
  const [filteredSwarms, setFilteredSwarms] = useState<Swarm[]>([])
  const [loading, setLoading] = useState(false)
  const [editingSwarm, setEditingSwarm] = useState<Swarm | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    priority: [],
    tags: [],
    search: '',
    sortBy: 'created',
    sortOrder: 'desc'
  })

  // Mock data for demonstration
  useEffect(() => {
    const mockSwarms: Swarm[] = [
      {
        id: '1',
        name: 'fly-api-research-swarm',
        purpose: 'Research Fly.io API capabilities and update admin UI',
        status: 'running',
        agents: [
          { id: 'a1', name: 'api-researcher', role: 'API Analysis', status: 'busy', tasks: ['Document endpoints'] },
          { id: 'a2', name: 'ui-designer', role: 'UI Design', status: 'idle', tasks: ['Design TreeView'] }
        ],
        configuration: {
          maxWorkers: 10,
          autoScale: true,
          priority: 'high',
          timeout: 300,
          retries: 3
        },
        tags: ['research', 'api', 'ui'],
        createdAt: '2025-07-11T16:00:00Z',
        lastUpdated: '2025-07-11T16:30:00Z'
      },
      {
        id: '2',
        name: 'data-processing-swarm',
        purpose: 'Process large datasets with distributed computing',
        status: 'scaling',
        agents: [
          { id: 'a3', name: 'data-processor-1', role: 'Data Processing', status: 'busy', tasks: ['Process batch 1'] },
          { id: 'a4', name: 'data-processor-2', role: 'Data Processing', status: 'busy', tasks: ['Process batch 2'] }
        ],
        configuration: {
          maxWorkers: 20,
          autoScale: true,
          priority: 'medium',
          timeout: 600,
          retries: 5
        },
        tags: ['data', 'processing', 'analytics'],
        createdAt: '2025-07-11T15:00:00Z',
        lastUpdated: '2025-07-11T16:25:00Z'
      }
    ]
    setSwarms(mockSwarms)
    setFilteredSwarms(mockSwarms)
  }, [])

  const applyFilters = () => {
    let filtered = [...swarms]

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(swarm =>
        swarm.name.toLowerCase().includes(searchTerm) ||
        swarm.purpose.toLowerCase().includes(searchTerm) ||
        swarm.agents.some(agent => agent.name.toLowerCase().includes(searchTerm))
      )
    }

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(swarm => filters.status.includes(swarm.status))
    }

    // Priority filter
    if (filters.priority.length > 0) {
      filtered = filtered.filter(swarm => 
        swarm.configuration && filters.priority.includes(swarm.configuration.priority)
      )
    }

    // Tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(swarm =>
        swarm.tags?.some(tag => filters.tags.includes(tag))
      )
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal, bVal
      
      switch (filters.sortBy) {
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'status':
          aVal = a.status
          bVal = b.status
          break
        case 'priority':
          aVal = a.configuration?.priority || 'medium'
          bVal = b.configuration?.priority || 'medium'
          break
        case 'agentCount':
          aVal = a.agents.length
          bVal = b.agents.length
          break
        case 'created':
        default:
          aVal = new Date(a.createdAt)
          bVal = new Date(b.createdAt)
          break
      }

      if (filters.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    setFilteredSwarms(filtered)
  }

  useEffect(() => {
    applyFilters()
  }, [filters, swarms])

  const handleCreateSwarm = () => {
    setShowCreateForm(true)
  }

  const handleEditSwarm = (swarm: Swarm) => {
    setEditingSwarm(swarm)
  }

  const handleDeleteSwarm = async (swarmId: string) => {
    if (window.confirm('Are you sure you want to delete this swarm?')) {
      setSwarms(prev => prev.filter(s => s.id !== swarmId))
    }
  }

  const toggleStatus = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }))
  }

  const togglePriority = (priority: string) => {
    setFilters(prev => ({
      ...prev,
      priority: prev.priority.includes(priority)
        ? prev.priority.filter(p => p !== priority)
        : [...prev.priority, priority]
    }))
  }

  const toggleSort = () => {
    setFilters(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Swarm Management</h2>
          <p className="text-gray-600">Create and manage your swarms with advanced filtering</p>
        </div>
        
        <Button 
          onClick={handleCreateSwarm}
          className="bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Swarm
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search swarms, agents, or purposes..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10"
            />
          </div>

          {/* Filter Badges */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Status:</span>
              {['initializing', 'running', 'scaling', 'stopped', 'error'].map(status => (
                <Badge
                  key={status}
                  variant={filters.status.includes(status) ? 'default' : 'outline'}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:scale-105",
                    filters.status.includes(status) && statusColors[status as keyof typeof statusColors]
                  )}
                  onClick={() => toggleStatus(status)}
                >
                  {status}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Priority:</span>
              {['low', 'medium', 'high'].map(priority => (
                <Badge
                  key={priority}
                  variant={filters.priority.includes(priority) ? 'default' : 'outline'}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:scale-105",
                    filters.priority.includes(priority) && priorityColors[priority as keyof typeof priorityColors]
                  )}
                  onClick={() => togglePriority(priority)}
                >
                  {priority}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Sort by:</span>
            <Select 
              value={filters.sortBy} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value as any }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="agentCount">Agent Count</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm" onClick={toggleSort}>
              {filters.sortOrder === 'asc' ? (
                <SortAsc className="w-4 h-4" />
              ) : (
                <SortDesc className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Swarms Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredSwarms.map((swarm) => (
          <Card 
            key={swarm.id} 
            className="transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer"
            onClick={() => onSwarmSelect?.(swarm)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{swarm.name}</CardTitle>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditSwarm(swarm)
                    }}
                    className="h-8 w-8 p-0 hover:bg-blue-100"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSwarm(swarm.id)
                    }}
                    className="h-8 w-8 p-0 hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600 line-clamp-2">{swarm.purpose}</p>
              
              <div className="flex flex-wrap gap-2">
                <Badge className={statusColors[swarm.status]}>
                  {swarm.status}
                </Badge>
                {swarm.configuration && (
                  <Badge className={priorityColors[swarm.configuration.priority]}>
                    {swarm.configuration.priority}
                  </Badge>
                )}
                <Badge variant="outline">
                  {swarm.agents.length} agents
                </Badge>
              </div>

              {swarm.tags && (
                <div className="flex flex-wrap gap-1">
                  {swarm.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500">
                Created: {new Date(swarm.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSwarms.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No swarms match your current filters.</p>
          <Button 
            variant="outline" 
            onClick={() => setFilters({
              status: [],
              priority: [],
              tags: [],
              search: '',
              sortBy: 'created',
              sortOrder: 'desc'
            })}
            className="mt-2"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}

export default SwarmCRUD