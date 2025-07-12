import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Activity, Users, Monitor, Zap, ArrowUp, ArrowDown, Clock, AlertTriangle } from 'lucide-react';
import { telemetryService, type SystemMetrics, type SwarmTelemetry, type LogEntry } from '../services/realtime';

export function Dashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [swarms, setSwarms] = useState<SwarmTelemetry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [previousMetrics, setPreviousMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    // Initialize data
    setMetrics(telemetryService.getCurrentMetrics());
    setSwarms(telemetryService.getSwarms());
    setLogs(telemetryService.getLogs(10));

    // Subscribe to real-time updates
    const metricsUnsubscribe = telemetryService.subscribe('metrics', (newMetrics: SystemMetrics) => {
      setPreviousMetrics(metrics);
      setMetrics(newMetrics);
    });

    const swarmsUnsubscribe = telemetryService.subscribe('swarms', (newSwarms: SwarmTelemetry[]) => {
      setSwarms(newSwarms);
    });

    const logsUnsubscribe = telemetryService.subscribe('logs', (newLog: LogEntry) => {
      setLogs(prev => [newLog, ...prev.slice(0, 9)]);
    });

    return () => {
      metricsUnsubscribe();
      swarmsUnsubscribe();
      logsUnsubscribe();
    };
  }, [metrics]);

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading telemetry data...</p>
        </div>
      </div>
    );
  }

  const calculateChange = (current: number, previous: number | undefined): { value: string; type: 'increase' | 'decrease' } => {
    if (!previous) return { value: '+0%', type: 'increase' };
    const change = ((current - previous) / previous) * 100;
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      type: change >= 0 ? 'increase' : 'decrease'
    };
  };

  const stats = [
    {
      name: 'Active Swarms',
      value: metrics.swarms.active.toString(),
      change: calculateChange(metrics.swarms.active, previousMetrics?.swarms.active),
      icon: Users,
    },
    {
      name: 'Running Workers',
      value: metrics.workers.active.toString(),
      change: calculateChange(metrics.workers.active, previousMetrics?.workers.active),
      icon: Monitor,
    },
    {
      name: 'Tasks Completed',
      value: metrics.tasks.completed.toLocaleString(),
      change: calculateChange(metrics.tasks.completed, previousMetrics?.tasks.completed),
      icon: Activity,
    },
    {
      name: 'System Load',
      value: `${Math.round(metrics.cpu.usage)}%`,
      change: calculateChange(metrics.cpu.usage, previousMetrics?.cpu.usage),
      icon: Zap,
    },
  ];

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return AlertTriangle;
      case 'warn': return AlertTriangle;
      default: return Activity;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time swarm infrastructure monitoring</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Live Data
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="glass">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <p className="text-xs flex items-center gap-1 mt-1">
                {stat.change.type === 'increase' ? (
                  <ArrowUp className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-red-500" />
                )}
                <span className={stat.change.type === 'increase' ? 'text-green-500' : 'text-red-500'}>
                  {stat.change.value}
                </span>
                <span className="text-gray-400">from last update</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Performance Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">CPU Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{Math.round(metrics.cpu.usage)}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${metrics.cpu.usage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-1">{metrics.cpu.cores} cores @ {metrics.cpu.frequency}GHz</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{Math.round(metrics.memory.used)}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${metrics.memory.used}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-1">{metrics.memory.total}GB total</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Network I/O</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">In</span>
                <span className="text-sm text-white">{Math.round(metrics.network.inbound)} MB/s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Out</span>
                <span className="text-sm text-white">{Math.round(metrics.network.outbound)} MB/s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Connections</span>
                <span className="text-sm text-white">{metrics.network.connections}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Swarms */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Active Swarms</CardTitle>
          <CardDescription>Real-time status of your swarm clusters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {swarms.filter(s => s.status !== 'stopped').map((swarm) => (
              <div key={swarm.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    swarm.status === 'running' ? 'bg-green-500' :
                    swarm.status === 'scaling' ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-500'
                  }`}></div>
                  <div>
                    <h4 className="text-sm font-medium text-white">{swarm.name}</h4>
                    <p className="text-xs text-gray-400">{swarm.region} • {swarm.workers.active}/{swarm.workers.total} workers</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{swarm.tasks.running} running</div>
                  <div className="text-xs text-gray-400">{swarm.tasks.completed} completed</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest events from your swarm network</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {logs.map((log) => {
              const LevelIcon = getLevelIcon(log.level);
              return (
                <div key={log.id} className="flex items-start gap-4">
                  <LevelIcon className={`w-4 h-4 mt-0.5 ${getLevelColor(log.level)}`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-300">{log.message}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        log.level === 'error' ? 'bg-red-900/50 text-red-300' :
                        log.level === 'warn' ? 'bg-yellow-900/50 text-yellow-300' :
                        log.level === 'info' ? 'bg-blue-900/50 text-blue-300' :
                        'bg-gray-900/50 text-gray-400'
                      }`}>
                        {log.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                      <span>•</span>
                      <span>{log.source}</span>
                      {log.swarmId && (
                        <>
                          <span>•</span>
                          <span className="text-blue-400">{log.swarmId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button>Create New Swarm</Button>
            <Button variant="outline">Deploy Workers</Button>
            <Button variant="outline">View All Logs</Button>
            <Button variant="outline">System Health Check</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

