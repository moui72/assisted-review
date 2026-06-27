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

export function gitlabHost(): string {
  const h = process.env.GITLAB_HOST ?? 'gitlab.com';
  return h.startsWith('http://') || h.startsWith('https://') ? new URL(h).host : h;
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

export function spawnGlab(args: string[], input?: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('glab', args, { stdio: ['pipe', 'pipe', 'pipe'] });
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

function requireToken(): string {
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error(
      'GitLab REST fallback requires GITLAB_TOKEN — set it in your environment (or install glab)',
    );
  }
  return token;
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
    throw new Error(`GitLab API ${path}: ${res.status} ${res.statusText} — ${text}`);
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
  if (await glabAvailable()) {
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
  if (await glabAvailable()) {
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
