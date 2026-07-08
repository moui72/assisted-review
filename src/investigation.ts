// Per-repo Claude investigation access config — how much of the actual repo
// (beyond the clipped diff text) Claude can see. See infrastructure.md's
// "Repo Investigation Access" section.

import { join } from 'node:path';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { STATE_DIR } from './state.js';
import type { InvestigationConfig, PrRef } from './types.js';

const CONFIG_PATH = join(STATE_DIR, 'investigation-config.json');

function configKey(pr: Pick<PrRef, 'platform' | 'owner' | 'repo'>): string {
  return `${pr.platform}:${pr.owner}/${pr.repo}`;
}

export async function loadInvestigationConfigs(): Promise<
  Record<string, InvestigationConfig>
> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as Record<
      string,
      InvestigationConfig
    >;
  } catch {
    return {};
  }
}

export async function saveInvestigationConfigs(
  configs: Record<string, InvestigationConfig>,
): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(configs, null, 2));
  await rename(tmp, CONFIG_PATH); // atomic replace
}

export async function getInvestigationConfig(pr: PrRef): Promise<InvestigationConfig> {
  const configs = await loadInvestigationConfigs();
  return (
    configs[configKey(pr)] ?? {
      platform: pr.platform,
      owner: pr.owner,
      repo: pr.repo,
      mode: 'none',
      chosen_at: '',
    }
  );
}

export { configKey };
