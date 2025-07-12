'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Server, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase, swarmOperations, workerOperations, taskOperations, logOperations, statsOperations } from '@/lib/supabase-client';
import type { Database } from '@swarm/supabase';

type Swarm = Database['public']['Tables']['swarms']['Row'];
type Worker = Database['public']['Tables']['workers']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Log = Database['public']['Tables']['logs']['Row'];

interface SwarmStatusRealtimeProps {
  swarmId: string;
}

export function SwarmStatusRealtime({ swarmId }: SwarmStatusRealtimeProps) {
  const [swarm, setSwarm] = useState<Swarm | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadSwarmData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all data in parallel
      const [swarmData, workersData, tasksData, logsData, statsData] = await Promise.all([
        swarmOperations.get(swarmId),
        workerOperations.listBySwarm(swarmId),
        taskOperations.listBySwarm(swarmId),
        logOperations.listBySwarm(swarmId, 20),
        statsOperations.getSwarmStats(swarmId)
      ]);

      setSwarm(swarmData);
      setWorkers(workersData);
      setTasks(tasksData);
      setLogs(logsData);
      setStats(statsData[0] || null);
      setError(null);
    } catch (err) {
      setError('Failed to load swarm data');
      console.error('Error loading swarm data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!swarmId) return;

    // Initial load
    loadSwarmData();

    // Subscribe to swarm updates
    const swarmSub = swarmOperations.subscribe((payload) => {
      if (payload.new && payload.new.id === swarmId) {
        setSwarm(payload.new as Swarm);
      }
    });

    // Subscribe to worker updates
    const workerSub = workerOperations.subscribeToSwarm(swarmId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setWorkers(prev => [...prev, payload.new as Worker]);
      } else if (payload.eventType === 'UPDATE') {
        setWorkers(prev => prev.map(w => w.id === payload.new.id ? payload.new as Worker : w));
      } else if (payload.eventType === 'DELETE') {
        setWorkers(prev => prev.filter(w => w.id !== payload.old.id));
      }
    });

    // Subscribe to logs
    const logSub = logOperations.subscribeToSwarm(swarmId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setLogs(prev => [payload.new as Log, ...prev].slice(0, 20));
      }
    });

    // Refresh stats periodically
    const statsInterval = setInterval(async () => {
      try {
        const statsData = await statsOperations.getSwarmStats(swarmId);
        setStats(statsData[0] || null);
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    }, 5000);

    // Cleanup
    return () => {
      swarmSub.unsubscribe();
      workerSub.unsubscribe();
      logSub.unsubscribe();
      clearInterval(statsInterval);
    };
  }, [swarmId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error || !swarm) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-red-500">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p>{error || 'Swarm not found'}</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const activeWorkers = workers.filter(w => w.status === 'active').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const runningTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'running').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Swarm Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                {swarm.name}
                {getStatusIcon(swarm.status)}
              </CardTitle>
              <p className="text-muted-foreground mt-1">{swarm.purpose}</p>
            </div>
            <Badge className={swarm.status === 'running' ? 'bg-green-500' : 'bg-gray-500'}>
              {swarm.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Workers</p>
                <p className="text-lg font-semibold">{activeWorkers}/{workers.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Tasks Running</p>
                <p className="text-lg font-semibold">{runningTasks}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-lg font-semibold">{completedTasks}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="text-lg font-semibold">
                  {formatDistanceToNow(new Date(swarm.created_at), { addSuffix: false })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.map(worker => (
          <Card key={worker.id} className="relative">
            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
              worker.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{worker.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span>{worker.type}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="text-xs">
                    {worker.status}
                  </Badge>
                </div>
                {worker.last_heartbeat && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Heartbeat</span>
                    <span className="text-xs">
                      {formatDistanceToNow(new Date(worker.last_heartbeat), { addSuffix: true })}
                    </span>
                  </div>
                )}
                {(worker.metrics as any)?.tasks_completed && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tasks</span>
                    <span>{(worker.metrics as any).tasks_completed}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task Progress */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Overall Progress</span>
                  <span className="text-sm font-medium">
                    {completedTasks}/{tasks.length} tasks
                  </span>
                </div>
                <Progress value={(completedTasks / tasks.length) * 100} className="h-2" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{pendingTasks}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{runningTasks}</p>
                  <p className="text-sm text-muted-foreground">Running</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Real-time Logs
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No logs yet</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <span className={`text-xs font-mono ${
                    log.level === 'error' ? 'text-red-500' :
                    log.level === 'warn' ? 'text-yellow-500' :
                    log.level === 'info' ? 'text-blue-500' :
                    'text-gray-500'
                  }`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                  <span className="flex-1">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}