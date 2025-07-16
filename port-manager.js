#!/usr/bin/env node

/**
 * Intelligent Port Manager for Docker Testing
 * Automatically detects available ports and resolves conflicts
 */

const net = require('net');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class PortManager {
  constructor() {
    this.defaultPorts = {
      postgres: 5432,
      redis: 6379,
      clickhouse: 8123,
      clickhouse_native: 9000,
      langfuse: 3000,
      dashboard: 3001,
      websocket: 3002,
      observer: 8080,
      prometheus: 9090,
      grafana: 3003
    };
    
    this.portRanges = {
      postgres: [5432, 5440],
      redis: [6379, 6390],
      clickhouse: [8123, 8130],
      clickhouse_native: [9000, 9010],
      langfuse: [3000, 3010],
      dashboard: [3001, 3020],
      websocket: [3002, 3030],
      observer: [8080, 8090],
      prometheus: [9090, 9100],
      grafana: [3003, 3040]
    };
    
    this.availablePorts = {};
    this.dockerProcesses = new Map();
  }

  /**
   * Check if a port is available
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Find available port in range
   */
  async findAvailablePort(service) {
    const [start, end] = this.portRanges[service];
    
    for (let port = start; port <= end; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    
    // If no port in range is available, find any available port
    return this.findAnyAvailablePort(start + 100);
  }

  /**
   * Find any available port starting from a base
   */
  async findAnyAvailablePort(startPort = 10000) {
    let port = startPort;
    while (port < 65535) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
      port++;
    }
    throw new Error('No available ports found');
  }

  /**
   * Detect what's using a port
   */
  getPortProcess(port) {
    try {
      if (process.platform === 'darwin') {
        // macOS
        const result = execSync(`lsof -i :${port} -P -n | grep LISTEN | awk '{print $2}'`, { encoding: 'utf8' });
        return result.trim().split('\n').filter(pid => pid);
      } else {
        // Linux
        const result = execSync(`ss -tlnp | grep :${port} | awk '{print $6}' | grep -oP 'pid=\\K[0-9]+'`, { encoding: 'utf8' });
        return result.trim().split('\n').filter(pid => pid);
      }
    } catch (error) {
      return [];
    }
  }

  /**
   * Get process info
   */
  getProcessInfo(pid) {
    try {
      const cmd = process.platform === 'darwin' 
        ? `ps -p ${pid} -o comm=`
        : `ps -p ${pid} -o comm --no-headers`;
      const result = execSync(cmd, { encoding: 'utf8' });
      return result.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Kill process using port (with user confirmation)
   */
  async killPortProcess(port, force = false) {
    const pids = this.getPortProcess(port);
    
    if (pids.length === 0) {
      console.log(`✅ Port ${port} is already free`);
      return true;
    }
    
    for (const pid of pids) {
      const processName = this.getProcessInfo(pid);
      console.log(`⚠️  Port ${port} is used by process ${pid} (${processName})`);
      
      if (!force) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question(`Kill this process? (y/N): `, resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
          return false;
        }
      }
      
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`✅ Killed process ${pid}`);
        
        // Wait a bit for port to be released
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to kill process ${pid}:`, error.message);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Scan all required ports
   */
  async scanPorts() {
    console.log('🔍 Scanning for available ports...\n');
    
    for (const [service, defaultPort] of Object.entries(this.defaultPorts)) {
      const isAvailable = await this.isPortAvailable(defaultPort);
      
      if (isAvailable) {
        this.availablePorts[service] = defaultPort;
        console.log(`✅ ${service.padEnd(20)} : ${defaultPort} (available)`);
      } else {
        const pids = this.getPortProcess(defaultPort);
        const processInfo = pids.length > 0 ? this.getProcessInfo(pids[0]) : 'unknown';
        console.log(`❌ ${service.padEnd(20)} : ${defaultPort} (in use by ${processInfo})`);
        
        // Find alternative port
        const altPort = await this.findAvailablePort(service);
        this.availablePorts[service] = altPort;
        console.log(`   ↳ Using alternative : ${altPort}`);
      }
    }
    
    console.log('\n');
    return this.availablePorts;
  }

  /**
   * Generate dynamic docker-compose.yml
   */
  generateDockerCompose(ports) {
    const compose = {
      services: {
        postgres: {
          image: 'postgres:15-alpine',
          restart: 'unless-stopped',
          environment: {
            POSTGRES_USER: 'postgres',
            POSTGRES_PASSWORD: 'postgres_password',
            POSTGRES_DB: 'postgres'
          },
          ports: [`${ports.postgres}:5432`],
          volumes: [
            'postgres_data:/var/lib/postgresql/data',
            './init-postgres.sql:/docker-entrypoint-initdb.d/01-init.sql:ro'
          ],
          healthcheck: {
            test: ['CMD-SHELL', 'pg_isready -U postgres'],
            interval: '10s',
            timeout: '5s',
            retries: 5
          }
        },
        
        redis: {
          image: 'redis:7-alpine',
          restart: 'unless-stopped',
          command: 'redis-server --requirepass redis_password',
          ports: [`${ports.redis}:6379`],
          volumes: ['redis_data:/data'],
          healthcheck: {
            test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping'],
            interval: '10s',
            timeout: '5s',
            retries: 5
          }
        },
        
        langfuse: {
          image: 'langfuse/langfuse:2',
          restart: 'unless-stopped',
          depends_on: {
            postgres: { condition: 'service_healthy' }
          },
          ports: [`${ports.langfuse}:3000`],
          environment: {
            DATABASE_URL: 'postgresql://langfuse:langfuse_password@postgres:5432/langfuse',
            NEXTAUTH_SECRET: 'your-secret-key-here-minimum-32-chars-long',
            SALT: 'your-salt-here-minimum-32-chars-long',
            NEXTAUTH_URL: `http://localhost:${ports.langfuse}`,
            TELEMETRY_ENABLED: 'false',
            LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES: 'false'
          },
          healthcheck: {
            test: ['CMD', 'wget', '--spider', 'http://localhost:3000/api/public/health'],
            interval: '30s',
            timeout: '10s',
            retries: 5,
            start_period: '60s'
          }
        },
        
        dashboard: {
          build: {
            context: '.',
            dockerfile: 'Dockerfile.dashboard'
          },
          restart: 'unless-stopped',
          depends_on: {
            langfuse: { condition: 'service_healthy' }
          },
          ports: [
            `${ports.dashboard}:3001`,
            `${ports.websocket}:3002`,
            `${ports.observer}:8080`
          ],
          environment: {
            NODE_ENV: 'production',
            LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
            LANGFUSE_SECRET_KEY: 'sk-lf-test',
            LANGFUSE_HOST: `http://langfuse:3000`,
            DASHBOARD_PORT: 3001,
            WEBSOCKET_PORT: 3002,
            OBSERVER_PORT: 8080
          },
          volumes: [
            './shared/langfuse-wrapper:/app',
            'dashboard_data:/data'
          ],
          healthcheck: {
            test: ['CMD', 'wget', '--spider', 'http://localhost:3001/api/health'],
            interval: '30s',
            timeout: '10s',
            retries: 3
          }
        }
      },
      
      volumes: {
        postgres_data: {},
        redis_data: {},
        dashboard_data: {}
      },
      
      networks: {
        default: {
          name: 'langfuse-testing-network'
        }
      }
    };
    
    return compose;
  }

  /**
   * Save docker-compose configuration
   */
  saveDockerCompose(compose, filename = 'docker-compose.dynamic.yml') {
    const yaml = require('./testing-utils/node_modules/js-yaml');
    const content = yaml.dump(compose, { indent: 2 });
    fs.writeFileSync(filename, content);
    console.log(`📝 Generated ${filename} with dynamic ports`);
    return filename;
  }

  /**
   * Clean up orphaned containers
   */
  async cleanupContainers() {
    console.log('🧹 Cleaning up orphaned containers...\n');
    
    try {
      // Stop all containers with our project name
      execSync('docker compose -p langfuse-test down -v 2>/dev/null || true', { stdio: 'inherit' });
      
      // Remove any dangling containers
      const containers = execSync('docker ps -a -q --filter "label=com.docker.compose.project=langfuse-test"', { encoding: 'utf8' });
      if (containers.trim()) {
        execSync(`docker rm -f ${containers.trim().split('\n').join(' ')}`, { stdio: 'inherit' });
      }
      
      console.log('✅ Cleanup complete\n');
    } catch (error) {
      console.error('⚠️  Cleanup warning:', error.message);
    }
  }

  /**
   * Start Docker Compose with monitoring
   */
  async startDockerCompose(composeFile) {
    console.log('🚀 Starting Docker Compose...\n');
    
    const proc = exec(`docker compose -f ${composeFile} -p langfuse-test up -d`, { encoding: 'utf8' });
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data;
        process.stdout.write(data);
      });
      
      proc.stderr.on('data', (data) => {
        output += data;
        process.stdout.write(data);
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Docker Compose failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Monitor container health
   */
  async monitorHealth(timeout = 120000) {
    console.log('\n🏥 Monitoring container health...\n');
    
    const startTime = Date.now();
    const services = ['postgres', 'redis', 'langfuse', 'dashboard'];
    const healthy = new Set();
    
    while (Date.now() - startTime < timeout) {
      for (const service of services) {
        if (healthy.has(service)) continue;
        
        try {
          const status = execSync(
            `docker compose -p langfuse-test ps --format json ${service} 2>/dev/null | jq -r '.[0].Health'`,
            { encoding: 'utf8' }
          ).trim();
          
          if (status === 'healthy') {
            healthy.add(service);
            console.log(`✅ ${service} is healthy`);
          }
        } catch (error) {
          // Service not ready yet
        }
      }
      
      if (healthy.size === services.length) {
        console.log('\n🎉 All services are healthy!\n');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n⚠️  Some services failed to become healthy\n');
    return false;
  }

  /**
   * Generate .env file
   */
  generateEnvFile(ports) {
    const env = `# Auto-generated environment file for Langfuse testing
# Generated at: ${new Date().toISOString()}

# Service URLs
POSTGRES_URL=postgresql://langfuse:langfuse_password@localhost:${ports.postgres}/langfuse
REDIS_URL=redis://:redis_password@localhost:${ports.redis}
LANGFUSE_URL=http://localhost:${ports.langfuse}
DASHBOARD_URL=http://localhost:${ports.dashboard}

# Service Ports
POSTGRES_PORT=${ports.postgres}
REDIS_PORT=${ports.redis}
CLICKHOUSE_PORT=${ports.clickhouse}
LANGFUSE_PORT=${ports.langfuse}
DASHBOARD_PORT=${ports.dashboard}
WEBSOCKET_PORT=${ports.websocket}
OBSERVER_PORT=${ports.observer}

# Credentials
POSTGRES_USER=langfuse
POSTGRES_PASSWORD=langfuse_password
REDIS_PASSWORD=redis_password
LANGFUSE_PUBLIC_KEY=pk-lf-test
LANGFUSE_SECRET_KEY=sk-lf-test
`;
    
    fs.writeFileSync('.env.test', env);
    console.log('📝 Generated .env.test file');
  }

  /**
   * Main orchestration function
   */
  async orchestrate(options = {}) {
    console.log('🎯 Langfuse Testing Orchestrator\n');
    console.log('================================\n');
    
    try {
      // Step 1: Cleanup
      if (options.cleanup !== false) {
        await this.cleanupContainers();
      }
      
      // Step 2: Scan ports
      const ports = await this.scanPorts();
      
      // Step 3: Generate configurations
      const compose = this.generateDockerCompose(ports);
      const composeFile = this.saveDockerCompose(compose);
      this.generateEnvFile(ports);
      
      // Step 4: Start services
      if (options.start !== false) {
        await this.startDockerCompose(composeFile);
        
        // Step 5: Monitor health
        const healthy = await this.monitorHealth();
        
        if (healthy) {
          console.log('📊 Service URLs:');
          console.log(`   Langfuse API : http://localhost:${ports.langfuse}`);
          console.log(`   Dashboard UI : http://localhost:${ports.dashboard}`);
          console.log(`   WebSocket    : ws://localhost:${ports.websocket}`);
          console.log(`   Health Check : http://localhost:${ports.dashboard}/api/health`);
          console.log('\n✅ Langfuse testing environment is ready!');
          
          return { success: true, ports, composeFile };
        }
      }
      
      return { success: true, ports, composeFile };
      
    } catch (error) {
      console.error('\n❌ Orchestration failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// CLI interface
if (require.main === module) {
  const portManager = new PortManager();
  
  const args = process.argv.slice(2);
  const options = {
    cleanup: !args.includes('--no-cleanup'),
    start: !args.includes('--no-start'),
    force: args.includes('--force')
  };
  
  portManager.orchestrate(options).then(result => {
    if (!result.success) {
      process.exit(1);
    }
  });
}

module.exports = PortManager;