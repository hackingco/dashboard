/**
 * Unit Tests for LangfuseApiKeyManager
 */

import LangfuseApiKeyManager from '../../LangfuseApiKeyManager.js';
import LangfuseKeyValidator from '../../LangfuseKeyValidator.js';

// Mock dependencies
jest.mock('../../LangfuseKeyValidator.js');
jest.mock('fs/promises');

describe('LangfuseApiKeyManager', () => {
  let manager;
  let mockValidator;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock validator
    mockValidator = {
      validateKeys: jest.fn().mockResolvedValue({
        valid: true,
        score: 85,
        tests: { format: { passed: true }, security: { passed: true } }
      }),
      generateSecureKeys: jest.fn().mockReturnValue({
        publicKey: 'pk-lf-test123',
        secretKey: 'sk-lf-test123'
      }),
      rotateKeys: jest.fn().mockResolvedValue({
        success: true,
        newKeys: {
          publicKey: 'pk-lf-new123',
          secretKey: 'sk-lf-new123'
        },
        validation: { valid: true, score: 90 }
      })
    };
    
    LangfuseKeyValidator.mockImplementation(() => mockValidator);
    
    manager = new LangfuseApiKeyManager({
      autoRotate: false,
      rotationInterval: 86400000
    });
  });

  describe('Key Management', () => {
    test('should add keys successfully', async () => {
      const result = await manager.addKey('test-key', 'pk-test', 'sk-test');
      
      expect(result.success).toBe(true);
      expect(mockValidator.validateKeys).toHaveBeenCalledWith('pk-test', 'sk-test');
      expect(manager.keys.has('test-key')).toBe(true);
    });

    test('should reject invalid keys', async () => {
      mockValidator.validateKeys.mockResolvedValueOnce({
        valid: false,
        score: 30,
        tests: { format: { passed: false } }
      });
      
      const result = await manager.addKey('invalid-key', 'bad-pk', 'bad-sk');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Key validation failed');
      expect(manager.keys.has('invalid-key')).toBe(false);
    });

    test('should update existing keys', async () => {
      await manager.addKey('existing', 'pk-old', 'sk-old');
      const result = await manager.addKey('existing', 'pk-new', 'sk-new');
      
      expect(result.success).toBe(true);
      const key = manager.getKey('existing');
      expect(key.publicKey).toBe('pk-new');
    });

    test('should remove keys', () => {
      manager.keys.set('to-remove', {
        publicKey: 'pk-remove',
        secretKey: 'sk-remove'
      });
      
      const result = manager.removeKey('to-remove');
      
      expect(result).toBe(true);
      expect(manager.keys.has('to-remove')).toBe(false);
    });

    test('should list all keys', async () => {
      await manager.addKey('key1', 'pk-1', 'sk-1');
      await manager.addKey('key2', 'pk-2', 'sk-2');
      
      const keys = manager.listKeys();
      
      expect(keys).toHaveLength(2);
      expect(keys[0]).toMatchObject({
        id: 'key1',
        publicKey: 'pk-1'
      });
      expect(keys[0].secretKey).toBeUndefined(); // Should not expose secret
    });
  });

  describe('Key Rotation', () => {
    beforeEach(async () => {
      await manager.addKey('rotate-test', 'pk-old', 'sk-old');
    });

    test('should rotate specific key', async () => {
      const result = await manager.rotateKey('rotate-test');
      
      expect(result.success).toBe(true);
      expect(mockValidator.rotateKeys).toHaveBeenCalledWith('pk-old', 'sk-old');
      
      const key = manager.getKey('rotate-test');
      expect(key.publicKey).toBe('pk-lf-new123');
      expect(key.rotationCount).toBe(1);
    });

    test('should handle rotation failure', async () => {
      mockValidator.rotateKeys.mockResolvedValueOnce({
        success: false,
        error: 'Rotation failed'
      });
      
      const result = await manager.rotateKey('rotate-test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rotation failed');
      
      // Key should remain unchanged
      const key = manager.getKey('rotate-test');
      expect(key.publicKey).toBe('pk-old');
    });

    test('should emit rotation events', async () => {
      const eventHandler = jest.fn();
      manager.on('key-rotated', eventHandler);
      
      await manager.rotateKey('rotate-test');
      
      expect(eventHandler).toHaveBeenCalledWith({
        keyId: 'rotate-test',
        oldPublicKey: 'pk-old',
        newPublicKey: 'pk-lf-new123'
      });
    });
  });

  describe('Auto Rotation', () => {
    test('should start auto rotation', () => {
      manager.startAutoRotation();
      
      expect(manager.autoRotateInterval).toBeDefined();
      expect(manager.config.autoRotate).toBe(true);
    });

    test('should stop auto rotation', () => {
      manager.startAutoRotation();
      manager.stopAutoRotation();
      
      expect(manager.autoRotateInterval).toBeNull();
      expect(manager.config.autoRotate).toBe(false);
    });

    test('should check keys for rotation based on age', async () => {
      const oldKey = {
        publicKey: 'pk-old',
        secretKey: 'sk-old',
        createdAt: Date.now() - 90000000, // Old key
        lastRotated: Date.now() - 90000000,
        rotationCount: 0
      };
      
      manager.keys.set('old-key', oldKey);
      
      await manager.checkAndRotateKeys();
      
      expect(mockValidator.rotateKeys).toHaveBeenCalled();
    });

    test('should not rotate recently rotated keys', async () => {
      const newKey = {
        publicKey: 'pk-new',
        secretKey: 'sk-new',
        createdAt: Date.now(),
        lastRotated: Date.now(),
        rotationCount: 0
      };
      
      manager.keys.set('new-key', newKey);
      
      await manager.checkAndRotateKeys();
      
      expect(mockValidator.rotateKeys).not.toHaveBeenCalled();
    });
  });

  describe('Key Selection', () => {
    beforeEach(async () => {
      await manager.addKey('primary', 'pk-primary', 'sk-primary');
      await manager.addKey('secondary', 'pk-secondary', 'sk-secondary');
    });

    test('should get specific key by ID', () => {
      const key = manager.getKey('primary');
      
      expect(key).toBeDefined();
      expect(key.publicKey).toBe('pk-primary');
    });

    test('should get primary key', async () => {
      await manager.setPrimaryKey('primary');
      const key = manager.getPrimaryKey();
      
      expect(key).toBeDefined();
      expect(key.publicKey).toBe('pk-primary');
    });

    test('should get random key for load balancing', () => {
      const keys = new Set();
      
      // Get keys multiple times
      for (let i = 0; i < 10; i++) {
        const key = manager.getRandomKey();
        keys.add(key.publicKey);
      }
      
      // Should have selected different keys
      expect(keys.size).toBeGreaterThan(1);
    });
  });

  describe('Health Monitoring', () => {
    test('should monitor key health', async () => {
      await manager.addKey('health-test', 'pk-health', 'sk-health');
      
      const health = await manager.monitorKeyHealth();
      
      expect(health.totalKeys).toBe(1);
      expect(health.healthyKeys).toBe(1);
      expect(health.keys['health-test']).toMatchObject({
        status: 'healthy',
        score: 85
      });
    });

    test('should identify unhealthy keys', async () => {
      mockValidator.validateKeys.mockResolvedValueOnce({
        valid: false,
        score: 40,
        tests: { connectivity: { passed: false } }
      });
      
      await manager.addKey('unhealthy', 'pk-bad', 'sk-bad', {
        skipValidation: true // Force add for testing
      });
      
      const health = await manager.monitorKeyHealth();
      
      expect(health.unhealthyKeys).toBe(1);
      expect(health.keys['unhealthy'].status).toBe('unhealthy');
    });

    test('should emit health alerts', async () => {
      const alertHandler = jest.fn();
      manager.on('health-alert', alertHandler);
      
      mockValidator.validateKeys.mockResolvedValueOnce({
        valid: false,
        score: 30
      });
      
      await manager.addKey('alert-test', 'pk-alert', 'sk-alert', {
        skipValidation: true
      });
      await manager.monitorKeyHealth();
      
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          keyId: 'alert-test',
          status: 'unhealthy'
        })
      );
    });
  });

  describe('Key Persistence', () => {
    const fs = require('fs/promises');
    
    test('should save keys to file', async () => {
      fs.writeFile = jest.fn().mockResolvedValue();
      
      await manager.addKey('persist-test', 'pk-persist', 'sk-persist');
      await manager.saveKeys();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('keys.json'),
        expect.any(String),
        'utf-8'
      );
    });

    test('should load keys from file', async () => {
      const savedData = {
        keys: [
          {
            id: 'loaded-key',
            publicKey: 'pk-loaded',
            secretKey: 'sk-loaded',
            createdAt: Date.now()
          }
        ],
        primaryKeyId: 'loaded-key'
      };
      
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify(savedData));
      fs.access = jest.fn().mockResolvedValue();
      
      await manager.loadKeys();
      
      expect(manager.keys.has('loaded-key')).toBe(true);
      expect(manager.primaryKeyId).toBe('loaded-key');
    });

    test('should handle missing key file gracefully', async () => {
      fs.access = jest.fn().mockRejectedValue(new Error('File not found'));
      
      await manager.loadKeys();
      
      expect(manager.keys.size).toBe(0);
    });
  });

  describe('Statistics and Metrics', () => {
    beforeEach(async () => {
      await manager.addKey('stats-key1', 'pk-1', 'sk-1');
      await manager.addKey('stats-key2', 'pk-2', 'sk-2');
      
      // Simulate some usage
      const key1 = manager.keys.get('stats-key1');
      key1.usageCount = 100;
      key1.lastUsed = Date.now();
      key1.rotationCount = 2;
    });

    test('should calculate key statistics', () => {
      const stats = manager.getStatistics();
      
      expect(stats.totalKeys).toBe(2);
      expect(stats.averageAge).toBeGreaterThan(0);
      expect(stats.totalRotations).toBe(2);
      expect(stats.totalUsage).toBe(100);
    });

    test('should identify most used key', () => {
      const stats = manager.getStatistics();
      
      expect(stats.mostUsedKey).toMatchObject({
        id: 'stats-key1',
        usageCount: 100
      });
    });

    test('should track health scores', async () => {
      await manager.monitorKeyHealth();
      const stats = manager.getStatistics();
      
      expect(stats.averageHealthScore).toBe(85);
      expect(stats.healthDistribution.healthy).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors gracefully', async () => {
      mockValidator.validateKeys.mockRejectedValue(new Error('Network error'));
      
      const result = await manager.addKey('error-key', 'pk-error', 'sk-error');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to add key');
    });

    test('should handle rotation errors gracefully', async () => {
      await manager.addKey('rotation-error', 'pk-rot', 'sk-rot');
      mockValidator.rotateKeys.mockRejectedValue(new Error('Rotation error'));
      
      const result = await manager.rotateKey('rotation-error');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rotation error');
    });

    test('should emit error events', async () => {
      const errorHandler = jest.fn();
      manager.on('error', errorHandler);
      
      mockValidator.validateKeys.mockRejectedValue(new Error('Test error'));
      await manager.addKey('error-emit', 'pk-err', 'sk-err');
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Test error')
        })
      );
    });
  });
});