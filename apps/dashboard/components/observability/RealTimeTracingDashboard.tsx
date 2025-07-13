'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Brain, 
  Clock, 
  Database, 
  GitBranch, 
  Network, 
  Pause, 
  Play, 
  RefreshCw, 
  Search,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Download,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useLangfuseRealtime } from '@/lib/hooks/use-langfuse-realtime';
import { LiveTrace, LiveAgent } from '@/lib/langfuse-client';

// Use types from langfuse-client
type RealTimeTrace = LiveTrace;
type AgentActivity = LiveAgent;

interface RealTimeTracingDashboardProps {
  swarmId?: string;
  refreshInterval?: number;
  maxTraces?: number;
  enableAutoRefresh?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function RealTimeTracingDashboard({ 
  swarmId, 
  refreshInterval = 2000, 
  maxTraces = 100,
  enableAutoRefresh = true 
}: RealTimeTracingDashboardProps) {
  // Use real-time Langfuse hook
  const {
    traces,
    agents,
    metrics: swarmMetrics,
    isConnected,
    isInitializing,
    error: connectionError,
    recentActivity,
    connect,
    disconnect,
    reconnect,
    refresh,
    clearTraces,
  } = useLangfuseRealtime({
    swarmId,
    maxTraces,
    enableAutoRefresh,
    refreshInterval,
  });

  // Local state for UI controls
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<RealTimeTrace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'5m' | '15m' | '1h' | '6h' | '24h'>('1h');
  const [selectedTab, setSelectedTab] = useState('overview');
  
  // Performance metrics for charts
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [tokenData, setTokenData] = useState<any[]>([]);
  const [errorData, setErrorData] = useState<any[]>([]);
  
  const lastUpdateRef = useRef<Date>(new Date());

  // Update last update time when traces change
  useEffect(() => {
    if (traces.length > 0) {
      lastUpdateRef.current = new Date();
    }
  }, [traces]);

  // Mock data generators for demonstration
  const generateMockTrace = useCallback((): RealTimeTrace => {
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
    const statuses: RealTimeTrace['status'][] = ['success', 'error', 'pending', 'running'];
    const tasks = [
      'Code generation for authentication system',
      'Database schema optimization',
      'API endpoint testing',
      'Documentation generation',
      'Performance analysis',
      'Security vulnerability scan',
      'Unit test creation',
      'Code refactoring suggestions'
    ];
    
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const model = models[Math.floor(Math.random() * models.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const promptTokens = Math.floor(Math.random() * 2000) + 100;
    const completionTokens = Math.floor(Math.random() * 1000) + 50;
    
    return {
      id: traceId,
      name: tasks[Math.floor(Math.random() * tasks.length)],
      sessionId: swarmId || `session-${Math.floor(Math.random() * 5) + 1}`,
      userId: `user-${Math.floor(Math.random() * 10) + 1}`,
      timestamp: new Date(),
      duration: status === 'running' ? 0 : Math.floor(Math.random() * 5000) + 200,
      status,
      model,
      promptTokens,
      completionTokens,
      totalCost: (promptTokens * 0.00003 + completionTokens * 0.00006),
      input: `Execute task: ${tasks[Math.floor(Math.random() * tasks.length)]}`,
      output: status === 'success' ? `Task completed successfully with ${Math.floor(Math.random() * 100)} optimizations applied` : 
              status === 'error' ? 'Error: Task failed due to resource constraints' :
              status === 'running' ? 'Task in progress...' : 'Task pending execution',
      metadata: {
        agentId: `agent-${Math.floor(Math.random() * 8) + 1}`,
        temperature: Math.random(),
        maxTokens: 2048,
        topP: 0.9,
        region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
      },
      tags: ['swarm', 'automation', 'real-time'],
      scores: {
        quality: Math.random(),
        relevance: Math.random(),
        efficiency: Math.random(),
      },
      memoryUsage: Math.floor(Math.random() * 512) + 128,
      cpuUsage: Math.floor(Math.random() * 80) + 10,
      agentId: `agent-${Math.floor(Math.random() * 8) + 1}`,
      swarmId: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
    };
  }, [swarmId]);

  const generateMockAgent = useCallback((): AgentActivity => {
    const names = ['Research Agent', 'Code Agent', 'Test Agent', 'Analytics Agent', 'Security Agent', 'Performance Agent', 'Documentation Agent', 'Coordination Agent'];
    const statuses: AgentActivity['status'][] = ['active', 'idle', 'error', 'offline'];
    
    return {
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: names[Math.floor(Math.random() * names.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      currentTask: Math.random() > 0.3 ? 'Processing trace analysis' : undefined,
      tasksCompleted: Math.floor(Math.random() * 150) + 50,
      averageResponseTime: Math.floor(Math.random() * 800) + 200,
      memoryUsage: Math.floor(Math.random() * 80) + 20,
      cpuUsage: Math.floor(Math.random() * 90) + 5,
      lastActivity: new Date(Date.now() - Math.random() * 300000), // Within last 5 minutes
      swarmId: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
    };
  }, [swarmId]);

  // WebSocket connection simulation
  const connectWebSocket = useCallback(() => {
    if (!enableAutoRefresh || isPaused) return;

    setIsConnected(true);
    
    // Simulate WebSocket with interval
    const interval = setInterval(() => {
      if (Math.random() > 0.3) { // 70% chance of new trace
        const newTrace = generateMockTrace();
        setTraces(prev => {
          const updated = [newTrace, ...prev].slice(0, maxTraces);
          return updated;
        });
      }
      
      if (Math.random() > 0.8) { // 20% chance of agent update
        setAgents(prev => {
          const updated = [...prev];
          if (updated.length < 8) {
            updated.push(generateMockAgent());
          } else {
            const index = Math.floor(Math.random() * updated.length);
            updated[index] = { ...updated[index], lastActivity: new Date() };
          }
          return updated;
        });
      }
      
      lastUpdateRef.current = new Date();
    }, refreshInterval);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [enableAutoRefresh, isPaused, refreshInterval, maxTraces, generateMockTrace, generateMockAgent]);

  // Initialize connection and data
  useEffect(() => {
    // Generate initial data
    const initialTraces = Array.from({ length: 20 }, () => generateMockTrace());
    const initialAgents = Array.from({ length: 6 }, () => generateMockAgent());
    
    setTraces(initialTraces);
    setAgents(initialAgents);
    
    // Connect WebSocket
    const cleanup = connectWebSocket();
    
    return cleanup;
  }, [connectWebSocket, generateMockTrace, generateMockAgent]);

  // Update metrics and chart data
  useEffect(() => {
    const now = new Date();
    const timeRangeMs = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    }[timeRange];
    
    const recentTraces = traces.filter(t => now.getTime() - t.timestamp.getTime() < timeRangeMs);
    const activeAgents = agents.filter(a => a.status === 'active');
    
    // Update swarm metrics
    const successfulTraces = recentTraces.filter(t => t.status === 'success');
    const errorTraces = recentTraces.filter(t => t.status === 'error');
    const completedTraces = recentTraces.filter(t => t.status === 'success' || t.status === 'error');
    
    const metrics: SwarmMetrics = {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      totalTasks: recentTraces.length,
      completedTasks: completedTraces.length,
      failedTasks: errorTraces.length,
      averageResponseTime: completedTraces.length > 0 
        ? completedTraces.reduce((sum, t) => sum + t.duration, 0) / completedTraces.length 
        : 0,
      throughput: recentTraces.length,
      errorRate: recentTraces.length > 0 ? (errorTraces.length / recentTraces.length) * 100 : 0,
      memoryUsage: agents.length > 0 ? agents.reduce((sum, a) => sum + a.memoryUsage, 0) / agents.length : 0,
      cpuUsage: agents.length > 0 ? agents.reduce((sum, a) => sum + a.cpuUsage, 0) / agents.length : 0,
      totalCost: recentTraces.reduce((sum, t) => sum + t.totalCost, 0),
      tokenUsage: {
        prompt: recentTraces.reduce((sum, t) => sum + t.promptTokens, 0),
        completion: recentTraces.reduce((sum, t) => sum + t.completionTokens, 0),
        total: recentTraces.reduce((sum, t) => sum + t.promptTokens + t.completionTokens, 0),
      },
    };
    
    setSwarmMetrics(metrics);
    
    // Update chart data
    const last10Minutes = Array.from({ length: 10 }, (_, i) => {
      const time = new Date(now.getTime() - (9 - i) * 60000);
      const tracesInMinute = recentTraces.filter(t => 
        Math.abs(t.timestamp.getTime() - time.getTime()) < 30000
      );
      
      return {
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        traces: tracesInMinute.length,
        avgDuration: tracesInMinute.length > 0 
          ? tracesInMinute.reduce((sum, t) => sum + t.duration, 0) / tracesInMinute.length 
          : 0,
        errors: tracesInMinute.filter(t => t.status === 'error').length,
        success: tracesInMinute.filter(t => t.status === 'success').length,
      };
    });
    
    setPerformanceData(last10Minutes);
    
    // Token usage data
    const tokensByModel = recentTraces.reduce((acc, trace) => {
      acc[trace.model] = (acc[trace.model] || 0) + trace.promptTokens + trace.completionTokens;
      return acc;
    }, {} as Record<string, number>);
    
    const tokenChartData = Object.entries(tokensByModel).map(([model, tokens]) => ({
      model,
      tokens,
      cost: traces.filter(t => t.model === model).reduce((sum, t) => sum + t.totalCost, 0),
    }));
    
    setTokenData(tokenChartData);
    
  }, [traces, agents, timeRange]);

  // Filtered traces
  const filteredTraces = traces.filter(trace => {
    const matchesSearch = trace.input.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trace.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trace.status === statusFilter;
    const matchesModel = modelFilter === 'all' || trace.model === modelFilter;
    return matchesSearch && matchesStatus && matchesModel;
  });

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleExportData = () => {
    const data = {
      traces: filteredTraces,
      agents,
      metrics: swarmMetrics,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm-tracing-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CardTitle className="flex items-center">
                <Brain className="w-6 h-6 mr-2" />
                Real-Time Swarm Tracing Dashboard
                <div className={`ml-3 w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              </CardTitle>
              {swarmId && (
                <Badge variant="outline" className="text-sm">
                  {swarmId}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5m">5m</SelectItem>
                  <SelectItem value="15m">15m</SelectItem>
                  <SelectItem value="1h">1h</SelectItem>
                  <SelectItem value="6h">6h</SelectItem>
                  <SelectItem value="24h">24h</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handlePauseResume}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {swarmMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{swarmMetrics.activeAgents}</div>
                <div className="text-sm text-gray-600">Active Agents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{swarmMetrics.completedTasks}</div>
                <div className="text-sm text-gray-600">Completed Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{Math.round(swarmMetrics.averageResponseTime)}ms</div>
                <div className="text-sm text-gray-600">Avg Response</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{swarmMetrics.errorRate.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Error Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">${swarmMetrics.totalCost.toFixed(3)}</div>
                <div className="text-sm text-gray-600">Total Cost</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-600">{swarmMetrics.tokenUsage.total.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Tokens</div>
              </div>
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-500 text-center">
            Last updated: {lastUpdateRef.current.toLocaleString()} • 
            Connection: {isConnected ? 'Connected' : 'Disconnected'} • 
            {filteredTraces.length} traces shown
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center">
            <Eye className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="traces" className="flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            Live Traces
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center">
            <Network className="w-4 h-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center">
            <GitBranch className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgDuration" stroke="#3b82f6" name="Avg Duration (ms)" />
                    <Line type="monotone" dataKey="traces" stroke="#10b981" name="Traces/min" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success vs Error Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="success" stackId="1" stroke="#10b981" fill="#10b981" />
                    <Area type="monotone" dataKey="errors" stackId="1" stroke="#ef4444" fill="#ef4444" />
                  </AreaChart>
                </ResponsiveContainer>
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
                  <Select value={modelFilter} onValueChange={setModelFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5</SelectItem>
                      <SelectItem value="claude-3-opus">Claude Opus</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude Sonnet</SelectItem>
                      <SelectItem value="claude-3-haiku">Claude Haiku</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex h-[600px]">
                {/* Trace List */}
                <div className="w-1/2 border-r">
                  <ScrollArea className="h-full">
                    <div className="divide-y">
                      {filteredTraces.map((trace) => (
                        <div
                          key={trace.id}
                          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                            selectedTrace?.id === trace.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                          onClick={() => setSelectedTrace(trace)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon(trace.status)}
                                <h4 className="font-medium text-sm">{trace.name}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {trace.model}
                                </Badge>
                                {trace.status === 'running' && (
                                  <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 animate-pulse">
                                    Live
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                {trace.input}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>{trace.timestamp.toLocaleTimeString()}</span>
                                <span>{trace.duration}ms</span>
                                <span>${trace.totalCost.toFixed(4)}</span>
                                <span>{trace.promptTokens + trace.completionTokens} tokens</span>
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
                            <h3 className="text-lg font-semibold">{selectedTrace.name}</h3>
                            <Badge className={getStatusColor(selectedTrace.status)}>
                              {selectedTrace.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Session ID:</span>
                              <p className="font-mono text-xs">{selectedTrace.sessionId}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Model:</span>
                              <p>{selectedTrace.model}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Duration:</span>
                              <p>{selectedTrace.duration}ms</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Cost:</span>
                              <p>${selectedTrace.totalCost.toFixed(4)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Agent:</span>
                              <p>{selectedTrace.agentId}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Memory:</span>
                              <p>{selectedTrace.memoryUsage}MB</p>
                            </div>
                          </div>
                        </div>

                        <Tabs defaultValue="io" className="w-full">
                          <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="io">I/O</TabsTrigger>
                            <TabsTrigger value="metadata">Metadata</TabsTrigger>
                            <TabsTrigger value="scores">Scores</TabsTrigger>
                            <TabsTrigger value="performance">Performance</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="io" className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Input</h4>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                                {selectedTrace.input}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium mb-2">Output</h4>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                                {selectedTrace.output}
                              </pre>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="metadata">
                            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                              {JSON.stringify(selectedTrace.metadata, null, 2)}
                            </pre>
                          </TabsContent>
                          
                          <TabsContent value="scores">
                            {selectedTrace.scores && (
                              <div className="space-y-3">
                                {Object.entries(selectedTrace.scores).map(([key, value]) => (
                                  <div key={key}>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-sm capitalize">{key}</span>
                                      <span className="text-sm font-medium">{(value * 100).toFixed(0)}%</span>
                                    </div>
                                    <Progress value={value * 100} className="h-2" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="performance">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-sm text-gray-500">CPU Usage:</span>
                                  <div className="flex items-center space-x-2">
                                    <Progress value={selectedTrace.cpuUsage} className="flex-1 h-2" />
                                    <span className="text-sm font-medium">{selectedTrace.cpuUsage}%</span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-sm text-gray-500">Memory Usage:</span>
                                  <div className="flex items-center space-x-2">
                                    <Progress value={(selectedTrace.memoryUsage || 0) / 10} className="flex-1 h-2" />
                                    <span className="text-sm font-medium">{selectedTrace.memoryUsage}MB</span>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Prompt Tokens:</span>
                                  <p className="font-medium">{selectedTrace.promptTokens.toLocaleString()}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Completion Tokens:</span>
                                  <p className="font-medium">{selectedTrace.completionTokens.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
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
              <Card key={agent.id} className="transition-all duration-200 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1 rounded ${
                        agent.status === 'active' ? 'text-green-600 bg-green-50' :
                        agent.status === 'idle' ? 'text-gray-600 bg-gray-50' :
                        agent.status === 'error' ? 'text-red-600 bg-red-50' :
                        'text-gray-600 bg-gray-50'
                      }`}>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-xs text-gray-600">{agent.id}</div>
                      </div>
                    </div>
                    <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {agent.currentTask && (
                    <div className="text-sm">
                      <span className="text-gray-500">Current Task:</span>
                      <p className="text-xs mt-1 p-2 bg-blue-50 rounded">{agent.currentTask}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="font-bold text-blue-600">{agent.tasksCompleted}</div>
                      <div className="text-blue-600 text-xs">Completed</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="font-bold text-purple-600">{agent.averageResponseTime}ms</div>
                      <div className="text-purple-600 text-xs">Avg Response</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>CPU</span>
                        <span>{agent.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <Progress value={agent.cpuUsage} className="h-1.5" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Memory</span>
                        <span>{agent.memoryUsage.toFixed(1)}%</span>
                      </div>
                      <Progress value={agent.memoryUsage} className="h-1.5" />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 border-t pt-2">
                    <div className="flex justify-between">
                      <span>Last activity</span>
                      <span>{agent.lastActivity.toLocaleTimeString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgDuration" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Token Usage by Model</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tokenData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ model, tokens }) => `${model}: ${tokens.toLocaleString()}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="tokens"
                    >
                      {tokenData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Traces</p>
                    <p className="text-2xl font-bold">{traces.length}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold">
                      {traces.length > 0 
                        ? ((traces.filter(t => t.status === 'success').length / traces.length) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Cost</p>
                    <p className="text-2xl font-bold">
                      ${traces.length > 0 
                        ? (traces.reduce((sum, t) => sum + t.totalCost, 0) / traces.length).toFixed(4)
                        : 0}
                    </p>
                  </div>
                  <Database className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Models</p>
                    <p className="text-2xl font-bold">
                      {new Set(traces.map(t => t.model)).size}
                    </p>
                  </div>
                  <Brain className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}