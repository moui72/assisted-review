import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const stubsDir = resolve('tests/e2e/stubs');
const restStubsDir = resolve('tests/e2e/stubs-rest');
const node = process.execPath;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // Each project gets its own server; run all three in parallel.
  workers: 3,
  projects: [
    {
      name: 'github',
      testMatch: '**/e2e/github.test.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4320' },
    },
    {
      name: 'gitlab-glab',
      testMatch: '**/e2e/gitlab-glab.test.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4321' },
    },
    {
      name: 'gitlab-rest',
      testMatch: '**/e2e/gitlab-rest.test.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4322' },
    },
  ],
  webServer: [
    {
      command: `PATH="${stubsDir}:$PATH" "${node}" build/cli.js --no-open --port 4320`,
      url: 'http://127.0.0.1:4320',
      env: { ASSISTED_REVIEW_STATE_DIR: '/tmp/ar-e2e-github' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `PATH="${stubsDir}:$PATH" "${node}" build/cli.js --no-open --port 4321`,
      url: 'http://127.0.0.1:4321',
      env: { ASSISTED_REVIEW_STATE_DIR: '/tmp/ar-e2e-gitlab-glab' },
      reuseExistingServer: !process.env.CI,
    },
    {
      // Restricted PATH: only restStubsDir (no glab) → glabAvailable() returns false → REST path.
      command: `PATH="${restStubsDir}" "${node}" build/cli.js --no-open --port 4322`,
      url: 'http://127.0.0.1:4322',
      env: {
        ASSISTED_REVIEW_STATE_DIR: '/tmp/ar-e2e-gitlab-rest',
        GITLAB_HOST: 'http://127.0.0.1:4330',
        GITLAB_TOKEN: 'e2e-test-token',
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
