import logger from './logger';

export interface FlyApp {
  Name: string;
  Organization: {
    Name: string;
    Slug: string;
  };
  Status: string;
  Deployed: boolean;
  Hostname: string;
  AppUrl: string;
}

export interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
  instance_id: string;
  private_ip: string;
  created_at: string;
  updated_at: string;
  config: any;
  events?: any[];
}

export interface CreateAppRequest {
  app_name: string;
  org_slug?: string;
  network?: string;
}

export interface CreateAppResponse {
  id: string;
  name: string;
  machine_count: number;
  network: string;
  organization: {
    name: string;
    slug: string;
  };
}

/**
 * Fly.io API client for direct API operations
 * Replaces flyctl exec calls with direct HTTP API requests
 */
export class FlyAPIClient {
  private flyApiToken: string;
  private appsApiUrl: string = 'https://api.fly.io/graphql';
  private machinesApiUrl: string = 'https://api.machines.dev/v1';

  constructor() {
    this.flyApiToken = process.env.FLY_ACCESS_TOKEN || process.env.FLY_API_TOKEN || '';
    if (!this.flyApiToken) {
      logger.warn('FLY_ACCESS_TOKEN/FLY_API_TOKEN not set - Fly.io operations will fail');
    }
  }

  /**
   * Create a new Fly.io app using the GraphQL API
   */
  async createApp(appName: string, org = 'personal'): Promise<CreateAppResponse> {
    const mutation = `
      mutation CreateApp($input: CreateAppInput!) {
        createApp(input: $input) {
          app {
            id
            name
            machineCount
            network
            organization {
              name
              slug
            }
          }
        }
      }
    `;

    const variables = {
      input: {
        name: appName,
        organizationId: org,
        preferredRegion: 'dfw'
      }
    };

    try {
      const response = await this.graphqlRequest(mutation, variables);
      
      if (response.errors) {
        // Check if error is about app already existing
        const existsError = response.errors.find((err: any) => 
          err.message.includes('already exists') || 
          err.message.includes('duplicate') ||
          err.extensions?.code === 'DUPLICATE'
        );
        
        if (existsError) {
          logger.info(`App ${appName} already exists`);
          // Return a mock response for existing app
          return {
            id: appName,
            name: appName,
            machine_count: 0,
            network: 'default',
            organization: { name: org, slug: org }
          };
        }
        
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      const app = response.data.createApp.app;
      logger.info(`Created Fly app: ${appName}`, { 
        id: app.id, 
        organization: app.organization.slug 
      });

      return {
        id: app.id,
        name: app.name,
        machine_count: app.machineCount || 0,
        network: app.network || 'default',
        organization: app.organization
      };
    } catch (error: any) {
      // Handle network errors or API unavailability
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        logger.info(`App ${appName} already exists`);
        return {
          id: appName,
          name: appName,
          machine_count: 0,
          network: 'default',
          organization: { name: org, slug: org }
        };
      }
      logger.error('Failed to create app via API', { appName, error: error.message });
      throw error;
    }
  }

  /**
   * List all apps for the authenticated user using GraphQL API
   */
  async listApps(): Promise<FlyApp[]> {
    const query = `
      query ListApps {
        viewer {
          apps {
            nodes {
              name
              status
              deployed
              hostname
              appUrl
              organization {
                name
                slug
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphqlRequest(query);
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      const apps = response.data.viewer.apps.nodes;
      logger.info(`Listed ${apps.length} Fly apps`);

      return apps.map((app: any) => ({
        Name: app.name,
        Organization: {
          Name: app.organization.name,
          Slug: app.organization.slug
        },
        Status: app.status || 'unknown',
        Deployed: app.deployed || false,
        Hostname: app.hostname || '',
        AppUrl: app.appUrl || ''
      }));
    } catch (error: any) {
      logger.error('Failed to list apps via API', { error: error.message });
      throw error;
    }
  }

  /**
   * Destroy/delete a Fly.io app using GraphQL API
   */
  async destroyApp(appName: string): Promise<void> {
    const mutation = `
      mutation DeleteApp($appId: ID!) {
        deleteApp(appId: $appId) {
          app {
            id
            name
          }
        }
      }
    `;

    const variables = {
      appId: appName
    };

    try {
      const response = await this.graphqlRequest(mutation, variables);
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      logger.info(`Destroyed app: ${appName}`);
    } catch (error: any) {
      logger.error('Failed to destroy app via API', { appName, error: error.message });
      throw error;
    }
  }

  /**
   * Get machines for an app (equivalent to fly status --json)
   * Uses the Machines API
   */
  async getAppMachines(appName: string): Promise<FlyMachine[]> {
    try {
      const machines = await this.machinesApiRequest('GET', `/apps/${appName}/machines`);
      
      logger.info(`Retrieved ${machines.length} machines for app: ${appName}`);
      
      return machines.map((machine: any) => ({
        id: machine.id,
        name: machine.name || `${appName}-machine`,
        state: machine.state,
        region: machine.region,
        instance_id: machine.instance_id,
        private_ip: machine.private_ip,
        created_at: machine.created_at,
        updated_at: machine.updated_at,
        config: machine.config,
        events: machine.events
      }));
    } catch (error: any) {
      logger.error('Failed to get app machines via API', { appName, error: error.message });
      throw error;
    }
  }

  /**
   * Make a GraphQL request to Fly.io API
   */
  private async graphqlRequest(query: string, variables?: any): Promise<any> {
    const response = await fetch(this.appsApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.flyApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: variables || {}
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fly GraphQL API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Make a request to the Machines API
   */
  private async machinesApiRequest(method: string, path: string, body?: any): Promise<any> {
    const response = await fetch(`${this.machinesApiUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.flyApiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fly Machines API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const flyApiClient = new FlyAPIClient();