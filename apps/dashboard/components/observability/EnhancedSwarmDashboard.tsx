'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Brain, 
  Database, 
  Eye, 
  Zap, 
  GitBranch, 
  Network,
  Users,
  Settings,
  Bell,
  RefreshCw,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';

// Lazy load components for better performance
const RealTimeTracingDashboard = React.lazy(() => 
  import('./RealTimeTracingDashboard').then(module => ({ default: module.RealTimeTracingDashboard }))
);
const ActionVisualization = React.lazy(() => 
  import('./ActionVisualization').then(module => ({ default: module.ActionVisualization }))
);
const EnhancedLangfuseIntegration = React.lazy(() => 
  import('./EnhancedLangfuseIntegration').then(module => ({ default: module.EnhancedLangfuseIntegration }))
);
const ObservabilityDashboard = React.lazy(() => 
  import('./ObservabilityDashboard').then(module => ({ default: module.ObservabilityDashboard }))
);

// Enhanced interfaces for the main dashboard
interface SwarmHealthMetrics {
  overallHealth: number;
  activeAgents: number;
  totalAgents: number;
  tasksCompleted: number;
  totalTasks: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  costPerHour: number;
  uptime: number;
}

interface SystemStatus {
  langfuse: { connected: boolean; lastSync: Date | null; tracesCount: number };
  trustGraph: { connected: boolean; nodesCount: number; edgesCount: number };
  webSocket: { connected: boolean; lastHeartbeat: Date | null };
  database: { connected: boolean; latency: number };
  cache: { connected: boolean; hitRate: number };
}

interface AlertNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  actions?: Array<{ label: string; action: () => void }>;
}

interface EnhancedSwarmDashboardProps {
  swarmId?: string;
  mode?: 'desktop' | 'tablet' | 'mobile';
  theme?: 'light' | 'dark' | 'auto';
  realTimeUpdates?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function EnhancedSwarmDashboard({
  swarmId = 'swarm_main',
  mode = 'desktop',
  theme = 'auto',
  realTimeUpdates = true,
  autoRefresh = true,
  refreshInterval = 5000
}: EnhancedSwarmDashboardProps) {
  // State management
  const [healthMetrics, setHealthMetrics] = useState<SwarmHealthMetrics | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  // Responsive design detection
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mock data generation for demonstration
  const generateMockHealthMetrics = (): SwarmHealthMetrics => {
    const activeAgents = Math.floor(Math.random() * 8) + 3;
    const totalAgents = activeAgents + Math.floor(Math.random() * 3);
    const tasksCompleted = Math.floor(Math.random() * 1000) + 500;
    const totalTasks = tasksCompleted + Math.floor(Math.random() * 100) + 10;
    
    return {
      overallHealth: Math.floor(Math.random() * 20) + 80, // 80-100%
      activeAgents,
      totalAgents,
      tasksCompleted,
      totalTasks,
      averageResponseTime: Math.floor(Math.random() * 1000) + 200,
      errorRate: Math.random() * 5, // 0-5%
      throughput: Math.floor(Math.random() * 50) + 20,
      costPerHour: Math.random() * 2 + 0.5,
      uptime: Math.floor(Math.random() * 86400) + 3600 // 1-24 hours in seconds
    };
  };

  const generateMockSystemStatus = (): SystemStatus => {
    return {
      langfuse: {
        connected: Math.random() > 0.1,
        lastSync: new Date(Date.now() - Math.random() * 300000),
        tracesCount: Math.floor(Math.random() * 1000) + 100
      },
      trustGraph: {
        connected: Math.random() > 0.15,
        nodesCount: Math.floor(Math.random() * 50) + 10,
        edgesCount: Math.floor(Math.random() * 100) + 20
      },
      webSocket: {
        connected: Math.random() > 0.05,
        lastHeartbeat: new Date(Date.now() - Math.random() * 60000)
      },
      database: {
        connected: Math.random() > 0.02,
        latency: Math.floor(Math.random() * 50) + 5
      },
      cache: {
        connected: Math.random() > 0.08,
        hitRate: Math.random() * 0.3 + 0.7 // 70-100%
      }
    };
  };

  const generateMockAlert = (): AlertNotification => {
    const types: AlertNotification['type'][] = ['info', 'warning', 'error', 'success'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    const alertMessages = {
      info: ['New agent joined the swarm', 'System update available', 'Performance report generated'],
      warning: ['High memory usage detected', 'Rate limit approaching', 'Cache hit rate below optimal'],
      error: ['Agent disconnected unexpectedly', 'Langfuse sync failed', 'Task execution timeout'],
      success: ['All tasks completed successfully', 'Performance goals met', 'System health restored']
    };
    
    const message = alertMessages[type][Math.floor(Math.random() * alertMessages[type].length)];
    
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title: type.charAt(0).toUpperCase() + type.slice(1),
      message,
      timestamp: new Date(),
      acknowledged: false
    };
  };

  // Data fetching and updates
  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const metrics = generateMockHealthMetrics();
      const status = generateMockSystemStatus();
      
      setHealthMetrics(metrics);
      setSystemStatus(status);
      setLastUpdate(new Date());
      
      // Generate alerts based on system status
      if (metrics.errorRate > 3) {
        const alert = generateMockAlert();
        alert.type = 'warning';
        alert.message = `Error rate is ${metrics.errorRate.toFixed(1)}% - above threshold`;
        setAlerts(prev => [alert, ...prev.slice(0, 9)]);
      }
      
      if (!status.langfuse.connected) {
        const alert = generateMockAlert();
        alert.type = 'error';
        alert.message = 'Langfuse connection lost - tracing disabled';
        setAlerts(prev => [alert, ...prev.slice(0, 9)]);
      }
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      const alert = generateMockAlert();
      alert.type = 'error';
      alert.message = 'Failed to fetch dashboard data';
      setAlerts(prev => [alert, ...prev.slice(0, 9)]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh data
  useEffect(() => {
    fetchDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Real-time updates simulation
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of new alert
        const alert = generateMockAlert();
        setAlerts(prev => [alert, ...prev.slice(0, 9)]);
      }
      
      // Update metrics occasionally
      if (Math.random() > 0.8) { // 20% chance
        setHealthMetrics(prev => prev ? {
          ...prev,
          overallHealth: Math.max(70, Math.min(100, prev.overallHealth + (Math.random() - 0.5) * 10)),
          averageResponseTime: Math.max(100, prev.averageResponseTime + (Math.random() - 0.5) * 200),
          errorRate: Math.max(0, Math.min(10, prev.errorRate + (Math.random() - 0.5) * 2))
        } : null);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [realTimeUpdates, refreshInterval]);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getHealthColor = (health: number) => {
    if (health >= 90) return 'text-green-600';
    if (health >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (connected: boolean) => {
    return connected ? 
      <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Mobile-optimized layout
  const isMobile = deviceType === 'mobile' || mode === 'mobile';
  const isTablet = deviceType === 'tablet' || mode === 'tablet';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Brain className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isMobile ? 'Swarm Dashboard' : 'Enhanced Swarm Tracing Dashboard'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {swarmId} • Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Device indicator */}
              <div className="hidden sm:flex items-center text-gray-500">
                {deviceType === 'mobile' && <Smartphone className="w-4 h-4" />}
                {deviceType === 'tablet' && <Tablet className="w-4 h-4" />}
                {deviceType === 'desktop' && <Monitor className="w-4 h-4" />}
              </div>
              
              {/* Alerts indicator */}
              <Button
                variant="outline"
                size="sm"
                className="relative"
                onClick={() => setSelectedTab('alerts')}
              >
                <Bell className="w-4 h-4" />
                {alerts.filter(a => !a.acknowledged).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDashboardData}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {!isMobile && <span className="ml-2">Refresh</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Health Overview Cards */}
        {healthMetrics && (
          <div className={`grid gap-4 ${
            isMobile ? 'grid-cols-2' : 
            isTablet ? 'grid-cols-3' : 
            'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'
          }`}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-2xl font-bold ${getHealthColor(healthMetrics.overallHealth)}`}>
                      {healthMetrics.overallHealth}%
                    </div>
                    <div className="text-sm text-gray-600">Health</div>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {healthMetrics.activeAgents}/{healthMetrics.totalAgents}
                    </div>
                    <div className="text-sm text-gray-600">Agents</div>
                  </div>
                  <Users className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {healthMetrics.averageResponseTime}ms
                    </div>
                    <div className="text-sm text-gray-600">Response</div>
                  </div>
                  <Clock className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            
            {!isMobile && (
              <>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-orange-600">
                          {healthMetrics.errorRate.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">Errors</div>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-indigo-600">
                          ${healthMetrics.costPerHour.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">Cost/Hour</div>
                      </div>
                      <Database className="w-8 h-8 text-indigo-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-teal-600">
                          {formatUptime(healthMetrics.uptime)}
                        </div>
                        <div className="text-sm text-gray-600">Uptime</div>
                      </div>
                      <TrendingUp className="w-8 h-8 text-teal-500" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* System Status */}
        {systemStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Network className="w-5 h-5 mr-2" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${
                isMobile ? 'grid-cols-1' : 
                isTablet ? 'grid-cols-2' : 
                'grid-cols-3 lg:grid-cols-5'
              }`}>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(systemStatus.langfuse.connected)}
                    <span className="font-medium">Langfuse</span>
                  </div>
                  <Badge variant={systemStatus.langfuse.connected ? 'default' : 'destructive'}>
                    {systemStatus.langfuse.tracesCount} traces
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(systemStatus.trustGraph.connected)}
                    <span className="font-medium">TrustGraph</span>
                  </div>
                  <Badge variant={systemStatus.trustGraph.connected ? 'default' : 'destructive'}>
                    {systemStatus.trustGraph.nodesCount} nodes
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(systemStatus.webSocket.connected)}
                    <span className="font-medium">WebSocket</span>
                  </div>
                  <Badge variant={systemStatus.webSocket.connected ? 'default' : 'destructive'}>
                    Live
                  </Badge>
                </div>
                
                {!isMobile && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(systemStatus.database.connected)}
                        <span className="font-medium">Database</span>
                      </div>
                      <Badge variant={systemStatus.database.connected ? 'default' : 'destructive'}>
                        {systemStatus.database.latency}ms
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(systemStatus.cache.connected)}
                        <span className="font-medium">Cache</span>
                      </div>
                      <Badge variant={systemStatus.cache.connected ? 'default' : 'destructive'}>
                        {(systemStatus.cache.hitRate * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className={`grid w-full ${
            isMobile ? 'grid-cols-3' : 
            isTablet ? 'grid-cols-4' : 
            'grid-cols-6'
          }`}>
            <TabsTrigger value="overview" className="flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              {!isMobile && 'Overview'}
            </TabsTrigger>
            <TabsTrigger value="traces" className="flex items-center">
              <Activity className="w-4 h-4 mr-1" />
              {!isMobile && 'Traces'}
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center">
              <Zap className="w-4 h-4 mr-1" />
              {!isMobile && 'Actions'}
            </TabsTrigger>
            {!isMobile && (
              <>
                <TabsTrigger value="langfuse" className="flex items-center">
                  <Brain className="w-4 h-4 mr-1" />
                  Langfuse
                </TabsTrigger>
                <TabsTrigger value="observability" className="flex items-center">
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Analytics
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="alerts" className="flex items-center">
              <Bell className="w-4 h-4 mr-1" />
              {!isMobile && 'Alerts'}
              {alerts.filter(a => !a.acknowledged).length > 0 && (
                <span className="ml-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className={`grid gap-6 ${
              isMobile ? 'grid-cols-1' : 
              isTablet ? 'grid-cols-1' : 
              'grid-cols-1 lg:grid-cols-2'
            }`}>
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest system events and task completions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        {alert.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />}
                        {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                        {alert.type === 'error' && <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                        {alert.type === 'info' && <Activity className="w-4 h-4 text-blue-500 mt-0.5" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{alert.message}</p>
                          <p className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>Key metrics and trends</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthMetrics && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Overall Health</span>
                          <span className={getHealthColor(healthMetrics.overallHealth)}>
                            {healthMetrics.overallHealth}%
                          </span>
                        </div>
                        <Progress value={healthMetrics.overallHealth} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Task Completion</span>
                          <span>{((healthMetrics.tasksCompleted / healthMetrics.totalTasks) * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={(healthMetrics.tasksCompleted / healthMetrics.totalTasks) * 100} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Agent Utilization</span>
                          <span>{((healthMetrics.activeAgents / healthMetrics.totalAgents) * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={(healthMetrics.activeAgents / healthMetrics.totalAgents) * 100} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="text-center">
                          <div className="text-lg font-bold">{healthMetrics.throughput}</div>
                          <div className="text-xs text-gray-500">Tasks/min</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold">${healthMetrics.costPerHour.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">Cost/hour</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Real-Time Traces Tab */}
          <TabsContent value="traces" className="space-y-4">
            <Suspense fallback={
              <Card>
                <CardContent className="p-8">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    Loading real-time tracing dashboard...
                  </div>
                </CardContent>
              </Card>
            }>
              <RealTimeTracingDashboard 
                swarmId={swarmId}
                refreshInterval={refreshInterval}
                enableAutoRefresh={autoRefresh}
                maxTraces={isMobile ? 50 : 100}
              />
            </Suspense>
          </TabsContent>

          {/* Action Visualization Tab */}
          <TabsContent value="actions" className="space-y-4">
            <Suspense fallback={
              <Card>
                <CardContent className="p-8">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    Loading action visualization...
                  </div>
                </CardContent>
              </Card>
            }>
              <ActionVisualization 
                swarmId={swarmId}
                height={isMobile ? 400 : 600}
                autoPlay={realTimeUpdates}
                showTimeline={!isMobile}
                maxFlows={isMobile ? 3 : 5}
              />
            </Suspense>
          </TabsContent>

          {/* Langfuse Integration Tab */}
          {!isMobile && (
            <TabsContent value="langfuse" className="space-y-4">
              <Suspense fallback={
                <Card>
                  <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                      Loading Langfuse integration...
                    </div>
                  </CardContent>
                </Card>
              }>
                <EnhancedLangfuseIntegration 
                  swarmId={swarmId}
                  autoRefresh={autoRefresh}
                  refreshInterval={refreshInterval}
                  maxTraces={100}
                  realTimeUpdates={realTimeUpdates}
                />
              </Suspense>
            </TabsContent>
          )}

          {/* Observability Tab */}
          {!isMobile && (
            <TabsContent value="observability" className="space-y-4">
              <Suspense fallback={
                <Card>
                  <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                      Loading observability dashboard...
                    </div>
                  </CardContent>
                </Card>
              }>
                <ObservabilityDashboard swarmId={swarmId} />
              </Suspense>
            </TabsContent>
          )}

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>System Alerts</span>
                  <Badge variant="outline">
                    {alerts.filter(a => !a.acknowledged).length} unacknowledged
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Recent notifications and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <Alert 
                      key={alert.id} 
                      className={`${
                        alert.type === 'error' ? 'border-red-200 bg-red-50' :
                        alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                        alert.type === 'success' ? 'border-green-200 bg-green-50' :
                        'border-blue-200 bg-blue-50'
                      } ${alert.acknowledged ? 'opacity-60' : ''}`}
                    >
                      {alert.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                      {alert.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                      {alert.type === 'error' && <XCircle className="h-4 w-4" />}
                      {alert.type === 'info' && <Activity className="h-4 w-4" />}
                      <AlertDescription className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{alert.title}</div>
                          <div className="text-sm">{alert.message}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {alert.timestamp.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {!alert.acknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDismissAlert(alert.id)}
                          >
                            ×
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                  
                  {alerts.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No alerts at this time
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}