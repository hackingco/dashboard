import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchMachines,
  createMachine,
  deleteMachine,
  startMachine,
  stopMachine,
  fetchSwarmMetrics,
  scaleSwarm,
} from '../../../lib/machines-api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Machines API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables
    process.env.FLY_API_TOKEN = 'test-token';
    process.env.FLY_APP_NAME = 'test-app';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchMachines', () => {
    it('fetches machines successfully', async () => {
      const mockMachines = [
        { id: 'vm-001', state: 'started', region: 'iad' },
        { id: 'vm-002', state: 'stopped', region: 'lax' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMachines,
      });

      const result = await fetchMachines();

      expect(result).toEqual(mockMachines);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.machines.dev/v1/apps/test-app/machines',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchMachines()).rejects.toThrow('Failed to fetch machines: 500 Internal Server Error');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchMachines()).rejects.toThrow('Network error');
    });
  });

  describe('createMachine', () => {
    it('creates a machine successfully', async () => {
      const machineConfig = {
        name: 'test-machine',
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

      const mockResponse = { id: 'vm-123', ...machineConfig };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await createMachine(machineConfig);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.machines.dev/v1/apps/test-app/machines',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(machineConfig),
        }
      );
    });

    it('validates machine configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        name: '',
      };

      await expect(createMachine(invalidConfig as any)).rejects.toThrow('Invalid machine configuration');
    });
  });

  describe('deleteMachine', () => {
    it('deletes a machine successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await deleteMachine('vm-123');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.machines.dev/v1/apps/test-app/machines/vm-123',
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('handles deletion of non-existent machine', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(deleteMachine('vm-nonexistent')).rejects.toThrow('Failed to delete machine: 404 Not Found');
    });
  });

  describe('startMachine', () => {
    it('starts a machine successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'started' }),
      });

      const result = await startMachine('vm-123');

      expect(result).toEqual({ state: 'started' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.machines.dev/v1/apps/test-app/machines/vm-123/start',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });
  });

  describe('stopMachine', () => {
    it('stops a machine successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'stopped' }),
      });

      const result = await stopMachine('vm-123');

      expect(result).toEqual({ state: 'stopped' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.machines.dev/v1/apps/test-app/machines/vm-123/stop',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });
  });

  describe('fetchSwarmMetrics', () => {
    it('fetches and calculates swarm metrics', async () => {
      const mockMachines = [
        {
          id: 'vm-001',
          state: 'started',
          config: {
            guest: { cpus: 1, memory_mb: 512 },
          },
          stats: {
            cpu_percent: 45.5,
            memory_percent: 60.2,
          },
        },
        {
          id: 'vm-002',
          state: 'started',
          config: {
            guest: { cpus: 2, memory_mb: 1024 },
          },
          stats: {
            cpu_percent: 30.1,
            memory_percent: 40.8,
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMachines,
      });

      const metrics = await fetchSwarmMetrics();

      expect(metrics.totalMachines).toBe(2);
      expect(metrics.activeMachines).toBe(2);
      expect(metrics.totalCPU).toBe(3);
      expect(metrics.totalMemory).toBe(1536); // 512 + 1024
      expect(metrics.averageLoad).toBeCloseTo(37.8); // (45.5 + 30.1) / 2
    });

    it('handles machines with missing stats', async () => {
      const mockMachines = [
        {
          id: 'vm-001',
          state: 'started',
          config: {
            guest: { cpus: 1, memory_mb: 512 },
          },
          // Missing stats
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMachines,
      });

      const metrics = await fetchSwarmMetrics();

      expect(metrics.averageLoad).toBe(0);
      expect(metrics.errors).toContain('Machine vm-001 has no stats available');
    });
  });

  describe('scaleSwarm', () => {
    it('scales swarm up successfully', async () => {
      // Mock current machines
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'vm-001' }],
      });

      // Mock machine creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'vm-002' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'vm-003' }),
      });

      const result = await scaleSwarm(3);

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.totalMachines).toBe(3);
    });

    it('scales swarm down successfully', async () => {
      // Mock current machines
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'vm-001' },
          { id: 'vm-002' },
          { id: 'vm-003' },
        ],
      });

      // Mock machine deletion
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await scaleSwarm(1);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
      expect(result.totalMachines).toBe(1);
    });

    it('handles scaling errors gracefully', async () => {
      // Mock current machines
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      // Mock failed machine creation
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await scaleSwarm(2);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to create machine: 429 Too Many Requests');
    });
  });
});