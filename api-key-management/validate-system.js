#!/usr/bin/env node

/**
 * 🔍 System Validation Script
 * 
 * Comprehensive validation of the API key management system
 * to ensure all components work correctly together.
 * 
 * Author: API Key Specialist Agent
 * Date: 2025-07-14
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SystemValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  /**
   * Run all validation tests
   */
  async validate() {
    console.log(chalk.bold.cyan('\n🔍 API Key Management System Validation'));
    console.log(chalk.gray('=' .repeat(60)));

    const tests = [
      { name: 'File Structure', fn: this.validateFileStructure },
      { name: 'Dependencies', fn: this.validateDependencies },
      { name: 'Module Imports', fn: this.validateModuleImports },
      { name: 'Configuration', fn: this.validateConfiguration },
      { name: 'Key Manager', fn: this.validateKeyManager },
      { name: 'Validator', fn: this.validateValidator },
      { name: 'Tester', fn: this.validateTester },
      { name: 'Integration', fn: this.validateIntegration },
      { name: 'CLI Interface', fn: this.validateCLI },
      { name: 'Documentation', fn: this.validateDocumentation }
    ];

    for (const test of tests) {
      await this.runTest(test);
    }

    this.showResults();
  }

  /**
   * Run a single test
   */
  async runTest(test) {
    console.log(chalk.yellow(`\n🧪 Testing: ${test.name}`));

    try {
      const result = await test.fn.call(this);
      
      if (result.passed) {
        this.results.passed++;
        console.log(chalk.green(`✅ ${test.name}: PASSED`));
      } else {
        this.results.failed++;
        console.log(chalk.red(`❌ ${test.name}: FAILED`));
        
        if (result.error) {
          console.log(chalk.red(`   Error: ${result.error}`));
        }
      }
      
      if (result.warnings) {
        this.results.warnings += result.warnings.length;
        result.warnings.forEach(warning => {
          console.log(chalk.yellow(`   ⚠️ ${warning}`));
        });
      }
      
      this.results.tests.push({
        name: test.name,
        passed: result.passed,
        error: result.error,
        warnings: result.warnings || []
      });
      
    } catch (error) {
      this.results.failed++;
      console.log(chalk.red(`❌ ${test.name}: ERROR`));
      console.log(chalk.red(`   ${error.message}`));
      
      this.results.tests.push({
        name: test.name,
        passed: false,
        error: error.message,
        warnings: []
      });
    }
  }

  /**
   * Validate file structure
   */
  async validateFileStructure() {
    const requiredFiles = [
      'LangfuseApiKeyManager.js',
      'LangfuseKeyValidator.js',
      'AutomatedKeyTester.js',
      'LangfuseIntegration.js',
      'api-key-cli.js',
      'package.json',
      'README.md',
      'demo.js'
    ];

    const warnings = [];
    let allFilesExist = true;

    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, file);
      
      if (!fs.existsSync(filePath)) {
        allFilesExist = false;
        warnings.push(`Missing file: ${file}`);
      } else {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          warnings.push(`Empty file: ${file}`);
        }
      }
    }

    return {
      passed: allFilesExist,
      warnings
    };
  }

  /**
   * Validate dependencies
   */
  async validateDependencies() {
    const packagePath = path.join(__dirname, 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      return {
        passed: false,
        error: 'package.json not found'
      };
    }

    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredDeps = [
      'langfuse',
      'commander',
      'chalk',
      'ora',
      'inquirer',
      'cli-table3',
      'node-fetch',
      'uuid'
    ];

    const warnings = [];
    let allDepsPresent = true;

    for (const dep of requiredDeps) {
      if (!packageData.dependencies || !packageData.dependencies[dep]) {
        allDepsPresent = false;
        warnings.push(`Missing dependency: ${dep}`);
      }
    }

    return {
      passed: allDepsPresent,
      warnings
    };
  }

  /**
   * Validate module imports
   */
  async validateModuleImports() {
    const modules = [
      'LangfuseApiKeyManager.js',
      'LangfuseKeyValidator.js',
      'AutomatedKeyTester.js',
      'LangfuseIntegration.js'
    ];

    const warnings = [];
    let allModulesValid = true;

    for (const module of modules) {
      try {
        const modulePath = path.join(__dirname, module);
        const moduleContent = fs.readFileSync(modulePath, 'utf8');
        
        // Check for ES6 imports
        if (!moduleContent.includes('import ') && !moduleContent.includes('export ')) {
          warnings.push(`${module} may not be using ES6 modules`);
        }
        
        // Check for proper exports
        if (!moduleContent.includes('export default') && !moduleContent.includes('export class')) {
          warnings.push(`${module} may not have proper exports`);
        }
        
      } catch (error) {
        allModulesValid = false;
        warnings.push(`Error reading ${module}: ${error.message}`);
      }
    }

    return {
      passed: allModulesValid,
      warnings
    };
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    const warnings = [];
    
    // Check for environment variables
    const envVars = [
      'LANGFUSE_HOST',
      'LANGFUSE_PUBLIC_KEY',
      'LANGFUSE_SECRET_KEY'
    ];
    
    for (const envVar of envVars) {
      if (!process.env[envVar]) {
        warnings.push(`Environment variable ${envVar} not set`);
      }
    }
    
    // Check for .env files
    const envFiles = ['.env', '.env.local', '.env.langfuse'];
    
    for (const envFile of envFiles) {
      const envPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        try {
          const envContent = fs.readFileSync(envPath, 'utf8');
          if (envContent.includes('LANGFUSE_HOST')) {
            // Good, has Langfuse config
          } else {
            warnings.push(`${envFile} exists but may not have Langfuse configuration`);
          }
        } catch (error) {
          warnings.push(`Error reading ${envFile}: ${error.message}`);
        }
      }
    }

    return {
      passed: true,
      warnings
    };
  }

  /**
   * Validate Key Manager
   */
  async validateKeyManager() {
    try {
      const { default: LangfuseApiKeyManager } = await import('./LangfuseApiKeyManager.js');
      
      const manager = new LangfuseApiKeyManager({
        langfuseHost: 'http://localhost:3000',
        enableHealthMonitoring: false
      });
      
      // Test basic methods
      const methods = [
        'initialize',
        'getCurrentKeys',
        'refreshKeys',
        'getStatus',
        'createEnvironmentConfig',
        'shutdown'
      ];
      
      const warnings = [];
      
      for (const method of methods) {
        if (typeof manager[method] !== 'function') {
          warnings.push(`Missing method: ${method}`);
        }
      }
      
      return {
        passed: warnings.length === 0,
        warnings
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Validate Validator
   */
  async validateValidator() {
    try {
      const { default: LangfuseKeyValidator } = await import('./LangfuseKeyValidator.js');
      
      const validator = new LangfuseKeyValidator({
        langfuseHost: 'http://localhost:3000'
      });
      
      const methods = [
        'validateKeys',
        'quickValidate',
        'batchValidate',
        'getValidationStats',
        'clearCache'
      ];
      
      const warnings = [];
      
      for (const method of methods) {
        if (typeof validator[method] !== 'function') {
          warnings.push(`Missing method: ${method}`);
        }
      }
      
      return {
        passed: warnings.length === 0,
        warnings
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Validate Tester
   */
  async validateTester() {
    try {
      const { default: AutomatedKeyTester } = await import('./AutomatedKeyTester.js');
      
      const tester = new AutomatedKeyTester({
        langfuseHost: 'http://localhost:3000'
      });
      
      const methods = [
        'setKeys',
        'start',
        'stop',
        'runTestSuite',
        'getTestStatistics',
        'exportTestResults',
        'clearHistory'
      ];
      
      const warnings = [];
      
      for (const method of methods) {
        if (typeof tester[method] !== 'function') {
          warnings.push(`Missing method: ${method}`);
        }
      }
      
      // Check test suites
      const testSuites = ['basic', 'stress', 'integration', 'regression', 'endurance'];
      
      for (const suite of testSuites) {
        if (!tester.testSuites || typeof tester.testSuites[suite] !== 'function') {
          warnings.push(`Missing test suite: ${suite}`);
        }
      }
      
      return {
        passed: warnings.length === 0,
        warnings
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Validate Integration
   */
  async validateIntegration() {
    try {
      const { default: LangfuseIntegration } = await import('./LangfuseIntegration.js');
      
      const integration = new LangfuseIntegration({
        langfuseHost: 'http://localhost:3000',
        autoStart: false
      });
      
      const methods = [
        'initialize',
        'getLangfuseClient',
        'createTrace',
        'flush',
        'shutdown',
        'getIntegrationStatus',
        'validateIntegration',
        'exportIntegrationData'
      ];
      
      const warnings = [];
      
      for (const method of methods) {
        if (typeof integration[method] !== 'function') {
          warnings.push(`Missing method: ${method}`);
        }
      }
      
      return {
        passed: warnings.length === 0,
        warnings
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Validate CLI Interface
   */
  async validateCLI() {
    const cliPath = path.join(__dirname, 'api-key-cli.js');
    
    if (!fs.existsSync(cliPath)) {
      return {
        passed: false,
        error: 'CLI file not found'
      };
    }
    
    const cliContent = fs.readFileSync(cliPath, 'utf8');
    
    const requiredCommands = [
      'status',
      'validate',
      'test',
      'setup',
      'keys',
      'export',
      'help'
    ];
    
    const warnings = [];
    
    for (const command of requiredCommands) {
      if (!cliContent.includes(`.command('${command}')`)) {
        warnings.push(`Missing CLI command: ${command}`);
      }
    }
    
    // Check for shebang
    if (!cliContent.startsWith('#!/usr/bin/env node')) {
      warnings.push('CLI file missing shebang');
    }
    
    return {
      passed: warnings.length === 0,
      warnings
    };
  }

  /**
   * Validate Documentation
   */
  async validateDocumentation() {
    const readmePath = path.join(__dirname, 'README.md');
    
    if (!fs.existsSync(readmePath)) {
      return {
        passed: false,
        error: 'README.md not found'
      };
    }
    
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    const requiredSections = [
      'Features',
      'Installation',
      'Quick Start',
      'CLI Usage',
      'API Usage',
      'Configuration',
      'Testing',
      'Monitoring',
      'Integration',
      'Security',
      'Troubleshooting'
    ];
    
    const warnings = [];
    
    for (const section of requiredSections) {
      if (!readmeContent.includes(section)) {
        warnings.push(`Missing documentation section: ${section}`);
      }
    }
    
    // Check for examples
    if (!readmeContent.includes('```bash') && !readmeContent.includes('```javascript')) {
      warnings.push('README missing code examples');
    }
    
    return {
      passed: warnings.length === 0,
      warnings
    };
  }

  /**
   * Show validation results
   */
  showResults() {
    console.log(chalk.bold.cyan('\n📊 Validation Results'));
    console.log(chalk.gray('=' .repeat(40)));
    
    const total = this.results.passed + this.results.failed;
    const successRate = (this.results.passed / total) * 100;
    
    console.log(chalk.green(`✅ Passed: ${this.results.passed}/${total}`));
    console.log(chalk.red(`❌ Failed: ${this.results.failed}/${total}`));
    console.log(chalk.yellow(`⚠️ Warnings: ${this.results.warnings}`));
    console.log(chalk.blue(`📈 Success Rate: ${successRate.toFixed(1)}%`));
    
    if (this.results.failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      
      for (const test of this.results.tests) {
        if (!test.passed) {
          console.log(`   - ${test.name}: ${test.error}`);
        }
      }
    }
    
    if (this.results.warnings > 0) {
      console.log(chalk.yellow('\n⚠️ Warnings:'));
      
      for (const test of this.results.tests) {
        if (test.warnings && test.warnings.length > 0) {
          console.log(`   ${test.name}:`);
          for (const warning of test.warnings) {
            console.log(`     - ${warning}`);
          }
        }
      }
    }
    
    console.log(chalk.gray('\n' + '=' .repeat(40)));
    
    if (this.results.failed === 0) {
      console.log(chalk.bold.green('🎉 All tests passed! System is ready for use.'));
    } else {
      console.log(chalk.bold.red('🚨 Some tests failed. Please review and fix issues.'));
    }
    
    // Export results
    const resultsPath = path.join(__dirname, 'validation-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    
    console.log(chalk.gray(`\n📄 Detailed results saved to: ${resultsPath}`));
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new SystemValidator();
  
  validator.validate().catch((error) => {
    console.error(chalk.red('\n❌ Validation failed:'), error.message);
    process.exit(1);
  });
}

export default SystemValidator;