import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import KeyManagement from './pages/KeyManagement';
import KeyValidation from './pages/KeyValidation';
import RotationSchedule from './pages/RotationSchedule';
import PerformanceMetrics from './pages/PerformanceMetrics';
import AuditLogs from './pages/AuditLogs';
import SecuritySettings from './pages/SecuritySettings';
import { SocketProvider } from './hooks/useSocket';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/keys" element={<KeyManagement />} />
              <Route path="/validation" element={<KeyValidation />} />
              <Route path="/rotation" element={<RotationSchedule />} />
              <Route path="/metrics" element={<PerformanceMetrics />} />
              <Route path="/audit" element={<AuditLogs />} />
              <Route path="/security" element={<SecuritySettings />} />
            </Routes>
          </Layout>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;