'use client';

// Comprehensive Swarm Coordination Dashboard
// Created: 2025-07-14
// Purpose: Main dashboard for swarm relationship management

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Activity, 
  Users, 
  Network, 
  Brain, 
  Database, 
  Zap, 
  Eye, 
  Plus,
  Search,
  Filter,
  BarChart3,
  Globe,
  GitBranch,
  MessageSquare,
  Heart,
  TrendingUp,
  Settings,
  PlayCircle,
  PauseCircle,
  StopCircle,
  RefreshCw
} from 'lucide-react';
import { useSwarmCoordination } from '@/lib/hooks/use-swarm-coordination';
import {
  SwarmNetwork,
  SwarmSession,
  SwarmAgent,
  SwarmTask,
  SwarmTopologyEnum,
  SwarmStrategyEnum,
  AgentTypeEnum,
  TaskPriorityEnum,
  ExecutionStrategyEnum
} from '@/lib/swarm-coordination-types';

export default function SwarmCoordinationDashboard() {
  const {
    networks,
    sessions,
    agents,
    tasks,
    events,
    metrics,
    health,
    dashboardMetrics,
    loading,
    errors,
    connected,
    lastUpdate,
    fetchNetworks,
    fetchSessions,
    fetchAgents,
    fetchTasks,
    searchMemory,
    refreshAll,
    client
  } = useSwarmCoordination({
    enableRealtime: true,
    autoRefresh: true,
    refreshInterval: 30000
  });

  // Local state
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<'network' | 'session' | 'agent' | 'task'>('network');

  // Filtered data
  const filteredNetworks = networks.filter(network => 
    network.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterStatus === 'all' || network.status === filterStatus)
  );

  const filteredSessions = sessions.filter(session => 
    session.swarm_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterStatus === 'all' || session.status === filterStatus)
  );

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterStatus === 'all' || agent.status === filterStatus)
  );

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterStatus === 'all' || task.status === filterStatus)
  );

  // Create handlers
  const handleCreateNetwork = useCallback(async (formData: FormData) => {
    if (!client) return;

    const networkData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      topology: formData.get('topology') as SwarmTopologyEnum,
      max_agents: parseInt(formData.get('maxAgents') as string),
      strategy: formData.get('strategy') as SwarmStrategyEnum,
      status: 'active' as const,
      metadata: {},
      coordination_config: {
        consensus_threshold: 0.6,
        heartbeat_interval: 30,
        max_response_time: 5000,
        auto_scale: true,
        load_balancing: true
      }
    };

    const result = await client.createNetwork(networkData);
    if (result.success) {
      setCreateDialogOpen(false);
      fetchNetworks();
    }
  }, [client, fetchNetworks]);

  // Status indicators
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': case 'offline': return 'bg-gray-500';
      case 'error': case 'failed': return 'bg-red-500';
      case 'paused': case 'idle': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Swarm Coordination</h1>
          <p className="text-muted-foreground">
            Manage and monitor distributed agent networks
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {lastUpdate && (
            <span className="text-sm text-muted-foreground">
              Last update: {formatTimestamp(lastUpdate.toISOString())}
            </span>
          )}
          <Button onClick={refreshAll} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {dashboardMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Networks</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardMetrics.total_networks}</div>
              <p className="text-xs text-muted-foreground">
                Active coordination networks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardMetrics.active_sessions}</div>
              <p className="text-xs text-muted-foreground">
                Running swarm sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardMetrics.active_agents}/{dashboardMetrics.total_agents}
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round((dashboardMetrics.active_agents / dashboardMetrics.total_agents) * 100)}% online
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(dashboardMetrics.system_health * 100)}%
              </div>
              <Progress value={dashboardMetrics.system_health * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search networks, sessions, agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Entity</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              if (createType === 'network') {
                handleCreateNetwork(formData);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="type">Entity Type</Label>
                  <Select value={createType} onValueChange={(value: any) => setCreateType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="network">Network</SelectItem>
                      <SelectItem value="session">Session</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {createType === 'network' && (
                  <>
                    <div>
                      <Label htmlFor="name">Network Name</Label>
                      <Input name="name" placeholder="Enter network name" required />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea name="description" placeholder="Network description" />
                    </div>
                    <div>
                      <Label htmlFor="topology">Topology</Label>
                      <Select name="topology" defaultValue="hierarchical">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mesh">Mesh</SelectItem>
                          <SelectItem value="hierarchical">Hierarchical</SelectItem>
                          <SelectItem value="ring">Ring</SelectItem>
                          <SelectItem value="star">Star</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="maxAgents">Max Agents</Label>
                      <Input name="maxAgents" type="number" defaultValue="8" min="1" max="100" />
                    </div>
                    <div>
                      <Label htmlFor="strategy">Strategy</Label>
                      <Select name="strategy" defaultValue="adaptive">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="specialized">Specialized</SelectItem>
                          <SelectItem value="adaptive">Adaptive</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                          <SelectItem value="efficiency">Efficiency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">Create</Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="networks">Networks</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className={`w-2 h-2 rounded-full bg-blue-500`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event.event_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(event.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{event.priority}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {health.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-center justify-between">
                      <span className="text-sm">Agent {h.agent_id?.slice(-8)}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={h.health_score * 100} className="w-20" />
                        <Badge className={getStatusColor(h.status)}>
                          {h.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="networks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNetworks.map((network) => (
              <Card key={network.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{network.name}</CardTitle>
                    <Badge className={getStatusColor(network.status)}>
                      {network.status}
                    </Badge>
                  </div>
                  <CardDescription>{network.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Topology:</span>
                      <span className="capitalize">{network.topology}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Strategy:</span>
                      <span className="capitalize">{network.strategy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Max Agents:</span>
                      <span>{network.max_agents}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Created:</span>
                      <span>{formatTimestamp(network.created_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{session.swarm_name}</CardTitle>
                    <Badge className={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                  <CardDescription>{session.objective}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Queen Type:</span>
                      <span className="capitalize">{session.queen_type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Workers:</span>
                      <span>{session.worker_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Algorithm:</span>
                      <span>{session.consensus_algorithm}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Duration:</span>
                      <span>{formatDuration(session.started_at, session.ended_at)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Efficiency:</span>
                      <span>{Math.round(session.metrics.efficiency_score * 100)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status}
                    </Badge>
                  </div>
                  <CardDescription className="capitalize">{agent.type}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Performance:</span>
                      <span>{Math.round(agent.performance_score * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Load Factor:</span>
                      <span>{Math.round(agent.load_factor * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Capabilities:</span>
                      <span>{agent.capabilities.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Last Heartbeat:</span>
                      <span>
                        {agent.last_heartbeat 
                          ? formatTimestamp(agent.last_heartbeat)
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.slice(0, 3).map((capability) => (
                          <Badge key={capability} variant="secondary" className="text-xs">
                            {capability}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{agent.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <Card key={task.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{task.title}</CardTitle>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  </div>
                  <CardDescription>{task.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Priority:</span>
                      <Badge variant="outline" className="capitalize">
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Strategy:</span>
                      <span className="capitalize">{task.strategy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Progress:</span>
                      <span>{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="mt-2" />
                    <div className="flex justify-between text-sm">
                      <span>Assigned Agents:</span>
                      <span>{task.assigned_agents.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Dependencies:</span>
                      <span>{task.dependencies.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.slice(0, 10).map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{metric.metric_type}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          {metric.value.toFixed(2)} {metric.unit}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(metric.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Coordination Events */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Coordination Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.slice(0, 10).map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-1.5 bg-blue-500`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {event.event_type.replace('_', ' ')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {event.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(event.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}