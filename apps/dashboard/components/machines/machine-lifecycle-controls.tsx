'use client'

import React, { useState, useEffect } from 'react'
import { Machine, MachinesAPI } from '@/lib/machines-api'

interface MachineLifecycleControlsProps {
  appName: string
  machine: Machine
  onMachineUpdate: (machine: Machine) => void
  apiToken: string
}

export function MachineLifecycleControls({ 
  appName, 
  machine, 
  onMachineUpdate,
  apiToken 
}: MachineLifecycleControlsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [machinesApi] = useState(() => new MachinesAPI({ apiToken }))

  const handleAction = async (action: () => Promise<void>, successMessage: string) => {
    setLoading(true)
    setError(null)
    try {
      await action()
      // Refresh machine state
      const updatedMachine = await machinesApi.getMachine(appName, machine.id)
      onMachineUpdate(updatedMachine)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  const startMachine = () => handleAction(
    () => machinesApi.startMachine(appName, machine.id),
    'Machine started successfully'
  )

  const stopMachine = () => handleAction(
    () => machinesApi.stopMachine(appName, machine.id),
    'Machine stopped successfully'
  )

  const restartMachine = () => handleAction(
    () => machinesApi.restartMachine(appName, machine.id),
    'Machine restarted successfully'
  )

  const suspendMachine = () => handleAction(
    () => machinesApi.suspendMachine(appName, machine.id),
    'Machine suspended successfully'
  )

  const deleteMachine = () => {
    if (window.confirm('Are you sure you want to delete this machine? This action cannot be undone.')) {
      handleAction(
        () => machinesApi.deleteMachine(appName, machine.id),
        'Machine deleted successfully'
      )
    }
  }

  const getStateColor = (state: string) => {
    const colors = {
      started: 'bg-green-100 text-green-800 border-green-200',
      stopped: 'bg-gray-100 text-gray-800 border-gray-200',
      starting: 'bg-blue-100 text-blue-800 border-blue-200',
      stopping: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      created: 'bg-purple-100 text-purple-800 border-purple-200',
      destroying: 'bg-red-100 text-red-800 border-red-200',
      destroyed: 'bg-red-100 text-red-800 border-red-200',
      replacing: 'bg-orange-100 text-orange-800 border-orange-200',
    }
    return colors[state as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const canStart = ['stopped', 'created'].includes(machine.state)
  const canStop = ['started', 'starting'].includes(machine.state)
  const canRestart = machine.state === 'started'
  const canSuspend = machine.state === 'started'
  const canDelete = ['stopped', 'created', 'destroyed'].includes(machine.state)

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">
            Machine Lifecycle
          </h3>
          <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getStateColor(machine.state)}`}>
            {machine.state.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Control machine state and lifecycle operations
        </p>
      </div>
      
      <div className="p-6 pt-0 space-y-4">
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Machine Details</label>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{machine.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span>{machine.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Region:</span>
                <span>{machine.region}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Private IP:</span>
                <span className="font-mono">{machine.private_ip || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Resource Allocation</label>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPUs:</span>
                <span>{machine.config.guest?.cpus || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memory:</span>
                <span>{machine.config.guest?.memory_mb || 256} MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU Kind:</span>
                <span>{machine.config.guest?.cpu_kind || 'shared'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto Destroy:</span>
                <span>{machine.config.auto_destroy ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Lifecycle Actions</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={startMachine}
              disabled={!canStart || loading}
              className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${
                canStart 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V4a2 2 0 00-2-2H5a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2V4z" />
              </svg>
              Start
            </button>

            <button
              onClick={stopMachine}
              disabled={!canStop || loading}
              className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${
                canStop 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stop
            </button>

            <button
              onClick={restartMachine}
              disabled={!canRestart || loading}
              className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${
                canRestart 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restart
            </button>

            <button
              onClick={suspendMachine}
              disabled={!canSuspend || loading}
              className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${
                canSuspend 
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Suspend
            </button>
          </div>

          <button
            onClick={deleteMachine}
            disabled={!canDelete || loading}
            className={`w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${
              canDelete 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Machine
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm">Processing...</span>
          </div>
        )}
      </div>
    </div>
  )
}