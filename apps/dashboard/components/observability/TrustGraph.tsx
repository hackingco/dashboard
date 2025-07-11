'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Network, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

interface TrustNode {
  id: string;
  label: string;
  type: 'agent' | 'task' | 'decision' | 'outcome';
  trustScore: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface TrustEdge {
  source: string;
  target: string;
  weight: number;
  type: 'trust' | 'distrust' | 'verify' | 'delegate';
  timestamp: Date;
}

interface TrustGraphProps {
  nodes?: TrustNode[];
  edges?: TrustEdge[];
  onNodeClick?: (node: TrustNode) => void;
  onRefresh?: () => void;
}

export function TrustGraph({ 
  nodes = [], 
  edges = [], 
  onNodeClick,
  onRefresh 
}: TrustGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Mock data for demonstration
  const mockNodes: TrustNode[] = nodes.length > 0 ? nodes : [
    { id: 'agent-1', label: 'Coordinator', type: 'agent', trustScore: 0.95, timestamp: new Date() },
    { id: 'agent-2', label: 'Researcher', type: 'agent', trustScore: 0.87, timestamp: new Date() },
    { id: 'agent-3', label: 'Coder', type: 'agent', trustScore: 0.92, timestamp: new Date() },
    { id: 'task-1', label: 'Analyze Requirements', type: 'task', trustScore: 0.89, timestamp: new Date() },
    { id: 'task-2', label: 'Implement Solution', type: 'task', trustScore: 0.85, timestamp: new Date() },
    { id: 'decision-1', label: 'Architecture Choice', type: 'decision', trustScore: 0.91, timestamp: new Date() },
    { id: 'outcome-1', label: 'Success', type: 'outcome', trustScore: 0.94, timestamp: new Date() },
  ];

  const mockEdges: TrustEdge[] = edges.length > 0 ? edges : [
    { source: 'agent-1', target: 'task-1', weight: 0.9, type: 'delegate', timestamp: new Date() },
    { source: 'agent-2', target: 'task-1', weight: 0.85, type: 'trust', timestamp: new Date() },
    { source: 'task-1', target: 'decision-1', weight: 0.88, type: 'verify', timestamp: new Date() },
    { source: 'decision-1', target: 'task-2', weight: 0.9, type: 'trust', timestamp: new Date() },
    { source: 'agent-3', target: 'task-2', weight: 0.92, type: 'trust', timestamp: new Date() },
    { source: 'task-2', target: 'outcome-1', weight: 0.94, type: 'trust', timestamp: new Date() },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw trust graph
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;

    // Position nodes in a circle
    const nodePositions: Record<string, { x: number; y: number }> = {};
    mockNodes.forEach((node, index) => {
      const angle = (index / mockNodes.length) * 2 * Math.PI;
      nodePositions[node.id] = {
        x: centerX + radius * Math.cos(angle) * zoom,
        y: centerY + radius * Math.sin(angle) * zoom,
      };
    });

    // Draw edges
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    mockEdges.forEach((edge) => {
      const start = nodePositions[edge.source];
      const end = nodePositions[edge.target];
      if (!start || !end) return;

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      
      // Color based on edge type
      switch (edge.type) {
        case 'trust':
          ctx.strokeStyle = `rgba(34, 197, 94, ${edge.weight})`;
          break;
        case 'distrust':
          ctx.strokeStyle = `rgba(239, 68, 68, ${edge.weight})`;
          break;
        case 'verify':
          ctx.strokeStyle = `rgba(59, 130, 246, ${edge.weight})`;
          break;
        case 'delegate':
          ctx.strokeStyle = `rgba(168, 85, 247, ${edge.weight})`;
          break;
      }
      
      ctx.stroke();
    });

    // Draw nodes
    mockNodes.forEach((node) => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20 * zoom, 0, 2 * Math.PI);
      
      // Fill based on node type
      switch (node.type) {
        case 'agent':
          ctx.fillStyle = `rgba(59, 130, 246, ${node.trustScore})`;
          break;
        case 'task':
          ctx.fillStyle = `rgba(34, 197, 94, ${node.trustScore})`;
          break;
        case 'decision':
          ctx.fillStyle = `rgba(251, 191, 36, ${node.trustScore})`;
          break;
        case 'outcome':
          ctx.fillStyle = `rgba(168, 85, 247, ${node.trustScore})`;
          break;
      }
      
      ctx.fill();
      
      // Draw border for selected node
      if (node.id === selectedNode) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw label
      ctx.fillStyle = '#fff';
      ctx.font = `${12 * zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, pos.x, pos.y + 35 * zoom);
      
      // Draw trust score
      ctx.font = `${10 * zoom}px sans-serif`;
      ctx.fillText(`${(node.trustScore * 100).toFixed(0)}%`, pos.x, pos.y);
    });

    // Draw legend
    const legendY = 20;
    const legendItems = [
      { color: '#3b82f6', label: 'Agent' },
      { color: '#22c55e', label: 'Task' },
      { color: '#fbbf24', label: 'Decision' },
      { color: '#a855f7', label: 'Outcome' },
    ];

    legendItems.forEach((item, index) => {
      const x = 20 + index * 100;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, legendY, 15, 15);
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x + 20, legendY + 12);
    });

  }, [zoom, selectedNode, mockNodes, mockEdges]);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setSelectedNode(null);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Network className="w-5 h-5 mr-2" />
            TrustGraph DAG
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as '2d' | '3d')}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2d">2D</SelectItem>
                <SelectItem value="3d">3D</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={handleReset}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            {onRefresh && (
              <Button size="icon" variant="outline" onClick={onRefresh}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative h-96">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-pointer"
            onClick={(e) => {
              // Handle node clicks
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              // Simplified click detection - in production would use proper hit testing
              console.log('Canvas clicked at:', x, y);
            }}
          />
          {selectedNode && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/80 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-white mb-2">
                {mockNodes.find(n => n.id === selectedNode)?.label}
              </h4>
              <p className="text-xs text-gray-300">
                Trust Score: {(mockNodes.find(n => n.id === selectedNode)?.trustScore ?? 0) * 100}%
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}