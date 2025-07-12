import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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
import { Plus, Search, Play, Pause, Trash2, Scale, Activity } from 'lucide-react';

const swarms = [
  {
    id: '1',
    name: 'api-backend',
    status: 'running',
    workers: 12,
    tasks: 45,
    cpu: '68%',
    memory: '4.2GB',
    created: '2024-01-10',
  },
  {
    id: '2',
    name: 'data-processing-01',
    status: 'running',
    workers: 8,
    tasks: 23,
    cpu: '45%',
    memory: '2.8GB',
    created: '2024-01-11',
  },
  {
    id: '3',
    name: 'ml-training',
    status: 'paused',
    workers: 16,
    tasks: 0,
    cpu: '0%',
    memory: '0.5GB',
    created: '2024-01-09',
  },
  {
    id: '4',
    name: 'web-scraper',
    status: 'running',
    workers: 4,
    tasks: 12,
    cpu: '22%',
    memory: '1.1GB',
    created: '2024-01-11',
  },
];

export function Swarms() {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredSwarms = swarms.filter(swarm =>
    swarm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Swarms</h1>
          <p className="text-gray-400 mt-1">Manage and monitor your swarm clusters</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Swarm
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search swarms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">Filter</Button>
          </div>
        </CardContent>
      </Card>

      {/* Swarms Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Active Swarms</CardTitle>
          <CardDescription>
            {filteredSwarms.length} swarm{filteredSwarms.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workers</TableHead>
                <TableHead>Active Tasks</TableHead>
                <TableHead>CPU Usage</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSwarms.map((swarm) => (
                <TableRow key={swarm.id}>
                  <TableCell className="font-medium">{swarm.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        swarm.status === 'running' ? "bg-green-500" : "bg-yellow-500"
                      )} />
                      <span className="text-sm capitalize">{swarm.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>{swarm.workers}</TableCell>
                  <TableCell>{swarm.tasks}</TableCell>
                  <TableCell>{swarm.cpu}</TableCell>
                  <TableCell>{swarm.memory}</TableCell>
                  <TableCell className="text-gray-400">{swarm.created}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {swarm.status === 'running' ? (
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Scale className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Activity className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}