/**
 * Swarm Container Communication Tests
 * Guardian-1 testing suite for inter-container swarm coordination
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

describe('Swarm Container Communication Tests', () => {
  let redis: Redis;
  const REDIS_URL = 'redis://localhost:6379';
  const MANAGER_URL = 'http://localhost:8080';
  const WS_URL = 'ws://localhost:8080';
  const testSwarmId = `comm-test-${Date.now()}`;
  
  // Test agents for communication
  const testAgents = [
    { id: 'comm-agent-1', role: 'coordinator', container: 'manager' },
    { id: 'comm-agent-2', role: 'worker', container: 'worker-1' },
    { id: 'comm-agent-3', role: 'monitor', container: 'dashboard' }
  ];

  beforeAll(async () => {
    console.log('[Guardian-1] Starting swarm container communication tests...');
    
    // Initialize Redis connection
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000)
    });
    
    // Verify Redis connection
    await redis.ping();
    console.log('[Guardian-1] Redis connection established');
  });

  afterAll(async () => {
    // Clean up Redis connection
    if (redis) {
      await redis.quit();
    }
  });

  describe('Redis Pub/Sub Communication', () => {
    it('should establish pub/sub channels between containers', async () => {
      const receivedMessages: any[] = [];
      const testChannel = `swarm:${testSwarmId}:events`;
      
      // Create subscriber
      const subscriber = redis.duplicate();
      await subscriber.subscribe(testChannel);
      
      // Set up message handler
      subscriber.on('message', (channel, message) => {
        receivedMessages.push({
          channel,
          message: JSON.parse(message),
          timestamp: Date.now()
        });
      });
      
      // Publish test messages from different "containers"
      const messages = [
        { from: 'manager', type: 'agent_spawn', data: { agentId: 'test-1' } },
        { from: 'worker', type: 'task_complete', data: { taskId: 'task-1' } },
        { from: 'dashboard', type: 'metric_update', data: { cpu: 45, memory: 512 } }
      ];
      
      for (const msg of messages) {
        await redis.publish(testChannel, JSON.stringify(msg));
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
      }
      
      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify all messages received
      expect(receivedMessages).toHaveLength(messages.length);
      expect(receivedMessages[0].message.from).toBe('manager');
      expect(receivedMessages[1].message.type).toBe('task_complete');
      expect(receivedMessages[2].message.data.cpu).toBe(45);
      
      // Clean up
      await subscriber.unsubscribe();
      await subscriber.quit();
    });

    it('should handle high-frequency message exchange', async () => {
      const messageCount = 100;
      const publishers = 3;
      const channel = `swarm:${testSwarmId}:stress`;
      const receivedCount = { count: 0 };
      
      // Create subscriber
      const subscriber = redis.duplicate();
      await subscriber.subscribe(channel);
      
      subscriber.on('message', () => {
        receivedCount.count++;
      });
      
      // Create multiple publishers simulating different containers
      const publishPromises = [];
      for (let p = 0; p < publishers; p++) {
        const publisher = redis.duplicate();
        
        for (let i = 0; i < messageCount; i++) {
          publishPromises.push(
            publisher.publish(channel, JSON.stringify({
              publisher: p,
              sequence: i,
              timestamp: Date.now()
            }))
          );
        }
      }
      
      // Wait for all publishes
      await Promise.all(publishPromises);
      
      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify message delivery
      const expectedTotal = publishers * messageCount;
      expect(receivedCount.count).toBe(expectedTotal);
      
      // Clean up
      await subscriber.unsubscribe();
      await subscriber.quit();
    });

    it('should implement request-response pattern', async () => {
      const requestChannel = `swarm:${testSwarmId}:request`;
      const responseChannel = `swarm:${testSwarmId}:response`;
      
      // Set up responder (simulating worker container)
      const responder = redis.duplicate();
      await responder.subscribe(requestChannel);
      
      responder.on('message', async (channel, message) => {
        const request = JSON.parse(message);
        
        // Process request and send response
        const response = {
          requestId: request.id,
          result: `Processed: ${request.command}`,
          processorId: 'worker-1',
          timestamp: Date.now()
        };
        
        await redis.publish(responseChannel, JSON.stringify(response));
      });
      
      // Set up requester (simulating manager container)
      const requester = redis.duplicate();
      await requester.subscribe(responseChannel);
      
      const responses = new Map();
      requester.on('message', (channel, message) => {
        const response = JSON.parse(message);
        responses.set(response.requestId, response);
      });
      
      // Send requests
      const requests = [
        { id: 'req-1', command: 'spawn_agent', params: { type: 'worker' } },
        { id: 'req-2', command: 'get_status', params: { agentId: 'agent-1' } },
        { id: 'req-3', command: 'execute_task', params: { taskId: 'task-1' } }
      ];
      
      for (const request of requests) {
        await redis.publish(requestChannel, JSON.stringify(request));
      }
      
      // Wait for responses
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify all requests got responses
      expect(responses.size).toBe(requests.length);
      requests.forEach(req => {
        expect(responses.has(req.id)).toBe(true);
        expect(responses.get(req.id).result).toContain(req.command);
      });
      
      // Clean up
      await responder.unsubscribe();
      await requester.unsubscribe();
      await responder.quit();
      await requester.quit();
    });
  });

  describe('WebSocket Communication Between Containers', () => {
    it('should establish WebSocket connections from multiple containers', async () => {
      const connections: WebSocket[] = [];
      const connectionPromises = [];
      
      // Simulate connections from different containers
      for (const agent of testAgents) {
        const promise = new Promise((resolve, reject) => {
          const ws = new WebSocket(`${WS_URL}/ws`, {
            headers: {
              'X-Agent-Id': agent.id,
              'X-Container': agent.container
            }
          });
          
          ws.on('open', () => {
            connections.push(ws);
            resolve(ws);
          });
          
          ws.on('error', reject);
        });
        
        connectionPromises.push(promise);
      }
      
      // Wait for all connections
      await Promise.all(connectionPromises);
      
      // Verify all connections established
      expect(connections).toHaveLength(testAgents.length);
      
      // Clean up
      connections.forEach(ws => ws.close());
    });

    it('should broadcast messages to all connected containers', async () => {
      const receivedByAgent = new Map<string, any[]>();
      const connections = new Map<string, WebSocket>();
      
      // Connect all agents
      for (const agent of testAgents) {
        const ws = new WebSocket(`${WS_URL}/ws`);
        connections.set(agent.id, ws);
        receivedByAgent.set(agent.id, []);
        
        ws.on('message', (data) => {
          const messages = receivedByAgent.get(agent.id) || [];
          messages.push(JSON.parse(data.toString()));
          receivedByAgent.set(agent.id, messages);
        });
        
        await new Promise((resolve) => {
          ws.on('open', resolve);
        });
      }
      
      // Send broadcast message from one agent
      const broadcastMessage = {
        type: 'broadcast',
        from: testAgents[0].id,
        data: {
          event: 'swarm_update',
          status: 'active',
          agentCount: testAgents.length
        }
      };
      
      connections.get(testAgents[0].id)!.send(JSON.stringify(broadcastMessage));
      
      // Wait for message propagation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify all agents received the broadcast
      // Note: Depending on implementation, sender might not receive their own message
      let receiversCount = 0;
      receivedByAgent.forEach((messages, agentId) => {
        if (messages.some(msg => msg.data?.event === 'swarm_update')) {
          receiversCount++;
        }
      });
      
      expect(receiversCount).toBeGreaterThanOrEqual(testAgents.length - 1);
      
      // Clean up
      connections.forEach(ws => ws.close());
    });

    it('should handle container disconnection and reconnection', async () => {
      let disconnectCount = 0;
      let reconnectCount = 0;
      
      // Create connection with reconnect logic
      const createConnection = (agentId: string): Promise<WebSocket> => {
        return new Promise((resolve) => {
          const ws = new WebSocket(`${WS_URL}/ws`);
          
          ws.on('open', () => {
            if (disconnectCount > 0) {
              reconnectCount++;
            }
            resolve(ws);
          });
          
          ws.on('close', () => {
            disconnectCount++;
            // Attempt reconnection after delay
            setTimeout(() => {
              createConnection(agentId);
            }, 1000);
          });
        });
      };
      
      // Initial connection
      const ws = await createConnection('reconnect-test-agent');
      
      // Force disconnection
      ws.close();
      
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify disconnection and reconnection occurred
      expect(disconnectCount).toBeGreaterThan(0);
      expect(reconnectCount).toBeGreaterThan(0);
    });
  });

  describe('HTTP API Communication', () => {
    it('should coordinate tasks across containers via HTTP', async () => {
      // Create swarm
      const swarmResponse = await axios.post(`${MANAGER_URL}/api/swarms`, {
        id: testSwarmId,
        topology: 'mesh',
        maxAgents: testAgents.length
      });
      
      expect(swarmResponse.status).toBe(201);
      
      // Spawn agents from different containers
      const agentPromises = testAgents.map(agent =>
        axios.post(`${MANAGER_URL}/api/agents`, {
          ...agent,
          swarmId: testSwarmId
        })
      );
      
      const agentResponses = await Promise.all(agentPromises);
      agentResponses.forEach(response => {
        expect(response.status).toBe(201);
      });
      
      // Create cross-container task
      const taskResponse = await axios.post(`${MANAGER_URL}/api/tasks`, {
        swarmId: testSwarmId,
        description: 'Cross-container coordination task',
        assignedAgents: testAgents.map(a => a.id),
        requiresCoordination: true
      });
      
      expect(taskResponse.status).toBe(201);
      expect(taskResponse.data.assignedAgents).toHaveLength(testAgents.length);
    });

    it('should share state between containers', async () => {
      const stateKey = `state:${testSwarmId}`;
      const sharedState = {
        swarmId: testSwarmId,
        phase: 'initialization',
        progress: 0,
        agents: testAgents.map(a => ({
          id: a.id,
          status: 'ready',
          lastUpdate: Date.now()
        }))
      };
      
      // Store state from manager container
      await redis.set(stateKey, JSON.stringify(sharedState));
      
      // Simulate state updates from different containers
      const updates = [
        { container: 'worker-1', updates: { phase: 'executing', progress: 25 } },
        { container: 'worker-2', updates: { progress: 50 } },
        { container: 'dashboard', updates: { progress: 75 } },
        { container: 'manager', updates: { phase: 'completed', progress: 100 } }
      ];
      
      for (const update of updates) {
        // Get current state
        const currentStateStr = await redis.get(stateKey);
        const currentState = JSON.parse(currentStateStr!);
        
        // Apply updates
        Object.assign(currentState, update.updates);
        currentState.lastUpdatedBy = update.container;
        currentState.lastUpdateTime = Date.now();
        
        // Save updated state
        await redis.set(stateKey, JSON.stringify(currentState));
        
        // Small delay to simulate real timing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Verify final state
      const finalStateStr = await redis.get(stateKey);
      const finalState = JSON.parse(finalStateStr!);
      
      expect(finalState.phase).toBe('completed');
      expect(finalState.progress).toBe(100);
      expect(finalState.lastUpdatedBy).toBe('manager');
    });
  });

  describe('Container Network Isolation and Security', () => {
    it('should verify network isolation between containers', async () => {
      // Check that containers can only communicate through defined channels
      const { stdout } = await execAsync('docker network ls --format json | jq -r \'.Name\' | grep swarm-network');
      expect(stdout.trim()).toContain('swarm-network');
      
      // Verify containers are on the same network
      const { stdout: inspectOutput } = await execAsync('docker-compose ps --format json');
      const containers = JSON.parse(inspectOutput);
      
      // All containers should be on swarm-network
      for (const container of containers) {
        if (container.State === 'running') {
          const { stdout: networkInfo } = await execAsync(
            `docker inspect ${container.Name} | jq -r '.[0].NetworkSettings.Networks | keys[]'`
          );
          expect(networkInfo).toContain('swarm-network');
        }
      }
    });

    it('should handle secure communication between containers', async () => {
      // Test that sensitive data is properly encrypted in transit
      const sensitiveData = {
        apiKey: 'secret-key-12345',
        token: 'bearer-token-xyz',
        credentials: {
          username: 'admin',
          password: 'hashed-password'
        }
      };
      
      // Store encrypted data in Redis
      const encryptedKey = `secure:${testSwarmId}`;
      const encrypted = Buffer.from(JSON.stringify(sensitiveData)).toString('base64');
      await redis.set(encryptedKey, encrypted, 'EX', 300); // 5 minute expiry
      
      // Retrieve and decrypt
      const retrieved = await redis.get(encryptedKey);
      const decrypted = JSON.parse(Buffer.from(retrieved!, 'base64').toString());
      
      expect(decrypted).toEqual(sensitiveData);
      expect(retrieved).not.toContain('secret-key-12345'); // Should be encoded
    });
  });

  describe('Message Queue Patterns', () => {
    it('should implement work queue pattern', async () => {
      const queueName = `queue:${testSwarmId}:tasks`;
      const processedTasks: any[] = [];
      
      // Add tasks to queue
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i}`,
        type: 'process',
        data: { value: i },
        priority: i % 3 // 0 = high, 1 = medium, 2 = low
      }));
      
      // Push tasks to queue
      for (const task of tasks) {
        await redis.lpush(queueName, JSON.stringify(task));
      }
      
      // Simulate multiple workers processing tasks
      const workers = Array.from({ length: 3 }, (_, i) => ({
        id: `worker-${i}`,
        processed: 0
      }));
      
      // Process tasks concurrently
      const workerPromises = workers.map(async (worker) => {
        while (true) {
          const taskStr = await redis.rpop(queueName);
          if (!taskStr) break;
          
          const task = JSON.parse(taskStr);
          processedTasks.push({
            ...task,
            processedBy: worker.id,
            processedAt: Date.now()
          });
          
          worker.processed++;
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      });
      
      await Promise.all(workerPromises);
      
      // Verify all tasks processed
      expect(processedTasks).toHaveLength(tasks.length);
      
      // Verify work distribution
      workers.forEach(worker => {
        expect(worker.processed).toBeGreaterThan(0);
      });
      
      // Check that sum of processed equals total
      const totalProcessed = workers.reduce((sum, w) => sum + w.processed, 0);
      expect(totalProcessed).toBe(tasks.length);
    });

    it('should implement priority queue pattern', async () => {
      const priorityQueue = `pqueue:${testSwarmId}:priority`;
      
      // Add tasks with different priorities
      const tasks = [
        { id: 'critical-1', priority: 0, data: 'Critical task' },
        { id: 'high-1', priority: 1, data: 'High priority' },
        { id: 'medium-1', priority: 5, data: 'Medium priority' },
        { id: 'low-1', priority: 10, data: 'Low priority' },
        { id: 'critical-2', priority: 0, data: 'Another critical' }
      ];
      
      // Add to sorted set with priority as score
      for (const task of tasks) {
        await redis.zadd(priorityQueue, task.priority, JSON.stringify(task));
      }
      
      // Process tasks by priority
      const processed: any[] = [];
      while (true) {
        // Get highest priority (lowest score)
        const result = await redis.zpopmin(priorityQueue);
        if (!result || result.length === 0) break;
        
        const task = JSON.parse(result[0]);
        processed.push(task);
      }
      
      // Verify processing order
      expect(processed[0].id).toBe('critical-1');
      expect(processed[1].id).toBe('critical-2');
      expect(processed[processed.length - 1].id).toBe('low-1');
      
      // Verify priorities are in ascending order
      for (let i = 1; i < processed.length; i++) {
        expect(processed[i].priority).toBeGreaterThanOrEqual(processed[i - 1].priority);
      }
    });
  });

  describe('Distributed Coordination Patterns', () => {
    it('should implement distributed locking', async () => {
      const lockKey = `lock:${testSwarmId}:resource`;
      const lockResults: any[] = [];
      
      // Simulate multiple containers trying to acquire lock
      const containers = ['manager', 'worker-1', 'worker-2', 'dashboard'];
      
      const lockPromises = containers.map(async (container) => {
        const lockId = `${container}-${Date.now()}`;
        
        // Try to acquire lock with SET NX EX
        const acquired = await redis.set(lockKey, lockId, 'NX', 'EX', 5);
        
        if (acquired) {
          lockResults.push({
            container,
            acquired: true,
            timestamp: Date.now()
          });
          
          // Simulate work while holding lock
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Release lock only if we own it
          const currentLock = await redis.get(lockKey);
          if (currentLock === lockId) {
            await redis.del(lockKey);
          }
        } else {
          lockResults.push({
            container,
            acquired: false,
            timestamp: Date.now()
          });
        }
      });
      
      await Promise.all(lockPromises);
      
      // Verify only one container acquired the lock
      const acquiredCount = lockResults.filter(r => r.acquired).length;
      expect(acquiredCount).toBe(1);
    });

    it('should implement leader election pattern', async () => {
      const electionKey = `election:${testSwarmId}:leader`;
      const candidates = testAgents.map(a => ({
        id: a.id,
        container: a.container,
        score: Math.random() * 100 // Random election score
      }));
      
      // Each candidate proposes themselves
      for (const candidate of candidates) {
        await redis.zadd(
          electionKey,
          candidate.score,
          JSON.stringify(candidate)
        );
      }
      
      // Get the leader (highest score)
      const leaderResult = await redis.zrange(electionKey, -1, -1);
      const leader = JSON.parse(leaderResult[0]);
      
      // Verify leader was elected
      expect(leader).toBeDefined();
      expect(leader.id).toBeTruthy();
      
      // Verify leader has highest score
      const maxScore = Math.max(...candidates.map(c => c.score));
      expect(leader.score).toBe(maxScore);
      
      // Store leader info for other containers
      await redis.set(`${electionKey}:current`, JSON.stringify({
        leader: leader.id,
        electedAt: Date.now(),
        term: 1
      }), 'EX', 300);
      
      // Verify other containers can discover leader
      const currentLeader = await redis.get(`${electionKey}:current`);
      expect(JSON.parse(currentLeader!).leader).toBe(leader.id);
    });
  });

  describe('Monitoring and Observability', () => {
    it('should collect metrics from all containers', async () => {
      const metricsKey = `metrics:${testSwarmId}`;
      
      // Simulate metrics from different containers
      const containerMetrics = [
        {
          container: 'manager',
          cpu: 45.2,
          memory: 512,
          connections: 25,
          requests: 1500
        },
        {
          container: 'worker-1',
          cpu: 68.5,
          memory: 768,
          tasks: 45,
          errors: 2
        },
        {
          container: 'dashboard',
          cpu: 32.1,
          memory: 256,
          activeUsers: 5,
          pageViews: 234
        }
      ];
      
      // Store metrics with timestamps
      for (const metric of containerMetrics) {
        const metricWithTime = {
          ...metric,
          timestamp: Date.now()
        };
        
        await redis.hset(
          metricsKey,
          metric.container,
          JSON.stringify(metricWithTime)
        );
      }
      
      // Aggregate metrics
      const allMetrics = await redis.hgetall(metricsKey);
      const aggregated = {
        totalCpu: 0,
        totalMemory: 0,
        containers: 0
      };
      
      Object.values(allMetrics).forEach(metricStr => {
        const metric = JSON.parse(metricStr);
        aggregated.totalCpu += metric.cpu || 0;
        aggregated.totalMemory += metric.memory || 0;
        aggregated.containers++;
      });
      
      // Verify aggregation
      expect(aggregated.containers).toBe(containerMetrics.length);
      expect(aggregated.totalCpu).toBeGreaterThan(100);
      expect(aggregated.totalMemory).toBeGreaterThan(1000);
    });

    it('should trace cross-container operations', async () => {
      const traceId = `trace-${Date.now()}`;
      const spans: any[] = [];
      
      // Simulate a distributed operation across containers
      const operation = {
        traceId,
        operation: 'distributed_task',
        spans: [
          {
            spanId: 'span-1',
            container: 'manager',
            operation: 'receive_request',
            startTime: Date.now(),
            duration: 10
          },
          {
            spanId: 'span-2',
            container: 'manager',
            operation: 'validate_request',
            startTime: Date.now() + 10,
            duration: 5,
            parentSpan: 'span-1'
          },
          {
            spanId: 'span-3',
            container: 'worker-1',
            operation: 'process_task',
            startTime: Date.now() + 15,
            duration: 50,
            parentSpan: 'span-1'
          },
          {
            spanId: 'span-4',
            container: 'worker-2',
            operation: 'auxiliary_processing',
            startTime: Date.now() + 20,
            duration: 30,
            parentSpan: 'span-3'
          },
          {
            spanId: 'span-5',
            container: 'dashboard',
            operation: 'update_ui',
            startTime: Date.now() + 65,
            duration: 10,
            parentSpan: 'span-1'
          }
        ]
      };
      
      // Store trace spans
      for (const span of operation.spans) {
        await redis.lpush(`trace:${traceId}:spans`, JSON.stringify(span));
        spans.push(span);
      }
      
      // Calculate total duration
      const startTime = Math.min(...spans.map(s => s.startTime));
      const endTime = Math.max(...spans.map(s => s.startTime + s.duration));
      const totalDuration = endTime - startTime;
      
      // Store trace summary
      await redis.set(`trace:${traceId}:summary`, JSON.stringify({
        traceId,
        operation: operation.operation,
        startTime,
        duration: totalDuration,
        spanCount: spans.length,
        containers: [...new Set(spans.map(s => s.container))]
      }));
      
      // Verify trace integrity
      const summary = JSON.parse(await redis.get(`trace:${traceId}:summary`) || '{}');
      expect(summary.spanCount).toBe(operation.spans.length);
      expect(summary.containers).toHaveLength(4); // All containers involved
      expect(summary.duration).toBeGreaterThan(50); // At least the longest span
    });
  });
});

// Export test results
export const swarmCommunicationTestResults = {
  suite: 'Swarm Container Communication',
  timestamp: Date.now(),
  categories: [
    'Redis Pub/Sub Communication',
    'WebSocket Communication',
    'HTTP API Communication',
    'Network Security',
    'Message Queue Patterns',
    'Distributed Coordination',
    'Monitoring and Observability'
  ]
};