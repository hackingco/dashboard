import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '../lib/logger'
import { ApiError } from '../middleware/error'

const execAsync = promisify(exec)

export interface FlyApp {
  name: string
  organization: string
  status: string
  hostname: string
  created_at: string
}

export interface FlyMachine {
  id: string
  name: string
  state: string
  region: string
  created_at: string
  updated_at: string
  config: {
    image: string
    env: Record<string, string>
    services: any[]
  }
}

export class FlyService {
  private apiToken: string

  constructor() {
    this.apiToken = process.env.FLY_API_TOKEN || ''
    if (!this.apiToken) {
      logger.warn('FLY_API_TOKEN not set, Fly.io operations will fail')
    }
  }

  async createApp(name: string, org: string = 'personal'): Promise<FlyApp> {
    try {
      const { stdout } = await execAsync(
        `flyctl apps create ${name} --org ${org} --json`,
        { env: { ...process.env, FLY_API_TOKEN: this.apiToken } }
      )
      return JSON.parse(stdout)
    } catch (error: any) {
      logger.error('Failed to create Fly app:', error)
      throw new ApiError(500, `Failed to create app: ${error.message}`)
    }
  }

  async deployApp(appName: string, config: any): Promise<void> {
    try {
      // Write fly.toml config
      const configPath = `/tmp/fly-${appName}.toml`
      await execAsync(`echo '${JSON.stringify(config)}' > ${configPath}`)

      // Deploy using fly deploy
      await execAsync(
        `flyctl deploy --app ${appName} --config ${configPath}`,
        { env: { ...process.env, FLY_API_TOKEN: this.apiToken } }
      )
    } catch (error: any) {
      logger.error('Failed to deploy Fly app:', error)
      throw new ApiError(500, `Failed to deploy app: ${error.message}`)
    }
  }

  async listMachines(appName: string): Promise<FlyMachine[]> {
    try {
      const { stdout } = await execAsync(
        `flyctl machines list --app ${appName} --json`,
        { env: { ...process.env, FLY_API_TOKEN: this.apiToken } }
      )
      return JSON.parse(stdout)
    } catch (error: any) {
      logger.error('Failed to list machines:', error)
      throw new ApiError(500, `Failed to list machines: ${error.message}`)
    }
  }

  async scaleMachines(appName: string, count: number): Promise<void> {
    try {
      await execAsync(
        `flyctl scale count ${count} --app ${appName}`,
        { env: { ...process.env, FLY_API_TOKEN: this.apiToken } }
      )
    } catch (error: any) {
      logger.error('Failed to scale machines:', error)
      throw new ApiError(500, `Failed to scale machines: ${error.message}`)
    }
  }

  async getMachineStatus(appName: string, machineId: string): Promise<FlyMachine> {
    try {
      const { stdout } = await execAsync(
        `flyctl machines show ${machineId} --app ${appName} --json`,
        { env: { ...process.env, FLY_API_TOKEN: this.apiToken } }
      )
      return JSON.parse(stdout)
    } catch (error: any) {
      logger.error('Failed to get machine status:', error)
      throw new ApiError(500, `Failed to get machine status: ${error.message}`)
    }
  }

  async destroyApp(appName: string): Promise<void> {
    try {
      await execAsync(
        `flyctl apps destroy ${appName} --yes`,
        { env: { ...process.env, FLY_API_TOKEN: this.apiToken } }
      )
    } catch (error: any) {
      logger.error('Failed to destroy app:', error)
      throw new ApiError(500, `Failed to destroy app: ${error.message}`)
    }
  }
}