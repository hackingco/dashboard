// API service with CORS proxy support for development
// This version uses a public CORS proxy to bypass CORS issues

const API_BASE_URL = 'https://swarm-manager-live.fly.dev/api';
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

// Try direct connection first, fall back to proxy if needed
export class ApiServiceWithCorsProxy {
  private useProxy = false;
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async fetchWithCors(endpoint: string, options: RequestInit = {}) {
    const url = this.useProxy ? CORS_PROXY + this.baseUrl + endpoint : this.baseUrl + endpoint;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // If direct connection fails and we haven't tried proxy yet
      if (!this.useProxy && error instanceof TypeError) {
        console.warn('Direct API connection failed, trying with CORS proxy...');
        this.useProxy = true;
        return this.fetchWithCors(endpoint, options);
      }
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.fetchWithCors('/enhanced-swarms');
      console.log('API connection successful:', this.useProxy ? 'via proxy' : 'direct');
      return true;
    } catch (error) {
      console.error('API connection failed:', error);
      return false;
    }
  }
}

// Note: CORS proxy services have limitations and should only be used for development.
// For production, the proper solution is to configure CORS on the server.