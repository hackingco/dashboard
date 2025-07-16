#!/usr/bin/env node

/**
 * Langfuse Integration Validation Script for Claude-Flow
 * Validates that the Langfuse SDK integration is working correctly
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔍 Validating Claude-Flow Langfuse Integration...\n');

// Validation checks
const validations = [
  {
    name: 'Package Dependencies',
    check: () => {
      const packagePath = join(__dirname, 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      
      if (!packageJson.dependencies.langfuse) {
        throw new Error('langfuse dependency not found in package.json');
      }
      
      return {
        langfuseVersion: packageJson.dependencies.langfuse,
        totalDependencies: Object.keys(packageJson.dependencies).length
      };
    }
  },
  
  {
    name: 'Tracing Module Structure',
    check: async () => {
      const modules = [
        'src/tracing/index.js',
        'src/tracing/langfuse-client.js',
        'src/tracing/instrumentation.js',
        'src/tracing/config.js',
        'src/tracing/auto-init.js',
        'src/tracing/integration-examples.js',
        'src/tracing/test-suite.js'
      ];
      
      const results = {};
      
      for (const module of modules) {
        try {
          const content = readFileSync(join(__dirname, module), 'utf8');
          results[module] = {
            exists: true,
            size: content.length,
            hasExports: content.includes('export')
          };
        } catch (error) {
          results[module] = {
            exists: false,
            error: error.message
          };
        }
      }
      
      return results;
    }
  },
  
  {
    name: 'Configuration Files',
    check: () => {
      const configFiles = [
        '.env.tracing.example'
      ];
      
      const results = {};
      
      for (const file of configFiles) {
        try {
          const content = readFileSync(join(__dirname, file), 'utf8');
          results[file] = {
            exists: true,
            size: content.length,
            hasLangfuseConfig: content.includes('LANGFUSE_')
          };
        } catch (error) {
          results[file] = {
            exists: false,
            error: error.message
          };
        }
      }
      
      return results;
    }
  },
  
  {
    name: 'Core Integration',
    check: async () => {
      try {
        // Test import of main tracing module
        const { TracingManager, tracing } = await import('./src/tracing/index.js');
        
        if (!TracingManager) {
          throw new Error('TracingManager not exported');
        }
        
        if (!tracing) {
          throw new Error('tracing singleton not exported');
        }
        
        // Test configuration
        const config = tracing.getConfig();
        
        return {
          TracingManager: 'imported',
          tracing: 'imported',
          configKeys: Object.keys(config).length,
          enabled: config.enabled
        };
      } catch (error) {
        throw new Error(`Core integration test failed: ${error.message}`);
      }
    }
  },
  
  {
    name: 'Client Functionality',
    check: async () => {
      try {
        const { LangfuseClient } = await import('./src/tracing/langfuse-client.js');
        
        const client = new LangfuseClient({
          secretKey: 'test-secret',
          publicKey: 'test-public',
          baseUrl: 'https://test.langfuse.com',
          enabled: true
        });
        
        const status = client.getStatus();
        
        return {
          clientCreated: true,
          status: status.enabled,
          methods: Object.getOwnPropertyNames(Object.getPrototypeOf(client)).length
        };
      } catch (error) {
        throw new Error(`Client functionality test failed: ${error.message}`);
      }
    }
  },
  
  {
    name: 'Instrumentation System',
    check: async () => {
      try {
        const { Instrumentation } = await import('./src/tracing/instrumentation.js');
        
        const instrumentation = new Instrumentation({
          secretKey: 'test-secret',
          publicKey: 'test-public',
          enabled: true
        });
        
        const status = instrumentation.getStatus();
        
        return {
          instrumentationCreated: true,
          enabled: status.enabled,
          hooksCount: status.hooks.length
        };
      } catch (error) {
        throw new Error(`Instrumentation system test failed: ${error.message}`);
      }
    }
  },
  
  {
    name: 'Auto-initialization',
    check: async () => {
      try {
        const { autoInitTracing } = await import('./src/tracing/auto-init.js');
        
        if (typeof autoInitTracing !== 'function') {
          throw new Error('autoInitTracing is not a function');
        }
        
        return {
          autoInitTracing: 'available',
          type: typeof autoInitTracing
        };
      } catch (error) {
        throw new Error(`Auto-initialization test failed: ${error.message}`);
      }
    }
  },
  
  {
    name: 'Integration Examples',
    check: async () => {
      try {
        const examples = await import('./src/tracing/integration-examples.js');
        
        const expectedFunctions = [
          'basicTracingExample',
          'manualTracingExample',
          'mcpToolTracingExample',
          'swarmOperationTracingExample',
          'neuralTrainingTracingExample',
          'fullIntegrationDemo'
        ];
        
        const availableFunctions = [];
        
        for (const fn of expectedFunctions) {
          if (typeof examples[fn] === 'function') {
            availableFunctions.push(fn);
          }
        }
        
        return {
          expectedFunctions: expectedFunctions.length,
          availableFunctions: availableFunctions.length,
          functions: availableFunctions
        };
      } catch (error) {
        throw new Error(`Integration examples test failed: ${error.message}`);
      }
    }
  },
  
  {
    name: 'Test Suite',
    check: async () => {
      try {
        const { default: TracingTestSuite } = await import('./src/tracing/test-suite.js');
        
        if (!TracingTestSuite) {
          throw new Error('TracingTestSuite not exported');
        }
        
        const testSuite = new TracingTestSuite();
        
        return {
          testSuiteCreated: true,
          methods: Object.getOwnPropertyNames(Object.getPrototypeOf(testSuite)).length
        };
      } catch (error) {
        throw new Error(`Test suite validation failed: ${error.message}`);
      }
    }
  }
];

// Run validations
async function runValidations() {
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const validation of validations) {
    try {
      console.log(`⏳ ${validation.name}...`);
      const result = await validation.check();
      console.log(`✅ ${validation.name} - PASSED`);
      
      results.push({
        name: validation.name,
        status: 'PASSED',
        result
      });
      
      passed++;
    } catch (error) {
      console.log(`❌ ${validation.name} - FAILED`);
      console.log(`   Error: ${error.message}`);
      
      results.push({
        name: validation.name,
        status: 'FAILED',
        error: error.message
      });
      
      failed++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Validations: ${validations.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / validations.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED VALIDATIONS:');
    results
      .filter(r => r.status === 'FAILED')
      .forEach(result => {
        console.log(`  • ${result.name}: ${result.error}`);
      });
  }
  
  console.log('\n🎯 INTEGRATION STATUS:');
  
  if (failed === 0) {
    console.log('✅ Claude-Flow Langfuse integration is READY!');
    console.log('\n🚀 Next Steps:');
    console.log('1. Configure your Langfuse credentials in .env.tracing');
    console.log('2. Run the test suite: node src/tracing/test-suite.js');
    console.log('3. Start claude-flow with tracing enabled');
    console.log('4. Check your Langfuse dashboard for traces');
  } else {
    console.log('❌ Claude-Flow Langfuse integration has ISSUES!');
    console.log('\n🔧 Required Actions:');
    console.log('1. Fix the failed validations listed above');
    console.log('2. Re-run this validation script');
    console.log('3. Only proceed when all validations pass');
  }
  
  return { passed, failed, results };
}

// Export for programmatic use
export { runValidations };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidations()
    .then(({ failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Validation script failed:', error);
      process.exit(1);
    });
}