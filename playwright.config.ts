import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for SA Financial Planner UI flow documentation
 *
 * This configuration is optimized for documenting user flows and capturing
 * screenshots, not for E2E testing. Focus is on:
 * - Sequential execution for consistent screenshots
 * - Multiple viewport sizes (desktop, tablet, mobile)
 * - Automatic dev server startup
 * - Screenshot capture on every step
 */
export default defineConfig({
  testDir: './e2e/journeys',

  // Run tests sequentially for consistent screenshot numbering
  fullyParallel: false,
  workers: 1,

  // No retries - we're documenting, not testing reliability
  retries: 0,

  // Longer timeout for screenshot capture and chart rendering
  timeout: 60000,

  // Output directory for test artifacts
  outputDir: './e2e/output/test-results',

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    screenshot: 'on',
    trace: 'on',
    video: 'on',
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },

  // Multiple viewport configurations for responsive documentation
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 },
      },
    },
  ],

  // Development server configuration
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
