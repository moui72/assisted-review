// Fetch PR/MR diff + metadata via the `gh` (GitHub) or `glab` (GitLab) CLI,
// then parse the diff into grouped hunks (pure TS — see parse-diff.ts).
//
// GitLab: prefers glab CLI; falls back to GitLab REST API when glab is not
// installed (requires GITLAB_TOKEN env var; GITLAB_HOST for self-hosted).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PrMeta, PrRef } from './types.js';
import { glabAvailable, glProjectId, gitlabBaseUrl } from './gitlab-rest.js';

const execFileAsync = promisify(execFile);

// ---- GitHub ----------------------------------------------------------------

function cliTarget({ owner, repo, number }: PrRef): { repo: string; number: string } {
  return { repo: `${owner}/${repo}`, number: String(number) };
}

async function fetchGitHubDiff(ref: PrRef): Promise<string> {
  const { repo, number } = cliTarget(ref);
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
  const { repo, number } = cliTarget(ref);
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

function mapGlabMrView(raw: GlabMrView): PrMeta {
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

interface GitLabDiffFile {
  old_path: string;
  new_path: string;
  diff: string;
  new_file: boolean;
  deleted_file: boolean;
}

async function fetchGitLabDiffREST(ref: PrRef): Promise<string> {
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error(
      'GitLab REST fallback requires GITLAB_TOKEN — set it in your environment (or install glab)',
    );
  }
  const projectId = glProjectId(ref);
  const files: GitLabDiffFile[] = [];
  let page = 1;
  while (true) {
    const url = `${gitlabBaseUrl()}/api/v4/projects/${projectId}/merge_requests/${ref.number}/diffs?per_page=100&page=${page}`;
    const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab API diffs: ${res.status} ${res.statusText} — ${text}`);
    }
    const pageFiles = await res.json() as GitLabDiffFile[];
    files.push(...pageFiles);
    const nextPage = res.headers.get('x-next-page');
    if (!nextPage) break;
    page = Number(nextPage);
  }
  // Reconstruct a unified diff that parse-diff.ts can consume.
  // Each file's `diff` field contains raw hunk lines starting at @@.
  return files
    .filter((f) => f.diff)
    .map((f) => {
      const oldPath = f.new_file ? '/dev/null' : `a/${f.old_path}`;
      const newPath = f.deleted_file ? '/dev/null' : `b/${f.new_path}`;
      return `--- ${oldPath}\n+++ ${newPath}\n${f.diff}`;
    })
    .join('\n');
}

async function fetchGitLabMetaREST(ref: PrRef): Promise<PrMeta> {
  const token = process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error(
      'GitLab REST fallback requires GITLAB_TOKEN — set it in your environment (or install glab)',
    );
  }
  const url = `${gitlabBaseUrl()}/api/v4/projects/${glProjectId(ref)}/merge_requests/${ref.number}`;
  const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab API MR: ${res.status} ${res.statusText} — ${text}`);
  }
  const raw = await res.json() as GlabMrView;
  return mapGlabMrView(raw);
}

async function fetchGitLabDiff(ref: PrRef): Promise<string> {
  if (!await glabAvailable()) return fetchGitLabDiffREST(ref);
  const { repo, number } = cliTarget(ref);
  const { stdout } = await execFileAsync(
    'glab',
    ['mr', 'diff', number, '--repo', repo],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

async function fetchGitLabMeta(ref: PrRef): Promise<PrMeta> {
  if (!await glabAvailable()) return fetchGitLabMetaREST(ref);
  const { repo, number } = cliTarget(ref);
  const { stdout } = await execFileAsync(
    'glab',
    ['mr', 'view', number, '--repo', repo, '--output', 'json'],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const raw = JSON.parse(stdout) as GlabMrView;
  return mapGlabMrView(raw);
}

// ---- Dispatchers -----------------------------------------------------------

export async function fetchDiff(ref: PrRef): Promise<string> {
  return ref.platform === 'gitlab' ? fetchGitLabDiff(ref) : fetchGitHubDiff(ref);
}

export async function fetchMeta(ref: PrRef): Promise<PrMeta> {
  return ref.platform === 'gitlab' ? fetchGitLabMeta(ref) : fetchGitHubMeta(ref);
}
