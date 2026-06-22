import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup-env.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'web/src/diff.ts', 'web/src/highlight.ts'],
      exclude: ['src/cli.ts', 'src/setup-jira.ts', 'src/env.ts'],
      thresholds: {
        statements: 90,
        lines: 90,
      },
    },
  },
});
