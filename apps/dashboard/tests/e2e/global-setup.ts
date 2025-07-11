import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Health check: ensure the application is running
    console.log(`Checking if app is running at ${baseURL}...`);
    await page.goto(baseURL + '/api/health', { timeout: 30000 });
    
    const response = await page.textContent('body');
    if (!response || !response.includes('healthy')) {
      throw new Error('Application health check failed');
    }

    console.log('✅ Application is healthy and ready for testing');

    // Set up test data if needed
    await setupTestData(page, baseURL);

    console.log('✅ Global setup completed successfully');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function setupTestData(page: any, baseURL: string) {
  console.log('Setting up test data...');

  // Create test machines for E2E tests
  try {
    await page.goto(baseURL + '/api/test-setup', {
      timeout: 10000,
      waitUntil: 'networkidle',
    });

    // You could also seed the database with test data here
    console.log('✅ Test data setup completed');

  } catch (error) {
    console.log('⚠️ Test data setup skipped (endpoint not available)');
    // This is okay - the tests will work with mocked data
  }
}

export default globalSetup;