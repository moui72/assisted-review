import { rm } from 'node:fs/promises';

export default async function globalSetup() {
  // Wipe state dir before each run so tests don't load submitted state from
  // a prior run (the server recreates the dir on first save).
  await rm('/tmp/ar-e2e', { recursive: true, force: true });
}
