/**
 * Langfuse Trace Validation and API Connectivity
 * Validates Langfuse deployment and trace data integrity
 */

import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs/promises';

export interface ValidationResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  timestamp: Date;
  details?: any;
}

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
  timeout?: number;
}

export interface TraceValidation {
  traceId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  structure: {
    hasSpans: boolean;
    spanCount: number;
    hasGenerations: boolean;
    generationCount: number;
    hasScores: boolean;
    scoreCount: number;
  };
}

export class LangfuseValidator {
  private config: LangfuseConfig;
  private results: ValidationResult[] = [];

  constructor(config: LangfuseConfig) {
    this.config = {
      timeout: 10000,
      ...config
    };
  }

  /**
   * Run comprehensive validation suite
   */
  async runValidation(): Promise<ValidationResult[]> {
    console.log('🔍 Starting Langfuse validation...');
    this.results = [];

    await this.validateConnectivity();
    await this.validateAuthentication();
    await this.validateAPIEndpoints();
    await this.validateTraceIngestion();
    await this.validateDataRetrieval();
    await this.validateMetrics();

    return this.results;
  }

  /**
   * Test basic connectivity to Langfuse
   */
  private async validateConnectivity(): Promise<void> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/api/public/health`, {
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        this.addResult('connectivity', 'pass', 'Successfully connected to Langfuse API');
      } else {
        this.addResult('connectivity', 'fail', `Unexpected status code: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('connectivity', 'fail', `Connection failed: ${error.message}`);
    }
  }

  /**
   * Validate authentication credentials
   */
  private async validateAuthentication(): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest('/api/public/projects');

      if (response.status === 200) {
        this.addResult('authentication', 'pass', 'Authentication successful');
      } else if (response.status === 401) {
        this.addResult('authentication', 'fail', 'Invalid credentials');
      } else {
        this.addResult('authentication', 'warning', `Unexpected auth response: ${response.status}`);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.addResult('authentication', 'fail', 'Authentication failed: Invalid credentials');
      } else {
        this.addResult('authentication', 'fail', `Auth error: ${error.message}`);
      }
    }
  }

  /**
   * Test critical API endpoints
   */
  private async validateAPIEndpoints(): Promise<void> {
    const endpoints = [
      { path: '/api/public/traces', method: 'GET', name: 'Traces API' },
      { path: '/api/public/generations', method: 'GET', name: 'Generations API' },
      { path: '/api/public/scores', method: 'GET', name: 'Scores API' },
      { path: '/api/public/sessions', method: 'GET', name: 'Sessions API' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeAuthenticatedRequest(endpoint.path);
        
        if (response.status === 200) {
          this.addResult(
            `endpoint-${endpoint.name.toLowerCase().replace(' ', '-')}`,
            'pass',
            `${endpoint.name} endpoint accessible`
          );
        } else {
          this.addResult(
            `endpoint-${endpoint.name.toLowerCase().replace(' ', '-')}`,
            'warning',
            `${endpoint.name} returned status ${response.status}`
          );
        }
      } catch (error: any) {
        this.addResult(
          `endpoint-${endpoint.name.toLowerCase().replace(' ', '-')}`,
          'fail',
          `${endpoint.name} error: ${error.message}`
        );
      }
    }
  }

  /**
   * Test trace ingestion by creating a test trace
   */
  private async validateTraceIngestion(): Promise<void> {
    const testTrace = {
      id: `test-trace-${Date.now()}`,
      name: 'Validation Test Trace',
      userId: 'validator',
      metadata: {
        purpose: 'validation',
        timestamp: new Date().toISOString()
      }
    };

    try {
      const response = await this.makeAuthenticatedRequest('/api/public/traces', {
        method: 'POST',
        data: testTrace
      });

      if (response.status === 200 || response.status === 201) {
        this.addResult('trace-ingestion', 'pass', 'Trace ingestion successful', testTrace);
        
        // Wait a moment and verify the trace exists
        setTimeout(() => this.verifyTraceExists(testTrace.id), 2000);
      } else {
        this.addResult('trace-ingestion', 'fail', `Ingestion failed with status ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('trace-ingestion', 'fail', `Ingestion error: ${error.message}`);
    }
  }

  /**
   * Verify that a created trace can be retrieved
   */
  private async verifyTraceExists(traceId: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(`/api/public/traces/${traceId}`);
      
      if (response.status === 200) {
        this.addResult('trace-retrieval', 'pass', 'Trace retrieval successful');
      } else if (response.status === 404) {
        this.addResult('trace-retrieval', 'warning', 'Trace not found (may need more time to process)');
      } else {
        this.addResult('trace-retrieval', 'fail', `Retrieval failed with status ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('trace-retrieval', 'fail', `Retrieval error: ${error.message}`);
    }
  }

  /**
   * Validate data retrieval and query capabilities
   */
  private async validateDataRetrieval(): Promise<void> {
    try {
      // Test pagination
      const response = await this.makeAuthenticatedRequest('/api/public/traces?limit=5');
      
      if (response.status === 200) {
        const data = response.data;
        const hasData = data && Array.isArray(data.data);
        
        this.addResult(
          'data-retrieval',
          'pass',
          `Data retrieval successful. Found ${hasData ? data.data.length : 0} traces`
        );
        
        // Test filtering if data exists
        if (hasData && data.data.length > 0) {
          await this.testFiltering();
        }
      } else {
        this.addResult('data-retrieval', 'fail', `Data retrieval failed: ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('data-retrieval', 'fail', `Data retrieval error: ${error.message}`);
    }
  }

  /**
   * Test filtering and search capabilities
   */
  private async testFiltering(): Promise<void> {
    try {
      const filters = [
        'fromTimestamp=' + (Date.now() - 86400000), // Last 24 hours
        'userId=test',
        'name=test'
      ];

      for (const filter of filters) {
        const response = await this.makeAuthenticatedRequest(`/api/public/traces?${filter}`);
        if (response.status !== 200) {
          this.addResult('filtering', 'warning', `Filter "${filter}" returned ${response.status}`);
          return;
        }
      }
      
      this.addResult('filtering', 'pass', 'Filtering capabilities working');
    } catch (error: any) {
      this.addResult('filtering', 'fail', `Filtering error: ${error.message}`);
    }
  }

  /**
   * Validate metrics and analytics endpoints
   */
  private async validateMetrics(): Promise<void> {
    try {
      const metricsEndpoints = [
        '/api/public/metrics/daily',
        '/api/public/metrics/usage'
      ];

      for (const endpoint of metricsEndpoints) {
        try {
          const response = await this.makeAuthenticatedRequest(endpoint);
          if (response.status === 200) {
            this.addResult(
              `metrics-${endpoint.split('/').pop()}`,
              'pass',
              `Metrics endpoint ${endpoint} accessible`
            );
          }
        } catch (error) {
          // Metrics endpoints might not be available in all versions
          this.addResult(
            `metrics-${endpoint.split('/').pop()}`,
            'warning',
            `Metrics endpoint ${endpoint} not available`
          );
        }
      }
    } catch (error: any) {
      this.addResult('metrics', 'warning', `Metrics validation error: ${error.message}`);
    }
  }

  /**
   * Validate a specific trace structure
   */
  async validateTrace(traceId: string): Promise<TraceValidation> {
    try {
      const traceResponse = await this.makeAuthenticatedRequest(`/api/public/traces/${traceId}`);
      
      if (traceResponse.status !== 200) {
        return {
          traceId,
          valid: false,
          errors: [`Failed to fetch trace: ${traceResponse.status}`],
          warnings: [],
          structure: {
            hasSpans: false,
            spanCount: 0,
            hasGenerations: false,
            generationCount: 0,
            hasScores: false,
            scoreCount: 0
          }
        };
      }

      const trace = traceResponse.data;
      const validation: TraceValidation = {
        traceId,
        valid: true,
        errors: [],
        warnings: [],
        structure: {
          hasSpans: false,
          spanCount: 0,
          hasGenerations: false,
          generationCount: 0,
          hasScores: false,
          scoreCount: 0
        }
      };

      // Validate trace structure
      if (!trace.id) {
        validation.errors.push('Trace missing ID');
        validation.valid = false;
      }

      if (!trace.timestamp) {
        validation.warnings.push('Trace missing timestamp');
      }

      // Check for related data
      const [spansResponse, generationsResponse, scoresResponse] = await Promise.allSettled([
        this.makeAuthenticatedRequest(`/api/public/observations?traceId=${traceId}&type=SPAN`),
        this.makeAuthenticatedRequest(`/api/public/generations?traceId=${traceId}`),
        this.makeAuthenticatedRequest(`/api/public/scores?traceId=${traceId}`)
      ]);

      // Process spans
      if (spansResponse.status === 'fulfilled' && spansResponse.value.status === 200) {
        const spans = spansResponse.value.data.data || [];
        validation.structure.hasSpans = spans.length > 0;
        validation.structure.spanCount = spans.length;
      }

      // Process generations
      if (generationsResponse.status === 'fulfilled' && generationsResponse.value.status === 200) {
        const generations = generationsResponse.value.data.data || [];
        validation.structure.hasGenerations = generations.length > 0;
        validation.structure.generationCount = generations.length;
      }

      // Process scores
      if (scoresResponse.status === 'fulfilled' && scoresResponse.value.status === 200) {
        const scores = scoresResponse.value.data.data || [];
        validation.structure.hasScores = scores.length > 0;
        validation.structure.scoreCount = scores.length;
      }

      return validation;

    } catch (error: any) {
      return {
        traceId,
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        structure: {
          hasSpans: false,
          spanCount: 0,
          hasGenerations: false,
          generationCount: 0,
          hasScores: false,
          scoreCount: 0
        }
      };
    }
  }

  /**
   * Make authenticated request to Langfuse API
   */
  private async makeAuthenticatedRequest(
    path: string, 
    options: { method?: string; data?: any } = {}
  ): Promise<AxiosResponse> {
    const { method = 'GET', data } = options;
    
    const auth = Buffer.from(`${this.config.publicKey}:${this.config.secretKey}`).toString('base64');
    
    return axios({
      method: method as any,
      url: `${this.config.baseUrl}${path}`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      data,
      timeout: this.config.timeout
    });
  }

  /**
   * Add validation result
   */
  private addResult(
    test: string, 
    status: 'pass' | 'fail' | 'warning', 
    message: string, 
    details?: any
  ): void {
    this.results.push({
      test,
      status,
      message,
      timestamp: new Date(),
      details
    });

    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${test}: ${message}`);
  }

  /**
   * Get validation summary
   */
  getSummary(): { total: number; passed: number; failed: number; warnings: number } {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      warnings: this.results.filter(r => r.status === 'warning').length
    };
  }

  /**
   * Save validation results to file
   */
  async saveResults(filename: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      config: {
        baseUrl: this.config.baseUrl,
        publicKey: this.config.publicKey.substring(0, 8) + '...'
      },
      summary: this.getSummary(),
      results: this.results
    };

    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`📄 Validation report saved to ${filename}`);
  }
}

// CLI usage example
if (require.main === module) {
  const config: LangfuseConfig = {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
    secretKey: process.env.LANGFUSE_SECRET_KEY || '',
    baseUrl: process.env.LANGFUSE_BASE_URL || 'http://localhost:3000'
  };

  if (!config.publicKey || !config.secretKey) {
    console.error('❌ Missing required environment variables: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY');
    process.exit(1);
  }

  (async () => {
    console.log('🔍 Langfuse Validator');
    console.log('=====================');
    console.log(`Base URL: ${config.baseUrl}`);
    console.log(`Public Key: ${config.publicKey.substring(0, 8)}...`);
    console.log('');

    const validator = new LangfuseValidator(config);
    const results = await validator.runValidation();
    
    console.log('\n📊 Validation Summary');
    console.log('=====================');
    const summary = validator.getSummary();
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);

    await validator.saveResults(`langfuse-validation-${Date.now()}.json`);

    if (summary.failed > 0) {
      process.exit(1);
    }
  })();
}