import { defineConfig, devices } from '@playwright/test'
import baseline from './playwright.baseline.config'

export default defineConfig({
  ...baseline,
  testDir: './scripts/playwright-catalog',
  timeout: 420_000,
  outputDir: 'test-results/r2-catalog',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } } }],
})
