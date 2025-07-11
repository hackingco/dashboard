'use client'

import React, { useState, useEffect } from 'react'

interface Machine {
  id: string
  name: string
  state: string
  region: string
  instance_id: string
  private_ip: string
  config: {
    image: string
    guest?: {
      cpus: number
      memory_mb: number
    }
  }
}

interface AppStatus {
  app: string
  machines: Machine[]
  status: 'success' | 'error'
  error?: string
}

interface SwarmStatus {
  timestamp: string
  apps: AppStatus[]
}

export default function SwarmAutomatedPage() {
  const [status, setStatus] = useState<SwarmStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiToken, setApiToken] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('fly_api_token') || ''
    if (token) {
      setApiToken(token)
      setIsConfigured(true)
    }
  }, [])

  useEffect(() => {
    if (isConfigured && autoRefresh) {
      const interval = setInterval(fetchSwarmStatus, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [isConfigured, autoRefresh])

  const fetchSwarmStatus = async () => {
    if (!apiToken) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/swarm-status', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }

  const handleApiTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (apiToken.trim()) {
      localStorage.setItem('fly_api_token', apiToken.trim())
      setIsConfigured(true)
      fetchSwarmStatus()
    }
  }

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      started: 'bg-green-100 text-green-800',
      stopped: 'bg-gray-100 text-gray-800',
      starting: 'bg-blue-100 text-blue-800',
      stopping: 'bg-yellow-100 text-yellow-800',
      created: 'bg-purple-100 text-purple-800',
      destroying: 'bg-red-100 text-red-800',
      destroyed: 'bg-red-100 text-red-800',
    }
    return colors[state] || 'bg-gray-100 text-gray-800'
  }

  const getStateIcon = (state: string) => {
    const icons: Record<string, string> = {
      started: '🟢',
      stopped: '⚫',
      starting: '🔵',
      stopping: '🟡',
      created: '🟣',
      destroying: '🔴',
      destroyed: '🔴',
    }
    return icons[state] || '⚫'
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Automated Swarm Status
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Monitor all swarm machines across apps
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleApiTokenSubmit}>
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

            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Connect & View Status
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Automated Swarm Status</h1>
            <p className="text-gray-600 mt-1">
              Real-time status of all swarm machines
            </p>
            {status && (
              <p className="text-sm text-gray-500 mt-1">
                Last updated: {new Date(status.timestamp).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Auto-refresh (30s)</span>
            </label>
            <button
              onClick={fetchSwarmStatus}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
            <button
              onClick={() => setIsConfigured(false)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Change Token
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Initial Load */}
        {!status && !loading && !error && (
          <div className="text-center py-12">
            <p className="text-gray-500">Click refresh to load swarm status</p>
          </div>
        )}

        {/* Status Grid */}
        {status && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {status.apps.map((app) => (
              <div key={app.app} className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">{app.app}</h2>
                    {app.status === 'error' ? (
                      <span className="text-sm text-red-600">Error: {app.error}</span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {app.machines.length} machine{app.machines.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  {app.status === 'success' && app.machines.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No machines found
                    </p>
                  )}
                  
                  {app.machines.map((machine) => (
                    <div key={machine.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{getStateIcon(machine.state)}</span>
                          <div>
                            <h4 className="font-medium">{machine.name}</h4>
                            <p className="text-xs text-gray-500 font-mono">
                              {machine.id}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStateColor(machine.state)}`}>
                          {machine.state}
                        </span>
                      </div>
                      
                      <div className="mt-3 space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>Region:</span>
                          <span className="font-mono">{machine.region}</span>
                        </div>
                        {machine.private_ip && (
                          <div className="flex justify-between">
                            <span>Private IP:</span>
                            <span className="font-mono">{machine.private_ip}</span>
                          </div>
                        )}
                        {machine.config.guest && (
                          <div className="flex justify-between">
                            <span>Resources:</span>
                            <span className="font-mono">
                              {machine.config.guest.cpus} CPU, {machine.config.guest.memory_mb} MB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Summary Stats */}
                  {app.machines.length > 0 && (
                    <div className="pt-4 border-t">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <div className="text-lg font-bold text-green-600">
                            {app.machines.filter(m => m.state === 'started').length}
                          </div>
                          <div className="text-xs text-gray-500">Running</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-600">
                            {app.machines.filter(m => m.state === 'stopped').length}
                          </div>
                          <div className="text-xs text-gray-500">Stopped</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overall Summary */}
        {status && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Overall Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {status.apps.reduce((acc, app) => acc + app.machines.length, 0)}
                </div>
                <div className="text-sm text-gray-500">Total Machines</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {status.apps.reduce((acc, app) => 
                    acc + app.machines.filter(m => m.state === 'started').length, 0
                  )}
                </div>
                <div className="text-sm text-gray-500">Running</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">
                  {status.apps.reduce((acc, app) => 
                    acc + app.machines.filter(m => m.state === 'stopped').length, 0
                  )}
                </div>
                <div className="text-sm text-gray-500">Stopped</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {status.apps.length}
                </div>
                <div className="text-sm text-gray-500">Apps</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}