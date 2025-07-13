import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Database, Network, Server, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const SwarmStatus = () => {
  const [swarmData, setSwarmData] = useState({
    agents: [],
    coordinator: { status: 'unknown', lastSeen: null },
    langfuse: { status: 'unknown', traces: 0 },
    memory: { usage: 0, total: 0 },
    network: { latency: 0, connections: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSwarmStatus();
    const interval = setInterval(fetchSwarmStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSwarmStatus = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/swarm/status');
      const data = await response.json();
      setSwarmData(data);
    } catch (error) {
      console.error('Failed to fetch swarm status:', error);
      // Set default offline status
      setSwarmData(prev => ({
        ...prev,
        coordinator: { status: 'offline', lastSeen: null },
        langfuse: { status: 'offline', traces: 0 }
      }));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': case 'online': return '#10b981';
      case 'busy': case 'working': return '#f59e0b';
      case 'idle': return '#06b6d4';
      case 'error': case 'offline': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': case 'online': return <CheckCircle size={16} />;
      case 'busy': case 'working': return <Activity size={16} />;
      case 'error': case 'offline': return <AlertCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  if (loading) {
    return <div className="loading">Loading swarm status...</div>;
  }

  return (
    <div className="swarm-status-page">
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Swarm Status Monitor</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: swarmData.coordinator.status === 'online' ? '#10b981' : '#ef4444', 
              borderRadius: '50%',
              animation: swarmData.coordinator.status === 'online' ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ 
              color: swarmData.coordinator.status === 'online' ? '#10b981' : '#ef4444',
              fontWeight: '500'
            }}>
              {swarmData.coordinator.status === 'online' ? 'Swarm Online' : 'Swarm Offline'}
            </span>
          </div>
        </div>
        <div className="card-content">
          <p>Real-time monitoring of swarm agents, coordinator, and system health.</p>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-4">
        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <Server size={32} style={{ color: getStatusColor(swarmData.coordinator.status), marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: getStatusColor(swarmData.coordinator.status) }}>
              Coordinator
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
              {swarmData.coordinator.status}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <Database size={32} style={{ color: getStatusColor(swarmData.langfuse.status), marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: getStatusColor(swarmData.langfuse.status) }}>
              Langfuse
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>
              {swarmData.langfuse.traces} traces
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <Cpu size={32} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {Math.round((swarmData.memory.usage / swarmData.memory.total) * 100)}%
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>
              Memory Usage
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content" style={{ textAlign: 'center' }}>
            <Network size={32} style={{ color: '#8b5cf6', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {swarmData.network.latency}ms
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>
              Network Latency
            </div>
          </div>
        </div>
      </div>

      {/* Active Agents */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Active Agents ({swarmData.agents.length})</h3>
        </div>
        <div className="card-content">
          {swarmData.agents.length > 0 ? (
            <div className="grid grid-2">
              {swarmData.agents.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                        {agent.name || `Agent ${agent.id}`}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>
                        Type: {agent.type}
                      </div>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      color: getStatusColor(agent.status)
                    }}>
                      {getStatusIcon(agent.status)}
                      <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
                        {agent.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    <div><strong>Current Task:</strong> {agent.currentTask || 'Idle'}</div>
                    <div><strong>Last Activity:</strong> {agent.lastActivity ? new Date(agent.lastActivity).toLocaleTimeString() : 'Unknown'}</div>
                  </div>

                  {/* Agent Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Tasks Completed:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>{agent.tasksCompleted || 0}</span>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Uptime:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>{agent.uptime || '0m'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>CPU:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>{agent.cpuUsage || 0}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Memory:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>{agent.memoryUsage || 0}MB</span>
                    </div>
                  </div>

                  {/* Progress Bar for Current Task */}
                  {agent.taskProgress !== undefined && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '0.75rem',
                        marginBottom: '0.25rem'
                      }}>
                        <span>Task Progress</span>
                        <span>{agent.taskProgress}%</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '4px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${agent.taskProgress}%`,
                          height: '100%',
                          background: getStatusColor(agent.status),
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.7)' }}>
              <Activity size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <div>No active agents detected</div>
              <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Start the swarm to see agent activity
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Health */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">System Health</h3>
        </div>
        <div className="card-content">
          <div className="grid grid-3">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}>
                Memory Usage
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {swarmData.memory.usage}MB / {swarmData.memory.total}MB
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}>
                Network Connections
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>
                {swarmData.network.connections}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}>
                Last Update
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#06b6d4' }}>
                {new Date().toLocaleTimeString()}
              </div>
            </div>
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

export default SwarmStatus;