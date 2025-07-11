'use client'

import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface Activity {
  id: string
  type: 'swarm_created' | 'worker_scaled' | 'task_completed' | 'task_failed'
  message: string
  timestamp: string
  status: 'success' | 'error' | 'warning' | 'info'
}

const statusIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Clock,
}

const statusColors = {
  success: 'text-green-600 bg-green-100',
  error: 'text-red-600 bg-red-100',
  warning: 'text-yellow-600 bg-yellow-100',
  info: 'text-blue-600 bg-blue-100',
}

export function RecentActivity() {
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return [
        {
          id: '1',
          type: 'swarm_created',
          message: 'New swarm "production-api" created',
          timestamp: '5 minutes ago',
          status: 'success',
        },
        {
          id: '2',
          type: 'worker_scaled',
          message: 'Scaled workers from 3 to 5',
          timestamp: '10 minutes ago',
          status: 'info',
        },
        {
          id: '3',
          type: 'task_completed',
          message: 'Batch processing completed',
          timestamp: '1 hour ago',
          status: 'success',
        },
      ]
    },
  })

  if (isLoading) {
    return <div className="animate-pulse card h-96" />
  }

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities?.map((activity) => {
          const Icon = statusIcons[activity.status]
          const colorClasses = statusColors[activity.status]
          
          return (
            <div key={activity.id} className="flex items-start">
              <div className={`rounded-full p-2 ${colorClasses}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-gray-900">{activity.message}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}