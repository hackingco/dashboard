import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Activity, Cpu, HardDrive, Network, AlertCircle, CheckCircle } from 'lucide-react';

const workers = [
  {
    id: 'worker-01',
    name: 'node-01',
    swarm: 'api-backend',
    status: 'active',
    health: 'healthy',
    cpu: 45,
    memory: 68,
    disk: 32,
    network: '12.5 MB/s',
    uptime: '3d 14h',
  },
  {
    id: 'worker-02',
    name: 'node-02',
    swarm: 'api-backend',
    status: 'active',
    health: 'healthy',
    cpu: 62,
    memory: 71,
    disk: 28,
    network: '8.3 MB/s',
    uptime: '3d 14h',
  },
  {
    id: 'worker-03',
    name: 'node-03',
    swarm: 'data-processing-01',
    status: 'active',
    health: 'warning',
    cpu: 89,
    memory: 85,
    disk: 45,
    network: '23.1 MB/s',
    uptime: '1d 6h',
  },
  {
    id: 'worker-04',
    name: 'node-04',
    swarm: 'ml-training',
    status: 'idle',
    health: 'healthy',
    cpu: 5,
    memory: 12,
    disk: 18,
    network: '0.2 MB/s',
    uptime: '5d 2h',
  },
];

export function Workers() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Workers</h1>
        <p className="text-gray-400 mt-1">Monitor worker nodes across all swarms</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Workers</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">48</div>
            <p className="text-xs text-gray-400">Across 4 swarms</p>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Average CPU</CardTitle>
            <Cpu className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">58.2%</div>
            <div className="mt-2 h-2 bg-dark-800 rounded-full overflow-hidden">
              <div className="h-full bg-accent-600" style={{ width: '58.2%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Average Memory</CardTitle>
            <HardDrive className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">64.5%</div>
            <div className="mt-2 h-2 bg-dark-800 rounded-full overflow-hidden">
              <div className="h-full bg-accent-600" style={{ width: '64.5%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Network Traffic</CardTitle>
            <Network className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">44.1 MB/s</div>
            <p className="text-xs text-gray-400">Total bandwidth</p>
          </CardContent>
        </Card>
      </div>

      {/* Workers Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Worker Nodes</CardTitle>
          <CardDescription>Real-time monitoring of all worker nodes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Swarm</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Disk</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell>{worker.swarm}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        worker.status === 'active' ? "bg-green-500" : "bg-gray-500"
                      )} />
                      <span className="text-sm capitalize">{worker.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {worker.health === 'healthy' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="text-sm capitalize">{worker.health}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{worker.cpu}%</span>
                      <div className="w-16 h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full",
                            worker.cpu > 80 ? "bg-red-500" : worker.cpu > 60 ? "bg-yellow-500" : "bg-green-500"
                          )}
                          style={{ width: `${worker.cpu}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{worker.memory}%</span>
                      <div className="w-16 h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full",
                            worker.memory > 80 ? "bg-red-500" : worker.memory > 60 ? "bg-yellow-500" : "bg-green-500"
                          )}
                          style={{ width: `${worker.memory}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{worker.disk}%</TableCell>
                  <TableCell>{worker.network}</TableCell>
                  <TableCell className="text-gray-400">{worker.uptime}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">Manage</Button>
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}