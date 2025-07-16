/**
 * Unit Tests for LangfuseKeyValidator
 */

import LangfuseKeyValidator from '../../LangfuseKeyValidator.js';
import { Langfuse } from '../utils/mockLangfuseClient.js';

// Mock the langfuse module
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({
    trace: jest.fn().mockReturnValue({
      span: jest.fn().mockReturnValue({
        end: jest.fn()
      })
    }),
    flushAsync: jest.fn().mockResolvedValue(),
    shutdownAsync: jest.fn().mockResolvedValue()
  }))
}));

describe('LangfuseKeyValidator', () => {
  let validator;
  
  beforeEach(() => {
    validator = new LangfuseKeyValidator({
      langfuseHost: 'http://localhost:3000'
    });
  });

  describe('Key Format Validation', () => {
    test('should validate correct key formats', () => {
      const validPublicKey = 'pk-test-valid';
      const validSecretKey = 'sk-test-valid';
      
      const result = validator.validateFormat(validPublicKey, validSecretKey);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid public key format', () => {
      const invalidPublicKey = 'invalid-key';
      const validSecretKey = 'sk-test-valid';
      
      const result = validator.validateFormat(invalidPublicKey, validSecretKey);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Public key must start with pk-');
    });

    test('should reject invalid secret key format', () => {
      const validPublicKey = 'pk-test-valid';
      const invalidSecretKey = 'invalid-key';
      
      const result = validator.validateFormat(validPublicKey, invalidSecretKey);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Secret key must start with sk-');
    });

    test('should reject keys that are too short', () => {
      const shortPublicKey = 'pk-ab';
      const shortSecretKey = 'sk-cd';
      
      const result = validator.validateFormat(shortPublicKey, shortSecretKey);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Public key too short (minimum 8 characters)');
      expect(result.errors).toContain('Secret key too short (minimum 8 characters)');
    });
  });

  describe('Key Security Validation', () => {
    test('should validate secure keys', () => {
      const secureKeys = validator.generateSecureKeys();
      
      const result = validator.validateSecurity(
        secureKeys.publicKey,
        secureKeys.secretKey
      );
      
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    test('should detect weak entropy', () => {
      const weakPublicKey = 'pk-aaaaaaaa';
      const weakSecretKey = 'sk-bbbbbbbb';
      
      const result = validator.validateSecurity(weakPublicKey, weakSecretKey);
      
      expect(result.score).toBeLessThan(50);
      expect(result.issues).toContain('Low entropy detected in keys');
    });

    test('should detect common patterns', () => {
      const publicKey = 'pk-12345678';
      const secretKey = 'sk-password';
      
      const result = validator.validateSecurity(publicKey, secretKey);
      
      expect(result.issues).toContain('Common pattern detected in public key');
      expect(result.issues).toContain('Common pattern detected in secret key');
    });
  });

  describe('Connectivity Validation', () => {
    test('should successfully validate connectivity with valid keys', async () => {
      const publicKey = 'pk-test-valid';
      const secretKey = 'sk-test-valid';
      
      const result = await validator.validateConnectivity(publicKey, secretKey);
      
      expect(result.valid).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
    });

    test('should handle connection errors gracefully', async () => {
      const publicKey = 'pk-test-error';
      const secretKey = 'sk-test-error';
      
      // Mock connection error
      Langfuse.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });
      
      const result = await validator.validateConnectivity(publicKey, secretKey);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });

  describe('Complete Key Validation', () => {
    test('should perform complete validation successfully', async () => {
      const keys = validator.generateSecureKeys();
      
      const result = await validator.validateKeys(
        keys.publicKey,
        keys.secretKey
      );
      
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(70);
      expect(result.tests.format.passed).toBe(true);
      expect(result.tests.security.passed).toBe(true);
      expect(result.tests.connectivity.passed).toBe(true);
    });

    test('should aggregate failures from all validation steps', async () => {
      const invalidPublicKey = 'invalid';
      const invalidSecretKey = 'invalid';
      
      const result = await validator.validateKeys(
        invalidPublicKey,
        invalidSecretKey
      );
      
      expect(result.valid).toBe(false);
      expect(result.score).toBeLessThan(50);
      expect(result.tests.format.passed).toBe(false);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Key Rotation', () => {
    test('should rotate keys successfully', async () => {
      const oldKeys = {
        publicKey: 'pk-old-key',
        secretKey: 'sk-old-key'
      };
      
      const result = await validator.rotateKeys(
        oldKeys.publicKey,
        oldKeys.secretKey
      );
      
      expect(result.success).toBe(true);
      expect(result.newKeys.publicKey).not.toBe(oldKeys.publicKey);
      expect(result.newKeys.secretKey).not.toBe(oldKeys.secretKey);
      expect(result.validation.valid).toBe(true);
    });

    test('should validate new keys after rotation', async () => {
      const oldKeys = {
        publicKey: 'pk-old-key',
        secretKey: 'sk-old-key'
      };
      
      const result = await validator.rotateKeys(
        oldKeys.publicKey,
        oldKeys.secretKey
      );
      
      expect(result.validation.score).toBeGreaterThan(70);
      expect(result.validation.tests.security.passed).toBe(true);
    });
  });

  describe('Secure Key Generation', () => {
    test('should generate unique keys each time', () => {
      const keys1 = validator.generateSecureKeys();
      const keys2 = validator.generateSecureKeys();
      
      expect(keys1.publicKey).not.toBe(keys2.publicKey);
      expect(keys1.secretKey).not.toBe(keys2.secretKey);
    });

    test('should generate keys with proper format', () => {
      const keys = validator.generateSecureKeys();
      
      expect(keys.publicKey).toMatch(/^pk-lf-[a-f0-9]{32}$/);
      expect(keys.secretKey).toMatch(/^sk-lf-[a-f0-9]{32}$/);
    });

    test('should generate keys with sufficient entropy', () => {
      const keys = validator.generateSecureKeys();
      
      const validation = validator.validateSecurity(
        keys.publicKey,
        keys.secretKey
      );
      
      expect(validation.score).toBeGreaterThan(90);
    });
  });

  describe('Entropy Calculation', () => {
    test('should calculate low entropy for repetitive strings', () => {
      const lowEntropyString = 'aaaaaaaaaa';
      const entropy = validator.calculateEntropy(lowEntropyString);
      
      expect(entropy).toBeLessThan(1);
    });

    test('should calculate high entropy for random strings', () => {
      const highEntropyString = 'a1B2c3D4e5F6g7H8';
      const entropy = validator.calculateEntropy(highEntropyString);
      
      expect(entropy).toBeGreaterThan(3);
    });
  });

  describe('Event Emission', () => {
    test('should emit validation-complete event', async () => {
      const keys = validator.generateSecureKeys();
      const eventHandler = jest.fn();
      
      validator.on('validation-complete', eventHandler);
      
      await validator.validateKeys(keys.publicKey, keys.secretKey);
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          score: expect.any(Number)
        })
      );
    });

    test('should emit key-rotated event', async () => {
      const eventHandler = jest.fn();
      
      validator.on('key-rotated', eventHandler);
      
      await validator.rotateKeys('pk-old', 'sk-old');
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          oldPublicKey: 'pk-old',
          newPublicKey: expect.stringMatching(/^pk-lf-/)
        })
      );
    });
  });
});