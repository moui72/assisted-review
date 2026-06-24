import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4320',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'ASSISTED_REVIEW_STATE_DIR=/tmp/ar-e2e node build/cli.js --no-open --port 4320',
    url: 'http://127.0.0.1:4320',
    reuseExistingServer: !process.env.CI,
  },
});
