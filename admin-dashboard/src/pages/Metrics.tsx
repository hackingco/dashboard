import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { TrendingUp, TrendingDown, Activity, Cpu, HardDrive, Network } from 'lucide-react';

// Mock data for charts
const generateTimeSeriesData = (points: number, min: number, max: number) => {
  return Array.from({ length: points }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    value: Math.floor(Math.random() * (max - min + 1)) + min,
  }));
};

const cpuData = generateTimeSeriesData(24, 30, 80);
const memoryData = generateTimeSeriesData(24, 40, 90);
const networkData = generateTimeSeriesData(24, 10, 60);
const taskData = generateTimeSeriesData(24, 20, 100);

export function Metrics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Metrics</h1>
        <p className="text-gray-400 mt-1">Performance metrics and system analytics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Response Time</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">142ms</div>
            <p className="text-xs flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span className="text-green-500">-12%</span>
              <span className="text-gray-400">from yesterday</span>
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Task Success Rate</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">98.7%</div>
            <p className="text-xs flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+2.3%</span>
              <span className="text-gray-400">from yesterday</span>
            </p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Throughput</CardTitle>
            <Network className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1.24 TB</div>
            <p className="text-xs text-gray-400">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">System Uptime</CardTitle>
            <Activity className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">99.98%</div>
            <p className="text-xs text-gray-400">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* CPU Usage Chart */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CPU Usage</CardTitle>
                <CardDescription>Average CPU utilization across all workers</CardDescription>
              </div>
              <Cpu className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-1">
              {cpuData.map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-accent-600 rounded-t transition-all hover:bg-accent-500"
                    style={{ height: `${(point.value / 100) * 240}px` }}
                  />
                  {i % 4 === 0 && (
                    <span className="text-xs text-gray-500 mt-1">{point.time}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage Chart */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>System memory consumption over time</CardDescription>
              </div>
              <HardDrive className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-1">
              {memoryData.map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-green-600 rounded-t transition-all hover:bg-green-500"
                    style={{ height: `${(point.value / 100) * 240}px` }}
                  />
                  {i % 4 === 0 && (
                    <span className="text-xs text-gray-500 mt-1">{point.time}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Network Traffic Chart */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Network Traffic</CardTitle>
                <CardDescription>Inbound and outbound traffic (MB/s)</CardDescription>
              </div>
              <Network className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-1">
              {networkData.map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-600 rounded-t transition-all hover:bg-purple-500"
                    style={{ height: `${(point.value / 100) * 240}px` }}
                  />
                  {i % 4 === 0 && (
                    <span className="text-xs text-gray-500 mt-1">{point.time}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Task Completion Chart */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Task Completion Rate</CardTitle>
                <CardDescription>Tasks completed per hour</CardDescription>
              </div>
              <Activity className="h-5 w-5 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-1">
              {taskData.map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-orange-600 rounded-t transition-all hover:bg-orange-500"
                    style={{ height: `${(point.value / 100) * 240}px` }}
                  />
                  {i % 4 === 0 && (
                    <span className="text-xs text-gray-500 mt-1">{point.time}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}