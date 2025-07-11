import { z } from 'zod'

// Machine Configuration Schemas
const MachineGuestSchema = z.object({
  cpus: z.number().optional(),
  memory_mb: z.number().optional(),
  cpu_kind: z.string().optional(),
  gpu_kind: z.string().optional(),
  host_dedication_id: z.string().optional(),
})

const MachineServiceSchema = z.object({
  protocol: z.enum(['tcp', 'udp']).optional(),
  internal_port: z.number(),
  ports: z.array(z.object({
    port: z.number(),
    handlers: z.array(z.string()).optional(),
  })).optional(),
  concurrency: z.object({
    type: z.enum(['requests', 'connections']).optional(),
    soft_limit: z.number().optional(),
    hard_limit: z.number().optional(),
  }).optional(),
})

const MachineConfigSchema = z.object({
  image: z.string(),
  env: z.record(z.string()).optional(),
  cmd: z.array(z.string()).optional(),
  entrypoint: z.array(z.string()).optional(),
  guest: MachineGuestSchema.optional(),
  services: z.array(MachineServiceSchema).optional(),
  mounts: z.array(z.object({
    source: z.string(),
    destination: z.string(),
    type: z.string().optional(),
  })).optional(),
  restart: z.object({
    policy: z.enum(['no', 'always', 'on-failure']).optional(),
    max_retries: z.number().optional(),
  }).optional(),
  auto_destroy: z.boolean().optional(),
  schedule: z.string().optional(),
})

const MachineSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.enum(['created', 'starting', 'started', 'stopping', 'stopped', 'replacing', 'destroying', 'destroyed']),
  region: z.string(),
  instance_id: z.string().optional(),
  private_ip: z.string().optional(),
  config: MachineConfigSchema,
  image_ref: z.object({
    registry: z.string().optional(),
    repository: z.string().optional(),
    tag: z.string().optional(),
    digest: z.string().optional(),
  }).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  events: z.array(z.object({
    id: z.string(),
    type: z.string(),
    status: z.string(),
    timestamp: z.string(),
    request: z.record(z.any()).optional(),
  })).optional(),
})

const VolumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  size_gb: z.number(),
  region: z.string(),
  state: z.string(),
  attached_machine_id: z.string().optional(),
  created_at: z.string(),
  encrypted: z.boolean().optional(),
})

// Request/Response Schemas
const CreateMachineRequestSchema = z.object({
  config: MachineConfigSchema,
  name: z.string().optional(),
  region: z.string().optional(),
  lease_ttl: z.number().optional(),
})

const UpdateMachineRequestSchema = z.object({
  config: MachineConfigSchema.optional(),
  lease_ttl: z.number().optional(),
  lsvd: z.boolean().optional(),
})

const StopRequestSchema = z.object({
  signal: z.string().optional(),
  timeout: z.string().optional(),
})

const MachineExecRequestSchema = z.object({
  command: z.array(z.string()),
  timeout: z.string().optional(),
})

// Type exports
export type Machine = z.infer<typeof MachineSchema>
export type MachineConfig = z.infer<typeof MachineConfigSchema>
export type MachineGuest = z.infer<typeof MachineGuestSchema>
export type Volume = z.infer<typeof VolumeSchema>
export type CreateMachineRequest = z.infer<typeof CreateMachineRequestSchema>
export type UpdateMachineRequest = z.infer<typeof UpdateMachineRequestSchema>
export type StopRequest = z.infer<typeof StopRequestSchema>
export type MachineExecRequest = z.infer<typeof MachineExecRequestSchema>

export interface MachinesAPIConfig {
  apiToken: string
  baseUrl?: string
}

export class MachinesAPI {
  private apiToken: string
  private baseUrl: string

  constructor(config: MachinesAPIConfig) {
    this.apiToken = config.apiToken
    // Use our API proxy to avoid CORS issues
    this.baseUrl = config.baseUrl || '/api/machines'
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    searchParams?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API Error ${response.status}: ${error}`)
    }

    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  // Apps API
  async listApps(orgSlug: string) {
    return this.request<{ apps: Array<{ name: string; status: string; deployed: boolean }> }>(
      'GET',
      'apps',
      undefined,
      { org_slug: orgSlug }
    )
  }

  async createApp(request: { app_name: string; org_slug: string }) {
    return this.request('POST', 'apps', request)
  }

  async deleteApp(appName: string) {
    return this.request('DELETE', `apps/${appName}`)
  }

  // Machines API
  async listMachines(appName: string, options?: { 
    includeDeleted?: boolean
    region?: string 
  }): Promise<Machine[]> {
    const searchParams: Record<string, string> = {}
    if (options?.includeDeleted) {
      searchParams.include_deleted = 'true'
    }
    if (options?.region) {
      searchParams.region = options.region
    }

    const machines = await this.request<Machine[]>(
      'GET',
      `apps/${appName}/machines`,
      undefined,
      searchParams
    )
    
    return machines.map(machine => MachineSchema.parse(machine))
  }

  async getMachine(appName: string, machineId: string): Promise<Machine> {
    const machine = await this.request<Machine>('GET', `apps/${appName}/machines/${machineId}`)
    return MachineSchema.parse(machine)
  }

  async createMachine(appName: string, request: CreateMachineRequest): Promise<Machine> {
    const validatedRequest = CreateMachineRequestSchema.parse(request)
    const machine = await this.request<Machine>('POST', `apps/${appName}/machines`, validatedRequest)
    return MachineSchema.parse(machine)
  }

  async updateMachine(
    appName: string, 
    machineId: string, 
    request: UpdateMachineRequest
  ): Promise<Machine> {
    const validatedRequest = UpdateMachineRequestSchema.parse(request)
    const machine = await this.request<Machine>(
      'POST',
      `apps/${appName}/machines/${machineId}`,
      validatedRequest
    )
    return MachineSchema.parse(machine)
  }

  async deleteMachine(appName: string, machineId: string): Promise<void> {
    await this.request('DELETE', `apps/${appName}/machines/${machineId}`)
  }

  // Machine Lifecycle
  async startMachine(appName: string, machineId: string): Promise<void> {
    await this.request('POST', `apps/${appName}/machines/${machineId}/start`)
  }

  async stopMachine(
    appName: string, 
    machineId: string, 
    request?: StopRequest
  ): Promise<void> {
    const validatedRequest = request ? StopRequestSchema.parse(request) : undefined
    await this.request('POST', `apps/${appName}/machines/${machineId}/stop`, validatedRequest)
  }

  async restartMachine(
    appName: string, 
    machineId: string, 
    options?: { timeout?: string }
  ): Promise<void> {
    const searchParams = options?.timeout ? { timeout: options.timeout } : undefined
    await this.request(
      'POST',
      `apps/${appName}/machines/${machineId}/restart`,
      undefined,
      searchParams
    )
  }

  async suspendMachine(appName: string, machineId: string): Promise<void> {
    await this.request('POST', `apps/${appName}/machines/${machineId}/suspend`)
  }

  async signalMachine(
    appName: string, 
    machineId: string, 
    signal: { type: string }
  ): Promise<void> {
    await this.request('POST', `apps/${appName}/machines/${machineId}/signal`, signal)
  }

  // Machine Monitoring
  async getMachineEvents(appName: string, machineId: string) {
    return this.request<Array<{
      id: string
      type: string
      status: string
      timestamp: string
      request?: Record<string, any>
    }>>('GET', `apps/${appName}/machines/${machineId}/events`)
  }

  async waitForMachineState(
    appName: string,
    machineId: string,
    options?: { state?: string; timeout?: number }
  ): Promise<void> {
    const searchParams: Record<string, string> = {}
    if (options?.state) {
      searchParams.state = options.state
    }
    if (options?.timeout) {
      searchParams.timeout = options.timeout.toString()
    }

    await this.request(
      'GET',
      `apps/${appName}/machines/${machineId}/wait`,
      undefined,
      searchParams
    )
  }

  async listMachineProcesses(appName: string, machineId: string) {
    return this.request<Array<{
      pid: number
      command: string
      cpu_time: string
      directory: string
      rss: number
      rtime: string
      stime: string
      vsz: number
    }>>('GET', `apps/${appName}/machines/${machineId}/ps`)
  }

  async execMachine(
    appName: string,
    machineId: string,
    request: MachineExecRequest
  ) {
    const validatedRequest = MachineExecRequestSchema.parse(request)
    return this.request<{
      exit_code: number
      exit_signal: number
      stdout: string
      stderr: string
    }>('POST', `apps/${appName}/machines/${machineId}/exec`, validatedRequest)
  }

  // Machine Leasing
  async getMachineLease(appName: string, machineId: string) {
    return this.request<{
      status: string
      data?: {
        owner: string
        description: string
        expires_at: number
        nonce: string
      }
    }>('GET', `apps/${appName}/machines/${machineId}/lease`)
  }

  async createMachineLease(
    appName: string,
    machineId: string,
    request: { ttl?: number; description?: string }
  ) {
    return this.request('POST', `apps/${appName}/machines/${machineId}/lease`, request)
  }

  async deleteMachineLease(appName: string, machineId: string) {
    return this.request('DELETE', `apps/${appName}/machines/${machineId}/lease`)
  }

  // Volumes API
  async listVolumes(appName: string): Promise<Volume[]> {
    const volumes = await this.request<Volume[]>('GET', `apps/${appName}/volumes`)
    return volumes.map(volume => VolumeSchema.parse(volume))
  }

  async getVolume(appName: string, volumeId: string): Promise<Volume> {
    const volume = await this.request<Volume>('GET', `apps/${appName}/volumes/${volumeId}`)
    return VolumeSchema.parse(volume)
  }

  async createVolume(appName: string, request: {
    name: string
    size_gb: number
    region: string
    encrypted?: boolean
    snapshot_id?: string
  }): Promise<Volume> {
    const volume = await this.request<Volume>('POST', `apps/${appName}/volumes`, request)
    return VolumeSchema.parse(volume)
  }

  async updateVolume(appName: string, volumeId: string, request: {
    size_gb?: number
    auto_backup_enabled?: boolean
  }): Promise<Volume> {
    const volume = await this.request<Volume>('PUT', `apps/${appName}/volumes/${volumeId}`, request)
    return VolumeSchema.parse(volume)
  }

  async deleteVolume(appName: string, volumeId: string): Promise<Volume> {
    const volume = await this.request<Volume>('DELETE', `apps/${appName}/volumes/${volumeId}`)
    return VolumeSchema.parse(volume)
  }

  async extendVolume(appName: string, volumeId: string, sizeGb: number) {
    return this.request('PUT', `apps/${appName}/volumes/${volumeId}/extend`, {
      size_gb: sizeGb
    })
  }

  // Utility methods for swarm management
  async getSwarmStatus(appName: string) {
    const machines = await this.listMachines(appName)
    const volumes = await this.listVolumes(appName)
    
    const status = {
      total_machines: machines.length,
      running_machines: machines.filter(m => m.state === 'started').length,
      stopped_machines: machines.filter(m => m.state === 'stopped').length,
      failed_machines: machines.filter(m => m.state === 'destroyed').length,
      total_volumes: volumes.length,
      regions: [...new Set(machines.map(m => m.region))],
      machines,
      volumes
    }

    return status
  }

  async scaleSwarm(appName: string, targetCount: number, config: MachineConfig) {
    const currentMachines = await this.listMachines(appName)
    const runningMachines = currentMachines.filter(m => m.state === 'started')
    
    if (runningMachines.length < targetCount) {
      // Scale up
      const machinePromises = []
      for (let i = runningMachines.length; i < targetCount; i++) {
        machinePromises.push(this.createMachine(appName, {
          config,
          name: `swarm-${i + 1}`,
        }))
      }
      const newMachines = await Promise.all(machinePromises)
      
      // Start the new machines
      await Promise.all(newMachines.map(machine => 
        this.startMachine(appName, machine.id)
      ))
      
      return newMachines
    } else if (runningMachines.length > targetCount) {
      // Scale down
      const machinesToStop = runningMachines.slice(targetCount)
      await Promise.all(machinesToStop.map(machine => 
        this.stopMachine(appName, machine.id)
      ))
      
      return machinesToStop
    }
    
    return []
  }
}

// Default instance (will be configured with environment variables)
export const machinesApi = new MachinesAPI({
  apiToken: process.env.FLY_API_TOKEN || '',
})