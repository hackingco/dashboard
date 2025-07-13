'use client';

import { useState, useEffect } from 'react';
import { SwarmOverview } from '@/components/SwarmOverview';
import { SwarmMetrics } from '@/components/SwarmMetrics';
import { RecentActivity } from '@/components/RecentActivity';
import { SwarmList } from '@/components/SwarmList';
import { SwarmTopology } from '@/components/observability/SwarmTopology';
import { TaskTimeline } from '@/components/observability/TaskTimeline';
import { PerformanceMonitor } from '@/components/observability/PerformanceMonitor';
import { LogViewer } from '@/components/observability/LogViewer';
import { TrustGraph } from '@/components/observability/TrustGraph';
import { LangfuseTraces } from '@/components/observability/LangfuseTraces';
import { SwarmStatusDisplay } from '@/components/SwarmStatusDisplay';
import { SwarmStatusRealtime } from '@/components/SwarmStatusRealtime';
import { ObservabilityDashboard } from '@/components/observability/ObservabilityDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SwarmLaunchForm } from '@/components/SwarmLaunchForm';
import { RefreshCw, Plus, Activity, Network, Terminal, BarChart3, Rocket, Eye, GitBranch, Zap, Brain } from 'lucide-react';
import { supabase, swarmOperations } from '@/lib/supabase-client';
import type { Database } from '@swarm/supabase';

// Mock data generators
const generateMockNodes = () => [
  { id: 'swarm-1', type: 'swarm' as const, label: 'Primary Swarm', status: 'active' as const, metrics: { cpu: 45, memory: 62 } },
  { id: 'swarm-2', type: 'swarm' as const, label: 'Analytics Swarm', status: 'active' as const, metrics: { cpu: 78, memory: 85 } },
  { id: 'worker-1', type: 'worker' as const, label: 'Researcher-01', status: 'active' as const, metrics: { tasksCompleted: 156 } },
  { id: 'worker-2', type: 'worker' as const, label: 'Coder-01', status: 'active' as const, metrics: { tasksCompleted: 89 } },
  { id: 'worker-3', type: 'worker' as const, label: 'Analyst-01', status: 'idle' as const, metrics: { tasksCompleted: 234 } },
  { id: 'task-1', type: 'task' as const, label: 'Process Data', status: 'active' as const },
  { id: 'task-2', type: 'task' as const, label: 'Generate Report', status: 'active' as const },
];

const generateMockEdges = () => [
  { source: 'swarm-1', target: 'worker-1', label: 'assigned' },
  { source: 'swarm-1', target: 'worker-2', label: 'assigned' },
  { source: 'swarm-2', target: 'worker-3', label: 'assigned' },
  { source: 'worker-1', target: 'task-1', label: 'processing' },
  { source: 'worker-2', target: 'task-2', label: 'processing' },
];

const generateMockTimelineEvents = () => {
  const events = [];
  const types = ['task_created', 'task_started', 'task_completed', 'task_failed', 'worker_assigned'];
  const tasks = ['analyze-data', 'generate-report', 'process-batch', 'train-model'];
  const workers = ['researcher-01', 'coder-01', 'analyst-01', 'tester-01'];
  
  for (let i = 0; i < 20; i++) {
    events.push({
      id: `event-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      type: types[Math.floor(Math.random() * types.length)] as any,
      taskId: `task-${tasks[Math.floor(Math.random() * tasks.length)]}-${Math.floor(Math.random() * 1000)}`,
      workerId: Math.random() > 0.3 ? workers[Math.floor(Math.random() * workers.length)] : undefined,
      swarmId: Math.random() > 0.5 ? 'swarm-1' : 'swarm-2',
      message: `Task ${tasks[Math.floor(Math.random() * tasks.length)]} ${types[Math.floor(Math.random() * types.length)].replace(/_/g, ' ')}`,
      metadata: Math.random() > 0.7 ? { duration: Math.floor(Math.random() * 1000), retries: Math.floor(Math.random() * 3) } : undefined,
    });
  }
  return events;
};

const generateMockMetrics = () => {
  const generateTimeSeries = (baseValue: number, variance: number) => {
    const data = [];
    for (let i = 0; i < 60; i++) {
      data.push({
        timestamp: new Date(Date.now() - (60 - i) * 60000),
        value: baseValue + (Math.random() - 0.5) * variance,
      });
    }
    return data;
  };

  return {
    cpu: generateTimeSeries(45, 20),
    memory: generateTimeSeries(62, 15),
    network: generateTimeSeries(100, 50),
    taskThroughput: generateTimeSeries(10, 5),
    errorRate: generateTimeSeries(2, 2),
    latency: generateTimeSeries(150, 50),
  };
};

const generateMockLogs = () => {
  const logs = [];
  const levels = ['debug', 'info', 'warn', 'error'];
  const sources = ['swarm-manager', 'worker-01', 'worker-02', 'task-processor', 'api-gateway'];
  const messages = [
    'Task assigned to worker',
    'Processing started for batch',
    'Memory usage above threshold',
    'Connection timeout to database',
    'Successfully completed analysis',
    'Retrying failed operation',
    'New swarm instance created',
    'Health check passed',
  ];

  for (let i = 0; i < 100; i++) {
    logs.push({
      id: `log-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      level: levels[Math.floor(Math.random() * levels.length)] as any,
      source: sources[Math.floor(Math.random() * sources.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      metadata: Math.random() > 0.7 ? { 
        taskId: `task-${Math.floor(Math.random() * 1000)}`,
        duration: Math.floor(Math.random() * 1000) 
      } : undefined,
    });
  }
  return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

type Swarm = Database['public']['Tables']['swarms']['Row'];

export default function DashboardPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLaunchDialogOpen, setIsLaunchDialogOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [nodes, setNodes] = useState(generateMockNodes());
  const [edges, setEdges] = useState(generateMockEdges());
  const [timelineEvents, setTimelineEvents] = useState(generateMockTimelineEvents());
  const [metrics, setMetrics] = useState(generateMockMetrics());
  const [logs, setLogs] = useState(generateMockLogs());
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [selectedSwarmId, setSelectedSwarmId] = useState<string | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setNodes(generateMockNodes());
      setEdges(generateMockEdges());
      setTimelineEvents(generateMockTimelineEvents());
      setMetrics(generateMockMetrics());
      setLogs(generateMockLogs());
      setIsRefreshing(false);
    }, 1000);
  };

  const handleLaunchSwarm = async (formData: any) => {
    setIsLaunching(true);
    try {
      // Call the API to launch the swarm
      const response = await fetch('/api/swarms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.appName,
          purpose: 'AI Worker Swarm',
          workerCount: 1,
          config: {
            ...formData.config,
            region: formData.region,
            dockerImage: formData.dockerImage,
            env: formData.env,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to launch swarm');
      }

      const swarm = await response.json();
      console.log('Swarm launched:', swarm);
      
      // Close dialog and refresh data
      setIsLaunchDialogOpen(false);
      handleRefresh();
    } catch (error) {
      console.error('Error launching swarm:', error);
      alert('Failed to launch swarm. Please try again.');
    } finally {
      setIsLaunching(false);
    }
  };

  // Fetch real swarms
  const fetchSwarms = async () => {
    try {
      const swarmsList = await swarmOperations.list();
      setSwarms(swarmsList);
      if (swarmsList.length > 0 && !selectedSwarmId) {
        setSelectedSwarmId(swarmsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching swarms:', error);
    }
  };

  // Initial load and real-time subscriptions
  useEffect(() => {
    // Fetch swarms on mount
    fetchSwarms();

    // Subscribe to swarm changes
    const subscription = swarmOperations.subscribe((payload) => {
      fetchSwarms(); // Refresh when any swarm changes
    });

    // Simulate metric updates for demo
    const interval = setInterval(() => {
      // Add new log entries
      setLogs(prev => [...prev, ...generateMockLogs().slice(0, 1)].slice(-100));
      
      // Update metrics
      setMetrics(prev => ({
        ...prev,
        cpu: [...prev.cpu.slice(1), {
          timestamp: new Date(),
          value: 45 + (Math.random() - 0.5) * 20,
        }],
        memory: [...prev.memory.slice(1), {
          timestamp: new Date(),
          value: 62 + (Math.random() - 0.5) * 15,
        }],
        taskThroughput: [...prev.taskThroughput.slice(1), {
          timestamp: new Date(),
          value: 10 + (Math.random() - 0.5) * 5,
        }],
      }));
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Swarm Admin Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and monitor your AI swarm deployments</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={isLaunchDialogOpen} onOpenChange={setIsLaunchDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Launch Swarm
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Launch New Swarm</DialogTitle>
                  </DialogHeader>
                  <SwarmLaunchForm onSubmit={handleLaunchSwarm} isLoading={isLaunching} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Swarms</CardTitle>
              <Rocket className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{swarms.filter(s => s.status === 'running').length}</div>
              <p className="text-xs text-muted-foreground">{swarms.length} total swarms</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{swarms.reduce((acc, s) => acc + s.worker_count, 0)}</div>
              <p className="text-xs text-muted-foreground">Across all swarms</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
              <BarChart3 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {swarms.reduce((acc, s) => acc + ((s.metrics as any)?.tasks_completed || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">Total completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Eye className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {swarms.length > 0 ? (
                  (swarms.reduce((acc, s) => {
                    const completed = (s.metrics as any)?.tasks_completed || 0;
                    const failed = (s.metrics as any)?.tasks_failed || 0;
                    return acc + (completed / (completed + failed || 1));
                  }, 0) / swarms.length * 100).toFixed(1)
                ) : '0'}%
              </div>
              <p className="text-xs text-muted-foreground">Average across swarms</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="swarms" className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-6">
            <TabsTrigger value="swarms" className="flex items-center">
              <Rocket className="w-4 h-4 mr-2" />
              Swarms
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center">
              <Zap className="w-4 h-4 mr-2" />
              Real-time
            </TabsTrigger>
            <TabsTrigger value="topology" className="flex items-center">
              <Network className="w-4 h-4 mr-2" />
              Topology
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="observability" className="flex items-center">
              <Eye className="w-4 h-4 mr-2" />
              Observability
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center">
              <Terminal className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="swarms" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SwarmList />
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full justify-start" variant="outline">
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Swarm
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Launch New Swarm</DialogTitle>
                        </DialogHeader>
                        <SwarmLaunchForm onSubmit={handleLaunchSwarm} isLoading={isLaunching} />
                      </DialogContent>
                    </Dialog>
                    <Button className="w-full justify-start" variant="outline">
                      <Rocket className="w-4 h-4 mr-2" />
                      Deploy from Template
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Activity className="w-4 h-4 mr-2" />
                      Scale Existing Swarm
                    </Button>
                  </CardContent>
                </Card>
                <SwarmOverview />
                <RecentActivity />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-6">
            {selectedSwarmId ? (
              <SwarmStatusRealtime swarmId={selectedSwarmId} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Rocket className="w-12 h-12 mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No swarm selected</p>
                  <p className="text-sm mt-2">Create a swarm to see real-time status</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="topology" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SwarmTopology nodes={nodes} edges={edges} />
              <TaskTimeline events={timelineEvents} />
            </div>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceMonitor metrics={metrics} />
              <PerformanceMonitor 
                swarmId="swarm-1" 
                metrics={metrics} 
              />
            </div>
            <div className="mt-6">
              <SwarmMetrics />
            </div>
          </TabsContent>

          <TabsContent value="observability" className="space-y-6">
            <ObservabilityDashboard />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <LogViewer 
              logs={logs} 
              sources={['swarm-manager', 'worker-01', 'worker-02', 'task-processor', 'api-gateway']}
              onRefresh={handleRefresh}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}