'use client'

import React, { useState } from 'react'
import { MachineConfig, CreateMachineRequest, MachinesAPI } from '@/lib/machines-api'

interface MachineConfigEditorProps {
  appName: string
  apiToken: string
  initialConfig?: MachineConfig
  onMachineCreated?: (machine: any) => void
}

interface FormData {
  name: string
  region: string
  image: string
  cpus: number
  memory_mb: number
  cpu_kind: string
  env: Record<string, string>
  cmd: string[]
  entrypoint: string[]
  internal_port: number
  external_ports: Array<{ port: number; handlers: string[] }>
  volume_mounts: Array<{ source: string; destination: string; type: string }>
  restart_policy: 'no' | 'always' | 'on-failure'
  max_retries: number
  auto_destroy: boolean
  schedule: string
  concurrency_type: 'requests' | 'connections'
  soft_limit: number
  hard_limit: number
}

const defaultFormData: FormData = {
  name: '',
  region: 'iad',
  image: 'nginx:alpine',
  cpus: 1,
  memory_mb: 512,
  cpu_kind: 'shared',
  env: {},
  cmd: [],
  entrypoint: [],
  internal_port: 80,
  external_ports: [{ port: 80, handlers: ['http'] }],
  volume_mounts: [],
  restart_policy: 'always',
  max_retries: 3,
  auto_destroy: false,
  schedule: '',
  concurrency_type: 'requests',
  soft_limit: 25,
  hard_limit: 50
}

export function MachineConfigEditor({ 
  appName, 
  apiToken, 
  initialConfig,
  onMachineCreated 
}: MachineConfigEditorProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [machinesApi] = useState(() => new MachinesAPI({ apiToken }))

  const [envInput, setEnvInput] = useState({ key: '', value: '' })
  const [cmdInput, setCmdInput] = useState('')
  const [entrypointInput, setEntrypointInput] = useState('')
  const [portInput, setPortInput] = useState({ port: 80, handlers: 'http' })
  const [mountInput, setMountInput] = useState({ source: '', destination: '', type: 'volume' })

  const regions = [
    { code: 'iad', name: 'Washington D.C. (IAD)' },
    { code: 'ord', name: 'Chicago (ORD)' },
    { code: 'lax', name: 'Los Angeles (LAX)' },
    { code: 'sjc', name: 'San Jose (SJC)' },
    { code: 'lhr', name: 'London (LHR)' },
    { code: 'ams', name: 'Amsterdam (AMS)' },
    { code: 'fra', name: 'Frankfurt (FRA)' },
    { code: 'nrt', name: 'Tokyo (NRT)' },
    { code: 'hkg', name: 'Hong Kong (HKG)' },
    { code: 'syd', name: 'Sydney (SYD)' }
  ]

  const addEnvVar = () => {
    if (envInput.key && envInput.value) {
      setFormData(prev => ({
        ...prev,
        env: { ...prev.env, [envInput.key]: envInput.value }
      }))
      setEnvInput({ key: '', value: '' })
    }
  }

  const removeEnvVar = (key: string) => {
    setFormData(prev => {
      const newEnv = { ...prev.env }
      delete newEnv[key]
      return { ...prev, env: newEnv }
    })
  }

  const addCmd = () => {
    if (cmdInput.trim()) {
      setFormData(prev => ({
        ...prev,
        cmd: [...prev.cmd, cmdInput.trim()]
      }))
      setCmdInput('')
    }
  }

  const removeCmd = (index: number) => {
    setFormData(prev => ({
      ...prev,
      cmd: prev.cmd.filter((_, i) => i !== index)
    }))
  }

  const addEntrypoint = () => {
    if (entrypointInput.trim()) {
      setFormData(prev => ({
        ...prev,
        entrypoint: [...prev.entrypoint, entrypointInput.trim()]
      }))
      setEntrypointInput('')
    }
  }

  const removeEntrypoint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      entrypoint: prev.entrypoint.filter((_, i) => i !== index)
    }))
  }

  const addPort = () => {
    if (portInput.port) {
      setFormData(prev => ({
        ...prev,
        external_ports: [...prev.external_ports, {
          port: portInput.port,
          handlers: portInput.handlers.split(',').map(h => h.trim())
        }]
      }))
      setPortInput({ port: 80, handlers: 'http' })
    }
  }

  const removePort = (index: number) => {
    setFormData(prev => ({
      ...prev,
      external_ports: prev.external_ports.filter((_, i) => i !== index)
    }))
  }

  const addMount = () => {
    if (mountInput.source && mountInput.destination) {
      setFormData(prev => ({
        ...prev,
        volume_mounts: [...prev.volume_mounts, mountInput]
      }))
      setMountInput({ source: '', destination: '', type: 'volume' })
    }
  }

  const removeMount = (index: number) => {
    setFormData(prev => ({
      ...prev,
      volume_mounts: prev.volume_mounts.filter((_, i) => i !== index)
    }))
  }

  const buildMachineConfig = (): MachineConfig => {
    const config: MachineConfig = {
      image: formData.image,
      guest: {
        cpus: formData.cpus,
        memory_mb: formData.memory_mb,
        cpu_kind: formData.cpu_kind,
      },
      restart: {
        policy: formData.restart_policy,
        max_retries: formData.max_retries,
      },
      auto_destroy: formData.auto_destroy,
    }

    if (Object.keys(formData.env).length > 0) {
      config.env = formData.env
    }

    if (formData.cmd.length > 0) {
      config.cmd = formData.cmd
    }

    if (formData.entrypoint.length > 0) {
      config.entrypoint = formData.entrypoint
    }

    if (formData.schedule) {
      config.schedule = formData.schedule
    }

    if (formData.internal_port) {
      config.services = [{
        internal_port: formData.internal_port,
        ports: formData.external_ports,
        concurrency: {
          type: formData.concurrency_type,
          soft_limit: formData.soft_limit,
          hard_limit: formData.hard_limit,
        }
      }]
    }

    if (formData.volume_mounts.length > 0) {
      config.mounts = formData.volume_mounts
    }

    return config
  }

  const createMachine = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const config = buildMachineConfig()
      const request: CreateMachineRequest = {
        config,
        name: formData.name,
        region: formData.region,
      }

      const machine = await machinesApi.createMachine(appName, request)
      setSuccess(`Machine ${machine.name} created successfully with ID: ${machine.id}`)
      
      // Start the machine
      await machinesApi.startMachine(appName, machine.id)
      setSuccess(`Machine ${machine.name} created and started successfully`)
      
      onMachineCreated?.(machine)
      
      // Reset form
      setFormData(defaultFormData)
      setEnvInput({ key: '', value: '' })
      setCmdInput('')
      setEntrypointInput('')
      setPortInput({ port: 80, handlers: 'http' })
      setMountInput({ source: '', destination: '', type: 'volume' })
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create machine')
    } finally {
      setLoading(false)
    }
  }

  const exportConfig = () => {
    const config = buildMachineConfig()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `machine-config-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'basic', label: 'Basic', icon: '⚙️' },
    { id: 'compute', label: 'Compute', icon: '💻' },
    { id: 'network', label: 'Network', icon: '🌐' },
    { id: 'storage', label: 'Storage', icon: '💾' },
    { id: 'runtime', label: 'Runtime', icon: '🚀' },
    { id: 'advanced', label: 'Advanced', icon: '🔧' }
  ]

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">
          Machine Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure and deploy new machines to your swarm
        </p>
      </div>

      <div className="p-6 pt-0">
        {/* Status Messages */}
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-md bg-green-50 border border-green-200 mb-4">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Machine Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="my-machine"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Region</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {regions.map(region => (
                      <option key={region.code} value={region.code}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Container Image</label>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                  placeholder="nginx:alpine"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {activeTab === 'compute' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">CPUs</label>
                  <select
                    value={formData.cpus}
                    onChange={(e) => setFormData(prev => ({ ...prev, cpus: parseInt(e.target.value) }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value={1}>1 CPU</option>
                    <option value={2}>2 CPUs</option>
                    <option value={4}>4 CPUs</option>
                    <option value={8}>8 CPUs</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Memory (MB)</label>
                  <select
                    value={formData.memory_mb}
                    onChange={(e) => setFormData(prev => ({ ...prev, memory_mb: parseInt(e.target.value) }))}
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

                <div>
                  <label className="text-sm font-medium">CPU Kind</label>
                  <select
                    value={formData.cpu_kind}
                    onChange={(e) => setFormData(prev => ({ ...prev, cpu_kind: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="shared">Shared</option>
                    <option value="performance">Performance</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Internal Port</label>
                <input
                  type="number"
                  value={formData.internal_port}
                  onChange={(e) => setFormData(prev => ({ ...prev, internal_port: parseInt(e.target.value) || 80 }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium">External Ports</label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder="Port"
                      value={portInput.port}
                      onChange={(e) => setPortInput(prev => ({ ...prev, port: parseInt(e.target.value) || 80 }))}
                      className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                      type="text"
                      placeholder="Handlers (http,tls)"
                      value={portInput.handlers}
                      onChange={(e) => setPortInput(prev => ({ ...prev, handlers: e.target.value }))}
                      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={addPort}
                      className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  
                  {formData.external_ports.map((port, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span>Port {port.port} ({port.handlers.join(', ')})</span>
                      <button
                        onClick={() => removePort(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Concurrency Type</label>
                  <select
                    value={formData.concurrency_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, concurrency_type: e.target.value as 'requests' | 'connections' }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="requests">Requests</option>
                    <option value="connections">Connections</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Soft Limit</label>
                  <input
                    type="number"
                    value={formData.soft_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, soft_limit: parseInt(e.target.value) || 25 }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Hard Limit</label>
                  <input
                    type="number"
                    value={formData.hard_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, hard_limit: parseInt(e.target.value) || 50 }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Volume Mounts</label>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Source"
                      value={mountInput.source}
                      onChange={(e) => setMountInput(prev => ({ ...prev, source: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                      type="text"
                      placeholder="Destination"
                      value={mountInput.destination}
                      onChange={(e) => setMountInput(prev => ({ ...prev, destination: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <select
                      value={mountInput.type}
                      onChange={(e) => setMountInput(prev => ({ ...prev, type: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="volume">Volume</option>
                      <option value="bind">Bind</option>
                    </select>
                    <button
                      type="button"
                      onClick={addMount}
                      className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  
                  {formData.volume_mounts.map((mount, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span>{mount.source} → {mount.destination} ({mount.type})</span>
                      <button
                        onClick={() => removeMount(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'runtime' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Environment Variables</label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Key"
                      value={envInput.key}
                      onChange={(e) => setEnvInput(prev => ({ ...prev, key: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={envInput.value}
                      onChange={(e) => setEnvInput(prev => ({ ...prev, value: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={addEnvVar}
                      className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  
                  {Object.entries(formData.env).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">{key}={value}</span>
                      <button
                        onClick={() => removeEnvVar(key)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Command</label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Command argument"
                      value={cmdInput}
                      onChange={(e) => setCmdInput(e.target.value)}
                      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={addCmd}
                      className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  
                  {formData.cmd.map((cmd, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">{cmd}</span>
                      <button
                        onClick={() => removeCmd(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Entrypoint</label>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Entrypoint argument"
                      value={entrypointInput}
                      onChange={(e) => setEntrypointInput(e.target.value)}
                      className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={addEntrypoint}
                      className="h-10 px-4 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                  
                  {formData.entrypoint.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">{entry}</span>
                      <button
                        onClick={() => removeEntrypoint(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Restart Policy</label>
                  <select
                    value={formData.restart_policy}
                    onChange={(e) => setFormData(prev => ({ ...prev, restart_policy: e.target.value as 'no' | 'always' | 'on-failure' }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="no">No</option>
                    <option value="always">Always</option>
                    <option value="on-failure">On Failure</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Max Retries</label>
                  <input
                    type="number"
                    value={formData.max_retries}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_retries: parseInt(e.target.value) || 3 }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Schedule (Cron format)</label>
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                  placeholder="0 */6 * * * (every 6 hours)"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoDestroy"
                  checked={formData.auto_destroy}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto_destroy: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="autoDestroy" className="text-sm font-medium">
                  Auto-destroy when stopped
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-4 pt-6 border-t">
          <button
            onClick={createMachine}
            disabled={loading || !formData.name}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {loading ? 'Creating...' : 'Create & Start Machine'}
          </button>

          <button
            onClick={exportConfig}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Export Config
          </button>

          <button
            onClick={() => {
              setFormData(defaultFormData)
              setEnvInput({ key: '', value: '' })
              setCmdInput('')
              setEntrypointInput('')
              setPortInput({ port: 80, handlers: 'http' })
              setMountInput({ source: '', destination: '', type: 'volume' })
            }}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Reset Form
          </button>
        </div>
      </div>
    </div>
  )
}