import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Plus, Search, Play, Pause, Trash2, Scale, Activity, Users, Monitor } from 'lucide-react';
import { apiService, type RealSwarmData } from '../services/api-with-cors';

export function Swarms() {
  const [swarms, setSwarms] = useState<RealSwarmData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

    // Subscribe to real-time updates
    const unsubscribe = apiService.subscribe('swarms', (newSwarms: RealSwarmData[]) => {
      if (mounted) {
        setSwarms(newSwarms);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const filteredSwarms = swarms.filter(swarm =>
    swarm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    swarm.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-900/50 text-green-300`;
      case 'scaling':
        return `${baseClasses} bg-yellow-900/50 text-yellow-300 animate-pulse`;
      case 'inactive':
        return `${baseClasses} bg-blue-900/50 text-blue-300`;
      case 'stopped':
        return `${baseClasses} bg-gray-900/50 text-gray-400`;
      case 'error':
        return `${baseClasses} bg-red-900/50 text-red-300`;
      default:
        return `${baseClasses} bg-gray-900/50 text-gray-400`;
    }
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Swarms</h1>
          <p className="text-gray-400 mt-1">Manage and monitor your swarm clusters</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Swarm
        </Button>
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

      {/* Search and Filters */}
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-400">Name</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Machines</TableHead>
                <TableHead className="text-gray-400">Agents</TableHead>
                <TableHead className="text-gray-400">Performance</TableHead>
                <TableHead className="text-gray-400">Region</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSwarms.map((swarm) => (
                <TableRow key={swarm.id} className="border-gray-700">
                  <TableCell className="text-white font-medium">{swarm.name}</TableCell>
                  <TableCell>
                    <span className={getStatusBadge(swarm.status)}>
                      {swarm.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex flex-col">
                      <span>{swarm.metrics.runningMachines}/{swarm.metrics.totalMachines}</span>
                      <span className="text-xs text-gray-500">
                        {swarm.config.workerCount} configured
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex flex-col">
                      <span>{swarm.agents?.length || 0} agents</span>
                      <span className="text-xs text-gray-500">
                        {swarm.config.strategy} strategy
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex flex-col">
                      <span>CPU: {Math.round(swarm.metrics.cpuUsage)}%</span>
                      <span className="text-xs text-gray-500">
                        RAM: {Math.round(swarm.metrics.memoryUsage)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">{swarm.region}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {swarm.status === 'active' ? (
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <Pause className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <Scale className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-400 border-red-400">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}