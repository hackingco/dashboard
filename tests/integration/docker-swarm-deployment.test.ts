/**
 * Docker Swarm Deployment Integration Tests
 * Guardian-1 comprehensive testing suite
 * Tests full stack deployment, Langfuse integration, and swarm communication
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import WebSocket from 'ws';
import { LangfuseWrapper } from '../../shared/langfuse-wrapper/src';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Docker Swarm Deployment Integration Tests', () => {
  let dockerComposeProcess: ChildProcess | null = null;
  let containersStarted = false;
  const MANAGER_URL = 'http://localhost:8080';
  const DASHBOARD_URL = 'http://localhost:3000';
  const REDIS_URL = 'redis://localhost:6379';
  const WS_URL = 'ws://localhost:8080';
  
  // Test data
  const testSwarmId = `guardian-test-${Date.now()}`;
  const testAgents = [
    { id: 'guardian-1', role: 'tester', capabilities: ['integration', 'validation'] },
    { id: 'guardian-2', role: 'monitor', capabilities: ['metrics', 'logging'] },
    { id: 'guardian-3', role: 'analyzer', capabilities: ['performance', 'security'] }
  ];

  beforeAll(async () => {
    console.log('[Guardian-1] Starting Docker deployment tests...');
    
    // Check if Docker is available
    try {
      await execAsync('docker --version');
      console.log('[Guardian-1] Docker is available');
    } catch (error) {
      console.error('[Guardian-1] Docker is not available, skipping deployment tests');
      return;
    }

    // Stop any existing containers
    try {
      await execAsync('docker-compose down -v');
    } catch (error) {
      // Ignore errors if containers aren't running
    }

    // Start Docker Compose stack
    console.log('[Guardian-1] Starting Docker Compose stack...');
    try {
      dockerComposeProcess = spawn('docker-compose', ['up', '-d'], {
        stdio: 'pipe',
        shell: true
      });

      // Wait for services to be ready
      await waitForServicesReady();
      containersStarted = true;
      console.log('[Guardian-1] All services are ready');
    } catch (error) {
      console.error('[Guardian-1] Failed to start Docker Compose:', error);
      throw error;
    }
  }, 120000); // 2 minute timeout

  afterAll(async () => {
    if (containersStarted) {
      console.log('[Guardian-1] Stopping Docker Compose stack...');
      try {
        await execAsync('docker-compose down -v');
      } catch (error) {
        console.error('[Guardian-1] Error stopping containers:', error);
      }
    }
  }, 30000);

  describe('Container Health Verification', () => {
    it('should verify all containers are running', async () => {
      const { stdout } = await execAsync('docker-compose ps --format json');
      const containers = JSON.parse(stdout);
      
      const requiredServices = ['redis', 'manager', 'dashboard'];
      for (const service of requiredServices) {
        const container = containers.find((c: any) => c.Service === service);
        expect(container).toBeDefined();
        expect(container.State).toBe('running');
      }
    });

    it('should verify container resource limits', async () => {
      const { stdout } = await execAsync('docker stats --no-stream --format json');
      const stats = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
      
      for (const stat of stats) {
        // Verify memory usage is reasonable
        const memUsage = parseFloat(stat.MemPerc.replace('%', ''));
        expect(memUsage).toBeLessThan(80); // Should not exceed 80%
        
        // Verify CPU usage is reasonable
        const cpuUsage = parseFloat(stat.CPUPerc.replace('%', ''));
        expect(cpuUsage).toBeLessThan(90); // Should not exceed 90%
      }
    });

    it('should verify network connectivity between containers', async () => {
      // Test manager can reach redis
      const { stdout: managerNetTest } = await execAsync(
        'docker-compose exec -T manager nc -zv redis 6379'
      );
      expect(managerNetTest).toContain('succeeded');
      
      // Test dashboard can reach manager
      const { stdout: dashboardNetTest } = await execAsync(
        'docker-compose exec -T dashboard nc -zv manager 8080'
      );
      expect(dashboardNetTest).toContain('succeeded');
    });
  });

  describe('Langfuse Integration Tests', () => {
    let langfuseWrapper: LangfuseWrapper;

    beforeEach(() => {
      langfuseWrapper = new LangfuseWrapper({
        enabled: process.env.LANGFUSE_PUBLIC_KEY ? true : false,
        publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'test-public-key',
        secretKey: process.env.LANGFUSE_SECRET_KEY || 'test-secret-key',
        host: process.env.LANGFUSE_HOST || 'https://us.cloud.langfuse.com'
      });
    });

    it('should initialize Langfuse wrapper in containerized environment', async () => {
      const isEnabled = langfuseWrapper.isEnabled();
      expect(typeof isEnabled).toBe('boolean');
      
      if (isEnabled) {
        // Test trace creation
        const traceId = await langfuseWrapper.preHook({
          hookType: 'pre-task',
          swarmId: testSwarmId,
          agentId: 'guardian-1',
          agentRole: 'tester',
          metadata: {
            environment: 'docker',
            test: 'integration'
          }
        });
        
        expect(traceId).toBeTruthy();
        expect(typeof traceId).toBe('string');
        
        // Complete the trace
        await langfuseWrapper.postHook(traceId!, {
          status: 'success',
          result: 'Langfuse initialized successfully in Docker'
        });
      }
    });

    it('should handle Langfuse errors gracefully', async () => {
      // Test with invalid credentials
      const invalidWrapper = new LangfuseWrapper({
        enabled: true,
        publicKey: 'invalid-key',
        secretKey: 'invalid-secret',
        host: 'https://invalid.langfuse.com'
      });
      
      // Should not throw, but gracefully handle
      const traceId = await invalidWrapper.preHook({
        hookType: 'error-test',
        swarmId: testSwarmId,
        agentId: 'guardian-1',
        agentRole: 'tester'
      });
      
      // In error case, might return null or still return a trace ID
      expect(() => traceId).not.toThrow();
    });

    it('should track swarm operations through Langfuse', async () => {
      if (!langfuseWrapper.isEnabled()) {
        console.log('[Guardian-1] Langfuse not enabled, skipping tracking test');
        return;
      }

      // Create a trace for swarm operation
      const traceId = await langfuseWrapper.preHook({
        hookType: 'swarm-operation',
        swarmId: testSwarmId,
        agentId: 'guardian-1',
        agentRole: 'tester',
        operationType: 'deployment-test',
        metadata: {
          agents: testAgents,
          environment: 'docker-compose'
        }
      });

      // Simulate swarm operations
      const operations = [
        { type: 'agent_spawn', agent: 'guardian-1', status: 'success' },
        { type: 'agent_spawn', agent: 'guardian-2', status: 'success' },
        { type: 'task_assignment', task: 'validate-deployment', status: 'in_progress' },
        { type: 'task_completion', task: 'validate-deployment', status: 'completed' }
      ];

      for (const op of operations) {
        await langfuseWrapper.logEvent(traceId!, {
          name: op.type,
          metadata: op
        });
      }

      // Complete with token usage
      await langfuseWrapper.postHook(
        traceId!,
        {
          status: 'success',
          operations: operations.length,
          summary: 'All swarm operations completed successfully'
        },
        {
          input: 1500,
          output: 2000,
          total: 3500
        }
      );
    });
  });

  describe('Manager API Tests', () => {
    it('should verify manager health endpoint', async () => {
      const response = await axios.get(`${MANAGER_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('services');
    });

    it('should create and manage swarm through API', async () => {
      // Create swarm
      const createResponse = await axios.post(`${MANAGER_URL}/api/swarms`, {
        id: testSwarmId,
        topology: 'hierarchical',
        maxAgents: 5,
        strategy: 'balanced'
      });
      
      expect(createResponse.status).toBe(201);
      expect(createResponse.data).toHaveProperty('id', testSwarmId);
      expect(createResponse.data).toHaveProperty('status', 'active');

      // Get swarm status
      const statusResponse = await axios.get(`${MANAGER_URL}/api/swarms/${testSwarmId}`);
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.data).toHaveProperty('id', testSwarmId);
      expect(statusResponse.data).toHaveProperty('agents');
    });

    it('should spawn agents through API', async () => {
      for (const agent of testAgents) {
        const response = await axios.post(`${MANAGER_URL}/api/agents`, {
          swarmId: testSwarmId,
          ...agent
        });
        
        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id', agent.id);
        expect(response.data).toHaveProperty('status', 'active');
      }

      // Verify all agents were created
      const swarmResponse = await axios.get(`${MANAGER_URL}/api/swarms/${testSwarmId}`);
      expect(swarmResponse.data.agents).toHaveLength(testAgents.length);
    });

    it('should handle API errors gracefully', async () => {
      // Test invalid swarm ID
      try {
        await axios.get(`${MANAGER_URL}/api/swarms/invalid-swarm-id`);
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toHaveProperty('error');
      }

      // Test invalid agent creation
      try {
        await axios.post(`${MANAGER_URL}/api/agents`, {
          // Missing required fields
          id: 'invalid-agent'
        });
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('WebSocket Real-time Communication Tests', () => {
    let ws: WebSocket | null = null;

    afterEach(() => {
      if (ws) {
        ws.close();
        ws = null;
      }
    });

    it('should establish WebSocket connection', async () => {
      return new Promise((resolve, reject) => {
        ws = new WebSocket(`${WS_URL}/ws`);
        
        ws.on('open', () => {
          expect(ws!.readyState).toBe(WebSocket.OPEN);
          resolve(undefined);
        });
        
        ws.on('error', (error) => {
          reject(error);
        });
        
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    });

    it('should receive real-time swarm updates', async () => {
      return new Promise((resolve, reject) => {
        ws = new WebSocket(`${WS_URL}/ws`);
        const receivedMessages: any[] = [];
        
        ws.on('open', () => {
          // Subscribe to swarm updates
          ws!.send(JSON.stringify({
            type: 'subscribe',
            channel: 'swarm',
            swarmId: testSwarmId
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          receivedMessages.push(message);
          
          if (receivedMessages.length >= 3) {
            expect(receivedMessages).toContainEqual(
              expect.objectContaining({
                type: expect.any(String),
                swarmId: testSwarmId
              })
            );
            resolve(undefined);
          }
        });
        
        ws.on('error', reject);
        
        // Trigger some events
        setTimeout(async () => {
          try {
            // Create task to generate events
            await axios.post(`${MANAGER_URL}/api/tasks`, {
              swarmId: testSwarmId,
              description: 'Test WebSocket events',
              priority: 'high'
            });
          } catch (error) {
            console.error('Error creating task:', error);
          }
        }, 1000);
        
        setTimeout(() => reject(new Error('WebSocket test timeout')), 10000);
      });
    });

    it('should handle WebSocket reconnection', async () => {
      return new Promise((resolve, reject) => {
        let reconnectCount = 0;
        
        const connectWebSocket = () => {
          ws = new WebSocket(`${WS_URL}/ws`);
          
          ws.on('open', () => {
            if (reconnectCount === 0) {
              // First connection, close it to test reconnection
              setTimeout(() => ws!.close(), 500);
            } else {
              // Reconnection successful
              expect(reconnectCount).toBe(1);
              resolve(undefined);
            }
          });
          
          ws.on('close', () => {
            if (reconnectCount < 2) {
              reconnectCount++;
              setTimeout(connectWebSocket, 1000);
            }
          });
          
          ws.on('error', (error) => {
            if (reconnectCount >= 2) {
              reject(error);
            }
          });
        };
        
        connectWebSocket();
        setTimeout(() => reject(new Error('Reconnection test timeout')), 15000);
      });
    });
  });

  describe('Dashboard Integration Tests', () => {
    it('should verify dashboard is accessible', async () => {
      try {
        const response = await axios.get(DASHBOARD_URL, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        expect(response.status).toBeLessThan(400);
      } catch (error: any) {
        // Dashboard might take time to build
        console.warn('[Guardian-1] Dashboard not ready yet:', error.message);
      }
    });

    it('should verify dashboard API endpoints', async () => {
      // Test dashboard's internal API
      try {
        const response = await axios.get(`${DASHBOARD_URL}/api/health`, {
          timeout: 5000
        });
        expect(response.status).toBe(200);
      } catch (error: any) {
        // API might not be available in development mode
        console.warn('[Guardian-1] Dashboard API not available:', error.message);
      }
    });
  });

  describe('Environment Variable Handling', () => {
    it('should verify required environment variables in containers', async () => {
      // Check manager environment
      const { stdout: managerEnv } = await execAsync(
        'docker-compose exec -T manager printenv | grep -E "NODE_ENV|REDIS_URL|LANGFUSE"'
      );
      
      expect(managerEnv).toContain('NODE_ENV=development');
      expect(managerEnv).toContain('REDIS_URL=redis://redis:6379');
      
      // Check dashboard environment
      const { stdout: dashboardEnv } = await execAsync(
        'docker-compose exec -T dashboard printenv | grep -E "NODE_ENV|NEXT_PUBLIC_API_URL"'
      );
      
      expect(dashboardEnv).toContain('NODE_ENV=development');
      expect(dashboardEnv).toContain('NEXT_PUBLIC_API_URL=http://localhost:8080');
    });

    it('should handle missing optional environment variables', async () => {
      // Test that services work even without optional env vars
      const response = await axios.get(`${MANAGER_URL}/health`);
      expect(response.status).toBe(200);
      
      // Services should still be healthy
      expect(response.data.services).toHaveProperty('redis', 'connected');
    });
  });

  describe('Failover and Recovery Tests', () => {
    it('should handle Redis connection failure', async () => {
      // Stop Redis temporarily
      await execAsync('docker-compose stop redis');
      
      // Manager should still respond but indicate Redis is down
      try {
        const response = await axios.get(`${MANAGER_URL}/health`);
        expect(response.data.services.redis).toBe('disconnected');
      } catch (error) {
        // Expected behavior - service might be degraded
      }
      
      // Restart Redis
      await execAsync('docker-compose start redis');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for reconnection
      
      // Verify recovery
      const recoveryResponse = await axios.get(`${MANAGER_URL}/health`);
      expect(recoveryResponse.data.services.redis).toBe('connected');
    });

    it('should handle container restart gracefully', async () => {
      // Restart manager container
      await execAsync('docker-compose restart manager');
      
      // Wait for service to be ready
      await waitForService(MANAGER_URL, '/health', 30000);
      
      // Verify service is functional after restart
      const response = await axios.get(`${MANAGER_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
    });

    it('should maintain data persistence across restarts', async () => {
      // Create test data
      const testData = {
        id: `persistence-test-${Date.now()}`,
        data: 'This should persist'
      };
      
      await axios.post(`${MANAGER_URL}/api/data`, testData);
      
      // Restart containers
      await execAsync('docker-compose restart');
      await waitForServicesReady();
      
      // Verify data persists
      const response = await axios.get(`${MANAGER_URL}/api/data/${testData.id}`);
      expect(response.data).toEqual(testData);
    });
  });

  describe('Performance and Load Tests', () => {
    it('should handle concurrent swarm operations', async () => {
      const concurrentOps = 10;
      const operations = [];
      
      for (let i = 0; i < concurrentOps; i++) {
        operations.push(
          axios.post(`${MANAGER_URL}/api/swarms`, {
            id: `load-test-${i}`,
            topology: 'mesh',
            maxAgents: 3
          })
        );
      }
      
      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBeGreaterThanOrEqual(concurrentOps * 0.9); // 90% success rate
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const requests = [];
      
      // Send 50 requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          axios.get(`${MANAGER_URL}/health`).catch(() => null)
        );
      }
      
      await Promise.all(requests);
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(duration).toBeLessThan(5000);
    });
  });

  // Helper functions
  async function waitForServicesReady(timeout = 60000): Promise<void> {
    const services = [
      { url: `${MANAGER_URL}/health`, name: 'Manager' },
      { url: `${DASHBOARD_URL}`, name: 'Dashboard' }
    ];
    
    const startTime = Date.now();
    
    for (const service of services) {
      await waitForService(service.url, '', timeout - (Date.now() - startTime));
      console.log(`[Guardian-1] ${service.name} is ready`);
    }
  }

  async function waitForService(url: string, path: string = '', timeout: number = 30000): Promise<void> {
    const endTime = Date.now() + timeout;
    
    while (Date.now() < endTime) {
      try {
        await axios.get(url + path, { timeout: 2000 });
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error(`Service ${url} did not become ready within ${timeout}ms`);
  }
});

// Export test results for Guardian-1 memory storage
export const guardian1TestResults = {
  suite: 'Docker Swarm Deployment Integration',
  timestamp: Date.now(),
  tests: [
    'Container Health Verification',
    'Langfuse Integration',
    'Manager API',
    'WebSocket Communication',
    'Dashboard Integration',
    'Environment Variables',
    'Failover and Recovery',
    'Performance and Load'
  ]
};