import { rm } from 'node:fs/promises';

export default async function globalSetup() {
  await rm('/tmp/ar-e2e', { recursive: true, force: true });
  // Clear in-memory state if a server from a prior run is still up.
  await fetch('http://127.0.0.1:4320/api/review', { method: 'DELETE' }).catch(() => {});
}
