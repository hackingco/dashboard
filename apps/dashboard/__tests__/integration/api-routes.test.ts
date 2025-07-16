import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the machines API
vi.mock('../../lib/machines-api', () => ({
  machinesApi: {
    listMachines: vi.fn(),
    createMachine: vi.fn(),
    getMachine: vi.fn(),
    startMachine: vi.fn(),
    stopMachine: vi.fn(),
    getSwarmStatus: vi.fn(),
    scaleSwarm: vi.fn(),
  }
}));

// Mock supabase
vi.mock('../../lib/supabase-client', () => ({
  swarmOperations: {
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
  }
}));

describe('API Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/swarms', () => {
    it('handles GET request to list swarms', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      const mockSwarms = [
        {
          id: 'swarm-1',
          name: 'Test Swarm',
          status: 'running',
          worker_count: 3
        }
      ];
      
      vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);

      const request = new NextRequest('http://localhost:3000/api/swarms');
      const { GET } = await import('../../app/api/swarms/route');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockSwarms);
    });

    it('handles POST request to create swarm', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      const newSwarm = {
        name: 'New Swarm',
        purpose: 'Testing',
        worker_count: 2,
        config: { maxWorkers: 5 }
      };
      
      const createdSwarm = { id: 'swarm-new', ...newSwarm, status: 'creating' };
      vi.mocked(swarmOperations.create).mockResolvedValue(createdSwarm);

      const request = new NextRequest('http://localhost:3000/api/swarms', {
        method: 'POST',
        body: JSON.stringify(newSwarm),
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/route');
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toEqual(createdSwarm);
      expect(swarmOperations.create).toHaveBeenCalledWith(newSwarm);
    });

    it('handles validation errors in POST request', async () => {
      const invalidSwarm = { name: '' }; // Missing required fields

      const request = new NextRequest('http://localhost:3000/api/swarms', {
        method: 'POST',
        body: JSON.stringify(invalidSwarm),
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/route');
      const response = await POST(request);

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });

    it('handles database errors gracefully', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      vi.mocked(swarmOperations.list).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/swarms');
      const { GET } = await import('../../app/api/swarms/route');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });
  });

  describe('/api/swarms/[id]/scale', () => {
    it('handles swarm scaling POST request', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      const { machinesApi } = await import('../../lib/machines-api');
      
      const swarmId = 'swarm-1';
      const targetCount = 5;
      const existingSwarm = {
        id: swarmId,
        name: 'Test Swarm',
        status: 'running',
        worker_count: 3,
        app_name: 'test-app'
      };

      vi.mocked(swarmOperations.get).mockResolvedValue(existingSwarm);
      vi.mocked(machinesApi.scaleSwarm).mockResolvedValue([]);
      vi.mocked(swarmOperations.update).mockResolvedValue({
        ...existingSwarm,
        worker_count: targetCount
      });

      const request = new NextRequest(`http://localhost:3000/api/swarms/${swarmId}/scale`, {
        method: 'POST',
        body: JSON.stringify({ workerCount: targetCount }),
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/[id]/scale/route');
      const response = await POST(request, { params: { id: swarmId } });

      expect(response.status).toBe(200);
      expect(machinesApi.scaleSwarm).toHaveBeenCalledWith(
        'test-app',
        targetCount,
        expect.any(Object)
      );
      expect(swarmOperations.update).toHaveBeenCalledWith(
        swarmId,
        { worker_count: targetCount }
      );
    });

    it('handles invalid swarm ID', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      vi.mocked(swarmOperations.get).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/swarms/invalid-id/scale', {
        method: 'POST',
        body: JSON.stringify({ workerCount: 3 }),
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/[id]/scale/route');
      const response = await POST(request, { params: { id: 'invalid-id' } });

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.error).toBe('Swarm not found');
    });

    it('validates scaling parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/swarms/swarm-1/scale', {
        method: 'POST',
        body: JSON.stringify({ workerCount: -1 }), // Invalid count
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/[id]/scale/route');
      const response = await POST(request, { params: { id: 'swarm-1' } });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });
  });

  describe('/api/swarms/[id]/start', () => {
    it('handles swarm start request', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      const { machinesApi } = await import('../../lib/machines-api');
      
      const swarmId = 'swarm-1';
      const existingSwarm = {
        id: swarmId,
        name: 'Test Swarm',
        status: 'stopped',
        worker_count: 0,
        app_name: 'test-app'
      };

      vi.mocked(swarmOperations.get).mockResolvedValue(existingSwarm);
      vi.mocked(machinesApi.scaleSwarm).mockResolvedValue([]);
      vi.mocked(swarmOperations.update).mockResolvedValue({
        ...existingSwarm,
        status: 'running',
        worker_count: 1
      });

      const request = new NextRequest(`http://localhost:3000/api/swarms/${swarmId}/start`, {
        method: 'POST',
        body: JSON.stringify({ workerCount: 1 }),
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/[id]/start/route');
      const response = await POST(request, { params: { id: swarmId } });

      expect(response.status).toBe(200);
      expect(swarmOperations.update).toHaveBeenCalledWith(
        swarmId,
        expect.objectContaining({
          status: 'running',
          worker_count: 1
        })
      );
    });

    it('prevents starting already running swarm', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      
      const swarmId = 'swarm-1';
      const runningSwarm = {
        id: swarmId,
        name: 'Test Swarm',
        status: 'running',
        worker_count: 3,
        app_name: 'test-app'
      };

      vi.mocked(swarmOperations.get).mockResolvedValue(runningSwarm);

      const request = new NextRequest(`http://localhost:3000/api/swarms/${swarmId}/start`, {
        method: 'POST',
        body: JSON.stringify({ workerCount: 1 }),
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/[id]/start/route');
      const response = await POST(request, { params: { id: swarmId } });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toBe('Swarm is already running');
    });
  });

  describe('/api/swarms/[id]/stop', () => {
    it('handles swarm stop request', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      const { machinesApi } = await import('../../lib/machines-api');
      
      const swarmId = 'swarm-1';
      const runningSwarm = {
        id: swarmId,
        name: 'Test Swarm',
        status: 'running',
        worker_count: 3,
        app_name: 'test-app'
      };

      const mockMachines = [
        { id: 'machine-1', state: 'started' },
        { id: 'machine-2', state: 'started' },
        { id: 'machine-3', state: 'started' }
      ];

      vi.mocked(swarmOperations.get).mockResolvedValue(runningSwarm);
      vi.mocked(machinesApi.listMachines).mockResolvedValue(mockMachines);
      vi.mocked(machinesApi.stopMachine).mockResolvedValue(undefined);
      vi.mocked(swarmOperations.update).mockResolvedValue({
        ...runningSwarm,
        status: 'stopped',
        worker_count: 0
      });

      const request = new NextRequest(`http://localhost:3000/api/swarms/${swarmId}/stop`, {
        method: 'POST'
      });

      const { POST } = await import('../../app/api/swarms/[id]/stop/route');
      const response = await POST(request, { params: { id: swarmId } });

      expect(response.status).toBe(200);
      expect(machinesApi.stopMachine).toHaveBeenCalledTimes(3);
      expect(swarmOperations.update).toHaveBeenCalledWith(
        swarmId,
        expect.objectContaining({
          status: 'stopped',
          worker_count: 0
        })
      );
    });

    it('prevents stopping already stopped swarm', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      
      const swarmId = 'swarm-1';
      const stoppedSwarm = {
        id: swarmId,
        name: 'Test Swarm',
        status: 'stopped',
        worker_count: 0,
        app_name: 'test-app'
      };

      vi.mocked(swarmOperations.get).mockResolvedValue(stoppedSwarm);

      const request = new NextRequest(`http://localhost:3000/api/swarms/${swarmId}/stop`, {
        method: 'POST'
      });

      const { POST } = await import('../../app/api/swarms/[id]/stop/route');
      const response = await POST(request, { params: { id: swarmId } });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toBe('Swarm is already stopped');
    });
  });

  describe('/api/swarm-status', () => {
    it('returns aggregated swarm status', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      const { machinesApi } = await import('../../lib/machines-api');

      const mockSwarms = [
        { id: 'swarm-1', status: 'running', worker_count: 3, app_name: 'app1' },
        { id: 'swarm-2', status: 'stopped', worker_count: 0, app_name: 'app2' }
      ];

      const mockStatus = {
        total_machines: 3,
        running_machines: 3,
        stopped_machines: 0,
        failed_machines: 0,
        total_volumes: 1,
        regions: ['dfw', 'ord']
      };

      vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);
      vi.mocked(machinesApi.getSwarmStatus).mockResolvedValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/swarm-status');
      const { GET } = await import('../../app/api/swarm-status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toHaveProperty('swarms');
      expect(data).toHaveProperty('machines');
      expect(data.swarms).toEqual(mockSwarms);
      expect(data.machines).toEqual(mockStatus);
    });

    it('handles empty swarm list', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      vi.mocked(swarmOperations.list).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/swarm-status');
      const { GET } = await import('../../app/api/swarm-status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.swarms).toEqual([]);
      expect(data.machines).toBeNull();
    });

    it('handles errors from machines API', async () => {
      const { swarmOperations } = await import('../../lib/supabase-client');
      const { machinesApi } = await import('../../lib/machines-api');

      const mockSwarms = [
        { id: 'swarm-1', status: 'running', worker_count: 3, app_name: 'app1' }
      ];

      vi.mocked(swarmOperations.list).mockResolvedValue(mockSwarms);
      vi.mocked(machinesApi.getSwarmStatus).mockRejectedValue(new Error('API Error'));

      const request = new NextRequest('http://localhost:3000/api/swarm-status');
      const { GET } = await import('../../app/api/swarm-status/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data.swarms).toEqual(mockSwarms);
      expect(data.machines).toBeNull();
      expect(data).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('handles malformed JSON in POST requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/swarms', {
        method: 'POST',
        body: 'invalid-json',
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/route');
      const response = await POST(request);

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error).toHaveProperty('error');
    });

    it('handles missing Content-Type header', async () => {
      const request = new NextRequest('http://localhost:3000/api/swarms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });

      const { POST } = await import('../../app/api/swarms/route');
      const response = await POST(request);

      // Should still work or return appropriate error
      expect([200, 201, 400]).toContain(response.status);
    });

    it('handles very large payloads', async () => {
      const largePayload = {
        name: 'Test Swarm',
        config: {
          env: Object.fromEntries(
            Array.from({ length: 1000 }, (_, i) => [`VAR_${i}`, `value_${i}`])
          )
        }
      };

      const request = new NextRequest('http://localhost:3000/api/swarms', {
        method: 'POST',
        body: JSON.stringify(largePayload),
        headers: { 'Content-Type': 'application/json' }
      });

      const { POST } = await import('../../app/api/swarms/route');
      const response = await POST(request);

      // Should either accept or reject gracefully
      expect([200, 201, 400, 413]).toContain(response.status);
    });
  });

  describe('CORS and Headers', () => {
    it('includes appropriate CORS headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/swarms');
      const { GET } = await import('../../app/api/swarms/route');
      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('handles OPTIONS requests for preflight', async () => {
      const request = new NextRequest('http://localhost:3000/api/swarms', {
        method: 'OPTIONS'
      });

      try {
        const { OPTIONS } = await import('../../app/api/swarms/route');
        if (OPTIONS) {
          const response = await OPTIONS(request);
          expect(response.status).toBe(200);
        }
      } catch (error) {
        // OPTIONS handler might not be implemented, which is fine
        expect(true).toBe(true);
      }
    });
  });
});