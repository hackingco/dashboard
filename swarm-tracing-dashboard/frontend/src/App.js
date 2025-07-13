import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Traces from './pages/Traces';
import Analytics from './pages/Analytics';
import SwarmStatus from './pages/SwarmStatus';
import { Activity, BarChart3, Network, Eye } from 'lucide-react';
import './App.css';

function App() {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/health');
      const health = await response.json();
      setBackendHealth(health);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Backend health check failed:', error);
      setConnectionStatus('disconnected');
    }
  };

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="logo">
              <Network className="logo-icon" />
              <h1>Swarm Tracing Dashboard</h1>
            </div>
            <div className="connection-status">
              <div className={`status-indicator ${connectionStatus}`}>
                <div className="status-dot"></div>
                <span>{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
              </div>
              {backendHealth && (
                <div className="backend-info">
                  <span>Langfuse: {backendHealth.langfuse}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav className="app-nav">
          <NavLink to="/" className="nav-item" end>
            <Activity className="nav-icon" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/traces" className="nav-item">
            <Eye className="nav-icon" />
            <span>Traces</span>
          </NavLink>
          <NavLink to="/analytics" className="nav-item">
            <BarChart3 className="nav-icon" />
            <span>Analytics</span>
          </NavLink>
          <NavLink to="/swarm" className="nav-item">
            <Network className="nav-icon" />
            <span>Swarm Status</span>
          </NavLink>
        </nav>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/traces" element={<Traces />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/swarm" element={<SwarmStatus />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-content">
            <span>Swarm Intelligence Dashboard v1.0.0</span>
            <span>Powered by Langfuse + React + Node.js</span>
            <span>Real-time observability for distributed swarm operations</span>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;