import { vi } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { STATE_DIR } from '../src/state';
import { checkForUpdate } from '../src/update-check';

const CACHE_PATH = join(STATE_DIR, 'update-check.json');

function mockFetchOk(version: string): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ version }),
  } as Response);
}

beforeEach(async () => {
  await rm(CACHE_PATH, { force: true });
  delete process.env.ASSISTED_REVIEW_NO_UPDATE_CHECK;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkForUpdate', () => {
  it('returns null and skips the network when disabled via env var', async () => {
    process.env.ASSISTED_REVIEW_NO_UPDATE_CHECK = '1';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await checkForUpdate('assisted-review', '1.0.0')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns an update message when the registry reports a newer version', async () => {
    mockFetchOk('2.0.0');
    const message = await checkForUpdate('assisted-review', '1.0.0');
    expect(message).toContain('1.0.0');
    expect(message).toContain('2.0.0');
    expect(message).toContain('assisted-review');
  });

  it('returns null when already on the latest version', async () => {
    mockFetchOk('1.0.0');
    expect(await checkForUpdate('assisted-review', '1.0.0')).toBeNull();
  });

  it('returns null when the installed version is newer than the registry (local/prerelease)', async () => {
    mockFetchOk('1.0.0');
    expect(await checkForUpdate('assisted-review', '1.1.0')).toBeNull();
  });

  it('returns null when the registry request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    expect(await checkForUpdate('assisted-review', '1.0.0')).toBeNull();
  });

  it('returns null when fetch throws (e.g. offline/timeout)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    expect(await checkForUpdate('assisted-review', '1.0.0')).toBeNull();
  });

  it('caches the result and skips a second network call within the interval', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    } as Response);
    await checkForUpdate('assisted-review', '1.0.0');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await checkForUpdate('assisted-review', '1.0.0');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const cache = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
    expect(cache.latest_version).toBe('2.0.0');
  });

  it('re-checks once the cache is stale', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.0.0' }),
    } as Response);
    await checkForUpdate('assisted-review', '1.0.0');

    const stale = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
    stale.checked_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(CACHE_PATH, JSON.stringify(stale)),
    );

    await checkForUpdate('assisted-review', '1.0.0');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('ignores an unparseable cache file and re-checks', async () => {
    await import('node:fs/promises').then((fs) => fs.mkdir(STATE_DIR, { recursive: true }));
    await import('node:fs/promises').then((fs) => fs.writeFile(CACHE_PATH, 'not json'));
    mockFetchOk('2.0.0');
    const message = await checkForUpdate('assisted-review', '1.0.0');
    expect(message).toContain('2.0.0');
  });

  it('returns null when the registry version string is unparseable', async () => {
    mockFetchOk('not-a-version');
    expect(await checkForUpdate('assisted-review', '1.0.0')).toBeNull();
  });

  it('returns null when the registry response has no usable version field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    expect(await checkForUpdate('assisted-review', '1.0.0')).toBeNull();
  });
});
