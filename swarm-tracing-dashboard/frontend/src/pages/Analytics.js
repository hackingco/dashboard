import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Activity, Clock, Users } from 'lucide-react';

const Analytics = () => {
  const [analytics, setAnalytics] = useState({
    totalTraces: 0,
    tracesLast24h: 0,
    avgDuration: 0,
    uniqueUsers: 0,
    tracesByHour: [],
    tracesByType: [],
    performanceMetrics: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`http://localhost:3002/api/analytics?timeRange=${timeRange}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#00d4ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Trace Analytics</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['1h', '6h', '24h', '7d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`btn ${timeRange === range ? 'btn-primary' : ''}`}
                style={{
                  padding: '0.5rem 1rem',
                  background: timeRange === range ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                  color: timeRange === range ? '#000' : '#fff'
                }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="card-content">
          <p>Real-time analytics and performance insights from Langfuse trace data.</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-4">
        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <Activity size={32} style={{ color: '#00d4ff', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00d4ff' }}>
              {analytics.totalTraces.toLocaleString()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>Total Traces</div>
          </div>
        </div>

        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <TrendingUp size={32} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
              {analytics.tracesLast24h.toLocaleString()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>Last 24h</div>
          </div>
        </div>

        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <Clock size={32} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {analytics.avgDuration.toFixed(0)}ms
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>Avg Duration</div>
          </div>
        </div>

        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <Users size={32} style={{ color: '#8b5cf6', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {analytics.uniqueUsers.toLocaleString()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>Unique Users</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-2">
        {/* Traces Over Time */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Traces Over Time</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.tracesByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="hour" 
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)' }}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.7)"
                  tick={{ fill: 'rgba(255,255,255,0.7)' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#00d4ff" 
                  strokeWidth={2}
                  dot={{ fill: '#00d4ff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trace Types Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Trace Types</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.tracesByType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {analytics.tracesByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Performance Metrics</h3>
        </div>
        <div className="card-content">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.performanceMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="metric" 
                stroke="rgba(255,255,255,0.7)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.7)"
                tick={{ fill: 'rgba(255,255,255,0.7)' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real-time Updates */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Real-time Activity</h3>
        </div>
        <div className="card-content">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '2rem',
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '8px'
          }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: '#10b981', 
              borderRadius: '50%',
              marginRight: '0.75rem',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ color: '#10b981', fontWeight: '500' }}>
              Live monitoring active - Updates every 30 seconds
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Analytics;