'use client'

import React, { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Server, Cpu, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TreeNode {
  id: string
  name: string
  type: 'root' | 'swarm' | 'agent'
  status?: string
  metadata?: Record<string, any>
  children?: TreeNode[]
}

interface TreeViewProps {
  data: TreeNode
  onNodeSelect?: (node: TreeNode) => void
  onNodeExpand?: (node: TreeNode, expanded: boolean) => void
  className?: string
}

interface TreeNodeProps {
  node: TreeNode
  level: number
  onSelect?: (node: TreeNode) => void
  onExpand?: (node: TreeNode, expanded: boolean) => void
  selectedId?: string
}

const statusColors = {
  running: 'text-green-500',
  idle: 'text-blue-500',
  busy: 'text-yellow-500',
  error: 'text-red-500',
  offline: 'text-gray-500',
  initializing: 'text-purple-500',
  scaling: 'text-orange-500',
  stopped: 'text-gray-400'
}

const getNodeIcon = (node: TreeNode, isExpanded: boolean) => {
  switch (node.type) {
    case 'root':
      return isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
    case 'swarm':
      return <Server className="w-4 h-4" />
    case 'agent':
      return <Cpu className="w-4 h-4" />
    default:
      return <Circle className="w-4 h-4" />
  }
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({ 
  node, 
  level, 
  onSelect, 
  onExpand, 
  selectedId 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChildren = node.children && node.children.length > 0

  const handleToggle = useCallback(() => {
    if (hasChildren) {
      const newExpanded = !isExpanded
      setIsExpanded(newExpanded)
      onExpand?.(node, newExpanded)
    }
  }, [hasChildren, isExpanded, node, onExpanded])

  const handleSelect = useCallback(() => {
    onSelect?.(node)
  }, [node, onSelect])

  const isSelected = selectedId === node.id

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center px-2 py-1 rounded-md cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800",
          isSelected && "bg-blue-100 dark:bg-blue-900/50",
          "group"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleToggle()
            }}
            className="mr-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-transform duration-200"
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        
        {!hasChildren && <div className="w-4 mr-1" />}
        
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className={cn(
            "transition-colors duration-200",
            node.status && statusColors[node.status as keyof typeof statusColors]
          )}>
            {getNodeIcon(node, isExpanded)}
          </div>
          
          <span className="truncate font-medium text-sm">
            {node.name}
          </span>
          
          {node.status && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-200",
              node.status === 'running' && "bg-green-100 text-green-800",
              node.status === 'idle' && "bg-blue-100 text-blue-800",
              node.status === 'busy' && "bg-yellow-100 text-yellow-800",
              node.status === 'error' && "bg-red-100 text-red-800",
              node.status === 'offline' && "bg-gray-100 text-gray-800",
              node.status === 'initializing' && "bg-purple-100 text-purple-800",
              node.status === 'scaling' && "bg-orange-100 text-orange-800",
              node.status === 'stopped' && "bg-gray-100 text-gray-600"
            )}>
              {node.status}
            </span>
          )}
          
          {node.metadata?.agentCount !== undefined && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {node.metadata.agentCount} agents
            </span>
          )}
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div 
          className="transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            animation: isExpanded ? 'slideDown 200ms ease-out' : 'slideUp 200ms ease-in'
          }}
        >
          {node.children?.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              onExpand={onExpand}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const TreeView: React.FC<TreeViewProps> = ({ 
  data, 
  onNodeSelect, 
  onNodeExpand, 
  className 
}) => {
  const [selectedId, setSelectedId] = useState<string>()

  const handleNodeSelect = useCallback((node: TreeNode) => {
    setSelectedId(node.id)
    onNodeSelect?.(node)
  }, [onNodeSelect])

  return (
    <div className={cn("w-full", className)}>
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-4px);
          }
        }
      `}</style>
      
      <TreeNodeComponent
        node={data}
        level={0}
        onSelect={handleNodeSelect}
        onExpand={onNodeExpand}
        selectedId={selectedId}
      />
    </div>
  )
}

export default TreeView