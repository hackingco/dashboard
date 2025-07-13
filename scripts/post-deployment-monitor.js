#!/usr/bin/env node

/**
 * Post-Deployment Monitoring Script
 * Continuously monitors deployment health for 1 hour after deployment
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const config = {
  monitoringDuration: 60 * 60 * 1000, // 1 hour in milliseconds
  healthCheckInterval: 30000, // 30 seconds
  alertThreshold: {
    responseTime: 2000, // 2 seconds
    errorRate: 0.05, // 5%
    cpuUsage: 0.8, // 80%
    memoryUsage: 0.85, // 85%
  },
  services: {
    manager: process.env.MANAGER_URL || 'https://swarm-manager.fly.dev',
    dashboard: process.env.DASHBOARD_URL || 'https://swarm-dashboard.fly.dev',
  },
  notifications: {
    slack: process.env.SLACK_WEBHOOK,
    email: process.env.ALERT_EMAIL,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

// Initialize Supabase client
const supabase = config.supabase.url && config.supabase.key
  ? createClient(config.supabase.url, config.supabase.key)
  : null;

// Monitoring state
let monitoringData = {
  startTime: Date.now(),
  healthChecks: [],
  alerts: [],
  metrics: {
    uptime: 0,
    totalRequests: 0,
    errors: 0,
    averageResponseTime: 0,
  },
};

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const calculateMetrics = () => {
  const totalChecks = monitoringData.healthChecks.length;
  const successfulChecks = monitoringData.healthChecks.filter(check => check.success).length;
  const uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
  
  const responseTimes = monitoringData.healthChecks
    .filter(check => check.responseTime)
    .map(check => check.responseTime);
  
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    : 0;

  return {
    uptime: uptime.toFixed(2),
    totalChecks,
    successfulChecks,
    failedChecks: totalChecks - successfulChecks,
    averageResponseTime: averageResponseTime.toFixed(2),
  };
};

// Health check functions
async function performHealthCheck(service, url) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${url}/health`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'PostDeploymentMonitor/1.0',
      },
    });
    
    const responseTime = Date.now() - startTime;
    const healthData = await response.json();
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      service,
      success: response.ok,
      status: response.status,
      responseTime,
      health: healthData,
    };
    
    monitoringData.healthChecks.push(healthCheck);
    
    // Check for performance issues
    if (responseTime > config.alertThreshold.responseTime) {
      await sendAlert('performance', `High response time for ${service}: ${responseTime}ms`);
    }
    
    if (!response.ok) {
      await sendAlert('availability', `Health check failed for ${service}: ${response.status}`);
    }
    
    logWithTimestamp(`✅ ${service} health check: ${response.status} (${responseTime}ms)`);
    
    return healthCheck;
  } catch (error) {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      service,
      success: false,
      error: error.message,
      responseTime: Date.now() - startTime,
    };
    
    monitoringData.healthChecks.push(healthCheck);
    await sendAlert('critical', `${service} health check failed: ${error.message}`);
    
    logWithTimestamp(`❌ ${service} health check failed: ${error.message}`);
    
    return healthCheck;
  }
}

// WebSocket monitoring
async function monitorWebSocket() {
  return new Promise((resolve) => {
    const wsUrl = config.services.manager.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      logWithTimestamp('🔗 WebSocket connection established');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        logWithTimestamp(`📨 WebSocket message: ${message.type}`);
      } catch (error) {
        logWithTimestamp(`⚠️  Invalid WebSocket message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      logWithTimestamp(`❌ WebSocket error: ${error.message}`);
      sendAlert('websocket', `WebSocket connection error: ${error.message}`);
    });
    
    ws.on('close', () => {
      logWithTimestamp('🔌 WebSocket connection closed');
      resolve();
    });
    
    // Keep connection alive for monitoring duration
    setTimeout(() => {
      ws.close();
    }, config.monitoringDuration);
  });
}

// Alert system
async function sendAlert(type, message) {
  const alert = {
    timestamp: new Date().toISOString(),
    type,
    message,
    severity: type === 'critical' ? 'high' : type === 'performance' ? 'medium' : 'low',
  };
  
  monitoringData.alerts.push(alert);
  
  logWithTimestamp(`🚨 ALERT [${type.toUpperCase()}]: ${message}`);
  
  // Send Slack notification
  if (config.notifications.slack) {
    try {
      await fetch(config.notifications.slack, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Post-Deployment Alert`,
          attachments: [{
            color: alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'good',
            fields: [
              { title: 'Type', value: type, short: true },
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'Message', value: message, short: false },
              { title: 'Time', value: alert.timestamp, short: true },
            ],
          }],
        }),
      });
    } catch (error) {
      logWithTimestamp(`❌ Failed to send Slack alert: ${error.message}`);
    }
  }
  
  // Store alert in Supabase
  if (supabase) {
    try {
      await supabase
        .from('deployment_alerts')
        .insert({
          type,
          message,
          severity: alert.severity,
          deployment_id: process.env.GITHUB_RUN_ID,
          created_at: alert.timestamp,
        });
    } catch (error) {
      logWithTimestamp(`❌ Failed to store alert in database: ${error.message}`);
    }
  }
}

// Performance metrics collection
async function collectMetrics() {
  try {
    // Collect system metrics from manager service
    const metricsResponse = await fetch(`${config.services.manager}/api/metrics`, {
      timeout: 5000,
    });
    
    if (metricsResponse.ok) {
      const metrics = await metricsResponse.json();
      
      // Check CPU usage
      if (metrics.system?.cpu > config.alertThreshold.cpuUsage) {
        await sendAlert('performance', `High CPU usage: ${(metrics.system.cpu * 100).toFixed(1)}%`);
      }
      
      // Check memory usage
      if (metrics.system?.memory > config.alertThreshold.memoryUsage) {
        await sendAlert('performance', `High memory usage: ${(metrics.system.memory * 100).toFixed(1)}%`);
      }
      
      logWithTimestamp(`📊 Metrics collected - CPU: ${(metrics.system?.cpu * 100 || 0).toFixed(1)}%, Memory: ${(metrics.system?.memory * 100 || 0).toFixed(1)}%`);
    }
  } catch (error) {
    logWithTimestamp(`⚠️  Failed to collect metrics: ${error.message}`);
  }
}

// Database connectivity check
async function checkDatabaseConnectivity() {
  try {
    const response = await fetch(`${config.services.manager}/api/system/database-status`, {
      timeout: 5000,
    });
    
    if (response.ok) {
      const status = await response.json();
      
      if (!status.connected) {
        await sendAlert('critical', 'Database connection lost');
      } else if (status.latency > 1000) {
        await sendAlert('performance', `High database latency: ${status.latency}ms`);
      }
      
      logWithTimestamp(`🗄️  Database status: ${status.connected ? 'Connected' : 'Disconnected'} (${status.latency}ms)`);
    }
  } catch (error) {
    await sendAlert('critical', `Database health check failed: ${error.message}`);
  }
}

// Generate monitoring report
async function generateReport() {
  const metrics = calculateMetrics();
  const duration = Date.now() - monitoringData.startTime;
  
  const report = {
    summary: {
      monitoringDuration: `${Math.round(duration / 1000 / 60)} minutes`,
      overallHealth: metrics.uptime >= 99 ? 'Excellent' : metrics.uptime >= 95 ? 'Good' : 'Poor',
      ...metrics,
    },
    alerts: {
      total: monitoringData.alerts.length,
      critical: monitoringData.alerts.filter(a => a.severity === 'high').length,
      warnings: monitoringData.alerts.filter(a => a.severity === 'medium').length,
      info: monitoringData.alerts.filter(a => a.severity === 'low').length,
    },
    services: {
      manager: {
        checks: monitoringData.healthChecks.filter(c => c.service === 'manager').length,
        success_rate: calculateServiceSuccessRate('manager'),
      },
      dashboard: {
        checks: monitoringData.healthChecks.filter(c => c.service === 'dashboard').length,
        success_rate: calculateServiceSuccessRate('dashboard'),
      },
    },
    recommendations: generateRecommendations(metrics),
  };
  
  // Store report in Supabase
  if (supabase) {
    try {
      await supabase
        .from('deployment_monitoring_reports')
        .insert({
          deployment_id: process.env.GITHUB_RUN_ID,
          report,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      logWithTimestamp(`❌ Failed to store monitoring report: ${error.message}`);
    }
  }
  
  return report;
}

function calculateServiceSuccessRate(service) {
  const serviceChecks = monitoringData.healthChecks.filter(c => c.service === service);
  const successfulChecks = serviceChecks.filter(c => c.success).length;
  return serviceChecks.length > 0 ? ((successfulChecks / serviceChecks.length) * 100).toFixed(1) : '0.0';
}

function generateRecommendations(metrics) {
  const recommendations = [];
  
  if (parseFloat(metrics.uptime) < 99) {
    recommendations.push('Consider implementing additional health checks and monitoring');
  }
  
  if (parseFloat(metrics.averageResponseTime) > 1000) {
    recommendations.push('Investigate performance bottlenecks in API responses');
  }
  
  if (monitoringData.alerts.filter(a => a.severity === 'high').length > 0) {
    recommendations.push('Review and address critical alerts immediately');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Deployment is performing well - maintain current monitoring practices');
  }
  
  return recommendations;
}

// Main monitoring loop
async function startMonitoring() {
  logWithTimestamp('🚀 Starting post-deployment monitoring');
  logWithTimestamp(`📋 Monitoring duration: ${config.monitoringDuration / 1000 / 60} minutes`);
  logWithTimestamp(`🔄 Health check interval: ${config.healthCheckInterval / 1000} seconds`);
  
  const startTime = Date.now();
  
  // Start WebSocket monitoring
  const wsMonitoring = monitorWebSocket();
  
  // Main monitoring loop
  while (Date.now() - startTime < config.monitoringDuration) {
    const loopStartTime = Date.now();
    
    // Perform health checks
    await Promise.all([
      performHealthCheck('manager', config.services.manager),
      performHealthCheck('dashboard', config.services.dashboard),
    ]);
    
    // Collect additional metrics
    await Promise.all([
      collectMetrics(),
      checkDatabaseConnectivity(),
    ]);
    
    // Calculate time to next check
    const loopDuration = Date.now() - loopStartTime;
    const sleepTime = Math.max(0, config.healthCheckInterval - loopDuration);
    
    if (sleepTime > 0) {
      await delay(sleepTime);
    }
  }
  
  // Wait for WebSocket monitoring to complete
  await wsMonitoring;
  
  // Generate final report
  const report = await generateReport();
  
  logWithTimestamp('📊 Generating final monitoring report');
  console.log('\n' + '='.repeat(60));
  console.log('POST-DEPLOYMENT MONITORING REPORT');
  console.log('='.repeat(60));
  console.log(`📈 Overall Health: ${report.summary.overallHealth}`);
  console.log(`⏱️  Uptime: ${report.summary.uptime}%`);
  console.log(`📊 Average Response Time: ${report.summary.averageResponseTime}ms`);
  console.log(`🚨 Total Alerts: ${report.alerts.total} (${report.alerts.critical} critical)`);
  console.log(`✅ Manager Success Rate: ${report.services.manager.success_rate}%`);
  console.log(`✅ Dashboard Success Rate: ${report.services.dashboard.success_rate}%`);
  console.log('\n📋 Recommendations:');
  report.recommendations.forEach(rec => console.log(`  • ${rec}`));
  console.log('='.repeat(60));
  
  // Send final notification
  if (config.notifications.slack) {
    const color = report.summary.overallHealth === 'Excellent' ? 'good' : 
                  report.summary.overallHealth === 'Good' ? 'warning' : 'danger';
    
    await fetch(config.notifications.slack, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '📊 Post-Deployment Monitoring Complete',
        attachments: [{
          color,
          fields: [
            { title: 'Overall Health', value: report.summary.overallHealth, short: true },
            { title: 'Uptime', value: `${report.summary.uptime}%`, short: true },
            { title: 'Avg Response Time', value: `${report.summary.averageResponseTime}ms`, short: true },
            { title: 'Total Alerts', value: report.alerts.total, short: true },
          ],
        }],
      }),
    });
  }
  
  logWithTimestamp('✅ Post-deployment monitoring completed');
}

// Error handling
process.on('unhandledRejection', (error) => {
  logWithTimestamp(`❌ Unhandled rejection: ${error.message}`);
  sendAlert('critical', `Monitoring script error: ${error.message}`);
});

process.on('uncaughtException', (error) => {
  logWithTimestamp(`❌ Uncaught exception: ${error.message}`);
  sendAlert('critical', `Monitoring script crashed: ${error.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logWithTimestamp('🛑 Monitoring interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logWithTimestamp('🛑 Monitoring terminated');
  process.exit(0);
});

// Start monitoring
if (require.main === module) {
  startMonitoring().catch(error => {
    logWithTimestamp(`❌ Monitoring failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  startMonitoring,
  performHealthCheck,
  sendAlert,
  generateReport,
};