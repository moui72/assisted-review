import { vi } from 'vitest';

vi.mock('../src/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/state')>();
  return {
    ...actual,
    applyAction: vi.fn((state: unknown) => state),
    saveState: vi.fn().mockResolvedValue(undefined),
    deleteReview: vi.fn().mockResolvedValue(undefined),
    listReviews: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../src/claude', () => ({
  streamClaude: vi.fn((_prompt: unknown, handlers: { onDone: (full: string) => void }) => {
    // Call onDone immediately so the server flushes headers and closes the response.
    process.nextTick(() => handlers.onDone('AI text'));
    return () => {};
  }),
  buildPrompt: vi.fn().mockReturnValue('chunk prompt'),
  buildOverviewPrompt: vi.fn().mockReturnValue('overview prompt'),
  splitSuggestedAction: vi.fn().mockReturnValue({ body: 'the body', suggestedAction: undefined }),
}));

vi.mock('../src/review', () => ({
  loadReview: vi.fn(),
}));

vi.mock('../src/submit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/submit')>();
  return { ...actual, submitReview: vi.fn(), submitGitLabReview: vi.fn() };
});

vi.mock('../src/gitlab-token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/gitlab-token')>();
  return {
    ...actual,
    loadGitLabToken: vi.fn().mockResolvedValue(undefined),
    setGitLabToken: vi.fn().mockResolvedValue(undefined),
    clearGitLabToken: vi.fn().mockResolvedValue(undefined),
    gitLabTokenSource: vi.fn().mockReturnValue(null),
  };
});

import { startServer, type AppContext } from '../src/server';
import { applyAction, saveState, deleteReview, listReviews } from '../src/state';
import { loadReview } from '../src/review';
import { submitReview, submitGitLabReview } from '../src/submit';
import {
  GitLabAuthError,
  gitLabTokenSource,
  setGitLabToken,
  clearGitLabToken,
} from '../src/gitlab-token';
import type { Review, ReviewState } from '../src/types';
import { STATE_VERSION, OVERVIEW_ID } from '../src/types';

// ---- fixtures ----

const pr = { owner: 'alice', repo: 'proj', number: 42, platform: 'github' as const };

const chunk = {
  id: 'c1',
  file: 'src/foo.ts',
  hunk_header: '@@ -1,1 +1,1 @@',
  old_range: [1, 1] as [number, number],
  new_range: [1, 1] as [number, number],
  context: '',
  diff: '@@ -1,1 +1,1 @@\n-old\n+new',
  members: [],
};

const meta = {
  title: 'Test PR',
  author: 'alice',
  base_ref: 'main',
  head_ref: 'feat/x',
  is_draft: false,
  url: 'https://github.com/alice/proj/pull/42',
  head_sha: 'abc',
  body: '',
};

const review: Review = {
  pr,
  meta,
  chunks: [chunk],
  overview: { jira: { available: false, keys: [], issues: [] } },
  generated_at: new Date().toISOString(),
};

const state: ReviewState = {
  version: STATE_VERSION,
  pr,
  head_sha: 'abc',
  started_at: new Date().toISOString(),
  comments: [],
  flagged: [],
  viewed: [],
  notes: [],
};

// ---- helpers ----

async function makeServer(ctx: AppContext) {
  const { url } = await startServer(ctx, { port: 0, serveUi: false });
  return url;
}

async function get(url: string, path: string) {
  return fetch(`${url}${path}`);
}

async function post(url: string, path: string, body: unknown) {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function del(url: string, path: string) {
  return fetch(`${url}${path}`, { method: 'DELETE' });
}

// ---- tests ----

describe('GET /api/config', () => {
  it('returns preload settings', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/config');
    expect(res.status).toBe(200);
    const body = await res.json() as { preload_chunks: number; preload_overview: boolean };
    expect(typeof body.preload_chunks).toBe('number');
    expect(typeof body.preload_overview).toBe('boolean');
  });
});

describe('GET /api/review', () => {
  it('returns 204 when no review is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/review');
    expect(res.status).toBe(204);
  });

  it('returns the review when loaded', async () => {
    const url = await makeServer({ review, state });
    const res = await get(url, '/api/review');
    expect(res.status).toBe(200);
    const body = await res.json() as Review;
    expect(body.pr).toEqual(pr);
  });
});

describe('DELETE /api/review', () => {
  it('clears the active review and state', async () => {
    const ctx: AppContext = { review, state };
    const url = await makeServer(ctx);
    const res = await del(url, '/api/review');
    expect(res.status).toBe(200);
    expect(ctx.review).toBeNull();
    expect(ctx.state).toBeNull();
  });

  it('calls deleteReview on the loaded pr', async () => {
    const url = await makeServer({ review, state });
    await del(url, '/api/review');
    expect(vi.mocked(deleteReview)).toHaveBeenCalledWith(pr);
  });
});

describe('GET /api/state', () => {
  it('returns 204 when no state is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/state');
    expect(res.status).toBe(204);
  });

  it('returns state when loaded', async () => {
    const url = await makeServer({ review, state });
    const res = await get(url, '/api/state');
    expect(res.status).toBe(200);
    const body = await res.json() as ReviewState;
    expect(body.pr).toEqual(pr);
  });
});

describe('POST /api/action', () => {
  it('returns 503 when no review is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/action', { type: 'toggle_flag', chunk_id: 'c1' });
    expect(res.status).toBe(503);
  });

  it('applies action, saves, and returns the new state', async () => {
    const nextState = { ...state, flagged: ['c1'] };
    vi.mocked(applyAction).mockReturnValueOnce(nextState);

    const url = await makeServer({ review, state });
    const res = await post(url, '/api/action', { type: 'toggle_flag', chunk_id: 'c1' });
    expect(res.status).toBe(200);
    expect(vi.mocked(applyAction)).toHaveBeenCalled();
    expect(vi.mocked(saveState)).toHaveBeenCalledWith(nextState);
  });
});

describe('POST /api/submit', () => {
  it('returns 503 when no review is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/submit', { verdict: 'COMMENT', body: '' });
    expect(res.status).toBe(503);
  });

  it('returns 400 for an invalid verdict', async () => {
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/submit', { verdict: 'INVALID', body: '' });
    expect(res.status).toBe(400);
  });

  it('returns 410 when review is already submitted', async () => {
    const submitted = { ...state, submitted: { at: new Date().toISOString(), verdict: 'COMMENT' } };
    const url = await makeServer({ review, state: submitted });
    const res = await post(url, '/api/submit', { verdict: 'COMMENT', body: '' });
    expect(res.status).toBe(410);
  });

  it('returns 200 on successful submission', async () => {
    vi.mocked(submitReview).mockResolvedValueOnce({ ok: true, html_url: 'https://github.com/review/1' });
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/submit', { verdict: 'APPROVE', body: 'LGTM' });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 502 on submitReview failure', async () => {
    vi.mocked(submitReview).mockResolvedValueOnce({ ok: false, error: 'gh failed' });
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/submit', { verdict: 'COMMENT', body: '' });
    expect(res.status).toBe(502);
  });

  it('returns 409 when SHA is stale', async () => {
    vi.mocked(submitReview).mockResolvedValueOnce({
      ok: false,
      stale: { old: 'abc', new_head: 'def', inline_count: 1 },
    });
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/submit', { verdict: 'REQUEST_CHANGES', body: '' });
    expect(res.status).toBe(409);
  });

  it('routes GitLab review to submitGitLabReview', async () => {
    const glReview: Review = { ...review, pr: { ...review.pr, platform: 'gitlab' } };
    vi.mocked(submitGitLabReview).mockClear();
    vi.mocked(submitReview).mockClear();
    vi.mocked(submitGitLabReview).mockResolvedValueOnce({ ok: true });
    const url = await makeServer({ review: glReview, state });
    const res = await post(url, '/api/submit', { verdict: 'comment', body: 'summary' });
    expect(res.status).toBe(200);
    expect(vi.mocked(submitGitLabReview)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitReview)).toHaveBeenCalledTimes(0);
  });

  it('injects html_url from review meta when submitGitLabReview returns none', async () => {
    const glReview: Review = { ...review, pr: { ...review.pr, platform: 'gitlab' } };
    vi.mocked(submitGitLabReview).mockResolvedValueOnce({ ok: true });
    const url = await makeServer({ review: glReview, state });
    const res = await post(url, '/api/submit', { verdict: 'comment', body: 'summary' });
    const body = (await res.json()) as { html_url?: string };
    expect(body.html_url).toBe(meta.url);
  });

  it('does not override html_url when submitGitLabReview already returns one', async () => {
    const glReview: Review = { ...review, pr: { ...review.pr, platform: 'gitlab' } };
    vi.mocked(submitGitLabReview).mockResolvedValueOnce({ ok: true, html_url: 'https://gitlab.com/x/y/-/merge_requests/1' });
    const url = await makeServer({ review: glReview, state });
    const res = await post(url, '/api/submit', { verdict: 'comment', body: 'summary' });
    const body = (await res.json()) as { html_url?: string };
    expect(body.html_url).toBe('https://gitlab.com/x/y/-/merge_requests/1');
  });

  it('rejects GitLab verdict for a GitHub PR', async () => {
    const url = await makeServer({ review, state }); // review.pr.platform = 'github'
    const res = await post(url, '/api/submit', { verdict: 'approve', body: '' });
    expect(res.status).toBe(400);
  });

  it('rejects GitHub verdict for a GitLab MR', async () => {
    const glReview: Review = { ...review, pr: { ...review.pr, platform: 'gitlab' } };
    const url = await makeServer({ review: glReview, state });
    const res = await post(url, '/api/submit', { verdict: 'APPROVE', body: 'LGTM' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/reviews', () => {
  it('returns a list of reviews', async () => {
    vi.mocked(listReviews).mockResolvedValueOnce([
      {
        pr,
        head_sha: 'abc',
        started_at: new Date().toISOString(),
        comment_count: 0,
        flagged_count: 0,
        viewed_count: 0,
      },
    ]);
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/reviews');
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });
});

describe('DELETE /api/reviews/:platform/:owner/:repo/:num', () => {
  it('deletes the specified GitHub review', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await del(url, '/api/reviews/github/alice/proj/42');
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteReview)).toHaveBeenCalledWith({ owner: 'alice', repo: 'proj', number: 42, platform: 'github' });
  });

  it('decodes URL-encoded owner for GitLab', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await del(url, '/api/reviews/gitlab/group%2Fsubteam/proj/7');
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteReview)).toHaveBeenCalledWith({ owner: 'group/subteam', repo: 'proj', number: 7, platform: 'gitlab' });
  });

  it('returns 404 when the review file is not found', async () => {
    vi.mocked(deleteReview).mockRejectedValueOnce(new Error('not found'));
    const url = await makeServer({ review: null, state: null });
    const res = await del(url, '/api/reviews/github/alice/proj/99');
    expect(res.status).toBe(404);
  });

  it('returns 404 for the old URL format without platform', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await del(url, '/api/reviews/alice/proj/42');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/reviews/open', () => {
  it('returns 400 when body is missing ref', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/reviews/open', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await fetch(`${url}/api/reviews/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unparseable ref string', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/reviews/open', { ref: 'not-a-pr-ref' });
    expect(res.status).toBe(400);
  });

  it('returns 200 and loads review on valid ref', async () => {
    vi.mocked(loadReview).mockResolvedValueOnce({ review, state });
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/reviews/open', { ref: 'alice/proj#42' });
    expect(res.status).toBe(200);
    expect(vi.mocked(loadReview)).toHaveBeenCalled();
  });

  it('returns 502 when loadReview throws', async () => {
    vi.mocked(loadReview).mockRejectedValueOnce(new Error('gh not found'));
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/reviews/open', { ref: 'alice/proj#42' });
    expect(res.status).toBe(502);
  });

  it('returns 401 with auth_required when GitLabAuthError is thrown', async () => {
    vi.mocked(loadReview).mockRejectedValueOnce(new GitLabAuthError('token required'));
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/reviews/open', { ref: 'alice/proj#42' });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; auth_required: string };
    expect(body.auth_required).toBe('gitlab');
  });
});

describe('GET /api/auth/gitlab', () => {
  it('returns authenticated: false when no token is set', async () => {
    vi.mocked(gitLabTokenSource).mockReturnValueOnce(null);
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/auth/gitlab');
    expect(res.status).toBe(200);
    const body = await res.json() as { authenticated: boolean; source: null };
    expect(body.authenticated).toBe(false);
    expect(body.source).toBeNull();
  });

  it('returns authenticated: true with source when a token is set', async () => {
    vi.mocked(gitLabTokenSource).mockReturnValueOnce('browser');
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/auth/gitlab');
    expect(res.status).toBe(200);
    const body = await res.json() as { authenticated: boolean; source: string };
    expect(body.authenticated).toBe(true);
    expect(body.source).toBe('browser');
  });
});

describe('POST /api/auth/gitlab', () => {
  it('saves the token and returns ok: true', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/auth/gitlab', { token: 'glpat-abc123' });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(vi.mocked(setGitLabToken)).toHaveBeenCalledWith('glpat-abc123');
  });

  it('returns 400 when token field is missing', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/auth/gitlab', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 when token is blank', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/auth/gitlab', { token: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await fetch(`${url}/api/auth/gitlab`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/auth/gitlab', () => {
  it('clears the token and returns ok: true', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await del(url, '/api/auth/gitlab');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(vi.mocked(clearGitLabToken)).toHaveBeenCalled();
  });
});

describe('GET /api/claude', () => {
  it('returns 503 when no review is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, `/api/claude?chunk_id=c1`);
    expect(res.status).toBe(503);
  });

  it('returns 404 for an unknown chunk_id', async () => {
    const url = await makeServer({ review, state });
    const res = await get(url, '/api/claude?chunk_id=not-a-real-chunk');
    expect(res.status).toBe(404);
  });

  it('starts an SSE stream for a valid chunk_id', async () => {
    const url = await makeServer({ review, state });
    const res = await get(url, '/api/claude?chunk_id=c1');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });

  it('starts an SSE stream for the overview chunk id', async () => {
    const url = await makeServer({ review, state });
    const res = await get(url, `/api/claude?chunk_id=${OVERVIEW_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });
});

describe('unknown routes in api-only mode', () => {
  it('returns 404 for unrecognized paths', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/totally-unknown');
    expect(res.status).toBe(404);
  });
});
