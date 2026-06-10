// Fetch PR diff + metadata via the `gh` CLI, then parse the diff into
// grouped hunks (pure TS — see parse-diff.ts).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chunksFromDiff } from './parse-diff';
import type { Chunk, PrMeta, PrRef } from './types';

const execFileAsync = promisify(execFile);

function ghTarget({ owner, repo, number }: PrRef): { repo: string; number: string } {
  return { repo: `${owner}/${repo}`, number: String(number) };
}

export async function fetchDiff(ref: PrRef): Promise<string> {
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

export async function fetchMeta(ref: PrRef): Promise<PrMeta> {
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

export function parseChunks(diffText: string): Chunk[] {
  return chunksFromDiff(diffText);
}
