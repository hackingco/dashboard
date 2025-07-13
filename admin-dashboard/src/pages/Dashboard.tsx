import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Activity, Users, Monitor, Zap, ArrowUp, ArrowDown, Clock, AlertTriangle } from 'lucide-react';
import { apiService, type RealSwarmData, type RealSystemStatus } from '../services/api-with-cors';

export function Dashboard() {
  const [systemStatus, setSystemStatus] = useState<RealSystemStatus | null>(null);
  const [swarms, setSwarms] = useState<RealSwarmData[]>([]);
  const [previousStatus, setPreviousStatus] = useState<RealSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [swarmsData, statusData] = await Promise.all([
          apiService.getSwarms(),
          apiService.getSystemStatus()
        ]);
        
        if (mounted) {
          setSwarms(swarmsData);
          setSystemStatus(statusData);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          console.error('Failed to load dashboard data:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();

    const systemUnsubscribe = apiService.subscribe('system', (newStatus: RealSystemStatus) => {
      if (mounted) {
        setPreviousStatus(systemStatus);
        setSystemStatus(newStatus);
      }
    });

    const swarmsUnsubscribe = apiService.subscribe('swarms', (newSwarms: RealSwarmData[]) => {
      if (mounted) {
        setSwarms(newSwarms);
      }
    });

    return () => {
      mounted = false;
      systemUnsubscribe();
      swarmsUnsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading real swarm data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-red-300 font-medium mb-2">Failed to load dashboard data</h3>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!systemStatus) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-400">No system data available</p>
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
      value: systemStatus.activeSwarms.toString(),
      change: calculateChange(systemStatus.activeSwarms, previousStatus?.activeSwarms),
      icon: Users,
    },
    {
      name: 'Running Machines',
      value: systemStatus.runningMachines.toString(),
      change: calculateChange(systemStatus.runningMachines, previousStatus?.runningMachines),
      icon: Monitor,
    },
    {
      name: 'Tasks Completed',
      value: systemStatus.completedTasks.toLocaleString(),
      change: calculateChange(systemStatus.completedTasks, previousStatus?.completedTasks),
      icon: Activity,
    },
    {
      name: 'System Load',
      value: `${Math.round(systemStatus.systemLoad.cpu)}%`,
      change: calculateChange(systemStatus.systemLoad.cpu, previousStatus?.systemLoad.cpu),
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
          Live API Data
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
            <div className="text-2xl font-bold text-white">{Math.round(systemStatus.systemLoad.cpu)}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${systemStatus.systemLoad.cpu}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Average across all swarms</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{Math.round(systemStatus.systemLoad.memory)}%</div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${systemStatus.systemLoad.memory}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Across {systemStatus.totalMachines} machines</p>
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
                <span className="text-sm text-white">{Math.round(systemStatus.systemLoad.network.inbound / 1024)} MB/s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Out</span>
                <span className="text-sm text-white">{Math.round(systemStatus.systemLoad.network.outbound / 1024)} MB/s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total Swarms</span>
                <span className="text-sm text-white">{systemStatus.totalSwarms}</span>
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
                    swarm.status === 'active' ? 'bg-green-500' :
                    swarm.status === 'scaling' ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-500'
                  }`}></div>
                  <div>
                    <h4 className="text-sm font-medium text-white">{swarm.name}</h4>
                    <p className="text-xs text-gray-400">{swarm.region} • {swarm.metrics.runningMachines}/{swarm.metrics.totalMachines} machines</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{Math.round(swarm.metrics.cpuUsage)}% CPU</div>
                  <div className="text-xs text-gray-400">{Math.round(swarm.metrics.memoryUsage)}% Memory</div>
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
            {swarms.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No swarms available. <Button variant="outline" className="ml-2">Create your first swarm</Button>
              </div>
            ) : (
              swarms.slice(0, 5).map((swarm) => (
                <div key={swarm.id} className="flex items-start gap-4">
                  <Activity className={`w-4 h-4 mt-0.5 ${
                    swarm.status === 'active' ? 'text-green-400' :
                    swarm.status === 'scaling' ? 'text-yellow-400' :
                    swarm.status === 'stopped' ? 'text-red-400' :
                    'text-gray-400'
                  }`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-300">
                        {swarm.name} - {swarm.status} with {swarm.metrics.runningMachines} machines
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        swarm.status === 'active' ? 'bg-green-900/50 text-green-300' :
                        swarm.status === 'scaling' ? 'bg-yellow-900/50 text-yellow-300' :
                        swarm.status === 'stopped' ? 'bg-red-900/50 text-red-300' :
                        'bg-gray-900/50 text-gray-400'
                      }`}>
                        {swarm.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(swarm.updated_at)}</span>
                      <span>•</span>
                      <span>{swarm.region}</span>
                      <span>•</span>
                      <span className="text-blue-400">{swarm.id}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
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

