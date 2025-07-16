'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Database, 
  RefreshCw, 
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Users,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRealtimeSwarm } from '@/lib/hooks/use-realtime-swarm';

interface SupabaseTracesProps {
  sessionId?: string;
  swarmId?: string;
  maxTraces?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function SupabaseTraces({
  sessionId = 'verified-swarm-1752447894027',
  swarmId = 'swarm_observability',
  maxTraces = 100,
  autoRefresh = true,
  refreshInterval = 3000
}: SupabaseTracesProps) {
  const {
    traces,
    agents,
    aggregatedMetrics,
    isConnected,
    isLoading,
    error,
    lastUpdate,
    subscriptionStatus,
    refresh,
    addTrace,
    updateAgentStatus,
    recordMetric
  } = useRealtimeSwarm({
    sessionId,
    swarmId,
    enableTraces: true,
    enableAgents: true,
    enableMetrics: true,
    maxItems: maxTraces,
    autoRefresh,
    refreshInterval
  });

  const [selectedTrace, setSelectedTrace] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState('overview');

  // Filter traces based on search and status
  const filteredTraces = traces.filter(trace => {
    const matchesSearch = trace.trace_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         JSON.stringify(trace.trace_data).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trace.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Generate demo trace for testing
  const handleGenerateTrace = async () => {
    try {
      const demoTrace = {
        session_id: sessionId,
        trace_name: `Demo Trace ${Date.now()}`,
        trace_data: {
          action: 'demo_operation',
          input: 'Testing Supabase real-time integration',
          output: 'Successfully demonstrated real-time trace updates',
          model: 'swarm-agent',
          prompt_tokens: 150,
          completion_tokens: 75,
          total_cost: 0.002
        },
        status: 'success' as const,
        duration_ms: Math.floor(Math.random() * 2000) + 500,
        metadata: {
          demo: true,
          timestamp: new Date().toISOString(),
          agent_id: `agent-${Math.floor(Math.random() * 5) + 1}`
        }
      };

      await addTrace(demoTrace);
    } catch (error) {
      console.error('Error generating demo trace:', error);
    }
  };

  // Test agent status update
  const handleTestAgentUpdate = async () => {
    if (agents.length > 0) {
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      const newStatus = randomAgent.status === 'active' ? 'idle' : 'active';
      
      try {
        await updateAgentStatus(randomAgent.id, newStatus, 
          newStatus === 'active' ? 'Processing demo task' : undefined);
      } catch (error) {
        console.error('Error updating agent status:', error);
      }
    }
  };

  // Generate performance chart data
  const generateChartData = () => {
    const now = new Date();
    return Array.from({ length: 10 }, (_, i) => {
      const time = new Date(now.getTime() - (9 - i) * 60000);
      const tracesInInterval = filteredTraces.filter(trace => 
        Math.abs(new Date(trace.created_at).getTime() - time.getTime()) < 30000
      );
      
      return {
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        traces: tracesInInterval.length,
        success: tracesInInterval.filter(t => t.status === 'success').length,
        error: tracesInInterval.filter(t => t.status === 'error').length,
      };
    });
  };

  const chartData = generateChartData();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'error':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'running':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Supabase Real-time Traces
              <div className={`ml-3 w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateTrace}
                disabled={isLoading}
              >
                <Zap className="w-4 h-4 mr-2" />
                Demo Trace
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAgentUpdate}
                disabled={isLoading || agents.length === 0}
              >
                <Users className="w-4 h-4 mr-2" />
                Test Agent
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Connection Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center space-x-2">
              {isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
              <span className="text-sm">Connection: {isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="text-sm">
              Traces: {subscriptionStatus.traces ? '✅' : '❌'}
            </div>
            <div className="text-sm">
              Agents: {subscriptionStatus.agents ? '✅' : '❌'}
            </div>
            <div className="text-sm">
              Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Metrics Overview */}
          {aggregatedMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{aggregatedMetrics.totalTraces}</div>
                <div className="text-sm text-blue-600">Total Traces</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{aggregatedMetrics.activeAgents}</div>
                <div className="text-sm text-green-600">Active Agents</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <div className="text-2xl font-bold text-purple-600">{aggregatedMetrics.averageResponseTime}ms</div>
                <div className="text-sm text-purple-600">Avg Response</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">{aggregatedMetrics.errorRate}%</div>
                <div className="text-sm text-orange-600">Error Rate</div>
              </div>
              <div className="text-center p-3 bg-teal-50 rounded">
                <div className="text-2xl font-bold text-teal-600">{aggregatedMetrics.throughput}</div>
                <div className="text-sm text-teal-600">Throughput</div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded">
                <div className="text-2xl font-bold text-indigo-600">{aggregatedMetrics.systemHealth}%</div>
                <div className="text-sm text-indigo-600">Health</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="traces">Live Traces</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Trace Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="success" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="error" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agents.slice(0, 5).map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          agent.status === 'active' ? 'bg-green-500' :
                          agent.status === 'idle' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-sm font-medium">{agent.name}</span>
                      </div>
                      <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                        {agent.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Live Traces Tab */}
        <TabsContent value="traces" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Trace Stream</CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search traces..."
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex h-[500px]">
                {/* Trace List */}
                <div className="w-1/2 border-r">
                  <ScrollArea className="h-full">
                    <div className="divide-y">
                      {filteredTraces.map((trace) => (
                        <div
                          key={trace.id}
                          className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                            selectedTrace?.id === trace.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedTrace(trace)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon(trace.status)}
                                <h4 className="font-medium text-sm">{trace.trace_name}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {trace.trace_data?.model || 'swarm-agent'}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {trace.trace_data?.input || trace.trace_data?.action || 'No description'}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>{new Date(trace.created_at).toLocaleTimeString()}</span>
                                <span>{trace.duration_ms}ms</span>
                                <span>Agent: {trace.metadata?.agent_id || 'unknown'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Trace Details */}
                <div className="w-1/2">
                  <ScrollArea className="h-full">
                    {selectedTrace ? (
                      <div className="p-4">
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">{selectedTrace.trace_name}</h3>
                            <Badge className={getStatusColor(selectedTrace.status)}>
                              {selectedTrace.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Session ID:</span>
                              <p className="font-mono text-xs">{selectedTrace.session_id}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Duration:</span>
                              <p>{selectedTrace.duration_ms}ms</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Created:</span>
                              <p>{new Date(selectedTrace.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Updated:</span>
                              <p>{new Date(selectedTrace.updated_at).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        <Tabs defaultValue="data" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="data">Trace Data</TabsTrigger>
                            <TabsTrigger value="metadata">Metadata</TabsTrigger>
                            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="data" className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Input</h4>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                {selectedTrace.trace_data?.input || selectedTrace.trace_data?.action || 'No input data'}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium mb-2">Output</h4>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                                {selectedTrace.trace_data?.output || 'No output data'}
                              </pre>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="metadata">
                            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                              {JSON.stringify(selectedTrace.metadata, null, 2)}
                            </pre>
                          </TabsContent>
                          
                          <TabsContent value="raw">
                            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                              {JSON.stringify(selectedTrace, null, 2)}
                            </pre>
                          </TabsContent>
                        </Tabs>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Select a trace to view details
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <Card key={agent.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-xs text-gray-600">{agent.type}</div>
                    </div>
                    <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="font-bold text-blue-600">{agent.tasks_completed}</div>
                      <div className="text-blue-600 text-xs">Tasks</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="font-bold text-purple-600">{agent.average_response_time}ms</div>
                      <div className="text-purple-600 text-xs">Avg Time</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>CPU</span>
                        <span>{agent.cpu_usage.toFixed(1)}%</span>
                      </div>
                      <Progress value={agent.cpu_usage} className="h-1.5" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Memory</span>
                        <span>{agent.memory_usage.toFixed(1)}%</span>
                      </div>
                      <Progress value={agent.memory_usage} className="h-1.5" />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 border-t pt-2">
                    Last activity: {new Date(agent.last_activity).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Trace Volume Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="traces" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success vs Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="success" fill="#10b981" />
                    <Bar dataKey="error" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}