/**
 * E2E Tests for CLI Commands
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

describe('CLI Commands E2E', () => {
  const CLI_PATH = path.join(process.cwd(), 'api-key-cli.js');
  const TEST_KEYS_FILE = path.join(process.cwd(), 'test-cli-keys.json');
  
  // Helper to run CLI commands
  const runCLI = (args) => {
    return new Promise((resolve, reject) => {
      const output = { stdout: '', stderr: '' };
      const child = spawn('node', [CLI_PATH, ...args], {
        env: { ...process.env, LANGFUSE_KEYS_FILE: TEST_KEYS_FILE }
      });
      
      child.stdout.on('data', (data) => {
        output.stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        output.stderr += data.toString();
      });
      
      child.on('close', (code) => {
        output.exitCode = code;
        if (code === 0) {
          resolve(output);
        } else {
          reject(output);
        }
      });
      
      child.on('error', reject);
    });
  };
  
  beforeEach(async () => {
    // Clean up any existing test files
    try {
      await fs.unlink(TEST_KEYS_FILE);
    } catch (error) {
      // File may not exist
    }
  });
  
  afterEach(async () => {
    // Cleanup
    try {
      await fs.unlink(TEST_KEYS_FILE);
    } catch (error) {
      // File may not exist
    }
  });

  describe('Key Generation', () => {
    test('should generate new keys via CLI', async () => {
      const result = await runCLI(['generate', 'test-key']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Generated new key');
      expect(result.stdout).toMatch(/Public Key: pk-lf-[a-f0-9]+/);
      expect(result.stdout).toMatch(/Secret Key: sk-lf-[a-f0-9]+/);
    });

    test('should save generated keys to file', async () => {
      await runCLI(['generate', 'saved-key']);
      
      // Verify file was created
      const fileExists = await fs.access(TEST_KEYS_FILE)
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
      
      // Verify content
      const content = await fs.readFile(TEST_KEYS_FILE, 'utf-8');
      const data = JSON.parse(content);
      
      expect(data.keys).toHaveLength(1);
      expect(data.keys[0].id).toBe('saved-key');
    });
  });

  describe('Key Validation', () => {
    test('should validate keys via CLI', async () => {
      // First generate a key
      const genResult = await runCLI(['generate', 'validate-test']);
      
      // Extract keys from output
      const publicKeyMatch = genResult.stdout.match(/Public Key: (pk-lf-[a-f0-9]+)/);
      const secretKeyMatch = genResult.stdout.match(/Secret Key: (sk-lf-[a-f0-9]+)/);
      
      expect(publicKeyMatch).toBeTruthy();
      expect(secretKeyMatch).toBeTruthy();
      
      const publicKey = publicKeyMatch[1];
      const secretKey = secretKeyMatch[1];
      
      // Validate the keys
      const validateResult = await runCLI(['validate', publicKey, secretKey]);
      
      expect(validateResult.exitCode).toBe(0);
      expect(validateResult.stdout).toContain('Validation Result');
      expect(validateResult.stdout).toContain('Valid: true');
      expect(validateResult.stdout).toMatch(/Score: \d+/);
    });

    test('should reject invalid keys', async () => {
      const result = await runCLI(['validate', 'invalid-pk', 'invalid-sk'])
        .catch(e => e);
      
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Valid: false');
    });
  });

  describe('Key Listing', () => {
    test('should list all keys', async () => {
      // Generate multiple keys
      await runCLI(['generate', 'key-1']);
      await runCLI(['generate', 'key-2']);
      await runCLI(['generate', 'key-3']);
      
      // List keys
      const result = await runCLI(['list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('key-1');
      expect(result.stdout).toContain('key-2');
      expect(result.stdout).toContain('key-3');
      expect(result.stdout).toMatch(/Total keys: 3/);
    });

    test('should show detailed key information', async () => {
      await runCLI(['generate', 'detail-test']);
      
      const result = await runCLI(['list', '--detailed']);
      
      expect(result.stdout).toContain('Created:');
      expect(result.stdout).toContain('Last Used:');
      expect(result.stdout).toContain('Rotation Count:');
      expect(result.stdout).toContain('Status:');
    });
  });

  describe('Key Rotation', () => {
    test('should rotate key via CLI', async () => {
      // Generate initial key
      await runCLI(['generate', 'rotate-test']);
      
      // Get initial key info
      const listBefore = await runCLI(['list']);
      const publicKeyBefore = listBefore.stdout.match(/pk-lf-[a-f0-9]+/)[0];
      
      // Rotate the key
      const rotateResult = await runCLI(['rotate', 'rotate-test']);
      
      expect(rotateResult.exitCode).toBe(0);
      expect(rotateResult.stdout).toContain('Key rotated successfully');
      
      // Verify key changed
      const listAfter = await runCLI(['list']);
      const publicKeyAfter = listAfter.stdout.match(/pk-lf-[a-f0-9]+/)[0];
      
      expect(publicKeyAfter).not.toBe(publicKeyBefore);
    });

    test('should handle rotation of non-existent key', async () => {
      const result = await runCLI(['rotate', 'non-existent'])
        .catch(e => e);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Key not found');
    });
  });

  describe('Key Deletion', () => {
    test('should delete key via CLI', async () => {
      // Generate key
      await runCLI(['generate', 'delete-test']);
      
      // Verify it exists
      const listBefore = await runCLI(['list']);
      expect(listBefore.stdout).toContain('delete-test');
      
      // Delete it
      const deleteResult = await runCLI(['delete', 'delete-test']);
      expect(deleteResult.exitCode).toBe(0);
      expect(deleteResult.stdout).toContain('Key deleted');
      
      // Verify it's gone
      const listAfter = await runCLI(['list']);
      expect(listAfter.stdout).not.toContain('delete-test');
    });

    test('should require confirmation for deletion', async () => {
      await runCLI(['generate', 'confirm-delete']);
      
      // Try to delete without --force flag
      const result = await runCLI(['delete', 'confirm-delete'])
        .catch(e => e);
      
      // Should prompt for confirmation (in real scenario)
      // For testing, we expect it to fail without --force
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Primary Key Management', () => {
    test('should set primary key', async () => {
      await runCLI(['generate', 'primary-1']);
      await runCLI(['generate', 'primary-2']);
      
      // Set primary
      const setPrimaryResult = await runCLI(['set-primary', 'primary-1']);
      
      expect(setPrimaryResult.exitCode).toBe(0);
      expect(setPrimaryResult.stdout).toContain('Primary key set');
      
      // Verify in list
      const listResult = await runCLI(['list']);
      expect(listResult.stdout).toMatch(/primary-1.*\[PRIMARY\]/);
    });

    test('should get primary key', async () => {
      await runCLI(['generate', 'get-primary']);
      await runCLI(['set-primary', 'get-primary']);
      
      const result = await runCLI(['get-primary']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('get-primary');
      expect(result.stdout).toContain('pk-lf-');
    });
  });

  describe('Health Monitoring', () => {
    test('should show key health status', async () => {
      await runCLI(['generate', 'health-test']);
      
      const result = await runCLI(['health']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Key Health Report');
      expect(result.stdout).toContain('Total Keys:');
      expect(result.stdout).toContain('Healthy Keys:');
      expect(result.stdout).toContain('health-test');
    });

    test('should monitor keys continuously', async () => {
      await runCLI(['generate', 'monitor-test']);
      
      // Start monitoring (with timeout for testing)
      const monitorProcess = spawn('node', [CLI_PATH, 'monitor', '--duration', '2']);
      
      let output = '';
      monitorProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        monitorProcess.on('close', resolve);
      });
      
      expect(output).toContain('Monitoring keys');
      expect(output).toContain('monitor-test');
    });
  });

  describe('Import/Export', () => {
    test('should export keys to file', async () => {
      await runCLI(['generate', 'export-1']);
      await runCLI(['generate', 'export-2']);
      
      const exportPath = 'test-export.json';
      const result = await runCLI(['export', exportPath]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Keys exported');
      
      // Verify export file
      const exportContent = await fs.readFile(exportPath, 'utf-8');
      const exportData = JSON.parse(exportContent);
      
      expect(exportData.keys).toHaveLength(2);
      expect(exportData.exportedAt).toBeDefined();
      
      // Cleanup
      await fs.unlink(exportPath);
    });

    test('should import keys from file', async () => {
      // Create import file
      const importData = {
        keys: [
          {
            id: 'imported-1',
            publicKey: 'pk-lf-import1',
            secretKey: 'sk-lf-import1',
            createdAt: Date.now()
          }
        ]
      };
      
      const importPath = 'test-import.json';
      await fs.writeFile(importPath, JSON.stringify(importData, null, 2));
      
      // Import
      const result = await runCLI(['import', importPath]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Keys imported');
      
      // Verify imported key
      const listResult = await runCLI(['list']);
      expect(listResult.stdout).toContain('imported-1');
      
      // Cleanup
      await fs.unlink(importPath);
    });
  });

  describe('Configuration', () => {
    test('should show current configuration', async () => {
      const result = await runCLI(['config']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration');
      expect(result.stdout).toContain('Auto Rotate:');
      expect(result.stdout).toContain('Rotation Interval:');
      expect(result.stdout).toContain('Storage File:');
    });

    test('should update configuration', async () => {
      const result = await runCLI(['config', 'set', 'autoRotate', 'true']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration updated');
      
      // Verify change
      const configResult = await runCLI(['config']);
      expect(configResult.stdout).toContain('Auto Rotate: true');
    });
  });

  describe('Error Handling', () => {
    test('should show help for unknown command', async () => {
      const result = await runCLI(['unknown-command'])
        .catch(e => e);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command');
      expect(result.stderr).toContain('Usage:');
    });

    test('should validate required arguments', async () => {
      const result = await runCLI(['validate'])
        .catch(e => e);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Missing required arguments');
    });

    test('should handle missing key file gracefully', async () => {
      // Remove key file if it exists
      try {
        await fs.unlink(TEST_KEYS_FILE);
      } catch (e) {}
      
      const result = await runCLI(['list']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No keys found');
    });
  });
});