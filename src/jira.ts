// Best-effort Jira background for the overview page. Fetches the referenced
// story (and its epic) straight from the Jira REST API using credentials from
// the environment — the tool is agnostic about how they're provided.
//
//   JIRA_BASE_URL   e.g. https://your-org.atlassian.net
//   JIRA_USER       account email
//   JIRA_TOKEN      API token, or a reference: op://vault/item/field,
//                   env:VAR_NAME, cmd:<shell command>
//   JIRA_EPIC_FIELD optional; the "Epic Link" custom field (default customfield_10008)
//
// If any are missing, returns { available: false } with a setup hint so the UI
// can show a banner instead of failing.

import type { JiraContext, JiraIssue } from './types.js';
import { resolveToken } from './resolve-token.js';

const SETUP_HINT =
  "assisted-review can't reach Jira. Set JIRA_BASE_URL, JIRA_USER, and JIRA_TOKEN " +
  '(an API token, or a reference like op://vault/item/field or env:VAR_NAME) ' +
  'in the environment to pull in ticket and epic context. ' +
  'Run `assisted-review configure` to set these up interactively.';

/** Extract Jira issue keys (e.g. FEN-2622) from any number of text sources. */
export function extractIssueKeys(...texts: (string | undefined | null)[]): string[] {
  const re = /\b[A-Z][A-Z0-9]+-\d+\b/g;
  const seen = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.match(re) ?? []) seen.add(m);
  }
  return [...seen];
}

/** Recursively flatten Atlassian Document Format to plain text. */
function adfToText(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  const n = node as { type?: string; text?: string; content?: unknown[] };
  const kids = n.content ?? [];
  const inner = () => kids.map(adfToText).join('');
  switch (n.type) {
    case 'text':
      return n.text ?? '';
    case 'hardBreak':
      return '\n';
    case 'paragraph':
    case 'listItem':
    case 'blockquote':
    case 'heading':
      return inner() + '\n';
    case 'bulletList':
    case 'orderedList':
      return kids.map((c) => '  - ' + adfToText(c).trim() + '\n').join('');
    default:
      return inner();
  }
}

interface Creds {
  baseUrl: string;
  user: string;
  token: string;
  epicField: string;
}

async function fetchIssue(key: string, { baseUrl, user, token, epicField }: Creds): Promise<JiraIssue | null> {
  const auth = Buffer.from(`${user}:${token}`).toString('base64');
  const fields = `summary,status,issuetype,description,parent,${epicField}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `${baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields}`,
      {
        headers: { authorization: `Basic ${auth}`, accept: 'application/json' },
        signal: ctrl.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { key: string; fields?: Record<string, unknown> };
    const f = data.fields ?? {};
    const parent = f.parent as { key?: string } | undefined;
    const epicLink = f[epicField];
    return {
      key: data.key,
      summary: (f.summary as string) ?? '',
      status: (f.status as { name?: string })?.name ?? '',
      type: (f.issuetype as { name?: string })?.name ?? '',
      description: adfToText(f.description).trim(),
      url: `${baseUrl}/browse/${data.key}`,
      epic_key: (typeof epicLink === 'string' ? epicLink : undefined) ?? parent?.key,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Build the Jira context for the given issue keys (best effort). */
export async function buildJiraContext(keys: string[]): Promise<JiraContext> {
  const baseUrl = (process.env.JIRA_BASE_URL ?? '').replace(/\/$/, '');
  const user = process.env.JIRA_USER ?? '';
  const tokenRef = process.env.JIRA_TOKEN ?? '';
  const epicField = process.env.JIRA_EPIC_FIELD || 'customfield_10008';

  let token = '';
  let tokenError = '';
  if (tokenRef) {
    try {
      token = await resolveToken(tokenRef);
    } catch (err) {
      tokenError = (err as Error).message;
    }
  }

  if (!baseUrl || !user || !token) {
    return {
      available: false,
      reason: tokenError
        ? `JIRA_TOKEN resolution failed: ${tokenError}`
        : 'Jira credentials not configured',
      setup_hint: SETUP_HINT,
      keys,
      issues: [],
    };
  }

  if (keys.length === 0) return { available: true, keys, issues: [] };

  const creds: Creds = { baseUrl, user, token, epicField };
  const issues = (await Promise.all(keys.slice(0, 4).map((k) => fetchIssue(k, creds)))).filter(
    (i): i is JiraIssue => i !== null,
  );

  if (issues.length === 0) {
    return {
      available: false,
      reason: `Could not fetch ${keys.join(', ')} (check JIRA_TOKEN scope and access)`,
      setup_hint: SETUP_HINT,
      keys,
      issues: [],
    };
  }

  const epicKey = issues.find((i) => i.epic_key)?.epic_key;
  const epic = epicKey ? await fetchIssue(epicKey, creds) : null;
  return { available: true, keys, issues, epic };
}
