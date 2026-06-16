// Local-only HTTP server: serves the built UI (dist/), the review payload, and
// the mutable review state. Binds to 127.0.0.1 only — never exposed off-machine.

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { applyAction, deleteReview, listReviews, saveState } from './state';
import {
  buildOverviewPrompt,
  buildPrompt,
  splitSuggestedAction,
  streamClaude,
} from './claude';
import {
  buildReviewPayload,
  submitReview,
  VERDICTS,
  type Verdict,
} from './submit';
import { parseRef } from './parse-ref';
import { loadReview } from './review';
import {
  OVERVIEW_ID,
  type Action,
  type AiNoteKind,
  type PrRef,
  type Review,
  type ReviewState,
} from './types';

// dist/ is a sibling of this file's dir (src/ under ts-node, build/ after tsc).
const DIST_DIR = join(__dirname, '..', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  res.writeHead(status, { 'content-type': MIME['.json'] });
  res.end(JSON.stringify(obj));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function serveStatic(
  res: ServerResponse,
  urlPath: string,
): Promise<void> {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = normalize(join(DIST_DIR, rel));
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    });
    res.end(data);
  } catch {
    if (!extname(filePath)) {
      try {
        const html = await readFile(join(DIST_DIR, 'index.html'));
        res.writeHead(200, { 'content-type': MIME['.html'] });
        res.end(html);
        return;
      } catch {
        /* fall through */
      }
    }
    res.writeHead(404);
    res.end('not found');
  }
}

export interface AppContext {
  review: Review;
  state: ReviewState;
}

export interface StartOptions {
  port?: number;
  host?: string;
  serveUi?: boolean;
  mockAi?: boolean;
}

export function startServer(
  ctx: AppContext,
  {
    port = 4319,
    host = '127.0.0.1',
    serveUi = true,
    mockAi = false,
  }: StartOptions = {},
): Promise<{ url: string }> {
  // Track the active Claude SSE stream cancel fn — called before switching reviews
  // to prevent a finishing stream from writing notes into the wrong review's state.
  let currentCancel: (() => void) | null = null;

  const server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${host}`);

    if (url.pathname === '/api/review') return sendJson(res, 200, ctx.review);
    if (url.pathname === '/api/state') return sendJson(res, 200, ctx.state);

    if (url.pathname === '/api/action' && req.method === 'POST') {
      const action = JSON.parse(await readBody(req)) as Action;
      ctx.state = applyAction(ctx.state, action);
      await saveState(ctx.state);
      return sendJson(res, 200, ctx.state);
    }

    // Publish drafted comments as a real GitHub PR review.
    if (url.pathname === '/api/submit' && req.method === 'POST') {
      const { verdict, body } = JSON.parse(await readBody(req)) as {
        verdict?: string;
        body?: string;
      };
      if (!verdict || !VERDICTS.includes(verdict as Verdict)) {
        return sendJson(res, 400, {
          ok: false,
          error: `verdict must be one of ${VERDICTS.join(', ')}`,
        });
      }
      if (ctx.state.submitted) {
        return sendJson(res, 410, {
          ok: false,
          error: 'this review was already submitted',
        });
      }
      const payload = buildReviewPayload(
        ctx.review.chunks,
        ctx.state.comments,
        verdict as Verdict,
        body ?? '',
        ctx.state.head_sha,
      );
      const result = await submitReview(ctx.review.pr, payload);
      if (result.ok) {
        ctx.state = {
          ...ctx.state,
          submitted: {
            at: new Date().toISOString(),
            verdict,
            url: result.html_url,
          },
        };
        await saveState(ctx.state);
      }
      const status = result.ok ? 200 : result.stale ? 409 : 502;
      return sendJson(res, status, { ...result, state: ctx.state });
    }

    // List all persisted reviews (for the review picker menu).
    if (url.pathname === '/api/reviews' && req.method === 'GET') {
      return sendJson(res, 200, await listReviews());
    }

    // Delete a review's persisted state file.
    const deleteMatch = url.pathname.match(
      /^\/api\/reviews\/([^/]+)\/([^/]+)\/(\d+)$/,
    );
    if (deleteMatch && req.method === 'DELETE') {
      const [, owner, repo, num] = deleteMatch;
      const pr: PrRef = { owner, repo, number: Number(num) };
      try {
        await deleteReview(pr);
        return sendJson(res, 200, { ok: true });
      } catch {
        return sendJson(res, 404, { ok: false, error: 'review not found' });
      }
    }

    // Open (fetch + load) a review and make it the active one.
    if (url.pathname === '/api/reviews/open' && req.method === 'POST') {
      const { ref } = JSON.parse(await readBody(req)) as { ref?: string };
      if (!ref) return sendJson(res, 400, { error: 'ref is required' });
      let pr: PrRef;
      try {
        pr = parseRef(ref);
      } catch (err) {
        return sendJson(res, 400, { error: (err as Error).message });
      }
      // Cancel any in-flight SSE stream so it can't write stale notes into the new ctx.
      currentCancel?.();
      currentCancel = null;
      try {
        const { review, state } = await loadReview(pr, { mockAi });
        ctx.review = review;
        ctx.state = state;
        await saveState(state);
        return sendJson(res, 200, { review: ctx.review, state: ctx.state });
      } catch (err) {
        return sendJson(res, 502, { error: (err as Error).message });
      }
    }

    // Server-Sent Events: stream a Claude note for a chunk (or the overview).
    if (url.pathname === '/api/claude') {
      const chunkId = url.searchParams.get('chunk_id') ?? '';
      const question = url.searchParams.get('q') ?? '';
      const isOverview = chunkId === OVERVIEW_ID;

      const chunk = isOverview
        ? null
        : ctx.review.chunks.find((c) => c.id === chunkId);
      if (!isOverview && !chunk)
        return sendJson(res, 404, { error: 'unknown chunk' });

      // An empty question means "explain/summarize" (an initial note).
      const kind: AiNoteKind = question.trim() ? 'investigation' : 'initial';
      const prompt = isOverview
        ? buildOverviewPrompt(
            ctx.review.meta,
            ctx.review.chunks,
            ctx.review.overview.jira,
            question,
          )
        : buildPrompt(chunk!, kind, question);
      // Suggested-action line only applies to per-chunk "explain" notes.
      const wantsAction = !isOverview && kind === 'initial';

      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const sse = (event: string, data: unknown) =>
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const cancel = streamClaude(prompt, {
        onDelta: (text) => sse('delta', { text }),
        onError: (message) => {
          currentCancel = null;
          sse('error', { message });
          res.end();
        },
        onDone: (full) => {
          currentCancel = null;
          const { body, suggestedAction } = wantsAction
            ? splitSuggestedAction(full)
            : { body: full.trim(), suggestedAction: undefined };
          ctx.state = applyAction(ctx.state, {
            type: 'add_note',
            chunk_id: isOverview ? OVERVIEW_ID : chunk!.id,
            kind,
            prompt: question.trim() || undefined,
            body,
            suggested_action: suggestedAction,
          });
          void saveState(ctx.state).then(() => {
            sse('done', { state: ctx.state });
            res.end();
          });
        },
      });
      currentCancel = cancel;
      req.on('close', () => {
        currentCancel = null;
        cancel();
      });
      return;
    }

    if (!serveUi)
      return sendJson(res, 404, { error: 'not found (api-only mode)' });
    return serveStatic(res, url.pathname);
  }

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => resolve({ url: `http://${host}:${port}` }));
  });
}
