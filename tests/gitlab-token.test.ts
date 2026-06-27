import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('node:fs/promises');

import * as fs from 'node:fs/promises';
import {
  getGitLabToken,
  gitLabTokenSource,
  setGitLabToken,
  clearGitLabToken,
  loadGitLabToken,
  GitLabAuthError,
  _setBrowserToken,
} from '../src/gitlab-token';

beforeEach(() => {
  _setBrowserToken(undefined);
  delete process.env.GITLAB_TOKEN;
  vi.mocked(fs.mkdir).mockResolvedValue(undefined as unknown as string);
  vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  vi.mocked(fs.rename).mockResolvedValue(undefined);
  vi.mocked(fs.unlink).mockResolvedValue(undefined);
  // Default to empty string so .trim() works; tests that need a real value override
  vi.mocked(fs.readFile).mockResolvedValue('' as unknown as Buffer);
});

afterEach(() => {
  _setBrowserToken(undefined);
  delete process.env.GITLAB_TOKEN;
});

describe('getGitLabToken', () => {
  it('returns undefined when nothing is set', () => {
    expect(getGitLabToken()).toBeUndefined();
  });

  it('returns env var when only GITLAB_TOKEN is set', () => {
    process.env.GITLAB_TOKEN = 'env-token';
    expect(getGitLabToken()).toBe('env-token');
  });

  it('returns browser token when both are set', () => {
    process.env.GITLAB_TOKEN = 'env-token';
    _setBrowserToken('browser-token');
    expect(getGitLabToken()).toBe('browser-token');
  });

  it('returns browser token when only browser token is set', () => {
    _setBrowserToken('browser-only');
    expect(getGitLabToken()).toBe('browser-only');
  });
});

describe('gitLabTokenSource', () => {
  it('returns null when no token is set', () => {
    expect(gitLabTokenSource()).toBeNull();
  });

  it('returns "env" when only GITLAB_TOKEN is set', () => {
    process.env.GITLAB_TOKEN = 'env-token';
    expect(gitLabTokenSource()).toBe('env');
  });

  it('returns "browser" when browser token is set', () => {
    _setBrowserToken('browser-token');
    expect(gitLabTokenSource()).toBe('browser');
  });

  it('returns "browser" when both are set', () => {
    process.env.GITLAB_TOKEN = 'env-token';
    _setBrowserToken('browser-token');
    expect(gitLabTokenSource()).toBe('browser');
  });
});

describe('setGitLabToken', () => {
  it('stores the token in memory', async () => {
    await setGitLabToken('my-token');
    expect(getGitLabToken()).toBe('my-token');
  });

  it('writes token to disk with mode 0o600 via atomic rename', async () => {
    await setGitLabToken('my-token');
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      expect.stringMatching(/gitlab-token\.tmp$/),
      'my-token',
      { mode: 0o600 },
    );
    expect(vi.mocked(fs.rename)).toHaveBeenCalledWith(
      expect.stringMatching(/gitlab-token\.tmp$/),
      expect.stringMatching(/gitlab-token$/),
    );
  });

  it('creates the state dir if needed', async () => {
    await setGitLabToken('my-token');
    expect(vi.mocked(fs.mkdir)).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );
  });
});

describe('clearGitLabToken', () => {
  it('clears the in-memory token', async () => {
    _setBrowserToken('existing');
    await clearGitLabToken();
    expect(getGitLabToken()).toBeUndefined();
  });

  it('deletes the token file', async () => {
    await clearGitLabToken();
    expect(vi.mocked(fs.unlink)).toHaveBeenCalledWith(
      expect.stringMatching(/gitlab-token$/),
    );
  });

  it('ignores ENOENT when the file does not exist', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    vi.mocked(fs.unlink).mockRejectedValueOnce(err);
    await expect(clearGitLabToken()).resolves.not.toThrow();
  });

  it('rethrows non-ENOENT errors', async () => {
    const err = Object.assign(new Error('EPERM'), { code: 'EPERM' });
    vi.mocked(fs.unlink).mockRejectedValueOnce(err);
    await expect(clearGitLabToken()).rejects.toThrow('EPERM');
  });
});

describe('loadGitLabToken', () => {
  it('loads the token from disk into memory', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce('disk-token' as unknown as Buffer);
    await loadGitLabToken();
    expect(getGitLabToken()).toBe('disk-token');
  });

  it('trims whitespace from the stored token', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce('  trimmed  \n' as unknown as Buffer);
    await loadGitLabToken();
    expect(getGitLabToken()).toBe('trimmed');
  });

  it('stores undefined when the file is empty', async () => {
    vi.mocked(fs.readFile).mockResolvedValueOnce('' as unknown as Buffer);
    await loadGitLabToken();
    expect(getGitLabToken()).toBeUndefined();
  });

  it('silently ignores ENOENT', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    vi.mocked(fs.readFile).mockRejectedValueOnce(err);
    await expect(loadGitLabToken()).resolves.not.toThrow();
    expect(getGitLabToken()).toBeUndefined();
  });

  it('rethrows non-ENOENT errors', async () => {
    const err = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    vi.mocked(fs.readFile).mockRejectedValueOnce(err);
    await expect(loadGitLabToken()).rejects.toThrow('EACCES');
  });
});

describe('GitLabAuthError', () => {
  it('is an instance of Error', () => {
    const err = new GitLabAuthError('needs token');
    expect(err).toBeInstanceOf(Error);
  });

  it('has type "gitlab_auth_required"', () => {
    const err = new GitLabAuthError('needs token');
    expect(err.type).toBe('gitlab_auth_required');
  });

  it('carries the provided message', () => {
    const err = new GitLabAuthError('no token set');
    expect(err.message).toBe('no token set');
  });
});
