#!/usr/bin/env node

/**
 * 🎬 Langfuse API Key Management System Demo
 * 
 * Comprehensive demonstration of the API key management system
 * showing all features in action with real-time monitoring.
 * 
 * Author: API Key Specialist Agent
 * Date: 2025-07-14
 */

import chalk from 'chalk';
import ora from 'ora';
import { EventEmitter } from 'events';

import LangfuseApiKeyManager from './LangfuseApiKeyManager.js';
import LangfuseKeyValidator from './LangfuseKeyValidator.js';
import AutomatedKeyTester from './AutomatedKeyTester.js';
import LangfuseIntegration from './LangfuseIntegration.js';

class ApiKeyManagementDemo extends EventEmitter {
  constructor() {
    super();
    this.steps = [
      { name: 'Initialize Key Manager', fn: this.demoKeyManager },
      { name: 'Validate API Keys', fn: this.demoValidation },
      { name: 'Run Automated Tests', fn: this.demoTesting },
      { name: 'Integration Demo', fn: this.demoIntegration },
      { name: 'Monitoring Demo', fn: this.demoMonitoring },
      { name: 'Error Recovery Demo', fn: this.demoErrorRecovery },
      { name: 'Performance Demo', fn: this.demoPerformance },
      { name: 'Cleanup', fn: this.demoCleanup }
    ];
    
    this.currentStep = 0;
    this.demoData = {
      manager: null,
      validator: null,
      tester: null,
      integration: null,
      keys: null
    };
  }

  /**
   * Start the demonstration
   */
  async start() {
    console.log(chalk.bold.cyan('\n🎬 Langfuse API Key Management System Demo'));
    console.log(chalk.gray('=' .repeat(60)));
    
    console.log(chalk.bold('\n📋 Demo Overview:'));
    this.steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step.name}`);
    });
    
    console.log(chalk.gray('\n' + '=' .repeat(60)));
    
    // Wait for user input
    await this.waitForInput('Press Enter to start the demo...');
    
    // Run each step
    for (let i = 0; i < this.steps.length; i++) {
      this.currentStep = i;
      await this.runStep(this.steps[i]);
    }
    
    console.log(chalk.bold.green('\n🎉 Demo completed successfully!'));
    console.log(chalk.gray('Thank you for watching the API Key Management System demo.'));
  }

  /**
   * Run a demo step
   */
  async runStep(step) {
    console.log(chalk.bold.yellow(`\n📍 Step ${this.currentStep + 1}: ${step.name}`));
    console.log(chalk.gray('-' .repeat(40)));
    
    try {
      await step.fn.call(this);
      console.log(chalk.green('✅ Step completed successfully'));
      
      if (this.currentStep < this.steps.length - 1) {
        await this.waitForInput('Press Enter to continue...');
      }
    } catch (error) {
      console.error(chalk.red('❌ Step failed:'), error.message);
      
      const continueDemo = await this.askQuestion('Continue with demo? (y/n): ');
      if (continueDemo.toLowerCase() !== 'y') {
        throw new Error('Demo cancelled by user');
      }
    }
  }

  /**
   * Demo 1: Key Manager
   */
  async demoKeyManager() {
    console.log(chalk.blue('🔧 Initializing API Key Manager...'));
    
    const spinner = ora('Setting up key manager').start();
    
    try {
      this.demoData.manager = new LangfuseApiKeyManager({
        langfuseHost: 'http://localhost:3000',
        enableHealthMonitoring: true
      });
      
      await this.demoData.manager.initialize();
      
      spinner.succeed('Key manager initialized');
      
      // Get current keys
      this.demoData.keys = await this.demoData.manager.getCurrentKeys();
      
      if (this.demoData.keys) {
        console.log(chalk.green('✅ Keys loaded successfully'));
        console.log(`   Source: ${this.demoData.keys.source}`);
        console.log(`   Validated: ${this.demoData.keys.validated}`);
        console.log(`   Health: ${this.demoData.keys.health}`);
      } else {
        console.log(chalk.yellow('⚠️ No keys found, will use fallback keys'));
        
        // Use the known working keys for demo
        this.demoData.keys = {
          publicKey: 'pk-lf-REDACTED',
          secretKey: 'sk-lf-5f3b4323-450a-49bb-9dfc-f55da800d343',
          source: 'demo-fallback',
          validated: false,
          health: 'pending'
        };
      }
      
      // Show status
      const status = await this.demoData.manager.getStatus();
      
      console.log(chalk.blue('\n📊 Key Manager Status:'));
      console.log(`   Initialized: ${status.initialized}`);
      console.log(`   Keys Available: ${status.currentKeys.hasKeys}`);
      console.log(`   Monitoring: ${status.monitoring}`);
      console.log(`   Cache Size: ${status.cacheSize}`);
      
    } catch (error) {
      spinner.fail('Key manager initialization failed');
      throw error;
    }
  }

  /**
   * Demo 2: Validation
   */
  async demoValidation() {
    console.log(chalk.blue('🔍 Demonstrating API Key Validation...'));
    
    const spinner = ora('Initializing validator').start();
    
    try {
      this.demoData.validator = new LangfuseKeyValidator({
        langfuseHost: 'http://localhost:3000'
      });
      
      spinner.succeed('Validator initialized');
      
      // Run comprehensive validation
      spinner.start('Running comprehensive validation...');
      
      const validation = await this.demoData.validator.validateKeys(
        this.demoData.keys.publicKey,
        this.demoData.keys.secretKey
      );
      
      spinner.succeed('Validation completed');
      
      // Display results
      console.log(chalk.blue('\n📈 Validation Results:'));
      console.log(`   Overall Score: ${(validation.score * 100).toFixed(1)}%`);
      console.log(`   Valid: ${validation.valid ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`   Duration: ${validation.duration.toFixed(2)}ms`);
      
      if (validation.tests) {
        console.log(chalk.blue('\n🧪 Test Results:'));
        
        for (const [testName, result] of Object.entries(validation.tests)) {
          const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
          const score = `${(result.score * 100).toFixed(1)}%`;
          
          console.log(`   ${testName}: ${status} (${score})`);
        }
      }
      
      if (validation.recommendations) {
        console.log(chalk.blue('\n💡 Recommendations:'));
        
        for (const rec of validation.recommendations) {
          const icon = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : '✅';
          console.log(`   ${icon} ${rec.message}`);
        }
      }
      
    } catch (error) {
      spinner.fail('Validation failed');
      throw error;
    }
  }

  /**
   * Demo 3: Testing
   */
  async demoTesting() {
    console.log(chalk.blue('🧪 Demonstrating Automated Testing...'));
    
    const spinner = ora('Initializing tester').start();
    
    try {
      this.demoData.tester = new AutomatedKeyTester({
        langfuseHost: 'http://localhost:3000'
      });
      
      this.demoData.tester.setKeys(
        this.demoData.keys.publicKey,
        this.demoData.keys.secretKey
      );
      
      spinner.succeed('Tester initialized');
      
      // Run basic test suite
      spinner.start('Running basic test suite...');
      
      const basicResult = await this.demoData.tester.runTestSuite('basic');
      
      spinner.succeed('Basic tests completed');
      
      console.log(chalk.blue('\n📊 Basic Test Results:'));
      console.log(`   Passed: ${basicResult.passed ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`   Duration: ${basicResult.duration.toFixed(2)}ms`);
      
      // Run stress test
      spinner.start('Running stress test...');
      
      const stressResult = await this.demoData.tester.runTestSuite('stress');
      
      spinner.succeed('Stress tests completed');
      
      console.log(chalk.blue('\n⚡ Stress Test Results:'));
      console.log(`   Passed: ${stressResult.passed ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`   Concurrent Tests: ${stressResult.concurrentTests}`);
      console.log(`   Total Traces: ${stressResult.totalTraces}`);
      console.log(`   Failed Traces: ${stressResult.failedTraces}`);
      
      if (stressResult.averageLatency) {
        console.log(`   Average Latency: ${stressResult.averageLatency.toFixed(2)}ms`);
      }
      
      if (stressResult.throughput) {
        console.log(`   Throughput: ${stressResult.throughput.toFixed(2)} traces/sec`);
      }
      
      // Show test statistics
      const stats = this.demoData.tester.getTestStatistics();
      
      console.log(chalk.blue('\n📈 Test Statistics:'));
      console.log(`   Total Tests: ${stats.totalTests}`);
      console.log(`   Success Rate: ${stats.successRate.toFixed(1)}%`);
      console.log(`   Average Duration: ${stats.averageDuration.toFixed(2)}ms`);
      
    } catch (error) {
      spinner.fail('Testing failed');
      throw error;
    }
  }

  /**
   * Demo 4: Integration
   */
  async demoIntegration() {
    console.log(chalk.blue('🔗 Demonstrating Seamless Integration...'));
    
    const spinner = ora('Initializing integration').start();
    
    try {
      this.demoData.integration = new LangfuseIntegration({
        langfuseHost: 'http://localhost:3000',
        enableMonitoring: true,
        enableTesting: true
      });
      
      await this.demoData.integration.initialize();
      
      spinner.succeed('Integration initialized');
      
      // Test Langfuse client
      spinner.start('Testing Langfuse client...');
      
      const client = this.demoData.integration.getLangfuseClient();
      
      // Create a demo trace
      const trace = await this.demoData.integration.createTrace(
        'Demo Integration Test',
        { demo: true, timestamp: new Date().toISOString() },
        { 
          source: 'api-key-management-demo',
          swarmId: 'demo-swarm',
          agentId: 'demo-agent'
        }
      );
      
      await this.demoData.integration.flush();
      
      spinner.succeed('Integration test completed');
      
      // Show integration status
      const status = this.demoData.integration.getIntegrationStatus();
      
      console.log(chalk.blue('\n🔄 Integration Status:'));
      console.log(`   Initialized: ${status.initialized}`);
      console.log(`   Status: ${status.status}`);
      console.log(`   Client Host: ${status.client.host}`);
      console.log(`   Monitoring Enabled: ${status.monitoring.enabled}`);
      console.log(`   Testing Enabled: ${status.monitoring.testing}`);
      
      if (status.currentKeys) {
        console.log(`   Key Source: ${status.currentKeys.source}`);
        console.log(`   Key Health: ${status.currentKeys.health}`);
      }
      
    } catch (error) {
      spinner.fail('Integration failed');
      throw error;
    }
  }

  /**
   * Demo 5: Monitoring
   */
  async demoMonitoring() {
    console.log(chalk.blue('📊 Demonstrating Real-time Monitoring...'));
    
    const spinner = ora('Starting monitoring').start();
    
    try {
      // Set up event handlers
      this.demoData.tester.on('test-complete', (result) => {
        const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
        console.log(`   🔍 ${result.suite} test: ${status}`);
      });
      
      this.demoData.tester.on('test-failure', (result) => {
        console.log(`   ⚠️ Test failure: ${result.error}`);
      });
      
      // Start monitoring
      await this.demoData.tester.start();
      
      spinner.succeed('Monitoring started');
      
      console.log(chalk.blue('\n📈 Monitoring Active:'));
      console.log('   - Continuous key validation');
      console.log('   - Performance monitoring');
      console.log('   - Health checks');
      console.log('   - Error detection');
      
      // Let it run for a few seconds
      console.log(chalk.yellow('\n⏳ Monitoring for 10 seconds...'));
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Stop monitoring
      await this.demoData.tester.stop();
      
      console.log(chalk.green('✅ Monitoring demonstration complete'));
      
    } catch (error) {
      spinner.fail('Monitoring failed');
      throw error;
    }
  }

  /**
   * Demo 6: Error Recovery
   */
  async demoErrorRecovery() {
    console.log(chalk.blue('🔧 Demonstrating Error Recovery...'));
    
    console.log(chalk.yellow('   Simulating error conditions...'));
    
    try {
      // Simulate key validation failure
      const invalidKeys = {
        publicKey: 'pk-lf-invalid-key',
        secretKey: 'sk-lf-invalid-key'
      };
      
      const validation = await this.demoData.validator.validateKeys(
        invalidKeys.publicKey,
        invalidKeys.secretKey
      );
      
      console.log(chalk.red('   ❌ Invalid keys detected (as expected)'));
      console.log(`   Validation Score: ${(validation.score * 100).toFixed(1)}%`);
      
      // Demonstrate recovery
      console.log(chalk.blue('\n🔄 Attempting recovery...'));
      
      const recoveryResult = await this.demoData.manager.refreshKeys();
      
      if (recoveryResult) {
        console.log(chalk.green('   ✅ Recovery successful'));
        
        const recoveredKeys = await this.demoData.manager.getCurrentKeys();
        console.log(`   New key source: ${recoveredKeys.source}`);
        console.log(`   Validation status: ${recoveredKeys.validated}`);
      } else {
        console.log(chalk.yellow('   ⚠️ Recovery failed, using fallback keys'));
      }
      
    } catch (error) {
      console.log(chalk.red('   ❌ Error recovery demonstration failed'));
      throw error;
    }
  }

  /**
   * Demo 7: Performance
   */
  async demoPerformance() {
    console.log(chalk.blue('⚡ Demonstrating Performance Features...'));
    
    const spinner = ora('Running performance tests').start();
    
    try {
      // Run performance regression test
      const regressionResult = await this.demoData.tester.runTestSuite('regression');
      
      spinner.succeed('Performance tests completed');
      
      console.log(chalk.blue('\n📊 Performance Results:'));
      console.log(`   Passed: ${regressionResult.passed ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`   Current Performance: ${regressionResult.currentPerformance?.toFixed(2)}ms`);
      console.log(`   Baseline Performance: ${regressionResult.baselinePerformance}ms`);
      
      if (regressionResult.performanceChange) {
        const changeColor = regressionResult.performanceChange > 0 ? chalk.red : chalk.green;
        console.log(`   Performance Change: ${changeColor(regressionResult.performanceChange.toFixed(1))}%`);
      }
      
      console.log(`   Regression Detected: ${regressionResult.performanceRegression ? chalk.red('Yes') : chalk.green('No')}`);
      
      // Show cache performance
      const validatorStats = this.demoData.validator.getValidationStats();
      
      console.log(chalk.blue('\n🚀 Cache Performance:'));
      console.log(`   Cache Hit Rate: ${validatorStats.successRate.toFixed(1)}%`);
      console.log(`   Average Validation Time: ${validatorStats.averageDuration.toFixed(2)}ms`);
      console.log(`   Total Validations: ${validatorStats.totalValidations}`);
      
    } catch (error) {
      spinner.fail('Performance demonstration failed');
      throw error;
    }
  }

  /**
   * Demo 8: Cleanup
   */
  async demoCleanup() {
    console.log(chalk.blue('🧹 Cleaning up demo resources...'));
    
    const spinner = ora('Shutting down systems').start();
    
    try {
      // Stop tester
      if (this.demoData.tester) {
        await this.demoData.tester.stop();
      }
      
      // Shutdown integration
      if (this.demoData.integration) {
        await this.demoData.integration.shutdown();
      }
      
      // Shutdown manager
      if (this.demoData.manager) {
        await this.demoData.manager.shutdown();
      }
      
      // Clear validator cache
      if (this.demoData.validator) {
        this.demoData.validator.clearCache();
      }
      
      spinner.succeed('Cleanup completed');
      
      console.log(chalk.green('✅ All demo resources cleaned up'));
      
    } catch (error) {
      spinner.fail('Cleanup failed');
      throw error;
    }
  }

  /**
   * Wait for user input
   */
  async waitForInput(message) {
    const { default: readline } = await import('readline');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(chalk.gray(message), () => {
        rl.close();
        resolve();
      });
    });
  }

  /**
   * Ask a question
   */
  async askQuestion(question) {
    const { default: readline } = await import('readline');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(chalk.yellow(question), (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new ApiKeyManagementDemo();
  
  demo.start().catch((error) => {
    console.error(chalk.red('\n❌ Demo failed:'), error.message);
    process.exit(1);
  });
}

export default ApiKeyManagementDemo;