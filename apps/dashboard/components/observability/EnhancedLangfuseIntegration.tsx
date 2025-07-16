'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Brain, 
  Database, 
  Settings, 
  Zap, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  Search,
  Filter,
  Download,
  Upload,
  Connect,
  WifiOff,
  Bell
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

// Enhanced interfaces for Langfuse integration
interface LangfuseTrace {
  id: string;
  name: string;
  sessionId: string;
  userId?: string;
  timestamp: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error' | 'pending' | 'running';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  input: any;
  output: any;
  metadata?: Record<string, any>;
  tags?: string[];
  scores?: Record<string, number>;
  observations?: LangfuseObservation[];
  level: 'trace' | 'span' | 'generation' | 'event';
  parentObservationId?: string;
  version?: string;
  release?: string;
  environment?: string;
}

interface LangfuseObservation {
  id: string;
  traceId: string;
  type: 'span' | 'generation' | 'event';
  name: string;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
  input?: any;
  output?: any;
  level: string;
  statusMessage?: string;
  parentObservationId?: string;
  version?: string;
}

interface LangfuseSession {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  metadata?: Record<string, any>;
  traceCount: number;
  totalCost: number;
  averageDuration: number;
  errorRate: number;
}

interface LangfuseMetrics {
  totalTraces: number;
  totalSessions: number;
  totalTokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
  modelUsage: Record<string, number>;
  costByModel: Record<string, number>;
  topUsers: Array<{ userId: string; traceCount: number; cost: number }>;
  timeSeriesData: Array<{
    timestamp: Date;
    traceCount: number;
    cost: number;
    averageLatency: number;
    errorRate: number;
  }>;
}

interface LangfuseConnection {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  publicKey?: string;
  secretKey?: string;
  baseUrl: string;
  lastSync: Date | null;
  errorMessage?: string;
  version?: string;
  features?: string[];
}

interface EnhancedLangfuseIntegrationProps {
  swarmId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxTraces?: number;
  realTimeUpdates?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export function EnhancedLangfuseIntegration({ 
  swarmId, 
  autoRefresh = true, 
  refreshInterval = 5000,
  maxTraces = 100,
  realTimeUpdates = true
}: EnhancedLangfuseIntegrationProps) {
  // State management
  const [traces, setTraces] = useState<LangfuseTrace[]>([]);
  const [sessions, setSessions] = useState<LangfuseSession[]>([]);
  const [metrics, setMetrics] = useState<LangfuseMetrics | null>(null);
  const [connection, setConnection] = useState<LangfuseConnection>({
    status: 'disconnected',
    baseUrl: 'https://cloud.langfuse.com',
    lastSync: null
  });
  
  const [selectedTrace, setSelectedTrace] = useState<LangfuseTrace | null>(null);
  const [selectedSession, setSelectedSession] = useState<LangfuseSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [selectedTab, setSelectedTab] = useState('traces');
  
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ id: string; type: 'info' | 'warning' | 'error'; message: string; timestamp: Date }>>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Mock data generators for demonstration (in production, this would be real Langfuse API calls)
  const generateMockTrace = useCallback((): LangfuseTrace => {
    const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
    const statuses: LangfuseTrace['status'][] = ['success', 'error', 'pending', 'running'];
    const environments = ['production', 'staging', 'development'];
    const traceTypes = ['chat_completion', 'code_generation', 'analysis', 'summarization', 'translation'];
    
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = models[Math.floor(Math.random() * models.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const promptTokens = Math.floor(Math.random() * 3000) + 100;
    const completionTokens = Math.floor(Math.random() * 2000) + 50;
    const totalTokens = promptTokens + completionTokens;
    
    const costPerToken = model.includes('gpt-4') ? 0.00003 : 
                        model.includes('claude-3-opus') ? 0.000015 :
                        model.includes('claude-3-sonnet') ? 0.000003 :
                        0.0000015;
    
    const totalCost = totalTokens * costPerToken;
    const duration = status === 'running' ? undefined : Math.floor(Math.random() * 8000) + 200;
    
    return {
      id: traceId,
      name: `${traceTypes[Math.floor(Math.random() * traceTypes.length)]}_${Math.floor(Math.random() * 1000)}`,
      sessionId: `session_${Math.floor(Math.random() * 10) + 1}`,
      userId: `user_${Math.floor(Math.random() * 50) + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000), // Within last 24 hours
      endTime: status !== 'running' && status !== 'pending' ? new Date() : undefined,
      duration,
      status,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      totalCost,
      input: {
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: `Please help me with ${traceTypes[Math.floor(Math.random() * traceTypes.length)]}` }
        ],
        temperature: Math.random() * 0.8 + 0.2,
        max_tokens: Math.floor(Math.random() * 2000) + 500,
        swarm_id: swarmId || 'swarm_default'
      },
      output: status === 'success' ? {
        content: `Here's a detailed response for your ${traceTypes[Math.floor(Math.random() * traceTypes.length)]} request...`,
        finish_reason: 'stop',
        tool_calls: Math.random() > 0.7 ? [{ function: 'analyze_data', arguments: '{}' }] : undefined
      } : status === 'error' ? {
        error: 'Rate limit exceeded',
        error_code: 'rate_limit_exceeded',
        retry_after: 60
      } : null,
      metadata: {
        environment: environments[Math.floor(Math.random() * environments.length)],
        version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
        region: ['us-east-1', 'us-west-2', 'eu-west-1'][Math.floor(Math.random() * 3)],
        agent_id: `agent_${Math.floor(Math.random() * 8) + 1}`,
        swarm_id: swarmId || 'swarm_default',
        deployment_id: `deploy_${Math.floor(Math.random() * 5) + 1}`
      },
      tags: ['production', 'swarm', 'automated'],
      scores: Math.random() > 0.3 ? {
        quality: Math.random() * 0.4 + 0.6,
        relevance: Math.random() * 0.3 + 0.7,
        helpfulness: Math.random() * 0.4 + 0.6,
        coherence: Math.random() * 0.3 + 0.7,
        factuality: Math.random() * 0.2 + 0.8
      } : undefined,
      level: 'trace',
      environment: environments[Math.floor(Math.random() * environments.length)],
      version: `v${Math.floor(Math.random() * 3) + 1}.0.0`,
      release: `release_${Math.floor(Math.random() * 100) + 1}`
    };
  }, [swarmId]);

  const generateMockSession = useCallback((): LangfuseSession => {
    const sessionTraces = Math.floor(Math.random() * 20) + 5;
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(Date.now() - Math.random() * 604800000), // Within last week
      updatedAt: new Date(Date.now() - Math.random() * 86400000), // Within last day
      userId: `user_${Math.floor(Math.random() * 50) + 1}`,
      metadata: {
        userAgent: 'Swarm-Agent/1.0',
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        sessionType: ['chat', 'batch', 'streaming'][Math.floor(Math.random() * 3)]
      },
      traceCount: sessionTraces,
      totalCost: Math.random() * 5.0,
      averageDuration: Math.floor(Math.random() * 3000) + 500,
      errorRate: Math.random() * 0.1
    };
  }, []);

  // Initialize connection simulation
  const connectToLangfuse = useCallback(async () => {
    setConnection(prev => ({ ...prev, status: 'connecting' }));
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // In production, this would make actual API calls to Langfuse
      // const response = await fetch(`${connection.baseUrl}/api/public/health`);
      
      setConnection(prev => ({
        ...prev,
        status: 'connected',
        lastSync: new Date(),
        version: '2.0.0',
        features: ['traces', 'sessions', 'scores', 'datasets', 'prompts']
      }));
      
      setAlerts(prev => [...prev, {
        id: Date.now().toString(),
        type: 'info',
        message: 'Successfully connected to Langfuse',
        timestamp: new Date()
      }]);
      
    } catch (error) {
      setConnection(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'Failed to connect to Langfuse API'
      }));
      
      setAlerts(prev => [...prev, {
        id: Date.now().toString(),
        type: 'error',
        message: 'Failed to connect to Langfuse API',
        timestamp: new Date()
      }]);
    }
  }, []);

  // Fetch data from Langfuse
  const fetchLangfuseData = useCallback(async () => {
    if (connection.status !== 'connected') return;
    
    setIsLoading(true);
    
    try {
      // In production, these would be actual API calls:
      // const tracesRes = await fetch(`${connection.baseUrl}/api/public/traces?limit=${maxTraces}`);
      // const sessionsRes = await fetch(`${connection.baseUrl}/api/public/sessions`);
      // const metricsRes = await fetch(`${connection.baseUrl}/api/public/metrics?timeRange=${timeRange}`);
      
      // Generate mock data for demonstration
      const newTraces = Array.from({ length: Math.floor(Math.random() * 10) + 5 }, () => generateMockTrace());
      const newSessions = Array.from({ length: Math.floor(Math.random() * 5) + 2 }, () => generateMockSession());
      
      setTraces(prev => {
        const combined = [...newTraces, ...prev];
        return combined.slice(0, maxTraces);
      });
      
      setSessions(prev => {
        const combined = [...newSessions, ...prev];
        return combined.slice(0, 50);
      });
      
      // Calculate metrics
      const allTraces = [...newTraces, ...traces];
      const timeRangeMs = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      }[timeRange];
      
      const recentTraces = allTraces.filter(t => 
        Date.now() - t.timestamp.getTime() < timeRangeMs
      );
      
      const successTraces = recentTraces.filter(t => t.status === 'success');
      const errorTraces = recentTraces.filter(t => t.status === 'error');
      const completedTraces = recentTraces.filter(t => t.status === 'success' || t.status === 'error');
      
      const modelUsage = recentTraces.reduce((acc, trace) => {
        acc[trace.model] = (acc[trace.model] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const costByModel = recentTraces.reduce((acc, trace) => {
        acc[trace.model] = (acc[trace.model] || 0) + trace.totalCost;
        return acc;
      }, {} as Record<string, number>);
      
      const userStats = recentTraces.reduce((acc, trace) => {
        if (trace.userId) {
          if (!acc[trace.userId]) {
            acc[trace.userId] = { userId: trace.userId, traceCount: 0, cost: 0 };
          }
          acc[trace.userId].traceCount++;
          acc[trace.userId].cost += trace.totalCost;
        }
        return acc;
      }, {} as Record<string, { userId: string; traceCount: number; cost: number }>);
      
      const topUsers = Object.values(userStats)
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);
      
      // Generate time series data
      const timeSeriesData = Array.from({ length: 24 }, (_, i) => {
        const hourAgo = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
        const hourTraces = recentTraces.filter(t => 
          Math.abs(t.timestamp.getTime() - hourAgo.getTime()) < 30 * 60 * 1000
        );
        
        return {
          timestamp: hourAgo,
          traceCount: hourTraces.length,
          cost: hourTraces.reduce((sum, t) => sum + t.totalCost, 0),
          averageLatency: hourTraces.length > 0 
            ? hourTraces.reduce((sum, t) => sum + (t.duration || 0), 0) / hourTraces.length 
            : 0,
          errorRate: hourTraces.length > 0 
            ? (hourTraces.filter(t => t.status === 'error').length / hourTraces.length) * 100 
            : 0
        };
      });
      
      const calculatedMetrics: LangfuseMetrics = {
        totalTraces: recentTraces.length,
        totalSessions: sessions.length,
        totalTokens: {
          prompt: recentTraces.reduce((sum, t) => sum + t.promptTokens, 0),
          completion: recentTraces.reduce((sum, t) => sum + t.completionTokens, 0),
          total: recentTraces.reduce((sum, t) => sum + t.totalTokens, 0),
        },
        totalCost: recentTraces.reduce((sum, t) => sum + t.totalCost, 0),
        averageLatency: completedTraces.length > 0 
          ? completedTraces.reduce((sum, t) => sum + (t.duration || 0), 0) / completedTraces.length 
          : 0,
        errorRate: recentTraces.length > 0 
          ? (errorTraces.length / recentTraces.length) * 100 
          : 0,
        throughput: recentTraces.length / (timeRangeMs / (60 * 60 * 1000)), // traces per hour
        modelUsage,
        costByModel,
        topUsers,
        timeSeriesData
      };
      
      setMetrics(calculatedMetrics);
      setConnection(prev => ({ ...prev, lastSync: new Date() }));
      
    } catch (error) {
      console.error('Failed to fetch Langfuse data:', error);
      setAlerts(prev => [...prev, {
        id: Date.now().toString(),
        type: 'error',
        message: 'Failed to fetch data from Langfuse',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [connection.status, timeRange, maxTraces, traces, sessions, generateMockTrace, generateMockSession]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!realTimeUpdates || connection.status !== 'connected') return;

    // In production, this would connect to actual Langfuse WebSocket
    // wsRef.current = new WebSocket(`${connection.baseUrl.replace('http', 'ws')}/api/public/traces/stream`);
    
    // Simulate WebSocket with polling for demo
    pollingRef.current = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of new trace
        const newTrace = generateMockTrace();
        setTraces(prev => [newTrace, ...prev.slice(0, maxTraces - 1)]);
        
        if (newTrace.status === 'error') {
          setAlerts(prev => [...prev, {
            id: Date.now().toString(),
            type: 'warning',
            message: `Trace ${newTrace.name} failed: ${newTrace.output?.error || 'Unknown error'}`,
            timestamp: new Date()
          }]);
        }
      }
    }, refreshInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [realTimeUpdates, connection.status, refreshInterval, maxTraces, generateMockTrace]);

  // Auto-refresh data
  useEffect(() => {
    if (autoRefresh && connection.status === 'connected') {
      const interval = setInterval(fetchLangfuseData, refreshInterval * 2);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, connection.status, refreshInterval, fetchLangfuseData]);

  // Initial connection
  useEffect(() => {
    connectToLangfuse();
  }, [connectToLangfuse]);

  // Filtered traces
  const filteredTraces = traces.filter(trace => {
    const matchesSearch = trace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trace.input?.messages?.some((m: any) => 
                           m.content?.toLowerCase().includes(searchQuery.toLowerCase())
                         );
    const matchesStatus = statusFilter === 'all' || trace.status === statusFilter;
    const matchesModel = modelFilter === 'all' || trace.model === modelFilter;
    return matchesSearch && matchesStatus && matchesModel;
  });

  const handleExportData = () => {
    const exportData = {
      traces: filteredTraces,
      sessions,
      metrics,
      connection: { ...connection, secretKey: undefined }, // Don't export secret key
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `langfuse-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status & Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Brain className="w-5 h-5 mr-2" />
              Langfuse Integration
              <div className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${getConnectionStatusColor(connection.status)}`}>
                {connection.status === 'connecting' && <RefreshCw className="w-3 h-3 mr-1 animate-spin inline" />}
                {connection.status === 'connected' && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                {connection.status === 'error' && <XCircle className="w-3 h-3 mr-1 inline" />}
                {connection.status === 'disconnected' && <WifiOff className="w-3 h-3 mr-1 inline" />}
                {connection.status}
              </div>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLangfuseData}
                disabled={isLoading || connection.status !== 'connected'}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                disabled={connection.status !== 'connected'}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Connection Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-sm text-gray-500">Base URL</div>
              <div className="font-medium">{connection.baseUrl}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Last Sync</div>
              <div className="font-medium">
                {connection.lastSync ? connection.lastSync.toLocaleTimeString() : 'Never'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Version</div>
              <div className="font-medium">{connection.version || 'Unknown'}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Features</div>
              <div className="font-medium">{connection.features?.length || 0} enabled</div>
            </div>
          </div>
          
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.slice(-3).map((alert) => (
                <Alert key={alert.id} className={
                  alert.type === 'error' ? 'border-red-200 bg-red-50' :
                  alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{alert.message}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismissAlert(alert.id)}
                    >
                      ×
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{metrics.totalTraces}</div>
                  <div className="text-sm text-gray-600">Total Traces</div>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">${metrics.totalCost.toFixed(3)}</div>
                  <div className="text-sm text-gray-600">Total Cost</div>
                </div>
                <Database className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-600">{Math.round(metrics.averageLatency)}ms</div>
                  <div className="text-sm text-gray-600">Avg Latency</div>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-600">{metrics.errorRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Error Rate</div>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-indigo-600">{metrics.totalTokens.total.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Total Tokens</div>
                </div>
                <Brain className="w-8 h-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-teal-600">{Math.round(metrics.throughput)}</div>
                  <div className="text-sm text-gray-600">Traces/Hour</div>
                </div>
                <TrendingUp className="w-8 h-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="traces">Live Traces</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Traces Tab */}
        <TabsContent value="traces" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Trace Stream</CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search traces..."
                      className="pl-9 w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={modelFilter} onValueChange={setModelFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5</SelectItem>
                      <SelectItem value="claude-3-opus">Claude Opus</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude Sonnet</SelectItem>
                      <SelectItem value="claude-3-haiku">Claude Haiku</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex h-[600px]">
                {/* Trace List */}
                <div className="w-1/2 border-r">
                  <ScrollArea className="h-full">
                    <div className="divide-y">
                      {filteredTraces.map((trace) => (
                        <div
                          key={trace.id}
                          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                            selectedTrace?.id === trace.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                          onClick={() => setSelectedTrace(trace)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusIcon(trace.status)}
                                <h4 className="font-medium text-sm">{trace.name}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {trace.model}
                                </Badge>
                                {trace.status === 'running' && (
                                  <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 animate-pulse">
                                    Live
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                {trace.input?.messages?.[1]?.content || 'No input available'}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>{trace.timestamp.toLocaleTimeString()}</span>
                                <span>{trace.duration ? `${trace.duration}ms` : 'In progress'}</span>
                                <span>${trace.totalCost.toFixed(4)}</span>
                                <span>{trace.totalTokens.toLocaleString()} tokens</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Trace Details */}
                <div className="w-1/2">
                  <ScrollArea className="h-full">
                    {selectedTrace ? (
                      <div className="p-4">
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">{selectedTrace.name}</h3>
                            <Badge className={
                              selectedTrace.status === 'success' ? 'bg-green-500/10 text-green-700' :
                              selectedTrace.status === 'error' ? 'bg-red-500/10 text-red-700' :
                              selectedTrace.status === 'running' ? 'bg-blue-500/10 text-blue-700' :
                              'bg-yellow-500/10 text-yellow-700'
                            }>
                              {selectedTrace.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Trace ID:</span>
                              <p className="font-mono text-xs">{selectedTrace.id}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Session ID:</span>
                              <p className="font-mono text-xs">{selectedTrace.sessionId}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Model:</span>
                              <p>{selectedTrace.model}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Environment:</span>
                              <p>{selectedTrace.environment}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Duration:</span>
                              <p>{selectedTrace.duration ? `${selectedTrace.duration}ms` : 'In progress'}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Cost:</span>
                              <p>${selectedTrace.totalCost.toFixed(4)}</p>
                            </div>
                          </div>
                        </div>

                        <Tabs defaultValue="io" className="w-full">
                          <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="io">Input/Output</TabsTrigger>
                            <TabsTrigger value="metadata">Metadata</TabsTrigger>
                            <TabsTrigger value="scores">Scores</TabsTrigger>
                            <TabsTrigger value="tokens">Token Usage</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="io" className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Input</h4>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto max-h-40">
                                {JSON.stringify(selectedTrace.input, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium mb-2">Output</h4>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto max-h-40">
                                {JSON.stringify(selectedTrace.output, null, 2)}
                              </pre>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="metadata">
                            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                              {JSON.stringify(selectedTrace.metadata, null, 2)}
                            </pre>
                          </TabsContent>
                          
                          <TabsContent value="scores">
                            {selectedTrace.scores ? (
                              <div className="space-y-3">
                                {Object.entries(selectedTrace.scores).map(([key, value]) => (
                                  <div key={key}>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-sm capitalize">{key}</span>
                                      <span className="text-sm font-medium">{(value * 100).toFixed(0)}%</span>
                                    </div>
                                    <Progress value={value * 100} className="h-2" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-gray-500 py-8">
                                No scores available for this trace
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="tokens">
                            <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-blue-50 rounded">
                                  <div className="text-lg font-bold text-blue-600">{selectedTrace.promptTokens.toLocaleString()}</div>
                                  <div className="text-sm text-blue-600">Prompt Tokens</div>
                                </div>
                                <div className="p-3 bg-green-50 rounded">
                                  <div className="text-lg font-bold text-green-600">{selectedTrace.completionTokens.toLocaleString()}</div>
                                  <div className="text-sm text-green-600">Completion Tokens</div>
                                </div>
                                <div className="p-3 bg-purple-50 rounded">
                                  <div className="text-lg font-bold text-purple-600">{selectedTrace.totalTokens.toLocaleString()}</div>
                                  <div className="text-sm text-purple-600">Total Tokens</div>
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold">${selectedTrace.totalCost.toFixed(4)}</div>
                                <div className="text-sm text-gray-500">Total Cost</div>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Select a trace to view details
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {metrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Trace Volume Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metrics.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                      />
                      <Area type="monotone" dataKey="traceCount" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: any) => [`$${value.toFixed(4)}`, 'Cost']}
                      />
                      <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: any) => [`${value.toFixed(0)}ms`, 'Avg Latency']}
                      />
                      <Bar dataKey="averageLatency" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: any) => [`${value.toFixed(1)}%`, 'Error Rate']}
                      />
                      <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          {metrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Model Usage Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(metrics.modelUsage).map(([model, count]) => ({ model, count }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ model, count }) => `${model}: ${count}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {Object.entries(metrics.modelUsage).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost by Model</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(metrics.costByModel).map(([model, cost]) => ({ model, cost }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="model" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => [`$${value.toFixed(4)}`, 'Cost']} />
                      <Bar dataKey="cost" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {metrics && (
            <Card>
              <CardHeader>
                <CardTitle>Top Users by Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topUsers.map((user, index) => (
                    <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{user.userId}</div>
                          <div className="text-sm text-gray-500">{user.traceCount} traces</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${user.cost.toFixed(4)}</div>
                        <div className="text-sm text-gray-500">
                          ${(user.cost / user.traceCount).toFixed(4)}/trace
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}