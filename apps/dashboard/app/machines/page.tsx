'use client'

import React, { useState, useEffect } from 'react'
import { Machine } from '@/lib/machines-api'
import { MachineList } from '@/components/machines/machine-list'
import { MachineLifecycleControls } from '@/components/machines/machine-lifecycle-controls'
import { MachineMonitoring } from '@/components/machines/machine-monitoring'
import { SwarmOrchestrator } from '@/components/machines/swarm-orchestrator'
import { MachineConfigEditor } from '@/components/machines/machine-config-editor'

export default function MachinesPage() {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [appName, setAppName] = useState('swarm-admin')
  const [apiToken, setApiToken] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    // Check for API token in environment or local storage
    const token = process.env.NEXT_PUBLIC_FLY_API_TOKEN || 
                  localStorage.getItem('fly_api_token') || ''
    if (token) {
      setApiToken(token)
      setIsConfigured(true)
    }
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

  const handleApiTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (apiToken.trim()) {
      localStorage.setItem('fly_api_token', apiToken.trim())
      setIsConfigured(true)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'machine-details', label: 'Machine Details', icon: '💻', disabled: !selectedMachine },
    { id: 'monitoring', label: 'Monitoring', icon: '📈', disabled: !selectedMachine },
    { id: 'orchestration', label: 'Orchestration', icon: '🎯' },
    { id: 'deployment', label: 'Deploy New', icon: '🚀' },
  ]

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Fly Machines Swarm UI
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Built on top of the Fly Machines API
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleApiTokenSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="appName" className="block text-sm font-medium text-gray-700">
                  App Name
                </label>
                <input
                  id="appName"
                  name="appName"
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Your Fly app name"
                />
              </div>
              
              <div>
                <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700">
                  Fly API Token
                </label>
                <input
                  id="apiToken"
                  name="apiToken"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Your Fly API token"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  Get your API token from: <code className="bg-gray-100 px-1 rounded">fly auth token</code>
                </p>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Connect to Fly Machines API
              </button>
            </div>
          </form>

          <div className="text-center">
            <div className="text-sm text-gray-600">
              <p className="mb-2">This is a complete swarm management UI built on the Fly Machines API.</p>
              <p className="mb-2">Features include:</p>
              <ul className="text-left inline-block space-y-1">
                <li>• Real-time machine monitoring and lifecycle management</li>
                <li>• Swarm orchestration with scaling and deployment strategies</li>
                <li>• Advanced machine configuration and deployment</li>
                <li>• Multi-region distribution and load balancing</li>
                <li>• Process monitoring and event tracking</li>
              </ul>
            </div>
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
            <h2 className="text-3xl font-bold tracking-tight">Fly Machines Swarm UI</h2>
            <p className="text-muted-foreground">
              Complete swarm management built on the Fly Machines API • App: {appName}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsConfigured(false)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
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
                apiToken={apiToken}
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
                  apiToken={apiToken}
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

            {activeTab === 'monitoring' && selectedMachine && (
              <MachineMonitoring
                appName={appName}
                machine={selectedMachine}
                apiToken={apiToken}
              />
            )}

            {activeTab === 'orchestration' && (
              <SwarmOrchestrator
                appName={appName}
                apiToken={apiToken}
              />
            )}

            {activeTab === 'deployment' && (
              <MachineConfigEditor
                appName={appName}
                apiToken={apiToken}
                onMachineCreated={(machine) => {
                  setSelectedMachine(machine)
                  setActiveTab('machine-details')
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}