import { test, expect, Page } from '@playwright/test';

test.describe('Swarm Management E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Set up test environment
    await page.goto('/');
    
    // Mock API responses for consistent testing
    await page.route('**/api/machines', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          json: [
            {
              id: 'vm-e2e-001',
              name: 'e2e-test-machine-1',
              state: 'started',
              region: 'iad',
              config: {
                image: 'nginx:latest',
                guest: { cpus: 1, memory_mb: 256 },
              },
            },
            {
              id: 'vm-e2e-002',
              name: 'e2e-test-machine-2',
              state: 'stopped',
              region: 'lax',
              config: {
                image: 'nginx:latest',
                guest: { cpus: 2, memory_mb: 512 },
              },
            },
          ],
        });
      }
    });

    await page.route('**/api/swarm-status', async (route) => {
      await route.fulfill({
        json: {
          totalMachines: 2,
          activeMachines: 1,
          status: 'healthy',
          metrics: {
            cpu: 25.5,
            memory: 45.2,
            uptime: 99.9,
          },
        },
      });
    });
  });

  test('displays swarm overview correctly', async () => {
    await expect(page.locator('h1')).toContainText('Hive Mind Dashboard');
    
    // Check if swarm metrics are displayed
    await expect(page.locator('[data-testid="total-machines"]')).toContainText('2');
    await expect(page.locator('[data-testid="active-machines"]')).toContainText('1');
    await expect(page.locator('[data-testid="swarm-status"]')).toContainText('healthy');
  });

  test('navigates to machines page', async () => {
    await page.click('[data-testid="machines-nav"]');
    await expect(page).toHaveURL(/.*\/machines/);
    
    // Wait for machines to load
    await expect(page.locator('[data-testid="machine-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="machine-item"]')).toHaveCount(2);
  });

  test('creates a new machine through UI', async () => {
    // Mock machine creation API
    await page.route('**/api/machines', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          json: {
            id: 'vm-e2e-new',
            name: 'new-e2e-machine',
            state: 'creating',
            region: 'iad',
          },
        });
      }
    });

    await page.goto('/machines');
    
    // Click create machine button
    await page.click('[data-testid="create-machine-btn"]');
    
    // Fill out the form
    await page.fill('[data-testid="machine-name-input"]', 'e2e-test-machine');
    await page.selectOption('[data-testid="region-select"]', 'iad');
    await page.selectOption('[data-testid="image-select"]', 'nginx:latest');
    await page.selectOption('[data-testid="cpu-select"]', '1');
    await page.selectOption('[data-testid="memory-select"]', '256');
    
    // Submit the form
    await page.click('[data-testid="create-machine-submit"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Machine created successfully');
  });

  test('scales swarm up and down', async () => {
    let currentCount = 2;
    
    // Mock scaling API
    await page.route('**/api/swarms/*/scale', async (route) => {
      const requestBody = await route.request().postData();
      const { targetCount } = JSON.parse(requestBody || '{}');
      currentCount = targetCount;
      
      await route.fulfill({
        json: {
          success: true,
          totalMachines: targetCount,
          created: targetCount > 2 ? targetCount - 2 : 0,
          deleted: targetCount < 2 ? 2 - targetCount : 0,
        },
      });
    });

    await page.goto('/machines');
    
    // Scale up
    await page.click('[data-testid="scale-controls"]');
    await page.fill('[data-testid="target-count-input"]', '5');
    await page.click('[data-testid="scale-up-btn"]');
    
    await expect(page.locator('[data-testid="scaling-success"]')).toContainText('Scaled to 5 machines');
    
    // Scale down
    await page.fill('[data-testid="target-count-input"]', '1');
    await page.click('[data-testid="scale-down-btn"]');
    
    await expect(page.locator('[data-testid="scaling-success"]')).toContainText('Scaled to 1 machine');
  });

  test('starts and stops machines', async () => {
    // Mock machine control APIs
    await page.route('**/api/swarms/*/start', async (route) => {
      await route.fulfill({
        json: { status: 'starting' },
      });
    });

    await page.route('**/api/swarms/*/stop', async (route) => {
      await route.fulfill({
        json: { status: 'stopping' },
      });
    });

    await page.goto('/machines');
    
    // Find a stopped machine and start it
    const stoppedMachine = page.locator('[data-testid="machine-item"]').filter({ hasText: 'stopped' });
    await stoppedMachine.locator('[data-testid="start-machine-btn"]').click();
    
    await expect(page.locator('[data-testid="machine-status"]')).toContainText('starting');
    
    // Find a started machine and stop it
    const startedMachine = page.locator('[data-testid="machine-item"]').filter({ hasText: 'started' });
    await startedMachine.locator('[data-testid="stop-machine-btn"]').click();
    
    await expect(page.locator('[data-testid="machine-status"]')).toContainText('stopping');
  });

  test('deletes a machine with confirmation', async () => {
    // Mock machine deletion API
    await page.route('**/api/machines/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 204,
          body: '',
        });
      }
    });

    await page.goto('/machines');
    
    // Click delete button on first machine
    const firstMachine = page.locator('[data-testid="machine-item"]').first();
    await firstMachine.locator('[data-testid="delete-machine-btn"]').click();
    
    // Confirm deletion in modal
    await expect(page.locator('[data-testid="delete-confirmation-modal"]')).toBeVisible();
    await page.click('[data-testid="confirm-delete-btn"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="deletion-success"]')).toContainText('Machine deleted successfully');
  });

  test('displays real-time metrics', async () => {
    // Mock real-time metrics API
    await page.route('**/api/swarm-status', async (route) => {
      await route.fulfill({
        json: {
          totalMachines: 2,
          activeMachines: 1,
          status: 'healthy',
          metrics: {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            uptime: 99.9,
            networkIn: Math.random() * 1000,
            networkOut: Math.random() * 1000,
          },
          lastUpdated: new Date().toISOString(),
        },
      });
    });

    await page.goto('/');
    
    // Check if metrics are displayed
    await expect(page.locator('[data-testid="cpu-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="uptime-metric"]')).toBeVisible();
    
    // Wait for auto-refresh (metrics should update)
    await page.waitForTimeout(5000);
    
    // Verify metrics are still visible (indicating successful refresh)
    await expect(page.locator('[data-testid="cpu-metric"]')).toBeVisible();
  });

  test('handles error states gracefully', async () => {
    // Mock API error
    await page.route('**/api/machines', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal server error' },
      });
    });

    await page.goto('/machines');
    
    // Should display error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load machines');
    
    // Should show retry button
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
  });

  test('searches and filters machines', async () => {
    await page.goto('/machines');
    
    // Wait for machines to load
    await expect(page.locator('[data-testid="machine-list"]')).toBeVisible();
    
    // Search for specific machine
    await page.fill('[data-testid="machine-search"]', 'e2e-test-machine-1');
    
    // Should show only matching machine
    await expect(page.locator('[data-testid="machine-item"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="machine-item"]')).toContainText('e2e-test-machine-1');
    
    // Clear search
    await page.fill('[data-testid="machine-search"]', '');
    
    // Should show all machines again
    await expect(page.locator('[data-testid="machine-item"]')).toHaveCount(2);
    
    // Filter by region
    await page.selectOption('[data-testid="region-filter"]', 'iad');
    
    // Should show only iad machines
    await expect(page.locator('[data-testid="machine-item"]')).toHaveCount(1);
  });

  test('responsive design works on mobile', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Check if mobile navigation works
    await page.click('[data-testid="mobile-menu-btn"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Navigate to machines page via mobile menu
    await page.click('[data-testid="mobile-machines-link"]');
    await expect(page).toHaveURL(/.*\/machines/);
    
    // Check if machine cards stack properly on mobile
    const machineItems = page.locator('[data-testid="machine-item"]');
    await expect(machineItems.first()).toBeVisible();
  });

  test('dark mode toggle works', async () => {
    await page.goto('/');
    
    // Check default theme
    await expect(page.locator('html')).not.toHaveClass(/.*dark.*/);
    
    // Toggle to dark mode
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('html')).toHaveClass(/.*dark.*/);
    
    // Toggle back to light mode
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('html')).not.toHaveClass(/.*dark.*/);
  });

  test('handles offline state', async () => {
    await page.goto('/');
    
    // Simulate offline
    await page.context().setOffline(true);
    
    // Try to navigate to machines page
    await page.click('[data-testid="machines-nav"]');
    
    // Should show offline message
    await expect(page.locator('[data-testid="offline-message"]')).toContainText('You are currently offline');
    
    // Restore online
    await page.context().setOffline(false);
    
    // Should hide offline message
    await expect(page.locator('[data-testid="offline-message"]')).not.toBeVisible();
  });
});