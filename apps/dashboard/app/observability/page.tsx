'use client';

import React, { Suspense } from 'react';
import { EnhancedSwarmDashboard } from '@/components/observability/EnhancedSwarmDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

// Loading component for Suspense fallback
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-8">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin mr-3" />
              <div>
                <div className="text-lg font-medium">Loading Enhanced Swarm Dashboard...</div>
                <div className="text-sm text-gray-500">Initializing real-time components</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ObservabilityPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <EnhancedSwarmDashboard
        swarmId="swarm_observability"
        realTimeUpdates={true}
        autoRefresh={true}
        refreshInterval={5000}
        theme="auto"
      />
    </Suspense>
  );
}