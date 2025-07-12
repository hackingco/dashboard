/**
 * Deployment Validation Test Suite
 * Validates multi-service deployment on Fly.io
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestEnvironment, validateEnvironment } from '../config/test-environments';

const TEST_TIMEOUT = 60000; // 60 seconds for deployment tests

describe('Deployment Validation', () => {
  const env = getTestEnvironment();
  
  beforeAll(() => {
    const errors = validateEnvironment(env);
    if (errors.length > 0) {
      throw new Error(`Invalid test environment: ${errors.join(', ')}`);
    }
  });

  describe('Service Health Checks', () => {
    it('should validate Dashboard service health', async () => {
      const response = await fetch(`${env.services.dashboard}/api/health`);
      expect(response.ok).toBe(true);
      
      const health = await response.json();
      expect(health).toMatchObject({
        status: 'healthy',
        service: 'dashboard',
        version: expect.any(String),
        uptime: expect.any(Number)
      });
    }, TEST_TIMEOUT);

    it('should validate Manager service health', async () => {
      const response = await fetch(`${env.services.manager}/health`);
      expect(response.ok).toBe(true);
      
      const health = await response.json();
      expect(health).toMatchObject({
        status: 'healthy',
        service: 'manager',
        version: expect.any(String),
        redis: 'connected',
        database: 'connected'
      });
    }, TEST_TIMEOUT);

    if (env.services.worker) {
      it('should validate Worker service health', async () => {
        const response = await fetch(`${env.services.worker}/health`);
        expect(response.ok).toBe(true);
        
        const health = await response.json();
        expect(health).toMatchObject({
          status: 'healthy',
          service: 'worker',
          jobQueue: 'active'
        });
      }, TEST_TIMEOUT);
    }
  });

  describe('API Endpoint Validation', () => {
    it('should validate swarm status endpoint', async () => {
      const response = await fetch(`${env.services.dashboard}/api/swarm-status`);
      expect(response.ok).toBe(true);
      
      const status = await response.json();
      expect(status).toMatchObject({
        totalMachines: expect.any(Number),
        activeMachines: expect.any(Number),
        totalSwarms: expect.any(Number),
        activeSwarms: expect.any(Number)
      });
    });

    it('should validate machines list endpoint', async () => {
      const response = await fetch(`${env.services.dashboard}/api/machines`, {
        headers: env.flyConfig ? {
          'Authorization': `Bearer ${env.flyConfig.apiToken}`
        } : {}
      });
      
      expect(response.ok).toBe(true);
      const machines = await response.json();
      expect(Array.isArray(machines)).toBe(true);
    });

    it('should validate metrics endpoint', async () => {
      const response = await fetch(`${env.services.manager}/api/metrics`);
      expect(response.ok).toBe(true);
      
      const metrics = await response.json();
      expect(metrics).toMatchObject({
        cpu: expect.any(Object),
        memory: expect.any(Object),
        requests: expect.any(Object)
      });
    });
  });

  describe('Database Connectivity', () => {
    it('should validate database connection', async () => {
      const response = await fetch(`${env.services.manager}/api/system/database-status`);
      expect(response.ok).toBe(true);
      
      const status = await response.json();
      expect(status).toMatchObject({
        connected: true,
        latency: expect.any(Number),
        version: expect.any(String)
      });
    });

    it('should validate Redis connection', async () => {
      const response = await fetch(`${env.services.manager}/api/system/redis-status`);
      expect(response.ok).toBe(true);
      
      const status = await response.json();
      expect(status).toMatchObject({
        connected: true,
        latency: expect.any(Number),
        memory: expect.any(Object)
      });
    });
  });

  describe('Fly.io Integration', () => {
    if (env.flyConfig) {
      it('should validate Fly.io API access', async () => {
        const response = await fetch('https://api.machines.dev/v1/apps', {
          headers: {
            'Authorization': `Bearer ${env.flyConfig.apiToken}`
          }
        });
        
        expect(response.ok).toBe(true);
      });

      it('should validate app exists on Fly.io', async () => {
        const response = await fetch(
          `https://api.machines.dev/v1/apps/${env.flyConfig.appName}`,
          {
            headers: {
              'Authorization': `Bearer ${env.flyConfig.apiToken}`
            }
          }
        );
        
        expect(response.ok).toBe(true);
        const app = await response.json();
        expect(app.name).toBe(env.flyConfig.appName);
      });
    }
  });

  describe('Supabase Integration', () => {
    if (env.supabaseConfig) {
      it('should validate Supabase connection', async () => {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          env.supabaseConfig.url,
          env.supabaseConfig.anonKey
        );
        
        const { data, error } = await supabase
          .from('swarms')
          .select('count')
          .limit(1);
        
        expect(error).toBeNull();
        expect(data).toBeDefined();
      });

      it('should validate real-time subscription', async () => {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          env.supabaseConfig.url,
          env.supabaseConfig.anonKey
        );
        
        return new Promise<void>((resolve, reject) => {
          const channel = supabase
            .channel('test-channel')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'swarms' }, 
              () => {
                // Subscription successful
                supabase.removeChannel(channel);
                resolve();
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                // Give it a moment to ensure it's fully connected
                setTimeout(() => {
                  supabase.removeChannel(channel);
                  resolve();
                }, 1000);
              } else if (status === 'CHANNEL_ERROR') {
                reject(new Error('Failed to subscribe to real-time changes'));
              }
            });
          
          // Timeout after 10 seconds
          setTimeout(() => {
            supabase.removeChannel(channel);
            reject(new Error('Real-time subscription timeout'));
          }, 10000);
        });
      });
    }
  });

  describe('Cross-Service Communication', () => {
    it('should validate Dashboard can reach Manager', async () => {
      // Make a request from Dashboard that requires Manager
      const response = await fetch(`${env.services.dashboard}/api/proxy-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetService: 'manager',
          endpoint: '/health'
        })
      });
      
      expect(response.ok).toBe(true);
    });

    it('should validate end-to-end machine creation flow', async () => {
      // This test validates the complete flow:
      // Dashboard -> Manager -> Fly.io -> Database
      
      const testMachineName = `test-deployment-${Date.now()}`;
      
      // Create machine through Dashboard API
      const createResponse = await fetch(`${env.services.dashboard}/api/machines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': env.flyConfig ? `Bearer ${env.flyConfig.apiToken}` : ''
        },
        body: JSON.stringify({
          name: testMachineName,
          config: {
            image: 'nginx:alpine',
            guest: {
              cpu_kind: 'shared',
              cpus: 1,
              memory_mb: 256
            }
          },
          region: env.flyConfig?.region || 'iad'
        })
      });
      
      if (env.flyConfig) {
        expect(createResponse.ok).toBe(true);
        const machine = await createResponse.json();
        expect(machine.id).toBeDefined();
        
        // Clean up - delete the test machine
        await fetch(`${env.services.dashboard}/api/machines/${machine.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${env.flyConfig.apiToken}`
          }
        });
      } else {
        // For local environment, just check that the endpoint exists
        expect([200, 201, 400, 401].includes(createResponse.status)).toBe(true);
      }
    }, TEST_TIMEOUT);
  });

  describe('Performance Baselines', () => {
    it('should meet response time requirements', async () => {
      const endpoints = [
        `${env.services.dashboard}/api/health`,
        `${env.services.manager}/health`,
        `${env.services.dashboard}/api/swarm-status`
      ];
      
      for (const endpoint of endpoints) {
        const start = Date.now();
        const response = await fetch(endpoint);
        const duration = Date.now() - start;
        
        expect(response.ok).toBe(true);
        expect(duration).toBeLessThan(1000); // Should respond within 1 second
      }
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const endpoint = `${env.services.dashboard}/api/swarm-status`;
      
      const requests = Array(concurrentRequests).fill(null).map(() => 
        fetch(endpoint).then(r => ({ ok: r.ok, status: r.status }))
      );
      
      const results = await Promise.all(requests);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.ok).toBe(true);
        expect(result.status).toBe(200);
      });
    });
  });
});

describe('Post-Deployment Monitoring', () => {
  const env = getTestEnvironment();
  
  it('should have monitoring endpoints available', async () => {
    const monitoringEndpoints = [
      `${env.services.manager}/api/metrics`,
      `${env.services.manager}/api/system/status`,
      `${env.services.dashboard}/api/monitoring/overview`
    ];
    
    for (const endpoint of monitoringEndpoints) {
      const response = await fetch(endpoint);
      // Some monitoring endpoints might require auth, so we check for expected status codes
      expect([200, 401, 403].includes(response.status)).toBe(true);
    }
  });

  it('should expose Prometheus-compatible metrics', async () => {
    const response = await fetch(`${env.services.manager}/metrics`);
    
    if (response.ok) {
      const text = await response.text();
      // Check for Prometheus format
      expect(text).toMatch(/^# HELP/m);
      expect(text).toMatch(/^# TYPE/m);
    }
  });
});