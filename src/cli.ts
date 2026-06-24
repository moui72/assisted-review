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

import './env.js'; // load .env before any module reads process.env
import { execFile } from 'node:child_process';
import { parseRef } from './parse-ref.js';
import { startServer } from './server.js';
import { saveState } from './state.js';
import { loadReview } from './review.js';
import { setupJira } from './setup-jira.js';
import type { Review, ReviewState } from './types.js';

function openBrowser(url: string): void {
  const [cmd, args]: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  execFile(cmd, args, () => {});
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
  if (process.argv[2] === 'configure') {
    await setupJira();
    return;
  }

  const { ref, noOpen, apiOnly, mockAi, port } = parseArgs(
    process.argv.slice(2),
  );

  let review: Review | null = null;
  let state: ReviewState | null = null;

  if (ref !== undefined) {
    let pr;
    try {
      pr = parseRef(ref);
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      console.error('usage: assisted-review <owner/repo#N | PR URL>');
      console.error('       assisted-review configure    (Jira setup wizard)');
      process.exit(2);
    }

    console.error(`Fetching ${pr.owner}/${pr.repo}#${pr.number} ...`);
    try {
      ({ review, state } = await loadReview(pr, { mockAi }));
      console.error(`Parsed ${review.chunks.length} chunk(s) across the diff.`);
      const jira = review.overview.jira;
      const keys = jira.keys;
      if (keys.length) {
        console.error(
          jira.available
            ? `Jira: linked ${jira.issues.map((i) => i.key).join(', ') || '(none fetched)'}${jira.epic ? ` · epic ${jira.epic.key}` : ''}.`
            : `Jira: unavailable (${jira.reason}). Overview will show a setup banner.`,
        );
      }
    } catch (err) {
      console.error(`error: failed to fetch/parse PR: ${(err as Error).message}`);
      console.error(
        'hint: is `gh` installed and authenticated? try `gh auth status`.',
      );
      process.exit(1);
    }

    const priorCount =
      state!.comments.length + state!.flagged.length + state!.viewed.length;
    if (priorCount > 0) {
      console.error(
        `Resumed state: ${state!.comments.length} comment(s), ${state!.flagged.length} flagged, ${state!.viewed.length} viewed.`,
      );
    }
    await saveState(state!);
  }

  const preloadChunks = Number(process.env.PRELOAD_CHUNKS ?? '1');
  const preloadOverview = process.env.PRELOAD_OVERVIEW !== 'false';

  const { url } = await startServer(
    { review, state },
    { port, serveUi: !apiOnly, mockAi, preloadChunks, preloadOverview },
  );

  if (apiOnly) {
    console.error(`\n  assisted-review API serving at ${url}/api/review`);
    console.error(`  Start the UI with: pnpm dev:web  (proxies /api here)\n`);
  } else {
    console.error(`\n  assisted-review serving at ${url}`);
    if (review) console.error(`  ${review.meta.title}`);
    console.error(`  Press Ctrl+C to stop.\n`);
    if (!noOpen) openBrowser(url);
  }
}

void main();
