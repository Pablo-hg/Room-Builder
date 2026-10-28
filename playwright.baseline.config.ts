import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './scripts/playwright',
  timeout: 30_000,
  workers: 1,
  reporter: 'line',
  outputDir: 'test-results/r0-baseline',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1600, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
