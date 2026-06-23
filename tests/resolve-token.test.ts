import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn(), exec: vi.fn() }));

import { execFile, exec } from 'node:child_process';
import { isReference, resolveToken } from '../src/resolve-token';

afterEach(() => {
  vi.mocked(execFile).mockReset();
  vi.mocked(exec).mockReset();
});

describe('isReference', () => {
  it('returns true for op:// refs', () => expect(isReference('op://vault/item/field')).toBe(true));
  it('returns true for env: refs', () => expect(isReference('env:MY_VAR')).toBe(true));
  it('returns true for cmd: refs', () => expect(isReference('cmd:echo hi')).toBe(true));
  it('returns false for raw tokens', () => expect(isReference('raw-token')).toBe(false));
  it('returns false for empty string', () => expect(isReference('')).toBe(false));
});

describe('resolveToken', () => {
  it('returns empty string for empty input', async () => {
    expect(await resolveToken('')).toBe('');
  });

  it('returns raw token as-is', async () => {
    expect(await resolveToken('my-secret')).toBe('my-secret');
  });

  it('resolves env: from process.env', async () => {
    process.env._RESOLVE_TOKEN_TEST = 'from-env';
    try {
      expect(await resolveToken('env:_RESOLVE_TOKEN_TEST')).toBe('from-env');
    } finally {
      delete process.env._RESOLVE_TOKEN_TEST;
    }
  });

  it('throws when env: variable is not set', async () => {
    delete process.env._RESOLVE_TOKEN_MISSING;
    await expect(resolveToken('env:_RESOLVE_TOKEN_MISSING')).rejects.toThrow(
      '_RESOLVE_TOKEN_MISSING',
    );
  });

  it('resolves op:// via op CLI', async () => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (e: null, r: { stdout: string; stderr: string }) => void;
      process.nextTick(() => cb(null, { stdout: 'op-token\n', stderr: '' }));
      return undefined as never;
    });
    const result = await resolveToken('op://vault/item/field');
    expect(result).toBe('op-token');
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'op',
      ['read', 'op://vault/item/field'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('throws a helpful message when op CLI is not found (ENOENT)', async () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (e: Error) => void;
      process.nextTick(() => cb(err));
      return undefined as never;
    });
    await expect(resolveToken('op://vault/item')).rejects.toThrow('op` CLI not found');
  });

  it('throws a generic message when op CLI fails', async () => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (e: Error) => void;
      process.nextTick(() => cb(new Error('permission denied')));
      return undefined as never;
    });
    await expect(resolveToken('op://vault/item')).rejects.toThrow('op read failed');
  });

  it('resolves cmd: via shell', async () => {
    vi.mocked(exec).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (e: null, r: { stdout: string; stderr: string }) => void;
      process.nextTick(() => cb(null, { stdout: 'shell-result\n', stderr: '' }));
      return undefined as never;
    });
    const result = await resolveToken('cmd:echo shell-result');
    expect(result).toBe('shell-result');
  });

  it('throws when cmd: shell command fails', async () => {
    vi.mocked(exec).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (e: Error) => void;
      process.nextTick(() => cb(new Error('command not found')));
      return undefined as never;
    });
    await expect(resolveToken('cmd:false')).rejects.toThrow('cmd failed');
  });
});
