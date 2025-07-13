#!/usr/bin/env node
// Comprehensive post-deployment validation and monitoring integration

const https = require('https');
const { performance } = require('perf_hooks');

class DeploymentValidator {
  constructor(deploymentUrl, options = {}) {
    this.deploymentUrl = deploymentUrl;
    this.options = {
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      expectedResponseTime: options.expectedResponseTime || 3000,
      healthEndpoints: options.healthEndpoints || [
        '/',
        '/api/health-check',
        '/swarms',
        '/metrics'
      ],
      ...options
    };
    this.results = {
      overallStatus: 'unknown',
      checks: [],
      performance: {},
      errors: [],
      timestamp: new Date().toISOString()
    };
  }

  async validateDeployment() {
    console.log(`🔍 Starting validation for: ${this.deploymentUrl}`);
    console.log(`⏱️ Timeout: ${this.options.timeout}ms`);
    
    try {
      // Run all validation checks
      await this.runHealthChecks();
      await this.runPerformanceTests();
      await this.runFunctionalTests();
      await this.runSecurityChecks();
      
      // Determine overall status
      this.determineOverallStatus();
      
      // Generate report
      this.generateReport();
      
      // Send to monitoring systems
      await this.notifyMonitoringSystems();
      
      return this.results;
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      this.results.errors.push(error.message);
      this.results.overallStatus = 'failed';
      throw error;
    }
  }

  async runHealthChecks() {
    console.log('🏥 Running health checks...');
    
    for (const endpoint of this.options.healthEndpoints) {
      try {
        const result = await this.checkEndpoint(endpoint);
        this.results.checks.push({
          type: 'health',
          endpoint,
          status: result.status,
          responseTime: result.responseTime,
          statusCode: result.statusCode,
          timestamp: new Date().toISOString()
        });
        
        console.log(`  ✅ ${endpoint}: ${result.statusCode} (${result.responseTime}ms)`);
      } catch (error) {
        this.results.checks.push({
          type: 'health',
          endpoint,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        console.log(`  ❌ ${endpoint}: ${error.message}`);
      }
    }
  }

  async runPerformanceTests() {
    console.log('⚡ Running performance tests...');
    
    const performanceTests = [
      { name: 'Initial Load', endpoint: '/' },
      { name: 'Dashboard Load', endpoint: '/swarms' },
      { name: 'API Response', endpoint: '/api/health-check' }
    ];
    
    for (const test of performanceTests) {
      try {
        const result = await this.measurePerformance(test.endpoint);
        this.results.performance[test.name] = result;
        
        const status = result.responseTime < this.options.expectedResponseTime ? '✅' : '⚠️';
        console.log(`  ${status} ${test.name}: ${result.responseTime}ms`);
      } catch (error) {
        this.results.performance[test.name] = { error: error.message };
        console.log(`  ❌ ${test.name}: ${error.message}`);
      }
    }
  }

  async runFunctionalTests() {
    console.log('🔧 Running functional tests...');
    
    // Test API connectivity
    try {
      const apiResponse = await this.checkEndpoint('/api/health-check');
      if (apiResponse.statusCode === 200) {
        console.log('  ✅ API connectivity: Working');
        this.results.checks.push({
          type: 'functional',
          test: 'API connectivity',
          status: 'passed',
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(`API returned ${apiResponse.statusCode}`);
      }
    } catch (error) {
      console.log(`  ❌ API connectivity: ${error.message}`);
      this.results.checks.push({
        type: 'functional',
        test: 'API connectivity',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Test static asset delivery
    try {
      const cssCheck = await this.checkStaticAsset('/assets/index.css');
      const jsCheck = await this.checkStaticAsset('/assets/index.js');
      
      if (cssCheck && jsCheck) {
        console.log('  ✅ Static assets: Available');
        this.results.checks.push({
          type: 'functional',
          test: 'Static assets',
          status: 'passed',
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('Some static assets not found');
      }
    } catch (error) {
      console.log(`  ⚠️ Static assets: ${error.message}`);
      this.results.checks.push({
        type: 'functional',
        test: 'Static assets',
        status: 'warning',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runSecurityChecks() {
    console.log('🔒 Running security checks...');
    
    try {
      const response = await this.makeRequest('/');
      const headers = response.headers;
      
      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'same-origin'
      };
      
      const missingHeaders = [];
      for (const [header, expectedValue] of Object.entries(securityHeaders)) {
        if (!headers[header] || headers[header] !== expectedValue) {
          missingHeaders.push(header);
        }
      }
      
      if (missingHeaders.length === 0) {
        console.log('  ✅ Security headers: All present');
        this.results.checks.push({
          type: 'security',
          test: 'Security headers',
          status: 'passed',
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`  ⚠️ Security headers: Missing ${missingHeaders.join(', ')}`);
        this.results.checks.push({
          type: 'security',
          test: 'Security headers',
          status: 'warning',
          missingHeaders,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log(`  ❌ Security checks: ${error.message}`);
      this.results.checks.push({
        type: 'security',
        test: 'Security headers',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkEndpoint(endpoint) {
    const startTime = performance.now();
    const response = await this.makeRequest(endpoint);
    const endTime = performance.now();
    
    return {
      status: response.statusCode >= 200 && response.statusCode < 300 ? 'passed' : 'failed',
      statusCode: response.statusCode,
      responseTime: Math.round(endTime - startTime),
      headers: response.headers
    };
  }

  async measurePerformance(endpoint) {
    const measurements = [];
    
    // Run multiple measurements for accuracy
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      await this.makeRequest(endpoint);
      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }
    
    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    
    return {
      average: Math.round(avg),
      minimum: Math.round(min),
      maximum: Math.round(max),
      measurements: measurements.map(m => Math.round(m))
    };
  }

  async checkStaticAsset(assetPath) {
    try {
      const response = await this.makeRequest(assetPath);
      return response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }

  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.deploymentUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'GET',
        timeout: this.options.timeout,
        headers: {
          'User-Agent': 'Deployment-Validator/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  determineOverallStatus() {
    const healthPassed = this.results.checks
      .filter(c => c.type === 'health')
      .every(c => c.status === 'passed');
    
    const functionalPassed = this.results.checks
      .filter(c => c.type === 'functional')
      .every(c => c.status === 'passed');
    
    const hasErrors = this.results.errors.length > 0;
    
    if (hasErrors || !healthPassed) {
      this.results.overallStatus = 'failed';
    } else if (!functionalPassed) {
      this.results.overallStatus = 'degraded';
    } else {
      this.results.overallStatus = 'healthy';
    }
  }

  generateReport() {
    console.log('\n📊 Validation Report');
    console.log('==================');
    console.log(`Overall Status: ${this.getStatusEmoji()} ${this.results.overallStatus.toUpperCase()}`);
    console.log(`Deployment URL: ${this.deploymentUrl}`);
    console.log(`Validation Time: ${this.results.timestamp}`);
    
    console.log('\n🏥 Health Checks:');
    this.results.checks
      .filter(c => c.type === 'health')
      .forEach(check => {
        const emoji = check.status === 'passed' ? '✅' : '❌';
        console.log(`  ${emoji} ${check.endpoint}: ${check.statusCode || check.error}`);
      });
    
    console.log('\n⚡ Performance:');
    Object.entries(this.results.performance).forEach(([test, result]) => {
      if (result.average) {
        const emoji = result.average < this.options.expectedResponseTime ? '✅' : '⚠️';
        console.log(`  ${emoji} ${test}: ${result.average}ms (${result.minimum}-${result.maximum}ms)`);
      } else {
        console.log(`  ❌ ${test}: ${result.error}`);
      }
    });
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.results.errors.forEach(error => console.log(`  - ${error}`));
    }
  }

  getStatusEmoji() {
    switch (this.results.overallStatus) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'failed': return '❌';
      default: return '❓';
    }
  }

  async notifyMonitoringSystems() {
    const webhookUrl = process.env.MONITORING_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('⚠️ No monitoring webhook configured');
      return;
    }
    
    try {
      console.log('📡 Notifying monitoring systems...');
      
      const payload = {
        event: 'deployment_validation',
        status: this.results.overallStatus,
        url: this.deploymentUrl,
        timestamp: this.results.timestamp,
        checks: this.results.checks.length,
        passed: this.results.checks.filter(c => c.status === 'passed').length,
        performance: this.results.performance,
        errors: this.results.errors
      };
      
      await this.sendWebhook(webhookUrl, payload);
      console.log('✅ Monitoring systems notified');
    } catch (error) {
      console.log(`⚠️ Failed to notify monitoring systems: ${error.message}`);
    }
  }

  async sendWebhook(url, payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Webhook failed: HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

// CLI execution
async function main() {
  const deploymentUrl = process.argv[2];
  if (!deploymentUrl) {
    console.error('Usage: node post-deploy-validation.js <deployment-url>');
    process.exit(1);
  }

  const validator = new DeploymentValidator(deploymentUrl);
  
  try {
    const results = await validator.validateDeployment();
    
    // Exit with appropriate code
    if (results.overallStatus === 'failed') {
      process.exit(1);
    } else if (results.overallStatus === 'degraded') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Validation error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DeploymentValidator;