'use client'

import React, { useState, useEffect } from 'react'
import { Machine, MachinesAPI } from '@/lib/machines-api'
import { MachineList } from '@/components/machines/machine-list'
import { MachineLifecycleControls } from '@/components/machines/machine-lifecycle-controls'

export default function MachinesAutoPage() {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [appName, setAppName] = useState('swarm-admin')
  const [loading, setLoading] = useState(true)
  const [hasServerToken, setHasServerToken] = useState(false)

  useEffect(() => {
    // Check if server has API token configured
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setHasServerToken(data.hasServerToken)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const handleMachineSelect = (machine: Machine) => {
    setSelectedMachine(machine)
    if (activeTab === 'overview') {
      setActiveTab('machine-details')
    }
  }

  const handleMachineUpdate = (machine: Machine) => {
    setSelectedMachine(machine)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'machine-details', label: 'Machine Details', icon: '💻', disabled: !selectedMachine },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!hasServerToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Server Configuration Required
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              The server needs to be configured with a Fly API token.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Please deploy the app using the deploy-with-secret.sh script.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex-1 space-y-4 p-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Fly Machines (Auto)</h2>
            <p className="text-muted-foreground">
              Using server-side authentication • App: {appName}
            </p>
          </div>
          <div className="flex space-x-2">
            <select
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="swarm-admin">swarm-admin</option>
              <option value="swarm-manager">swarm-manager</option>
              <option value="swarm-worker">swarm-worker</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-4">
          <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : ''
                } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {activeTab === 'overview' && (
              <MachineList
                appName={appName}
                apiToken=""
                onMachineSelect={handleMachineSelect}
                selectedMachine={selectedMachine}
              />
            )}

            {activeTab === 'machine-details' && selectedMachine && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MachineLifecycleControls
                  appName={appName}
                  machine={selectedMachine}
                  onMachineUpdate={handleMachineUpdate}
                  apiToken=""
                />
                <div className="space-y-4">
                  <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <div className="flex flex-col space-y-1.5 p-6">
                      <h4 className="text-lg font-semibold">Machine Configuration</h4>
                    </div>
                    <div className="p-6 pt-0">
                      <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto">
                        {JSON.stringify(selectedMachine.config, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}