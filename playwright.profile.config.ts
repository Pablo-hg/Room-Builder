import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testDir: './scripts/playwright-profile',
  timeout: 60_000,
  workers: 1,
})
