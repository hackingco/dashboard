'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Users, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Play,
  Pause,
  Square,
  RefreshCw
} from 'lucide-react';

interface SwarmAgent {
  id: string;
  name: string;
  type: 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'tester' | 'reviewer';
  status: 'active' | 'idle' | 'error' | 'offline';
  currentTask?: string;
  tasksCompleted: number;
  successRate: number;
  lastActivity: Date;
  cpuUsage: number;
  memoryUsage: number;
}

interface SwarmStatus {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  agents: SwarmAgent[];
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  startTime: Date;
  lastUpdate: Date;
  performance: {
    throughput: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

interface SwarmStatusDisplayProps {
  swarmId?: string;
  onSwarmAction?: (action: 'start' | 'pause' | 'stop' | 'restart', swarmId: string) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function SwarmStatusDisplay({ 
  swarmId = 'default-swarm',
  onSwarmAction,
  autoRefresh = true,
  refreshInterval = 5000 
}: SwarmStatusDisplayProps) {
  const [swarmStatus, setSwarmStatus] = useState<SwarmStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Generate mock swarm status
  const generateMockSwarmStatus = (): SwarmStatus => {
    const agentTypes: SwarmAgent['type'][] = ['coordinator', 'researcher', 'coder', 'analyst', 'tester', 'reviewer'];
    const statuses: SwarmAgent['status'][] = ['active', 'idle', 'error', 'offline'];
    
    const agents: SwarmAgent[] = Array.from({ length: 6 }, (_, i) => ({
      id: `agent-${i + 1}`,
      name: `${agentTypes[i % agentTypes.length]}-${i + 1}`.replace(/^\w/, c => c.toUpperCase()),
      type: agentTypes[i % agentTypes.length],
      status: i < 4 ? 'active' : statuses[Math.floor(Math.random() * statuses.length)],
      currentTask: i < 4 ? `Processing task ${Math.floor(Math.random() * 100)}` : undefined,
      tasksCompleted: Math.floor(Math.random() * 100) + 10,
      successRate: 0.85 + Math.random() * 0.15,
      lastActivity: new Date(Date.now() - Math.random() * 300000), // last 5 minutes
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
    }));

    const totalTasks = Math.floor(Math.random() * 500) + 100;
    const completedTasks = Math.floor(totalTasks * 0.8);
    const failedTasks = Math.floor(totalTasks * 0.05);

    return {
      id: swarmId,
      name: `Swarm ${swarmId.split('-').pop()}`,
      status: 'running',
      agents,
      totalTasks,
      completedTasks,
      failedTasks,
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      lastUpdate: new Date(),
      performance: {
        throughput: Math.random() * 50 + 20,
        errorRate: Math.random() * 5,
        avgResponseTime: Math.random() * 1000 + 200,
      },
    };
  };

  const fetchSwarmStatus = async () => {
    setIsLoading(true);
    try {
      // In production, this would fetch from the API
      await new Promise(resolve => setTimeout(resolve, 500));
      setSwarmStatus(generateMockSwarmStatus());
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch swarm status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSwarmStatus();
  }, [swarmId]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchSwarmStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'active':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'paused':
      case 'idle':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'stopped':
      case 'offline':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      case 'error':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'active':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'paused':
      case 'idle':
        return <Clock className="w-4 h-4" />;
      case 'error':
        return <XCircle className="w-4 h-4" />;
      case 'offline':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const handleSwarmAction = (action: 'start' | 'pause' | 'stop' | 'restart') => {
    onSwarmAction?.(action, swarmId);
    // Optimistically update the status
    if (swarmStatus) {
      const newStatus = action === 'start' || action === 'restart' ? 'running' : 
                       action === 'pause' ? 'paused' : 'stopped';
      setSwarmStatus({
        ...swarmStatus,
        status: newStatus as any,
        lastUpdate: new Date(),
      });
    }
  };

  if (isLoading && !swarmStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  if (!swarmStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64 text-gray-500">
          Failed to load swarm status
        </CardContent>
      </Card>
    );
  }

  const completionRate = (swarmStatus.completedTasks / swarmStatus.totalTasks) * 100;
  const activeAgents = swarmStatus.agents.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Swarm Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                {swarmStatus.name}
              </CardTitle>
              <Badge className={getStatusColor(swarmStatus.status)}>
                {getStatusIcon(swarmStatus.status)}
                <span className="ml-1 capitalize">{swarmStatus.status}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleSwarmAction('start')}
                disabled={swarmStatus.status === 'running'}
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleSwarmAction('pause')}
                disabled={swarmStatus.status === 'paused'}
              >
                <Pause className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleSwarmAction('stop')}
                disabled={swarmStatus.status === 'stopped'}
              >
                <Square className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={fetchSwarmStatus}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{activeAgents}</div>
              <div className="text-sm text-gray-500">Active Agents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{swarmStatus.completedTasks}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{swarmStatus.performance.throughput.toFixed(1)}</div>
              <div className="text-sm text-gray-500">Tasks/min</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{swarmStatus.performance.errorRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Error Rate</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{completionRate.toFixed(1)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>

          <div className="mt-4 text-xs text-gray-500">
            Started: {swarmStatus.startTime.toLocaleString()} • 
            Last update: {lastRefresh.toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>

      {/* Agent Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {swarmStatus.agents.map((agent) => (
          <Card key={agent.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
                <Badge variant="outline" className={getStatusColor(agent.status)}>
                  {getStatusIcon(agent.status)}
                  <span className="ml-1 capitalize">{agent.status}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {agent.currentTask && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Current Task</div>
                  <div className="text-sm line-clamp-2">{agent.currentTask}</div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Completed</div>
                  <div className="font-medium">{agent.tasksCompleted}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Success Rate</div>
                  <div className="font-medium">{(agent.successRate * 100).toFixed(0)}%</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>CPU</span>
                  <span>{agent.cpuUsage.toFixed(0)}%</span>
                </div>
                <Progress value={agent.cpuUsage} className="h-1" />
                
                <div className="flex justify-between text-xs">
                  <span>Memory</span>
                  <span>{agent.memoryUsage.toFixed(0)}%</span>
                </div>
                <Progress value={agent.memoryUsage} className="h-1" />
              </div>

              <div className="text-xs text-gray-500">
                Last active: {agent.lastActivity.toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}