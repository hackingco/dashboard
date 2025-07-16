#!/usr/bin/env node

/**
 * 🔗 Langfuse Integration System
 * 
 * Seamless integration with existing Langfuse workflow, providing
 * automatic key management, validation, and failover capabilities.
 * 
 * Features:
 * - Automatic key detection and setup
 * - Seamless integration with existing code
 * - Automatic failover mechanisms
 * - Environment synchronization
 * - Real-time health monitoring
 * - Backward compatibility
 * 
 * Author: API Key Specialist Agent
 * Date: 2025-07-14
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LangfuseApiKeyManager from './LangfuseApiKeyManager.js';
import LangfuseKeyValidator from './LangfuseKeyValidator.js';
import AutomatedKeyTester from './AutomatedKeyTester.js';
import { Langfuse } from 'langfuse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class LangfuseIntegration {
  constructor(options = {}) {
    this.config = {
      projectRoot: options.projectRoot || process.cwd(),
      langfuseHost: options.langfuseHost || 'http://localhost:3000',
      autoStart: options.autoStart !== false,
      enableValidation: options.enableValidation !== false,
      enableTesting: options.enableTesting !== false,
      enableMonitoring: options.enableMonitoring !== false,
      backupExistingConfig: options.backupExistingConfig !== false,
      ...options
    };

    this.keyManager = new LangfuseApiKeyManager({
      langfuseHost: this.config.langfuseHost,
      enableHealthMonitoring: this.config.enableMonitoring
    });

    this.validator = new LangfuseKeyValidator({
      langfuseHost: this.config.langfuseHost
    });

    this.tester = new AutomatedKeyTester({
      langfuseHost: this.config.langfuseHost
    });

    this.langfuseClient = null;
    this.isInitialized = false;
    this.currentKeys = null;
    this.integrationStatus = 'pending';

    if (this.config.autoStart) {
      this.initialize();
    }
  }

  /**
   * Initialize the integration system
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Langfuse Integration System...');
      
      // Step 1: Initialize key manager
      await this.keyManager.initialize();
      
      // Step 2: Get current keys
      this.currentKeys = await this.keyManager.getCurrentKeys();
      
      if (!this.currentKeys || !this.currentKeys.validated) {
        throw new Error('No valid API keys available');
      }
      
      // Step 3: Initialize Langfuse client
      await this.initializeLangfuseClient();
      
      // Step 4: Update environment files
      await this.updateEnvironmentFiles();
      
      // Step 5: Start monitoring if enabled
      if (this.config.enableMonitoring) {
        await this.startMonitoring();
      }
      
      // Step 6: Validate integration
      await this.validateIntegration();
      
      this.isInitialized = true;
      this.integrationStatus = 'active';
      
      console.log('✅ Langfuse Integration System initialized successfully');
      
      return this.getIntegrationStatus();
    } catch (error) {
      console.error('❌ Failed to initialize Langfuse Integration System:', error);
      this.integrationStatus = 'failed';
      throw error;
    }
  }

  /**
   * Initialize Langfuse client
   */
  async initializeLangfuseClient() {
    try {
      if (!this.currentKeys) {
        throw new Error('No keys available for client initialization');
      }
      
      this.langfuseClient = new Langfuse({
        publicKey: this.currentKeys.publicKey,
        secretKey: this.currentKeys.secretKey,
        baseUrl: this.config.langfuseHost,
        flushAt: 50,
        flushInterval: 3000,
        requestTimeout: 30000,
        maxRetries: 3
      });
      
      console.log('🔧 Langfuse client initialized with managed keys');
      
      // Test client with a simple trace
      const testTrace = this.langfuseClient.trace({
        id: `integration-test-${Date.now()}`,
        name: 'Integration Test',
        sessionId: 'integration-validation',
        input: { test: 'integration' },
        metadata: {
          source: 'LangfuseIntegration',
          timestamp: new Date().toISOString()
        }
      });
      
      await this.langfuseClient.flushAsync();
      
      console.log('✅ Langfuse client validated successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Langfuse client:', error);
      throw error;
    }
  }

  /**
   * Update environment files
   */
  async updateEnvironmentFiles() {
    try {
      console.log('📝 Updating environment files...');
      
      const envFiles = [
        '.env',
        '.env.local',
        '.env.development',
        '.env.production',
        '.env.langfuse'
      ];
      
      const envConfig = await this.keyManager.createEnvironmentConfig();
      
      for (const envFile of envFiles) {
        const envPath = path.join(this.config.projectRoot, envFile);
        
        if (fs.existsSync(envPath)) {
          // Backup existing file
          if (this.config.backupExistingConfig) {
            const backupPath = `${envPath}.backup.${Date.now()}`;
            fs.copyFileSync(envPath, backupPath);
            console.log(`📦 Backed up ${envFile} to ${path.basename(backupPath)}`);
          }
          
          // Update existing file
          await this.updateExistingEnvFile(envPath, envConfig);
        } else if (envFile === '.env.langfuse') {
          // Create new .env.langfuse file
          fs.writeFileSync(envPath, envConfig);
          console.log(`✅ Created ${envFile}`);
        }
      }
      
      console.log('✅ Environment files updated successfully');
    } catch (error) {
      console.error('❌ Failed to update environment files:', error);
      throw error;
    }
  }

  /**
   * Update existing environment file
   */
  async updateExistingEnvFile(envPath, newConfig) {
    try {
      let existingContent = fs.readFileSync(envPath, 'utf8');
      
      // Extract new key-value pairs
      const newVars = {};
      for (const line of newConfig.split('\n')) {
        if (line.includes('=') && !line.startsWith('#')) {
          const [key, value] = line.split('=', 2);
          newVars[key] = value;
        }
      }
      
      // Update or add each variable
      for (const [key, value] of Object.entries(newVars)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        
        if (regex.test(existingContent)) {
          // Update existing variable
          existingContent = existingContent.replace(regex, `${key}=${value}`);
        } else {
          // Add new variable
          existingContent += `\n${key}=${value}`;
        }
      }
      
      fs.writeFileSync(envPath, existingContent);
      console.log(`✅ Updated ${path.basename(envPath)}`);
    } catch (error) {
      console.error(`❌ Failed to update ${envPath}:`, error);
    }
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    try {
      if (!this.config.enableMonitoring) {
        return;
      }
      
      console.log('📊 Starting monitoring systems...');
      
      // Start automated testing
      if (this.config.enableTesting) {
        this.tester.setKeys(this.currentKeys.publicKey, this.currentKeys.secretKey);
        await this.tester.start();
      }
      
      // Set up event handlers
      this.setupEventHandlers();
      
      console.log('✅ Monitoring systems started');
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Key manager events
    this.keyManager.on('keys-updated', (keys) => {
      console.log('🔄 Keys updated:', keys.source);
      this.currentKeys = keys;
      this.refreshLangfuseClient();
    });

    // Tester events
    this.tester.on('test-failure', (result) => {
      console.warn('⚠️ Test failure detected:', result.error);
    });

    this.tester.on('critical-failure', (failure) => {
      console.error('🚨 Critical failure:', failure);
      this.handleCriticalFailure(failure);
    });

    this.tester.on('recovery-success', (result) => {
      console.log('✅ Recovery successful');
      this.integrationStatus = 'active';
    });

    this.tester.on('recovery-failed', (failure) => {
      console.error('❌ Recovery failed');
      this.integrationStatus = 'failed';
    });
  }

  /**
   * Handle critical failure
   */
  async handleCriticalFailure(failure) {
    try {
      console.log('🔄 Handling critical failure...');
      
      // Try to refresh keys
      const refreshed = await this.keyManager.refreshKeys();
      
      if (refreshed) {
        this.currentKeys = await this.keyManager.getCurrentKeys();
        await this.refreshLangfuseClient();
        await this.updateEnvironmentFiles();
        
        // Restart testing
        this.tester.setKeys(this.currentKeys.publicKey, this.currentKeys.secretKey);
        await this.tester.start();
        
        console.log('✅ Critical failure handled successfully');
      } else {
        console.error('❌ Failed to handle critical failure');
        this.integrationStatus = 'failed';
      }
    } catch (error) {
      console.error('❌ Error handling critical failure:', error);
      this.integrationStatus = 'failed';
    }
  }

  /**
   * Refresh Langfuse client
   */
  async refreshLangfuseClient() {
    try {
      if (this.langfuseClient) {
        await this.langfuseClient.shutdownAsync();
      }
      
      await this.initializeLangfuseClient();
      
      console.log('🔄 Langfuse client refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh Langfuse client:', error);
    }
  }

  /**
   * Validate integration
   */
  async validateIntegration() {
    try {
      console.log('🔍 Validating integration...');
      
      // Test 1: Key validation
      const keyValidation = await this.validator.validateKeys(
        this.currentKeys.publicKey,
        this.currentKeys.secretKey
      );
      
      if (!keyValidation.valid) {
        throw new Error('Key validation failed');
      }
      
      // Test 2: Client functionality
      const clientTest = await this.testClientFunctionality();
      
      if (!clientTest.success) {
        throw new Error('Client functionality test failed');
      }
      
      // Test 3: Environment sync
      const envTest = await this.testEnvironmentSync();
      
      if (!envTest.success) {
        throw new Error('Environment sync test failed');
      }
      
      console.log('✅ Integration validation successful');
      
      return {
        keyValidation,
        clientTest,
        envTest,
        overall: 'success'
      };
    } catch (error) {
      console.error('❌ Integration validation failed:', error);
      return {
        error: error.message,
        overall: 'failed'
      };
    }
  }

  /**
   * Test client functionality
   */
  async testClientFunctionality() {
    try {
      if (!this.langfuseClient) {
        throw new Error('Langfuse client not initialized');
      }
      
      const testTrace = this.langfuseClient.trace({
        id: `client-test-${Date.now()}`,
        name: 'Client Functionality Test',
        sessionId: 'validation-test',
        input: { test: 'client-functionality' },
        metadata: {
          integration: true,
          test: 'client-functionality'
        }
      });
      
      await this.langfuseClient.flushAsync();
      
      return {
        success: true,
        traceId: testTrace.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test environment sync
   */
  async testEnvironmentSync() {
    try {
      // Check if environment variables are set correctly
      const envVars = [
        'LANGFUSE_PUBLIC_KEY',
        'LANGFUSE_SECRET_KEY',
        'LANGFUSE_HOST'
      ];
      
      const missingVars = [];
      
      for (const envVar of envVars) {
        if (!process.env[envVar]) {
          missingVars.push(envVar);
        }
      }
      
      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
      }
      
      // Verify values match current keys
      const envMatches = 
        process.env.LANGFUSE_PUBLIC_KEY === this.currentKeys.publicKey &&
        process.env.LANGFUSE_SECRET_KEY === this.currentKeys.secretKey &&
        process.env.LANGFUSE_HOST === this.config.langfuseHost;
      
      if (!envMatches) {
        throw new Error('Environment variables do not match current keys');
      }
      
      return {
        success: true,
        envVarsSet: envVars.length,
        envVarsMatched: envMatches
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get integration status
   */
  getIntegrationStatus() {
    return {
      initialized: this.isInitialized,
      status: this.integrationStatus,
      currentKeys: this.currentKeys ? {
        source: this.currentKeys.source,
        validated: this.currentKeys.validated,
        health: this.currentKeys.health,
        timestamp: this.currentKeys.timestamp
      } : null,
      client: {
        initialized: !!this.langfuseClient,
        host: this.config.langfuseHost
      },
      monitoring: {
        enabled: this.config.enableMonitoring,
        testing: this.config.enableTesting,
        validation: this.config.enableValidation
      },
      statistics: this.config.enableTesting ? this.tester.getTestStatistics() : null
    };
  }

  /**
   * Get Langfuse client
   */
  getLangfuseClient() {
    if (!this.langfuseClient) {
      throw new Error('Langfuse client not initialized. Call initialize() first.');
    }
    
    return this.langfuseClient;
  }

  /**
   * Create a new trace using managed client
   */
  async createTrace(name, input = {}, metadata = {}) {
    const client = this.getLangfuseClient();
    
    return client.trace({
      id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      input,
      metadata: {
        ...metadata,
        managedByIntegration: true,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Flush all traces
   */
  async flush() {
    if (this.langfuseClient) {
      await this.langfuseClient.flushAsync();
    }
  }

  /**
   * Shutdown integration
   */
  async shutdown() {
    try {
      console.log('🔄 Shutting down Langfuse Integration System...');
      
      // Stop monitoring
      if (this.tester) {
        await this.tester.stop();
      }
      
      // Shutdown key manager
      if (this.keyManager) {
        await this.keyManager.shutdown();
      }
      
      // Shutdown Langfuse client
      if (this.langfuseClient) {
        await this.langfuseClient.shutdownAsync();
      }
      
      this.isInitialized = false;
      this.integrationStatus = 'shutdown';
      
      console.log('✅ Langfuse Integration System shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  /**
   * Export integration data
   */
  exportIntegrationData() {
    return {
      status: this.getIntegrationStatus(),
      config: this.config,
      keyManager: this.keyManager ? {
        status: this.keyManager.getStatus()
      } : null,
      validator: this.validator ? {
        stats: this.validator.getValidationStats()
      } : null,
      tester: this.tester ? {
        stats: this.tester.getTestStatistics(),
        results: this.tester.exportTestResults()
      } : null,
      exportedAt: new Date().toISOString()
    };
  }
}

// Create singleton instance
let integrationInstance = null;

export function createLangfuseIntegration(options = {}) {
  if (!integrationInstance) {
    integrationInstance = new LangfuseIntegration(options);
  }
  return integrationInstance;
}

export function getLangfuseIntegration() {
  if (!integrationInstance) {
    throw new Error('Langfuse integration not initialized. Call createLangfuseIntegration() first.');
  }
  return integrationInstance;
}

export default LangfuseIntegration;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const integration = new LangfuseIntegration();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      integration.initialize().then(status => {
        console.log('Integration Status:', JSON.stringify(status, null, 2));
      }).catch(console.error);
      break;
      
    case 'status':
      const status = integration.getIntegrationStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
      
    case 'validate':
      integration.validateIntegration().then(result => {
        console.log(JSON.stringify(result, null, 2));
      }).catch(console.error);
      break;
      
    case 'export':
      const data = integration.exportIntegrationData();
      console.log(JSON.stringify(data, null, 2));
      break;
      
    default:
      console.log('Usage: node LangfuseIntegration.js [init|status|validate|export]');
  }
}