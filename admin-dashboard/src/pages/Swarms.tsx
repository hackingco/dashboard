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
import { telemetryService, type SwarmTelemetry } from '../services/realtime';

export function Swarms() {
  const [swarms, setSwarms] = useState<SwarmTelemetry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Initialize data
    setSwarms(telemetryService.getSwarms());

    // Subscribe to real-time updates
    const unsubscribe = telemetryService.subscribe('swarms', (newSwarms: SwarmTelemetry[]) => {
      setSwarms(newSwarms);
    });

    return unsubscribe;
  }, []);

  const filteredSwarms = swarms.filter(swarm =>
    swarm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    swarm.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'running':
        return `${baseClasses} bg-green-900/50 text-green-300`;
      case 'scaling':
        return `${baseClasses} bg-yellow-900/50 text-yellow-300 animate-pulse`;
      case 'paused':
        return `${baseClasses} bg-blue-900/50 text-blue-300`;
      case 'stopped':
        return `${baseClasses} bg-gray-900/50 text-gray-400`;
      default:
        return `${baseClasses} bg-gray-900/50 text-gray-400`;
    }
  };

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
                  {swarms.filter(s => s.status === 'running').length}
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
                  {swarms.reduce((total, swarm) => total + swarm.workers.active, 0)}
                </p>
                <p className="text-sm text-gray-400">Total Workers</p>
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
                  {swarms.reduce((total, swarm) => total + swarm.tasks.running, 0)}
                </p>
                <p className="text-sm text-gray-400">Running Tasks</p>
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
                <TableHead className="text-gray-400">Workers</TableHead>
                <TableHead className="text-gray-400">Tasks</TableHead>
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
                      <span>{swarm.workers.active}/{swarm.workers.total}</span>
                      <span className="text-xs text-gray-500">
                        {swarm.workers.idle} idle, {swarm.workers.offline} offline
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex flex-col">
                      <span>{swarm.tasks.running} running</span>
                      <span className="text-xs text-gray-500">
                        {swarm.tasks.completed} completed
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex flex-col">
                      <span>CPU: {Math.round(swarm.performance.cpu)}%</span>
                      <span className="text-xs text-gray-500">
                        RAM: {Math.round(swarm.performance.memory)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">{swarm.region}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {swarm.status === 'running' ? (
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