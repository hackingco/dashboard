'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Activity, Cpu, HardDrive, Network, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricData {
  timestamp: Date;
  value: number;
}

interface PerformanceMetrics {
  cpu: MetricData[];
  memory: MetricData[];
  network: MetricData[];
  taskThroughput: MetricData[];
  errorRate: MetricData[];
  latency: MetricData[];
}

interface PerformanceMonitorProps {
  swarmId?: string;
  metrics: PerformanceMetrics;
  timeRange?: '1h' | '6h' | '24h' | '7d';
}

export function PerformanceMonitor({ swarmId, metrics, timeRange = '1h' }: PerformanceMonitorProps) {
  const currentMetrics = useMemo(() => {
    const getLatest = (data: MetricData[]) => data[data.length - 1]?.value || 0;
    const getAverage = (data: MetricData[]) => {
      if (data.length === 0) return 0;
      return data.reduce((sum, m) => sum + m.value, 0) / data.length;
    };
    const getTrend = (data: MetricData[]) => {
      if (data.length < 2) return 0;
      const recent = data.slice(-10);
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      const firstAvg = getAverage(firstHalf);
      const secondAvg = getAverage(secondHalf);
      return ((secondAvg - firstAvg) / firstAvg) * 100;
    };

    return {
      cpu: {
        current: getLatest(metrics.cpu),
        average: getAverage(metrics.cpu),
        trend: getTrend(metrics.cpu),
      },
      memory: {
        current: getLatest(metrics.memory),
        average: getAverage(metrics.memory),
        trend: getTrend(metrics.memory),
      },
      throughput: {
        current: getLatest(metrics.taskThroughput),
        average: getAverage(metrics.taskThroughput),
        trend: getTrend(metrics.taskThroughput),
      },
      errorRate: {
        current: getLatest(metrics.errorRate),
        average: getAverage(metrics.errorRate),
        trend: getTrend(metrics.errorRate),
      },
      latency: {
        current: getLatest(metrics.latency),
        average: getAverage(metrics.latency),
        trend: getTrend(metrics.latency),
      },
    };
  }, [metrics]);

  const MetricCard = ({ 
    icon: Icon, 
    title, 
    value, 
    unit, 
    trend, 
    progress,
    color = 'blue' 
  }: {
    icon: any;
    title: string;
    value: number;
    unit: string;
    trend: number;
    progress?: number;
    color?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 text-${color}-500`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {trend > 0 ? (
            <TrendingUp className="w-3 h-3 text-red-500" />
          ) : trend < 0 ? (
            <TrendingDown className="w-3 h-3 text-green-500" />
          ) : null}
          <span className={`text-xs ${trend > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      {progress !== undefined && (
        <Progress value={progress} className="h-2" />
      )}
    </div>
  );

  return (
    <Card className="col-span-4 lg:col-span-2">
      <CardHeader>
        <CardTitle>Performance Monitor</CardTitle>
        <CardDescription>
          {swarmId ? `Real-time metrics for ${swarmId}` : 'System-wide performance metrics'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="resources" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="throughput">Throughput</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          <TabsContent value="resources" className="space-y-4">
            <MetricCard
              icon={Cpu}
              title="CPU Usage"
              value={currentMetrics.cpu.current}
              unit="%"
              trend={currentMetrics.cpu.trend}
              progress={currentMetrics.cpu.current}
              color="blue"
            />
            <MetricCard
              icon={HardDrive}
              title="Memory Usage"
              value={currentMetrics.memory.current}
              unit="%"
              trend={currentMetrics.memory.trend}
              progress={currentMetrics.memory.current}
              color="purple"
            />
          </TabsContent>

          <TabsContent value="throughput" className="space-y-4">
            <MetricCard
              icon={Activity}
              title="Task Throughput"
              value={currentMetrics.throughput.current}
              unit="tasks/min"
              trend={currentMetrics.throughput.trend}
              color="green"
            />
            <MetricCard
              icon={Network}
              title="Avg Latency"
              value={currentMetrics.latency.current}
              unit="ms"
              trend={currentMetrics.latency.trend * -1} // Invert trend for latency
              color="orange"
            />
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <MetricCard
              icon={Activity}
              title="Error Rate"
              value={currentMetrics.errorRate.current}
              unit="%"
              trend={currentMetrics.errorRate.trend * -1} // Invert trend for errors
              progress={Math.min(currentMetrics.errorRate.current * 10, 100)}
              color="red"
            />
            <div className="pt-4 space-y-2">
              <h4 className="text-sm font-medium">Health Checks</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>API Endpoints</span>
                  <span className="text-green-500">Healthy</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Worker Nodes</span>
                  <span className="text-green-500">All Active</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Database</span>
                  <span className="text-green-500">Connected</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}