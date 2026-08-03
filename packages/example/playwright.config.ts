import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against the built example app. Playwright builds + serves the app itself
 * (vite preview) so the test runs against the real published bundle wiring.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:5178',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:5178',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
