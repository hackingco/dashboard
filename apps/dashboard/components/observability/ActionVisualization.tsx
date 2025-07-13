'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { 
  Activity, 
  Brain, 
  Clock, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Network,
  GitBranch,
  ArrowRight,
  ArrowDown,
  RotateCcw
} from 'lucide-react';

// Enhanced interfaces for action visualization
interface ActionNode {
  id: string;
  type: 'agent' | 'task' | 'decision' | 'result' | 'error';
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  agentId?: string;
  parentId?: string;
  children: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata: {
    input?: any;
    output?: any;
    model?: string;
    tokens?: number;
    cost?: number;
    confidence?: number;
    retries?: number;
  };
  position: { x: number; y: number };
  progress: number; // 0-100
}

interface ActionFlow {
  id: string;
  name: string;
  description: string;
  nodes: ActionNode[];
  edges: Array<{
    source: string;
    target: string;
    type: 'success' | 'error' | 'condition' | 'data';
    label?: string;
    animated?: boolean;
  }>;
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'paused';
  startTime: Date;
  endTime?: Date;
  currentNodeId?: string;
}

interface ActionVisualizationProps {
  swarmId?: string;
  height?: number;
  autoPlay?: boolean;
  showTimeline?: boolean;
  maxFlows?: number;
}

export function ActionVisualization({ 
  swarmId, 
  height = 600, 
  autoPlay = true, 
  showTimeline = true,
  maxFlows = 5 
}: ActionVisualizationProps) {
  const [flows, setFlows] = useState<ActionFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<ActionFlow | null>(null);
  const [selectedNode, setSelectedNode] = useState<ActionNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [timelinePosition, setTimelinePosition] = useState(0);
  const [maxTimelineValue, setMaxTimelineValue] = useState(100);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>();

  // Generate mock action flows for demonstration
  const generateMockFlow = useCallback((): ActionFlow => {
    const flowId = `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const flowTypes = [
      'Code Generation Pipeline',
      'Data Analysis Workflow',
      'Testing Automation',
      'Documentation Generation',
      'Security Audit',
      'Performance Optimization'
    ];
    
    const agentTypes = ['researcher', 'coder', 'analyst', 'tester', 'reviewer'];
    const now = new Date();
    
    // Create nodes for the flow
    const nodes: ActionNode[] = [];
    const edges: ActionFlow['edges'] = [];
    
    // Root node
    const rootNode: ActionNode = {
      id: `${flowId}-root`,
      type: 'task',
      label: 'Initialize Task',
      status: 'completed',
      startTime: new Date(now.getTime() - Math.random() * 60000),
      endTime: new Date(now.getTime() - Math.random() * 50000),
      duration: Math.floor(Math.random() * 2000) + 500,
      children: [],
      metadata: {
        input: { task: 'Initialize swarm workflow' },
        output: { status: 'ready', agentsAssigned: 3 }
      },
      position: { x: 50, y: 50 },
      progress: 100
    };
    
    nodes.push(rootNode);
    
    // Agent nodes
    const agentNodes: ActionNode[] = [];
    for (let i = 0; i < 3; i++) {
      const agentNode: ActionNode = {
        id: `${flowId}-agent-${i}`,
        type: 'agent',
        label: `${agentTypes[i]} Agent`,
        status: i === 0 ? 'running' : i === 1 ? 'completed' : 'pending',
        agentId: `agent-${i + 1}`,
        parentId: rootNode.id,
        startTime: new Date(now.getTime() - Math.random() * 40000),
        endTime: i === 1 ? new Date(now.getTime() - Math.random() * 10000) : undefined,
        duration: i === 1 ? Math.floor(Math.random() * 3000) + 1000 : undefined,
        children: [],
        metadata: {
          model: ['gpt-4', 'claude-3-opus', 'gpt-3.5-turbo'][Math.floor(Math.random() * 3)],
          tokens: Math.floor(Math.random() * 2000) + 500,
          cost: Math.random() * 0.1,
          confidence: Math.random() * 0.4 + 0.6
        },
        position: { x: 200 + i * 150, y: 150 },
        progress: i === 0 ? Math.floor(Math.random() * 80) + 20 : i === 1 ? 100 : 0
      };
      
      agentNodes.push(agentNode);
      nodes.push(agentNode);
      
      // Add edge from root to agent
      edges.push({
        source: rootNode.id,
        target: agentNode.id,
        type: 'data',
        animated: agentNode.status === 'running'
      });
      
      rootNode.children.push(agentNode.id);
    }
    
    // Decision nodes
    const decisionNode: ActionNode = {
      id: `${flowId}-decision`,
      type: 'decision',
      label: 'Validate Results',
      status: agentNodes[1].status === 'completed' ? 'running' : 'pending',
      parentId: agentNodes[1].id,
      startTime: new Date(now.getTime() - Math.random() * 30000),
      children: [],
      metadata: {
        input: { results: 'agent outputs', criteria: 'quality checks' },
        confidence: Math.random() * 0.3 + 0.7
      },
      position: { x: 350, y: 300 },
      progress: agentNodes[1].status === 'completed' ? Math.floor(Math.random() * 60) + 20 : 0
    };
    
    nodes.push(decisionNode);
    
    if (agentNodes[1].status === 'completed') {
      edges.push({
        source: agentNodes[1].id,
        target: decisionNode.id,
        type: 'success',
        animated: decisionNode.status === 'running'
      });
      agentNodes[1].children.push(decisionNode.id);
    }
    
    // Result node
    const resultNode: ActionNode = {
      id: `${flowId}-result`,
      type: 'result',
      label: 'Final Output',
      status: decisionNode.status === 'completed' ? 'completed' : 'pending',
      parentId: decisionNode.id,
      startTime: new Date(now.getTime() - Math.random() * 20000),
      endTime: decisionNode.status === 'completed' ? new Date(now.getTime() - Math.random() * 5000) : undefined,
      children: [],
      metadata: {
        output: { 
          result: 'Task completed successfully',
          quality: Math.random() * 0.3 + 0.7,
          artifacts: Math.floor(Math.random() * 5) + 1
        },
        cost: Math.random() * 0.2 + 0.05
      },
      position: { x: 500, y: 400 },
      progress: decisionNode.status === 'completed' ? 100 : 0
    };
    
    nodes.push(resultNode);
    
    if (decisionNode.status === 'completed') {
      edges.push({
        source: decisionNode.id,
        target: resultNode.id,
        type: 'success'
      });
      decisionNode.children.push(resultNode.id);
    }
    
    const flow: ActionFlow = {
      id: flowId,
      name: flowTypes[Math.floor(Math.random() * flowTypes.length)],
      description: `Automated ${flowTypes[Math.floor(Math.random() * flowTypes.length)].toLowerCase()} with multi-agent coordination`,
      nodes,
      edges,
      status: resultNode.status === 'completed' ? 'completed' : 
              agentNodes.some(a => a.status === 'running') ? 'running' : 'initializing',
      startTime: rootNode.startTime,
      endTime: resultNode.endTime,
      currentNodeId: nodes.find(n => n.status === 'running')?.id
    };
    
    return flow;
  }, []);

  // Initialize flows
  useEffect(() => {
    const initialFlows = Array.from({ length: 3 }, () => generateMockFlow());
    setFlows(initialFlows);
    setSelectedFlow(initialFlows[0]);
    
    // Calculate timeline max value
    const maxDuration = Math.max(...initialFlows.map(f => 
      f.endTime ? f.endTime.getTime() - f.startTime.getTime() : Date.now() - f.startTime.getTime()
    ));
    setMaxTimelineValue(maxDuration);
  }, [generateMockFlow]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      setFlows(prevFlows => {
        return prevFlows.map(flow => {
          if (flow.status === 'completed') return flow;
          
          const updatedNodes = flow.nodes.map(node => {
            if (node.status === 'running' && node.progress < 100) {
              return {
                ...node,
                progress: Math.min(100, node.progress + Math.random() * 5 * playbackSpeed)
              };
            }
            return node;
          });
          
          // Check for status transitions
          const runningNode = updatedNodes.find(n => n.status === 'running');
          if (runningNode && runningNode.progress >= 100) {
            runningNode.status = 'completed';
            runningNode.endTime = new Date();
            
            // Start children
            runningNode.children.forEach(childId => {
              const childNode = updatedNodes.find(n => n.id === childId);
              if (childNode && childNode.status === 'pending') {
                childNode.status = 'running';
                childNode.startTime = new Date();
              }
            });
          }
          
          // Update flow status
          const allCompleted = updatedNodes.every(n => n.status === 'completed' || n.status === 'failed');
          const hasRunning = updatedNodes.some(n => n.status === 'running');
          
          return {
            ...flow,
            nodes: updatedNodes,
            status: allCompleted ? 'completed' : hasRunning ? 'running' : 'initializing',
            endTime: allCompleted ? new Date() : undefined,
            currentNodeId: updatedNodes.find(n => n.status === 'running')?.id
          };
        });
      });
      
      setTimelinePosition(prev => Math.min(maxTimelineValue, prev + 1000 * playbackSpeed));
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, maxTimelineValue]);

  // Add new flows periodically
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      if (flows.length < maxFlows && Math.random() > 0.7) {
        const newFlow = generateMockFlow();
        setFlows(prev => [newFlow, ...prev].slice(0, maxFlows));
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [flows.length, maxFlows, isPlaying, generateMockFlow]);

  const getNodeColor = (node: ActionNode) => {
    switch (node.status) {
      case 'completed':
        return node.type === 'error' ? '#ef4444' : '#10b981';
      case 'running':
        return '#3b82f6';
      case 'failed':
        return '#ef4444';
      case 'paused':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getNodeIcon = (node: ActionNode) => {
    switch (node.type) {
      case 'agent':
        return <Users className="w-4 h-4" />;
      case 'task':
        return <Activity className="w-4 h-4" />;
      case 'decision':
        return <GitBranch className="w-4 h-4" />;
      case 'result':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'error':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Network className="w-4 h-4" />;
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setTimelinePosition(0);
    setFlows(flows.map(flow => ({
      ...flow,
      status: 'initializing' as const,
      nodes: flow.nodes.map(node => ({
        ...node,
        status: node.id.includes('root') ? 'completed' as const : 'pending' as const,
        progress: node.id.includes('root') ? 100 : 0,
        endTime: undefined
      }))
    })));
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Action Flow Visualization
              {selectedFlow && (
                <Badge variant="outline" className="ml-2">
                  {selectedFlow.name}
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Speed:</span>
                <Slider
                  value={[playbackSpeed]}
                  onValueChange={(value) => setPlaybackSpeed(value[0])}
                  max={3}
                  min={0.1}
                  step={0.1}
                  className="w-20"
                />
                <span className="text-sm font-medium">{playbackSpeed}x</span>
              </div>
            </div>
          </div>
        </CardHeader>
        
        {showTimeline && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Timeline</span>
                <span>{Math.round(timelinePosition / 1000)}s / {Math.round(maxTimelineValue / 1000)}s</span>
              </div>
              <Progress value={(timelinePosition / maxTimelineValue) * 100} className="h-2" />
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Flow List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Active Flows</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                      selectedFlow?.id === flow.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => setSelectedFlow(flow)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {flow.status === 'running' && <Activity className="w-3 h-3 text-blue-500 animate-pulse" />}
                          {flow.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                          {flow.status === 'failed' && <XCircle className="w-3 h-3 text-red-500" />}
                          {flow.status === 'paused' && <Pause className="w-3 h-3 text-yellow-500" />}
                          <h4 className="font-medium text-sm">{flow.name}</h4>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {flow.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {flow.nodes.length} nodes
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {flow.startTime.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Visualization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Flow Diagram</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative" style={{ height: `${height}px` }}>
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="border-t"
              >
                {selectedFlow && (
                  <>
                    {/* Render edges */}
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 10 3.5, 0 7"
                          fill="#6b7280"
                        />
                      </marker>
                    </defs>
                    
                    {selectedFlow.edges.map((edge, index) => {
                      const sourceNode = selectedFlow.nodes.find(n => n.id === edge.source);
                      const targetNode = selectedFlow.nodes.find(n => n.id === edge.target);
                      
                      if (!sourceNode || !targetNode) return null;
                      
                      const strokeColor = edge.type === 'success' ? '#10b981' :
                                         edge.type === 'error' ? '#ef4444' :
                                         edge.type === 'condition' ? '#f59e0b' : '#6b7280';
                      
                      return (
                        <g key={index}>
                          <line
                            x1={sourceNode.position.x + 60}
                            y1={sourceNode.position.y + 30}
                            x2={targetNode.position.x}
                            y2={targetNode.position.y + 30}
                            stroke={strokeColor}
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                            className={edge.animated ? "animate-pulse" : ""}
                            strokeDasharray={edge.animated ? "5,5" : "none"}
                          />
                          {edge.label && (
                            <text
                              x={(sourceNode.position.x + targetNode.position.x + 60) / 2}
                              y={(sourceNode.position.y + targetNode.position.y + 60) / 2}
                              textAnchor="middle"
                              className="text-xs fill-gray-600"
                            >
                              {edge.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    
                    {/* Render nodes */}
                    {selectedFlow.nodes.map((node) => (
                      <g
                        key={node.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedNode(node)}
                      >
                        <rect
                          x={node.position.x}
                          y={node.position.y}
                          width="120"
                          height="60"
                          rx="8"
                          fill={selectedNode?.id === node.id ? '#dbeafe' : 'white'}
                          stroke={getNodeColor(node)}
                          strokeWidth="2"
                          className="hover:fill-gray-50 transition-colors"
                        />
                        
                        {/* Node icon */}
                        <foreignObject
                          x={node.position.x + 8}
                          y={node.position.y + 8}
                          width="16"
                          height="16"
                        >
                          <div style={{ color: getNodeColor(node) }}>
                            {getNodeIcon(node)}
                          </div>
                        </foreignObject>
                        
                        {/* Node label */}
                        <text
                          x={node.position.x + 30}
                          y={node.position.y + 20}
                          className="text-xs font-medium fill-gray-900"
                        >
                          {node.label.length > 12 ? `${node.label.substring(0, 12)}...` : node.label}
                        </text>
                        
                        {/* Progress bar */}
                        {node.status === 'running' && (
                          <>
                            <rect
                              x={node.position.x + 8}
                              y={node.position.y + 35}
                              width="104"
                              height="4"
                              rx="2"
                              fill="#e5e7eb"
                            />
                            <rect
                              x={node.position.x + 8}
                              y={node.position.y + 35}
                              width={104 * (node.progress / 100)}
                              height="4"
                              rx="2"
                              fill={getNodeColor(node)}
                            />
                          </>
                        )}
                        
                        {/* Status indicator */}
                        <circle
                          cx={node.position.x + 110}
                          cy={node.position.y + 12}
                          r="4"
                          fill={getNodeColor(node)}
                          className={node.status === 'running' ? 'animate-pulse' : ''}
                        />
                        
                        {/* Duration/Progress text */}
                        <text
                          x={node.position.x + 8}
                          y={node.position.y + 52}
                          className="text-xs fill-gray-500"
                        >
                          {node.status === 'running' ? `${Math.round(node.progress)}%` :
                           node.duration ? `${node.duration}ms` : 'Pending'}
                        </text>
                      </g>
                    ))}
                  </>
                )}
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* Node Details */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Node Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {selectedNode ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div style={{ color: getNodeColor(selectedNode) }}>
                        {getNodeIcon(selectedNode)}
                      </div>
                      <h3 className="font-semibold">{selectedNode.label}</h3>
                      <Badge className={`ml-auto ${
                        selectedNode.status === 'completed' ? 'bg-green-500/10 text-green-700' :
                        selectedNode.status === 'running' ? 'bg-blue-500/10 text-blue-700' :
                        selectedNode.status === 'failed' ? 'bg-red-500/10 text-red-700' :
                        'bg-gray-500/10 text-gray-700'
                      }`}>
                        {selectedNode.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">Type: {selectedNode.type}</p>
                  </div>
                  
                  {selectedNode.status === 'running' && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{Math.round(selectedNode.progress)}%</span>
                      </div>
                      <Progress value={selectedNode.progress} className="h-2" />
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Started:</span>
                      <p>{selectedNode.startTime.toLocaleString()}</p>
                    </div>
                    {selectedNode.endTime && (
                      <div>
                        <span className="text-gray-500">Completed:</span>
                        <p>{selectedNode.endTime.toLocaleString()}</p>
                      </div>
                    )}
                    {selectedNode.duration && (
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <p>{selectedNode.duration}ms</p>
                      </div>
                    )}
                    {selectedNode.agentId && (
                      <div>
                        <span className="text-gray-500">Agent:</span>
                        <p>{selectedNode.agentId}</p>
                      </div>
                    )}
                  </div>
                  
                  {selectedNode.metadata && (
                    <div>
                      <h4 className="font-medium mb-2">Metadata</h4>
                      <div className="space-y-2 text-sm">
                        {selectedNode.metadata.model && (
                          <div>
                            <span className="text-gray-500">Model:</span>
                            <p>{selectedNode.metadata.model}</p>
                          </div>
                        )}
                        {selectedNode.metadata.tokens && (
                          <div>
                            <span className="text-gray-500">Tokens:</span>
                            <p>{selectedNode.metadata.tokens.toLocaleString()}</p>
                          </div>
                        )}
                        {selectedNode.metadata.cost && (
                          <div>
                            <span className="text-gray-500">Cost:</span>
                            <p>${selectedNode.metadata.cost.toFixed(4)}</p>
                          </div>
                        )}
                        {selectedNode.metadata.confidence && (
                          <div>
                            <span className="text-gray-500">Confidence:</span>
                            <div className="flex items-center space-x-2">
                              <Progress value={selectedNode.metadata.confidence * 100} className="flex-1 h-2" />
                              <span>{(selectedNode.metadata.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {(selectedNode.metadata.input || selectedNode.metadata.output) && (
                        <div className="mt-4">
                          <h5 className="font-medium mb-2">Data</h5>
                          {selectedNode.metadata.input && (
                            <div className="mb-2">
                              <span className="text-gray-500 text-xs">Input:</span>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                                {JSON.stringify(selectedNode.metadata.input, null, 2)}
                              </pre>
                            </div>
                          )}
                          {selectedNode.metadata.output && (
                            <div>
                              <span className="text-gray-500 text-xs">Output:</span>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                                {JSON.stringify(selectedNode.metadata.output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a node to view details
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}