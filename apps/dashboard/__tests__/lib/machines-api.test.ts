import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MachinesAPI } from '../../lib/machines-api';
import type { Machine, MachineConfig, CreateMachineRequest } from '../../lib/machines-api';

// Mock fetch globally
global.fetch = vi.fn();

const mockMachine: Machine = {
  id: 'test-machine-1',
  name: 'test-machine',
  state: 'started',
  region: 'dfw',
  instance_id: 'instance-123',
  private_ip: '172.16.0.1',
  config: {
    image: 'nginx:latest',
    env: { NODE_ENV: 'production' },
    guest: { cpus: 1, memory_mb: 256 },
    services: [{
      internal_port: 8080,
      protocol: 'tcp',
      ports: [{ port: 80 }]
    }]
  },
  created_at: '2023-12-01T10:00:00Z',
  updated_at: '2023-12-01T10:30:00Z',
  events: []
};

const mockConfig: MachineConfig = {
  image: 'nginx:latest',
  env: { NODE_ENV: 'production' },
  guest: { cpus: 1, memory_mb: 256 },
  services: [{
    internal_port: 8080,
    protocol: 'tcp',
    ports: [{ port: 80 }]
  }]
};

describe('MachinesAPI', () => {
  let api: MachinesAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new MachinesAPI({ apiToken: 'test-token' });
  });

  describe('Constructor and Configuration', () => {
    it('initializes with default base URL', () => {
      const testApi = new MachinesAPI({ apiToken: 'test-token' });
      expect(testApi).toBeInstanceOf(MachinesAPI);
    });

    it('initializes with custom base URL', () => {
      const testApi = new MachinesAPI({ 
        apiToken: 'test-token',
        baseUrl: 'https://custom-api.com'
      });
      expect(testApi).toBeInstanceOf(MachinesAPI);
    });
  });

  describe('Request Method', () => {
    it('makes GET requests with proper headers', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([mockMachine]),
      } as Response);

      await api.listMachines('test-app');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('makes POST requests with body', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachine),
      } as Response);

      const createRequest: CreateMachineRequest = {
        config: mockConfig,
        name: 'test-machine',
        region: 'dfw'
      };

      await api.createMachine('test-app', createRequest);

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createRequest),
        })
      );
    });

    it('handles search parameters correctly', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([mockMachine]),
      } as Response);

      await api.listMachines('test-app', { 
        includeDeleted: true, 
        region: 'ord' 
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines?include_deleted=true&region=ord',
        expect.any(Object)
      );
    });

    it('throws error for non-ok responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      } as Response);

      await expect(api.getMachine('test-app', 'invalid-id')).rejects.toThrow(
        'API Error 404: Not Found'
      );
    });

    it('handles 204 responses correctly', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      const result = await api.deleteMachine('test-app', 'machine-1');
      expect(result).toEqual({});
    });
  });

  describe('Apps API', () => {
    it('lists apps with organization slug', async () => {
      const mockApps = { apps: [{ name: 'test-app', status: 'deployed', deployed: true }] };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApps),
      } as Response);

      const result = await api.listApps('test-org');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps?org_slug=test-org',
        expect.any(Object)
      );
      expect(result).toEqual(mockApps);
    });

    it('creates new app', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ app: { name: 'new-app' } }),
      } as Response);

      const request = { app_name: 'new-app', org_slug: 'test-org' };
      await api.createApp(request);

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });

    it('deletes app', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.deleteApp('test-app');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Machines API', () => {
    it('lists machines and validates response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([mockMachine]),
      } as Response);

      const machines = await api.listMachines('test-app');

      expect(machines).toHaveLength(1);
      expect(machines[0]).toEqual(mockMachine);
    });

    it('gets single machine by ID', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachine),
      } as Response);

      const machine = await api.getMachine('test-app', 'test-machine-1');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/test-machine-1',
        expect.any(Object)
      );
      expect(machine).toEqual(mockMachine);
    });

    it('creates machine with validation', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachine),
      } as Response);

      const createRequest: CreateMachineRequest = {
        config: mockConfig,
        name: 'new-machine',
      };

      const machine = await api.createMachine('test-app', createRequest);

      expect(machine).toEqual(mockMachine);
    });

    it('updates machine configuration', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockMachine),
      } as Response);

      const updateRequest = {
        config: { ...mockConfig, env: { NODE_ENV: 'staging' } }
      };

      const machine = await api.updateMachine('test-app', 'machine-1', updateRequest);

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(updateRequest),
        })
      );
      expect(machine).toEqual(mockMachine);
    });

    it('deletes machine', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.deleteMachine('test-app', 'machine-1');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Machine Lifecycle', () => {
    it('starts machine', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.startMachine('test-app', 'machine-1');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1/start',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('stops machine with options', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.stopMachine('test-app', 'machine-1', {
        signal: 'SIGTERM',
        timeout: '30s'
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1/stop',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            signal: 'SIGTERM',
            timeout: '30s'
          }),
        })
      );
    });

    it('restarts machine', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.restartMachine('test-app', 'machine-1', { timeout: '60s' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1/restart?timeout=60s',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('suspends machine', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.suspendMachine('test-app', 'machine-1');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1/suspend',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('sends signal to machine', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.signalMachine('test-app', 'machine-1', { type: 'SIGTERM' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1/signal',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ type: 'SIGTERM' }),
        })
      );
    });
  });

  describe('Machine Monitoring', () => {
    it('gets machine events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          type: 'launch',
          status: 'started',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockEvents),
      } as Response);

      const events = await api.getMachineEvents('test-app', 'machine-1');

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1/events',
        expect.any(Object)
      );
      expect(events).toEqual(mockEvents);
    });

    it('waits for machine state', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await api.waitForMachineState('test-app', 'machine-1', {
        state: 'started',
        timeout: 60
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-1/wait?state=started&timeout=60',
        expect.any(Object)
      );
    });

    it('lists machine processes', async () => {
      const mockProcesses = [
        {
          pid: 1,
          command: '/usr/sbin/nginx',
          cpu_time: '00:00:01',
          directory: '/',
          rss: 4096,
          rtime: '00:00:01',
          stime: '00:00:00',
          vsz: 8192
        }
      ];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockProcesses),
      } as Response);

      const processes = await api.listMachineProcesses('test-app', 'machine-1');

      expect(processes).toEqual(mockProcesses);
    });

    it('executes command on machine', async () => {
      const mockExecResult = {
        exit_code: 0,
        exit_signal: 0,
        stdout: 'Hello World',
        stderr: ''
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockExecResult),
      } as Response);

      const result = await api.execMachine('test-app', 'machine-1', {
        command: ['echo', 'Hello World']
      });

      expect(result).toEqual(mockExecResult);
    });
  });

  describe('Utility Methods', () => {
    it('gets swarm status with aggregated data', async () => {
      const mockMachines = [
        { ...mockMachine, state: 'started', region: 'dfw' },
        { ...mockMachine, id: 'machine-2', state: 'stopped', region: 'ord' },
        { ...mockMachine, id: 'machine-3', state: 'destroyed', region: 'dfw' }
      ];
      const mockVolumes = [
        { id: 'vol-1', name: 'data', size_gb: 10, region: 'dfw', state: 'created', created_at: '2023-12-01T10:00:00Z' }
      ];

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockMachines),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockVolumes),
        } as Response);

      const status = await api.getSwarmStatus('test-app');

      expect(status).toEqual({
        total_machines: 3,
        running_machines: 1,
        stopped_machines: 1,
        failed_machines: 1,
        total_volumes: 1,
        regions: ['dfw', 'ord'],
        machines: mockMachines,
        volumes: mockVolumes
      });
    });

    it('scales swarm up by creating new machines', async () => {
      const currentMachines = [mockMachine];
      const newMachine = { ...mockMachine, id: 'machine-2', name: 'swarm-2' };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(currentMachines),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(newMachine),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as Response);

      const result = await api.scaleSwarm('test-app', 2, mockConfig);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(newMachine);
    });

    it('scales swarm down by stopping machines', async () => {
      const currentMachines = [
        mockMachine,
        { ...mockMachine, id: 'machine-2', name: 'swarm-2' },
        { ...mockMachine, id: 'machine-3', name: 'swarm-3' }
      ];

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(currentMachines),
        } as Response)
        .mockResolvedValue({
          ok: true,
          status: 204,
        } as Response);

      const result = await api.scaleSwarm('test-app', 1, mockConfig);

      expect(result).toHaveLength(2);
      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-2/stop',
        expect.objectContaining({ method: 'POST' })
      );
      expect(fetch).toHaveBeenCalledWith(
        '/api/machines/apps/test-app/machines/machine-3/stop',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('returns empty array when target count equals current count', async () => {
      const currentMachines = [mockMachine];

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(currentMachines),
      } as Response);

      const result = await api.scaleSwarm('test-app', 1, mockConfig);

      expect(result).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('validates machine data against schema', async () => {
      const invalidMachine = { id: 'test', name: 'test' }; // Missing required fields

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([invalidMachine]),
      } as Response);

      await expect(api.listMachines('test-app')).rejects.toThrow();
    });

    it('validates create request against schema', async () => {
      const invalidRequest = { name: 'test' }; // Missing config

      await expect(
        api.createMachine('test-app', invalidRequest as any)
      ).rejects.toThrow();
    });
  });
});