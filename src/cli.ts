#!/usr/bin/env node
// assisted-review <owner/repo#N | PR URL>
//
// Slice 1: fetch a PR, parse it into grouped hunks, serve a browser UI that
// lets you navigate the chunks. No commenting/submit/Claude yet.
//
// Flags:
//   --no-open    don't open the browser
//   --api-only   serve only /api (pair with `pnpm dev:web` Vite server)
//   --mock-ai    attach placeholder (lorem) AI commentary to each chunk
//   --port <n>   listen port (default 4319)

import './env'; // load .env before any module reads process.env
import { execFile } from 'node:child_process';
import { parseRef } from './parse-ref';
import { fetchDiff, fetchMeta, parseChunks } from './fetch';
import { attachMockNotes } from './mock-ai';
import { startServer } from './server';
import { loadState } from './state';
import { buildJiraContext, extractIssueKeys } from './jira';
import type { JiraContext, Review } from './types';

// Don't let a slow/unreachable Jira hold up startup.
async function jiraWithTimeout(keys: string[], ms = 12000): Promise<JiraContext> {
  return Promise.race([
    buildJiraContext(keys),
    new Promise<JiraContext>((resolve) =>
      setTimeout(() => resolve({ available: false, reason: 'Jira request timed out', keys, issues: [] }), ms),
    ),
  ]);
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  execFile(cmd, [url], () => {}); // best-effort; ignore failure
}

function parseArgs(argv: string[]): {
  ref: string | undefined;
  noOpen: boolean;
  apiOnly: boolean;
  mockAi: boolean;
  port: number;
} {
  let ref: string | undefined = process.env.PR_REF;
  let noOpen = false;
  let apiOnly = false;
  let mockAi = false;
  let port = 4319;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open') noOpen = true;
    else if (a === '--api-only') apiOnly = true;
    else if (a === '--mock-ai') mockAi = true;
    else if (a === '--port') port = Number(argv[++i]);
    else if (!a.startsWith('-')) ref = a;
  }
  return { ref, noOpen, apiOnly, mockAi, port };
}

async function main(): Promise<void> {
  const { ref, noOpen, apiOnly, mockAi, port } = parseArgs(process.argv.slice(2));

  let pr;
  try {
    pr = parseRef(ref);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    console.error('usage: assisted-review <owner/repo#N | PR URL>');
    process.exit(2);
  }

  console.error(`Fetching ${pr.owner}/${pr.repo}#${pr.number} ...`);
  let review: Review;
  try {
    const [diffText, meta] = await Promise.all([fetchDiff(pr), fetchMeta(pr)]);
    let chunks = parseChunks(diffText);
    if (mockAi) chunks = attachMockNotes(chunks);

    const keys = extractIssueKeys(meta.title, meta.head_ref, meta.body);
    const jira = await jiraWithTimeout(keys);
    if (keys.length) {
      console.error(
        jira.available
          ? `Jira: linked ${jira.issues.map((i) => i.key).join(', ') || '(none fetched)'}${jira.epic ? ` · epic ${jira.epic.key}` : ''}.`
          : `Jira: unavailable (${jira.reason}). Overview will show a setup banner.`,
      );
    }

    review = {
      pr,
      meta,
      chunks,
      overview: { jira },
      generated_at: new Date().toISOString(),
    };
    console.error(`Parsed ${chunks.length} chunk(s) across the diff.`);
  } catch (err) {
    console.error(`error: failed to fetch/parse PR: ${(err as Error).message}`);
    console.error('hint: is `gh` installed and authenticated? try `gh auth status`.');
    process.exit(1);
    return;
  }

  const state = await loadState(review.pr, review.meta.head_sha);
  const priorCount = state.comments.length + state.flagged.length + state.viewed.length;
  if (priorCount > 0) {
    console.error(
      `Resumed state: ${state.comments.length} comment(s), ${state.flagged.length} flagged, ${state.viewed.length} viewed.`,
    );
  }

  const { url } = await startServer({ review, state }, { port, serveUi: !apiOnly });

  if (apiOnly) {
    console.error(`\n  assisted-review API serving at ${url}/api/review`);
    console.error(`  Start the UI with: pnpm dev:web  (proxies /api here)\n`);
  } else {
    console.error(`\n  assisted-review serving at ${url}`);
    console.error(`  ${review.meta.title}`);
    console.error(`  Press Ctrl+C to stop.\n`);
    if (!noOpen) openBrowser(url);
  }
}

void main();
