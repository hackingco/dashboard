'use client'

import React, { useState } from 'react'
import { Plus, Minus, Zap, Activity, Target, TrendingUp, TrendingDown, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface SwarmScalingData {
  swarmId: string
  name: string
  currentAgents: number
  minAgents: number
  maxAgents: number
  targetAgents: number
  autoScalingEnabled: boolean
  scaleUpThreshold: number
  scaleDownThreshold: number
  currentLoad: number
  pendingScaling: boolean
  scalingHistory: ScalingEvent[]
  metrics: {
    cpu: number
    memory: number
    tasks: {
      active: number
      completed: number
      failed: number
      queued: number
    }
    throughput: number
    responseTime: number
  }
}

interface ScalingEvent {
  timestamp: string
  action: 'scale_up' | 'scale_down' | 'manual_scale' | 'auto_scale'
  fromAgents: number
  toAgents: number
  reason: string
  success: boolean
}

interface SwarmScalingControlsProps {
  swarm: SwarmScalingData
  onScaleUp: (swarmId: string, count: number) => void
  onScaleDown: (swarmId: string, count: number) => void
  onToggleAutoScaling: (swarmId: string, enabled: boolean) => void
  onUpdateScalingThresholds: (swarmId: string, upThreshold: number, downThreshold: number) => void
  onSetTargetAgents: (swarmId: string, target: number) => void
  onForceRebalance: (swarmId: string) => void
}

export const SwarmScalingControls: React.FC<SwarmScalingControlsProps> = ({
  swarm,
  onScaleUp,
  onScaleDown,
  onToggleAutoScaling,
  onUpdateScalingThresholds,
  onSetTargetAgents,
  onForceRebalance
}) => {
  const [scaleAmount, setScaleAmount] = useState(1)
  const [targetAgents, setTargetAgents] = useState(swarm.targetAgents)
  const [upThreshold, setUpThreshold] = useState(swarm.scaleUpThreshold)
  const [downThreshold, setDownThreshold] = useState(swarm.scaleDownThreshold)

  const getLoadColor = (load: number) => {
    if (load >= 80) return 'text-red-600'
    if (load >= 60) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getScalingRecommendation = () => {
    const { currentLoad, currentAgents, minAgents, maxAgents } = swarm
    
    if (currentLoad >= swarm.scaleUpThreshold && currentAgents < maxAgents) {
      return {
        action: 'scale_up',
        reason: `High load (${currentLoad}%) - Recommend scaling up`,
        color: 'text-orange-600'
      }
    }
    
    if (currentLoad <= swarm.scaleDownThreshold && currentAgents > minAgents) {
      return {
        action: 'scale_down',
        reason: `Low load (${currentLoad}%) - Recommend scaling down`,
        color: 'text-blue-600'
      }
    }
    
    return {
      action: 'optimal',
      reason: 'Current scaling is optimal',
      color: 'text-green-600'
    }
  }

  const recommendation = getScalingRecommendation()

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Scaling Status - {swarm.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{swarm.currentAgents}</div>
              <div className="text-sm text-gray-600">Current Agents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{swarm.targetAgents}</div>
              <div className="text-sm text-gray-600">Target Agents</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getLoadColor(swarm.currentLoad)}`}>
                {swarm.currentLoad}%
              </div>
              <div className="text-sm text-gray-600">Current Load</div>
            </div>
            <div className="text-center">
              <Badge variant={swarm.autoScalingEnabled ? 'default' : 'outline'}>
                {swarm.autoScalingEnabled ? 'Auto-Scaling ON' : 'Auto-Scaling OFF'}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Current Load</span>
                <span>{swarm.currentLoad}%</span>
              </div>
              <Progress value={swarm.currentLoad} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Scale Down ≤ {swarm.scaleDownThreshold}%</span>
                <span>Scale Up ≥ {swarm.scaleUpThreshold}%</span>
              </div>
            </div>

            <div className={`p-3 rounded-lg bg-gray-50 ${recommendation.color}`}>
              <div className="flex items-center">
                {recommendation.action === 'scale_up' && <TrendingUp className="w-4 h-4 mr-2" />}
                {recommendation.action === 'scale_down' && <TrendingDown className="w-4 h-4 mr-2" />}
                {recommendation.action === 'optimal' && <Target className="w-4 h-4 mr-2" />}
                <span className="text-sm font-medium">{recommendation.reason}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Scaling Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Scaling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              Agents: {swarm.minAgents} - {swarm.maxAgents} (Current: {swarm.currentAgents})
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onScaleDown(swarm.swarmId, scaleAmount)}
                disabled={swarm.currentAgents <= swarm.minAgents || swarm.pendingScaling}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Input
                type="number"
                value={scaleAmount}
                onChange={(e) => setScaleAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 text-center"
                min="1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onScaleUp(swarm.swarmId, scaleAmount)}
                disabled={swarm.currentAgents >= swarm.maxAgents || swarm.pendingScaling}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium min-w-0 flex-shrink-0">Target Agents:</label>
            <Input
              type="number"
              value={targetAgents}
              onChange={(e) => setTargetAgents(parseInt(e.target.value) || swarm.minAgents)}
              className="w-20"
              min={swarm.minAgents}
              max={swarm.maxAgents}
            />
            <Button
              size="sm"
              onClick={() => onSetTargetAgents(swarm.swarmId, targetAgents)}
              disabled={targetAgents === swarm.targetAgents || swarm.pendingScaling}
            >
              Set Target
            </Button>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleAutoScaling(swarm.swarmId, !swarm.autoScalingEnabled)}
              disabled={swarm.pendingScaling}
            >
              {swarm.autoScalingEnabled ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {swarm.autoScalingEnabled ? 'Disable' : 'Enable'} Auto-Scale
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onForceRebalance(swarm.swarmId)}
              disabled={swarm.pendingScaling}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Force Rebalance
            </Button>
          </div>

          {swarm.pendingScaling && (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span>Scaling operation in progress...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Scaling Configuration */}
      {swarm.autoScalingEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Auto-Scaling Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Scale Up Threshold (%)</label>
                <Input
                  type="number"
                  value={upThreshold}
                  onChange={(e) => setUpThreshold(parseInt(e.target.value) || 80)}
                  min="1"
                  max="100"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Scale Down Threshold (%)</label>
                <Input
                  type="number"
                  value={downThreshold}
                  onChange={(e) => setDownThreshold(parseInt(e.target.value) || 20)}
                  min="1"
                  max="100"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onUpdateScalingThresholds(swarm.swarmId, upThreshold, downThreshold)}
              disabled={upThreshold === swarm.scaleUpThreshold && downThreshold === swarm.scaleDownThreshold}
            >
              Update Thresholds
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>CPU Usage</span>
                  <span>{swarm.metrics.cpu}%</span>
                </div>
                <Progress value={swarm.metrics.cpu} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Memory Usage</span>
                  <span>{swarm.metrics.memory}%</span>
                </div>
                <Progress value={swarm.metrics.memory} className="h-2" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="font-bold text-green-600">{swarm.metrics.tasks.active}</div>
                  <div className="text-green-600">Active</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className="font-bold text-blue-600">{swarm.metrics.tasks.queued}</div>
                  <div className="text-blue-600">Queued</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="font-bold text-gray-600">{swarm.metrics.tasks.completed}</div>
                  <div className="text-gray-600">Completed</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="font-bold text-red-600">{swarm.metrics.tasks.failed}</div>
                  <div className="text-red-600">Failed</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-center">
                  <div className="font-bold">{swarm.metrics.throughput}</div>
                  <div className="text-gray-600">Tasks/min</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{swarm.metrics.responseTime}ms</div>
                  <div className="text-gray-600">Avg Response</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scaling History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scaling Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {swarm.scalingHistory.slice(0, 5).map((event, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  {event.action === 'scale_up' && <TrendingUp className="w-4 h-4 text-green-600" />}
                  {event.action === 'scale_down' && <TrendingDown className="w-4 h-4 text-blue-600" />}
                  {event.action === 'manual_scale' && <Target className="w-4 h-4 text-purple-600" />}
                  {event.action === 'auto_scale' && <Zap className="w-4 h-4 text-orange-600" />}
                  <div>
                    <div className="text-sm font-medium">
                      {event.fromAgents} → {event.toAgents} agents
                    </div>
                    <div className="text-xs text-gray-600">{event.reason}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  <Badge variant={event.success ? 'default' : 'destructive'} className="text-xs">
                    {event.success ? 'Success' : 'Failed'}
                  </Badge>
                </div>
              </div>
            ))}
            {swarm.scalingHistory.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-4">
                No scaling events yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SwarmScalingControls