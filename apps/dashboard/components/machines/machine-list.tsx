'use client'

import React, { useState, useEffect } from 'react'
import { Machine, MachinesAPI } from '@/lib/machines-api'

interface MachineListProps {
  appName: string
  apiToken: string
  onMachineSelect?: (machine: Machine) => void
  selectedMachine?: Machine
}

export function MachineList({ 
  appName, 
  apiToken, 
  onMachineSelect,
  selectedMachine 
}: MachineListProps) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState({
    state: '',
    region: '',
    search: ''
  })
  const [machinesApi] = useState(() => new MachinesAPI({ apiToken }))

  useEffect(() => {
    loadMachines()
  }, [appName])

  const loadMachines = async () => {
    setLoading(true)
    setError(null)
    try {
      const machineList = await machinesApi.listMachines(appName, { 
        includeDeleted: true 
      })
      setMachines(machineList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load machines')
    } finally {
      setLoading(false)
    }
  }

  const getStateColor = (state: string) => {
    const colors = {
      started: 'bg-green-100 text-green-800',
      stopped: 'bg-gray-100 text-gray-800',
      starting: 'bg-blue-100 text-blue-800',
      stopping: 'bg-yellow-100 text-yellow-800',
      created: 'bg-purple-100 text-purple-800',
      destroying: 'bg-red-100 text-red-800',
      destroyed: 'bg-red-100 text-red-800',
      replacing: 'bg-orange-100 text-orange-800',
    }
    return colors[state as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getStateIcon = (state: string) => {
    const icons = {
      started: '🟢',
      stopped: '⚫',
      starting: '🔵',
      stopping: '🟡',
      created: '🟣',
      destroying: '🔴',
      destroyed: '🔴',
      replacing: '🟠',
    }
    return icons[state as keyof typeof icons] || '⚫'
  }

  const filteredMachines = machines.filter(machine => {
    if (filter.state && machine.state !== filter.state) return false
    if (filter.region && machine.region !== filter.region) return false
    if (filter.search && !machine.name.toLowerCase().includes(filter.search.toLowerCase()) &&
        !machine.id.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  const uniqueStates = [...new Set(machines.map(m => m.state))]
  const uniqueRegions = [...new Set(machines.map(m => m.region))]

  const getResourceUsage = (machine: Machine) => {
    const cpus = machine.config.guest?.cpus || 1
    const memory = machine.config.guest?.memory_mb || 256
    return { cpus, memory }
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">Machines</h3>
        </div>
        <div className="p-6 pt-0">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading machines...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">Machines</h3>
        </div>
        <div className="p-6 pt-0">
          <div className="p-4 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={loadMachines}
              className="mt-2 text-sm text-red-700 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">
            Machines ({filteredMachines.length})
          </h3>
          <button
            onClick={loadMachines}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
      
      <div className="p-6 pt-0 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium">Search</label>
            <input
              type="text"
              placeholder="Name or ID..."
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">State</label>
            <select
              value={filter.state}
              onChange={(e) => setFilter(prev => ({ ...prev, state: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">All States</option>
              {uniqueStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium">Region</label>
            <select
              value={filter.region}
              onChange={(e) => setFilter(prev => ({ ...prev, region: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">All Regions</option>
              {uniqueRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilter({ state: '', region: '', search: '' })}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Machine List */}
        {filteredMachines.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No machines found matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMachines.map((machine) => {
              const { cpus, memory } = getResourceUsage(machine)
              const isSelected = selectedMachine?.id === machine.id
              
              return (
                <div
                  key={machine.id}
                  onClick={() => onMachineSelect?.(machine)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getStateIcon(machine.state)}</span>
                      <div>
                        <h4 className="font-medium">{machine.name}</h4>
                        <p className="text-sm text-muted-foreground font-mono">
                          {machine.id.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{machine.region}</p>
                        <p className="text-xs text-muted-foreground">
                          {cpus} CPU • {memory} MB
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStateColor(machine.state)}`}>
                        {machine.state}
                      </span>
                    </div>
                  </div>
                  
                  {machine.private_ip && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-muted-foreground">
                        IP: <span className="font-mono">{machine.private_ip}</span>
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary Stats */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-600">
                {machines.filter(m => m.state === 'started').length}
              </div>
              <div className="text-xs text-muted-foreground">Running</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-600">
                {machines.filter(m => m.state === 'stopped').length}
              </div>
              <div className="text-xs text-muted-foreground">Stopped</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {machines.filter(m => ['starting', 'stopping'].includes(m.state)).length}
              </div>
              <div className="text-xs text-muted-foreground">Transitioning</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600">
                {machines.filter(m => ['destroying', 'destroyed'].includes(m.state)).length}
              </div>
              <div className="text-xs text-muted-foreground">Failed/Destroyed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}