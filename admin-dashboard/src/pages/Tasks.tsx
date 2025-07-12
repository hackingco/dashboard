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
import { Plus, Search, Clock, CheckCircle, XCircle, AlertCircle, PlayCircle, RefreshCw } from 'lucide-react';

const tasks = [
  {
    id: 'task-001',
    name: 'Process image batch',
    swarm: 'data-processing-01',
    status: 'completed',
    priority: 'high',
    progress: 100,
    duration: '2h 15m',
    created: '2024-01-11 14:30',
    completed: '2024-01-11 16:45',
  },
  {
    id: 'task-002',
    name: 'Train ML model v2.3',
    swarm: 'ml-training',
    status: 'running',
    priority: 'critical',
    progress: 67,
    duration: '5h 42m',
    created: '2024-01-11 12:00',
    completed: null,
  },
  {
    id: 'task-003',
    name: 'API stress test',
    swarm: 'api-backend',
    status: 'queued',
    priority: 'medium',
    progress: 0,
    duration: '-',
    created: '2024-01-11 17:15',
    completed: null,
  },
  {
    id: 'task-004',
    name: 'Database backup',
    swarm: 'api-backend',
    status: 'failed',
    priority: 'high',
    progress: 45,
    duration: '1h 12m',
    created: '2024-01-11 16:00',
    completed: '2024-01-11 17:12',
  },
  {
    id: 'task-005',
    name: 'Scrape product data',
    swarm: 'web-scraper',
    status: 'running',
    priority: 'low',
    progress: 23,
    duration: '45m',
    created: '2024-01-11 17:30',
    completed: null,
  },
];

const statusIcons: Record<string, any> = {
  completed: CheckCircle,
  running: PlayCircle,
  queued: Clock,
  failed: XCircle,
};

const statusColors: Record<string, string> = {
  completed: 'text-green-500',
  running: 'text-blue-500',
  queued: 'text-yellow-500',
  failed: 'text-red-500',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
};

export function Tasks() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.swarm.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Tasks</h1>
          <p className="text-gray-400 mt-1">Monitor and manage swarm tasks</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{tasks.length}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {tasks.filter(t => t.status === 'running').length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {tasks.filter(t => t.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {tasks.filter(t => t.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Task Queue</CardTitle>
          <CardDescription>
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Swarm</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const StatusIcon = statusIcons[task.status];
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-sm">{task.id}</TableCell>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>{task.swarm}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-2 ${statusColors[task.status]}`}>
                        <StatusIcon className="h-4 w-4" />
                        <span className="text-sm capitalize">{task.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              task.status === 'failed' ? 'bg-red-500' : 'bg-accent-500'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{task.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-400">{task.duration}</TableCell>
                    <TableCell className="text-gray-400">{task.created}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {task.status === 'failed' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

