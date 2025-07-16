#!/usr/bin/env node

/**
 * Service Dependency Checker
 * Advanced dependency validation and coordination system
 * 
 * Features:
 * - Dependency graph analysis
 * - Service coordination validation
 * - Network connectivity testing
 * - Port availability checking
 * - Database schema validation
 * - Service mesh health verification
 */

const { exec } = require('child_process');
const net = require('net');
const dns = require('dns').promises;
const fs = require('fs').promises;
const path = require('path');

class ServiceDependencyChecker {
  constructor() {
    this.dependencies = new Map();
    this.services = new Map();
    this.networkTests = new Map();
    this.config = {
      connectionTimeout: 10000,
      retryAttempts: 3,
      retryDelay: 2000,
      healthCheckTimeout: 15000,
      dependencyTimeout: 30000
    };
    this.initializeDependencyGraph();
  }

  // Initialize dependency graph
  initializeDependencyGraph() {
    // Core service dependencies
    this.dependencies.set('cf-langfuse-server', {
      name: 'cf-langfuse-server',
      service: 'langfuse-main',
      dependencies: [
        {
          name: 'cf-langfuse-db',
          type: 'database',
          connection: 'postgresql://langfuse:production_secure_langfuse_2025@localhost:5432/langfuse',
          healthCheck: 'SELECT 1',
          required: true,
          timeout: 10000
        },
        {
          name: 'cf-clickhouse',
          type: 'database',
          connection: 'clickhouse://default:clickhouse123@localhost:9000/default',
          healthCheck: 'SELECT 1',
          required: true,
          timeout: 10000
        },
        {
          name: 'redis',
          type: 'cache',
          connection: 'redis://:production_secure_redis_2025@localhost:6379',
          healthCheck: 'PING',
          required: false,
          timeout: 5000
        }
      ],
      ports: [3000],
      networkRequirements: ['swarm-langfuse-v3-working'],
      volumeRequirements: ['postgres_data', 'clickhouse_data'],
      environmentRequirements: [
        'DATABASE_URL',
        'CLICKHOUSE_URL',
        'NEXTAUTH_SECRET',
        'SALT'
      ]
    });

    this.dependencies.set('langfuse-worker-built', {
      name: 'langfuse-worker-built',
      service: 'langfuse-worker',
      dependencies: [
        {
          name: 'cf-langfuse-db',
          type: 'database',
          connection: 'postgresql://langfuse:production_secure_langfuse_2025@localhost:5432/langfuse',
          healthCheck: 'SELECT 1',
          required: true,
          timeout: 10000
        },
        {
          name: 'cf-clickhouse',
          type: 'database',
          connection: 'clickhouse://default:clickhouse123@localhost:9000/default',
          healthCheck: 'SELECT 1',
          required: true,
          timeout: 10000
        },
        {
          name: 'cf-analysis-redis',
          type: 'cache',
          connection: 'redis://localhost:6380',
          healthCheck: 'PING',
          required: true,
          timeout: 5000
        }
      ],
      ports: [3030],
      networkRequirements: ['swarm-langfuse-v3-working'],
      volumeRequirements: ['postgres_data', 'clickhouse_data'],
      environmentRequirements: [
        'DATABASE_URL',
        'CLICKHOUSE_URL',
        'REDIS_URL'
      ]
    });

    this.dependencies.set('cf-langfuse-db', {
      name: 'cf-langfuse-db',
      service: 'postgres',
      dependencies: [],
      ports: [5432],
      networkRequirements: ['swarm-langfuse-v3-working'],
      volumeRequirements: ['postgres_data'],
      environmentRequirements: [
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB'
      ]
    });

    this.dependencies.set('cf-clickhouse', {
      name: 'cf-clickhouse',
      service: 'clickhouse',
      dependencies: [],
      ports: [8123, 9000],
      networkRequirements: ['swarm-langfuse-v3-working'],
      volumeRequirements: ['clickhouse_data'],
      environmentRequirements: [
        'CLICKHOUSE_DB',
        'CLICKHOUSE_USER',
        'CLICKHOUSE_PASSWORD'
      ]
    });

    this.dependencies.set('cf-analysis-app', {
      name: 'cf-analysis-app',
      service: 'analysis-app',
      dependencies: [
        {
          name: 'cf-analysis-postgres',
          type: 'database',
          connection: 'postgresql://postgres:postgres@localhost:5433/postgres',
          healthCheck: 'SELECT 1',
          required: true,
          timeout: 10000
        },
        {
          name: 'cf-analysis-redis',
          type: 'cache',
          connection: 'redis://localhost:6380',
          healthCheck: 'PING',
          required: true,
          timeout: 5000
        }
      ],
      ports: [3001],
      networkRequirements: ['swarm-network'],
      volumeRequirements: [],
      environmentRequirements: []
    });

    this.dependencies.set('cf-analysis-postgres', {
      name: 'cf-analysis-postgres',
      service: 'postgres',
      dependencies: [],
      ports: [5433],
      networkRequirements: ['swarm-network'],
      volumeRequirements: ['postgres-data'],
      environmentRequirements: [
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB'
      ]
    });

    this.dependencies.set('cf-analysis-redis', {
      name: 'cf-analysis-redis',
      service: 'redis',
      dependencies: [],
      ports: [6380],
      networkRequirements: ['swarm-network'],
      volumeRequirements: ['redis-data'],
      environmentRequirements: []
    });
  }

  // Check all dependencies
  async checkAllDependencies() {
    console.log('🔍 Starting comprehensive dependency check...');
    
    const results = {
      overall: 'healthy',
      services: {},
      networks: {},
      volumes: {},
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        critical: 0
      }
    };

    // Check each service
    for (const [serviceName, serviceConfig] of this.dependencies) {
      console.log(`\n📋 Checking service: ${serviceName}`);
      
      const serviceResult = await this.checkServiceDependencies(serviceName);
      results.services[serviceName] = serviceResult;
      results.summary.total++;
      
      if (serviceResult.overall === 'healthy') {
        results.summary.healthy++;
      } else {
        results.summary.unhealthy++;
        if (serviceResult.critical) {
          results.summary.critical++;
          results.overall = 'critical';
        } else if (results.overall === 'healthy') {
          results.overall = 'degraded';
        }
      }
    }

    // Check networks
    results.networks = await this.checkNetworks();
    
    // Check volumes
    results.volumes = await this.checkVolumes();

    // Generate report
    await this.generateDependencyReport(results);

    return results;
  }

  // Check service dependencies
  async checkServiceDependencies(serviceName) {
    const serviceConfig = this.dependencies.get(serviceName);
    if (!serviceConfig) {
      return { overall: 'unknown', error: 'Service not found' };
    }

    const result = {
      overall: 'healthy',
      container: {},
      dependencies: {},
      ports: {},
      network: {},
      volumes: {},
      environment: {},
      critical: false
    };

    try {
      // Check container status
      result.container = await this.checkContainerStatus(serviceName);
      
      // Check dependencies
      for (const dep of serviceConfig.dependencies) {
        result.dependencies[dep.name] = await this.checkDependency(dep);
      }
      
      // Check ports
      for (const port of serviceConfig.ports) {
        result.ports[port] = await this.checkPort(port);
      }
      
      // Check network requirements
      for (const network of serviceConfig.networkRequirements) {
        result.network[network] = await this.checkNetwork(network);
      }
      
      // Check volume requirements
      for (const volume of serviceConfig.volumeRequirements) {
        result.volumes[volume] = await this.checkVolume(volume);
      }
      
      // Check environment requirements
      for (const env of serviceConfig.environmentRequirements) {
        result.environment[env] = await this.checkEnvironmentVariable(serviceName, env);
      }
      
      // Determine overall health
      result.overall = this.determineServiceHealth(result);
      
    } catch (error) {
      result.overall = 'error';
      result.error = error.message;
    }

    return result;
  }

  // Check container status
  async checkContainerStatus(containerName) {
    try {
      const statusResult = await this.executeCommand(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`);
      const healthResult = await this.executeCommand(`docker inspect ${containerName} --format "{{.State.Health.Status}}"`)
        .catch(() => 'no-health-check');
      
      return {
        status: statusResult.trim() || 'not-running',
        health: healthResult.trim() || 'unknown',
        isRunning: statusResult.includes('Up'),
        isHealthy: healthResult.includes('healthy') || healthResult.includes('no-health-check')
      };
    } catch (error) {
      return {
        status: 'error',
        health: 'unknown',
        isRunning: false,
        isHealthy: false,
        error: error.message
      };
    }
  }

  // Check individual dependency
  async checkDependency(dependency) {
    const result = {
      name: dependency.name,
      type: dependency.type,
      status: 'unknown',
      responseTime: 0,
      error: null
    };

    try {
      const startTime = Date.now();
      
      if (dependency.type === 'database') {
        result.status = await this.checkDatabaseConnection(dependency);
      } else if (dependency.type === 'cache') {
        result.status = await this.checkCacheConnection(dependency);
      } else if (dependency.type === 'service') {
        result.status = await this.checkServiceConnection(dependency);
      }
      
      result.responseTime = Date.now() - startTime;
      
    } catch (error) {
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  // Check database connection
  async checkDatabaseConnection(dependency) {
    try {
      if (dependency.connection.includes('postgresql')) {
        return await this.checkPostgresConnection(dependency);
      } else if (dependency.connection.includes('clickhouse')) {
        return await this.checkClickHouseConnection(dependency);
      }
      return 'unknown';
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  // Check PostgreSQL connection
  async checkPostgresConnection(dependency) {
    try {
      const containerName = dependency.name;
      const result = await this.executeCommand(`docker exec ${containerName} pg_isready -U postgres`);
      
      if (result.includes('accepting connections')) {
        // Test actual query
        const queryResult = await this.executeCommand(
          `docker exec ${containerName} psql -U postgres -c "SELECT 1;"`
        );
        return queryResult.includes('1 row') ? 'healthy' : 'degraded';
      }
      
      return 'unhealthy';
    } catch (error) {
      throw new Error(`PostgreSQL check failed: ${error.message}`);
    }
  }

  // Check ClickHouse connection
  async checkClickHouseConnection(dependency) {
    try {
      const containerName = dependency.name;
      const result = await this.executeCommand(`docker exec ${containerName} wget -q --spider http://localhost:8123/ping`);
      
      if (result === '') {
        // Test actual query
        const queryResult = await this.executeCommand(
          `docker exec ${containerName} clickhouse-client --query "SELECT 1"`
        );
        return queryResult.includes('1') ? 'healthy' : 'degraded';
      }
      
      return 'unhealthy';
    } catch (error) {
      throw new Error(`ClickHouse check failed: ${error.message}`);
    }
  }

  // Check cache connection
  async checkCacheConnection(dependency) {
    try {
      const containerName = dependency.name;
      const result = await this.executeCommand(`docker exec ${containerName} redis-cli ping`);
      
      return result.trim() === 'PONG' ? 'healthy' : 'unhealthy';
    } catch (error) {
      throw new Error(`Cache connection failed: ${error.message}`);
    }
  }

  // Check service connection
  async checkServiceConnection(dependency) {
    try {
      const url = dependency.connection;
      const response = await fetch(url, {
        timeout: dependency.timeout || 10000
      });
      
      return response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      throw new Error(`Service connection failed: ${error.message}`);
    }
  }

  // Check port availability
  async checkPort(port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ available: false, status: 'timeout' });
      }, this.config.connectionTimeout);
      
      socket.connect(port, 'localhost', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ available: true, status: 'open' });
      });
      
      socket.on('error', () => {
        clearTimeout(timeout);
        resolve({ available: false, status: 'closed' });
      });
    });
  }

  // Check network
  async checkNetwork(networkName) {
    try {
      const result = await this.executeCommand(`docker network ls --filter "name=${networkName}" --format "{{.Name}}"`);
      const exists = result.includes(networkName);
      
      if (exists) {
        // Check network connectivity
        const inspect = await this.executeCommand(`docker network inspect ${networkName}`);
        const networkInfo = JSON.parse(inspect);
        
        return {
          exists: true,
          driver: networkInfo[0]?.Driver || 'unknown',
          containers: Object.keys(networkInfo[0]?.Containers || {}).length,
          status: 'healthy'
        };
      } else {
        return { exists: false, status: 'missing' };
      }
    } catch (error) {
      return { exists: false, status: 'error', error: error.message };
    }
  }

  // Check volume
  async checkVolume(volumeName) {
    try {
      const result = await this.executeCommand(`docker volume ls --filter "name=${volumeName}" --format "{{.Name}}"`);
      const exists = result.includes(volumeName);
      
      if (exists) {
        // Check volume size and mountpoint
        const inspect = await this.executeCommand(`docker volume inspect ${volumeName}`);
        const volumeInfo = JSON.parse(inspect);
        
        return {
          exists: true,
          mountpoint: volumeInfo[0]?.Mountpoint || 'unknown',
          driver: volumeInfo[0]?.Driver || 'unknown',
          status: 'healthy'
        };
      } else {
        return { exists: false, status: 'missing' };
      }
    } catch (error) {
      return { exists: false, status: 'error', error: error.message };
    }
  }

  // Check environment variable
  async checkEnvironmentVariable(containerName, envVar) {
    try {
      const result = await this.executeCommand(`docker exec ${containerName} env | grep ${envVar}`);
      return {
        exists: result.includes(envVar),
        value: result.includes(envVar) ? 'set' : 'unset',
        status: result.includes(envVar) ? 'healthy' : 'missing'
      };
    } catch (error) {
      return { exists: false, status: 'error', error: error.message };
    }
  }

  // Check networks
  async checkNetworks() {
    const networks = {};
    const requiredNetworks = ['swarm-network', 'swarm-langfuse-v3-working'];
    
    for (const network of requiredNetworks) {
      networks[network] = await this.checkNetwork(network);
    }
    
    return networks;
  }

  // Check volumes
  async checkVolumes() {
    const volumes = {};
    const requiredVolumes = ['postgres_data', 'redis_data', 'clickhouse_data'];
    
    for (const volume of requiredVolumes) {
      volumes[volume] = await this.checkVolume(volume);
    }
    
    return volumes;
  }

  // Determine service health
  determineServiceHealth(result) {
    // Critical failures
    if (!result.container.isRunning) {
      return 'critical';
    }
    
    // Check required dependencies
    for (const [depName, depResult] of Object.entries(result.dependencies)) {
      if (depResult.status === 'unhealthy' || depResult.status === 'error') {
        return 'critical';
      }
    }
    
    // Check ports
    for (const [port, portResult] of Object.entries(result.ports)) {
      if (!portResult.available) {
        return 'degraded';
      }
    }
    
    // Check networks
    for (const [networkName, networkResult] of Object.entries(result.network)) {
      if (!networkResult.exists) {
        return 'degraded';
      }
    }
    
    // Check volumes
    for (const [volumeName, volumeResult] of Object.entries(result.volumes)) {
      if (!volumeResult.exists) {
        return 'degraded';
      }
    }
    
    return 'healthy';
  }

  // Generate dependency report
  async generateDependencyReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      overall: results.overall,
      summary: results.summary,
      services: results.services,
      networks: results.networks,
      volumes: results.volumes,
      recommendations: this.generateRecommendations(results)
    };

    // Save to file
    const filename = `dependency-report-${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    
    // Generate human-readable report
    const readableReport = this.generateReadableReport(report);
    await fs.writeFile(filename.replace('.json', '.txt'), readableReport);
    
    console.log(`\n📊 Dependency report generated: ${filename}`);
  }

  // Generate recommendations
  generateRecommendations(results) {
    const recommendations = [];
    
    // Check for critical issues
    if (results.overall === 'critical') {
      recommendations.push({
        priority: 'high',
        category: 'critical',
        message: 'Critical services are failing. Immediate attention required.',
        actions: ['Check container logs', 'Verify dependencies', 'Restart services']
      });
    }
    
    // Check for unhealthy services
    for (const [serviceName, serviceResult] of Object.entries(results.services)) {
      if (serviceResult.overall === 'critical') {
        recommendations.push({
          priority: 'high',
          category: 'service',
          service: serviceName,
          message: `Service ${serviceName} is in critical state`,
          actions: ['Check container status', 'Verify dependencies', 'Review logs']
        });
      }
    }
    
    return recommendations;
  }

  // Generate readable report
  generateReadableReport(report) {
    let output = `
SERVICE DEPENDENCY REPORT
Generated: ${report.timestamp}
Overall Status: ${report.overall.toUpperCase()}

SUMMARY
=======
Total Services: ${report.summary.total}
Healthy: ${report.summary.healthy}
Unhealthy: ${report.summary.unhealthy}
Critical: ${report.summary.critical}

SERVICES
========
`;

    for (const [serviceName, serviceResult] of Object.entries(report.services)) {
      output += `\n${serviceName}: ${serviceResult.overall.toUpperCase()}\n`;
      output += `  Container: ${serviceResult.container.isRunning ? 'Running' : 'Stopped'}\n`;
      output += `  Health: ${serviceResult.container.isHealthy ? 'Healthy' : 'Unhealthy'}\n`;
      
      if (Object.keys(serviceResult.dependencies).length > 0) {
        output += `  Dependencies:\n`;
        for (const [depName, depResult] of Object.entries(serviceResult.dependencies)) {
          output += `    ${depName}: ${depResult.status} (${depResult.responseTime}ms)\n`;
        }
      }
    }

    if (report.recommendations.length > 0) {
      output += `\nRECOMMENDATIONS\n===============\n`;
      for (const rec of report.recommendations) {
        output += `${rec.priority.toUpperCase()}: ${rec.message}\n`;
        output += `Actions: ${rec.actions.join(', ')}\n\n`;
      }
    }

    return output;
  }

  // Execute command utility
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }
}

// CLI interface
if (require.main === module) {
  const checker = new ServiceDependencyChecker();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'check') {
    checker.checkAllDependencies()
      .then(results => {
        console.log('\n✅ Dependency check completed');
        console.log(`Overall status: ${results.overall}`);
        console.log(`Services: ${results.summary.healthy}/${results.summary.total} healthy`);
        
        if (results.overall !== 'healthy') {
          process.exit(1);
        }
      })
      .catch(error => {
        console.error('❌ Dependency check failed:', error);
        process.exit(1);
      });
  } else if (command === 'service' && args[1]) {
    const serviceName = args[1];
    checker.checkServiceDependencies(serviceName)
      .then(result => {
        console.log(`\n✅ Service ${serviceName} check completed`);
        console.log(`Status: ${result.overall}`);
        console.log(JSON.stringify(result, null, 2));
        
        if (result.overall !== 'healthy') {
          process.exit(1);
        }
      })
      .catch(error => {
        console.error(`❌ Service ${serviceName} check failed:`, error);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  node service-dependency-checker.js check');
    console.log('  node service-dependency-checker.js service <service-name>');
    process.exit(1);
  }
}

module.exports = ServiceDependencyChecker;