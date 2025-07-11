import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlyService } from '../../../src/services/fly.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FlyService', () => {
  let flyService: FlyService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FLY_API_TOKEN = 'test-token';
    process.env.FLY_APP_NAME = 'test-app';
    flyService = new FlyService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('initializes with environment variables', () => {
      expect(flyService).toBeInstanceOf(FlyService);
    });

    it('throws error when API token is missing', () => {
      delete process.env.FLY_API_TOKEN;
      expect(() => new FlyService()).toThrow('FLY_API_TOKEN is required');
    });

    it('throws error when app name is missing', () => {
      delete process.env.FLY_APP_NAME;
      expect(() => new FlyService()).toThrow('FLY_APP_NAME is required');
    });
  });

  describe('listMachines', () => {
    it('fetches machines successfully', async () => {
      const mockMachines = [
        { id: 'vm-001', state: 'started', region: 'iad' },
        { id: 'vm-002', state: 'stopped', region: 'lax' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMachines,
      });

      const result = await flyService.listMachines();

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

      await expect(flyService.listMachines()).rejects.toThrow('Failed to list machines: 500 Internal Server Error');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(flyService.listMachines()).rejects.toThrow('Network error');
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

      const result = await flyService.createMachine(machineConfig);

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
        name: '',
        config: {},
      };

      await expect(flyService.createMachine(invalidConfig as any)).rejects.toThrow('Invalid machine configuration');
    });

    it('handles creation errors', async () => {
      const validConfig = {
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

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
      });

      await expect(flyService.createMachine(validConfig)).rejects.toThrow('Failed to create machine: 422 Unprocessable Entity');
    });
  });

  describe('deleteMachine', () => {
    it('deletes a machine successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(flyService.deleteMachine('vm-123')).resolves.not.toThrow();

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

      await expect(flyService.deleteMachine('vm-nonexistent')).rejects.toThrow('Failed to delete machine: 404 Not Found');
    });
  });

  describe('startMachine', () => {
    it('starts a machine successfully', async () => {
      const mockResponse = { state: 'starting' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await flyService.startMachine('vm-123');

      expect(result).toEqual(mockResponse);
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

    it('handles start errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      await expect(flyService.startMachine('vm-123')).rejects.toThrow('Failed to start machine: 409 Conflict');
    });
  });

  describe('stopMachine', () => {
    it('stops a machine successfully', async () => {
      const mockResponse = { state: 'stopping' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await flyService.stopMachine('vm-123');

      expect(result).toEqual(mockResponse);
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

    it('handles stop errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      await expect(flyService.stopMachine('vm-123')).rejects.toThrow('Failed to stop machine: 409 Conflict');
    });
  });

  describe('getMachineStats', () => {
    it('fetches machine statistics', async () => {
      const mockStats = {
        cpu_percent: 45.5,
        memory_percent: 60.2,
        network_in: 125500,
        network_out: 89200,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const result = await flyService.getMachineStats('vm-123');

      expect(result).toEqual(mockStats);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.machines.dev/v1/apps/test-app/machines/vm-123/stats',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('handles missing stats gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await flyService.getMachineStats('vm-123');

      expect(result).toEqual({
        cpu_percent: 0,
        memory_percent: 0,
        network_in: 0,
        network_out: 0,
      });
    });
  });

  describe('scaleMachines', () => {
    it('scales up machines', async () => {
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

      const result = await flyService.scaleMachines(3);

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.totalMachines).toBe(3);
    });

    it('scales down machines', async () => {
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

      const result = await flyService.scaleMachines(1);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(2);
      expect(result.totalMachines).toBe(1);
    });

    it('handles scaling errors', async () => {
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

      const result = await flyService.scaleMachines(2);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to create machine: 429 Too Many Requests');
    });
  });

  describe('rate limiting', () => {
    it('implements exponential backoff on rate limit', async () => {
      vi.useFakeTimers();

      // Mock rate limit response
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Map([['Retry-After', '2']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'vm-001' }],
        });

      const promise = flyService.listMachines();

      // Fast forward past the retry delay
      vi.advanceTimersByTime(2000);

      const result = await promise;

      expect(result).toEqual([{ id: 'vm-001' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('gives up after max retries', async () => {
      // Mock repeated rate limit responses
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '1']]),
      });

      await expect(flyService.listMachines()).rejects.toThrow('Failed to list machines: 429 Too Many Requests');

      // Should have retried multiple times
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('timeout handling', () => {
    it('times out long-running requests', async () => {
      // Mock a request that never resolves
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      // Set a short timeout for testing
      process.env.API_TIMEOUT = '1000';

      await expect(flyService.listMachines()).rejects.toThrow('Request timeout');

      delete process.env.API_TIMEOUT;
    });
  });
});