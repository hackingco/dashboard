'use client'

import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface MetricData {
  timestamp: string
  cpu: number
  memory: number
  tasks: number
}

export function SwarmMetrics() {
  const { data: metrics, isLoading } = useQuery<MetricData[]>({
    queryKey: ['swarm-metrics'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      const now = Date.now()
      return Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now - (23 - i) * 60 * 60 * 1000).toISOString(),
        cpu: Math.floor(Math.random() * 40) + 30,
        memory: Math.floor(Math.random() * 30) + 50,
        tasks: Math.floor(Math.random() * 20) + 10,
      }))
    },
  })

  if (isLoading) {
    return <div className="animate-pulse card h-96" />
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.getHours() + ':00'
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Usage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              stroke="#6b7280"
            />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              labelFormatter={formatTime}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
            />
            <Line 
              type="monotone" 
              dataKey="cpu" 
              stroke="#3b82f6" 
              name="CPU %" 
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="memory" 
              stroke="#10b981" 
              name="Memory %" 
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Task Throughput</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              stroke="#6b7280"
            />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              labelFormatter={formatTime}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
            />
            <Area 
              type="monotone" 
              dataKey="tasks" 
              stroke="#8b5cf6" 
              fill="#8b5cf6" 
              fillOpacity={0.3}
              name="Tasks/Hour"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}