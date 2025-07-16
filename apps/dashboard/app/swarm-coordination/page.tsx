// Swarm Coordination Page
// Created: 2025-07-14
// Purpose: Main page for swarm relationship management

import SwarmCoordinationDashboard from '@/components/swarm/SwarmCoordinationDashboard';

export default function SwarmCoordinationPage() {
  return (
    <div className="container mx-auto py-6">
      <SwarmCoordinationDashboard />
    </div>
  );
}

export const metadata = {
  title: 'Swarm Coordination | Dashboard',
  description: 'Manage and monitor distributed agent networks with comprehensive coordination tools',
};