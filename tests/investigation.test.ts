import { vi } from 'vitest';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

import { execFile } from 'node:child_process';
import { readFile, rm, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { STATE_DIR } from '../src/state';
import {
  loadInvestigationConfigs,
  saveInvestigationConfigs,
  getInvestigationConfig,
  ensureClone,
  refreshCloneIfStale,
  cleanupTempClone,
  sweepOrphanedTempClones,
  pruneStaleClones,
  markConfigUsed,
  REPOS_DIR,
} from '../src/investigation';
import type { InvestigationConfig, PrRef } from '../src/types';

const CONFIG_PATH = join(STATE_DIR, 'investigation-config.json');

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

beforeEach(async () => {
  await rm(CONFIG_PATH, { force: true });
  await rm(REPOS_DIR, { recursive: true, force: true });
  vi.mocked(execFile).mockReset();
});

const pr: PrRef = { owner: 'o', repo: 'r', number: 1, platform: 'github' };

describe('loadInvestigationConfigs', () => {
  it('returns an empty map when no file exists', async () => {
    expect(await loadInvestigationConfigs()).toEqual({});
  });

  it('returns the parsed map when a valid file exists', async () => {
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'local-path',
      local_path: '/repo',
      chosen_at: '2026-01-01T00:00:00.000Z',
    };
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify({ 'github:o/r': config }));
    expect(await loadInvestigationConfigs()).toEqual({ 'github:o/r': config });
  });

  it('returns an empty map when the file is corrupt', async () => {
    await mkdir(STATE_DIR, { recursive: true });
    await writeFile(CONFIG_PATH, 'not json');
    expect(await loadInvestigationConfigs()).toEqual({});
  });
});

describe('saveInvestigationConfigs', () => {
  it('round-trips a saved map through load', async () => {
    const config: InvestigationConfig = {
      platform: 'gitlab',
      owner: 'group/sub',
      repo: 'r',
      mode: 'always-clone',
      clone_path: '/x/repos/gitlab-group-sub-r',
      chosen_at: '2026-01-01T00:00:00.000Z',
      last_used: '2026-01-02T00:00:00.000Z',
    };
    await saveInvestigationConfigs({ 'gitlab:group/sub/r': config });
    expect(await loadInvestigationConfigs()).toEqual({ 'gitlab:group/sub/r': config });
    const raw = await readFile(CONFIG_PATH, 'utf8');
    expect(JSON.parse(raw)).toEqual({ 'gitlab:group/sub/r': config });
  });
});

describe('getInvestigationConfig', () => {
  it('returns the default none shape for an unconfigured repo', async () => {
    expect(await getInvestigationConfig(pr)).toEqual({
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'none',
      chosen_at: '',
    });
  });

  it('returns the stored entry for a configured repo', async () => {
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'api',
      chosen_at: '2026-01-01T00:00:00.000Z',
    };
    await saveInvestigationConfigs({ 'github:o/r': config });
    expect(await getInvestigationConfig(pr)).toEqual(config);
  });
});

describe('ensureClone', () => {
  it('clones a GitHub repo via gh repo clone', async () => {
    succeed('');
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'temp-clone',
      chosen_at: '',
    };
    const dest = await ensureClone(config);
    expect(dest).toContain(join(REPOS_DIR, 'tmp-'));
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'gh',
      ['repo', 'clone', 'o/r', dest],
      expect.any(Function),
    );
  });

  it('clones a GitLab repo via glab repo clone', async () => {
    succeed('');
    const config: InvestigationConfig = {
      platform: 'gitlab',
      owner: 'group',
      repo: 'r',
      mode: 'always-clone',
      chosen_at: '',
    };
    const dest = await ensureClone(config);
    expect(dest).toBe(join(REPOS_DIR, 'gitlab-group-r'));
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'glab',
      ['repo', 'clone', 'group/r', dest],
      expect.any(Function),
    );
  });

  it('throws when the clone command fails', async () => {
    fail(new Error('repo not found'));
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'temp-clone',
      chosen_at: '',
    };
    await expect(ensureClone(config)).rejects.toThrow('repo not found');
  });

  it('always-clone reuses an existing clone directory without re-cloning', async () => {
    const dest = join(REPOS_DIR, 'github-o-r');
    await mkdir(dest, { recursive: true });
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'always-clone',
      chosen_at: '',
    };
    const result = await ensureClone(config);
    expect(result).toBe(dest);
    expect(vi.mocked(execFile)).not.toHaveBeenCalled();
  });
});

describe('refreshCloneIfStale', () => {
  const clonePath = '/x/repos/github-o-r';

  it('no-ops for modes other than always-clone', async () => {
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'temp-clone',
      clone_path: clonePath,
      chosen_at: '',
    };
    await refreshCloneIfStale(config, 'sha1');
    expect(vi.mocked(execFile)).not.toHaveBeenCalled();
  });

  it('no-ops when the clone is already at headSha', async () => {
    succeed('sha1\n');
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'always-clone',
      clone_path: clonePath,
      chosen_at: '',
    };
    await refreshCloneIfStale(config, 'sha1');
    expect(vi.mocked(execFile)).toHaveBeenCalledTimes(1); // just rev-parse
  });

  it('fetches and checks out when stale', async () => {
    let call = 0;
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      call++;
      const cb = args[args.length - 1] as (err: null, r: { stdout: string; stderr: string }) => void;
      process.nextTick(() => cb(null, { stdout: call === 1 ? 'old-sha\n' : '', stderr: '' }));
      return undefined as never;
    });
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'always-clone',
      clone_path: clonePath,
      chosen_at: '',
    };
    await refreshCloneIfStale(config, 'new-sha');
    expect(vi.mocked(execFile)).toHaveBeenCalledTimes(3); // rev-parse, fetch, checkout
    expect(vi.mocked(execFile)).toHaveBeenCalledWith(
      'git',
      ['checkout', 'new-sha'],
      { cwd: clonePath },
      expect.any(Function),
    );
  });
});

describe('cleanupTempClone', () => {
  it('removes the clone dir and the config entry for temp-clone', async () => {
    const dest = join(REPOS_DIR, 'tmp-abc');
    await mkdir(dest, { recursive: true });
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1, platform: 'github' };
    await saveInvestigationConfigs({
      'github:o/r': {
        platform: 'github',
        owner: 'o',
        repo: 'r',
        mode: 'temp-clone',
        clone_path: dest,
        chosen_at: '',
      },
    });
    await cleanupTempClone(pr);
    expect(await loadInvestigationConfigs()).toEqual({});
    await expect(stat(dest)).rejects.toThrow();
  });

  it('no-ops for a repo with no config or a non-temp-clone mode', async () => {
    const pr: PrRef = { owner: 'o', repo: 'r', number: 1, platform: 'github' };
    await cleanupTempClone(pr); // no config at all
    await saveInvestigationConfigs({
      'github:o/r': { platform: 'github', owner: 'o', repo: 'r', mode: 'none', chosen_at: '' },
    });
    await cleanupTempClone(pr);
    expect(await loadInvestigationConfigs()).toHaveProperty('github:o/r');
  });
});

describe('sweepOrphanedTempClones', () => {
  it('removes tmp-* dirs older than 24h, keeps recent ones', async () => {
    const old = join(REPOS_DIR, 'tmp-old');
    const recent = join(REPOS_DIR, 'tmp-recent');
    await mkdir(old, { recursive: true });
    await mkdir(recent, { recursive: true });
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { utimes } = await import('node:fs/promises');
    await utimes(old, oldTime, oldTime);

    await sweepOrphanedTempClones();

    await expect(stat(old)).rejects.toThrow();
    await expect(stat(recent)).resolves.toBeDefined();
  });

  it('does not throw when STATE_DIR/repos does not exist', async () => {
    await expect(sweepOrphanedTempClones()).resolves.toBeUndefined();
  });
});

describe('pruneStaleClones', () => {
  it('resets an always-clone entry idle for more than 30 days and deletes its dir', async () => {
    const dest = join(REPOS_DIR, 'github-o-r');
    await mkdir(dest, { recursive: true });
    await saveInvestigationConfigs({
      'github:o/r': {
        platform: 'github',
        owner: 'o',
        repo: 'r',
        mode: 'always-clone',
        clone_path: dest,
        chosen_at: '2020-01-01T00:00:00.000Z',
        last_used: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    await pruneStaleClones();
    const configs = await loadInvestigationConfigs();
    expect(configs['github:o/r'].mode).toBe('none');
    await expect(stat(dest)).rejects.toThrow();
  });

  it('leaves a recently-used always-clone entry untouched', async () => {
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'always-clone',
      clone_path: join(REPOS_DIR, 'github-o-r'),
      chosen_at: '2020-01-01T00:00:00.000Z',
      last_used: new Date().toISOString(),
    };
    await saveInvestigationConfigs({ 'github:o/r': config });
    await pruneStaleClones();
    expect((await loadInvestigationConfigs())['github:o/r']).toEqual(config);
  });

  it('ignores non-always-clone entries', async () => {
    const config: InvestigationConfig = {
      platform: 'github',
      owner: 'o',
      repo: 'r',
      mode: 'local-path',
      local_path: '/x',
      chosen_at: '2020-01-01T00:00:00.000Z',
    };
    await saveInvestigationConfigs({ 'github:o/r': config });
    await pruneStaleClones();
    expect((await loadInvestigationConfigs())['github:o/r']).toEqual(config);
  });
});

describe('markConfigUsed', () => {
  it('bumps last_used to roughly now for an existing config', async () => {
    await saveInvestigationConfigs({
      'github:o/r': {
        platform: 'github',
        owner: 'o',
        repo: 'r',
        mode: 'always-clone',
        clone_path: join(REPOS_DIR, 'github-o-r'),
        chosen_at: '2020-01-01T00:00:00.000Z',
      },
    });
    const before = Date.now();
    await markConfigUsed(pr);
    const stored = (await loadInvestigationConfigs())['github:o/r'];
    expect(stored.last_used).toBeDefined();
    const ts = Date.parse(stored.last_used!);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now());
    // Rest of the config is preserved.
    expect(stored.mode).toBe('always-clone');
    expect(stored.chosen_at).toBe('2020-01-01T00:00:00.000Z');
  });

  it('is a no-op when the repo has no persisted config', async () => {
    await markConfigUsed(pr);
    expect(await loadInvestigationConfigs()).toEqual({});
  });

  // Regression for the verify-pass defect: a config that never had `last_used`
  // set was never TTL-prunable. Once marked used, the idle clock starts, so a
  // later (>30d) prune can actually fire.
  it('makes an always-clone with no prior last_used eligible for later pruning', async () => {
    const dest = join(REPOS_DIR, 'github-o-r');
    await mkdir(dest, { recursive: true });
    await saveInvestigationConfigs({
      'github:o/r': {
        platform: 'github',
        owner: 'o',
        repo: 'r',
        mode: 'always-clone',
        clone_path: dest,
        chosen_at: '2020-01-01T00:00:00.000Z',
        // no last_used — the pre-fix state that could never prune
      },
    });
    // Before any use: prune is a no-op (last_used is unset → NaN → skipped).
    await pruneStaleClones();
    expect((await loadInvestigationConfigs())['github:o/r'].mode).toBe('always-clone');

    // Simulate a use that then goes idle >30 days by writing the bumped value
    // back into the past, then prune.
    await markConfigUsed(pr);
    const configs = await loadInvestigationConfigs();
    configs['github:o/r'].last_used = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await saveInvestigationConfigs(configs);
    await pruneStaleClones();
    expect((await loadInvestigationConfigs())['github:o/r'].mode).toBe('none');
    await expect(stat(dest)).rejects.toThrow();
  });
});
