// Shared GitLab transport: glab CLI (primary) with REST API fallback.
//
// glabAvailable() detects whether glab is installed once per process, caching
// the result. _setGlabAvailable() lets tests bypass the detection entirely.
//
// glabApiJson / glabApiPaginatedJson are the unified transports used by
// submit.ts. When glab is available they delegate to `glab api <path>`;
// otherwise they hit https://{GITLAB_HOST}/api/v4/<path> using GITLAB_TOKEN.

import { spawn } from 'node:child_process';
import type { PrRef } from './types.js';
import { getGitLabToken, gitLabTokenSource, GitLabAuthError } from './gitlab-token.js';

let _glabAvailable: boolean | undefined;

/** Override the cached detection result — use in tests only. */
export function _setGlabAvailable(v: boolean | undefined): void {
  _glabAvailable = v;
}

export async function glabAvailable(): Promise<boolean> {
  if (_glabAvailable !== undefined) return _glabAvailable;
  try {
    await spawnGlab(['--version']);
    _glabAvailable = true;
  } catch (err) {
    _glabAvailable = (err as NodeJS.ErrnoException).code !== 'ENOENT';
  }
  return _glabAvailable;
}

/**
 * Whether to use the `glab` CLI transport for this call. A browser-entered
 * token (an explicit, deliberate reviewer choice) outranks `glab` even when
 * it's installed and authenticated — otherwise falls back to glabAvailable().
 */
export async function shouldUseGlab(): Promise<boolean> {
  if (gitLabTokenSource() === 'browser') return false;
  return glabAvailable();
}

/** Full base URL for the GitLab API. Supports http:// when GITLAB_HOST starts with http://. */
export function gitlabBaseUrl(): string {
  const h = process.env.GITLAB_HOST ?? 'gitlab.com';
  if (h.startsWith('http://') || h.startsWith('https://')) return h.replace(/\/$/, '');
  return `https://${h}`;
}

export function glProjectId({ owner, repo }: Pick<PrRef, 'owner' | 'repo'>): string {
  return encodeURIComponent(`${owner}/${repo}`);
}

interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function spawnCli(bin: string, args: string[], input?: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d));
    child.stderr.on('data', (d: Buffer) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
    if (input != null) child.stdin.write(input);
    child.stdin.end();
  });
}

export function spawnGlab(args: string[], input?: string): Promise<SpawnResult> {
  return spawnCli('glab', args, input);
}

function requireToken(): string {
  const token = getGitLabToken();
  if (!token) {
    throw new GitLabAuthError(
      'GitLab REST requires a token — connect via the browser UI or set GITLAB_TOKEN',
    );
  }
  return token;
}

/**
 * Thrown by the REST fallback transport with a real HTTP `status` — the
 * `glab` CLI path has no structured status (only an exit code + stderr
 * text) and keeps throwing plain `Error`. `isRetryable()` treats that
 * absence as "can't rule out transient" rather than "definitely fatal".
 */
export class GitLabApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GitLabApiError';
    this.status = status;
  }
}

/** HTTP statuses a retry can never fix: bad request, missing/invalid auth,
 *  not found, validation failure. Everything else (429, 5xx, a
 *  `GitLabApiError` with no status, or any non-`GitLabApiError` — e.g. the
 *  `glab` CLI path) is treated as retryable, since retrying only costs
 *  latency and none of those can be confidently ruled out as transient. */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 422]);

export function isRetryable(err: unknown): boolean {
  if (err instanceof GitLabApiError && err.status !== undefined) {
    return !NON_RETRYABLE_STATUSES.has(err.status);
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries `fn` up to `delaysMs.length` additional times (linear backoff
 * between attempts) as long as each failure is retryable per
 * `isRetryable()`. Stops immediately — no further attempts — the moment a
 * non-retryable error is thrown. Not a general backoff framework: this is
 * specifically scoped to GitLab submit's individual API calls.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  delaysMs: number[] = [50, 100, 150],
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === delaysMs.length) throw err;
      await sleep(delaysMs[attempt]);
    }
  }
  throw lastErr;
}

async function restFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = requireToken();
  const url = `${gitlabBaseUrl()}/api/v4/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'PRIVATE-TOKEN': token, ...init.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GitLabApiError(
      `GitLab API ${path}: ${res.status} ${res.statusText} — ${text}`,
      res.status,
    );
  }
  return res;
}

/**
 * Unified glab-or-REST transport for single-response GitLab API calls.
 * GET by default; pass method:'POST' with body for mutations.
 */
export async function glabApiJson<T>(
  path: string,
  options?: { method?: 'POST'; body?: unknown },
): Promise<T> {
  if (await shouldUseGlab()) {
    const args: string[] = ['api', path];
    if (options?.method) args.push('-X', options.method);
    if (options?.body !== undefined) args.push('--input', '-');
    const { code, stdout, stderr } = await spawnGlab(
      args,
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    );
    if (code !== 0) {
      throw new Error(`glab api ${path}: ${stderr.trim() || `exit code ${code}`}`);
    }
    return JSON.parse(stdout) as T;
  }

  const res = await restFetch(path, {
    method: options?.method ?? 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : {},
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return res.json() as Promise<T>;
}

/**
 * Paginated GET — returns all items across pages.
 * glab path: uses --paginate flag. REST path: follows x-next-page header.
 */
export async function glabApiPaginatedJson<T>(path: string): Promise<T[]> {
  if (await shouldUseGlab()) {
    const { code, stdout, stderr } = await spawnGlab(['api', '--paginate', path]);
    if (code !== 0) {
      throw new Error(`glab api ${path}: ${stderr.trim() || `exit code ${code}`}`);
    }
    return JSON.parse(stdout) as T[];
  }

  requireToken(); // validates token before looping
  const results: T[] = [];
  let page = 1;
  while (true) {
    const res = await restFetch(`${path}?per_page=100&page=${page}`);
    const data = await res.json() as T[];
    results.push(...data);
    const nextPage = res.headers.get('x-next-page');
    if (!nextPage) break;
    page = Number(nextPage);
  }
  return results;
}
