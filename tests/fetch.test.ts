import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

import { execFile } from 'node:child_process';
import { fetchDiff, fetchMeta } from '../src/fetch';
import type { PrRef } from '../src/types';

const ghRef: PrRef = { owner: 'alice', repo: 'proj', number: 42, platform: 'github' };
const glRef: PrRef = { owner: 'mygroup/subteam', repo: 'proj', number: 42, platform: 'gitlab' };

function succeed(stdout: string) {
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: null, r: { stdout: string; stderr: string }) => void;
    process.nextTick(() => cb(null, { stdout, stderr: '' }));
    return undefined as never;
  });
}

function fail(err: Error) {
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: Error) => void;
    process.nextTick(() => cb(err));
    return undefined as never;
  });
}

afterEach(() => vi.mocked(execFile).mockReset());

describe('fetchDiff — GitHub', () => {
  it('invokes gh pr diff with owner/repo and returns stdout', async () => {
    succeed('diff content');
    const result = await fetchDiff(ghRef);
    expect(result).toBe('diff content');
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'gh',
      ['pr', 'diff', '42', '--repo', 'alice/proj'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('rejects when gh fails', async () => {
    fail(new Error('gh: not found'));
    await expect(fetchDiff(ghRef)).rejects.toThrow('gh: not found');
  });
});

describe('fetchMeta — GitHub', () => {
  const ghView = {
    title: 'Add feature',
    author: { login: 'alice' },
    baseRefName: 'main',
    headRefName: 'feat/x',
    isDraft: false,
    url: 'https://github.com/alice/proj/pull/42',
    headRefOid: 'abc123',
    body: 'Description here',
  };

  it('maps gh pr view JSON to PrMeta shape', async () => {
    succeed(JSON.stringify(ghView));
    const meta = await fetchMeta(ghRef);
    expect(meta.title).toBe('Add feature');
    expect(meta.author).toBe('alice');
    expect(meta.base_ref).toBe('main');
    expect(meta.head_ref).toBe('feat/x');
    expect(meta.is_draft).toBe(false);
    expect(meta.url).toBe('https://github.com/alice/proj/pull/42');
    expect(meta.head_sha).toBe('abc123');
    expect(meta.body).toBe('Description here');
  });

  it('falls back to "unknown" when author.login is missing', async () => {
    succeed(JSON.stringify({ ...ghView, author: {} }));
    const meta = await fetchMeta(ghRef);
    expect(meta.author).toBe('unknown');
  });

  it('returns empty string body when body is null', async () => {
    succeed(JSON.stringify({ ...ghView, body: null }));
    const meta = await fetchMeta(ghRef);
    expect(meta.body).toBe('');
  });

  it('rejects when gh fails', async () => {
    fail(new Error('authentication required'));
    await expect(fetchMeta(ghRef)).rejects.toThrow('authentication required');
  });
});

describe('fetchDiff — GitLab', () => {
  it('invokes glab mr diff with owner/repo and returns stdout', async () => {
    succeed('diff content');
    const result = await fetchDiff(glRef);
    expect(result).toBe('diff content');
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'glab',
      ['mr', 'diff', '42', '--repo', 'mygroup/subteam/proj'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('rejects when glab fails', async () => {
    fail(new Error('glab: not found'));
    await expect(fetchDiff(glRef)).rejects.toThrow('glab: not found');
  });
});

describe('fetchMeta — GitLab', () => {
  const glabView = {
    title: 'Add feature',
    author: { username: 'alice' },
    target_branch: 'main',
    source_branch: 'feat/x',
    draft: false,
    web_url: 'https://gitlab.com/mygroup/subteam/proj/-/merge_requests/42',
    sha: 'abc123',
    description: 'Description here',
  };

  it('maps glab mr view JSON to PrMeta shape', async () => {
    succeed(JSON.stringify(glabView));
    const meta = await fetchMeta(glRef);
    expect(meta.title).toBe('Add feature');
    expect(meta.author).toBe('alice');
    expect(meta.base_ref).toBe('main');
    expect(meta.head_ref).toBe('feat/x');
    expect(meta.is_draft).toBe(false);
    expect(meta.url).toBe('https://gitlab.com/mygroup/subteam/proj/-/merge_requests/42');
    expect(meta.head_sha).toBe('abc123');
    expect(meta.body).toBe('Description here');
  });

  it('falls back to "unknown" when author.username is missing', async () => {
    succeed(JSON.stringify({ ...glabView, author: {} }));
    const meta = await fetchMeta(glRef);
    expect(meta.author).toBe('unknown');
  });

  it('treats work_in_progress as draft', async () => {
    succeed(JSON.stringify({ ...glabView, draft: false, work_in_progress: true }));
    const meta = await fetchMeta(glRef);
    expect(meta.is_draft).toBe(true);
  });

  it('returns empty string body when description is null', async () => {
    succeed(JSON.stringify({ ...glabView, description: null }));
    const meta = await fetchMeta(glRef);
    expect(meta.body).toBe('');
  });

  it('invokes glab with --output json', async () => {
    succeed(JSON.stringify(glabView));
    await fetchMeta(glRef);
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'glab',
      ['mr', 'view', '42', '--repo', 'mygroup/subteam/proj', '--output', 'json'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('rejects when glab fails', async () => {
    fail(new Error('authentication required'));
    await expect(fetchMeta(glRef)).rejects.toThrow('authentication required');
  });
});
