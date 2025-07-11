'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Rocket, 
  Activity, 
  Clock, 
  Server, 
  PlayCircle, 
  PauseCircle, 
  Trash2,
  RefreshCw,
  MoreVertical
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Swarm {
  id: string;
  name: string;
  purpose: string;
  status: 'initializing' | 'running' | 'stopped' | 'error';
  workerCount: number;
  createdAt: string;
  updatedAt: string;
  config: {
    maxWorkers: number;
    taskTimeout: number;
    retryLimit: number;
  };
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    averageTaskTime: number;
  };
  error?: string;
}

export function SwarmList() {
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSwarms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/swarms');
      if (!response.ok) throw new Error('Failed to fetch swarms');
      const data = await response.json();
      setSwarms(data);
      setError(null);
    } catch (err) {
      setError('Failed to load swarms');
      console.error('Error fetching swarms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSwarms();
    const interval = setInterval(fetchSwarms, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleScale = async (swarmId: string, newCount: number) => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerCount: newCount }),
      });
      if (!response.ok) throw new Error('Failed to scale swarm');
      fetchSwarms();
    } catch (err) {
      console.error('Error scaling swarm:', err);
    }
  };

  const handleStop = async (swarmId: string) => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to stop swarm');
      fetchSwarms();
    } catch (err) {
      console.error('Error stopping swarm:', err);
    }
  };

  const handleStart = async (swarmId: string) => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerCount: 1 }),
      });
      if (!response.ok) throw new Error('Failed to start swarm');
      fetchSwarms();
    } catch (err) {
      console.error('Error starting swarm:', err);
    }
  };

  const getStatusBadge = (status: Swarm['status']) => {
    const variants = {
      initializing: { color: 'bg-yellow-500', text: 'Initializing' },
      running: { color: 'bg-green-500', text: 'Running' },
      stopped: { color: 'bg-gray-500', text: 'Stopped' },
      error: { color: 'bg-red-500', text: 'Error' },
    };
    const variant = variants[status];
    return (
      <Badge className={`${variant.color} text-white`}>
        {variant.text}
      </Badge>
    );
  };

  if (isLoading && swarms.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64 text-red-500">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (swarms.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Rocket className="w-12 h-12 mb-4 text-gray-300" />
          <p className="text-lg font-medium">No swarms deployed</p>
          <p className="text-sm mt-2">Launch your first swarm to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {swarms.map((swarm) => (
        <Card key={swarm.id} className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  {swarm.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{swarm.purpose}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(swarm.status)}
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  Workers
                </p>
                <p className="text-lg font-semibold">
                  {swarm.workerCount} / {swarm.config.maxWorkers}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  Tasks Completed
                </p>
                <p className="text-lg font-semibold">{swarm.metrics.tasksCompleted}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Avg Task Time
                </p>
                <p className="text-lg font-semibold">{swarm.metrics.averageTaskTime}ms</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Uptime</p>
                <p className="text-lg font-semibold">
                  {formatDistanceToNow(new Date(swarm.createdAt), { addSuffix: false })}
                </p>
              </div>
            </div>

            {swarm.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
                <p className="text-sm text-red-600 dark:text-red-400">{swarm.error}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              {swarm.status === 'running' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStop(swarm.id)}
                  >
                    <PauseCircle className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScale(swarm.id, swarm.workerCount + 1)}
                    disabled={swarm.workerCount >= swarm.config.maxWorkers}
                  >
                    Scale Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScale(swarm.id, swarm.workerCount - 1)}
                    disabled={swarm.workerCount <= 1}
                  >
                    Scale Down
                  </Button>
                </>
              ) : swarm.status === 'stopped' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStart(swarm.id)}
                >
                  <PlayCircle className="w-4 h-4 mr-1" />
                  Start
                </Button>
              ) : null}
              
              <div className="ml-auto text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(swarm.updatedAt), { addSuffix: true })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}