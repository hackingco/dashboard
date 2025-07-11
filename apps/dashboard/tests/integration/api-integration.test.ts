import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import { NextApiHandler } from 'next';
import request from 'supertest';

// Mock the Fly API
const mockFlyAPI = createServer((req, res) => {
  const url = new URL(req.url!, 'http://localhost');
  const method = req.method;

  // Route handling for different API endpoints
  if (method === 'GET' && url.pathname.includes('/machines')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([
      {
        id: 'vm-test-001',
        name: 'test-machine-1',
        state: 'started',
        region: 'iad',
        config: {
          image: 'nginx:latest',
          guest: {
            cpu_kind: 'shared',
            cpus: 1,
            memory_mb: 256,
          },
        },
        stats: {
          cpu_percent: 25.5,
          memory_percent: 45.2,
        },
      },
      {
        id: 'vm-test-002',
        name: 'test-machine-2',
        state: 'stopped',
        region: 'lax',
        config: {
          image: 'nginx:latest',
          guest: {
            cpu_kind: 'shared',
            cpus: 2,
            memory_mb: 512,
          },
        },
      },
    ]));
    return;
  }

  if (method === 'POST' && url.pathname.includes('/machines')) {
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'vm-new-001',
      name: 'new-machine',
      state: 'creating',
      region: 'iad',
    }));
    return;
  }

  if (method === 'DELETE' && url.pathname.includes('/machines/')) {
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === 'POST' && url.pathname.includes('/start')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ state: 'starting' }));
    return;
  }

  if (method === 'POST' && url.pathname.includes('/stop')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ state: 'stopping' }));
    return;
  }

  // Default 404
  res.writeHead(404);
  res.end('Not Found');
});

describe('API Integration Tests', () => {
  let mockServerPort: number;

  beforeAll(async () => {
    // Start mock Fly API server
    return new Promise<void>((resolve) => {
      mockFlyAPI.listen(0, () => {
        const address = mockFlyAPI.address();
        if (address && typeof address === 'object') {
          mockServerPort = address.port;
          // Override the API base URL for tests
          process.env.FLY_API_BASE_URL = `http://localhost:${mockServerPort}`;
          process.env.FLY_API_TOKEN = 'test-token';
          process.env.FLY_APP_NAME = 'test-app';
          resolve();
        }
      });
    });
  });

  afterAll(() => {
    mockFlyAPI.close();
  });

  describe('/api/machines', () => {
    it('fetches machines list', async () => {
      // Import the API handler
      const { default: handler } = await import('../../app/api/machines/route');
      
      // Create a mock request
      const req = new Request('http://localhost:3000/api/machines', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 'vm-test-001',
        name: 'test-machine-1',
        state: 'started',
      });
    });

    it('creates a new machine', async () => {
      const { default: handler } = await import('../../app/api/machines/route');
      
      const machineConfig = {
        name: 'integration-test-machine',
        config: {
          image: 'nginx:latest',
          guest: {
            cpu_kind: 'shared',
            cpus: 1,
            memory_mb: 256,
          },
        },
        region: 'iad',
      };

      const req = new Request('http://localhost:3000/api/machines', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(machineConfig),
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: 'vm-new-001',
        name: 'new-machine',
        state: 'creating',
      });
    });

    it('handles invalid machine configuration', async () => {
      const { default: handler } = await import('../../app/api/machines/route');
      
      const invalidConfig = {
        name: '', // Invalid: empty name
        config: {
          // Missing required fields
        },
      };

      const req = new Request('http://localhost:3000/api/machines', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidConfig),
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid machine configuration');
    });
  });

  describe('/api/swarm-status', () => {
    it('returns swarm status with metrics', async () => {
      const { default: handler } = await import('../../app/api/swarm-status/route');
      
      const req = new Request('http://localhost:3000/api/swarm-status', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        totalMachines: expect.any(Number),
        activeMachines: expect.any(Number),
        status: expect.any(String),
        metrics: expect.any(Object),
      });
    });

    it('handles API errors gracefully', async () => {
      // Temporarily break the API
      process.env.FLY_API_TOKEN = 'invalid-token';

      const { default: handler } = await import('../../app/api/swarm-status/route');
      
      const req = new Request('http://localhost:3000/api/swarm-status', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      const response = await handler(req);
      
      expect(response.status).toBe(500);

      // Restore valid token
      process.env.FLY_API_TOKEN = 'test-token';
    });
  });

  describe('/api/swarms', () => {
    it('creates a new swarm', async () => {
      const { default: handler } = await import('../../app/api/swarms/route');
      
      const swarmConfig = {
        name: 'test-swarm',
        machineCount: 3,
        region: 'iad',
        machineConfig: {
          image: 'nginx:latest',
          guest: {
            cpu_kind: 'shared',
            cpus: 1,
            memory_mb: 256,
          },
        },
      };

      const req = new Request('http://localhost:3000/api/swarms', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swarmConfig),
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        swarmId: expect.any(String),
        status: 'creating',
        machineCount: 3,
      });
    });

    it('validates swarm configuration', async () => {
      const { default: handler } = await import('../../app/api/swarms/route');
      
      const invalidConfig = {
        name: '',
        machineCount: 0, // Invalid
      };

      const req = new Request('http://localhost:3000/api/swarms', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidConfig),
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid swarm configuration');
    });
  });

  describe('Swarm scaling operations', () => {
    it('scales a swarm up', async () => {
      const { default: handler } = await import('../../app/api/swarms/[id]/scale/route');
      
      const req = new Request('http://localhost:3000/api/swarms/test-swarm-id/scale', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetCount: 5 }),
      });

      const response = await handler(req, { params: { id: 'test-swarm-id' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalMachines).toBe(5);
    });

    it('scales a swarm down', async () => {
      const { default: handler } = await import('../../app/api/swarms/[id]/scale/route');
      
      const req = new Request('http://localhost:3000/api/swarms/test-swarm-id/scale', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetCount: 1 }),
      });

      const response = await handler(req, { params: { id: 'test-swarm-id' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Machine lifecycle operations', () => {
    it('starts a machine', async () => {
      const { default: handler } = await import('../../app/api/swarms/[id]/start/route');
      
      const req = new Request('http://localhost:3000/api/swarms/test-swarm-id/start', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const response = await handler(req, { params: { id: 'test-swarm-id' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('starting');
    });

    it('stops a machine', async () => {
      const { default: handler } = await import('../../app/api/swarms/[id]/stop/route');
      
      const req = new Request('http://localhost:3000/api/swarms/test-swarm-id/stop', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const response = await handler(req, { params: { id: 'test-swarm-id' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('stopping');
    });
  });

  describe('Error handling and resilience', () => {
    it('handles network timeouts', async () => {
      // Create a server that delays responses
      const slowServer = createServer((req, res) => {
        setTimeout(() => {
          res.writeHead(200);
          res.end('{}');
        }, 10000); // 10 second delay
      });

      const slowServerPort = await new Promise<number>((resolve) => {
        slowServer.listen(0, () => {
          const address = slowServer.address();
          if (address && typeof address === 'object') {
            resolve(address.port);
          }
        });
      });

      // Override timeout for this test
      process.env.FLY_API_BASE_URL = `http://localhost:${slowServerPort}`;
      process.env.API_TIMEOUT = '1000'; // 1 second timeout

      const { default: handler } = await import('../../app/api/machines/route');
      
      const req = new Request('http://localhost:3000/api/machines', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const response = await handler(req);
      
      expect(response.status).toBe(504); // Gateway timeout

      slowServer.close();
      
      // Restore original settings
      process.env.FLY_API_BASE_URL = `http://localhost:${mockServerPort}`;
      delete process.env.API_TIMEOUT;
    });

    it('handles rate limiting', async () => {
      // Create a server that returns 429
      const rateLimitServer = createServer((req, res) => {
        res.writeHead(429, { 'Retry-After': '60' });
        res.end('Rate limit exceeded');
      });

      const rateLimitPort = await new Promise<number>((resolve) => {
        rateLimitServer.listen(0, () => {
          const address = rateLimitServer.address();
          if (address && typeof address === 'object') {
            resolve(address.port);
          }
        });
      });

      process.env.FLY_API_BASE_URL = `http://localhost:${rateLimitPort}`;

      const { default: handler } = await import('../../app/api/machines/route');
      
      const req = new Request('http://localhost:3000/api/machines', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const response = await handler(req);
      const data = await response.json();
      
      expect(response.status).toBe(429);
      expect(data.error).toContain('Rate limit');

      rateLimitServer.close();
      
      // Restore original settings
      process.env.FLY_API_BASE_URL = `http://localhost:${mockServerPort}`;
    });
  });
});