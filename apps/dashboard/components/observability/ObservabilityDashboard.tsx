import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  GitBranch, 
  Zap, 
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Network,
  Brain,
  Eye
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ObservabilityDashboardProps {
  swarmId?: string;
}

export const ObservabilityDashboard: React.FC<ObservabilityDashboardProps> = ({ swarmId }) => {
  const [loading, setLoading] = useState(true);
  const [telemetryStatus, setTelemetryStatus] = useState<any>(null);
  const [trustGraphData, setTrustGraphData] = useState<any>(null);
  const [langfuseMetrics, setLangfuseMetrics] = useState<any>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchObservabilityData = async () => {
    try {
      setLoading(true);
      
      // Fetch telemetry status
      const statusRes = await fetch(`${process.env.REACT_APP_API_URL}/api/telemetry/status`);
      const status = await statusRes.json();
      setTelemetryStatus(status);

      // Fetch visualization data
      const vizRes = await fetch(`${process.env.REACT_APP_API_URL}/api/telemetry/visualization`);
      const vizData = await vizRes.json();
      
      setTrustGraphData(vizData.graph);
      setLangfuseMetrics(vizData.langfuse);
      setPerformanceMetrics(vizData.performance);
      
    } catch (error) {
      console.error('Failed to fetch observability data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObservabilityData();
    
    // Set up auto-refresh every 5 seconds
    const interval = setInterval(fetchObservabilityData, 5000);
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [swarmId]);

  const renderTrustGraphVisualization = () => {
    if (!trustGraphData) return null;

    const { nodes, edges } = trustGraphData;
    
    // Group nodes by type for visualization
    const nodesByType = nodes.reduce((acc: any, node: any) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {});

    const chartData = {
      labels: Object.keys(nodesByType),
      datasets: [{
        label: 'Node Types',
        data: Object.values(nodesByType),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',  // blue
          'rgba(16, 185, 129, 0.8)',  // green
          'rgba(245, 158, 11, 0.8)',  // amber
          'rgba(239, 68, 68, 0.8)',   // red
          'rgba(139, 92, 246, 0.8)',  // purple
        ],
      }]
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            TrustGraph Topology
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Node Distribution</h4>
              <Bar 
                data={chartData} 
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false }
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium mb-2">Graph Statistics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-gray-500">Total Nodes</div>
                  <div className="text-2xl font-bold">{nodes.length}</div>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-gray-500">Total Edges</div>
                  <div className="text-2xl font-bold">{edges.length}</div>
                </div>
              </div>
              {nodes.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-xs font-medium text-gray-500 mb-1">Recent Nodes</h5>
                  {nodes.slice(-3).map((node: any) => (
                    <div key={node.id} className="flex items-center justify-between py-1">
                      <span className="text-xs">{node.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {node.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLangfuseMetrics = () => {
    if (!langfuseMetrics) return null;

    const { totalTraces, totalTokens, totalCost, averageLatency, errorRate, modelUsage } = langfuseMetrics;

    // Prepare data for model usage chart
    const modelChartData = {
      labels: Object.keys(modelUsage || {}),
      datasets: [{
        label: 'Model Usage',
        data: Object.values(modelUsage || {}),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      }]
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Langfuse LLM Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalTraces}</div>
              <div className="text-xs text-gray-500">Total Traces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {totalTokens.total.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                ${totalCost.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">Total Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {averageLatency.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-500">Avg Latency</div>
            </div>
          </div>
          
          {Object.keys(modelUsage || {}).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Model Usage Distribution</h4>
              <Bar 
                data={modelChartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            </div>
          )}
          
          {errorRate > 0 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Error rate: {(errorRate * 100).toFixed(1)}% of LLM operations failed
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPerformanceMetrics = () => {
    if (!performanceMetrics?.summary) return null;

    const { spanDuration, taskCompletion, swarmOperations } = performanceMetrics.summary;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {spanDuration && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Span Duration</span>
                  <span className="text-gray-500">
                    avg: {spanDuration.avg.toFixed(0)}ms
                  </span>
                </div>
                <Progress value={(spanDuration.avg / spanDuration.p95) * 100} />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>p50: {spanDuration.p50.toFixed(0)}ms</span>
                  <span>p95: {spanDuration.p95.toFixed(0)}ms</span>
                  <span>p99: {spanDuration.p99.toFixed(0)}ms</span>
                </div>
              </div>
            )}
            
            {taskCompletion && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Task Completion Time</span>
                  <span className="text-gray-500">
                    avg: {taskCompletion.avg.toFixed(0)}ms
                  </span>
                </div>
                <Progress value={(taskCompletion.avg / taskCompletion.p95) * 100} />
              </div>
            )}
            
            {swarmOperations && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Swarm Operations</span>
                  <span className="text-gray-500">
                    count: {swarmOperations.count}
                  </span>
                </div>
                <Progress value={Math.min(swarmOperations.count / 100 * 100, 100)} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderServiceStatus = () => {
    if (!telemetryStatus) return null;

    const { langfuse, trustGraph, metrics, uptime } = telemetryStatus;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Observability Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span className="font-medium">Langfuse</span>
              </div>
              <Badge variant={langfuse.enabled ? "success" : "secondary"}>
                {langfuse.enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                <span className="font-medium">TrustGraph</span>
              </div>
              <Badge variant={trustGraph.enabled ? "success" : "secondary"}>
                {trustGraph.enabled ? "Active" : "Disabled"}
              </Badge>
            </div>
            
            <div className="text-sm text-gray-500">
              <div>Total Metrics: {metrics.totalRecorded}</div>
              <div>Unique Metrics: {metrics.uniqueNames}</div>
              <div>Uptime: {Math.floor(uptime / 60)}m {Math.floor(uptime % 60)}s</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="h-6 w-6" />
          Observability Dashboard
        </h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={fetchObservabilityData}
        >
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trustgraph">TrustGraph</TabsTrigger>
          <TabsTrigger value="langfuse">Langfuse</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {renderServiceStatus()}
            {renderPerformanceMetrics()}
          </div>
        </TabsContent>

        <TabsContent value="trustgraph">
          {renderTrustGraphVisualization()}
        </TabsContent>

        <TabsContent value="langfuse">
          {renderLangfuseMetrics()}
        </TabsContent>

        <TabsContent value="performance">
          {renderPerformanceMetrics()}
        </TabsContent>
      </Tabs>
    </div>
  );
};