import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { STATE_DIR } from '../src/state';
import {
  loadInvestigationConfigs,
  saveInvestigationConfigs,
  getInvestigationConfig,
} from '../src/investigation';
import type { InvestigationConfig, PrRef } from '../src/types';

const CONFIG_PATH = join(STATE_DIR, 'investigation-config.json');

beforeEach(async () => {
  await rm(CONFIG_PATH, { force: true });
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
