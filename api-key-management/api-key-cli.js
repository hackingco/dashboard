#!/usr/bin/env node

/**
 * 🔑 Langfuse API Key Management CLI
 * 
 * Command-line interface for managing Langfuse API keys with
 * comprehensive validation, testing, and monitoring capabilities.
 * 
 * Usage: node api-key-cli.js [command] [options]
 * 
 * Author: API Key Specialist Agent
 * Date: 2025-07-14
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import LangfuseApiKeyManager from './LangfuseApiKeyManager.js';
import LangfuseKeyValidator from './LangfuseKeyValidator.js';
import AutomatedKeyTester from './AutomatedKeyTester.js';
import LangfuseIntegration from './LangfuseIntegration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize CLI
program
  .name('langfuse-api-keys')
  .description('Langfuse API Key Management System')
  .version('1.0.0');

// Global options
program
  .option('-h, --host <host>', 'Langfuse host URL', 'http://localhost:3000')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-q, --quiet', 'Suppress output');

/**
 * Utility functions
 */
function createSpinner(text) {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots'
  });
}

function logSuccess(message) {
  if (!program.opts().quiet) {
    console.log(chalk.green('✅ ' + message));
  }
}

function logError(message) {
  if (!program.opts().quiet) {
    console.error(chalk.red('❌ ' + message));
  }
}

function logInfo(message) {
  if (!program.opts().quiet) {
    console.log(chalk.blue('ℹ️  ' + message));
  }
}

function logWarning(message) {
  if (!program.opts().quiet) {
    console.warn(chalk.yellow('⚠️  ' + message));
  }
}

function createTable(headers) {
  return new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: {
      head: [],
      border: []
    }
  });
}

/**
 * Status Command
 */
program
  .command('status')
  .description('Show current API key status')
  .action(async () => {
    const spinner = createSpinner('Checking API key status...');
    
    try {
      spinner.start();
      
      const manager = new LangfuseApiKeyManager({
        langfuseHost: program.opts().host
      });
      
      const status = await manager.getStatus();
      
      spinner.succeed('Status retrieved successfully');
      
      // Display status table
      const table = createTable(['Component', 'Status', 'Details']);
      
      table.push(
        ['System', status.initialized ? chalk.green('Initialized') : chalk.red('Not Initialized'), ''],
        ['Keys Available', status.currentKeys.hasKeys ? chalk.green('Yes') : chalk.red('No'), ''],
        ['Keys Validated', status.currentKeys.validated ? chalk.green('Yes') : chalk.red('No'), ''],
        ['Key Health', getHealthColor(status.currentKeys.health), status.currentKeys.source || 'N/A'],
        ['Langfuse Service', status.langfuseHealth.healthy ? chalk.green('Healthy') : chalk.red('Unhealthy'), status.langfuseHealth.error || 'OK'],
        ['Monitoring', status.monitoring ? chalk.green('Active') : chalk.yellow('Inactive'), ''],
        ['Cache Size', status.cacheSize.toString(), 'validation cache entries'],
        ['History Size', status.historySize.toString(), 'key history entries']
      );
      
      console.log('\n' + table.toString());
      
      if (status.currentKeys.age) {
        const ageHours = Math.floor(status.currentKeys.age / (1000 * 60 * 60));
        logInfo(`Key age: ${ageHours} hours`);
      }
      
    } catch (error) {
      spinner.fail('Failed to retrieve status');
      logError(error.message);
      process.exit(1);
    }
  });

/**
 * Validate Command
 */
program
  .command('validate')
  .description('Validate API keys')
  .option('-k, --keys <keys>', 'Comma-separated public,secret key pair')
  .option('-q, --quick', 'Run quick validation only')
  .action(async (options) => {
    const spinner = createSpinner('Validating API keys...');
    
    try {
      let publicKey, secretKey;
      
      if (options.keys) {
        [publicKey, secretKey] = options.keys.split(',');
      } else {
        // Get keys from manager
        const manager = new LangfuseApiKeyManager({
          langfuseHost: program.opts().host
        });
        
        const keys = await manager.getCurrentKeys();
        
        if (!keys) {
          throw new Error('No keys available. Use --keys option or set up keys first.');
        }
        
        publicKey = keys.publicKey;
        secretKey = keys.secretKey;
      }
      
      spinner.start();
      
      const validator = new LangfuseKeyValidator({
        langfuseHost: program.opts().host
      });
      
      let result;
      
      if (options.quick) {
        result = await validator.quickValidate(publicKey, secretKey);
      } else {
        result = await validator.validateKeys(publicKey, secretKey);
      }
      
      spinner.succeed('Validation completed');
      
      // Display results
      console.log('\n' + chalk.bold('Validation Results:'));
      
      if (result.valid) {
        logSuccess(`Keys are valid (Score: ${(result.score * 100).toFixed(1)}%)`);
      } else {
        logError(`Keys are invalid (Score: ${(result.score * 100).toFixed(1)}%)`);
      }
      
      if (result.tests) {
        const testTable = createTable(['Test', 'Status', 'Score', 'Details']);
        
        for (const [testName, testResult] of Object.entries(result.tests)) {
          const status = testResult.passed ? chalk.green('PASS') : chalk.red('FAIL');
          const score = `${(testResult.score * 100).toFixed(1)}%`;
          const details = testResult.error || JSON.stringify(testResult.details || {});
          
          testTable.push([testName, status, score, details]);
        }
        
        console.log('\n' + testTable.toString());
      }
      
      if (result.recommendations) {
        console.log('\n' + chalk.bold('Recommendations:'));
        
        for (const rec of result.recommendations) {
          const icon = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : '✅';
          console.log(`${icon} ${rec.message}`);
          
          if (rec.action) {
            console.log(`   Action: ${rec.action}`);
          }
        }
      }
      
    } catch (error) {
      spinner.fail('Validation failed');
      logError(error.message);
      process.exit(1);
    }
  });

/**
 * Test Command
 */
program
  .command('test')
  .description('Run automated tests on API keys')
  .option('-k, --keys <keys>', 'Comma-separated public,secret key pair')
  .option('-s, --suite <suite>', 'Test suite to run (basic, stress, integration, regression, endurance)', 'basic')
  .option('-m, --monitor', 'Start continuous monitoring')
  .action(async (options) => {
    const spinner = createSpinner(`Running ${options.suite} test suite...`);
    
    try {
      let publicKey, secretKey;
      
      if (options.keys) {
        [publicKey, secretKey] = options.keys.split(',');
      } else {
        // Get keys from manager
        const manager = new LangfuseApiKeyManager({
          langfuseHost: program.opts().host
        });
        
        const keys = await manager.getCurrentKeys();
        
        if (!keys) {
          throw new Error('No keys available. Use --keys option or set up keys first.');
        }
        
        publicKey = keys.publicKey;
        secretKey = keys.secretKey;
      }
      
      const tester = new AutomatedKeyTester({
        langfuseHost: program.opts().host
      });
      
      tester.setKeys(publicKey, secretKey);
      
      if (options.monitor) {
        spinner.succeed('Starting continuous monitoring...');
        
        // Set up event handlers
        tester.on('test-complete', (result) => {
          const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
          logInfo(`${result.suite} test: ${status}`);
        });
        
        tester.on('test-failure', (result) => {
          logWarning(`Test failure: ${result.error}`);
        });
        
        tester.on('critical-failure', (failure) => {
          logError('Critical failure detected!');
        });
        
        tester.on('recovery-success', () => {
          logSuccess('Recovery successful');
        });
        
        await tester.start();
        
        logInfo('Monitoring started. Press Ctrl+C to stop.');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n' + chalk.yellow('Stopping monitoring...'));
          await tester.stop();
          process.exit(0);
        });
        
        // Keep process alive
        process.stdin.resume();
        
      } else {
        spinner.start();
        
        const result = await tester.runTestSuite(options.suite);
        
        spinner.succeed(`${options.suite} test suite completed`);
        
        // Display results
        console.log('\n' + chalk.bold('Test Results:'));
        
        if (result.passed) {
          logSuccess(`${options.suite} tests passed`);
        } else {
          logError(`${options.suite} tests failed`);
        }
        
        if (result.error) {
          logError(result.error);
        }
        
        // Suite-specific results
        if (options.suite === 'stress') {
          console.log(`\nStress Test Metrics:
  Concurrent Tests: ${result.concurrentTests}
  Total Traces: ${result.totalTraces}
  Failed Traces: ${result.failedTraces}
  Average Latency: ${result.averageLatency?.toFixed(2)}ms
  Throughput: ${result.throughput?.toFixed(2)} traces/sec`);
        }
        
        if (options.suite === 'endurance') {
          console.log(`\nEndurance Test Metrics:
  Duration: ${result.duration?.toFixed(2)}ms
  Total Traces: ${result.totalTraces}
  Stability: ${result.stability?.toFixed(1)}%
  Errors: ${result.errors?.length || 0}`);
        }
        
        if (program.opts().verbose && result.tests) {
          console.log('\n' + chalk.bold('Detailed Results:'));
          console.log(JSON.stringify(result.tests, null, 2));
        }
      }
      
    } catch (error) {
      spinner.fail('Test failed');
      logError(error.message);
      process.exit(1);
    }
  });

/**
 * Setup Command
 */
program
  .command('setup')
  .description('Set up Langfuse API key management')
  .option('-i, --interactive', 'Interactive setup')
  .option('-a, --auto', 'Automatic setup')
  .action(async (options) => {
    const spinner = createSpinner('Setting up API key management...');
    
    try {
      if (options.interactive) {
        // Interactive setup
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'langfuseHost',
            message: 'Langfuse host URL:',
            default: 'http://localhost:3000'
          },
          {
            type: 'confirm',
            name: 'enableMonitoring',
            message: 'Enable health monitoring?',
            default: true
          },
          {
            type: 'confirm',
            name: 'enableTesting',
            message: 'Enable automated testing?',
            default: true
          },
          {
            type: 'confirm',
            name: 'extractKeys',
            message: 'Extract keys from Langfuse UI?',
            default: true
          }
        ]);
        
        spinner.start();
        
        const integration = new LangfuseIntegration({
          langfuseHost: answers.langfuseHost,
          enableMonitoring: answers.enableMonitoring,
          enableTesting: answers.enableTesting
        });
        
        await integration.initialize();
        
        spinner.succeed('Interactive setup completed');
        
        const status = integration.getIntegrationStatus();
        
        console.log('\n' + chalk.bold('Setup Results:'));
        
        if (status.initialized) {
          logSuccess('Integration initialized successfully');
        } else {
          logError('Integration initialization failed');
        }
        
      } else {
        // Automatic setup
        spinner.start();
        
        const integration = new LangfuseIntegration({
          langfuseHost: program.opts().host
        });
        
        await integration.initialize();
        
        spinner.succeed('Automatic setup completed');
        
        const status = integration.getIntegrationStatus();
        
        console.log('\n' + chalk.bold('Setup Results:'));
        
        if (status.initialized) {
          logSuccess('Integration initialized successfully');
          
          if (status.currentKeys) {
            logInfo(`Keys source: ${status.currentKeys.source}`);
            logInfo(`Keys validated: ${status.currentKeys.validated}`);
            logInfo(`Health status: ${status.currentKeys.health}`);
          }
          
          if (status.monitoring.enabled) {
            logInfo('Health monitoring enabled');
          }
          
          if (status.monitoring.testing) {
            logInfo('Automated testing enabled');
          }
          
        } else {
          logError('Integration initialization failed');
        }
      }
      
    } catch (error) {
      spinner.fail('Setup failed');
      logError(error.message);
      process.exit(1);
    }
  });

/**
 * Keys Command
 */
program
  .command('keys')
  .description('Manage API keys')
  .option('-l, --list', 'List current keys')
  .option('-r, --refresh', 'Refresh keys from UI')
  .option('-g, --generate', 'Generate new keys')
  .option('-s, --set <keys>', 'Set keys manually (public,secret)')
  .action(async (options) => {
    const spinner = createSpinner('Managing API keys...');
    
    try {
      const manager = new LangfuseApiKeyManager({
        langfuseHost: program.opts().host
      });
      
      if (options.list) {
        spinner.start();
        
        const keys = await manager.getCurrentKeys();
        
        spinner.succeed('Keys retrieved');
        
        if (keys) {
          console.log('\n' + chalk.bold('Current Keys:'));
          
          const keysTable = createTable(['Property', 'Value']);
          
          keysTable.push(
            ['Public Key', keys.publicKey ? keys.publicKey.substring(0, 20) + '...' : 'Not set'],
            ['Secret Key', keys.secretKey ? keys.secretKey.substring(0, 20) + '...' : 'Not set'],
            ['Source', keys.source || 'Unknown'],
            ['Validated', keys.validated ? chalk.green('Yes') : chalk.red('No')],
            ['Health', getHealthColor(keys.health)],
            ['Age', keys.timestamp ? formatAge(Date.now() - keys.timestamp) : 'Unknown']
          );
          
          console.log('\n' + keysTable.toString());
        } else {
          logWarning('No keys currently set');
        }
      }
      
      if (options.refresh) {
        spinner.start();
        
        const refreshed = await manager.refreshKeys();
        
        if (refreshed) {
          spinner.succeed('Keys refreshed successfully');
          
          const keys = await manager.getCurrentKeys();
          
          if (keys) {
            logInfo(`New keys source: ${keys.source}`);
            logInfo(`Validation status: ${keys.validated}`);
          }
        } else {
          spinner.fail('Failed to refresh keys');
        }
      }
      
      if (options.generate) {
        spinner.start();
        
        const generated = await manager.generateNewKeys();
        
        spinner.succeed('New keys generated');
        
        console.log('\n' + chalk.bold('Generated Keys:'));
        console.log(`Public Key: ${generated.publicKey}`);
        console.log(`Secret Key: ${generated.secretKey}`);
        
        logWarning('These keys need to be configured in your Langfuse instance');
      }
      
      if (options.set) {
        const [publicKey, secretKey] = options.set.split(',');
        
        if (!publicKey || !secretKey) {
          throw new Error('Invalid key format. Use: public_key,secret_key');
        }
        
        spinner.start();
        
        // Validate the provided keys
        const validator = new LangfuseKeyValidator({
          langfuseHost: program.opts().host
        });
        
        const validation = await validator.validateKeys(publicKey, secretKey);
        
        if (validation.valid) {
          // Store the keys
          manager.currentKeys = {
            publicKey,
            secretKey,
            source: 'manual',
            timestamp: Date.now(),
            validated: true,
            health: 'healthy'
          };
          
          await manager.storeKeys(manager.currentKeys);
          
          spinner.succeed('Keys set successfully');
          
          logInfo(`Validation score: ${(validation.score * 100).toFixed(1)}%`);
        } else {
          spinner.fail('Invalid keys provided');
          logError(`Validation failed: ${validation.error}`);
        }
      }
      
    } catch (error) {
      spinner.fail('Key management failed');
      logError(error.message);
      process.exit(1);
    }
  });

/**
 * Export Command
 */
program
  .command('export')
  .description('Export configuration and data')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Export format (json, env)', 'json')
  .action(async (options) => {
    const spinner = createSpinner('Exporting data...');
    
    try {
      spinner.start();
      
      const integration = new LangfuseIntegration({
        langfuseHost: program.opts().host
      });
      
      let exportData;
      
      if (options.format === 'env') {
        const manager = new LangfuseApiKeyManager({
          langfuseHost: program.opts().host
        });
        
        exportData = await manager.createEnvironmentConfig();
      } else {
        exportData = integration.exportIntegrationData();
      }
      
      if (options.output) {
        const outputPath = path.resolve(options.output);
        
        if (options.format === 'env') {
          fs.writeFileSync(outputPath, exportData);
        } else {
          fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
        }
        
        spinner.succeed(`Data exported to ${outputPath}`);
      } else {
        spinner.succeed('Data exported to console');
        
        if (options.format === 'env') {
          console.log('\n' + exportData);
        } else {
          console.log('\n' + JSON.stringify(exportData, null, 2));
        }
      }
      
    } catch (error) {
      spinner.fail('Export failed');
      logError(error.message);
      process.exit(1);
    }
  });

/**
 * Utility functions
 */
function getHealthColor(health) {
  switch (health) {
    case 'healthy':
      return chalk.green('Healthy');
    case 'unhealthy':
      return chalk.red('Unhealthy');
    case 'pending':
      return chalk.yellow('Pending');
    default:
      return chalk.gray('Unknown');
  }
}

function formatAge(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Help command
program
  .command('help')
  .description('Show detailed help')
  .action(() => {
    console.log(`
${chalk.bold.cyan('Langfuse API Key Management CLI')}

${chalk.bold('Commands:')}
  ${chalk.green('status')}              Show current API key status
  ${chalk.green('validate')}            Validate API keys
  ${chalk.green('test')}                Run automated tests
  ${chalk.green('setup')}               Set up API key management
  ${chalk.green('keys')}                Manage API keys
  ${chalk.green('export')}              Export configuration and data
  ${chalk.green('help')}                Show this help message

${chalk.bold('Examples:')}
  ${chalk.gray('# Check status')}
  ${chalk.white('langfuse-api-keys status')}

  ${chalk.gray('# Validate keys')}
  ${chalk.white('langfuse-api-keys validate --quick')}

  ${chalk.gray('# Run stress test')}
  ${chalk.white('langfuse-api-keys test --suite stress')}

  ${chalk.gray('# Interactive setup')}
  ${chalk.white('langfuse-api-keys setup --interactive')}

  ${chalk.gray('# Refresh keys')}
  ${chalk.white('langfuse-api-keys keys --refresh')}

  ${chalk.gray('# Export environment config')}
  ${chalk.white('langfuse-api-keys export --format env --output .env.langfuse')}

${chalk.bold('Options:')}
  ${chalk.green('-h, --host <host>')}    Langfuse host URL (default: http://localhost:3000)
  ${chalk.green('-v, --verbose')}        Enable verbose output
  ${chalk.green('-q, --quiet')}          Suppress output

${chalk.bold('For more information:')}
  Run any command with --help for detailed options.
`);
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}