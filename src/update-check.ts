// Non-blocking "a newer version is available" check. Fire-and-forget: never
// delays startup, never throws, and only hits the npm registry once per
// CHECK_INTERVAL_MS (cached in STATE_DIR) so normal usage doesn't spam it.

import { join } from 'node:path';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { STATE_DIR } from './state.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once/day
const REGISTRY_TIMEOUT_MS = 1500;
const CACHE_PATH = join(STATE_DIR, 'update-check.json');

interface UpdateCache {
  checked_at: string;
  latest_version: string;
}

function parseVersion(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8')) as UpdateCache;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  try {
    await mkdir(STATE_DIR, { recursive: true });
    const tmp = `${CACHE_PATH}.tmp`;
    await writeFile(tmp, JSON.stringify(cache));
    await rename(tmp, CACHE_PATH);
  } catch {
    // Non-essential; ignore failures (e.g. read-only filesystem).
  }
}

async function fetchLatestVersion(pkgName: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkgName}/latest`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Resolves to a message to print if the installed version is out of date,
// or null if up to date / check skipped / check failed. Callers should not
// await this before doing other startup work — kick it off and print the
// result (if any) once the server is already up.
export async function checkForUpdate(
  pkgName: string,
  currentVersion: string,
): Promise<string | null> {
  if (process.env.ASSISTED_REVIEW_NO_UPDATE_CHECK) return null;

  const cache = await readCache();
  let latest = cache?.latest_version;
  const stale =
    !cache || Date.now() - Date.parse(cache.checked_at) > CHECK_INTERVAL_MS;

  if (stale) {
    const fetched = await fetchLatestVersion(pkgName);
    if (fetched) {
      latest = fetched;
      await writeCache({ checked_at: new Date().toISOString(), latest_version: fetched });
    }
  }

  if (latest && isNewer(latest, currentVersion)) {
    return `Update available: ${currentVersion} → ${latest}  (npm i -g ${pkgName})`;
  }
  return null;
}
