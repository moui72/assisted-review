// Best-effort Jira background for the overview page. Fetches the referenced
// story (and its epic) straight from the Jira REST API using credentials from
// the environment — the tool is agnostic about how they're provided.
//
//   JIRA_BASE_URL   e.g. https://your-org.atlassian.net
//   JIRA_USER       account email
//   JIRA_TOKEN      API token
//   JIRA_EPIC_FIELD optional; the "Epic Link" custom field (default customfield_10008)
//
// If any are missing, returns { available: false } with a setup hint so the UI
// can show a banner instead of failing.

import type { JiraContext, JiraIssue } from './types';

const BASE_URL = (process.env.JIRA_BASE_URL ?? '').replace(/\/$/, '');
const USER = process.env.JIRA_USER ?? '';
const TOKEN = process.env.JIRA_TOKEN ?? '';
const EPIC_FIELD = process.env.JIRA_EPIC_FIELD || 'customfield_10008';
const SETUP_HINT =
  "assisted-review can't reach Jira. Set JIRA_BASE_URL, JIRA_USER, and JIRA_TOKEN " +
  '(an API token) in the environment to pull in ticket and epic context.';

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

function configured(): boolean {
  return Boolean(BASE_URL && USER && TOKEN);
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

async function fetchIssue(key: string): Promise<JiraIssue | null> {
  const auth = Buffer.from(`${USER}:${TOKEN}`).toString('base64');
  const fields = `summary,status,issuetype,description,parent,${EPIC_FIELD}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `${BASE_URL}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields}`,
      {
        headers: { authorization: `Basic ${auth}`, accept: 'application/json' },
        signal: ctrl.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { key: string; fields?: Record<string, unknown> };
    const f = data.fields ?? {};
    const parent = f.parent as { key?: string } | undefined;
    const epicLink = f[EPIC_FIELD];
    return {
      key: data.key,
      summary: (f.summary as string) ?? '',
      status: (f.status as { name?: string })?.name ?? '',
      type: (f.issuetype as { name?: string })?.name ?? '',
      description: adfToText(f.description).trim(),
      url: `${BASE_URL}/browse/${data.key}`,
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
  if (!configured()) {
    return {
      available: false,
      reason: 'Jira credentials not configured',
      setup_hint: SETUP_HINT,
      keys,
      issues: [],
    };
  }
  if (keys.length === 0) return { available: true, keys, issues: [] };

  const issues = (await Promise.all(keys.slice(0, 4).map(fetchIssue))).filter(
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
  const epic = epicKey ? await fetchIssue(epicKey) : null;
  return { available: true, keys, issues, epic };
}
