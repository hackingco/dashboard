'use client'

import React, { useState } from 'react'

export default function SwarmStatusPage() {
  const [showCommands, setShowCommands] = useState(false)
  
  const swarmApps = [
    { name: 'swarm-admin', description: 'Dashboard and UI', expectedMachines: 1 },
    { name: 'swarm-manager', description: 'Orchestration and task management', expectedMachines: 1 },
    { name: 'swarm-worker', description: 'Task execution workers', expectedMachines: 3 },
  ]

  const cliCommands = {
    listAllApps: 'fly apps list',
    checkApp: (app: string) => `fly status --app ${app}`,
    listMachines: (app: string) => `fly machines list --app ${app}`,
    getMachineDetails: (app: string, machineId: string) => `fly machines show ${machineId} --app ${app}`,
    startMachine: (app: string, machineId: string) => `fly machines start ${machineId} --app ${app}`,
    stopMachine: (app: string, machineId: string) => `fly machines stop ${machineId} --app ${app}`,
    restartMachine: (app: string, machineId: string) => `fly machines restart ${machineId} --app ${app}`,
    scaleMachines: (app: string, count: number) => `fly scale count ${count} --app ${app}`,
    createMachine: (app: string) => `fly machines run . --app ${app} --name new-machine`,
    destroyMachine: (app: string, machineId: string) => `fly machines destroy ${machineId} --app ${app}`,
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Swarm Status & Management</h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage your Fly.io swarm deployment
          </p>
        </div>

        {/* Status Overview */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Expected Swarm Components</h2>
          <div className="space-y-4">
            {swarmApps.map((app) => (
              <div key={app.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-lg">{app.name}</h3>
                    <p className="text-sm text-gray-600">{app.description}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Expected machines: {app.expectedMachines}
                    </p>
                  </div>
                  <div className="text-right">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                      {cliCommands.checkApp(app.name)}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">Check All Apps</h3>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm block">
                {cliCommands.listAllApps}
              </code>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">View Dashboard Machines</h3>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm block">
                {cliCommands.listMachines('swarm-admin')}
              </code>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">View Manager Machines</h3>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm block">
                {cliCommands.listMachines('swarm-manager')}
              </code>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium mb-2">View Worker Machines</h3>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm block">
                {cliCommands.listMachines('swarm-worker')}
              </code>
            </div>
          </div>
        </div>

        {/* CLI Command Reference */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">CLI Command Reference</h2>
            <button
              onClick={() => setShowCommands(!showCommands)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {showCommands ? 'Hide' : 'Show'} Commands
            </button>
          </div>
          
          {showCommands && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Machine Management</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">Start a machine:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      fly machines start [MACHINE_ID] --app [APP_NAME]
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">Stop a machine:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      fly machines stop [MACHINE_ID] --app [APP_NAME]
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">Restart a machine:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      fly machines restart [MACHINE_ID] --app [APP_NAME]
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">Scale machines:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      fly scale count [COUNT] --app [APP_NAME]
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">Monitoring</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">View logs:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      fly logs --app [APP_NAME]
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">SSH into machine:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      fly ssh console --app [APP_NAME]
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Manual Check Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-medium text-blue-900 mb-2">
            To manually check your swarm status:
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Open your terminal</li>
            <li>Ensure you're logged in: <code className="bg-blue-100 px-1 rounded">fly auth login</code></li>
            <li>Check all apps: <code className="bg-blue-100 px-1 rounded">fly apps list</code></li>
            <li>For each swarm app (swarm-admin, swarm-manager, swarm-worker), run:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><code className="bg-blue-100 px-1 rounded">fly status --app [APP_NAME]</code></li>
                <li><code className="bg-blue-100 px-1 rounded">fly machines list --app [APP_NAME]</code></li>
              </ul>
            </li>
          </ol>
        </div>

        {/* API Integration Note */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-medium text-yellow-900 mb-2">
            Note: Direct API Integration
          </h3>
          <p className="text-sm text-yellow-800">
            Due to CORS restrictions, the Fly Machines API cannot be accessed directly from the browser. 
            Use the CLI commands above or set up a backend proxy server to enable API access from this dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}