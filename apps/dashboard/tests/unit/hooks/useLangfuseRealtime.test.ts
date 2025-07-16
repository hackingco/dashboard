import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLangfuseRealtime, useTraceMonitor, useAgentMonitor } from '../../../lib/hooks/use-langfuse-realtime';

// Mock langfuse-client
const mockLangfuseClient = {
  on: vi.fn(),
  off: vi.fn(),
  isRealtimeConnected: vi.fn(),
  reconnect: vi.fn(),
  disconnect: vi.fn(),
  getTraces: vi.fn(),
  getSwarmMetrics: vi.fn(),
  createTrace: vi.fn(),
  emit: vi.fn(),
};

vi.mock('../../../lib/langfuse-client', () => ({
  langfuseClient: mockLangfuseClient,
  LiveTrace: {},
  LiveAgent: {},
  SwarmMetrics: {},
}));

const mockTrace = {
  id: 'trace-1',
  name: 'Test Trace',
  sessionId: 'session-1',
  userId: 'user-1',
  timestamp: new Date('2024-01-01T10:00:00Z'),
  duration: 1500,
  status: 'success' as const,
  model: 'gpt-4',
  promptTokens: 100,
  completionTokens: 50,
  totalCost: 0.003,
  input: 'Test input',
  output: 'Test output',
  metadata: { agentId: 'agent-1' },
  tags: ['test'],
  scores: { quality: 0.95 },
  memoryUsage: 256,
  cpuUsage: 45,
  agentId: 'agent-1',
  swarmId: 'swarm-1',
};

const mockAgent = {
  id: 'agent-1',
  name: 'Test Agent',
  status: 'active' as const,
  currentTask: 'Processing',
  tasksCompleted: 25,
  averageResponseTime: 800,
  memoryUsage: 65,
  cpuUsage: 35,
  lastActivity: new Date('2024-01-01T10:00:00Z'),
  swarmId: 'swarm-1',
};

const mockMetrics = {
  totalTraces: 100,
  activeTraces: 5,
  totalAgents: 8,
  activeAgents: 6,
  totalTasks: 150,
  completedTasks: 140,
  failedTasks: 5,
  averageResponseTime: 1200,
  throughput: 25,
  errorRate: 3.3,
  totalCost: 0.45,
  tokenUsage: {
    prompt: 5000,
    completion: 3000,
    total: 8000,
  },
};

describe('useLangfuseRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default mock returns
    mockLangfuseClient.isRealtimeConnected.mockReturnValue(true);
    mockLangfuseClient.getTraces.mockResolvedValue([mockTrace]);
    mockLangfuseClient.getSwarmMetrics.mockResolvedValue(mockMetrics);
    mockLangfuseClient.createTrace.mockResolvedValue('trace-id');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Hook Initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isInitializing).toBe(true);
      expect(result.current.error).toBe(null);
      expect(result.current.traces).toEqual([]);
      expect(result.current.agents).toEqual([]);
      expect(result.current.metrics).toBe(null);
    });

    it('initializes with custom options', () => {
      const options = {
        sessionId: 'custom-session',
        swarmId: 'custom-swarm',
        maxTraces: 50,
        enableAutoRefresh: false,
        refreshInterval: 3000,
      };

      const { result } = renderHook(() => useLangfuseRealtime(options));
      
      expect(result.current.isInitializing).toBe(true);
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('trace', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('agent', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('metrics', expect.any(Function));
    });

    it('sets up event listeners on mount', () => {
      renderHook(() => useLangfuseRealtime());
      
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('trace', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('agent', expect.any(Function));
      expect(mockLangfuseClient.on).toHaveBeenCalledWith('metrics', expect.any(Function));
    });

    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useLangfuseRealtime());
      
      unmount();
      
      expect(mockLangfuseClient.off).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockLangfuseClient.off).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockLangfuseClient.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockLangfuseClient.off).toHaveBeenCalledWith('trace', expect.any(Function));
      expect(mockLangfuseClient.off).toHaveBeenCalledWith('agent', expect.any(Function));
      expect(mockLangfuseClient.off).toHaveBeenCalledWith('metrics', expect.any(Function));
    });
  });

  describe('Connection Management', () => {
    it('handles connected event', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      // Simulate connected event
      const connectedHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'connected'
      )?.[1];
      
      if (connectedHandler) {
        act(() => {
          connectedHandler();
        });
        
        expect(result.current.isConnected).toBe(true);
        expect(result.current.error).toBe(null);
        expect(result.current.isInitializing).toBe(false);
      }
    });

    it('handles disconnected event', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      // Simulate disconnected event
      const disconnectedHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'disconnected'
      )?.[1];
      
      if (disconnectedHandler) {
        act(() => {
          disconnectedHandler();
        });
        
        expect(result.current.isConnected).toBe(false);
      }
    });

    it('handles error event', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const errorHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorHandler) {
        act(() => {
          errorHandler(new Error('Connection failed'));
        });
        
        expect(result.current.error).toBe('Connection failed');
        expect(result.current.isInitializing).toBe(false);
      }
    });

    it('provides connect function', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      act(() => {
        result.current.connect();
      });
      
      expect(mockLangfuseClient.reconnect).toHaveBeenCalled();
    });

    it('provides disconnect function', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      act(() => {
        result.current.disconnect();
      });
      
      expect(mockLangfuseClient.disconnect).toHaveBeenCalled();
    });

    it('provides reconnect function', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      act(() => {
        result.current.reconnect();
      });
      
      expect(mockLangfuseClient.reconnect).toHaveBeenCalled();
    });
  });

  describe('Data Management', () => {
    it('handles trace events with filtering', () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ sessionId: 'session-1', swarmId: 'swarm-1' })
      );
      
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        act(() => {
          // Should accept trace with matching sessionId and swarmId
          traceHandler(mockTrace);
        });
        
        expect(result.current.traces).toContain(mockTrace);
        expect(result.current.recentActivity).toBeGreaterThan(0);
      }
    });

    it('filters traces by sessionId', () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ sessionId: 'different-session' })
      );
      
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        act(() => {
          traceHandler(mockTrace); // sessionId: 'session-1'
        });
        
        // Should not add trace with different sessionId
        expect(result.current.traces).not.toContain(mockTrace);
      }
    });

    it('filters traces by swarmId', () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ swarmId: 'different-swarm' })
      );
      
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        act(() => {
          traceHandler(mockTrace); // swarmId: 'swarm-1'
        });
        
        // Should not add trace with different swarmId
        expect(result.current.traces).not.toContain(mockTrace);
      }
    });

    it('limits traces to maxTraces', () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ maxTraces: 2 })
      );
      
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        const traces = [
          { ...mockTrace, id: 'trace-1' },
          { ...mockTrace, id: 'trace-2' },
          { ...mockTrace, id: 'trace-3' },
        ];
        
        act(() => {
          traces.forEach(trace => traceHandler(trace));
        });
        
        expect(result.current.traces).toHaveLength(2);
        // Should keep the most recent traces
        expect(result.current.traces[0].id).toBe('trace-3');
        expect(result.current.traces[1].id).toBe('trace-2');
      }
    });

    it('handles agent events with filtering', () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ swarmId: 'swarm-1' })
      );
      
      const agentHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'agent'
      )?.[1];
      
      if (agentHandler) {
        act(() => {
          agentHandler(mockAgent);
        });
        
        expect(result.current.agents).toContain(mockAgent);
      }
    });

    it('handles metrics events', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const metricsHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'metrics'
      )?.[1];
      
      if (metricsHandler) {
        act(() => {
          metricsHandler(mockMetrics);
        });
        
        expect(result.current.metrics).toEqual(mockMetrics);
      }
    });

    it('provides clearTraces function', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      // Add some traces first
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        act(() => {
          traceHandler(mockTrace);
        });
        
        expect(result.current.traces).toContain(mockTrace);
        
        act(() => {
          result.current.clearTraces();
        });
        
        expect(result.current.traces).toEqual([]);
        expect(result.current.recentActivity).toBe(0);
      }
    });
  });

  describe('Auto-refresh Functionality', () => {
    it('performs auto-refresh when enabled', async () => {
      renderHook(() => 
        useLangfuseRealtime({ 
          enableAutoRefresh: true, 
          refreshInterval: 1000 
        })
      );
      
      // Fast-forward past the refresh interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      await waitFor(() => {
        expect(mockLangfuseClient.getTraces).toHaveBeenCalled();
        expect(mockLangfuseClient.getSwarmMetrics).toHaveBeenCalled();
      });
    });

    it('does not auto-refresh when disabled', () => {
      renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );
      
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      // Should not call refresh functions
      expect(mockLangfuseClient.getTraces).not.toHaveBeenCalled();
    });

    it('provides manual refresh function', async () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      await act(async () => {
        await result.current.refresh();
      });
      
      expect(mockLangfuseClient.getTraces).toHaveBeenCalled();
      expect(mockLangfuseClient.getSwarmMetrics).toHaveBeenCalled();
    });

    it('handles refresh errors gracefully', async () => {
      mockLangfuseClient.getTraces.mockRejectedValue(new Error('Fetch failed'));
      
      const { result } = renderHook(() => useLangfuseRealtime());
      
      await act(async () => {
        await result.current.refresh();
      });
      
      expect(result.current.error).toBe('Fetch failed');
    });
  });

  describe('Trace Creation', () => {
    it('creates traces successfully', async () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const partialTrace = {
        name: 'New Trace',
        input: 'Test input',
        output: 'Test output',
      };
      
      let traceId: string | null = null;
      await act(async () => {
        traceId = await result.current.createTrace(partialTrace);
      });
      
      expect(traceId).toBe('trace-id');
      expect(mockLangfuseClient.createTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          ...partialTrace,
          timestamp: expect.any(Date),
        })
      );
    });

    it('handles trace creation errors', async () => {
      mockLangfuseClient.createTrace.mockRejectedValue(new Error('Create failed'));
      
      const { result } = renderHook(() => useLangfuseRealtime());
      
      let traceId: string | null = null;
      await act(async () => {
        traceId = await result.current.createTrace({ name: 'Test' });
      });
      
      expect(traceId).toBe(null);
      expect(result.current.error).toBe('Create failed');
    });
  });

  describe('Event Subscription', () => {
    it('allows subscribing to trace events', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const callback = vi.fn();
      let unsubscribe: () => void;
      
      act(() => {
        unsubscribe = result.current.onTrace(callback);
      });
      
      // Simulate trace event
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        act(() => {
          traceHandler(mockTrace);
        });
        
        expect(callback).toHaveBeenCalledWith(mockTrace);
        
        // Test unsubscribe
        act(() => {
          unsubscribe();
        });
        
        callback.mockClear();
        
        act(() => {
          traceHandler(mockTrace);
        });
        
        expect(callback).not.toHaveBeenCalled();
      }
    });

    it('allows subscribing to agent events', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const callback = vi.fn();
      
      act(() => {
        result.current.onAgent(callback);
      });
      
      const agentHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'agent'
      )?.[1];
      
      if (agentHandler) {
        act(() => {
          agentHandler(mockAgent);
        });
        
        expect(callback).toHaveBeenCalledWith(mockAgent);
      }
    });

    it('allows subscribing to metrics events', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const callback = vi.fn();
      
      act(() => {
        result.current.onMetrics(callback);
      });
      
      const metricsHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'metrics'
      )?.[1];
      
      if (metricsHandler) {
        act(() => {
          metricsHandler(mockMetrics);
        });
        
        expect(callback).toHaveBeenCalledWith(mockMetrics);
      }
    });
  });

  describe('Computed Values', () => {
    it('calculates total traces correctly', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        act(() => {
          traceHandler(mockTrace);
          traceHandler({ ...mockTrace, id: 'trace-2' });
        });
        
        expect(result.current.totalTraces).toBe(2);
      }
    });

    it('calculates active traces correctly', () => {
      const { result } = renderHook(() => useLangfuseRealtime());
      
      const traceHandler = mockLangfuseClient.on.mock.calls.find(
        call => call[0] === 'trace'
      )?.[1];
      
      if (traceHandler) {
        act(() => {
          // Add running trace
          traceHandler({ ...mockTrace, id: 'trace-1', status: 'running' });
          // Add old pending trace (should not count as active)
          traceHandler({ 
            ...mockTrace, 
            id: 'trace-2', 
            status: 'pending',
            timestamp: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
          });
          // Add recent pending trace (should count as active)
          traceHandler({ 
            ...mockTrace, 
            id: 'trace-3', 
            status: 'pending',
            timestamp: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
          });
        });
        
        expect(result.current.activeTraces).toBe(2); // running + recent pending
      }
    });
  });
});

describe('useTraceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLangfuseClient.isRealtimeConnected.mockReturnValue(true);
  });

  it('returns latest trace and count', () => {
    const { result } = renderHook(() => useTraceMonitor('session-1'));
    
    const traceHandler = mockLangfuseClient.on.mock.calls.find(
      call => call[0] === 'trace'
    )?.[1];
    
    if (traceHandler) {
      act(() => {
        traceHandler(mockTrace);
      });
      
      expect(result.current.latestTrace).toEqual(mockTrace);
      expect(result.current.traceCount).toBe(1);
      expect(result.current.isConnected).toBe(true);
    }
  });

  it('limits returned traces to 10', () => {
    const { result } = renderHook(() => useTraceMonitor());
    
    const traceHandler = mockLangfuseClient.on.mock.calls.find(
      call => call[0] === 'trace'
    )?.[1];
    
    if (traceHandler) {
      // Add 15 traces
      act(() => {
        for (let i = 0; i < 15; i++) {
          traceHandler({ ...mockTrace, id: `trace-${i}` });
        }
      });
      
      expect(result.current.traces).toHaveLength(10);
    }
  });
});

describe('useAgentMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLangfuseClient.isRealtimeConnected.mockReturnValue(true);
  });

  it('categorizes agents by status', () => {
    const { result } = renderHook(() => useAgentMonitor('swarm-1'));
    
    const agentHandler = mockLangfuseClient.on.mock.calls.find(
      call => call[0] === 'agent'
    )?.[1];
    
    if (agentHandler) {
      act(() => {
        agentHandler({ ...mockAgent, id: 'agent-1', status: 'active' });
        agentHandler({ ...mockAgent, id: 'agent-2', status: 'idle' });
        agentHandler({ ...mockAgent, id: 'agent-3', status: 'error' });
        agentHandler({ ...mockAgent, id: 'agent-4', status: 'active' });
      });
      
      expect(result.current.activeAgents).toHaveLength(2);
      expect(result.current.idleAgents).toHaveLength(1);
      expect(result.current.errorAgents).toHaveLength(1);
      expect(result.current.totalAgents).toBe(4);
      expect(result.current.isConnected).toBe(true);
    }
  });
});