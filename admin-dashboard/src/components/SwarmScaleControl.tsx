import React, { useState, useEffect } from 'react';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { Card } from './ui/card';
import wsClient from '../services/websocket';

interface SwarmScaleControlProps {
  swarmId: string;
  currentCount: number;
  maxCount?: number;
  onScaleComplete?: (newCount: number) => void;
  className?: string;
}

export const SwarmScaleControl: React.FC<SwarmScaleControlProps> = ({
  swarmId,
  currentCount,
  maxCount = 20,
  onScaleComplete,
  className,
}) => {
  const [targetCount, setTargetCount] = useState(currentCount);
  const [isScaling, setIsScaling] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState(wsClient.getConnectionStatus());

  useEffect(() => {
    setTargetCount(currentCount);
  }, [currentCount]);

  useEffect(() => {
    // Subscribe to WebSocket events
    const unsubscribeSwarm = wsClient.subscribe('swarm', (data) => {
      if (data.swarmId === swarmId) {
        console.log('Swarm update received:', data);
        
        switch (data.status) {
          case 'scaling':
            setIsScaling(true);
            setStatus(`Scaling to ${data.targetCount} agents...`);
            break;
          case 'scaled':
            setIsScaling(false);
            setStatus(`Successfully scaled to ${data.currentCount} agents`);
            setTargetCount(data.currentCount);
            onScaleComplete?.(data.currentCount);
            // Clear status after 3 seconds
            setTimeout(() => setStatus(''), 3000);
            break;
          case 'error':
            setIsScaling(false);
            setStatus(`Scaling failed: ${data.error}`);
            setTimeout(() => setStatus(''), 5000);
            break;
          default:
            if (data.status) {
              setStatus(`Status: ${data.status}`);
            }
        }
      }
    });

    const unsubscribeConnection = wsClient.subscribe('connection', (data) => {
      setConnectionStatus(data.status);
    });

    const unsubscribeOperation = wsClient.subscribe('operation', (data) => {
      if (data.type === 'scale') {
        console.log('Scale operation response:', data);
        
        switch (data.status) {
          case 'starting':
            setIsScaling(true);
            setStatus(`Initiating scale to ${data.targetCount}...`);
            break;
          case 'completed':
            setIsScaling(false);
            setStatus(`Scale completed: ${data.currentCount} agents`);
            setTargetCount(data.currentCount);
            onScaleComplete?.(data.currentCount);
            setTimeout(() => setStatus(''), 3000);
            break;
          case 'error':
            setIsScaling(false);
            setStatus(`Scale failed: ${data.error}`);
            setTimeout(() => setStatus(''), 5000);
            break;
        }
      }
    });

    return () => {
      unsubscribeSwarm();
      unsubscribeConnection();
      unsubscribeOperation();
    };
  }, [swarmId, onScaleComplete]);

  const handleScale = async () => {
    if (targetCount === currentCount || isScaling) return;

    try {
      setIsScaling(true);
      setStatus(`Requesting scale to ${targetCount} agents...`);
      
      await wsClient.scaleSwarm(swarmId, targetCount);
      
      // The actual status updates will come through WebSocket subscription
    } catch (error) {
      console.error('Scale request failed:', error);
      setIsScaling(false);
      setStatus(`Scale request failed: ${error.message}`);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'disconnected':
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '●';
      case 'connecting':
        return '◐';
      case 'disconnected':
      case 'error':
        return '○';
      default:
        return '?';
    }
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Scale Swarm</h3>
          <div className={`text-xs flex items-center gap-1 ${getConnectionStatusColor()}`}>
            <span>{getConnectionStatusIcon()}</span>
            <span className="capitalize">{connectionStatus}</span>
          </div>
        </div>

        {/* Current vs Target */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-gray-600">Current</div>
            <div className="text-2xl font-bold text-blue-600">{currentCount}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="text-gray-600">Target</div>
            <div className="text-2xl font-bold text-green-600">{targetCount}</div>
          </div>
        </div>

        {/* Scale Slider */}
        <div className="space-y-2">
          <Slider
            value={targetCount}
            onChange={setTargetCount}
            min={0}
            max={maxCount}
            step={1}
            disabled={isScaling || connectionStatus !== 'connected'}
            label="Target Agent Count"
            showValue={true}
          />
        </div>

        {/* Quick Scale Buttons */}
        <div className="flex gap-2 flex-wrap">
          {[0, 1, 2, 5, 10].map((count) => (
            <Button
              key={count}
              variant={targetCount === count ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTargetCount(count)}
              disabled={isScaling || connectionStatus !== 'connected'}
              className="text-xs"
            >
              {count}
            </Button>
          ))}
        </div>

        {/* Action Button */}
        <Button
          onClick={handleScale}
          disabled={
            targetCount === currentCount || 
            isScaling || 
            connectionStatus !== 'connected'
          }
          className="w-full"
          variant={targetCount === currentCount ? 'outline' : 'default'}
        >
          {isScaling ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Scaling...
            </div>
          ) : targetCount === currentCount ? (
            'No Change'
          ) : targetCount > currentCount ? (
            `Scale Up to ${targetCount}`
          ) : (
            `Scale Down to ${targetCount}`
          )}
        </Button>

        {/* Status Message */}
        {status && (
          <div className={`text-sm p-2 rounded ${
            status.includes('failed') || status.includes('error') 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : status.includes('Successfully') || status.includes('completed')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {status}
          </div>
        )}

        {/* Connection Warning */}
        {connectionStatus !== 'connected' && (
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
            Real-time scaling requires WebSocket connection. 
            {connectionStatus === 'connecting' && ' Connecting...'}
            {connectionStatus === 'disconnected' && ' Disconnected from server.'}
            {connectionStatus === 'error' && ' Connection error.'}
          </div>
        )}
      </div>
    </Card>
  );
};