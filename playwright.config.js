// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* Maximum time one test can run for */
  timeout: 30 * 1000,
  /* Fail the build on CI if there are test failures */
  forbidOnly: !!process.env.CI,
  /* Retry failed tests on CI */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: 'html',
  
  /* Shared settings for all projects */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying failed tests */
    trace: 'on-first-retry',
    
    /* Take screenshot on test failure */
    screenshot: 'only-on-failure',
    
    /* Default navigation timeout */
    navigationTimeout: 10000,
  },

  /* Configure projects for browser testing */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /* Uncomment to enable additional browsers if needed
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    */
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'test-results/',
});

