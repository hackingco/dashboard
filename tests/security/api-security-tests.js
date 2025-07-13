#!/usr/bin/env node

/**
 * API Security Testing Suite
 * Comprehensive security testing for API endpoints
 */

const fetch = require('node-fetch');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;

// Configuration
const config = {
  target: {
    api: process.env.TEST_API_URL || 'http://localhost:3001',
    dashboard: process.env.TEST_DASHBOARD_URL || 'http://localhost:3000',
  },
  
  timeout: 10000,
  
  // Common attack payloads
  payloads: {
    sql_injection: [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
    ],
    xss: [
      "<script>alert('XSS')</script>",
      "javascript:alert('XSS')",
      "<img src=x onerror=alert('XSS')>",
      "<iframe src='javascript:alert(\"XSS\")'></iframe>",
    ],
    command_injection: [
      "; ls -la",
      "| cat /etc/passwd",
      "&& rm -rf /",
      "`whoami`",
    ],
    path_traversal: [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2f%65%74%63%2f%70%61%73%73%77%64",
    ],
    ldap_injection: [
      "*)(uid=*",
      "*)(|(password=*))",
      "admin*",
      "*)(|(objectClass=*))",
    ],
  },
  
  // Test headers for various attacks
  maliciousHeaders: {
    'X-Forwarded-For': '127.0.0.1',
    'X-Real-IP': '127.0.0.1',
    'X-Originating-IP': '127.0.0.1',
    'User-Agent': '<script>alert("XSS")</script>',
    'Referer': 'javascript:alert("XSS")',
    'X-Custom-Header': '../../../../etc/passwd',
  },
  
  outputFile: 'api-security-test-results.json',
};

// Utility functions
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Security test results collector
class SecurityTestCollector {
  constructor() {
    this.results = {
      startTime: Date.now(),
      vulnerabilities: [],
      tests: [],
      summary: {
        total_tests: 0,
        vulnerabilities_found: 0,
        critical_issues: 0,
        high_issues: 0,
        medium_issues: 0,
        low_issues: 0,
      },
    };
  }
  
  recordTest(test) {
    this.results.tests.push({
      timestamp: Date.now(),
      ...test,
    });
    this.results.summary.total_tests++;
  }
  
  recordVulnerability(vulnerability) {
    this.results.vulnerabilities.push({
      timestamp: Date.now(),
      ...vulnerability,
    });
    
    this.results.summary.vulnerabilities_found++;
    
    switch (vulnerability.severity) {
      case 'critical':
        this.results.summary.critical_issues++;
        break;
      case 'high':
        this.results.summary.high_issues++;
        break;
      case 'medium':
        this.results.summary.medium_issues++;
        break;
      case 'low':
        this.results.summary.low_issues++;
        break;
    }
  }
  
  generateReport() {
    const duration = Date.now() - this.results.startTime;
    
    return {
      ...this.results,
      test_duration_ms: duration,
      timestamp: new Date().toISOString(),
    };
  }
}

// API Security Tester
class ApiSecurityTester {
  constructor(collector, baseUrl) {
    this.collector = collector;
    this.baseUrl = baseUrl;
  }
  
  async runAllTests() {
    logWithTimestamp('🔒 Starting comprehensive API security testing');
    
    try {
      await this.testSqlInjection();
      await this.testXssVulnerabilities();
      await this.testCommandInjection();
      await this.testPathTraversal();
      await this.testAuthenticationBypass();
      await this.testAuthorizationFlaws();
      await this.testRateLimiting();
      await this.testInputValidation();
      await this.testHeaderInjection();
      await this.testCorsConfiguration();
      await this.testSensitiveDataExposure();
      await this.testSecurityHeaders();
      
      logWithTimestamp('✅ API security testing completed');
    } catch (error) {
      logWithTimestamp(`❌ Security testing failed: ${error.message}`);
      throw error;
    }
  }
  
  async testSqlInjection() {
    logWithTimestamp('🔍 Testing SQL injection vulnerabilities');
    
    const endpoints = [
      '/api/swarms',
      '/api/machines',
      '/api/users',
      '/api/search',
    ];
    
    for (const endpoint of endpoints) {
      for (const payload of config.payloads.sql_injection) {
        await this.testEndpointWithPayload(
          endpoint,
          'sql_injection',
          payload,
          ['id', 'query', 'filter', 'search']
        );
      }
    }
  }
  
  async testXssVulnerabilities() {
    logWithTimestamp('🔍 Testing XSS vulnerabilities');
    
    const endpoints = [
      '/api/swarms',
      '/api/machines',
      '/api/logs',
    ];
    
    for (const endpoint of endpoints) {
      for (const payload of config.payloads.xss) {
        await this.testEndpointWithPayload(
          endpoint,
          'xss',
          payload,
          ['name', 'description', 'message', 'content']
        );
      }
    }
  }
  
  async testCommandInjection() {
    logWithTimestamp('🔍 Testing command injection vulnerabilities');
    
    const endpoints = [
      '/api/system/exec',
      '/api/deploy',
      '/api/backup',
    ];
    
    for (const endpoint of endpoints) {
      for (const payload of config.payloads.command_injection) {
        await this.testEndpointWithPayload(
          endpoint,
          'command_injection',
          payload,
          ['command', 'script', 'file', 'path']
        );
      }
    }
  }
  
  async testPathTraversal() {
    logWithTimestamp('🔍 Testing path traversal vulnerabilities');
    
    const endpoints = [
      '/api/files',
      '/api/logs',
      '/api/export',
      '/api/download',
    ];
    
    for (const endpoint of endpoints) {
      for (const payload of config.payloads.path_traversal) {
        await this.testEndpointWithPayload(
          endpoint,
          'path_traversal',
          payload,
          ['file', 'path', 'filename', 'document']
        );
      }
    }
  }
  
  async testEndpointWithPayload(endpoint, attackType, payload, paramNames) {
    for (const paramName of paramNames) {
      const testData = { [paramName]: payload };
      
      try {
        const response = await this.makeRequest(endpoint, 'POST', testData);
        
        this.collector.recordTest({
          type: attackType,
          endpoint,
          parameter: paramName,
          payload,
          status_code: response.status,
          response_size: response.headers.get('content-length') || 0,
        });
        
        // Check for potential vulnerabilities
        if (await this.analyzeResponse(response, attackType, payload)) {
          this.collector.recordVulnerability({
            type: attackType,
            endpoint,
            parameter: paramName,
            payload,
            severity: this.determineSeverity(attackType),
            description: `Potential ${attackType} vulnerability detected`,
            evidence: await this.extractEvidence(response, attackType),
          });
        }
        
      } catch (error) {
        this.collector.recordTest({
          type: attackType,
          endpoint,
          parameter: paramName,
          payload,
          error: error.message,
        });
      }
      
      await delay(100); // Rate limiting
    }
  }
  
  async testAuthenticationBypass() {
    logWithTimestamp('🔍 Testing authentication bypass');
    
    const protectedEndpoints = [
      '/api/admin',
      '/api/users',
      '/api/system',
      '/api/deploy',
    ];
    
    const bypassTechniques = [
      { headers: {} }, // No auth header
      { headers: { 'Authorization': 'Bearer invalid' } },
      { headers: { 'Authorization': 'Bearer null' } },
      { headers: { 'Authorization': 'Bearer undefined' } },
      { headers: { 'Authorization': '' } },
      { headers: { 'X-User-Id': '1' } }, // Direct user ID injection
    ];
    
    for (const endpoint of protectedEndpoints) {
      for (const technique of bypassTechniques) {
        try {
          const response = await this.makeRequest(endpoint, 'GET', null, technique.headers);
          
          if (response.status === 200) {
            this.collector.recordVulnerability({
              type: 'authentication_bypass',
              endpoint,
              severity: 'critical',
              description: 'Authentication bypass vulnerability detected',
              evidence: `Endpoint accessible without proper authentication (Status: ${response.status})`,
            });
          }
          
          this.collector.recordTest({
            type: 'auth_bypass',
            endpoint,
            headers: technique.headers,
            status_code: response.status,
          });
          
        } catch (error) {
          // Expected for protected endpoints
        }
      }
    }
  }
  
  async testAuthorizationFlaws() {
    logWithTimestamp('🔍 Testing authorization flaws');
    
    // Test for privilege escalation and horizontal privilege escalation
    const testCases = [
      { endpoint: '/api/users/1', method: 'GET', expected_restriction: true },
      { endpoint: '/api/users/1', method: 'PUT', expected_restriction: true },
      { endpoint: '/api/users/1', method: 'DELETE', expected_restriction: true },
      { endpoint: '/api/admin/users', method: 'GET', expected_restriction: true },
    ];
    
    for (const testCase of testCases) {
      try {
        const response = await this.makeRequest(
          testCase.endpoint,
          testCase.method,
          testCase.method === 'PUT' ? { name: 'hacker' } : null
        );
        
        if (response.status === 200 && testCase.expected_restriction) {
          this.collector.recordVulnerability({
            type: 'authorization_flaw',
            endpoint: testCase.endpoint,
            method: testCase.method,
            severity: 'high',
            description: 'Authorization flaw detected - insufficient access controls',
            evidence: `Endpoint accessible without proper authorization (Status: ${response.status})`,
          });
        }
        
        this.collector.recordTest({
          type: 'authorization',
          endpoint: testCase.endpoint,
          method: testCase.method,
          status_code: response.status,
        });
        
      } catch (error) {
        // This might be expected behavior
      }
    }
  }
  
  async testRateLimiting() {
    logWithTimestamp('🔍 Testing rate limiting');
    
    const endpoint = '/api/health';
    const requests = 100;
    const timeWindow = 1000; // 1 second
    
    const startTime = Date.now();
    const responses = [];
    
    for (let i = 0; i < requests; i++) {
      try {
        const response = await this.makeRequest(endpoint, 'GET');
        responses.push({
          timestamp: Date.now(),
          status: response.status,
        });
      } catch (error) {
        responses.push({
          timestamp: Date.now(),
          error: error.message,
        });
      }
    }
    
    const duration = Date.now() - startTime;
    const successfulRequests = responses.filter(r => r.status === 200).length;
    const rateLimitedRequests = responses.filter(r => r.status === 429).length;
    
    if (rateLimitedRequests === 0 && successfulRequests === requests) {
      this.collector.recordVulnerability({
        type: 'missing_rate_limiting',
        endpoint,
        severity: 'medium',
        description: 'No rate limiting detected',
        evidence: `${successfulRequests}/${requests} requests succeeded in ${duration}ms`,
      });
    }
    
    this.collector.recordTest({
      type: 'rate_limiting',
      endpoint,
      total_requests: requests,
      successful_requests: successfulRequests,
      rate_limited_requests: rateLimitedRequests,
      duration_ms: duration,
    });
  }
  
  async testInputValidation() {
    logWithTimestamp('🔍 Testing input validation');
    
    const testCases = [
      { endpoint: '/api/swarms', data: { name: 'A'.repeat(10000) } }, // Long string
      { endpoint: '/api/swarms', data: { name: null } }, // Null value
      { endpoint: '/api/swarms', data: { name: { nested: 'object' } } }, // Object instead of string
      { endpoint: '/api/swarms', data: { name: ['array', 'value'] } }, // Array instead of string
      { endpoint: '/api/swarms', data: { name: 123456 } }, // Number instead of string
    ];
    
    for (const testCase of testCases) {
      try {
        const response = await this.makeRequest(testCase.endpoint, 'POST', testCase.data);
        
        // Check if server properly validates input
        if (response.status === 200) {
          this.collector.recordVulnerability({
            type: 'insufficient_input_validation',
            endpoint: testCase.endpoint,
            severity: 'medium',
            description: 'Insufficient input validation detected',
            evidence: `Server accepted invalid input: ${JSON.stringify(testCase.data)}`,
          });
        }
        
        this.collector.recordTest({
          type: 'input_validation',
          endpoint: testCase.endpoint,
          input: testCase.data,
          status_code: response.status,
        });
        
      } catch (error) {
        // Expected for invalid input
      }
    }
  }
  
  async testHeaderInjection() {
    logWithTimestamp('🔍 Testing header injection vulnerabilities');
    
    for (const [headerName, headerValue] of Object.entries(config.maliciousHeaders)) {
      try {
        const response = await this.makeRequest('/api/health', 'GET', null, {
          [headerName]: headerValue,
        });
        
        const responseText = await response.text();
        
        // Check if malicious header value is reflected in response
        if (responseText.includes(headerValue)) {
          this.collector.recordVulnerability({
            type: 'header_injection',
            header: headerName,
            severity: 'medium',
            description: 'Header injection vulnerability detected',
            evidence: `Malicious header value reflected in response`,
          });
        }
        
        this.collector.recordTest({
          type: 'header_injection',
          header: headerName,
          value: headerValue,
          status_code: response.status,
        });
        
      } catch (error) {
        // Log but continue
      }
    }
  }
  
  async testCorsConfiguration() {
    logWithTimestamp('🔍 Testing CORS configuration');
    
    const maliciousOrigins = [
      'http://evil.com',
      'https://malicious.example.com',
      'null',
      '*',
    ];
    
    for (const origin of maliciousOrigins) {
      try {
        const response = await this.makeRequest('/api/health', 'GET', null, {
          'Origin': origin,
        });
        
        const corsHeader = response.headers.get('Access-Control-Allow-Origin');
        
        if (corsHeader === origin || corsHeader === '*') {
          this.collector.recordVulnerability({
            type: 'cors_misconfiguration',
            severity: corsHeader === '*' ? 'high' : 'medium',
            description: 'CORS misconfiguration detected',
            evidence: `Server allows origin: ${origin}, CORS header: ${corsHeader}`,
          });
        }
        
        this.collector.recordTest({
          type: 'cors',
          origin,
          cors_header: corsHeader,
          status_code: response.status,
        });
        
      } catch (error) {
        // Continue testing
      }
    }
  }
  
  async testSensitiveDataExposure() {
    logWithTimestamp('🔍 Testing for sensitive data exposure');
    
    const sensitiveEndpoints = [
      '/api/debug',
      '/api/config',
      '/api/env',
      '/.env',
      '/config.json',
      '/package.json',
    ];
    
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /api[_-]?key/i,
      /database[_-]?url/i,
    ];
    
    for (const endpoint of sensitiveEndpoints) {
      try {
        const response = await this.makeRequest(endpoint, 'GET');
        
        if (response.status === 200) {
          const responseText = await response.text();
          
          for (const pattern of sensitivePatterns) {
            if (pattern.test(responseText)) {
              this.collector.recordVulnerability({
                type: 'sensitive_data_exposure',
                endpoint,
                severity: 'high',
                description: 'Sensitive data exposure detected',
                evidence: `Endpoint exposes sensitive information matching pattern: ${pattern}`,
              });
              break;
            }
          }
        }
        
        this.collector.recordTest({
          type: 'sensitive_data',
          endpoint,
          status_code: response.status,
        });
        
      } catch (error) {
        // Expected for most cases
      }
    }
  }
  
  async testSecurityHeaders() {
    logWithTimestamp('🔍 Testing security headers');
    
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security',
      'Content-Security-Policy',
    ];
    
    try {
      const response = await this.makeRequest('/api/health', 'GET');
      
      for (const header of requiredHeaders) {
        if (!response.headers.get(header)) {
          this.collector.recordVulnerability({
            type: 'missing_security_header',
            header,
            severity: 'low',
            description: `Missing security header: ${header}`,
            evidence: `Response does not include ${header} header`,
          });
        }
      }
      
      this.collector.recordTest({
        type: 'security_headers',
        headers_present: requiredHeaders.filter(h => response.headers.get(h)),
        headers_missing: requiredHeaders.filter(h => !response.headers.get(h)),
      });
      
    } catch (error) {
      logWithTimestamp(`⚠️  Failed to test security headers: ${error.message}`);
    }
  }
  
  async makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SecurityTester/1.0',
        ...headers,
      },
      timeout: config.timeout,
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    return await fetch(url, options);
  }
  
  async analyzeResponse(response, attackType, payload) {
    const responseText = await response.text();
    
    switch (attackType) {
      case 'sql_injection':
        return this.detectSqlInjectionResponse(responseText, response.status);
      case 'xss':
        return this.detectXssResponse(responseText, payload);
      case 'command_injection':
        return this.detectCommandInjectionResponse(responseText);
      case 'path_traversal':
        return this.detectPathTraversalResponse(responseText);
      default:
        return false;
    }
  }
  
  detectSqlInjectionResponse(responseText, statusCode) {
    const sqlErrorPatterns = [
      /SQL syntax.*MySQL/i,
      /Warning.*mysql_/i,
      /PostgreSQL.*ERROR/i,
      /ORA-[0-9]+/i,
      /Microsoft.*ODBC.*SQL/i,
    ];
    
    return sqlErrorPatterns.some(pattern => pattern.test(responseText)) ||
           (statusCode === 500 && responseText.includes('database'));
  }
  
  detectXssResponse(responseText, payload) {
    // Check if payload is reflected without proper encoding
    return responseText.includes(payload);
  }
  
  detectCommandInjectionResponse(responseText) {
    const commandPatterns = [
      /root:.*:/,      // Unix passwd file
      /uid=.*gid=/,    // Unix id command
      /Directory of/i,  // Windows dir command
    ];
    
    return commandPatterns.some(pattern => pattern.test(responseText));
  }
  
  detectPathTraversalResponse(responseText) {
    const pathTraversalPatterns = [
      /root:.*:/,      // Unix passwd file
      /\[boot loader\]/i, // Windows boot.ini
      /# /,            // Unix config files
    ];
    
    return pathTraversalPatterns.some(pattern => pattern.test(responseText));
  }
  
  determineSeverity(attackType) {
    const severityMap = {
      'sql_injection': 'critical',
      'command_injection': 'critical',
      'authentication_bypass': 'critical',
      'authorization_flaw': 'high',
      'xss': 'high',
      'path_traversal': 'high',
      'cors_misconfiguration': 'medium',
      'sensitive_data_exposure': 'high',
      'header_injection': 'medium',
      'missing_rate_limiting': 'medium',
      'insufficient_input_validation': 'medium',
      'missing_security_header': 'low',
    };
    
    return severityMap[attackType] || 'medium';
  }
  
  async extractEvidence(response, attackType) {
    const responseText = await response.text();
    
    return {
      status_code: response.status,
      content_type: response.headers.get('content-type'),
      response_snippet: responseText.substring(0, 500),
      headers: Object.fromEntries(response.headers.entries()),
    };
  }
}

// Main security testing function
async function runSecurityTests() {
  logWithTimestamp('🔒 Starting API security testing suite');
  
  const collector = new SecurityTestCollector();
  const tester = new ApiSecurityTester(collector, config.target.api);
  
  try {
    await tester.runAllTests();
    
    const report = collector.generateReport();
    
    // Save detailed results
    await fs.writeFile(config.outputFile, JSON.stringify(report, null, 2), 'utf8');
    
    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('API SECURITY TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`🧪 Total Tests: ${report.summary.total_tests}`);
    console.log(`🚨 Vulnerabilities Found: ${report.summary.vulnerabilities_found}`);
    console.log(`🔴 Critical: ${report.summary.critical_issues}`);
    console.log(`🟠 High: ${report.summary.high_issues}`);
    console.log(`🟡 Medium: ${report.summary.medium_issues}`);
    console.log(`🟢 Low: ${report.summary.low_issues}`);
    console.log(`📄 Report saved to: ${config.outputFile}`);
    console.log('='.repeat(60));
    
    if (report.summary.vulnerabilities_found > 0) {
      console.log('\n🚨 VULNERABILITIES DETECTED:');
      report.vulnerabilities.forEach((vuln, index) => {
        const severityIcon = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[vuln.severity] || '⚪';
        
        console.log(`${severityIcon} ${index + 1}. ${vuln.type} (${vuln.severity})`);
        console.log(`   ${vuln.description}`);
        if (vuln.endpoint) console.log(`   Endpoint: ${vuln.endpoint}`);
        console.log('');
      });
    }
    
    // Exit with error code if critical or high severity issues found
    const criticalIssues = report.summary.critical_issues + report.summary.high_issues;
    process.exit(criticalIssues > 0 ? 1 : 0);
    
  } catch (error) {
    logWithTimestamp(`❌ Security testing failed: ${error.message}`);
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  logWithTimestamp(`❌ Unhandled rejection: ${error.message}`);
  process.exit(1);
});

// Main execution
if (require.main === module) {
  runSecurityTests();
}

module.exports = {
  runSecurityTests,
  ApiSecurityTester,
  SecurityTestCollector,
};