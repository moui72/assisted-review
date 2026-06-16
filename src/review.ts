// Shared PR-loading logic used by both cli.ts (startup) and server.ts (open endpoint).
// Keeps cli.ts from being imported by the server (it self-executes via void main()).

import { fetchDiff, fetchMeta } from './fetch.js';
import { chunksFromDiff } from './parse-diff.js';
import { attachMockNotes } from './mock-ai.js';
import { loadState } from './state.js';
import { buildJiraContext, extractIssueKeys } from './jira.js';
import type { JiraContext, PrRef, Review, ReviewState } from './types.js';

async function jiraWithTimeout(
  keys: string[],
  ms = 12000,
): Promise<JiraContext> {
  return Promise.race([
    buildJiraContext(keys),
    new Promise<JiraContext>((resolve) =>
      setTimeout(
        () =>
          resolve({
            available: false,
            reason: 'Jira request timed out',
            keys,
            issues: [],
          }),
        ms,
      ),
    ),
  ]);
}

export async function loadReview(
  pr: PrRef,
  opts: { mockAi?: boolean } = {},
): Promise<{ review: Review; state: ReviewState }> {
  const [diffText, meta] = await Promise.all([fetchDiff(pr), fetchMeta(pr)]);
  let chunks = chunksFromDiff(diffText);
  if (opts.mockAi) chunks = attachMockNotes(chunks);

  const keys = extractIssueKeys(meta.title, meta.head_ref, meta.body);
  const jira = await jiraWithTimeout(keys);

  const review: Review = {
    pr,
    meta,
    chunks,
    overview: { jira },
    generated_at: new Date().toISOString(),
  };

  const state = await loadState(pr, meta.head_sha);
  // Cache meta in state so the reviews listing can show titles without re-fetching.
  state.meta = meta;

  return { review, state };
}
