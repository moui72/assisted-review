// Local-only HTTP server: serves the built UI (dist/), the review payload, and
// the mutable review state. Binds to 127.0.0.1 only — never exposed off-machine.

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import {
  applyAction,
  applyAiProviderConfigUpdate,
  deleteReview,
  listReviews,
  loadAiProviderConfig,
  saveAiProviderConfig,
  saveState,
} from './state.js';
import {
  getInvestigationConfig,
  loadInvestigationConfigs,
  saveInvestigationConfigs,
  configKey,
  ensureClone,
  refreshCloneIfStale,
  cleanupTempClone,
  markConfigUsed,
} from './investigation.js';
import { fetchFileContent } from './fetch.js';
import {
  buildOverviewPrompt,
  buildPrompt,
  splitSuggestedAction,
} from './claude.js';
import { defaultAiProviderAdapters, streamAiProvider } from './ai-provider.js';
import {
  buildReviewPayload,
  submitReview,
  submitGitLabReview,
  VERDICTS,
  GITLAB_VERDICTS,
  type Verdict,
  type GitLabVerdict,
} from './submit.js';
import { parseRef } from './parse-ref.js';
import { loadReview } from './review.js';
import { createMutex } from './mutex.js';
import {
  GitLabAuthError,
  gitLabTokenSource,
  setGitLabToken,
  clearGitLabToken,
  loadGitLabToken,
} from './gitlab-token.js';
import {
  OVERVIEW_ID,
  type Action,
  type AiNoteKind,
  type InvestigationConfig,
  type Platform,
  type PrRef,
  type Review,
  type ReviewState,
} from './types.js';

const INVESTIGATION_MODES: readonly InvestigationConfig['mode'][] = [
  'none',
  'local-path',
  'api',
  'temp-clone',
  'always-clone',
];

// dist/ is a sibling of this file's dir (src/ under tsx, build/ after tsc).
const DIST_DIR = join(import.meta.dirname, '..', 'dist');

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
  review: Review | null;
  state: ReviewState | null;
}

export interface StartOptions {
  port?: number;
  host?: string;
  serveUi?: boolean;
  mockAi?: boolean;
  preloadChunks?: number;
  preloadOverview?: boolean;
  appVersion?: string;
}

export async function startServer(
  ctx: AppContext,
  {
    port = 4319,
    host = '127.0.0.1',
    serveUi = true,
    mockAi = false,
    preloadChunks = 1,
    preloadOverview = true,
    appVersion = '',
  }: StartOptions = {},
): Promise<{ url: string }> {
  // Awaited, not fire-and-forget: shouldUseGlab() reads gitLabTokenSource(),
  // so a request arriving before the persisted token lands in memory would see
  // `null` and route through glab — exactly the precedence this is meant to fix.
  await loadGitLabToken();

  // Track the active AI SSE stream cancel fn — called before switching reviews
  // to prevent a finishing stream from writing notes into the wrong review's state.
  let currentCancel: (() => void) | null = null;

  // Serializes every read-modify-write-persist cycle against ctx.state, so
  // overlapping mutations (two POST /api/action calls, or an in-flight
  // AI stream's add_note landing alongside a manual action) can't race —
  // without this, a mutation could read ctx.state before an earlier one
  // finished writing it, then overwrite that earlier change once its own
  // (stale-based) write lands, both in memory and on disk.
  const withStateLock = createMutex();

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

    if (url.pathname === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, {
        preload_chunks: preloadChunks,
        preload_overview: preloadOverview,
        app_version: appVersion,
      });
    }

    if (url.pathname === '/api/ai-config') {
      if (req.method === 'GET') {
        return sendJson(res, 200, await loadAiProviderConfig());
      }
      if (req.method === 'POST') {
        let payload: unknown;
        try {
          payload = JSON.parse(await readBody(req)) as unknown;
        } catch {
          return sendJson(res, 400, { error: 'request body must be valid JSON' });
        }
        try {
          const current = await loadAiProviderConfig();
          const next = applyAiProviderConfigUpdate(current, payload);
          return sendJson(res, 200, await saveAiProviderConfig(next));
        } catch (err) {
          return sendJson(res, 400, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (url.pathname === '/api/review') {
      if (req.method === 'GET') {
        if (!ctx.review) { res.writeHead(204); res.end(); return; }
        return sendJson(res, 200, ctx.review);
      }
      if (req.method === 'DELETE') {
        currentCancel?.();
        currentCancel = null;
        if (ctx.review) {
          await deleteReview(ctx.review.pr).catch(() => {});
          await cleanupTempClone(ctx.review.pr);
        }
        ctx.review = null;
        ctx.state = null;
        return sendJson(res, 200, { ok: true });
      }
    }
    if (url.pathname === '/api/state') {
      if (!ctx.state) { res.writeHead(204); res.end(); return; }
      return sendJson(res, 200, ctx.state);
    }

    if (url.pathname === '/api/action' && req.method === 'POST') {
      if (!ctx.review || !ctx.state) return sendJson(res, 503, { error: 'no active review' });
      const action = JSON.parse(await readBody(req)) as Action;
      try {
        const nextState = await withStateLock(async () => {
          // Re-check inside the lock: the review may have been cleared while
          // this request was queued behind an earlier mutation.
          if (!ctx.state) throw new Error('no active review');
          const next = applyAction(ctx.state, action);
          ctx.state = next;
          await saveState(next);
          return next;
        });
        return sendJson(res, 200, nextState);
      } catch {
        return sendJson(res, 503, { error: 'no active review' });
      }
    }

    // Publish drafted comments as a real GitHub PR review.
    if (url.pathname === '/api/submit' && req.method === 'POST') {
      const { review, state } = ctx;
      if (!review || !state) return sendJson(res, 503, { error: 'no active review' });
      const { verdict, body } = JSON.parse(await readBody(req)) as {
        verdict?: string;
        body?: string;
      };
      const validVerdicts: readonly string[] =
        review.pr.platform === 'gitlab' ? GITLAB_VERDICTS : VERDICTS;
      if (!verdict || !validVerdicts.includes(verdict)) {
        return sendJson(res, 400, {
          ok: false,
          error: `verdict must be one of ${validVerdicts.join(', ')}`,
        });
      }
      if (state.submitted) {
        return sendJson(res, 410, {
          ok: false,
          error: 'this review was already submitted',
        });
      }
      let result;
      let nextState = state;
      if (review.pr.platform === 'gitlab') {
        result = await submitGitLabReview(
          review.pr,
          review.chunks,
          state.comments,
          verdict as GitLabVerdict,
          body ?? '',
          state.draft_head_sha,
          state.gitlab_submit_progress,
        );
        if (result.ok && !result.html_url && review.meta?.url) {
          result = { ...result, html_url: review.meta.url };
        }
        // Persist progress on every attempt, success or failure — a failed
        // attempt's partial progress is exactly what the next retry needs.
        // Only stamp `submitted` (and clear progress) once nothing is left
        // to retry.
        nextState = result.ok
          ? {
              ...state,
              submitted: { at: new Date().toISOString(), verdict, url: result.html_url },
              gitlab_submit_progress: undefined,
            }
          : { ...state, gitlab_submit_progress: result.progress };
        ctx.state = nextState;
        await saveState(nextState);
      } else {
        const payload = buildReviewPayload(
          review.chunks,
          state.comments,
          verdict as Verdict,
          body ?? '',
          state.draft_head_sha,
        );
        result = await submitReview(review.pr, payload);
        nextState = result.ok
          ? { ...state, submitted: { at: new Date().toISOString(), verdict, url: result.html_url } }
          : state;
        if (result.ok) {
          ctx.state = nextState;
          await saveState(nextState);
        }
      }
      const status = result.ok ? 200 : result.stale ? 409 : 502;
      // payload is echoed by the submit adapter for a possible future
      // manual-submit fallback — server-side only, never serialized to the
      // client (see api.md's Production Annotations). `progress` (GitLab
      // only) is likewise server-side/persisted-only — the client already
      // gets it via `state.gitlab_submit_progress`.
      const responseBody: Record<string, unknown> = { ...result, state: nextState };
      delete responseBody.payload;
      delete responseBody.progress;
      return sendJson(res, status, responseBody);
    }

    // List all persisted reviews (for the review picker menu).
    if (url.pathname === '/api/reviews' && req.method === 'GET') {
      return sendJson(res, 200, await listReviews());
    }

    // Delete a review's persisted state file.
    // URL: /api/reviews/:platform/:encodedOwner/:repo/:number
    const deleteMatch = url.pathname.match(
      /^\/api\/reviews\/(github|gitlab)\/([^/]+)\/([^/]+)\/(\d+)$/,
    );
    if (deleteMatch && req.method === 'DELETE') {
      const [, platform, encodedOwner, repo, num] = deleteMatch;
      const pr: PrRef = {
        platform: platform as Platform,
        owner: decodeURIComponent(encodedOwner),
        repo,
        number: Number(num),
      };
      try {
        await deleteReview(pr);
        return sendJson(res, 200, { ok: true });
      } catch {
        return sendJson(res, 404, { ok: false, error: 'review not found' });
      }
    }

    // Open (fetch + load) a review and make it the active one.
    if (url.pathname === '/api/reviews/open' && req.method === 'POST') {
      let ref: string | undefined;
      try {
        ({ ref } = JSON.parse(await readBody(req)) as { ref?: string });
      } catch {
        return sendJson(res, 400, { error: 'request body must be valid JSON' });
      }
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
      // Switching away from a repo with a temp-clone config cleans it up —
      // temp clones are scoped to "the rest of this review session."
      if (ctx.review) await cleanupTempClone(ctx.review.pr);
      try {
        const { review, state } = await loadReview(pr, { mockAi });
        ctx.review = review;
        ctx.state = state;
        await saveState(state);
        return sendJson(res, 200, { review: ctx.review, state: ctx.state });
      } catch (err) {
        if (err instanceof GitLabAuthError) {
          return sendJson(res, 401, { error: (err as Error).message, auth_required: 'gitlab' });
        }
        return sendJson(res, 502, { error: (err as Error).message });
      }
    }

    if (url.pathname === '/api/investigation-config') {
      if (!ctx.review) return sendJson(res, 503, { error: 'no active review' });
      if (req.method === 'GET') {
        return sendJson(res, 200, await getInvestigationConfig(ctx.review.pr));
      }
      if (req.method === 'POST') {
        const { mode, local_path } = JSON.parse(await readBody(req)) as {
          mode?: string;
          local_path?: string;
        };
        if (!mode || !INVESTIGATION_MODES.includes(mode as InvestigationConfig['mode'])) {
          return sendJson(res, 400, {
            error: `mode must be one of ${INVESTIGATION_MODES.join(', ')}`,
          });
        }
        if (mode === 'local-path') {
          if (!local_path) {
            return sendJson(res, 400, { error: 'local_path is required for mode local-path' });
          }
          try {
            const st = await stat(local_path);
            if (!st.isDirectory()) throw new Error('not a directory');
          } catch {
            return sendJson(res, 400, { error: `local_path is not an existing directory: ${local_path}` });
          }
        }
        const pr = ctx.review.pr;
        let clonePath: string | undefined;
        if (mode === 'temp-clone' || mode === 'always-clone') {
          try {
            clonePath = await ensureClone({
              platform: pr.platform,
              owner: pr.owner,
              repo: pr.repo,
              mode,
              chosen_at: '',
            });
          } catch (err) {
            return sendJson(res, 502, {
              error: `clone failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
        const config: InvestigationConfig = {
          platform: pr.platform,
          owner: pr.owner,
          repo: pr.repo,
          mode: mode as InvestigationConfig['mode'],
          ...(mode === 'local-path' ? { local_path } : {}),
          ...(clonePath ? { clone_path: clonePath } : {}),
          chosen_at: new Date().toISOString(),
          // Seed the idle clock at creation so an always-clone that's chosen
          // but never subsequently investigated still prunes 30 days later,
          // rather than living forever with an unset `last_used`.
          ...(mode === 'always-clone' ? { last_used: new Date().toISOString() } : {}),
        };
        const configs = await loadInvestigationConfigs();
        configs[configKey(pr)] = config;
        await saveInvestigationConfigs(configs);
        return sendJson(res, 200, config);
      }
    }

    // Server-Sent Events: stream an AI note for a chunk (or the overview).
    if (url.pathname === '/api/ai' || url.pathname === '/api/claude') {
      const { review, state: initialState } = ctx;
      if (!review || !initialState) return sendJson(res, 503, { error: 'no active review' });

      const chunkId = url.searchParams.get('chunk_id') ?? '';
      const question = url.searchParams.get('q') ?? '';
      const isOverview = chunkId === OVERVIEW_ID;

      const chunk = isOverview
        ? null
        : review.chunks.find((c) => c.id === chunkId);
      if (!isOverview && !chunk)
        return sendJson(res, 404, { error: 'unknown chunk' });

      // Cancel any stream already in flight so it can't write a stale note
      // into the wrong chunk/review once this one completes.
      currentCancel?.();

      // Resolve investigation access for this repo (Repo Investigation
      // Access, infrastructure.md).
      const investigationConfig = await getInvestigationConfig(review.pr);
      if (investigationConfig.mode === 'always-clone') {
        await refreshCloneIfStale(investigationConfig, review.meta.head_sha);
        // Bump the idle clock so this actively-used clone isn't TTL-pruned.
        await markConfigUsed(review.pr);
      }
      const streamOpts =
        investigationConfig.mode === 'local-path'
          ? { cwd: investigationConfig.local_path, allowRepoRead: true }
          : investigationConfig.mode === 'temp-clone' || investigationConfig.mode === 'always-clone'
            ? { cwd: investigationConfig.clone_path, allowRepoRead: true }
            : undefined;
      let fileContents: Map<string, string> | undefined;
      if (investigationConfig.mode === 'api') {
        const files = isOverview
          ? [...new Set(review.chunks.map((c) => c.file))]
          : [chunk!.file];
        fileContents = new Map();
        for (const file of files) {
          const content = await fetchFileContent(review.pr, file, review.meta.head_sha);
          if (content !== null) fileContents.set(file, content);
        }
      }

      // An empty question means "explain/summarize" (an initial note).
      const kind: AiNoteKind = question.trim() ? 'investigation' : 'initial';
      const allowRepoRead = streamOpts !== undefined;
      const targetId = isOverview ? OVERVIEW_ID : chunk!.id;
      const history = initialState.notes.filter((n) => n.chunk_id === targetId);
      const prompt = isOverview
        ? buildOverviewPrompt(
            review.meta,
            review.chunks,
            review.overview.jira,
            question,
            fileContents,
            allowRepoRead,
            history,
          )
        : buildPrompt(chunk!, kind, question, fileContents, allowRepoRead, history);
      // Suggested-action line only applies to per-chunk "explain" notes.
      const wantsAction = !isOverview && kind === 'initial';

      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      const sse = (event: string, data: unknown) =>
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const aiConfig = await loadAiProviderConfig();
      const cancel = streamAiProvider(prompt, aiConfig, {
        onDelta: (text) => sse('delta', { text }),
        onError: (message) => {
          if (currentCancel === cancel) currentCancel = null;
          sse('error', { message });
          res.end();
        },
        onDone: (full) => {
          if (currentCancel === cancel) currentCancel = null;
          // Guard: the review may have been cleared while the stream was in flight.
          if (!ctx.state) { res.end(); return; }
          const { body, suggestedAction } = wantsAction
            ? splitSuggestedAction(full)
            : { body: full.trim(), suggestedAction: undefined };
          void withStateLock(async () => {
            // Re-check inside the lock: the review may have been cleared, or
            // a queued POST /api/action may have run, while this was waiting.
            if (!ctx.state) return null;
            const nextState = applyAction(ctx.state, {
              type: 'add_note',
              chunk_id: isOverview ? OVERVIEW_ID : chunk!.id,
              kind,
              prompt: question.trim() || undefined,
              body,
              suggested_action: suggestedAction,
              file: isOverview ? undefined : chunk!.file,
              hunk_header: isOverview ? undefined : chunk!.hunk_header,
            });
            ctx.state = nextState;
            await saveState(nextState);
            return nextState;
          })
            .then((nextState) => {
              if (nextState) sse('done', { state: nextState });
              res.end();
            })
            .catch((err: unknown) => {
              sse('error', { message: err instanceof Error ? err.message : String(err) });
              res.end();
            });
        },
      }, defaultAiProviderAdapters, streamOpts);
      currentCancel = cancel;
      req.on('close', () => {
        if (currentCancel === cancel) currentCancel = null;
        cancel();
      });
      return;
    }

    if (url.pathname === '/api/auth/gitlab') {
      if (req.method === 'GET') {
        const source = gitLabTokenSource();
        return sendJson(res, 200, { authenticated: source !== null, source });
      }
      if (req.method === 'POST') {
        let payload: { token?: unknown };
        try {
          payload = JSON.parse(await readBody(req)) as { token?: unknown };
        } catch {
          return sendJson(res, 400, { error: 'request body must be valid JSON' });
        }
        if (typeof payload.token !== 'string' || !payload.token.trim()) {
          return sendJson(res, 400, { error: 'token is required' });
        }
        await setGitLabToken(payload.token.trim());
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        await clearGitLabToken();
        return sendJson(res, 200, { ok: true });
      }
    }

    if (!serveUi)
      return sendJson(res, 404, { error: 'not found (api-only mode)' });
    return serveStatic(res, url.pathname);
  }

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ url: `http://${host}:${boundPort}` });
    });
  });
}
