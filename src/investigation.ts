// Per-repo Claude investigation access config — how much of the actual repo
// (beyond the clipped diff text) Claude can see. See infrastructure.md's
// "Repo Investigation Access" section.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { STATE_DIR } from './state.js';
import type { InvestigationConfig, PrRef } from './types.js';

const execFileAsync = promisify(execFile);

const CONFIG_PATH = join(STATE_DIR, 'investigation-config.json');
export const REPOS_DIR = join(STATE_DIR, 'repos');

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

/** Clones the repo for 'temp-clone'/'always-clone' modes and returns the
 *  clone path. `temp-clone` always clones fresh into a random tmp dir;
 *  `always-clone` reuses an existing clone at its deterministic path
 *  instead of re-cloning. Reuses whatever gh/glab auth is already
 *  configured — no new credential handling. Throws on clone failure. */
export async function ensureClone(config: InvestigationConfig): Promise<string> {
  const dest =
    config.mode === 'always-clone'
      ? join(REPOS_DIR, `${config.platform}-${config.owner}-${config.repo}`)
      : join(REPOS_DIR, `tmp-${randomUUID()}`);

  if (config.mode === 'always-clone') {
    try {
      const st = await stat(dest);
      if (st.isDirectory()) return dest; // already cloned, reuse
    } catch {
      // not cloned yet — fall through to clone below
    }
  }

  await mkdir(REPOS_DIR, { recursive: true });
  const repoSlug = `${config.owner}/${config.repo}`;
  if (config.platform === 'gitlab') {
    await execFileAsync('glab', ['repo', 'clone', repoSlug, dest]);
  } else {
    await execFileAsync('gh', ['repo', 'clone', repoSlug, dest]);
  }
  return dest;
}

/** For 'always-clone' only: fetches + checks out `headSha` in the clone if
 *  it isn't already at that sha, so a stale clone doesn't silently answer
 *  from an older version of the repo. No-op for any other mode. */
export async function refreshCloneIfStale(
  config: InvestigationConfig,
  headSha: string,
): Promise<void> {
  if (config.mode !== 'always-clone' || !config.clone_path) return;
  let currentSha: string | undefined;
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: config.clone_path,
    });
    currentSha = stdout.trim();
  } catch {
    currentSha = undefined;
  }
  if (currentSha === headSha) return;
  await execFileAsync('git', ['fetch'], { cwd: config.clone_path });
  await execFileAsync('git', ['checkout', headSha], { cwd: config.clone_path });
}

/** Removes a repo's temp clone (if any) and resets its config to 'none' —
 *  called when a review with a 'temp-clone' config closes or the active
 *  review switches away from it. Best-effort: errors are swallowed, same
 *  as the existing state-file-delete convention. No-op for any other mode. */
export async function cleanupTempClone(pr: PrRef): Promise<void> {
  const configs = await loadInvestigationConfigs();
  const key = configKey(pr);
  const config = configs[key];
  if (!config || config.mode !== 'temp-clone') return;
  if (config.clone_path) await rm(config.clone_path, { recursive: true, force: true }).catch(() => {});
  delete configs[key];
  await saveInvestigationConfigs(configs).catch(() => {});
}

/** Records that an investigation call just used this repo's config by bumping
 *  `last_used` to now — the idle-clock input `pruneStaleClones()` reads for
 *  its 30-day always-clone TTL. Without this, `last_used` would never be set
 *  and the prune could never fire. No-op if the repo has no persisted config.
 *  Best-effort persistence, same swallow-on-write-failure convention as
 *  `cleanupTempClone`. */
export async function markConfigUsed(pr: PrRef): Promise<void> {
  const configs = await loadInvestigationConfigs();
  const key = configKey(pr);
  const config = configs[key];
  if (!config) return;
  configs[key] = { ...config, last_used: new Date().toISOString() };
  await saveInvestigationConfigs(configs).catch(() => {});
}

const ORPHAN_TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const ALWAYS_CLONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Startup sweep: removes STATE_DIR/repos/tmp-* directories older than 24h
 *  — a crash/kill-9'd process's temp clone that never got cleaned up on
 *  review close. Best-effort, never throws. */
export async function sweepOrphanedTempClones(): Promise<void> {
  try {
    const entries = await readdir(REPOS_DIR);
    for (const name of entries) {
      if (!name.startsWith('tmp-')) continue;
      const path = join(REPOS_DIR, name);
      const st = await stat(path).catch(() => null);
      if (st && Date.now() - st.mtimeMs > ORPHAN_TMP_MAX_AGE_MS) {
        await rm(path, { recursive: true, force: true }).catch(() => {});
      }
    }
  } catch {
    // STATE_DIR/repos doesn't exist yet — nothing to sweep.
  }
}

/** Startup sweep: 'always-clone' entries whose last_used is older than the
 *  30-day TTL get their clone directory deleted and their config reset to
 *  'none' (the reviewer would need to re-opt-in). Fire-and-forget from the
 *  caller — never blocks startup, best-effort throughout. */
export async function pruneStaleClones(): Promise<void> {
  const configs = await loadInvestigationConfigs();
  let changed = false;
  for (const [key, config] of Object.entries(configs)) {
    if (config.mode !== 'always-clone') continue;
    const lastUsed = config.last_used ? Date.parse(config.last_used) : NaN;
    if (Number.isNaN(lastUsed) || Date.now() - lastUsed <= ALWAYS_CLONE_TTL_MS) continue;
    if (config.clone_path) await rm(config.clone_path, { recursive: true, force: true }).catch(() => {});
    configs[key] = {
      platform: config.platform,
      owner: config.owner,
      repo: config.repo,
      mode: 'none',
      chosen_at: '',
    };
    changed = true;
  }
  if (changed) await saveInvestigationConfigs(configs).catch(() => {});
}

export { configKey };
