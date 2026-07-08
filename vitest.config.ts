import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup-env.ts', './tests/setup-components.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'web/src/**/*.{ts,tsx}'],
      exclude: [
        'src/cli.ts',
        'src/setup-jira.ts',
        'src/env.ts',
        'web/src/main.tsx',
        'web/src/preload.ts',
        'web/src/index.css',
      ],
      thresholds: {
        // Backend code is mature — enforce 90%.
        'src/**/*.ts': { statements: 90, lines: 90 },
        // Frontend tests are new; measure but don't gate yet.
      },
    },
  },
});
