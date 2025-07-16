#!/usr/bin/env node

/**
 * 🔍 Langfuse Key Validation System
 * 
 * Advanced validation system for Langfuse API keys with comprehensive testing,
 * performance monitoring, and automated health checks.
 * 
 * Features:
 * - Multi-stage validation pipeline
 * - Performance benchmarking
 * - Connection quality assessment
 * - Automated key testing
 * - Health scoring system
 * - Integration testing
 * 
 * Author: API Key Specialist Agent
 * Date: 2025-07-14
 */

import { Langfuse } from 'langfuse';
import { performance } from 'perf_hooks';

class LangfuseKeyValidator {
  constructor(options = {}) {
    this.config = {
      langfuseHost: options.langfuseHost || 'http://localhost:3000',
      timeout: options.timeout || 10000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      performanceThreshold: options.performanceThreshold || 2000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      ...options
    };
    
    this.validationResults = new Map();
    this.performanceMetrics = new Map();
    this.healthHistory = [];
  }

  /**
   * Comprehensive key validation pipeline
   */
  async validateKeys(publicKey, secretKey) {
    const startTime = performance.now();
    
    try {
      console.log('🔍 Starting comprehensive key validation...');
      
      const results = {
        valid: false,
        score: 0,
        timestamp: Date.now(),
        duration: 0,
        tests: {},
        performance: {},
        recommendations: []
      };
      
      // Stage 1: Format validation
      results.tests.format = await this.validateFormat(publicKey, secretKey);
      
      // Stage 2: Connection test
      results.tests.connection = await this.validateConnection(publicKey, secretKey);
      
      // Stage 3: Authentication test
      results.tests.authentication = await this.validateAuthentication(publicKey, secretKey);
      
      // Stage 4: API functionality test
      results.tests.apiFunction = await this.validateApiFunction(publicKey, secretKey);
      
      // Stage 5: Performance test
      results.tests.performance = await this.validatePerformance(publicKey, secretKey);
      
      // Stage 6: Integration test
      results.tests.integration = await this.validateIntegration(publicKey, secretKey);
      
      // Calculate overall score
      results.score = this.calculateValidationScore(results.tests);
      results.valid = results.score >= 0.8; // 80% threshold
      
      // Generate recommendations
      results.recommendations = this.generateRecommendations(results.tests);
      
      results.duration = performance.now() - startTime;
      
      // Store results
      this.validationResults.set(`${publicKey}-${secretKey}`, results);
      
      console.log(`✅ Validation complete - Score: ${(results.score * 100).toFixed(1)}%`);
      
      return results;
    } catch (error) {
      console.error('❌ Validation failed:', error);
      return {
        valid: false,
        score: 0,
        error: error.message,
        timestamp: Date.now(),
        duration: performance.now() - startTime
      };
    }
  }

  /**
   * Validate key format
   */
  async validateFormat(publicKey, secretKey) {
    try {
      const publicKeyRegex = /^pk-lf-[a-f0-9-]{36}$/;
      const secretKeyRegex = /^sk-lf-[a-f0-9]{64}$|^sk-lf-[a-zA-Z0-9]{26}$/;
      
      const publicValid = publicKeyRegex.test(publicKey);
      const secretValid = secretKeyRegex.test(secretKey);
      
      return {
        passed: publicValid && secretValid,
        score: publicValid && secretValid ? 1.0 : 0.0,
        details: {
          publicKey: {
            valid: publicValid,
            format: publicKey ? publicKey.substring(0, 10) + '...' : 'missing',
            length: publicKey ? publicKey.length : 0
          },
          secretKey: {
            valid: secretValid,
            format: secretKey ? secretKey.substring(0, 10) + '...' : 'missing',
            length: secretKey ? secretKey.length : 0
          }
        }
      };
    } catch (error) {
      return {
        passed: false,
        score: 0.0,
        error: error.message
      };
    }
  }

  /**
   * Validate connection to Langfuse
   */
  async validateConnection(publicKey, secretKey) {
    try {
      const startTime = performance.now();
      
      const fetch = (await import('node-fetch')).default;
      
      const response = await Promise.race([
        fetch(`${this.config.langfuseHost}/api/public/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicKey}`,
            'Content-Type': 'application/json'
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.config.timeout)
        )
      ]);
      
      const duration = performance.now() - startTime;
      
      return {
        passed: response.ok,
        score: response.ok ? 1.0 : 0.0,
        details: {
          status: response.status,
          statusText: response.statusText,
          duration: Math.round(duration),
          host: this.config.langfuseHost,
          accessible: response.ok
        }
      };
    } catch (error) {
      return {
        passed: false,
        score: 0.0,
        error: error.message,
        details: {
          host: this.config.langfuseHost,
          accessible: false
        }
      };
    }
  }

  /**
   * Validate authentication
   */
  async validateAuthentication(publicKey, secretKey) {
    try {
      const startTime = performance.now();
      
      const fetch = (await import('node-fetch')).default;
      
      const response = await Promise.race([
        fetch(`${this.config.langfuseHost}/api/public/traces`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicKey}`,
            'Content-Type': 'application/json'
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication timeout')), this.config.timeout)
        )
      ]);
      
      const duration = performance.now() - startTime;
      
      const authenticated = response.status !== 401 && response.status !== 403;
      
      return {
        passed: authenticated,
        score: authenticated ? 1.0 : 0.0,
        details: {
          status: response.status,
          statusText: response.statusText,
          duration: Math.round(duration),
          authenticated,
          canAccessTraces: response.ok
        }
      };
    } catch (error) {
      return {
        passed: false,
        score: 0.0,
        error: error.message,
        details: {
          authenticated: false,
          canAccessTraces: false
        }
      };
    }
  }

  /**
   * Validate API functionality
   */
  async validateApiFunction(publicKey, secretKey) {
    try {
      const startTime = performance.now();
      
      const client = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: this.config.langfuseHost,
        flushAt: 1,
        flushInterval: 1000
      });
      
      // Test trace creation
      const testTraceId = `validation-${Date.now()}`;
      const trace = client.trace({
        id: testTraceId,
        name: 'API Function Validation',
        sessionId: 'validation-session',
        input: { test: 'api-function' },
        metadata: {
          validator: 'LangfuseKeyValidator',
          timestamp: new Date().toISOString()
        }
      });
      
      // Test span creation
      const span = trace.span({
        name: 'Validation Span',
        input: { test: 'span-creation' }
      });
      
      // Test generation
      const generation = trace.generation({
        name: 'Validation Generation',
        model: 'validation-model',
        input: 'test prompt'
      });
      
      generation.end({ output: 'test response' });
      span.end();
      
      await client.flushAsync();
      await client.shutdownAsync();
      
      const duration = performance.now() - startTime;
      
      return {
        passed: true,
        score: 1.0,
        details: {
          traceCreated: true,
          spanCreated: true,
          generationCreated: true,
          traceId: testTraceId,
          duration: Math.round(duration),
          flushed: true
        }
      };
    } catch (error) {
      return {
        passed: false,
        score: 0.0,
        error: error.message,
        details: {
          traceCreated: false,
          spanCreated: false,
          generationCreated: false,
          flushed: false
        }
      };
    }
  }

  /**
   * Validate performance
   */
  async validatePerformance(publicKey, secretKey) {
    try {
      const testResults = {
        traceCreationTime: 0,
        flushTime: 0,
        totalTime: 0,
        throughput: 0
      };
      
      const startTime = performance.now();
      
      const client = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: this.config.langfuseHost,
        flushAt: 5,
        flushInterval: 1000
      });
      
      // Test multiple trace creation
      const traceStartTime = performance.now();
      
      for (let i = 0; i < 5; i++) {
        client.trace({
          id: `perf-test-${i}-${Date.now()}`,
          name: `Performance Test ${i}`,
          sessionId: 'performance-test',
          input: { test: 'performance', iteration: i },
          metadata: { performance: true }
        });
      }
      
      testResults.traceCreationTime = performance.now() - traceStartTime;
      
      // Test flush performance
      const flushStartTime = performance.now();
      await client.flushAsync();
      testResults.flushTime = performance.now() - flushStartTime;
      
      await client.shutdownAsync();
      
      testResults.totalTime = performance.now() - startTime;
      testResults.throughput = 5000 / testResults.totalTime; // traces per second
      
      const performanceScore = this.calculatePerformanceScore(testResults);
      
      return {
        passed: performanceScore > 0.5,
        score: performanceScore,
        details: {
          ...testResults,
          performanceGrade: this.getPerformanceGrade(performanceScore),
          withinThreshold: testResults.totalTime < this.config.performanceThreshold
        }
      };
    } catch (error) {
      return {
        passed: false,
        score: 0.0,
        error: error.message,
        details: {
          traceCreationTime: 0,
          flushTime: 0,
          totalTime: 0,
          throughput: 0
        }
      };
    }
  }

  /**
   * Validate integration with swarm system
   */
  async validateIntegration(publicKey, secretKey) {
    try {
      const startTime = performance.now();
      
      const client = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: this.config.langfuseHost,
        flushAt: 1,
        flushInterval: 1000
      });
      
      // Test swarm-specific features
      const swarmTrace = client.trace({
        id: `swarm-integration-${Date.now()}`,
        name: 'Swarm Integration Test',
        sessionId: 'swarm-validation',
        input: { test: 'swarm-integration' },
        metadata: {
          swarmId: 'validation-swarm',
          agentId: 'validation-agent',
          claudeFlow: true,
          integration: true
        },
        tags: ['swarm', 'integration', 'validation']
      });
      
      // Test agent coordination
      const coordinationSpan = swarmTrace.span({
        name: 'Agent Coordination',
        input: { agents: ['agent-1', 'agent-2'] },
        metadata: { coordination: true }
      });
      
      // Test MCP tool call
      const mcpSpan = swarmTrace.span({
        name: 'MCP Tool Call',
        input: { tool: 'test-tool', params: { test: true } },
        metadata: { mcp: true }
      });
      
      coordinationSpan.end();
      mcpSpan.end();
      
      await client.flushAsync();
      await client.shutdownAsync();
      
      const duration = performance.now() - startTime;
      
      return {
        passed: true,
        score: 1.0,
        details: {
          swarmTraceCreated: true,
          coordinationSpanCreated: true,
          mcpSpanCreated: true,
          duration: Math.round(duration),
          swarmCompatible: true
        }
      };
    } catch (error) {
      return {
        passed: false,
        score: 0.0,
        error: error.message,
        details: {
          swarmTraceCreated: false,
          coordinationSpanCreated: false,
          mcpSpanCreated: false,
          swarmCompatible: false
        }
      };
    }
  }

  /**
   * Calculate overall validation score
   */
  calculateValidationScore(tests) {
    const weights = {
      format: 0.1,
      connection: 0.2,
      authentication: 0.25,
      apiFunction: 0.25,
      performance: 0.1,
      integration: 0.1
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [testName, testResult] of Object.entries(tests)) {
      if (weights[testName] && testResult.score !== undefined) {
        totalScore += testResult.score * weights[testName];
        totalWeight += weights[testName];
      }
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(results) {
    const { totalTime, throughput } = results;
    
    // Score based on total time (lower is better)
    const timeScore = Math.max(0, 1 - (totalTime / this.config.performanceThreshold));
    
    // Score based on throughput (higher is better)
    const throughputScore = Math.min(1, throughput / 10); // 10 traces/second = perfect score
    
    return (timeScore + throughputScore) / 2;
  }

  /**
   * Get performance grade
   */
  getPerformanceGrade(score) {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Good';
    if (score >= 0.7) return 'Fair';
    if (score >= 0.6) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(tests) {
    const recommendations = [];
    
    if (!tests.format?.passed) {
      recommendations.push({
        type: 'error',
        message: 'Invalid key format. Please verify your Langfuse API keys.',
        action: 'Check key format in Langfuse UI'
      });
    }
    
    if (!tests.connection?.passed) {
      recommendations.push({
        type: 'error',
        message: 'Cannot connect to Langfuse. Check if service is running.',
        action: 'Verify Langfuse service status and network connectivity'
      });
    }
    
    if (!tests.authentication?.passed) {
      recommendations.push({
        type: 'error',
        message: 'Authentication failed. Keys may be incorrect or expired.',
        action: 'Regenerate keys in Langfuse UI'
      });
    }
    
    if (!tests.apiFunction?.passed) {
      recommendations.push({
        type: 'error',
        message: 'API functionality test failed. Service may be degraded.',
        action: 'Check Langfuse logs and service health'
      });
    }
    
    if (tests.performance?.score < 0.7) {
      recommendations.push({
        type: 'warning',
        message: 'Poor performance detected. Consider optimizing configuration.',
        action: 'Adjust flush settings or check system resources'
      });
    }
    
    if (!tests.integration?.passed) {
      recommendations.push({
        type: 'warning',
        message: 'Swarm integration test failed. Some features may not work.',
        action: 'Verify swarm-specific configuration'
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        message: 'All tests passed! Keys are working optimally.',
        action: 'No action required'
      });
    }
    
    return recommendations;
  }

  /**
   * Quick validation for fast checks
   */
  async quickValidate(publicKey, secretKey) {
    try {
      const startTime = performance.now();
      
      // Basic format check
      const formatResult = await this.validateFormat(publicKey, secretKey);
      if (!formatResult.passed) {
        return { valid: false, reason: 'Invalid format', duration: performance.now() - startTime };
      }
      
      // Quick connection test
      const connectionResult = await this.validateConnection(publicKey, secretKey);
      if (!connectionResult.passed) {
        return { valid: false, reason: 'Connection failed', duration: performance.now() - startTime };
      }
      
      return { 
        valid: true, 
        duration: performance.now() - startTime,
        quickTest: true
      };
    } catch (error) {
      return { 
        valid: false, 
        reason: error.message, 
        duration: performance.now() - startTime 
      };
    }
  }

  /**
   * Batch validate multiple key pairs
   */
  async batchValidate(keyPairs) {
    const results = [];
    
    for (const keyPair of keyPairs) {
      const result = await this.validateKeys(keyPair.publicKey, keyPair.secretKey);
      results.push({
        ...keyPair,
        validation: result
      });
    }
    
    return results;
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    const stats = {
      totalValidations: this.validationResults.size,
      successRate: 0,
      averageScore: 0,
      averageDuration: 0,
      commonIssues: {},
      performanceDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      }
    };
    
    if (this.validationResults.size === 0) {
      return stats;
    }
    
    let totalScore = 0;
    let totalDuration = 0;
    let successCount = 0;
    
    for (const result of this.validationResults.values()) {
      if (result.valid) successCount++;
      totalScore += result.score;
      totalDuration += result.duration;
      
      // Track common issues
      if (result.tests) {
        for (const [testName, testResult] of Object.entries(result.tests)) {
          if (!testResult.passed) {
            stats.commonIssues[testName] = (stats.commonIssues[testName] || 0) + 1;
          }
        }
      }
      
      // Track performance distribution
      if (result.tests?.performance) {
        const grade = this.getPerformanceGrade(result.tests.performance.score);
        const gradeKey = grade.toLowerCase().replace(' ', '');
        if (stats.performanceDistribution[gradeKey] !== undefined) {
          stats.performanceDistribution[gradeKey]++;
        }
      }
    }
    
    stats.successRate = (successCount / this.validationResults.size) * 100;
    stats.averageScore = (totalScore / this.validationResults.size) * 100;
    stats.averageDuration = totalDuration / this.validationResults.size;
    
    return stats;
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationResults.clear();
    this.performanceMetrics.clear();
    this.healthHistory = [];
    console.log('🧹 Validation cache cleared');
  }
}

export default LangfuseKeyValidator;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new LangfuseKeyValidator();
  
  const command = process.argv[2];
  const publicKey = process.argv[3];
  const secretKey = process.argv[4];
  
  switch (command) {
    case 'validate':
      if (!publicKey || !secretKey) {
        console.error('Usage: node LangfuseKeyValidator.js validate <public_key> <secret_key>');
        process.exit(1);
      }
      validator.validateKeys(publicKey, secretKey).then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
      break;
      
    case 'quick':
      if (!publicKey || !secretKey) {
        console.error('Usage: node LangfuseKeyValidator.js quick <public_key> <secret_key>');
        process.exit(1);
      }
      validator.quickValidate(publicKey, secretKey).then(result => {
        console.log(JSON.stringify(result, null, 2));
      });
      break;
      
    case 'stats':
      const stats = validator.getValidationStats();
      console.log(JSON.stringify(stats, null, 2));
      break;
      
    default:
      console.log('Usage: node LangfuseKeyValidator.js [validate|quick|stats] [args...]');
  }
}