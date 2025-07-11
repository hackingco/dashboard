'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  BarChart3, 
  Clock, 
  Database, 
  GitBranch, 
  Network, 
  RefreshCw, 
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface TelemetryMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface SpanData {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error' | 'pending';
  parentId?: string;
  input?: any;
  output?: any;
  metadata?: Record<string, any>;
}

interface TrustGraphNode {
  id: string;
  type: string;
  label: string;
  metadata?: Record<string, any>;
}

interface TrustGraphEdge {
  source: string;
  target: string;
  label: string;
  metadata?: Record<string, any>;
}

interface TelemetryDashboardProps {
  swarmId?: string;
  refreshInterval?: number;
}

export function TelemetryDashboard({ swarmId, refreshInterval = 5000 }: TelemetryDashboardProps) {
  const [metrics, setMetrics] = useState<TelemetryMetric[]>([]);
  const [spans, setSpans] = useState<SpanData[]>([]);
  const [nodes, setNodes] = useState<TrustGraphNode[]>([]);
  const [edges, setEdges] = useState<TrustGraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [selectedTab, setSelectedTab] = useState('overview');

  // Mock data generation for demonstration
  const generateMockData = () => {
    const now = new Date();
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[timeRange];

    // Generate metrics
    const metricNames = [
      'span.duration',
      'api.response_time',
      'swarm.creation_time',
      'task.execution_time',
      'error.rate',
      'throughput.tasks_per_minute',
      'memory.usage_mb',
      'cpu.usage_percent'
    ];

    const newMetrics: TelemetryMetric[] = [];
    metricNames.forEach(name => {
      for (let i = 0; i < 50; i++) {
        newMetrics.push({
          name,
          value: Math.random() * 100 + (name.includes('duration') || name.includes('time') ? 100 : 0),
          unit: name.includes('time') || name.includes('duration') ? 'ms' : 
                name.includes('percent') ? '%' : 
                name.includes('mb') ? 'MB' :
                name.includes('rate') ? '/min' : 'count',
          timestamp: new Date(now.getTime() - Math.random() * timeRangeMs),
          tags: {
            swarm: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
            environment: 'production',
            region: 'us-east-1',
          },
        });
      }
    });

    // Generate spans
    const newSpans: SpanData[] = Array.from({ length: 20 }, (_, i) => ({
      id: `span-${i + 1}`,
      name: [
        'SwarmCreation',
        'TaskExecution', 
        'WorkerAssignment',
        'ApiRequest',
        'DatabaseQuery',
        'FileUpload',
        'DataProcessing',
        'ValidationCheck'
      ][Math.floor(Math.random() * 8)],
      startTime: new Date(now.getTime() - Math.random() * timeRangeMs),
      endTime: new Date(now.getTime() - Math.random() * timeRangeMs * 0.8),
      duration: Math.floor(Math.random() * 2000) + 50,
      status: ['success', 'success', 'success', 'error', 'pending'][Math.floor(Math.random() * 5)] as any,
      parentId: i > 5 ? `span-${Math.floor(Math.random() * 5) + 1}` : undefined,
      input: { 
        swarmId: swarmId || `swarm-${Math.floor(Math.random() * 3) + 1}`,
        taskType: 'automated',
        priority: 'high'
      },
      output: { 
        result: 'success',
        processedItems: Math.floor(Math.random() * 100),
        metrics: { cpu: Math.random() * 100, memory: Math.random() * 1024 }
      },
      metadata: {
        version: '1.0.0',
        userId: `user-${Math.floor(Math.random() * 10) + 1}`,
        sessionId: `session-${Math.floor(Math.random() * 5) + 1}`,
      },
    }));

    // Generate TrustGraph nodes and edges
    const nodeTypes = ['swarm', 'worker', 'task', 'manager', 'database'];
    const newNodes: TrustGraphNode[] = Array.from({ length: 15 }, (_, i) => ({
      id: `node-${i + 1}`,
      type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)],
      label: `${nodeTypes[Math.floor(Math.random() * nodeTypes.length)]} ${i + 1}`,
      metadata: {
        createdAt: new Date(now.getTime() - Math.random() * timeRangeMs).toISOString(),
        status: Math.random() > 0.1 ? 'active' : 'inactive',
        region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
      },
    }));

    const edgeLabels = ['deployed', 'assigned', 'executed', 'linked', 'depends_on', 'manages'];
    const newEdges: TrustGraphEdge[] = Array.from({ length: 20 }, (_, i) => ({
      source: `node-${Math.floor(Math.random() * 15) + 1}`,
      target: `node-${Math.floor(Math.random() * 15) + 1}`,
      label: edgeLabels[Math.floor(Math.random() * edgeLabels.length)],
      metadata: {
        createdAt: new Date(now.getTime() - Math.random() * timeRangeMs).toISOString(),
        strength: Math.random(),
        verified: Math.random() > 0.2,
      },
    }));

    return { newMetrics, newSpans, newNodes, newEdges };
  };

  // Fetch telemetry data
  const fetchTelemetryData = async () => {
    setIsLoading(true);
    try {
      // In production, this would make actual API calls to:
      // - GET /api/telemetry/metrics?timeRange=${timeRange}&swarmId=${swarmId}
      // - GET /api/telemetry/spans?timeRange=${timeRange}&swarmId=${swarmId}
      // - GET /api/telemetry/trustgraph/nodes?swarmId=${swarmId}
      // - GET /api/telemetry/trustgraph/edges?swarmId=${swarmId}
      
      const { newMetrics, newSpans, newNodes, newEdges } = generateMockData();
      
      setMetrics(newMetrics);
      setSpans(newSpans);
      setNodes(newNodes);
      setEdges(newEdges);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch telemetry data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetryData();
    const interval = setInterval(fetchTelemetryData, refreshInterval);
    return () => clearInterval(interval);
  }, [timeRange, swarmId, refreshInterval]);

  // Computed metrics
  const computedStats = useMemo(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentSpans = spans.filter(s => s.startTime >= oneHourAgo);
    const successfulSpans = recentSpans.filter(s => s.status === 'success');
    const errorSpans = recentSpans.filter(s => s.status === 'error');
    
    const avgDuration = recentSpans.length > 0 
      ? recentSpans.reduce((sum, s) => sum + (s.duration || 0), 0) / recentSpans.length 
      : 0;
      
    const errorRate = recentSpans.length > 0 
      ? (errorSpans.length / recentSpans.length) * 100 
      : 0;
      
    const throughput = recentSpans.length; // spans per hour
    
    const activeNodes = nodes.filter(n => n.metadata?.status === 'active').length;
    const totalNodes = nodes.length;
    
    return {
      totalSpans: recentSpans.length,
      successRate: recentSpans.length > 0 ? (successfulSpans.length / recentSpans.length) * 100 : 0,
      errorRate,
      avgDuration,
      throughput,
      activeNodes,
      totalNodes,
      nodeHealthRatio: totalNodes > 0 ? (activeNodes / totalNodes) * 100 : 0,
    };
  }, [spans, nodes]);

  const MetricCard = ({ 
    icon: Icon, 
    title, 
    value, 
    unit, 
    trend, 
    color = 'blue',
    status 
  }: {
    icon: any;
    title: string;
    value: number;
    unit: string;
    trend?: number;
    color?: string;
    status?: 'good' | 'warning' | 'error';
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className={`w-5 h-5 text-${color}-500`} />
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
          </div>
          {status && (
            <div className="flex items-center">
              {status === 'good' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
              {status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
            </div>
          )}
        </div>
        <div className="mt-2">
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold">{value.toFixed(1)}</span>
            <span className="text-sm text-gray-500">{unit}</span>
          </div>
          {trend !== undefined && (
            <div className="flex items-center mt-1">
              {trend > 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
              )}
              <span className={`text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {Math.abs(trend).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Telemetry Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {swarmId ? `Monitoring ${swarmId}` : 'System-wide observability and performance metrics'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTelemetryData}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Activity}
          title="Total Operations"
          value={computedStats.totalSpans}
          unit="spans"
          trend={5.2}
          color="blue"
          status={computedStats.totalSpans > 0 ? 'good' : 'warning'}
        />
        <MetricCard
          icon={CheckCircle2}
          title="Success Rate"
          value={computedStats.successRate}
          unit="%"
          trend={-1.2}
          color="green"
          status={computedStats.successRate > 95 ? 'good' : computedStats.successRate > 90 ? 'warning' : 'error'}
        />
        <MetricCard
          icon={Clock}
          title="Avg Duration"
          value={computedStats.avgDuration}
          unit="ms"
          trend={-8.5}
          color="purple"
          status={computedStats.avgDuration < 500 ? 'good' : computedStats.avgDuration < 1000 ? 'warning' : 'error'}
        />
        <MetricCard
          icon={Network}
          title="Active Nodes"
          value={computedStats.activeNodes}
          unit={`/${computedStats.totalNodes}`}
          trend={2.1}
          color="orange"
          status={computedStats.nodeHealthRatio > 90 ? 'good' : computedStats.nodeHealthRatio > 75 ? 'warning' : 'error'}
        />
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="langfuse">Langfuse Traces</TabsTrigger>
          <TabsTrigger value="trustgraph">TrustGraph</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="real-time">Real-time</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Spans */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Recent Operations
                </CardTitle>
                <CardDescription>Latest telemetry spans and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {spans.slice(0, 8).map((span) => (
                    <div key={span.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center space-x-3">
                        {span.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {span.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                        {span.status === 'pending' && <Clock className="w-4 h-4 text-yellow-500" />}
                        <div>
                          <p className="text-sm font-medium">{span.name}</p>
                          <p className="text-xs text-gray-500">{span.startTime.toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={span.status === 'success' ? 'default' : span.status === 'error' ? 'destructive' : 'secondary'}>
                          {span.duration}ms
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* TrustGraph Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <GitBranch className="w-5 h-5 mr-2" />
                  TrustGraph Network
                </CardTitle>
                <CardDescription>Node and edge relationships in the trust network</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{nodes.length}</p>
                      <p className="text-sm text-gray-500">Total Nodes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{edges.length}</p>
                      <p className="text-sm text-gray-500">Total Edges</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {['swarm', 'worker', 'task', 'manager'].map(type => {
                      const count = nodes.filter(n => n.type === type).length;
                      return (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{type} Nodes</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="langfuse">
          <Card>
            <CardHeader>
              <CardTitle>Langfuse Integration Status</CardTitle>
              <CardDescription>Real-time spans and traces from Langfuse observability platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="font-medium">Langfuse Connected</span>
                  </div>
                  <Badge variant="outline" className="text-green-700 dark:text-green-400">
                    {spans.length} spans tracked
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>• Batch flush interval: 5 seconds</p>
                  <p>• Queue size: {Math.floor(Math.random() * 10)} pending</p>
                  <p>• Last flush: {lastRefresh.toLocaleTimeString()}</p>
                  <p>• API endpoint: https://cloud.langfuse.com</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trustgraph">
          <Card>
            <CardHeader>
              <CardTitle>TrustGraph Integration Status</CardTitle>
              <CardDescription>Real-time nodes and edges from TrustGraph trust network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">TrustGraph Connected</span>
                  </div>
                  <Badge variant="outline" className="text-blue-700 dark:text-blue-400">
                    {nodes.length} nodes, {edges.length} edges
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>• Batch flush interval: 5 seconds</p>
                  <p>• Node queue: {Math.floor(Math.random() * 5)} pending</p>
                  <p>• Edge queue: {Math.floor(Math.random() * 8)} pending</p>
                  <p>• Last flush: {lastRefresh.toLocaleTimeString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Detailed performance analytics and bottleneck analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Response Time Distribution</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">P50</span>
                      <span className="text-sm font-medium">250ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">P95</span>
                      <span className="text-sm font-medium">850ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">P99</span>
                      <span className="text-sm font-medium">1.2s</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-3">Resource Utilization</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">CPU Average</span>
                      <span className="text-sm font-medium">45%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Memory Peak</span>
                      <span className="text-sm font-medium">512MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Network I/O</span>
                      <span className="text-sm font-medium">2.3MB/s</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="real-time">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2" />
                Real-time Monitoring
              </CardTitle>
              <CardDescription>Live telemetry feed with auto-refresh every {refreshInterval/1000}s</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded">
                  <span>Live Telemetry Stream</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-600 dark:text-green-400">Active</span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>Last update: {lastRefresh.toLocaleString()}</p>
                  <p>Update frequency: Every {refreshInterval/1000} seconds</p>
                  <p>Data retention: {timeRange}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}