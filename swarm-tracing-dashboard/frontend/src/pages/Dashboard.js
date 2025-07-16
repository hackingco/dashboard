import React, { useState, useEffect } from 'react';
import { Activity, Eye, Clock, Zap, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Dashboard = () => {
  const [traces, setTraces] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [swarmStatus, setSwarmStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all dashboard data in parallel
      const [tracesRes, analyticsRes, swarmRes] = await Promise.allSettled([
        fetch('http://localhost:3002/api/traces'),
        fetch('http://localhost:3002/api/analytics'),
        fetch('http://localhost:3002/api/swarm/status')
      ]);

      if (tracesRes.status === 'fulfilled') {
        const tracesData = await tracesRes.value.json();
        setTraces(tracesData.traces || []);
      }

      if (analyticsRes.status === 'fulfilled') {
        const analyticsData = await analyticsRes.value.json();
        setAnalytics(analyticsData);
      }

      if (swarmRes.status === 'fulfilled') {
        const swarmData = await swarmRes.value.json();
        setSwarmStatus(swarmData);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTestTrace = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/test/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Dashboard Manual Test',
          input: { trigger: 'manual_test', user: 'dashboard_user' },
          output: { status: 'test_completed', visible: true }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`Test trace created: ${result.traceId}`);
        fetchDashboardData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to create test trace:', error);
      alert('Failed to create test trace');
    }
  };

  // Process data for charts
  const traceTimelineData = traces.slice(-10).map((trace, index) => ({
    index: index + 1,
    timestamp: new Date(trace.timestamp).getTime(),
    traces: index + 1
  }));

  const traceTypeData = analytics?.traceTypes ? 
    Object.entries(analytics.traceTypes).map(([name, count]) => ({
      name: name.length > 20 ? name.substring(0, 20) + '...' : name,
      count
    })) : [];

  if (loading && !traces.length) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Swarm Tracing Dashboard</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={createTestTrace} className="btn btn-primary">
              <Zap size={16} />
              Create Test Trace
            </button>
            <button onClick={fetchDashboardData} className="btn">
              <RefreshCw size={16} />
              Refresh
            </button>
            <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div className="card-content">
          <p>Real-time observability dashboard for swarm intelligence operations with Langfuse integration.</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Total Traces</h3>
            <Eye size={20} style={{ color: '#00d4ff' }} />
          </div>
          <div className="card-content">
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00d4ff' }}>
              {analytics?.totalTraces || traces.length}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
              All time traces
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Traces</h3>
            <Clock size={20} style={{ color: '#10b981' }} />
          </div>
          <div className="card-content">
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
              {analytics?.recentTraces || 0}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
              Last hour
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Swarm Status</h3>
            <Activity size={20} style={{ color: swarmStatus?.langfuseEnabled ? '#10b981' : '#ef4444' }} />
          </div>
          <div className="card-content">
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: swarmStatus?.langfuseEnabled ? '#10b981' : '#ef4444' }}>
              {swarmStatus?.status || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
              Langfuse: {swarmStatus?.langfuseEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Active Agents</h3>
            <Activity size={20} style={{ color: '#f59e0b' }} />
          </div>
          <div className="card-content">
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {swarmStatus?.agents?.length || 0}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
              Registered agents
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Trace Timeline</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={traceTimelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="index" 
                  stroke="rgba(255,255,255,0.7)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.7)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="traces" 
                  stroke="#00d4ff" 
                  strokeWidth={2}
                  dot={{ fill: '#00d4ff', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Trace Types</h3>
          </div>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={traceTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.7)"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.7)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Traces */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Traces</h3>
        </div>
        <div className="card-content">
          {traces.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)' }}>Trace ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)' }}>Timestamp</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)' }}>User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.slice(0, 10).map((trace) => (
                    <tr key={trace.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {trace.id}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {trace.name || 'Unnamed Trace'}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                        {new Date(trace.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                        {trace.userId || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.7)' }}>
              No traces found. Create a test trace to get started!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;