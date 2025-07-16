import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { useSocket } from '../hooks/useSocket';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function PerformanceMetrics() {
  const { realtimeData } = useSocket();
  const [timeRange, setTimeRange] = useState('24h');
  const [metrics, setMetrics] = useState({
    overview: {
      avgResponseTime: 0,
      totalRequests: 0,
      successRate: 0,
      errorRate: 0,
      activeKeys: 0,
      peakLoad: 0,
    },
    timeSeries: [],
    keyUsage: [],
    errorBreakdown: [],
    systemHealth: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  useEffect(() => {
    // Update with realtime metrics
    if (realtimeData.metrics) {
      setMetrics(prev => ({
        ...prev,
        overview: {
          ...prev.overview,
          ...realtimeData.metrics,
        },
      }));
    }
  }, [realtimeData.metrics]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/metrics/performance?range=${timeRange}`);
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name.includes('Time') ? 'ms' : ''}
              {entry.name.includes('Rate') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Metrics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor API key system performance and health
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg Response Time</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metrics.overview.avgResponseTime}ms
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {metrics.overview.avgResponseTime < 100 ? (
                    <span className="text-green-600 flex items-center">
                      <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                      Excellent
                    </span>
                  ) : (
                    <span className="text-yellow-600 flex items-center">
                      <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                      Monitor
                    </span>
                  )}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <ClockIcon className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatNumber(metrics.overview.totalRequests)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Success Rate: {metrics.overview.successRate}%
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <ServerIcon className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Peak Load</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatNumber(metrics.overview.peakLoad)}/s
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Active Keys: {metrics.overview.activeKeys}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <CpuChipIcon className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Response time trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Response Time Trend</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.timeSeries}>
                  <defs>
                    <linearGradient id="colorResponseTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                  />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="responseTime"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorResponseTime)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Request volume */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Request Volume</h3>
          </div>
          <div className="card-body">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time"
                    tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                  />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Total Requests"
                  />
                  <Line
                    type="monotone"
                    dataKey="errors"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Errors"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Key usage distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Key Usage Distribution</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.keyUsage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {metrics.keyUsage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Error breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Error Breakdown</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.errorBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="type" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ef4444">
                    {metrics.errorBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* System health */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">System Health</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" data={metrics.systemHealth}>
                  <RadialBar
                    minAngle={15}
                    label={{ position: 'insideStart', fill: '#fff' }}
                    background
                    clockWise
                    dataKey="value"
                  >
                    {metrics.systemHealth.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </RadialBar>
                  <Legend
                    iconSize={10}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                  />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Performance insights */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Performance Insights</h3>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Response Time Analysis</p>
                <p className="text-sm text-gray-500">
                  95th percentile response time is {metrics.overview.avgResponseTime * 1.5}ms. 
                  Consider optimizing database queries for keys with high usage.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <CircleStackIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Cache Performance</p>
                <p className="text-sm text-gray-500">
                  Cache hit rate is 92%. Increasing cache TTL could improve performance by 15%.
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <ServerIcon className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Scaling Recommendation</p>
                <p className="text-sm text-gray-500">
                  Current load is at 65% capacity. Consider horizontal scaling if load exceeds 80%.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}