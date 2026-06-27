import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const stubsDir = resolve('tests/e2e/stubs');

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // Tests share a single server with one active-review slot — run serially.
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4320',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `PATH="${stubsDir}:$PATH" ASSISTED_REVIEW_STATE_DIR=/tmp/ar-e2e node build/cli.js --no-open --port 4320`,
    url: 'http://127.0.0.1:4320',
    reuseExistingServer: !process.env.CI,
  },
});
