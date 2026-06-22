// Interactive Jira configuration wizard.
// Reads existing ~/.assisted-review/.env, prompts for JIRA_* values,
// tests the connection, and writes back atomically with chmod 0600.
//
// JIRA_TOKEN accepts a raw token or a reference:
//   op://vault/item/field   1Password CLI
//   env:VAR_NAME            value of the named environment variable
//   cmd:<shell command>     stdout of the command

import { createInterface } from 'node:readline/promises';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
  existsSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { resolveToken, isReference } from './resolve-token.js';

const ENV_PATH = join(homedir(), '.assisted-review', '.env');

function parseEnvFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return map;
}

function serializeEnvFile(map: Map<string, string>): string {
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
}

function writeEnvAtomic(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, filePath);
  chmodSync(filePath, 0o600);
}

async function testConnection(
  baseUrl: string,
  user: string,
  token: string,
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  const auth = Buffer.from(`${user}:${token}`).toString('base64');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/api/3/myself`, {
      headers: { authorization: `Basic ${auth}`, accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { displayName?: string };
    return { ok: true, displayName: data.displayName };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

function displayToken(val: string): string {
  if (!val) return '(not set)';
  if (isReference(val)) return val; // show references in clear
  if (val.length <= 4) return '****';
  return val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2);
}

export async function setupJira(): Promise<void> {
  const existing = existsSync(ENV_PATH)
    ? parseEnvFile(readFileSync(ENV_PATH, 'utf8'))
    : new Map<string, string>();

  const current = {
    JIRA_BASE_URL: existing.get('JIRA_BASE_URL') ?? '',
    JIRA_USER: existing.get('JIRA_USER') ?? '',
    JIRA_TOKEN: existing.get('JIRA_TOKEN') ?? '',
    JIRA_EPIC_FIELD: existing.get('JIRA_EPIC_FIELD') ?? '',
  };

  const rl = createInterface({ input: process.stdin, output: process.stderr });

  process.stderr.write('\nJira configuration — press Enter to keep the current value.\n\n');

  async function prompt(key: keyof typeof current, label: string, hint?: string): Promise<string> {
    const cur = current[key];
    const display = key === 'JIRA_TOKEN' ? displayToken(cur) : cur || '(not set)';
    const suffix = cur ? ` [${display}]` : '';
    const hintLine = hint ? `\n    ${hint}\n` : '';
    process.stderr.write(hintLine);
    const answer = await rl.question(`  ${label}${suffix}: `);
    return answer.trim() || cur;
  }

  const baseUrl = await prompt('JIRA_BASE_URL', 'Jira base URL (e.g. https://your-org.atlassian.net)');
  const user = await prompt('JIRA_USER', 'Jira account email');
  const tokenRef = await prompt(
    'JIRA_TOKEN',
    'Jira API token',
    'Accepts a raw token or a reference: op://vault/item/field  |  env:VAR_NAME  |  cmd:<command>',
  );
  const epicField = await prompt('JIRA_EPIC_FIELD', 'Epic link field (default: customfield_10008)');

  rl.close();

  if (!baseUrl || !user || !tokenRef) {
    process.stderr.write('\nError: JIRA_BASE_URL, JIRA_USER, and JIRA_TOKEN are all required.\n');
    process.exit(1);
  }

  process.stderr.write('\nResolving token...\n');
  let resolvedToken: string;
  try {
    resolvedToken = await resolveToken(tokenRef);
  } catch (err) {
    process.stderr.write(`  Error: ${(err as Error).message}\n`);
    process.stderr.write('  Fix the reference and re-run `assisted-review configure`.\n');
    process.exit(1);
  }

  process.stderr.write('Testing connection...\n');
  const result = await testConnection(baseUrl, user, resolvedToken);
  if (result.ok) {
    process.stderr.write(`  Connected as: ${result.displayName ?? user}\n`);
  } else {
    process.stderr.write(`  Warning: connection test failed (${result.error}).\n`);
    process.stderr.write('  Check JIRA_BASE_URL, JIRA_USER, and that the token has the right scopes.\n');
    // Still save — user may be configuring for an offline environment or fixing a typo later.
  }

  // Merge: preserve non-JIRA keys, update JIRA keys. Store the reference, not the resolved token.
  const updated = new Map(existing);
  updated.set('JIRA_BASE_URL', baseUrl);
  updated.set('JIRA_USER', user);
  updated.set('JIRA_TOKEN', tokenRef);
  if (epicField) {
    updated.set('JIRA_EPIC_FIELD', epicField);
  } else {
    updated.delete('JIRA_EPIC_FIELD');
  }

  writeEnvAtomic(ENV_PATH, serializeEnvFile(updated));
  process.stderr.write(`\nSaved to ${ENV_PATH}\n\n`);
}
