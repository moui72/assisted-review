import { rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { startMockGitLabApi } from './mock-gitlab-api.js';

export default async function globalSetup(): Promise<() => Promise<void>> {
  await Promise.all([
    rm('/tmp/ar-e2e-github', { recursive: true, force: true }),
    rm('/tmp/ar-e2e-gitlab-glab', { recursive: true, force: true }),
    rm('/tmp/ar-e2e-gitlab-rest', { recursive: true, force: true }),
  ]);

  const mockServer: Server | null = await startMockGitLabApi();

  return async () => {
    await new Promise<void>((resolve) => {
      if (mockServer) mockServer.close(() => resolve());
      else resolve();
    });
  };
}
