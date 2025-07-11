'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, GitBranch, Zap } from 'lucide-react';

interface Node {
  id: string;
  type: 'swarm' | 'worker' | 'task';
  label: string;
  status: 'active' | 'idle' | 'error';
  metrics?: {
    cpu?: number;
    memory?: number;
    tasksCompleted?: number;
  };
}

interface Edge {
  source: string;
  target: string;
  label?: string;
  strength?: number;
}

interface SwarmTopologyProps {
  nodes: Node[];
  edges: Edge[];
}

export function SwarmTopology({ nodes, edges }: SwarmTopologyProps) {
  const nodesByType = useMemo(() => {
    return nodes.reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = [];
      acc[node.type].push(node);
      return acc;
    }, {} as Record<string, Node[]>);
  }, [nodes]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'swarm': return <GitBranch className="w-4 h-4" />;
      case 'worker': return <Zap className="w-4 h-4" />;
      case 'task': return <Activity className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Swarm Topology</CardTitle>
        <CardDescription>
          Real-time view of swarm architecture and connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Swarms Column */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Swarms</h3>
            <div className="space-y-2">
              {nodesByType.swarm?.map((node) => (
                <div
                  key={node.id}
                  className="p-3 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.type)}
                      <span className="font-medium">{node.label}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(node.status)}`} />
                  </div>
                  {node.metrics && (
                    <div className="text-xs text-muted-foreground">
                      <div>CPU: {node.metrics.cpu}%</div>
                      <div>Memory: {node.metrics.memory}%</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Workers Column */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Workers</h3>
            <div className="space-y-2">
              {nodesByType.worker?.map((node) => (
                <div
                  key={node.id}
                  className="p-3 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.type)}
                      <span className="font-medium">{node.label}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(node.status)}`} />
                  </div>
                  {node.metrics?.tasksCompleted !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      Tasks: {node.metrics.tasksCompleted}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tasks Column */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Active Tasks</h3>
            <div className="space-y-2">
              {nodesByType.task?.map((node) => (
                <div
                  key={node.id}
                  className="p-3 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getNodeIcon(node.type)}
                      <span className="text-sm">{node.label}</span>
                    </div>
                    <Badge variant={node.status === 'active' ? 'default' : 'secondary'}>
                      {node.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Connection Info */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold mb-2">Active Connections</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            {edges.slice(0, 5).map((edge, idx) => (
              <div key={idx}>
                {edge.source} → {edge.target} {edge.label && `(${edge.label})`}
              </div>
            ))}
            {edges.length > 5 && (
              <div className="text-xs text-muted-foreground">
                +{edges.length - 5} more connections
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}