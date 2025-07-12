import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

const logEntries = [
  {
    timestamp: '2024-01-11 14:32:18',
    level: 'info',
    source: 'api-backend',
    message: 'Successfully initialized swarm with 12 workers',
  },
  {
    timestamp: '2024-01-11 14:31:45',
    level: 'warning',
    source: 'node-19',
    message: 'High memory usage detected: 85% threshold exceeded',
  },
  {
    timestamp: '2024-01-11 14:30:22',
    level: 'error',
    source: 'ml-training',
    message: 'Failed to connect to GPU device 0: Resource busy',
  },
  {
    timestamp: '2024-01-11 14:29:10',
    level: 'info',
    source: 'data-processing-01',
    message: 'Batch job completed: processed 10,000 records in 45.2s',
  },
  {
    timestamp: '2024-01-11 14:28:55',
    level: 'debug',
    source: 'worker-scheduler',
    message: 'Task queue: 23 pending, 5 in progress, 142 completed',
  },
  {
    timestamp: '2024-01-11 14:27:33',
    level: 'info',
    source: 'api-backend',
    message: 'New worker node-48 joined the swarm',
  },
  {
    timestamp: '2024-01-11 14:26:18',
    level: 'warning',
    source: 'web-scraper',
    message: 'Rate limit approaching: 892/1000 requests used',
  },
  {
    timestamp: '2024-01-11 14:25:04',
    level: 'error',
    source: 'node-07',
    message: 'Connection timeout: Failed to reach coordinator after 30s',
  },
];

const levelColors = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

const levelBgColors = {
  debug: 'bg-gray-400/10',
  info: 'bg-blue-400/10',
  warning: 'bg-yellow-400/10',
  error: 'bg-red-400/10',
};

export function Logs() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedLevel, setSelectedLevel] = React.useState<string>('all');

  const filteredLogs = logEntries.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === 'all' || log.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Logs</h1>
          <p className="text-gray-400 mt-1">System-wide log aggregation and search</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Log Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 font-mono text-sm">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-dark-800/50 transition-colors"
              >
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  {log.timestamp}
                </span>
                <span
                  className={cn(
                    "px-2 py-1 rounded text-xs font-semibold uppercase",
                    levelColors[log.level as keyof typeof levelColors],
                    levelBgColors[log.level as keyof typeof levelBgColors]
                  )}
                >
                  {log.level}
                </span>
                <span className="text-accent-400">[{log.source}]</span>
                <span className="text-gray-300 flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}