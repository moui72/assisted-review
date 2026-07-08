import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

import { execFile } from 'node:child_process';
import { fetchDiff, fetchMeta, fetchFileContent } from '../src/fetch';
import { _setGlabAvailable } from '../src/gitlab-rest';
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

afterEach(() => {
  vi.mocked(execFile).mockReset();
  _setGlabAvailable(undefined);
});

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

describe('fetchDiff — GitLab (glab available)', () => {
  beforeEach(() => _setGlabAvailable(true));

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

describe('fetchMeta — GitLab (glab available)', () => {
  beforeEach(() => _setGlabAvailable(true));

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

// ---- REST fallback (glab not installed) ------------------------------------

const glabView = {
  title: 'MR title',
  author: { username: 'bob' },
  target_branch: 'main',
  source_branch: 'feat/y',
  draft: false,
  web_url: 'https://gitlab.com/mygroup/subteam/proj/-/merge_requests/42',
  sha: 'deadbeef',
  description: 'body text',
};

const diffFiles = [
  {
    old_path: 'src/a.ts',
    new_path: 'src/a.ts',
    diff: '@@ -1,3 +1,4 @@\n ctx\n-old\n+new\n ctx2\n',
    new_file: false,
    deleted_file: false,
  },
];

function mockFetch(responses: Array<{ ok: boolean; status?: number; statusText?: string; body: unknown; headers?: Record<string, string> }>) {
  let idx = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    const r = responses[idx++] ?? { ok: false, status: 500, statusText: 'no mock', body: '' };
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? 200,
      statusText: r.statusText ?? 'OK',
      json: () => Promise.resolve(r.body),
      text: () => Promise.resolve(String(r.body)),
      headers: { get: (k: string) => (r.headers ?? {})[k] ?? null },
    } as unknown as Response);
  });
}

describe('fetchMeta — GitLab REST fallback', () => {
  beforeEach(() => {
    _setGlabAvailable(false);
    process.env.GITLAB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITLAB_TOKEN;
    vi.restoreAllMocks();
  });

  it('fetches MR metadata via REST and maps to PrMeta', async () => {
    mockFetch([{ ok: true, body: glabView }]);
    const meta = await fetchMeta(glRef);
    expect(meta.title).toBe('MR title');
    expect(meta.author).toBe('bob');
    expect(meta.base_ref).toBe('main');
    expect(meta.head_sha).toBe('deadbeef');
    expect(meta.body).toBe('body text');
    const [[url, init]] = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls as [[string, RequestInit]];
    expect(url).toContain('gitlab.com/api/v4/projects/mygroup%2Fsubteam%2Fproj/merge_requests/42');
    expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe('test-token');
  });

  it('throws when GITLAB_TOKEN is missing', async () => {
    delete process.env.GITLAB_TOKEN;
    await expect(fetchMeta(glRef)).rejects.toThrow('GITLAB_TOKEN');
  });

  it('throws on non-ok REST response', async () => {
    mockFetch([{ ok: false, status: 404, statusText: 'Not Found', body: 'not found' }]);
    await expect(fetchMeta(glRef)).rejects.toThrow('404');
  });

  it('respects GITLAB_HOST env var', async () => {
    process.env.GITLAB_HOST = 'gitlab.example.com';
    mockFetch([{ ok: true, body: glabView }]);
    await fetchMeta(glRef);
    const [[url]] = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls as [[string]];
    expect(url).toContain('gitlab.example.com');
    delete process.env.GITLAB_HOST;
  });
});

describe('fetchDiff — GitLab REST fallback', () => {
  beforeEach(() => {
    _setGlabAvailable(false);
    process.env.GITLAB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITLAB_TOKEN;
    vi.restoreAllMocks();
  });

  it('fetches diffs via REST and reconstructs unified diff', async () => {
    mockFetch([{ ok: true, body: diffFiles, headers: {} }]);
    const diff = await fetchDiff(glRef);
    expect(diff).toContain('--- a/src/a.ts');
    expect(diff).toContain('+++ b/src/a.ts');
    expect(diff).toContain('@@ -1,3 +1,4 @@');
  });

  it('uses /dev/null for new files', async () => {
    mockFetch([{
      ok: true,
      body: [{ ...diffFiles[0], new_file: true, old_path: '/dev/null' }],
      headers: {},
    }]);
    const diff = await fetchDiff(glRef);
    expect(diff).toContain('--- /dev/null');
  });

  it('uses /dev/null for deleted files', async () => {
    mockFetch([{
      ok: true,
      body: [{ ...diffFiles[0], deleted_file: true, new_path: '/dev/null' }],
      headers: {},
    }]);
    const diff = await fetchDiff(glRef);
    expect(diff).toContain('+++ /dev/null');
  });

  it('skips binary files (empty diff field)', async () => {
    mockFetch([{
      ok: true,
      body: [{ ...diffFiles[0], diff: '' }],
      headers: {},
    }]);
    const diff = await fetchDiff(glRef);
    expect(diff).toBe('');
  });

  it('paginates when x-next-page is set', async () => {
    const page2 = [{ ...diffFiles[0], old_path: 'src/b.ts', new_path: 'src/b.ts' }];
    mockFetch([
      { ok: true, body: diffFiles, headers: { 'x-next-page': '2' } },
      { ok: true, body: page2, headers: {} },
    ]);
    const diff = await fetchDiff(glRef);
    expect(diff).toContain('a/src/a.ts');
    expect(diff).toContain('a/src/b.ts');
    expect((globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls).toHaveLength(2);
  });

  it('throws when GITLAB_TOKEN is missing', async () => {
    delete process.env.GITLAB_TOKEN;
    await expect(fetchDiff(glRef)).rejects.toThrow('GITLAB_TOKEN');
  });
});

describe('fetchFileContent — GitHub', () => {
  it('decodes base64 content on success', async () => {
    succeed(JSON.stringify({ content: Buffer.from('hello world').toString('base64') }));
    const content = await fetchFileContent(ghRef, 'src/a.ts', 'sha1');
    expect(content).toBe('hello world');
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'gh',
      ['api', 'repos/alice/proj/contents/src/a.ts?ref=sha1'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('returns null when gh api fails (e.g. 404)', async () => {
    fail(new Error('gh: 404 Not Found'));
    expect(await fetchFileContent(ghRef, 'missing.ts', 'sha1')).toBeNull();
  });

  it('returns null when the response has no content field', async () => {
    succeed(JSON.stringify({}));
    expect(await fetchFileContent(ghRef, 'a.ts', 'sha1')).toBeNull();
  });
});

describe('fetchFileContent — GitLab (glab available)', () => {
  beforeEach(() => _setGlabAvailable(true));

  it('returns raw file content via glab api', async () => {
    succeed('file content here');
    const content = await fetchFileContent(glRef, 'src/a.ts', 'sha1');
    expect(content).toBe('file content here');
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'glab',
      ['api', 'projects/mygroup%2Fsubteam%2Fproj/repository/files/src%2Fa.ts/raw?ref=sha1'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('returns null when glab api fails', async () => {
    fail(new Error('glab: 404'));
    expect(await fetchFileContent(glRef, 'missing.ts', 'sha1')).toBeNull();
  });
});

describe('fetchFileContent — GitLab REST fallback', () => {
  beforeEach(() => {
    _setGlabAvailable(false);
    process.env.GITLAB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITLAB_TOKEN;
    vi.restoreAllMocks();
  });

  it('returns raw file content via REST', async () => {
    mockFetch([{ ok: true, body: 'file content here' }]);
    const content = await fetchFileContent(glRef, 'src/a.ts', 'sha1');
    expect(content).toBe('file content here');
    const [[url, init]] = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls as [[string, RequestInit]];
    expect(url).toContain('repository/files/src%2Fa.ts/raw?ref=sha1');
    expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe('test-token');
  });

  it('returns null when GITLAB_TOKEN is missing', async () => {
    delete process.env.GITLAB_TOKEN;
    expect(await fetchFileContent(glRef, 'a.ts', 'sha1')).toBeNull();
  });

  it('returns null on non-ok REST response', async () => {
    mockFetch([{ ok: false, status: 404, statusText: 'Not Found', body: 'not found' }]);
    expect(await fetchFileContent(glRef, 'missing.ts', 'sha1')).toBeNull();
  });
});
