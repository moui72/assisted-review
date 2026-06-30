// Browser-entered GitLab PAT storage.
//
// Resolution order: browser-stored token → GITLAB_TOKEN env var → GitLabAuthError.
// The browser token is persisted to STATE_DIR/gitlab-token (mode 0o600) so it
// survives server restarts. Call loadGitLabToken() once at startup.

import { join } from 'node:path';
import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { STATE_DIR } from './state.js';

const TOKEN_PATH = join(STATE_DIR, 'gitlab-token');

/** Thrown when no token is available (neither browser-stored nor env var). */
export class GitLabAuthError extends Error {
  readonly type = 'gitlab_auth_required' as const;
}

let _browserToken: string | undefined;

/** Returns the active token: browser-stored first, then GITLAB_TOKEN env var. */
export function getGitLabToken(): string | undefined {
  return _browserToken ?? process.env.GITLAB_TOKEN ?? undefined;
}

/** Reports the source of the active token without exposing its value. */
export function gitLabTokenSource(): 'browser' | 'env' | null {
  if (_browserToken) return 'browser';
  if (process.env.GITLAB_TOKEN) return 'env';
  return null;
}

/** Store a browser-entered token in memory and persist it to disk (0o600). */
export async function setGitLabToken(token: string): Promise<void> {
  _browserToken = token;
  await mkdir(STATE_DIR, { recursive: true });
  const tmp = `${TOKEN_PATH}.tmp`;
  await writeFile(tmp, token, { mode: 0o600 });
  await rename(tmp, TOKEN_PATH);
}

/** Clear the browser-stored token from memory and disk. */
export async function clearGitLabToken(): Promise<void> {
  _browserToken = undefined;
  await unlink(TOKEN_PATH).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== 'ENOENT') throw err;
  });
}

/** Load a previously persisted token from disk into memory. Call once at startup. */
export async function loadGitLabToken(): Promise<void> {
  try {
    _browserToken = (await readFile(TOKEN_PATH, 'utf8')).trim() || undefined;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

/** Override the in-memory token — for tests only. */
export function _setBrowserToken(v: string | undefined): void {
  _browserToken = v;
}
