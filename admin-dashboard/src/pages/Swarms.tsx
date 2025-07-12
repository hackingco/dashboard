import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, Activity, Users, Monitor, Grid, List } from 'lucide-react';
import { apiService, type RealSwarmData } from '../services/api-with-cors';
import { SwarmCard } from '../components/SwarmCard';
import wsClient from '../services/websocket';

export function Swarms() {
  const [swarms, setSwarms] = useState<RealSwarmData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [wsStatus, setWsStatus] = useState(wsClient.getConnectionStatus());
  const [alerts, setAlerts] = useState<Array<{id: string, message: string, type: 'error' | 'warning' | 'info', timestamp: Date}>>([]);

  useEffect(() => {
    let mounted = true;

    const loadSwarms = async () => {
      try {
        setLoading(true);
        setError(null);
        const swarmsData = await apiService.getSwarms();
        if (mounted) {
          setSwarms(swarmsData);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load swarms');
          console.error('Failed to load swarms:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSwarms();

    // Subscribe to WebSocket status updates
    const unsubscribeWs = wsClient.subscribe('connection', (data) => {
      if (mounted) {
        setWsStatus(data.status);
      }
    });

    // Subscribe to real-time swarm updates via WebSocket
    const unsubscribeSwarm = wsClient.subscribe('swarm', (data) => {
      if (mounted && data.swarmId) {
        setSwarms(prevSwarms => 
          prevSwarms.map(swarm => 
            swarm.id === data.swarmId 
              ? { ...swarm, status: data.status || swarm.status, ...data.data }
              : swarm
          )
        );
      }
    });

    // Subscribe to alert messages
    const unsubscribeAlert = wsClient.subscribe('alert', (data) => {
      if (mounted) {
        const newAlert = {
          id: Date.now().toString(),
          message: data.message || 'System alert',
          type: data.severity || 'info' as 'error' | 'warning' | 'info',
          timestamp: new Date()
        };
        setAlerts(prev => [...prev, newAlert]);
        
        // Auto-dismiss alerts after 10 seconds
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
        }, 10000);
      }
    });

    // Subscribe to real-time updates via polling API service
    const unsubscribeApi = apiService.subscribe('swarms', (newSwarms: RealSwarmData[]) => {
      if (mounted) {
        setSwarms(newSwarms);
      }
    });

    return () => {
      mounted = false;
      unsubscribeWs();
      unsubscribeSwarm();
      unsubscribeAlert();
      unsubscribeApi();
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const swarmsData = await apiService.getSwarms();
      setSwarms(swarmsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh swarms');
    } finally {
      setLoading(false);
    }
  };

  const filteredSwarms = swarms.filter(swarm =>
    swarm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    swarm.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading swarms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-red-300 font-medium mb-2">Failed to load swarms</h3>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <Card key={alert.id} className={`glass p-3 ${
              alert.type === 'error' ? 'border-red-600 bg-red-900/50' :
              alert.type === 'warning' ? 'border-yellow-600 bg-yellow-900/50' :
              'border-blue-600 bg-blue-900/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={
                    alert.type === 'error' ? 'text-red-400' :
                    alert.type === 'warning' ? 'text-yellow-400' :
                    'text-blue-400'
                  }>
                    {alert.type === 'error' ? '❌' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                  </span>
                  <span className="text-sm text-white">{alert.message}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                  className="h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Swarms</h1>
            <p className="text-gray-400 mt-1">Manage and monitor your swarm clusters</p>
          </div>
          {/* WebSocket Status Indicator */}
          <div className="flex items-center gap-2">
            <div className={`text-xs px-2 py-1 rounded-full border ${
              wsStatus === 'connected' 
                ? 'bg-green-900 text-green-300 border-green-600' 
                : wsStatus === 'connecting'
                ? 'bg-yellow-900 text-yellow-300 border-yellow-600'
                : 'bg-red-900 text-red-300 border-red-600'
            }`}>
              {wsStatus === 'connected' ? '● Live' : wsStatus === 'connecting' ? '◐ Connecting' : '○ Offline'}
            </div>
            {wsStatus === 'disconnected' && (
              <Button
                onClick={() => wsClient.reconnect()}
                size="sm"
                variant="outline"
                className="text-xs h-6 px-2"
              >
                Reconnect
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 px-3"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Swarm
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {swarms.filter(s => s.status === 'active').length}
                </p>
                <p className="text-sm text-gray-400">Active Swarms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Monitor className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {swarms.reduce((total, swarm) => total + swarm.metrics.runningMachines, 0)}
                </p>
                <p className="text-sm text-gray-400">Running Machines</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Activity className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {swarms.reduce((total, swarm) => total + swarm.metrics.totalMachines, 0)}
                </p>
                <p className="text-sm text-gray-400">Total Machines</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search swarms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Swarms Display */}
      {viewMode === 'cards' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSwarms.map((swarm) => (
            <SwarmCard 
              key={swarm.id} 
              swarm={swarm} 
              onRefresh={handleRefresh}
            />
          ))}
          {filteredSwarms.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-400">
                {searchTerm ? `No swarms found matching "${searchTerm}"` : 'No swarms available'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <Card className="glass">
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-400">Table view coming soon...</p>
              <p className="text-gray-500 text-sm mt-2">Use card view for now with full scaling controls</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}