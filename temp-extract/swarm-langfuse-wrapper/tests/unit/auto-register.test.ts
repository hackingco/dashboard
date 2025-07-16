/**
 * Tests for auto-registration functionality
 * Validates automatic Claude Flow integration
 */

import { jest } from '@jest/globals';
import {
  autoRegisterLangfuse,
  createLangfusePlugin,
  isLangfuseConfigured,
  getLangfuseConfig,
  withLangfuseTracing
} from '../../src/auto-register';
import { LangfuseWrapper } from '../../src/index';
import { createMockLangfuseClient } from '../mocks/langfuse.mock';

// Mock dependencies
jest.mock('langfuse');
jest.mock('../../src/index');
jest.mock('../../src/hook-enhancer');
jest.mock('../../src/claude-flow-integration');

describe('Auto-Registration Tests', () => {
  let mockClient: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original environment
    originalEnv = { ...process.env };
    
    mockClient = createMockLangfuseClient();
    (require('langfuse') as any).Langfuse = jest.fn(() => mockClient);
    
    // Mock LangfuseWrapper
    const MockLangfuseWrapper = jest.fn().mockImplementation(() => ({
      isEnabled: jest.fn().mockReturnValue(true),
      shutdown: jest.fn().mockResolvedValue(undefined)
    }));
    (require('../../src/index') as any).LangfuseWrapper = MockLangfuseWrapper;

    // Mock hook enhancer
    const mockEnhancer = {
      enhanceAll: jest.fn().mockImplementation((hooks) => ({
        ...hooks,
        enhanced: true
      }))
    };
    (require('../../src/hook-enhancer') as any).createHookEnhancer = jest.fn().mockReturnValue(mockEnhancer);

    // Mock Claude Flow integration
    const mockIntegration = {
      registerWithClaudeFlow: jest.fn()
    };
    (require('../../src/claude-flow-integration') as any).claudeFlowIntegration = mockIntegration;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('autoRegisterLangfuse', () => {
    it('should register when API keys are provided in config', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = {
        enableLangfuse: true,
        langfuseConfig: {
          publicKey: 'config-public-key',
          secretKey: 'config-secret-key'
        },
        hooks: {
          'pre-task': jest.fn(),
          'post-task': jest.fn()
        },
        hookManager: {
          registerHook: jest.fn()
        }
      };

      const result = autoRegisterLangfuse(config);

      expect(consoleLogSpy).toHaveBeenCalledWith('Auto-registering Langfuse with Claude Flow...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Enhanced 2 hooks with Langfuse tracing');
      expect(consoleLogSpy).toHaveBeenCalledWith('Registered Langfuse integration with hook manager');
      
      expect(result.hooks).toEqual({
        'pre-task': expect.any(Function),
        'post-task': expect.any(Function),
        enhanced: true
      });

      consoleLogSpy.mockRestore();
    });

    it('should register when API keys are in environment variables', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'env-public-key';
      process.env.LANGFUSE_SECRET_KEY = 'env-secret-key';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = {
        hooks: {
          'pre-edit': jest.fn()
        }
      };

      const result = autoRegisterLangfuse(config);

      expect(consoleLogSpy).toHaveBeenCalledWith('Auto-registering Langfuse with Claude Flow...');
      expect(result.hooks).toEqual({
        'pre-edit': expect.any(Function),
        enhanced: true
      });

      consoleLogSpy.mockRestore();
    });

    it('should skip registration when explicitly disabled', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'env-public-key';
      process.env.LANGFUSE_SECRET_KEY = 'env-secret-key';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = {
        enableLangfuse: false,
        hooks: {
          'pre-task': jest.fn()
        }
      };

      const result = autoRegisterLangfuse(config);

      expect(consoleLogSpy).toHaveBeenCalledWith('Langfuse auto-registration skipped - no API keys found');
      expect(result).toBe(config); // Unchanged
      expect(result.hooks.enhanced).toBeUndefined();

      consoleLogSpy.mockRestore();
    });

    it('should skip registration when no API keys available', () => {
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = {
        hooks: {
          'pre-task': jest.fn()
        }
      };

      const result = autoRegisterLangfuse(config);

      expect(consoleLogSpy).toHaveBeenCalledWith('Langfuse auto-registration skipped - no API keys found');
      expect(result).toBe(config); // Unchanged

      consoleLogSpy.mockRestore();
    });

    it('should handle config without hooks or hook manager', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'env-public-key';
      process.env.LANGFUSE_SECRET_KEY = 'env-secret-key';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = {
        enableLangfuse: true
      };

      const result = autoRegisterLangfuse(config);

      expect(consoleLogSpy).toHaveBeenCalledWith('Auto-registering Langfuse with Claude Flow...');
      expect(result).toEqual(config);

      consoleLogSpy.mockRestore();
    });

    it('should setup signal handlers for graceful shutdown', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'env-public-key';
      process.env.LANGFUSE_SECRET_KEY = 'env-secret-key';

      const processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
      
      const config = {
        enableLangfuse: true
      };

      autoRegisterLangfuse(config);

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

      processOnSpy.mockRestore();
    });

    it('should create custom LangfuseWrapper when config provided', () => {
      const MockLangfuseWrapper = require('../../src/index').LangfuseWrapper;
      
      const config = {
        enableLangfuse: true,
        langfuseConfig: {
          publicKey: 'custom-public',
          secretKey: 'custom-secret',
          host: 'https://custom.langfuse.com'
        }
      };

      autoRegisterLangfuse(config);

      expect(MockLangfuseWrapper).toHaveBeenCalledWith(config.langfuseConfig);
    });
  });

  describe('createLangfusePlugin', () => {
    it('should create plugin with proper interface', () => {
      const plugin = createLangfusePlugin();

      expect(plugin).toEqual({
        name: 'langfuse-tracing',
        version: '1.0.0',
        initialize: expect.any(Function),
        beforeHook: expect.any(Function),
        afterHook: expect.any(Function),
        shutdown: expect.any(Function)
      });
    });

    it('should auto-register during initialization when configured', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'plugin-public';
      process.env.LANGFUSE_SECRET_KEY = 'plugin-secret';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const plugin = createLangfusePlugin();
      const mockClaudeFlow = {
        hooks: { 'pre-task': jest.fn() },
        hookManager: { register: jest.fn() }
      };

      await plugin.initialize(mockClaudeFlow);

      expect(consoleLogSpy).toHaveBeenCalledWith('Initializing Langfuse plugin for Claude Flow');

      consoleLogSpy.mockRestore();
    });

    it('should skip auto-registration when not configured', async () => {
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;

      const plugin = createLangfusePlugin();
      const mockClaudeFlow = {
        hooks: { 'pre-task': jest.fn() },
        hookManager: { register: jest.fn() }
      };

      // Should not throw
      await plugin.initialize(mockClaudeFlow);
    });

    it('should add context in beforeHook when enabled', async () => {
      const mockWrapper = {
        isEnabled: jest.fn().mockReturnValue(true)
      };
      
      const plugin = createLangfusePlugin();
      const options = { test: 'data' };

      await plugin.beforeHook('test-hook', options);

      expect(options._langfuseContext).toEqual({
        hookType: 'test-hook',
        timestamp: expect.any(Number)
      });
    });

    it('should skip context addition when disabled', async () => {
      const plugin = createLangfusePlugin();
      const options = { test: 'data' };

      await plugin.beforeHook('test-hook', options);

      expect(options._langfuseContext).toBeUndefined();
    });

    it('should log timing in afterHook', async () => {
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
      
      const plugin = createLangfusePlugin();
      const options = {
        _langfuseContext: {
          hookType: 'test-hook',
          timestamp: Date.now() - 100 // 100ms ago
        }
      };

      await plugin.afterHook('test-hook', options, { success: true });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Hook test-hook completed in \d+ms/)
      );

      consoleDebugSpy.mockRestore();
    });

    it('should shutdown gracefully', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const plugin = createLangfusePlugin();
      
      await plugin.shutdown();

      expect(consoleLogSpy).toHaveBeenCalledWith('Shutting down Langfuse plugin');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Configuration Helpers', () => {
    describe('isLangfuseConfigured', () => {
      it('should return true when both keys are present', () => {
        process.env.LANGFUSE_PUBLIC_KEY = 'test-public';
        process.env.LANGFUSE_SECRET_KEY = 'test-secret';

        expect(isLangfuseConfigured()).toBe(true);
      });

      it('should return false when public key is missing', () => {
        delete process.env.LANGFUSE_PUBLIC_KEY;
        process.env.LANGFUSE_SECRET_KEY = 'test-secret';

        expect(isLangfuseConfigured()).toBe(false);
      });

      it('should return false when secret key is missing', () => {
        process.env.LANGFUSE_PUBLIC_KEY = 'test-public';
        delete process.env.LANGFUSE_SECRET_KEY;

        expect(isLangfuseConfigured()).toBe(false);
      });

      it('should return false when both keys are missing', () => {
        delete process.env.LANGFUSE_PUBLIC_KEY;
        delete process.env.LANGFUSE_SECRET_KEY;

        expect(isLangfuseConfigured()).toBe(false);
      });
    });

    describe('getLangfuseConfig', () => {
      it('should return configuration from environment', () => {
        process.env.LANGFUSE_PUBLIC_KEY = 'env-public';
        process.env.LANGFUSE_SECRET_KEY = 'env-secret';
        process.env.LANGFUSE_HOST = 'https://custom.langfuse.com';

        const config = getLangfuseConfig();

        expect(config).toEqual({
          publicKey: 'env-public',
          secretKey: 'env-secret',
          host: 'https://custom.langfuse.com',
          enabled: true
        });
      });

      it('should use default host when not specified', () => {
        process.env.LANGFUSE_PUBLIC_KEY = 'env-public';
        process.env.LANGFUSE_SECRET_KEY = 'env-secret';
        delete process.env.LANGFUSE_HOST;

        const config = getLangfuseConfig();

        expect(config).toEqual({
          publicKey: 'env-public',
          secretKey: 'env-secret',
          host: 'https://cloud.langfuse.com',
          enabled: true
        });
      });

      it('should indicate disabled when keys are missing', () => {
        delete process.env.LANGFUSE_PUBLIC_KEY;
        delete process.env.LANGFUSE_SECRET_KEY;

        const config = getLangfuseConfig();

        expect(config).toEqual({
          publicKey: undefined,
          secretKey: undefined,
          host: 'https://cloud.langfuse.com',
          enabled: false
        });
      });
    });
  });

  describe('withLangfuseTracing', () => {
    it('should wrap Claude Flow initialization function', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'wrapper-public';
      process.env.LANGFUSE_SECRET_KEY = 'wrapper-secret';

      const mockClaudeFlowInit = jest.fn().mockResolvedValue({
        hooks: { 'pre-task': jest.fn() },
        hookManager: { register: jest.fn() }
      });

      const wrappedInit = withLangfuseTracing(mockClaudeFlowInit);
      const result = await wrappedInit('arg1', 'arg2');

      expect(mockClaudeFlowInit).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result.hooks.enhanced).toBe(true);
    });

    it('should not modify result when Langfuse not configured', async () => {
      delete process.env.LANGFUSE_PUBLIC_KEY;
      delete process.env.LANGFUSE_SECRET_KEY;

      const originalResult = {
        hooks: { 'pre-task': jest.fn() },
        hookManager: { register: jest.fn() }
      };

      const mockClaudeFlowInit = jest.fn().mockResolvedValue(originalResult);
      const wrappedInit = withLangfuseTracing(mockClaudeFlowInit);
      const result = await wrappedInit();

      expect(result).toBe(originalResult);
      expect(result.hooks.enhanced).toBeUndefined();
    });

    it('should handle initialization errors gracefully', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'error-public';
      process.env.LANGFUSE_SECRET_KEY = 'error-secret';

      const mockClaudeFlowInit = jest.fn().mockRejectedValue(new Error('Init failed'));
      const wrappedInit = withLangfuseTracing(mockClaudeFlowInit);

      await expect(wrappedInit()).rejects.toThrow('Init failed');
    });

    it('should preserve function context and arguments', async () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'context-public';
      process.env.LANGFUSE_SECRET_KEY = 'context-secret';

      const mockContext = { name: 'test-context' };
      const mockClaudeFlowInit = jest.fn(function(this: any, ...args: any[]) {
        expect(this).toBe(mockContext);
        expect(args).toEqual(['test', 'args']);
        return Promise.resolve({
          hooks: {},
          hookManager: {}
        });
      });

      const wrappedInit = withLangfuseTracing(mockClaudeFlowInit);
      await wrappedInit.call(mockContext, 'test', 'args');

      expect(mockClaudeFlowInit).toHaveBeenCalledWith('test', 'args');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during hook enhancement', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'error-public';
      process.env.LANGFUSE_SECRET_KEY = 'error-secret';

      const mockEnhancer = {
        enhanceAll: jest.fn().mockImplementation(() => {
          throw new Error('Enhancement failed');
        })
      };
      (require('../../src/hook-enhancer') as any).createHookEnhancer = jest.fn().mockReturnValue(mockEnhancer);

      const config = {
        hooks: { 'pre-task': jest.fn() }
      };

      // Should not throw, but should handle error gracefully
      const result = autoRegisterLangfuse(config);
      
      // Original config should be returned if enhancement fails
      expect(result.hooks).toEqual(config.hooks);
    });

    it('should handle errors during Claude Flow integration', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'error-public';
      process.env.LANGFUSE_SECRET_KEY = 'error-secret';

      const mockIntegration = {
        registerWithClaudeFlow: jest.fn().mockImplementation(() => {
          throw new Error('Integration failed');
        })
      };
      (require('../../src/claude-flow-integration') as any).claudeFlowIntegration = mockIntegration;

      const config = {
        hookManager: { register: jest.fn() }
      };

      // Should not throw
      const result = autoRegisterLangfuse(config);
      expect(result).toBeDefined();
    });
  });
});