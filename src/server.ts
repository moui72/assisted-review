// Local-only HTTP server: serves the built UI (dist/), the review payload, and
// the mutable review state. Binds to 127.0.0.1 only — never exposed off-machine.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { applyAction, saveState } from './state';
import { buildOverviewPrompt, buildPrompt, splitSuggestedAction, streamClaude } from './claude';
import { OVERVIEW_ID, type Action, type AiNoteKind, type Review, type ReviewState } from './types';

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

async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
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
}

export function startServer(
  ctx: AppContext,
  { port = 4319, host = '127.0.0.1', serveUi = true }: StartOptions = {},
): Promise<{ url: string }> {
  const server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${host}`);

    if (url.pathname === '/api/review') return sendJson(res, 200, ctx.review);
    if (url.pathname === '/api/state') return sendJson(res, 200, ctx.state);

    if (url.pathname === '/api/action' && req.method === 'POST') {
      const action = JSON.parse(await readBody(req)) as Action;
      ctx.state = applyAction(ctx.state, action);
      await saveState(ctx.state);
      return sendJson(res, 200, ctx.state);
    }

    // Server-Sent Events: stream a Claude note for a chunk (or the overview).
    if (url.pathname === '/api/claude') {
      const chunkId = url.searchParams.get('chunk_id') ?? '';
      const question = url.searchParams.get('q') ?? '';
      const isOverview = chunkId === OVERVIEW_ID;

      const chunk = isOverview ? null : ctx.review.chunks.find((c) => c.id === chunkId);
      if (!isOverview && !chunk) return sendJson(res, 404, { error: 'unknown chunk' });

      // An empty question means "explain/summarize" (an initial note).
      const kind: AiNoteKind = question.trim() ? 'investigation' : 'initial';
      const prompt = isOverview
        ? buildOverviewPrompt(ctx.review.meta, ctx.review.chunks, ctx.review.overview.jira, question)
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
          sse('error', { message });
          res.end();
        },
        onDone: (full) => {
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
      req.on('close', cancel);
      return;
    }

    if (!serveUi) return sendJson(res, 404, { error: 'not found (api-only mode)' });
    return serveStatic(res, url.pathname);
  }

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => resolve({ url: `http://${host}:${port}` }));
  });
}
