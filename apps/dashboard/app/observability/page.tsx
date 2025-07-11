'use client';

import { useState } from 'react';
import { TelemetryDashboard } from '@/components/observability/TelemetryDashboard';
import { LangfuseTraces } from '@/components/observability/LangfuseTraces';
import { PerformanceMonitor } from '@/components/observability/PerformanceMonitor';
import { TrustGraph } from '@/components/observability/TrustGraph';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, BarChart3, GitBranch, Monitor, Zap, RefreshCw } from 'lucide-react';

export default function ObservabilityPage() {
  const [selectedSwarm, setSelectedSwarm] = useState<string>('');
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);

  // Mock swarm data for selection
  const availableSwarms = [
    { id: '', name: 'All Swarms' },
    { id: 'swarm-1', name: 'Development Swarm' },
    { id: 'swarm-2', name: 'Production Swarm' },
    { id: 'swarm-3', name: 'Testing Swarm' },
  ];

  // Mock performance metrics data
  const mockPerformanceMetrics = {
    cpu: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000),
      value: Math.random() * 80 + 10
    })),
    memory: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000),
      value: Math.random() * 70 + 20
    })),
    network: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000),
      value: Math.random() * 100
    })),
    taskThroughput: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000),
      value: Math.random() * 50 + 10
    })),
    errorRate: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000),
      value: Math.random() * 5
    })),
    latency: Array.from({ length: 60 }, (_, i) => ({
      timestamp: new Date(Date.now() - (59 - i) * 60000),
      value: Math.random() * 200 + 50
    })),
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Observability Center</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Real-time monitoring, telemetry, and performance analytics for your swarm infrastructure
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={selectedSwarm} onValueChange={setSelectedSwarm}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Swarm" />
              </SelectTrigger>
              <SelectContent>
                {availableSwarms.map((swarm) => (
                  <SelectItem key={swarm.id} value={swarm.id}>
                    {swarm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={refreshInterval.toString()} 
              onValueChange={(value) => setRefreshInterval(parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1s</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
                <SelectItem value="30000">30s</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={isAutoRefresh ? 'default' : 'outline'}
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Auto Refresh
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium">Langfuse</span>
                </div>
                <Badge variant="outline" className="text-green-600 dark:text-green-400">
                  Connected
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-2">Tracing active spans</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-5 h-5 text-purple-500" />
                  <span className="text-sm font-medium">TrustGraph</span>
                </div>
                <Badge variant="outline" className="text-green-600 dark:text-green-400">
                  Connected
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-2">Network topology tracking</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Monitor className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium">Metrics</span>
                </div>
                <Badge variant="outline" className="text-green-600 dark:text-green-400">
                  Collecting
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-2">Performance data streaming</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium">Real-time</span>
                </div>
                <Badge variant="outline" className="text-green-600 dark:text-green-400">
                  {refreshInterval/1000}s refresh
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-2">Live data updates</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Observability Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="traces" className="flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Traces
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center">
              <Monitor className="w-4 h-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="topology" className="flex items-center">
              <GitBranch className="w-4 h-4 mr-2" />
              Topology
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <TelemetryDashboard 
              swarmId={selectedSwarm || undefined}
              refreshInterval={isAutoRefresh ? refreshInterval : undefined}
            />
          </TabsContent>

          <TabsContent value="traces" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <LangfuseTraces 
                sessionId={selectedSwarm || undefined}
              />
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <PerformanceMonitor 
                swarmId={selectedSwarm || undefined}
                metrics={mockPerformanceMetrics}
              />
            </div>
          </TabsContent>

          <TabsContent value="topology" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <TrustGraph 
                swarmId={selectedSwarm || undefined}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Telemetry Integration</CardTitle>
              <CardDescription>
                Non-blocking observability with Langfuse and TrustGraph
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
                <li>• Batched API calls every 5 seconds</li>
                <li>• Automatic retry with exponential backoff</li>
                <li>• Performance metrics collection</li>
                <li>• Real-time span tracking</li>
                <li>• Trust network topology mapping</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Monitoring</CardTitle>
              <CardDescription>
                Advanced analytics and bottleneck detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
                <li>• P50, P95, P99 latency percentiles</li>
                <li>• Resource utilization tracking</li>
                <li>• Error rate and success metrics</li>
                <li>• Task throughput analysis</li>
                <li>• Automated alerting thresholds</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
              <CardDescription>
                Environment variables and setup requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div>
                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    LANGFUSE_SECRET_KEY
                  </span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Required for Langfuse integration</p>
                </div>
                <div>
                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    TRUSTGRAPH_API_KEY
                  </span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Required for TrustGraph integration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}