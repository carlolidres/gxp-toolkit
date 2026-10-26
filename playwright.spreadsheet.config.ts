import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /spreadsheet-.*\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4177',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4177',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_BASE_PATH: './',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_SPREADSHEET_FIXTURE: 'true',
      VITE_ENABLE_CPV: 'true',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
