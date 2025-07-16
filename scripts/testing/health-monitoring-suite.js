#!/usr/bin/env node

/**
 * Health Check and Monitoring Suite for Docker Stack
 * Comprehensive monitoring of all services, performance metrics, and alerting
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  services: {
    redis: {
      host: 'localhost',
      port: 6379,
      healthEndpoint: null,
      dockerContainer: 'swarm-redis'
    },
    postgres: {
      host: 'localhost',
      port: 5432,
      healthEndpoint: null,
      dockerContainer: 'swarm-postgres'
    },
    clickhouse: {
      host: 'localhost',
      port: 8123,
      healthEndpoint: 'http://localhost:8123/ping',
      dockerContainer: 'swarm-clickhouse'
    },
    langfuse: {
      host: 'localhost',
      port: 3001,
      healthEndpoint: 'http://localhost:3001/api/health',
      dockerContainer: 'swarm-langfuse'
    },
    langfuseWorker: {
      host: 'localhost',
      port: null,
      healthEndpoint: null,
      dockerContainer: 'swarm-langfuse-worker'
    },
    dashboard: {
      host: 'localhost',
      port: 3000,
      healthEndpoint: 'http://localhost:3000/api/health',
      dockerContainer: null
    },
    manager: {
      host: 'localhost',
      port: 8080,
      healthEndpoint: 'http://localhost:8080/health',
      dockerContainer: null
    }
  },
  monitoring: {
    interval: 30000, // 30 seconds
    timeout: 10000,  // 10 seconds
    retries: 3,
    alertThresholds: {
      cpu: 80,     // CPU usage %
      memory: 85,  // Memory usage %
      disk: 90,    // Disk usage %
      responseTime: 5000 // Response time ms
    }
  }
};

// Health check results
const healthData = {
  timestamp: new Date().toISOString(),
  services: {},
  system: {},
  alerts: [],
  summary: {
    total: 0,
    healthy: 0,
    unhealthy: 0,
    unknown: 0
  }
};

// Logging utilities
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const error = (message) => {
  console.error(`[ERROR] ${message}`);
};

const success = (message) => {
  console.log(`[SUCCESS] ${message}`);
};

const warning = (message) => {
  console.warn(`[WARNING] ${message}`);
};

// Update service health
const updateServiceHealth = (serviceName, status, message, details = {}) => {
  healthData.services[serviceName] = {
    status,
    message,
    details,
    timestamp: new Date().toISOString(),
    responseTime: details.responseTime || null
  };
  
  healthData.summary.total++;
  if (status === 'healthy') healthData.summary.healthy++;
  else if (status === 'unhealthy') healthData.summary.unhealthy++;
  else healthData.summary.unknown++;
};

// Add alert
const addAlert = (severity, service, message, details = {}) => {
  healthData.alerts.push({
    severity,
    service,
    message,
    details,
    timestamp: new Date().toISOString()
  });
};

// Check HTTP endpoint health
async function checkHttpHealth(serviceName, url) {
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, {
      timeout: CONFIG.monitoring.timeout,
      validateStatus: (status) => status >= 200 && status < 500
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.status >= 200 && response.status < 300) {
      success(`${serviceName} HTTP health check passed (${responseTime}ms)`);
      updateServiceHealth(serviceName, 'healthy', 'HTTP endpoint responsive', {
        responseTime,
        statusCode: response.status,
        data: typeof response.data === 'object' ? response.data : { body: response.data.substring(0, 100) }
      });
      
      // Check response time alert
      if (responseTime > CONFIG.monitoring.alertThresholds.responseTime) {
        addAlert('warning', serviceName, `Slow response time: ${responseTime}ms`, { responseTime });
      }
      
      return true;
    } else {
      error(`${serviceName} returned status ${response.status}`);
      updateServiceHealth(serviceName, 'unhealthy', `HTTP status ${response.status}`, {
        responseTime,
        statusCode: response.status
      });
      addAlert('error', serviceName, `HTTP health check failed with status ${response.status}`);
      return false;
    }
  } catch (err) {
    const responseTime = Date.now() - startTime;
    error(`${serviceName} HTTP health check failed: ${err.message}`);
    updateServiceHealth(serviceName, 'unhealthy', `HTTP check failed: ${err.message}`, {
      responseTime,
      error: err.message
    });
    addAlert('error', serviceName, `HTTP endpoint unreachable: ${err.message}`);
    return false;
  }
}

// Check Docker container health
async function checkDockerHealth(serviceName, containerName) {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
    
    if (!stdout.trim()) {
      warning(`${serviceName} container not found: ${containerName}`);
      updateServiceHealth(serviceName, 'unknown', 'Container not found', { containerName });
      return false;
    }
    
    const status = stdout.trim();
    const isHealthy = status.includes('Up') && !status.includes('unhealthy');
    
    if (isHealthy) {
      success(`${serviceName} container is healthy`);
      updateServiceHealth(serviceName, 'healthy', 'Container running', { 
        containerStatus: status,
        containerName 
      });
      return true;
    } else {
      error(`${serviceName} container is unhealthy: ${status}`);
      updateServiceHealth(serviceName, 'unhealthy', 'Container unhealthy', { 
        containerStatus: status,
        containerName 
      });
      addAlert('error', serviceName, `Container unhealthy: ${status}`);
      return false;
    }
  } catch (err) {
    error(`${serviceName} Docker health check failed: ${err.message}`);
    updateServiceHealth(serviceName, 'unknown', `Docker check failed: ${err.message}`);
    return false;
  }
}

// Check Redis connectivity
async function checkRedisHealth() {
  const serviceName = 'redis';
  log(`Checking ${serviceName} health...`);
  
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: CONFIG.services.redis.host,
      port: CONFIG.services.redis.port,
      connectTimeout: CONFIG.monitoring.timeout,
      lazyConnect: true
    });
    
    const startTime = Date.now();
    await redis.connect();
    
    const pong = await redis.ping();
    const responseTime = Date.now() - startTime;
    
    if (pong === 'PONG') {
      // Get Redis info
      const info = await redis.info('memory');
      const memoryInfo = info.split('\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) acc[key.trim()] = value.trim();
        return acc;
      }, {});
      
      await redis.quit();
      
      success(`Redis health check passed (${responseTime}ms)`);
      updateServiceHealth(serviceName, 'healthy', 'Redis connection successful', {
        responseTime,
        memory: memoryInfo
      });
      return true;
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (err) {
    error(`Redis health check failed: ${err.message}`);
    updateServiceHealth(serviceName, 'unhealthy', `Redis check failed: ${err.message}`);
    addAlert('error', serviceName, `Redis connectivity failed: ${err.message}`);
    return false;
  }
}

// Check PostgreSQL connectivity
async function checkPostgresHealth() {
  const serviceName = 'postgres';
  log(`Checking ${serviceName} health...`);
  
  try {
    const { Client } = require('pg');
    const client = new Client({
      host: CONFIG.services.postgres.host,
      port: CONFIG.services.postgres.port,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: 'postgres',
      connectionTimeoutMillis: CONFIG.monitoring.timeout
    });
    
    const startTime = Date.now();
    await client.connect();
    
    const result = await client.query('SELECT version(), NOW()');
    const responseTime = Date.now() - startTime;
    
    await client.end();
    
    success(`PostgreSQL health check passed (${responseTime}ms)`);
    updateServiceHealth(serviceName, 'healthy', 'PostgreSQL connection successful', {
      responseTime,
      version: result.rows[0].version.split(' ')[1],
      timestamp: result.rows[0].now
    });
    return true;
  } catch (err) {
    error(`PostgreSQL health check failed: ${err.message}`);
    updateServiceHealth(serviceName, 'unhealthy', `PostgreSQL check failed: ${err.message}`);
    addAlert('error', serviceName, `PostgreSQL connectivity failed: ${err.message}`);
    return false;
  }
}

// Get system resource usage
async function getSystemResources() {
  log('Collecting system resource usage...');
  
  try {
    // Get Docker stats for all containers
    const { stdout } = await execAsync('docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"');
    
    const lines = stdout.trim().split('\n').slice(1); // Skip header
    const containerStats = {};
    
    lines.forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 6) {
        const containerName = parts[0];
        containerStats[containerName] = {
          cpu: parts[1],
          memoryUsage: parts[2],
          memoryPercent: parseFloat(parts[3].replace('%', '')),
          network: parts[4],
          blockIO: parts[5]
        };
        
        // Check for resource alerts
        const memPercent = containerStats[containerName].memoryPercent;
        const cpuPercent = parseFloat(parts[1].replace('%', ''));
        
        if (memPercent > CONFIG.monitoring.alertThresholds.memory) {
          addAlert('warning', containerName, `High memory usage: ${memPercent}%`, { memoryPercent: memPercent });
        }
        
        if (cpuPercent > CONFIG.monitoring.alertThresholds.cpu) {
          addAlert('warning', containerName, `High CPU usage: ${cpuPercent}%`, { cpuPercent });
        }
      }
    });
    
    // Get system disk usage
    const { stdout: dfOutput } = await execAsync('df -h / | tail -1');
    const diskParts = dfOutput.trim().split(/\s+/);
    const diskUsagePercent = parseFloat(diskParts[4].replace('%', ''));
    
    if (diskUsagePercent > CONFIG.monitoring.alertThresholds.disk) {
      addAlert('warning', 'system', `High disk usage: ${diskUsagePercent}%`, { diskUsagePercent });
    }
    
    healthData.system = {
      containers: containerStats,
      disk: {
        usage: diskParts[4],
        available: diskParts[3],
        total: diskParts[1]
      }
    };
    
    success(`System resources collected for ${Object.keys(containerStats).length} containers`);
    return true;
  } catch (err) {
    error(`System resource collection failed: ${err.message}`);
    healthData.system = { error: err.message };
    return false;
  }
}

// Check all services
async function checkAllServices() {
  log('Starting health checks for all services...');
  
  // Reset counters
  healthData.summary = { total: 0, healthy: 0, unhealthy: 0, unknown: 0 };
  healthData.services = {};
  healthData.alerts = [];
  
  // Check services with HTTP endpoints
  const httpChecks = [];
  for (const [serviceName, config] of Object.entries(CONFIG.services)) {
    if (config.healthEndpoint) {
      httpChecks.push(checkHttpHealth(serviceName, config.healthEndpoint));
    }
  }
  
  // Check services with Docker containers
  const dockerChecks = [];
  for (const [serviceName, config] of Object.entries(CONFIG.services)) {
    if (config.dockerContainer) {
      dockerChecks.push(checkDockerHealth(serviceName, config.dockerContainer));
    }
  }
  
  // Special service checks
  const serviceChecks = [
    checkRedisHealth(),
    checkPostgresHealth()
  ];
  
  // Run all checks concurrently
  await Promise.allSettled([...httpChecks, ...dockerChecks, ...serviceChecks]);
  
  // Get system resources
  await getSystemResources();
}

// Generate health report
function generateHealthReport() {
  log('=== HEALTH MONITORING REPORT ===');
  log(`Timestamp: ${healthData.timestamp}`);
  log(`Services: ${healthData.summary.healthy}/${healthData.summary.total} healthy`);
  
  // Service status
  console.log('\n🔍 Service Status:');
  Object.entries(healthData.services).forEach(([serviceName, service]) => {
    const emoji = service.status === 'healthy' ? '✅' : service.status === 'unhealthy' ? '❌' : '⚠️';
    const responseTime = service.responseTime ? ` (${service.responseTime}ms)` : '';
    console.log(`${emoji} ${serviceName}: ${service.status.toUpperCase()}${responseTime} - ${service.message}`);
  });
  
  // Alerts
  if (healthData.alerts.length > 0) {
    console.log('\n🚨 Alerts:');
    healthData.alerts.forEach(alert => {
      const emoji = alert.severity === 'error' ? '🔴' : '🟡';
      console.log(`${emoji} [${alert.severity.toUpperCase()}] ${alert.service}: ${alert.message}`);
    });
  } else {
    console.log('\n✅ No alerts');
  }
  
  // System resources
  if (healthData.system.containers) {
    console.log('\n📊 Resource Usage:');
    Object.entries(healthData.system.containers).forEach(([container, stats]) => {
      console.log(`  ${container}: CPU ${stats.cpu}, Memory ${stats.memoryUsage} (${stats.memoryPercent}%)`);
    });
    
    if (healthData.system.disk) {
      console.log(`  Disk: ${healthData.system.disk.usage} used of ${healthData.system.disk.total}`);
    }
  }
}

// Save health data to file
async function saveHealthData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const healthPath = path.join(process.cwd(), `health-check-${timestamp}.json`);
  await fs.writeFile(healthPath, JSON.stringify(healthData, null, 2));
  log(`Health data saved to ${healthPath}`);
  
  // Also save as latest
  const latestPath = path.join(process.cwd(), 'health-check-latest.json');
  await fs.writeFile(latestPath, JSON.stringify(healthData, null, 2));
}

// Continuous monitoring mode
async function continuousMonitoring(duration = 300000) { // 5 minutes default
  log(`Starting continuous monitoring for ${duration / 1000} seconds...`);
  
  const startTime = Date.now();
  const endTime = startTime + duration;
  
  while (Date.now() < endTime) {
    await checkAllServices();
    generateHealthReport();
    await saveHealthData();
    
    // Store results for coordination
    try {
      await execAsync(
        `npx claude-flow@alpha hooks notification --message "Health check completed: ${healthData.summary.healthy}/${healthData.summary.total} services healthy, ${healthData.alerts.length} alerts" --telemetry true`
      );
    } catch (err) {
      // Ignore if hooks not available
    }
    
    if (Date.now() < endTime) {
      log(`Waiting ${CONFIG.monitoring.interval / 1000} seconds until next check...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.monitoring.interval));
    }
  }
  
  log('Continuous monitoring completed');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'single';
  const duration = parseInt(args[1]) || 300000;
  
  log('Starting Health Monitoring Suite');
  log(`Mode: ${mode}`);
  log(`Monitoring interval: ${CONFIG.monitoring.interval / 1000}s`);
  log(`Request timeout: ${CONFIG.monitoring.timeout / 1000}s`);
  
  if (mode === 'continuous') {
    await continuousMonitoring(duration);
  } else {
    await checkAllServices();
    generateHealthReport();
    await saveHealthData();
    
    // Store results for coordination
    try {
      await execAsync(
        `npx claude-flow@alpha hooks notification --message "Health monitoring completed: ${healthData.summary.healthy}/${healthData.summary.total} services healthy" --telemetry true`
      );
    } catch (err) {
      // Ignore if hooks not available
    }
    
    // Exit with appropriate code
    if (healthData.summary.unhealthy > 0) {
      error(`${healthData.summary.unhealthy} services are unhealthy`);
      process.exit(1);
    } else {
      success('All services are healthy!');
      process.exit(0);
    }
  }
}

// Handle errors
process.on('unhandledRejection', (err) => {
  error(`Unhandled rejection: ${err.message}`);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    error(`Health monitoring failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  checkHttpHealth,
  checkDockerHealth,
  checkRedisHealth,
  checkPostgresHealth,
  checkAllServices,
  getSystemResources,
  generateHealthReport,
  continuousMonitoring
};