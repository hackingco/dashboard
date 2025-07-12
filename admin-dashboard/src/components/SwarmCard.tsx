import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { SwarmScaleControl } from './SwarmScaleControl';
import wsClient from '../services/websocket';

interface SwarmCardProps {
  swarm: {
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'scaling' | 'stopped' | 'error';
    description?: string;
    flyAppName?: string;
    region: string;
    config: {
      workerCount: number;
      machineType: string;
      strategy: string;
      autoScale: boolean;
    };
    metrics: {
      runningMachines: number;
      totalMachines: number;
      cpuUsage: number;
      memoryUsage: number;
      networkIn: number;
      networkOut: number;
    };
    agents?: Array<{
      id: string;
      type: string;
      status: string;
      capabilities: string[];
    }>;
    created_at: string;
    updated_at: string;
  };
  onRefresh?: () => void;
}

export const SwarmCard: React.FC<SwarmCardProps> = ({ swarm, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [realTimeMetrics, setRealTimeMetrics] = useState(swarm.metrics);
  const [currentAgentCount, setCurrentAgentCount] = useState(swarm.agents?.length || swarm.config.workerCount);
  const [swarmStatus, setSwarmStatus] = useState(swarm.status);

  useEffect(() => {
    // Subscribe to real-time updates for this swarm
    const unsubscribe = wsClient.subscribe('swarm', (data) => {
      if (data.swarmId === swarm.id) {
        console.log('Real-time swarm update:', data);
        
        if (data.status) {
          setSwarmStatus(data.status);
        }
        
        if (data.data?.currentCount !== undefined) {
          setCurrentAgentCount(data.data.currentCount);
        }
        
        if (data.data?.metrics) {
          setRealTimeMetrics(prev => ({ ...prev, ...data.data.metrics }));
        }
      }
    });

    const unsubscribeMetrics = wsClient.subscribe('metrics', (data) => {
      if (data.metrics?.swarmId === swarm.id) {
        setRealTimeMetrics(prev => ({ ...prev, ...data.metrics }));
      }
    });

    // Subscribe to machine-level updates
    const unsubscribeMachine = wsClient.subscribe('machine', (data) => {
      if (data.swarmId === swarm.id && data.machineStatus) {
        console.log('Machine status update:', data);
        // Update running/total machine counts based on machine status
        if (data.machineStatus === 'started' || data.machineStatus === 'stopped') {
          // Trigger a refresh to get updated counts
          onRefresh?.();
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeMetrics();
      unsubscribeMachine();
    };
  }, [swarm.id, onRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'scaling':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'stopped':
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'running':
        return '🟢';
      case 'scaling':
        return '🟡';
      case 'stopped':
      case 'inactive':
        return '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleLaunch = async () => {
    if (!swarm.flyAppName) {
      try {
        await wsClient.launchSwarm({
          id: swarm.id,
          name: swarm.name,
          region: swarm.region,
          cpus: 1,
          memory: 256
        });
      } catch (error) {
        console.error('Failed to launch swarm:', error);
      }
    }
  };

  const handleScaleComplete = (newCount: number) => {
    setCurrentAgentCount(newCount);
    onRefresh?.();
  };

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{swarm.name}</h3>
              <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(swarmStatus)}`}>
                {getStatusIcon(swarmStatus)} {swarmStatus}
              </span>
            </div>
            {swarm.description && (
              <p className="text-sm text-gray-600 mt-1">{swarm.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Less' : 'More'}
          </Button>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Agents</div>
            <div className="font-semibold">{currentAgentCount}</div>
          </div>
          <div>
            <div className="text-gray-600">Region</div>
            <div className="font-semibold">{swarm.region}</div>
          </div>
          <div>
            <div className="text-gray-600">CPU Usage</div>
            <div className="font-semibold">{realTimeMetrics.cpuUsage.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-gray-600">Memory</div>
            <div className="font-semibold">{realTimeMetrics.memoryUsage.toFixed(1)}%</div>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="space-y-4 border-t pt-4">
            {/* Scale Control */}
            <SwarmScaleControl
              swarmId={swarm.id}
              currentCount={currentAgentCount}
              maxCount={20}
              onScaleComplete={handleScaleComplete}
            />

            {/* Detailed Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-600">Running Machines</div>
                <div className="text-lg font-bold text-green-600">
                  {realTimeMetrics.runningMachines}/{realTimeMetrics.totalMachines}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-600">Network In</div>
                <div className="text-lg font-bold text-blue-600">
                  {formatBytes(realTimeMetrics.networkIn)}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-gray-600">Network Out</div>
                <div className="text-lg font-bold text-purple-600">
                  {formatBytes(realTimeMetrics.networkOut)}
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-2">
              <h4 className="font-semibold">Configuration</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Machine Type:</span> {swarm.config.machineType}</div>
                <div><span className="text-gray-600">Strategy:</span> {swarm.config.strategy}</div>
                <div><span className="text-gray-600">Auto Scale:</span> {swarm.config.autoScale ? 'Enabled' : 'Disabled'}</div>
                {swarm.flyAppName && (
                  <div><span className="text-gray-600">Fly App:</span> {swarm.flyAppName}</div>
                )}
              </div>
            </div>

            {/* Agents */}
            {swarm.agents && swarm.agents.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Agents ({swarm.agents.length})</h4>
                <div className="grid gap-2">
                  {swarm.agents.slice(0, 5).map((agent) => (
                    <div key={agent.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                      <div>
                        <span className="font-medium">{agent.type}</span>
                        <span className={`ml-2 px-1 py-0.5 rounded text-xs ${getStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        {agent.capabilities.slice(0, 2).join(', ')}
                        {agent.capabilities.length > 2 && ` +${agent.capabilities.length - 2}`}
                      </div>
                    </div>
                  ))}
                  {swarm.agents.length > 5 && (
                    <div className="text-sm text-gray-600 text-center">
                      +{swarm.agents.length - 5} more agents
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Health Status Indicators */}
            <div className="space-y-2">
              <h4 className="font-semibold">Health Status</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                  <span className={realTimeMetrics.cpuUsage > 80 ? 'text-red-600' : realTimeMetrics.cpuUsage > 60 ? 'text-yellow-600' : 'text-green-600'}>
                    {realTimeMetrics.cpuUsage > 80 ? '⚠️' : '✅'}
                  </span>
                  <span>CPU Health</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                  <span className={realTimeMetrics.memoryUsage > 85 ? 'text-red-600' : realTimeMetrics.memoryUsage > 70 ? 'text-yellow-600' : 'text-green-600'}>
                    {realTimeMetrics.memoryUsage > 85 ? '⚠️' : '✅'}
                  </span>
                  <span>Memory Health</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                  <span className={swarmStatus === 'error' ? 'text-red-600' : swarmStatus === 'active' ? 'text-green-600' : 'text-yellow-600'}>
                    {swarmStatus === 'error' ? '❌' : swarmStatus === 'active' ? '✅' : '⚠️'}
                  </span>
                  <span>System Health</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              {!swarm.flyAppName && (
                <Button
                  onClick={handleLaunch}
                  variant="outline"
                  size="sm"
                  disabled={swarmStatus === 'scaling'}
                >
                  🚀 Launch on Fly.io
                </Button>
              )}
              {swarm.flyAppName && (
                <>
                  <Button
                    onClick={() => window.open(`https://fly.io/apps/${swarm.flyAppName}`, '_blank')}
                    variant="outline"
                    size="sm"
                  >
                    📊 Fly Dashboard
                  </Button>
                  <Button
                    onClick={() => window.open(`https://fly.io/apps/${swarm.flyAppName}/monitoring`, '_blank')}
                    variant="outline"
                    size="sm"
                  >
                    📝 Logs
                  </Button>
                </>
              )}
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
              >
                🔄 Refresh
              </Button>
            </div>

            {/* Timestamps */}
            <div className="text-xs text-gray-500 space-y-1">
              <div>Created: {formatDate(swarm.created_at)}</div>
              <div>Updated: {formatDate(swarm.updated_at)}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};