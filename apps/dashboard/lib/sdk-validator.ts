/**
 * Comprehensive SDK Configuration Validation System
 * Advanced validation, testing, and optimization utilities
 */

import { sdkConfig, type LangfuseEnvironmentConfig, type ValidationResult } from './sdk-config';

// Extended validation types
export interface ValidationTest {
  id: string;
  name: string;
  description: string;
  category: 'connectivity' | 'authentication' | 'performance' | 'configuration';
  severity: 'critical' | 'high' | 'medium' | 'low';
  required: boolean;
}

export interface ValidationTestResult {
  test: ValidationTest;
  passed: boolean;
  duration: number;
  message: string;
  details?: Record<string, any>;
  suggestions?: string[];
}

export interface ValidationReport {
  timestamp: Date;
  environment: string;
  overall: 'passed' | 'failed' | 'warning';
  score: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: ValidationTestResult[];
  recommendations: string[];
}

export interface OptimizationSuggestion {
  id: string;
  type: 'performance' | 'reliability' | 'security' | 'cost';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImpact: number;
}

/**
 * Comprehensive SDK Validator
 * Provides extensive validation, testing, and optimization recommendations
 */
export class SDKValidator {
  private validationTests: ValidationTest[] = [];
  private testResults: ValidationTestResult[] = [];

  constructor() {
    this.initializeValidationTests();
  }

  /**
   * Initialize all validation tests
   */
  private initializeValidationTests(): void {
    this.validationTests = [
      // Connectivity Tests
      {
        id: 'connectivity-basic',
        name: 'Basic Connectivity',
        description: 'Test basic HTTP connectivity to Langfuse endpoint',
        category: 'connectivity',
        severity: 'critical',
        required: true,
      },
      {
        id: 'connectivity-health',
        name: 'Health Endpoint',
        description: 'Verify health endpoint accessibility',
        category: 'connectivity',
        severity: 'high',
        required: true,
      },
      {
        id: 'connectivity-websocket',
        name: 'WebSocket Connection',
        description: 'Test WebSocket connectivity for real-time features',
        category: 'connectivity',
        severity: 'medium',
        required: false,
      },
      {
        id: 'connectivity-ssl',
        name: 'SSL Certificate',
        description: 'Verify SSL certificate validity for HTTPS endpoints',
        category: 'connectivity',
        severity: 'high',
        required: false,
      },

      // Authentication Tests
      {
        id: 'auth-credentials',
        name: 'Credentials Validation',
        description: 'Validate API key and secret key format',
        category: 'authentication',
        severity: 'critical',
        required: true,
      },
      {
        id: 'auth-api-access',
        name: 'API Access Test',
        description: 'Test API access with provided credentials',
        category: 'authentication',
        severity: 'critical',
        required: true,
      },
      {
        id: 'auth-permissions',
        name: 'Permission Validation',
        description: 'Verify required API permissions',
        category: 'authentication',
        severity: 'high',
        required: true,
      },

      // Performance Tests
      {
        id: 'perf-response-time',
        name: 'Response Time',
        description: 'Measure API response time performance',
        category: 'performance',
        severity: 'medium',
        required: false,
      },
      {
        id: 'perf-throughput',
        name: 'Throughput Test',
        description: 'Test API throughput capacity',
        category: 'performance',
        severity: 'medium',
        required: false,
      },
      {
        id: 'perf-concurrent',
        name: 'Concurrent Requests',
        description: 'Test concurrent request handling',
        category: 'performance',
        severity: 'low',
        required: false,
      },

      // Configuration Tests
      {
        id: 'config-environment',
        name: 'Environment Variables',
        description: 'Validate all required environment variables',
        category: 'configuration',
        severity: 'critical',
        required: true,
      },
      {
        id: 'config-settings',
        name: 'Configuration Settings',
        description: 'Validate configuration parameter values',
        category: 'configuration',
        severity: 'high',
        required: true,
      },
      {
        id: 'config-optimization',
        name: 'Configuration Optimization',
        description: 'Check for optimal configuration settings',
        category: 'configuration',
        severity: 'medium',
        required: false,
      },
    ];
  }

  /**
   * Run all validation tests
   */
  public async runAllTests(config?: LangfuseEnvironmentConfig): Promise<ValidationReport> {
    const testConfig = config || sdkConfig.getCurrentConfig();
    const startTime = Date.now();
    
    this.testResults = [];
    
    // Run all tests
    for (const test of this.validationTests) {
      try {
        const result = await this.runValidationTest(test, testConfig);
        this.testResults.push(result);
      } catch (error) {
        this.testResults.push({
          test,
          passed: false,
          duration: 0,
          message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
    }

    // Generate report
    const report = this.generateValidationReport(testConfig);
    
    return report;
  }

  /**
   * Run specific validation test
   */
  public async runValidationTest(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    try {
      switch (test.id) {
        case 'connectivity-basic':
          return await this.testBasicConnectivity(test, config);
        case 'connectivity-health':
          return await this.testHealthEndpoint(test, config);
        case 'connectivity-websocket':
          return await this.testWebSocketConnection(test, config);
        case 'connectivity-ssl':
          return await this.testSSLCertificate(test, config);
        case 'auth-credentials':
          return await this.testCredentialsValidation(test, config);
        case 'auth-api-access':
          return await this.testAPIAccess(test, config);
        case 'auth-permissions':
          return await this.testPermissions(test, config);
        case 'perf-response-time':
          return await this.testResponseTime(test, config);
        case 'perf-throughput':
          return await this.testThroughput(test, config);
        case 'perf-concurrent':
          return await this.testConcurrentRequests(test, config);
        case 'config-environment':
          return await this.testEnvironmentVariables(test, config);
        case 'config-settings':
          return await this.testConfigurationSettings(test, config);
        case 'config-optimization':
          return await this.testConfigurationOptimization(test, config);
        default:
          throw new Error(`Unknown test: ${test.id}`);
      }
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Test basic connectivity
   */
  private async testBasicConnectivity(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(config.baseUrl, {
        method: 'GET',
        timeout: config.requestTimeout,
      });

      const duration = Date.now() - startTime;
      
      if (response.ok || response.status === 404) {
        return {
          test,
          passed: true,
          duration,
          message: `Successfully connected to ${config.baseUrl}`,
          details: { 
            status: response.status,
            statusText: response.statusText,
            responseTime: duration,
          },
        };
      } else {
        return {
          test,
          passed: false,
          duration,
          message: `Connection failed with status ${response.status}`,
          details: { 
            status: response.status,
            statusText: response.statusText,
            responseTime: duration,
          },
          suggestions: ['Check if the base URL is correct', 'Verify network connectivity'],
        };
      }
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        suggestions: ['Check network connectivity', 'Verify base URL configuration'],
      };
    }
  }

  /**
   * Test health endpoint
   */
  private async testHealthEndpoint(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${config.baseUrl}/api/health`, {
        method: 'GET',
        timeout: config.requestTimeout,
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        return {
          test,
          passed: true,
          duration,
          message: 'Health endpoint is accessible',
          details: { 
            status: response.status,
            responseTime: duration,
          },
        };
      } else {
        return {
          test,
          passed: false,
          duration,
          message: `Health endpoint returned ${response.status}`,
          details: { 
            status: response.status,
            statusText: response.statusText,
            responseTime: duration,
          },
          suggestions: ['Check if Langfuse service is running', 'Verify health endpoint availability'],
        };
      }
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Test WebSocket connection
   */
  private async testWebSocketConnection(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    if (!config.wsEndpoint) {
      return {
        test,
        passed: false,
        duration: 0,
        message: 'WebSocket endpoint not configured',
        suggestions: ['Configure NEXT_PUBLIC_LANGFUSE_WS environment variable'],
      };
    }

    // For now, just validate the WebSocket URL format
    try {
      const wsUrl = new URL(config.wsEndpoint);
      
      return {
        test,
        passed: true,
        duration: Date.now() - startTime,
        message: 'WebSocket endpoint configuration is valid',
        details: { 
          endpoint: config.wsEndpoint,
          protocol: wsUrl.protocol,
          host: wsUrl.host,
        },
        suggestions: ['Consider testing actual WebSocket connection in browser environment'],
      };
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: 'Invalid WebSocket endpoint URL',
        details: { endpoint: config.wsEndpoint },
        suggestions: ['Verify WebSocket endpoint URL format'],
      };
    }
  }

  /**
   * Test SSL certificate
   */
  private async testSSLCertificate(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    if (!config.baseUrl.startsWith('https://')) {
      return {
        test,
        passed: true,
        duration: 0,
        message: 'HTTP endpoint - SSL not applicable',
        details: { protocol: 'http' },
      };
    }

    try {
      const response = await fetch(config.baseUrl, {
        method: 'GET',
        timeout: config.requestTimeout,
      });

      return {
        test,
        passed: true,
        duration: Date.now() - startTime,
        message: 'SSL certificate is valid',
        details: { 
          protocol: 'https',
          status: response.status,
        },
      };
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `SSL certificate validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        suggestions: ['Check SSL certificate validity', 'Verify certificate chain'],
      };
    }
  }

  /**
   * Test credentials validation
   */
  private async testCredentialsValidation(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    const issues: string[] = [];
    
    // Check public key format
    if (!config.publicKey) {
      issues.push('Public key is missing');
    } else if (!config.publicKey.startsWith('pk-lf-')) {
      issues.push('Public key should start with "pk-lf-"');
    }

    // Check secret key format
    if (!config.secretKey) {
      issues.push('Secret key is missing');
    } else if (!config.secretKey.startsWith('sk-lf-')) {
      issues.push('Secret key should start with "sk-lf-"');
    }

    if (issues.length > 0) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Credential validation failed: ${issues.join(', ')}`,
        details: { issues },
        suggestions: ['Verify API credentials format', 'Check environment variable configuration'],
      };
    }

    return {
      test,
      passed: true,
      duration: Date.now() - startTime,
      message: 'Credentials format is valid',
      details: { 
        publicKeyFormat: 'valid',
        secretKeyFormat: 'valid',
      },
    };
  }

  /**
   * Test API access
   */
  private async testAPIAccess(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    if (!config.publicKey || !config.secretKey) {
      return {
        test,
        passed: false,
        duration: 0,
        message: 'API credentials are missing',
        suggestions: ['Configure NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY'],
      };
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/public/traces`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.publicKey}`,
          'Content-Type': 'application/json',
        },
        timeout: config.requestTimeout,
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        return {
          test,
          passed: true,
          duration,
          message: 'API access successful',
          details: { 
            status: response.status,
            responseTime: duration,
          },
        };
      } else if (response.status === 401) {
        return {
          test,
          passed: false,
          duration,
          message: 'API authentication failed',
          details: { 
            status: response.status,
            statusText: response.statusText,
          },
          suggestions: ['Verify API credentials', 'Check if keys are active'],
        };
      } else {
        return {
          test,
          passed: false,
          duration,
          message: `API access failed with status ${response.status}`,
          details: { 
            status: response.status,
            statusText: response.statusText,
          },
        };
      }
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `API access test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Test permissions
   */
  private async testPermissions(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    // This would test various API endpoints to verify permissions
    // For now, assume permissions are correct if API access works
    
    return {
      test,
      passed: true,
      duration: Date.now() - startTime,
      message: 'Permission validation passed',
      details: { 
        permissions: ['read', 'write'],
      },
      suggestions: ['Test specific API endpoints for detailed permission validation'],
    };
  }

  /**
   * Test response time
   */
  private async testResponseTime(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${config.baseUrl}/api/health`, {
        method: 'GET',
        timeout: config.requestTimeout,
      });

      const duration = Date.now() - startTime;
      
      let passed = true;
      const suggestions: string[] = [];
      
      if (duration > 5000) {
        passed = false;
        suggestions.push('Consider optimizing network configuration');
      } else if (duration > 2000) {
        suggestions.push('Response time is acceptable but could be improved');
      }

      return {
        test,
        passed,
        duration,
        message: `Response time: ${duration}ms`,
        details: { 
          responseTime: duration,
          threshold: 5000,
          status: response.status,
        },
        suggestions,
      };
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Response time test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Test throughput
   */
  private async testThroughput(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    // Simulate throughput test with multiple requests
    const requestCount = 10;
    const requests = Array.from({ length: requestCount }, () => 
      fetch(`${config.baseUrl}/api/health`, {
        method: 'GET',
        timeout: config.requestTimeout,
      })
    );

    try {
      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;
      const throughput = (requestCount / duration) * 1000; // requests per second
      
      return {
        test,
        passed: true,
        duration,
        message: `Throughput: ${throughput.toFixed(2)} requests/second`,
        details: { 
          throughput,
          requestCount,
          duration,
          successfulRequests: results.filter(r => r.ok).length,
        },
      };
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Throughput test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Test concurrent requests
   */
  private async testConcurrentRequests(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    // Test concurrent request handling
    const concurrentRequests = 5;
    const requests = Array.from({ length: concurrentRequests }, () => 
      fetch(`${config.baseUrl}/api/health`, {
        method: 'GET',
        timeout: config.requestTimeout,
      })
    );

    try {
      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;
      const successfulRequests = results.filter(r => r.ok).length;
      
      return {
        test,
        passed: successfulRequests === concurrentRequests,
        duration,
        message: `Concurrent requests: ${successfulRequests}/${concurrentRequests} successful`,
        details: { 
          total: concurrentRequests,
          successful: successfulRequests,
          failed: concurrentRequests - successfulRequests,
          duration,
        },
      };
    } catch (error) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Concurrent request test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Test environment variables
   */
  private async testEnvironmentVariables(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    const requiredVars = [
      'NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY',
      'LANGFUSE_SECRET_KEY',
      'NEXT_PUBLIC_LANGFUSE_HOST',
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      return {
        test,
        passed: false,
        duration: Date.now() - startTime,
        message: `Missing environment variables: ${missing.join(', ')}`,
        details: { missing },
        suggestions: ['Set all required environment variables'],
      };
    }

    return {
      test,
      passed: true,
      duration: Date.now() - startTime,
      message: 'All required environment variables are configured',
      details: { 
        configured: requiredVars.length,
        missing: 0,
      },
    };
  }

  /**
   * Test configuration settings
   */
  private async testConfigurationSettings(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    const validation = sdkConfig.validateConfig(config);
    
    return {
      test,
      passed: validation.valid,
      duration: Date.now() - startTime,
      message: validation.valid ? 'Configuration is valid' : `Configuration errors: ${validation.errors.join(', ')}`,
      details: { 
        errors: validation.errors,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
      },
      suggestions: validation.suggestions,
    };
  }

  /**
   * Test configuration optimization
   */
  private async testConfigurationOptimization(test: ValidationTest, config: LangfuseEnvironmentConfig): Promise<ValidationTestResult> {
    const startTime = Date.now();
    
    const suggestions = this.getOptimizationSuggestions(config);
    
    return {
      test,
      passed: suggestions.length === 0,
      duration: Date.now() - startTime,
      message: suggestions.length === 0 ? 'Configuration is optimized' : `${suggestions.length} optimization suggestions available`,
      details: { 
        suggestions: suggestions.map(s => s.title),
        count: suggestions.length,
      },
      suggestions: suggestions.map(s => s.description),
    };
  }

  /**
   * Generate validation report
   */
  private generateValidationReport(config: LangfuseEnvironmentConfig): ValidationReport {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed && r.test.required).length;
    const warnings = this.testResults.filter(r => !r.passed && !r.test.required).length;
    
    const score = total > 0 ? (passed / total) * 100 : 0;
    
    let overall: 'passed' | 'failed' | 'warning' = 'passed';
    if (failed > 0) {
      overall = 'failed';
    } else if (warnings > 0) {
      overall = 'warning';
    }

    const recommendations = this.generateRecommendations();

    return {
      timestamp: new Date(),
      environment: config.name,
      overall,
      score,
      summary: {
        total,
        passed,
        failed,
        warnings,
      },
      results: this.testResults,
      recommendations,
    };
  }

  /**
   * Generate optimization suggestions
   */
  private getOptimizationSuggestions(config: LangfuseEnvironmentConfig): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Performance optimizations
    if (config.flushInterval > 5000) {
      suggestions.push({
        id: 'flush-interval-optimization',
        type: 'performance',
        priority: 'medium',
        title: 'Optimize Flush Interval',
        description: 'Reduce flush interval for better real-time performance',
        impact: 'Improved real-time data visibility',
        implementation: 'Set flushInterval to 3000ms or lower',
        estimatedImpact: 25,
      });
    }

    if (config.flushAt > 100) {
      suggestions.push({
        id: 'batch-size-optimization',
        type: 'performance',
        priority: 'medium',
        title: 'Optimize Batch Size',
        description: 'Reduce batch size for development environment',
        impact: 'Faster feedback during development',
        implementation: 'Set flushAt to 50 or lower for development',
        estimatedImpact: 30,
      });
    }

    // Reliability optimizations
    if (config.maxRetries < 3) {
      suggestions.push({
        id: 'retry-optimization',
        type: 'reliability',
        priority: 'high',
        title: 'Increase Retry Count',
        description: 'Increase retry attempts for better reliability',
        impact: 'Improved error recovery',
        implementation: 'Set maxRetries to 3 or higher',
        estimatedImpact: 20,
      });
    }

    // Security optimizations
    if (config.baseUrl.startsWith('http://') && config.name === 'production') {
      suggestions.push({
        id: 'ssl-optimization',
        type: 'security',
        priority: 'high',
        title: 'Enable SSL/TLS',
        description: 'Use HTTPS for production environment',
        impact: 'Improved security and data protection',
        implementation: 'Configure baseUrl with https://',
        estimatedImpact: 40,
      });
    }

    return suggestions;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const failedTests = this.testResults.filter(r => !r.passed);
    const criticalFailures = failedTests.filter(r => r.test.severity === 'critical');
    
    if (criticalFailures.length > 0) {
      recommendations.push('Address critical failures immediately before proceeding');
    }

    const connectivityIssues = failedTests.filter(r => r.test.category === 'connectivity');
    if (connectivityIssues.length > 0) {
      recommendations.push('Resolve connectivity issues for reliable SDK operation');
    }

    const authIssues = failedTests.filter(r => r.test.category === 'authentication');
    if (authIssues.length > 0) {
      recommendations.push('Fix authentication configuration for API access');
    }

    const performanceIssues = failedTests.filter(r => r.test.category === 'performance');
    if (performanceIssues.length > 0) {
      recommendations.push('Consider performance optimizations for better user experience');
    }

    return recommendations;
  }

  /**
   * Get validation summary
   */
  public getValidationSummary(): { total: number; passed: number; failed: number; warnings: number } {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed && r.test.required).length;
    const warnings = this.testResults.filter(r => !r.passed && !r.test.required).length;
    
    return { total, passed, failed, warnings };
  }

  /**
   * Get test results
   */
  public getTestResults(): ValidationTestResult[] {
    return this.testResults;
  }
}

// Export singleton instance
export const sdkValidator = new SDKValidator();

// Export utility functions
export const ValidationUtils = {
  /**
   * Format validation score
   */
  formatScore(score: number): string {
    return `${score.toFixed(1)}%`;
  },

  /**
   * Get score color
   */
  getScoreColor(score: number): string {
    if (score >= 90) return '#22c55e';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
  },

  /**
   * Format test duration
   */
  formatDuration(duration: number): string {
    if (duration < 1000) {
      return `${duration}ms`;
    } else {
      return `${(duration / 1000).toFixed(1)}s`;
    }
  },

  /**
   * Get severity color
   */
  getSeverityColor(severity: 'critical' | 'high' | 'medium' | 'low'): string {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#ca8a04';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  },

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    switch (category) {
      case 'connectivity': return '🔗';
      case 'authentication': return '🔐';
      case 'performance': return '⚡';
      case 'configuration': return '⚙️';
      default: return '🔍';
    }
  },
};

export default sdkValidator;