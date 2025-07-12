// WebSocket message types for the dashboard UI

export interface WebSocketConnectionData {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  maxAttemptsReached?: boolean;
  error?: any;
}

export interface WebSocketSwarmData {
  swarmId: string;
  status: string;
  data?: {
    targetCount?: number;
    currentCount?: number;
    agents?: Array<{
      id: string;
      type: string;
      status: string;
      capabilities?: string[];
    }>;
    metrics?: {
      runningMachines: number;
      totalMachines: number;
      cpuUsage: number;
      memoryUsage: number;
      networkIn: number;
      networkOut: number;
    };
    error?: string;
  };
}

export interface WebSocketMachineData {
  swarmId?: string;
  machineId: string;
  appName?: string;
  status: string;
  data?: {
    id: string;
    appName: string;
    timestamp: string;
    cpus?: number;
    memory?: number;
    region?: string;
    privateIp?: string;
  };
}

export interface WebSocketMetricsData {
  metrics: {
    swarmId?: string;
    cpuUsage?: number;
    memoryUsage?: number;
    networkIn?: number;
    networkOut?: number;
    runningMachines?: number;
    totalMachines?: number;
  };
}

export interface WebSocketAlertData {
  message: string;
  severity?: 'info' | 'warning' | 'error';
  level?: 'info' | 'warning' | 'error';
}

export interface WebSocketOperationData {
  type: 'scale' | 'launch' | 'status';
  messageId?: string;
  status: 'starting' | 'completed' | 'error';
  targetCount?: number;
  currentCount?: number;
  error?: string;
}

// Transformation utilities
export class WebSocketDataTransformer {
  /**
   * Transform agent-based swarm updates to machine-based format for UI compatibility
   */
  static transformSwarmUpdate(data: WebSocketSwarmData): WebSocketSwarmData {
    const { swarmId, status, data: updateData } = data;
    
    // If this is an enhanced swarm with agent data, transform to machine metrics
    if (updateData?.agents) {
      const agentCount = updateData.agents.length;
      const activeAgents = updateData.agents.filter(a => 
        a.status === 'active' || a.status === 'busy'
      ).length;
      
      return {
        swarmId,
        status,
        data: {
          ...updateData,
          // Map agents to machine-like metrics for UI compatibility
          metrics: {
            runningMachines: activeAgents,
            totalMachines: agentCount,
            cpuUsage: activeAgents > 0 ? (activeAgents / agentCount) * 80 : 0,
            memoryUsage: activeAgents > 0 ? (activeAgents / agentCount) * 70 : 0,
            networkIn: activeAgents * 1024,
            networkOut: activeAgents * 2048
          }
        }
      };
    }
    
    return data;
  }

  /**
   * Transform machine updates from Fly.io API to UI format
   */
  static transformMachineUpdate(data: WebSocketMachineData): WebSocketMachineData {
    const { machineId, status, appName, data: machineData } = data;
    
    return {
      ...data,
      // Ensure consistent machine status mapping
      status: WebSocketDataTransformer.mapMachineStatus(status),
      data: {
        id: machineId,
        appName: appName || 'unknown',
        timestamp: new Date().toISOString(),
        ...machineData
      }
    };
  }

  /**
   * Map various machine status formats to consistent UI states
   */
  static mapMachineStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'created': 'stopped',
      'started': 'running', 
      'stopped': 'stopped',
      'destroyed': 'destroyed',
      'scaling': 'scaling',
      'active': 'running',
      'inactive': 'stopped'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Map enhanced swarm status to UI-expected status values
   */
  static mapSwarmStatus(status: string): 'active' | 'inactive' | 'scaling' | 'stopped' | 'error' {
    const statusMap: Record<string, 'active' | 'inactive' | 'scaling' | 'stopped' | 'error'> = {
      'running': 'active',
      'initializing': 'scaling',
      'scaling': 'scaling',
      'stopped': 'stopped',
      'error': 'error',
      'inactive': 'inactive'
    };
    
    return statusMap[status] || 'inactive';
  }
}