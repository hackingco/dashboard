/**
 * Langfuse WebSocket Real-time Integration Tests
 * Tests WebSocket connections, streaming, and real-time data updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLangfuseRealtime } from '../../lib/hooks/use-langfuse-realtime';
import { renderHook, act } from '@testing-library/react';
import type { LiveTrace, LiveAgent, SwarmMetrics } from '../../lib/langfuse-client';

// Enhanced WebSocket Mock for real-time testing
class EnhancedMockWebSocket extends EventTarget {
  public readyState = WebSocket.CONNECTING;
  public url: string;
  public protocol = '';
  public extensions = '';
  public bufferedAmount = 0;
  public binaryType: BinaryType = 'blob';
  
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  private messageQueue: string[] = [];
  private isManuallyControlled = false;

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    
    // Auto-connect unless manually controlled
    setTimeout(() => {
      if (!this.isManuallyControlled) {
        this.simulateOpen();
      }
    }, 100);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new DOMException('WebSocket is not in OPEN state', 'InvalidStateError');
    }
    this.messageQueue.push(typeof data === 'string' ? data : data.toString());
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === WebSocket.CLOSED || this.readyState === WebSocket.CLOSING) {
      return;
    }
    
    this.readyState = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      const closeEvent = new CloseEvent('close', { code: code || 1000, reason });
      if (this.onclose) this.onclose(closeEvent);
      this.dispatchEvent(closeEvent);
    }, 10);
  }

  // Test utilities
  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    const openEvent = new Event('open');
    if (this.onopen) this.onopen(openEvent);
    this.dispatchEvent(openEvent);
  }

  simulateMessage(data: any): void {
    if (this.readyState !== WebSocket.OPEN) return;
    
    const messageEvent = new MessageEvent('message', {
      data: typeof data === 'string' ? data : JSON.stringify(data)
    });
    if (this.onmessage) this.onmessage(messageEvent);
    this.dispatchEvent(messageEvent);
  }

  simulateError(error?: string): void {
    const errorEvent = new Event('error');
    Object.assign(errorEvent, { message: error || 'WebSocket error' });
    if (this.onerror) this.onerror(errorEvent);
    this.dispatchEvent(errorEvent);
  }

  simulateReconnect(): void {
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => this.simulateOpen(), 50);
  }

  setManualControl(manual: boolean): void {
    this.isManuallyControlled = manual;
  }

  getMessageQueue(): string[] {
    return [...this.messageQueue];
  }

  clearMessageQueue(): void {
    this.messageQueue = [];
  }
}

// Mock constants for WebSocket states
Object.assign(global, {
  WebSocket: EnhancedMockWebSocket,
});

// Add WebSocket constants
Object.assign(EnhancedMockWebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

describe('Langfuse WebSocket Real-time Tests', () => {
  let mockWebSocket: EnhancedMockWebSocket;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Capture the WebSocket instance for testing
    const OriginalWebSocket = global.WebSocket;
    global.WebSocket = vi.fn((url: string, protocols?: string | string[]) => {
      mockWebSocket = new EnhancedMockWebSocket(url, protocols);
      return mockWebSocket;
    }) as any;
    
    // Copy static properties
    Object.assign(global.WebSocket, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });
  });

  afterEach(() => {
    if (mockWebSocket) {
      mockWebSocket.close();
    }
  });

  describe('WebSocket Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Connection should be attempted
      expect(global.WebSocket).toHaveBeenCalled();
      expect(mockWebSocket).toBeDefined();
      expect(mockWebSocket.url).toContain('ws://localhost:3000/ws');
    });

    it('should handle connection events', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle connection errors', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateError('Connection failed');
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle disconnection', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        mockWebSocket.close();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('should support manual reconnection', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        mockWebSocket.close();
        await new Promise(resolve => setTimeout(resolve, 50));
        result.current.reconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should attempt reconnection
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-time Data Streaming', () => {
    it('should receive and process live traces', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false, maxTraces: 10 })
      );

      const mockTrace: LiveTrace = {
        id: 'live-trace-001',
        name: 'Test Live Trace',
        sessionId: 'live-session',
        userId: 'test-user',
        timestamp: new Date(),
        duration: 1500,
        status: 'success',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        totalCost: 0.003,
        input: 'Test input',
        output: 'Test output',
        metadata: { live: true },
        tags: ['live', 'test'],
        level: 'trace',
      };

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        mockWebSocket.simulateMessage({
          type: 'trace_created',
          payload: mockTrace
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.traces).toHaveLength(1);
      expect(result.current.traces[0].id).toBe('live-trace-001');
      expect(result.current.totalTraces).toBe(1);
      expect(result.current.recentActivity).toBeGreaterThan(0);
    });

    it('should receive and process agent updates', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      const mockAgent: LiveAgent = {
        id: 'agent-001',
        name: 'Test Agent',
        status: 'active',
        currentTask: 'Processing data',
        tasksCompleted: 5,
        averageResponseTime: 1200,
        memoryUsage: 45.2,
        cpuUsage: 23.1,
        lastActivity: new Date(),
        swarmId: 'test-swarm',
        metadata: { type: 'worker' },
      };

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        mockWebSocket.simulateMessage({
          type: 'agent_status',
          payload: mockAgent
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].id).toBe('agent-001');
      expect(result.current.agents[0].status).toBe('active');
    });

    it('should receive and process swarm metrics', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      const mockMetrics: SwarmMetrics = {
        totalTraces: 150,
        activeTraces: 12,
        totalAgents: 8,
        activeAgents: 6,
        totalTasks: 200,
        completedTasks: 180,
        failedTasks: 5,
        averageResponseTime: 1350,
        throughput: 25,
        errorRate: 2.5,
        totalCost: 15.42,
        tokenUsage: {
          prompt: 12500,
          completion: 8300,
          total: 20800,
        },
      };

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        mockWebSocket.simulateMessage({
          type: 'swarm_metrics',
          payload: mockMetrics
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.metrics).toBeDefined();
      expect(result.current.metrics!.totalTraces).toBe(150);
      expect(result.current.metrics!.activeAgents).toBe(6);
      expect(result.current.metrics!.errorRate).toBe(2.5);
    });

    it('should handle heartbeat messages', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Send heartbeat
        mockWebSocket.simulateMessage({
          type: 'heartbeat',
          timestamp: Date.now()
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should handle heartbeat without errors
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });

    it('should filter traces by session ID', async () => {
      const sessionId = 'specific-session';
      const { result } = renderHook(() => 
        useLangfuseRealtime({ sessionId, enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Send trace with matching session ID
        mockWebSocket.simulateMessage({
          type: 'trace_created',
          payload: {
            id: 'trace-1',
            name: 'Matching Trace',
            sessionId: sessionId,
            timestamp: new Date(),
            status: 'success',
            model: 'gpt-4',
            promptTokens: 100,
            completionTokens: 50,
            totalCost: 0.001,
            input: 'Test',
            output: 'Test',
          }
        });
        
        // Send trace with different session ID
        mockWebSocket.simulateMessage({
          type: 'trace_created',
          payload: {
            id: 'trace-2',
            name: 'Non-matching Trace',
            sessionId: 'different-session',
            timestamp: new Date(),
            status: 'success',
            model: 'gpt-4',
            promptTokens: 100,
            completionTokens: 50,
            totalCost: 0.001,
            input: 'Test',
            output: 'Test',
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.traces).toHaveLength(1);
      expect(result.current.traces[0].sessionId).toBe(sessionId);
    });

    it('should filter agents by swarm ID', async () => {
      const swarmId = 'specific-swarm';
      const { result } = renderHook(() => 
        useLangfuseRealtime({ swarmId, enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Send agent with matching swarm ID
        mockWebSocket.simulateMessage({
          type: 'agent_status',
          payload: {
            id: 'agent-1',
            name: 'Matching Agent',
            status: 'active',
            swarmId: swarmId,
            currentTask: 'Task 1',
            tasksCompleted: 3,
            averageResponseTime: 1000,
            memoryUsage: 50,
            cpuUsage: 25,
            lastActivity: new Date(),
          }
        });
        
        // Send agent with different swarm ID
        mockWebSocket.simulateMessage({
          type: 'agent_status',
          payload: {
            id: 'agent-2',
            name: 'Non-matching Agent',
            status: 'active',
            swarmId: 'different-swarm',
            currentTask: 'Task 2',
            tasksCompleted: 2,
            averageResponseTime: 1200,
            memoryUsage: 60,
            cpuUsage: 30,
            lastActivity: new Date(),
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.agents).toHaveLength(1);
      expect(result.current.agents[0].swarmId).toBe(swarmId);
    });
  });

  describe('Event Callback System', () => {
    it('should support trace event callbacks', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      let callbackTrace: LiveTrace | null = null;
      let callbackCount = 0;

      await act(async () => {
        const unsubscribe = result.current.onTrace((trace) => {
          callbackTrace = trace;
          callbackCount++;
        });

        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        mockWebSocket.simulateMessage({
          type: 'trace_created',
          payload: {
            id: 'callback-trace',
            name: 'Callback Test',
            sessionId: 'test',
            timestamp: new Date(),
            status: 'success',
            model: 'gpt-4',
            promptTokens: 100,
            completionTokens: 50,
            totalCost: 0.001,
            input: 'Test',
            output: 'Test',
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        unsubscribe();
      });

      expect(callbackCount).toBe(1);
      expect(callbackTrace).toBeDefined();
      expect(callbackTrace!.id).toBe('callback-trace');
    });

    it('should support agent event callbacks', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      let callbackAgent: LiveAgent | null = null;

      await act(async () => {
        const unsubscribe = result.current.onAgent((agent) => {
          callbackAgent = agent;
        });

        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        mockWebSocket.simulateMessage({
          type: 'agent_status',
          payload: {
            id: 'callback-agent',
            name: 'Callback Agent',
            status: 'idle',
            currentTask: null,
            tasksCompleted: 10,
            averageResponseTime: 800,
            memoryUsage: 30,
            cpuUsage: 15,
            lastActivity: new Date(),
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        unsubscribe();
      });

      expect(callbackAgent).toBeDefined();
      expect(callbackAgent!.id).toBe('callback-agent');
      expect(callbackAgent!.status).toBe('idle');
    });

    it('should support metrics event callbacks', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      let callbackMetrics: SwarmMetrics | null = null;

      await act(async () => {
        const unsubscribe = result.current.onMetrics((metrics) => {
          callbackMetrics = metrics;
        });

        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        mockWebSocket.simulateMessage({
          type: 'swarm_metrics',
          payload: {
            totalTraces: 42,
            activeTraces: 3,
            totalAgents: 5,
            activeAgents: 4,
            totalTasks: 50,
            completedTasks: 45,
            failedTasks: 2,
            averageResponseTime: 1100,
            throughput: 15,
            errorRate: 4.0,
            totalCost: 8.75,
            tokenUsage: {
              prompt: 5000,
              completion: 3500,
              total: 8500,
            },
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        unsubscribe();
      });

      expect(callbackMetrics).toBeDefined();
      expect(callbackMetrics!.totalTraces).toBe(42);
      expect(callbackMetrics!.errorRate).toBe(4.0);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid message bursts', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false, maxTraces: 5 })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Send 10 rapid messages
        for (let i = 0; i < 10; i++) {
          mockWebSocket.simulateMessage({
            type: 'trace_created',
            payload: {
              id: `rapid-trace-${i}`,
              name: `Rapid Trace ${i}`,
              sessionId: 'rapid-test',
              timestamp: new Date(),
              status: 'success',
              model: 'gpt-4',
              promptTokens: 100,
              completionTokens: 50,
              totalCost: 0.001,
              input: `Test ${i}`,
              output: `Response ${i}`,
            }
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Should respect maxTraces limit
      expect(result.current.traces.length).toBeLessThanOrEqual(5);
      expect(result.current.recentActivity).toBeGreaterThan(0);
    });

    it('should handle malformed WebSocket messages', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Send malformed JSON
        mockWebSocket.simulateMessage('invalid json {');
        
        // Send valid message after malformed one
        mockWebSocket.simulateMessage({
          type: 'trace_created',
          payload: {
            id: 'valid-trace',
            name: 'Valid Trace',
            sessionId: 'test',
            timestamp: new Date(),
            status: 'success',
            model: 'gpt-4',
            promptTokens: 100,
            completionTokens: 50,
            totalCost: 0.001,
            input: 'Test',
            output: 'Test',
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should handle malformed message gracefully and continue processing
      expect(result.current.traces).toHaveLength(1);
      expect(result.current.traces[0].id).toBe('valid-trace');
      
      consoleSpy.mockRestore();
    });

    it('should handle WebSocket reconnection', async () => {
      const { result } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        // Initial connection
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(result.current.isConnected).toBe(true);
        
        // Simulate disconnect
        mockWebSocket.close();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(result.current.isConnected).toBe(false);
        
        // Simulate reconnection
        result.current.reconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should attempt reconnection
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should clean up properly on unmount', async () => {
      const { result, unmount } = renderHook(() => 
        useLangfuseRealtime({ enableAutoRefresh: false })
      );

      await act(async () => {
        mockWebSocket.simulateOpen();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.isConnected).toBe(true);

      // Unmount should clean up connections
      unmount();

      // WebSocket should be closed
      expect(mockWebSocket.readyState).toBe(WebSocket.CLOSED);
    });
  });
});