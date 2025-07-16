import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { useSocket } from '../hooks/useSocket';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const { realtimeData } = useSocket();
  const [stats, setStats] = useState({
    totalKeys: 0,
    activeKeys: 0,
    expiredKeys: 0,
    rotationsToday: 0,
    validationRate: 0,
    avgResponseTime: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [keyDistribution, setKeyDistribution] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, activityRes, perfRes, distRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/dashboard/activity'),
        axios.get('/api/dashboard/performance'),
        axios.get('/api/dashboard/distribution'),
      ]);

      setStats(statsRes.data);
      setRecentActivity(activityRes.data);
      setPerformanceData(perfRes.data);
      setKeyDistribution(distRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const quickStats = [
    {
      name: 'Total API Keys',
      value: stats.totalKeys,
      icon: KeyIcon,
      change: '+12%',
      changeType: 'positive',
      href: '/keys',
    },
    {
      name: 'Active Keys',
      value: stats.activeKeys,
      icon: CheckCircleIcon,
      change: '+4.75%',
      changeType: 'positive',
      href: '/keys',
    },
    {
      name: 'Validation Rate',
      value: `${stats.validationRate}%`,
      icon: ShieldCheckIcon,
      change: '-1.39%',
      changeType: 'negative',
      href: '/validation',
    },
    {
      name: 'Rotations Today',
      value: stats.rotationsToday,
      icon: ArrowPathIcon,
      change: '+54%',
      changeType: 'positive',
      href: '/rotation',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your API key management system
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="card hover:shadow-md transition-shadow"
          >
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {stat.value}
                      </div>
                      <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                        stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change}
                        <ArrowTrendingUpIcon
                          className={`ml-0.5 h-3 w-3 ${
                            stat.changeType === 'negative' ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Performance chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="responseTime" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="validations" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Key distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Key Distribution</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={keyDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {keyDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity and alerts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="card-body">
            <div className="flow-root">
              <ul className="-mb-8">
                {recentActivity.map((activity, activityIdx) => (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {activityIdx !== recentActivity.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                            activity.type === 'created' ? 'bg-green-500' :
                            activity.type === 'rotated' ? 'bg-blue-500' :
                            activity.type === 'deleted' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}>
                            {activity.type === 'created' ? (
                              <CheckCircleIcon className="h-5 w-5 text-white" />
                            ) : activity.type === 'rotated' ? (
                              <ArrowPathIcon className="h-5 w-5 text-white" />
                            ) : (
                              <ExclamationTriangleIcon className="h-5 w-5 text-white" />
                            )}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              {activity.description}
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            <time dateTime={activity.timestamp}>
                              {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {realtimeData.alerts?.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-lg p-4 ${
                    alert.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                    alert.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <ExclamationTriangleIcon className={`h-5 w-5 ${
                        alert.severity === 'critical' ? 'text-red-400' :
                        alert.severity === 'warning' ? 'text-yellow-400' :
                        'text-blue-400'
                      }`} />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className={`text-sm font-medium ${
                        alert.severity === 'critical' ? 'text-red-800' :
                        alert.severity === 'warning' ? 'text-yellow-800' :
                        'text-blue-800'
                      }`}>
                        {alert.title}
                      </p>
                      <p className={`mt-1 text-sm ${
                        alert.severity === 'critical' ? 'text-red-700' :
                        alert.severity === 'warning' ? 'text-yellow-700' :
                        'text-blue-700'
                      }`}>
                        {alert.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}