import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');

  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Clean up test data
    await cleanupTestData(page, baseURL);

    console.log('✅ Global teardown completed successfully');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here - we want other cleanup to continue
  } finally {
    await browser.close();
  }
}

async function cleanupTestData(page: any, baseURL: string) {
  console.log('Cleaning up test data...');

  try {
    // Clean up any test machines created during E2E tests
    await page.goto(baseURL + '/api/test-cleanup', {
      timeout: 10000,
      waitUntil: 'networkidle',
    });

    console.log('✅ Test data cleanup completed');

  } catch (error) {
    console.log('⚠️ Test data cleanup skipped (endpoint not available)');
    // This is okay - manual cleanup may be needed
  }

  // Additional cleanup can go here
  // - Database cleanup
  // - File system cleanup
  // - External service cleanup
}

export default globalTeardown;