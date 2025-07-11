import { Navigation } from '@/components/Navigation'
import { SwarmOverview } from '@/components/SwarmOverview'
import { RecentActivity } from '@/components/RecentActivity'
import { SwarmMetrics } from '@/components/SwarmMetrics'

export default function DashboardPage() {
  return (
    <>
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">PromptDash</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monitor and manage your distributed AI infrastructure
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SwarmOverview />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>

        <div className="mt-8">
          <SwarmMetrics />
        </div>
      </main>
    </>
  )
}