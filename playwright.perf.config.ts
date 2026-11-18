import { defineConfig, devices } from '@playwright/test'

/**
 * Mediciones de rendimiento sobre la build de producción (`npm run build` antes). No sustituye a los E2E:
 * el modo desarrollo añade sobrecarga (StrictMode, sin minificar) y falsea los fotogramas.
 */
export default defineConfig({
  testDir: './scripts/playwright-profile',
  testMatch: /materials-perf\.spec\.ts/,
  timeout: 300_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } },
  }],
})
