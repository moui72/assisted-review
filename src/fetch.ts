// Fetch PR/MR diff + metadata via the `gh` (GitHub) or `glab` (GitLab) CLI,
// then parse the diff into grouped hunks (pure TS — see parse-diff.ts).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PrMeta, PrRef } from './types.js';

const execFileAsync = promisify(execFile);

// ---- GitHub ----------------------------------------------------------------

function ghTarget({ owner, repo, number }: PrRef): { repo: string; number: string } {
  return { repo: `${owner}/${repo}`, number: String(number) };
}

async function fetchGitHubDiff(ref: PrRef): Promise<string> {
  const { repo, number } = ghTarget(ref);
  const { stdout } = await execFileAsync('gh', ['pr', 'diff', number, '--repo', repo], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

interface GhPrView {
  title: string;
  author?: { login?: string };
  baseRefName: string;
  headRefName: string;
  isDraft: boolean;
  url: string;
  headRefOid: string;
  body: string;
}

async function fetchGitHubMeta(ref: PrRef): Promise<PrMeta> {
  const { repo, number } = ghTarget(ref);
  const fields = [
    'title',
    'author',
    'baseRefName',
    'headRefName',
    'isDraft',
    'url',
    'headRefOid',
    'body',
  ].join(',');
  const { stdout } = await execFileAsync(
    'gh',
    ['pr', 'view', number, '--repo', repo, '--json', fields],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const raw = JSON.parse(stdout) as GhPrView;
  return {
    title: raw.title,
    author: raw.author?.login ?? 'unknown',
    base_ref: raw.baseRefName,
    head_ref: raw.headRefName,
    is_draft: raw.isDraft,
    url: raw.url,
    head_sha: raw.headRefOid,
    body: raw.body ?? '',
  };
}

// ---- GitLab ----------------------------------------------------------------

function glabTarget({ owner, repo, number }: PrRef): { repo: string; number: string } {
  return { repo: `${owner}/${repo}`, number: String(number) };
}

async function fetchGitLabDiff(ref: PrRef): Promise<string> {
  const { repo, number } = glabTarget(ref);
  const { stdout } = await execFileAsync(
    'glab',
    ['mr', 'diff', number, '--repo', repo],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

interface GlabMrView {
  title: string;
  author?: { username?: string };
  target_branch: string;
  source_branch: string;
  draft?: boolean;
  work_in_progress?: boolean;
  web_url: string;
  sha: string;
  description: string;
}

async function fetchGitLabMeta(ref: PrRef): Promise<PrMeta> {
  const { repo, number } = glabTarget(ref);
  const { stdout } = await execFileAsync(
    'glab',
    ['mr', 'view', number, '--repo', repo, '--output', 'json'],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const raw = JSON.parse(stdout) as GlabMrView;
  return {
    title: raw.title,
    author: raw.author?.username ?? 'unknown',
    base_ref: raw.target_branch,
    head_ref: raw.source_branch,
    is_draft: raw.draft === true || raw.work_in_progress === true,
    url: raw.web_url,
    head_sha: raw.sha,
    body: raw.description ?? '',
  };
}

// ---- Dispatchers -----------------------------------------------------------

export async function fetchDiff(ref: PrRef): Promise<string> {
  return ref.platform === 'gitlab' ? fetchGitLabDiff(ref) : fetchGitHubDiff(ref);
}

export async function fetchMeta(ref: PrRef): Promise<PrMeta> {
  return ref.platform === 'gitlab' ? fetchGitLabMeta(ref) : fetchGitHubMeta(ref);
}
