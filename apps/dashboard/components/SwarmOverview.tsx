'use client'

import { useQuery } from '@tanstack/react-query'
import { Server, Users, Activity, AlertCircle } from 'lucide-react'

interface SwarmStats {
  totalSwarms: number
  activeWorkers: number
  pendingTasks: number
  failedTasks: number
}

export function SwarmOverview() {
  const { data: stats, isLoading } = useQuery<SwarmStats>({
    queryKey: ['swarm-stats'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return {
        totalSwarms: 3,
        activeWorkers: 12,
        pendingTasks: 5,
        failedTasks: 0,
      }
    },
  })

  const cards = [
    {
      name: 'Total Swarms',
      value: stats?.totalSwarms ?? 0,
      icon: Server,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Active Workers',
      value: stats?.activeWorkers ?? 0,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Pending Tasks',
      value: stats?.pendingTasks ?? 0,
      icon: Activity,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      name: 'Failed Tasks',
      value: stats?.failedTasks ?? 0,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
  ]

  if (isLoading) {
    return <div className="animate-pulse card h-32" />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.name} className="card">
            <div className="flex items-center">
              <div className={`rounded-md p-3 ${card.bgColor}`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{card.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}