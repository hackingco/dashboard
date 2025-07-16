/**
 * E2E Tests for Web Dashboard
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import waitPort from 'wait-port';

describe('Web Dashboard E2E', () => {
  let browser;
  let context;
  let page;
  let serverProcess;
  const SERVER_PORT = 3001;
  const SERVER_URL = `http://localhost:${SERVER_PORT}`;
  
  beforeAll(async () => {
    // Start the dashboard server
    serverProcess = spawn('npm', ['run', 'dashboard:start'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: SERVER_PORT,
        NODE_ENV: 'test'
      }
    });
    
    // Wait for server to be ready
    await waitPort({
      host: 'localhost',
      port: SERVER_PORT,
      timeout: 30000
    });
    
    // Launch browser
    browser = await chromium.launch({
      headless: true
    });
  });
  
  afterAll(async () => {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => {
        serverProcess.on('close', resolve);
      });
    }
  });
  
  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  
  afterEach(async () => {
    await context.close();
  });

  describe('Dashboard Navigation', () => {
    test('should load dashboard homepage', async () => {
      await page.goto(SERVER_URL);
      
      // Check page title
      const title = await page.title();
      expect(title).toContain('Langfuse Key Manager');
      
      // Check main elements
      await expect(page.locator('h1')).toContainText('API Key Management');
      await expect(page.locator('[data-testid="key-list"]')).toBeVisible();
    });

    test('should navigate between sections', async () => {
      await page.goto(SERVER_URL);
      
      // Navigate to validation section
      await page.click('[data-testid="nav-validation"]');
      await expect(page.locator('h2')).toContainText('Key Validation');
      
      // Navigate to monitoring section
      await page.click('[data-testid="nav-monitoring"]');
      await expect(page.locator('h2')).toContainText('Key Monitoring');
      
      // Navigate back to keys
      await page.click('[data-testid="nav-keys"]');
      await expect(page.locator('h2')).toContainText('API Keys');
    });
  });

  describe('Key Management UI', () => {
    test('should create new key', async () => {
      await page.goto(SERVER_URL);
      
      // Click create button
      await page.click('[data-testid="create-key-btn"]');
      
      // Fill form
      await page.fill('[data-testid="key-id-input"]', 'ui-test-key');
      await page.click('[data-testid="generate-btn"]');
      
      // Wait for key generation
      await page.waitForSelector('[data-testid="key-generated-alert"]');
      
      // Verify key appears in list
      await expect(page.locator('[data-testid="key-item-ui-test-key"]')).toBeVisible();
      
      // Check key details
      const publicKey = await page.locator('[data-testid="public-key-ui-test-key"]').textContent();
      expect(publicKey).toMatch(/^pk-lf-[a-f0-9]+$/);
    });

    test('should validate existing key', async () => {
      await page.goto(SERVER_URL);
      
      // Create a key first
      await page.click('[data-testid="create-key-btn"]');
      await page.fill('[data-testid="key-id-input"]', 'validate-test');
      await page.click('[data-testid="generate-btn"]');
      await page.waitForSelector('[data-testid="key-generated-alert"]');
      
      // Click validate button
      await page.click('[data-testid="validate-btn-validate-test"]');
      
      // Wait for validation result
      await page.waitForSelector('[data-testid="validation-result"]');
      
      // Check validation details
      const score = await page.locator('[data-testid="validation-score"]').textContent();
      expect(parseInt(score)).toBeGreaterThan(0);
      
      const status = await page.locator('[data-testid="validation-status"]').textContent();
      expect(status).toBe('Valid');
    });

    test('should rotate key', async () => {
      await page.goto(SERVER_URL);
      
      // Create a key
      await page.click('[data-testid="create-key-btn"]');
      await page.fill('[data-testid="key-id-input"]', 'rotate-test');
      await page.click('[data-testid="generate-btn"]');
      await page.waitForSelector('[data-testid="key-generated-alert"]');
      
      // Get original public key
      const originalKey = await page.locator('[data-testid="public-key-rotate-test"]').textContent();
      
      // Click rotate button
      await page.click('[data-testid="rotate-btn-rotate-test"]');
      
      // Confirm rotation
      await page.click('[data-testid="confirm-rotate-btn"]');
      
      // Wait for rotation to complete
      await page.waitForSelector('[data-testid="rotation-success-alert"]');
      
      // Verify key changed
      const newKey = await page.locator('[data-testid="public-key-rotate-test"]').textContent();
      expect(newKey).not.toBe(originalKey);
      
      // Check rotation count
      const rotationCount = await page.locator('[data-testid="rotation-count-rotate-test"]').textContent();
      expect(rotationCount).toBe('1');
    });

    test('should delete key', async () => {
      await page.goto(SERVER_URL);
      
      // Create a key
      await page.click('[data-testid="create-key-btn"]');
      await page.fill('[data-testid="key-id-input"]', 'delete-test');
      await page.click('[data-testid="generate-btn"]');
      await page.waitForSelector('[data-testid="key-generated-alert"]');
      
      // Click delete button
      await page.click('[data-testid="delete-btn-delete-test"]');
      
      // Confirm deletion
      await page.click('[data-testid="confirm-delete-btn"]');
      
      // Wait for deletion
      await page.waitForSelector('[data-testid="deletion-success-alert"]');
      
      // Verify key is gone
      await expect(page.locator('[data-testid="key-item-delete-test"]')).not.toBeVisible();
    });
  });

  describe('Real-time Monitoring', () => {
    test('should display real-time key health', async () => {
      await page.goto(`${SERVER_URL}/monitoring`);
      
      // Create test keys
      await page.goto(SERVER_URL);
      await page.click('[data-testid="create-key-btn"]');
      await page.fill('[data-testid="key-id-input"]', 'monitor-test');
      await page.click('[data-testid="generate-btn"]');
      await page.waitForSelector('[data-testid="key-generated-alert"]');
      
      // Go back to monitoring
      await page.goto(`${SERVER_URL}/monitoring`);
      
      // Check health indicators
      await expect(page.locator('[data-testid="total-keys-count"]')).toHaveText('1');
      await expect(page.locator('[data-testid="healthy-keys-count"]')).toBeVisible();
      
      // Check real-time updates
      await page.waitForTimeout(2000); // Wait for health check
      
      const healthStatus = await page.locator('[data-testid="key-health-monitor-test"]').textContent();
      expect(['Healthy', 'Warning', 'Critical']).toContain(healthStatus);
    });

    test('should show performance metrics', async () => {
      await page.goto(`${SERVER_URL}/monitoring`);
      
      // Check metric displays
      await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-requests"]')).toBeVisible();
      
      // Verify chart rendering
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
    });

    test('should display alerts', async () => {
      await page.goto(`${SERVER_URL}/monitoring`);
      
      // Trigger an alert condition (simulated)
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('key-health-alert', {
          detail: {
            keyId: 'test-key',
            status: 'critical',
            message: 'Key validation failed'
          }
        }));
      });
      
      // Check alert appears
      await expect(page.locator('[data-testid="alert-critical"]')).toBeVisible();
      await expect(page.locator('[data-testid="alert-message"]')).toContainText('Key validation failed');
    });
  });

  describe('Key Validation UI', () => {
    test('should validate manual key input', async () => {
      await page.goto(`${SERVER_URL}/validation`);
      
      // Enter keys manually
      await page.fill('[data-testid="manual-public-key"]', 'pk-lf-test123');
      await page.fill('[data-testid="manual-secret-key"]', 'sk-lf-test123');
      
      // Click validate
      await page.click('[data-testid="validate-manual-btn"]');
      
      // Wait for result
      await page.waitForSelector('[data-testid="manual-validation-result"]');
      
      // Check result display
      const formatCheck = await page.locator('[data-testid="format-check"]').textContent();
      expect(['✓', '✗']).toContain(formatCheck);
    });

    test('should show validation recommendations', async () => {
      await page.goto(`${SERVER_URL}/validation`);
      
      // Enter weak keys
      await page.fill('[data-testid="manual-public-key"]', 'pk-aaaaaaaa');
      await page.fill('[data-testid="manual-secret-key"]', 'sk-bbbbbbbb');
      
      // Validate
      await page.click('[data-testid="validate-manual-btn"]');
      
      // Check recommendations appear
      await page.waitForSelector('[data-testid="validation-recommendations"]');
      
      const recommendations = await page.locator('[data-testid="recommendation-item"]').count();
      expect(recommendations).toBeGreaterThan(0);
    });
  });

  describe('Settings and Configuration', () => {
    test('should update auto-rotation settings', async () => {
      await page.goto(`${SERVER_URL}/settings`);
      
      // Toggle auto-rotation
      await page.click('[data-testid="auto-rotation-toggle"]');
      
      // Set rotation interval
      await page.selectOption('[data-testid="rotation-interval-select"]', '7days');
      
      // Save settings
      await page.click('[data-testid="save-settings-btn"]');
      
      // Verify success message
      await expect(page.locator('[data-testid="settings-saved-alert"]')).toBeVisible();
      
      // Reload and verify persistence
      await page.reload();
      
      const toggleState = await page.locator('[data-testid="auto-rotation-toggle"]').isChecked();
      expect(toggleState).toBe(true);
      
      const intervalValue = await page.locator('[data-testid="rotation-interval-select"]').inputValue();
      expect(intervalValue).toBe('7days');
    });

    test('should configure alert thresholds', async () => {
      await page.goto(`${SERVER_URL}/settings`);
      
      // Set health threshold
      await page.fill('[data-testid="health-threshold-input"]', '75');
      
      // Set failure threshold
      await page.fill('[data-testid="failure-threshold-input"]', '5');
      
      // Save
      await page.click('[data-testid="save-settings-btn"]');
      
      await expect(page.locator('[data-testid="settings-saved-alert"]')).toBeVisible();
    });
  });

  describe('Data Export/Import', () => {
    test('should export keys', async () => {
      await page.goto(SERVER_URL);
      
      // Create test key
      await page.click('[data-testid="create-key-btn"]');
      await page.fill('[data-testid="key-id-input"]', 'export-test');
      await page.click('[data-testid="generate-btn"]');
      await page.waitForSelector('[data-testid="key-generated-alert"]');
      
      // Export keys
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-keys-btn"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toContain('langfuse-keys');
      expect(download.suggestedFilename()).toContain('.json');
    });

    test('should import keys', async () => {
      await page.goto(SERVER_URL);
      
      // Prepare import data
      const importData = {
        keys: [{
          id: 'imported-key',
          publicKey: 'pk-lf-imported',
          secretKey: 'sk-lf-imported',
          createdAt: Date.now()
        }]
      };
      
      // Create file input and upload
      await page.setInputFiles('[data-testid="import-file-input"]', {
        name: 'import.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(importData))
      });
      
      // Click import
      await page.click('[data-testid="import-keys-btn"]');
      
      // Verify import success
      await expect(page.locator('[data-testid="import-success-alert"]')).toBeVisible();
      
      // Check imported key appears
      await expect(page.locator('[data-testid="key-item-imported-key"]')).toBeVisible();
    });
  });

  describe('Responsive Design', () => {
    test('should work on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(SERVER_URL);
      
      // Check mobile menu
      await expect(page.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-btn"]');
      
      // Check navigation items
      await expect(page.locator('[data-testid="mobile-nav-keys"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-nav-monitoring"]')).toBeVisible();
    });

    test('should handle tablet viewport', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(SERVER_URL);
      
      // Check layout adjustments
      await expect(page.locator('[data-testid="key-list"]')).toBeVisible();
      
      // Verify responsive grid
      const keyItems = await page.locator('[data-testid^="key-item-"]').count();
      if (keyItems > 0) {
        const firstItem = page.locator('[data-testid^="key-item-"]').first();
        const box = await firstItem.boundingBox();
        expect(box.width).toBeGreaterThan(300);
      }
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      await page.goto(SERVER_URL);
      
      // Check main navigation
      const navRole = await page.locator('nav').getAttribute('role');
      expect(navRole).toBe('navigation');
      
      // Check buttons have labels
      const createBtn = page.locator('[data-testid="create-key-btn"]');
      const ariaLabel = await createBtn.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('should be keyboard navigable', async () => {
      await page.goto(SERVER_URL);
      
      // Tab through interface
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Check focus is visible
      const focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(focusedElement).toBeTruthy();
      
      // Test keyboard activation
      await page.keyboard.press('Enter');
      // Should trigger action on focused element
    });
  });
});