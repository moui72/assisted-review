import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

import { execFile } from 'node:child_process';
import { fetchDiff, fetchMeta } from '../src/fetch';
import type { PrRef } from '../src/types';

const ref: PrRef = { owner: 'alice', repo: 'proj', number: 42 };

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

describe('fetchDiff', () => {
  it('invokes gh pr diff with owner/repo and returns stdout', async () => {
    succeed('diff content');
    const result = await fetchDiff(ref);
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
    await expect(fetchDiff(ref)).rejects.toThrow('gh: not found');
  });
});

describe('fetchMeta', () => {
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
    const meta = await fetchMeta(ref);
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
    const meta = await fetchMeta(ref);
    expect(meta.author).toBe('unknown');
  });

  it('returns empty string body when body is null', async () => {
    succeed(JSON.stringify({ ...ghView, body: null }));
    const meta = await fetchMeta(ref);
    expect(meta.body).toBe('');
  });

  it('rejects when gh fails', async () => {
    fail(new Error('authentication required'));
    await expect(fetchMeta(ref)).rejects.toThrow('authentication required');
  });
});
