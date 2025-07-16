import { SwarmManagementHub } from '@/components/swarm/SwarmManagementHub'

export default function SwarmManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <SwarmManagementHub />
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Swarm Management - Dashboard',
  description: 'Manage and monitor your swarm intelligence systems'
}