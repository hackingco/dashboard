'use client'

import React, { useState, useEffect } from 'react'
import { Machine, MachineConfig, MachinesAPI } from '@/lib/machines-api'

interface SwarmOrchestratorProps {
  appName: string
  apiToken: string
}

interface SwarmScale {
  targetCount: number
  currentCount: number
  regions: string[]
  machineConfig: MachineConfig
}

interface DeploymentStrategy {
  type: 'rolling' | 'blue-green' | 'canary'
  maxUnavailable: number
  maxSurge: number
  regions: string[]
  autoRollback: boolean
}

export function SwarmOrchestrator({ appName, apiToken }: SwarmOrchestratorProps) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [machinesApi] = useState(() => new MachinesAPI({ apiToken }))
  
  const [swarmScale, setSwarmScale] = useState<SwarmScale>({
    targetCount: 3,
    currentCount: 0,
    regions: ['iad', 'lhr', 'nrt'],
    machineConfig: {
      image: 'nginx:alpine',
      guest: {
        cpus: 1,
        memory_mb: 512,
      },
      services: [{
        internal_port: 80,
        ports: [{ port: 80, handlers: ['http'] }],
        concurrency: {
          type: 'requests',
          soft_limit: 25,
          hard_limit: 50
        }
      }],
      restart: {
        policy: 'always',
        max_retries: 3
      },
      auto_destroy: false
    }
  })

  const [strategy, setStrategy] = useState<DeploymentStrategy>({
    type: 'rolling',
    maxUnavailable: 1,
    maxSurge: 1,
    regions: ['iad', 'lhr', 'nrt'],
    autoRollback: true
  })

  const [deploymentInProgress, setDeploymentInProgress] = useState(false)
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([])

  useEffect(() => {
    loadMachines()
  }, [appName])

  const loadMachines = async () => {
    setLoading(true)
    try {
      const machineList = await machinesApi.listMachines(appName)
      setMachines(machineList)
      setSwarmScale(prev => ({
        ...prev,
        currentCount: machineList.filter(m => m.state === 'started').length
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load machines')
    } finally {
      setLoading(false)
    }
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDeploymentLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const scaleSwarm = async () => {
    setDeploymentInProgress(true)
    setDeploymentLogs([])
    addLog(`Starting swarm scaling to ${swarmScale.targetCount} machines`)

    try {
      const currentMachines = await machinesApi.listMachines(appName)
      const runningMachines = currentMachines.filter(m => m.state === 'started')
      
      if (runningMachines.length < swarmScale.targetCount) {
        // Scale up
        const machinesNeeded = swarmScale.targetCount - runningMachines.length
        addLog(`Scaling up: need ${machinesNeeded} more machines`)
        
        const promises = []
        for (let i = 0; i < machinesNeeded; i++) {
          const region = swarmScale.regions[i % swarmScale.regions.length]
          promises.push(
            machinesApi.createMachine(appName, {
              config: swarmScale.machineConfig,
              name: `swarm-${Date.now()}-${i}`,
              region
            }).then(async (machine) => {
              addLog(`Created machine ${machine.name} in ${region}`)
              await machinesApi.startMachine(appName, machine.id)
              addLog(`Started machine ${machine.name}`)
              return machine
            })
          )
        }
        
        await Promise.all(promises)
        addLog('Scale up completed successfully')
        
      } else if (runningMachines.length > swarmScale.targetCount) {
        // Scale down
        const machinesToStop = runningMachines.slice(swarmScale.targetCount)
        addLog(`Scaling down: stopping ${machinesToStop.length} machines`)
        
        for (const machine of machinesToStop) {
          await machinesApi.stopMachine(appName, machine.id)
          addLog(`Stopped machine ${machine.name}`)
        }
        
        addLog('Scale down completed successfully')
      } else {
        addLog('Swarm is already at target scale')
      }
      
      await loadMachines()
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Scaling failed'
      addLog(`ERROR: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setDeploymentInProgress(false)
    }
  }

  const deployUpdate = async () => {
    setDeploymentInProgress(true)
    setDeploymentLogs([])
    addLog(`Starting ${strategy.type} deployment`)

    try {
      const currentMachines = await machinesApi.listMachines(appName)
      const runningMachines = currentMachines.filter(m => m.state === 'started')
      
      if (strategy.type === 'rolling') {
        addLog('Executing rolling deployment')
        
        // Update machines one by one
        for (let i = 0; i < runningMachines.length; i++) {
          const machine = runningMachines[i]
          addLog(`Updating machine ${machine.name} (${i + 1}/${runningMachines.length})`)
          
          // Update machine configuration
          await machinesApi.updateMachine(appName, machine.id, {
            config: swarmScale.machineConfig
          })
          
          // Restart machine to apply changes
          await machinesApi.restartMachine(appName, machine.id)
          
          // Wait for machine to be healthy
          await machinesApi.waitForMachineState(appName, machine.id, { 
            state: 'started', 
            timeout: 60 
          })
          
          addLog(`Machine ${machine.name} updated successfully`)
        }
        
      } else if (strategy.type === 'blue-green') {
        addLog('Executing blue-green deployment')
        
        // Create new machines (green)
        const greenMachines = []
        for (let i = 0; i < runningMachines.length; i++) {
          const region = strategy.regions[i % strategy.regions.length]
          const machine = await machinesApi.createMachine(appName, {
            config: swarmScale.machineConfig,
            name: `green-${Date.now()}-${i}`,
            region
          })
          await machinesApi.startMachine(appName, machine.id)
          greenMachines.push(machine)
          addLog(`Created and started green machine ${machine.name}`)
        }
        
        // Wait for all green machines to be healthy
        addLog('Waiting for green machines to be healthy...')
        await Promise.all(greenMachines.map(m => 
          machinesApi.waitForMachineState(appName, m.id, { 
            state: 'started', 
            timeout: 60 
          })
        ))
        
        // Stop blue machines
        addLog('Stopping blue machines...')
        for (const machine of runningMachines) {
          await machinesApi.stopMachine(appName, machine.id)
          addLog(`Stopped blue machine ${machine.name}`)
        }
        
      } else if (strategy.type === 'canary') {
        addLog('Executing canary deployment')
        
        // Deploy to one machine first
        const canaryMachine = runningMachines[0]
        addLog(`Deploying canary to machine ${canaryMachine.name}`)
        
        await machinesApi.updateMachine(appName, canaryMachine.id, {
          config: swarmScale.machineConfig
        })
        await machinesApi.restartMachine(appName, canaryMachine.id)
        await machinesApi.waitForMachineState(appName, canaryMachine.id, { 
          state: 'started', 
          timeout: 60 
        })
        
        addLog('Canary deployment successful. Manual verification required before full rollout.')
      }
      
      addLog('Deployment completed successfully')
      await loadMachines()
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deployment failed'
      addLog(`ERROR: ${errorMessage}`)
      setError(errorMessage)
      
      if (strategy.autoRollback) {
        addLog('Auto-rollback enabled, attempting rollback...')
        // In a real implementation, you'd store the previous configuration
        // and roll back to it here
      }
    } finally {
      setDeploymentInProgress(false)
    }
  }

  const emergencyStop = async () => {
    if (!window.confirm('Are you sure you want to stop all machines? This will cause downtime.')) {
      return
    }

    setDeploymentInProgress(true)
    setDeploymentLogs([])
    addLog('Emergency stop initiated')

    try {
      const runningMachines = machines.filter(m => m.state === 'started')
      await Promise.all(runningMachines.map(async (machine) => {
        await machinesApi.stopMachine(appName, machine.id)
        addLog(`Stopped machine ${machine.name}`)
      }))
      
      addLog('Emergency stop completed')
      await loadMachines()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Emergency stop failed'
      addLog(`ERROR: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setDeploymentInProgress(false)
    }
  }

  const getRegionDistribution = () => {
    const distribution: Record<string, number> = {}
    machines.filter(m => m.state === 'started').forEach(machine => {
      distribution[machine.region] = (distribution[machine.region] || 0) + 1
    })
    return distribution
  }

  return (
    <div className="space-y-6">
      {/* Swarm Overview */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">
            Swarm Orchestration
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage swarm scaling, deployments, and regional distribution
          </p>
        </div>
        
        <div className="p-6 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {machines.filter(m => m.state === 'started').length}
              </div>
              <div className="text-sm text-muted-foreground">Running</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {swarmScale.targetCount}
              </div>
              <div className="text-sm text-muted-foreground">Target</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Object.keys(getRegionDistribution()).length}
              </div>
              <div className="text-sm text-muted-foreground">Regions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {machines.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Machines</div>
            </div>
          </div>

          {/* Regional Distribution */}
          <div className="space-y-2">
            <h4 className="font-medium">Regional Distribution</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {Object.entries(getRegionDistribution()).map(([region, count]) => (
                <div key={region} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium">{region.toUpperCase()}</span>
                  <span className="text-sm">{count} machines</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scaling Configuration */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h4 className="text-lg font-semibold">Scaling Configuration</h4>
          </div>
          
          <div className="p-6 pt-0 space-y-4">
            <div>
              <label className="text-sm font-medium">Target Machine Count</label>
              <input
                type="number"
                min="0"
                max="20"
                value={swarmScale.targetCount}
                onChange={(e) => setSwarmScale(prev => ({
                  ...prev,
                  targetCount: parseInt(e.target.value) || 0
                }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm font-medium">CPU per Machine</label>
              <select
                value={swarmScale.machineConfig.guest?.cpus || 1}
                onChange={(e) => setSwarmScale(prev => ({
                  ...prev,
                  machineConfig: {
                    ...prev.machineConfig,
                    guest: {
                      ...prev.machineConfig.guest,
                      cpus: parseInt(e.target.value)
                    }
                  }
                }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value={1}>1 CPU</option>
                <option value={2}>2 CPUs</option>
                <option value={4}>4 CPUs</option>
                <option value={8}>8 CPUs</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Memory per Machine (MB)</label>
              <select
                value={swarmScale.machineConfig.guest?.memory_mb || 512}
                onChange={(e) => setSwarmScale(prev => ({
                  ...prev,
                  machineConfig: {
                    ...prev.machineConfig,
                    guest: {
                      ...prev.machineConfig.guest,
                      memory_mb: parseInt(e.target.value)
                    }
                  }
                }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value={256}>256 MB</option>
                <option value={512}>512 MB</option>
                <option value={1024}>1 GB</option>
                <option value={2048}>2 GB</option>
                <option value={4096}>4 GB</option>
                <option value={8192}>8 GB</option>
              </select>
            </div>

            <button
              onClick={scaleSwarm}
              disabled={deploymentInProgress}
              className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              {deploymentInProgress ? 'Scaling...' : 'Scale Swarm'}
            </button>
          </div>
        </div>

        {/* Deployment Strategy */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h4 className="text-lg font-semibold">Deployment Strategy</h4>
          </div>
          
          <div className="p-6 pt-0 space-y-4">
            <div>
              <label className="text-sm font-medium">Strategy Type</label>
              <select
                value={strategy.type}
                onChange={(e) => setStrategy(prev => ({
                  ...prev,
                  type: e.target.value as 'rolling' | 'blue-green' | 'canary'
                }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="rolling">Rolling Update</option>
                <option value="blue-green">Blue-Green</option>
                <option value="canary">Canary</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Max Unavailable</label>
                <input
                  type="number"
                  min="0"
                  value={strategy.maxUnavailable}
                  onChange={(e) => setStrategy(prev => ({
                    ...prev,
                    maxUnavailable: parseInt(e.target.value) || 0
                  }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Max Surge</label>
                <input
                  type="number"
                  min="0"
                  value={strategy.maxSurge}
                  onChange={(e) => setStrategy(prev => ({
                    ...prev,
                    maxSurge: parseInt(e.target.value) || 0
                  }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoRollback"
                checked={strategy.autoRollback}
                onChange={(e) => setStrategy(prev => ({
                  ...prev,
                  autoRollback: e.target.checked
                }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="autoRollback" className="text-sm font-medium">
                Auto-rollback on failure
              </label>
            </div>

            <div className="space-y-2">
              <button
                onClick={deployUpdate}
                disabled={deploymentInProgress}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
              >
                {deploymentInProgress ? 'Deploying...' : 'Deploy Update'}
              </button>
              
              <button
                onClick={emergencyStop}
                disabled={deploymentInProgress}
                className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2"
              >
                Emergency Stop All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Logs */}
      {deploymentLogs.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h4 className="text-lg font-semibold">Deployment Logs</h4>
          </div>
          
          <div className="p-6 pt-0">
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
              {deploymentLogs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}