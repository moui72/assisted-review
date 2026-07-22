import { vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

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

vi.mock('../src/fetch', () => ({
  fetchFileContent: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/investigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/investigation')>();
  return { ...actual, refreshCloneIfStale: vi.fn().mockResolvedValue(undefined) };
});

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
import {
  applyAction,
  loadAiProviderConfig,
  saveAiProviderConfig,
  saveState,
  deleteReview,
  listReviews,
  STATE_DIR,
} from '../src/state';
import { loadReview } from '../src/review';
import { submitReview, submitGitLabReview } from '../src/submit';
import {
  GitLabAuthError,
  gitLabTokenSource,
  setGitLabToken,
  clearGitLabToken,
} from '../src/gitlab-token';
import { streamClaude } from '../src/claude';
import { fetchFileContent } from '../src/fetch';
import { saveInvestigationConfigs, configKey } from '../src/investigation';
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
  draft_head_sha: 'abc',
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

  it('returns app_version matching the value passed via StartOptions', async () => {
    const { url } = await startServer(
      { review: null, state: null },
      { port: 0, serveUi: false, appVersion: '9.9.9-test' },
    );
    const res = await get(url, '/api/config');
    expect(res.status).toBe(200);
    const body = await res.json() as { app_version: string };
    expect(body.app_version).toBe('9.9.9-test');
  });
});

describe('GET/POST /api/ai-config', () => {
  const configPath = join(STATE_DIR, 'ai-config.json');

  beforeEach(async () => {
    await rm(configPath, { force: true });
    await rm(`${configPath}.tmp`, { force: true });
  });

  afterEach(async () => {
    await rm(configPath, { force: true });
    await rm(`${configPath}.tmp`, { force: true });
  });

  it('GET returns the default Claude config without an active review', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/ai-config');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      provider: 'claude',
      updated_at: '1970-01-01T00:00:00.000Z',
    });
  });

  it('POST persists and returns a normalized Claude config', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/ai-config', {
      provider: 'claude',
      claude_model: '  claude-sonnet  ',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { provider: string; claude_model?: string; updated_at: string };
    expect(body.provider).toBe('claude');
    expect(body.claude_model).toBe('claude-sonnet');
    expect(Number.isNaN(Date.parse(body.updated_at))).toBe(false);
    await expect(loadAiProviderConfig()).resolves.toMatchObject({
      provider: 'claude',
      claude_model: 'claude-sonnet',
    });
  });

  it('POST preserves the inactive provider model when switching providers', async () => {
    await saveAiProviderConfig({
      provider: 'claude',
      claude_model: 'sonnet',
      codex_model: 'gpt-5-codex',
      updated_at: 'old',
    });
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/ai-config', {
      provider: 'codex',
      codex_model: 'gpt-5',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      provider: 'codex',
      claude_model: 'sonnet',
      codex_model: 'gpt-5',
    });
  });

  it('POST rejects an invalid provider without mutating the saved config', async () => {
    await saveAiProviderConfig({
      provider: 'claude',
      claude_model: 'sonnet',
      updated_at: 'old',
    });
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/ai-config', { provider: 'openai' });
    expect(res.status).toBe(400);
    await expect(loadAiProviderConfig()).resolves.toMatchObject({
      provider: 'claude',
      claude_model: 'sonnet',
      updated_at: 'old',
    });
  });

  it('POST rejects invalid JSON without mutating the saved config', async () => {
    await saveAiProviderConfig({
      provider: 'codex',
      codex_model: 'gpt-5-codex',
      updated_at: 'old',
    });
    const url = await makeServer({ review: null, state: null });
    const res = await fetch(`${url}/api/ai-config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    await expect(loadAiProviderConfig()).resolves.toMatchObject({
      provider: 'codex',
      codex_model: 'gpt-5-codex',
      updated_at: 'old',
    });
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

  it('cleans up a temp-clone for the closed review', async () => {
    const { STATE_DIR } = await import('../src/state');
    const { mkdir, stat } = await import('node:fs/promises');
    const dest = join(STATE_DIR, 'repos', 'tmp-close-test');
    await mkdir(dest, { recursive: true });
    await saveInvestigationConfigs({
      [configKey(pr)]: {
        platform: pr.platform,
        owner: pr.owner,
        repo: pr.repo,
        mode: 'temp-clone',
        clone_path: dest,
        chosen_at: new Date().toISOString(),
      },
    });
    const url = await makeServer({ review, state });
    await del(url, '/api/review');
    await expect(stat(dest)).rejects.toThrow();
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
    const nextState = {
      ...state,
      flagged: [{ chunk_id: 'c1', file: 'a.ts', hunk_header: '@@ -1,3 +1,3 @@', displaced: false }],
    };
    vi.mocked(applyAction).mockReturnValueOnce(nextState);

    const url = await makeServer({ review, state });
    const res = await post(url, '/api/action', { type: 'toggle_flag', chunk_id: 'c1' });
    expect(res.status).toBe(200);
    expect(vi.mocked(applyAction)).toHaveBeenCalled();
    expect(vi.mocked(saveState)).toHaveBeenCalledWith(nextState);
  });

  it('returns 503 for a request that finds the review cleared once its turn in the lock comes', async () => {
    // A's save is slow, so it holds the state lock for a while.
    vi.mocked(saveState).mockImplementation(() => new Promise((r) => setTimeout(r, 30)));

    const ctx: AppContext = { review, state };
    const url = await makeServer(ctx);

    const resAPromise = post(url, '/api/action', { type: 'toggle_flag', chunk_id: 'c1' });
    await new Promise((r) => setTimeout(r, 5)); // let A enter its locked section

    // B is issued while the review is still valid, so it passes its own
    // initial guard — then queues behind A's still-running lock.
    const resBPromise = post(url, '/api/action', { type: 'toggle_flag', chunk_id: 'c2' });
    await new Promise((r) => setTimeout(r, 5)); // let B's request queue at the lock

    // Simulate a concurrent DELETE /api/review clearing the active review
    // while B is queued, waiting for A's lock to release.
    ctx.state = null;

    const resB = await resBPromise;
    expect(resB.status).toBe(503);

    // A itself still succeeds — it captured its own next state before the
    // lock, well before ctx.state was cleared.
    const resA = await resAPromise;
    expect(resA.status).toBe(200);
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

  it('never sends payload to the client, even when the adapter echoes it', async () => {
    vi.mocked(submitReview).mockResolvedValueOnce({
      ok: false,
      error: 'gh failed',
      payload: { event: 'COMMENT', body: '', commit_id: 'abc', comments: [] },
    });
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/submit', { verdict: 'COMMENT', body: '' });
    const body = await res.json() as Record<string, unknown>;
    expect('payload' in body).toBe(false);
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

  it('uses draft_head_sha, not latest head_sha, for GitHub stale checks', async () => {
    const draftedState: ReviewState = {
      ...state,
      head_sha: 'latest-sha',
      draft_head_sha: 'drafted-sha',
      comments: [
        {
          id: 'draft-1',
          chunk_id: 'c1',
          side: 'RIGHT',
          line: 1,
          body: 'drafted before refresh',
          file: chunk.file,
          hunk_header: chunk.hunk_header,
          displaced: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    vi.mocked(submitReview).mockResolvedValueOnce({
      ok: false,
      stale: { old: 'drafted-sha', new_head: 'latest-sha', inline_count: 1 },
    });
    const url = await makeServer({ review, state: draftedState });
    const res = await post(url, '/api/submit', { verdict: 'COMMENT', body: '' });
    expect(res.status).toBe(409);
    expect(vi.mocked(submitReview)).toHaveBeenCalledWith(
      review.pr,
      expect.objectContaining({ commit_id: 'drafted-sha' }),
    );
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

  it('uses draft_head_sha, not latest head_sha, for GitLab stale checks', async () => {
    const glReview: Review = { ...review, pr: { ...review.pr, platform: 'gitlab' } };
    const draftedState: ReviewState = {
      ...state,
      pr: glReview.pr,
      head_sha: 'latest-sha',
      draft_head_sha: 'drafted-sha',
      comments: [
        {
          id: 'draft-1',
          chunk_id: 'c1',
          side: 'RIGHT',
          line: 1,
          body: 'drafted before refresh',
          file: chunk.file,
          hunk_header: chunk.hunk_header,
          displaced: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    vi.mocked(submitGitLabReview).mockResolvedValueOnce({
      ok: false,
      stale: { old: 'drafted-sha', new_head: 'latest-sha', inline_count: 1 },
      progress: { posted_comment_ids: [], note_posted: false, approved: false },
    });
    const url = await makeServer({ review: glReview, state: draftedState });
    const res = await post(url, '/api/submit', { verdict: 'comment', body: '' });
    expect(res.status).toBe(409);
    expect(vi.mocked(submitGitLabReview)).toHaveBeenCalledWith(
      glReview.pr,
      glReview.chunks,
      draftedState.comments,
      'comment',
      '',
      'drafted-sha',
      undefined,
    );
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

  it('persists gitlab_submit_progress on partial failure, then a retry succeeds and stamps submitted', async () => {
    const glReview: Review = { ...review, pr: { ...review.pr, platform: 'gitlab' } };
    const ctx: AppContext = { review: glReview, state: { ...state } };
    const url = await makeServer(ctx);

    const partialProgress = {
      posted_comment_ids: ['c-succeeded'],
      note_posted: false,
      approved: false,
    };
    vi.mocked(submitGitLabReview).mockResolvedValueOnce({
      ok: false,
      comment_errors: [{ path: 'a.ts', line: 1, error: 'boom' }],
      progress: partialProgress,
    });

    const first = await post(url, '/api/submit', { verdict: 'comment', body: 'summary' });
    expect(first.status).toBe(502);
    const firstBody = (await first.json()) as { state: ReviewState; progress?: unknown };
    expect(firstBody.state.gitlab_submit_progress).toEqual(partialProgress);
    expect(firstBody.state.submitted).toBeUndefined();
    expect(firstBody.progress).toBeUndefined(); // stripped — persisted via state instead
    expect(vi.mocked(saveState)).toHaveBeenCalledWith(
      expect.objectContaining({ gitlab_submit_progress: partialProgress }),
    );
    expect(ctx.state?.gitlab_submit_progress).toEqual(partialProgress);

    vi.mocked(submitGitLabReview).mockResolvedValueOnce({
      ok: true,
      html_url: 'https://gitlab.com/x/y/-/merge_requests/1',
      progress: { posted_comment_ids: ['c-succeeded', 'c-retried'], note_posted: true, approved: false },
    });

    const second = await post(url, '/api/submit', { verdict: 'comment', body: 'summary' });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { state: ReviewState };
    expect(secondBody.state.submitted).toBeDefined();
    expect(secondBody.state.gitlab_submit_progress).toBeUndefined();
    // The retry call passes the previous attempt's progress back in.
    expect(vi.mocked(submitGitLabReview)).toHaveBeenLastCalledWith(
      glReview.pr,
      glReview.chunks,
      expect.anything(),
      'comment',
      'summary',
      state.draft_head_sha,
      partialProgress,
    );
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

  it('cleans up the outgoing review repo temp-clone when switching', async () => {
    const { STATE_DIR } = await import('../src/state');
    const { mkdir, stat } = await import('node:fs/promises');
    const dest = join(STATE_DIR, 'repos', 'tmp-switch-test');
    await mkdir(dest, { recursive: true });
    await saveInvestigationConfigs({
      [configKey(pr)]: {
        platform: pr.platform,
        owner: pr.owner,
        repo: pr.repo,
        mode: 'temp-clone',
        clone_path: dest,
        chosen_at: new Date().toISOString(),
      },
    });
    vi.mocked(loadReview).mockResolvedValueOnce({ review, state });
    const url = await makeServer({ review, state });
    await post(url, '/api/reviews/open', { ref: 'alice/proj#42' });
    await expect(stat(dest)).rejects.toThrow();
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

describe('GET/POST /api/investigation-config', () => {
  beforeEach(async () => {
    const { STATE_DIR } = await import('../src/state');
    await rm(join(STATE_DIR, 'investigation-config.json'), { force: true });
  });

  it('GET returns 503 when no review is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/investigation-config');
    expect(res.status).toBe(503);
  });

  it('POST returns 503 when no review is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await post(url, '/api/investigation-config', { mode: 'none' });
    expect(res.status).toBe(503);
  });

  it('GET returns the default none shape for an unconfigured repo', async () => {
    const url = await makeServer({ review, state });
    const res = await get(url, '/api/investigation-config');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; owner: string; repo: string };
    expect(body).toMatchObject({ mode: 'none', owner: 'alice', repo: 'proj' });
  });

  it('POST rejects an invalid mode', async () => {
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/investigation-config', { mode: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('POST rejects local-path with a missing local_path', async () => {
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/investigation-config', { mode: 'local-path' });
    expect(res.status).toBe(400);
  });

  it('POST rejects local-path pointing at a non-existent directory', async () => {
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/investigation-config', {
      mode: 'local-path',
      local_path: '/definitely/not/a/real/path/xyz',
    });
    expect(res.status).toBe(400);
  });

  it('POST persists local-path with a real directory, retrievable via GET', async () => {
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/investigation-config', {
      mode: 'local-path',
      local_path: import.meta.dirname,
    });
    expect(res.status).toBe(200);
    const saved = (await res.json()) as { mode: string; local_path: string };
    expect(saved.mode).toBe('local-path');
    expect(saved.local_path).toBe(import.meta.dirname);

    const getRes = await get(url, '/api/investigation-config');
    const fetched = (await getRes.json()) as { mode: string; local_path: string };
    expect(fetched.mode).toBe('local-path');
    expect(fetched.local_path).toBe(import.meta.dirname);
  });

  it('POST persists mode: none', async () => {
    const url = await makeServer({ review, state });
    const res = await post(url, '/api/investigation-config', { mode: 'none' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string };
    expect(body.mode).toBe('none');
  });
});

describe('GET /api/claude', () => {
  beforeEach(async () => {
    const { STATE_DIR } = await import('../src/state');
    await rm(join(STATE_DIR, 'investigation-config.json'), { force: true });
    vi.mocked(fetchFileContent).mockReset().mockResolvedValue(null);
  });

  it('returns 503 when no review is loaded', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, `/api/claude?chunk_id=c1`);
    expect(res.status).toBe(503);
  });

  it('mode none (default): passes no opts to streamClaude', async () => {
    const url = await makeServer({ review, state });
    await get(url, '/api/claude?chunk_id=c1');
    const lastCall = vi.mocked(streamClaude).mock.calls.at(-1)!;
    expect(lastCall[2]).toBeUndefined();
    expect(vi.mocked(fetchFileContent)).not.toHaveBeenCalled();
  });

  it('mode local-path: passes cwd/allowRepoRead to streamClaude', async () => {
    await saveInvestigationConfigs({
      [configKey(pr)]: {
        platform: pr.platform,
        owner: pr.owner,
        repo: pr.repo,
        mode: 'local-path',
        local_path: '/some/repo',
        chosen_at: new Date().toISOString(),
      },
    });
    const url = await makeServer({ review, state });
    await get(url, '/api/claude?chunk_id=c1');
    const lastCall = vi.mocked(streamClaude).mock.calls.at(-1)!;
    expect(lastCall[2]).toEqual({ cwd: '/some/repo', allowRepoRead: true });
  });

  it('mode api: fetches content for the chunk file and passes it to buildPrompt', async () => {
    await saveInvestigationConfigs({
      [configKey(pr)]: {
        platform: pr.platform,
        owner: pr.owner,
        repo: pr.repo,
        mode: 'api',
        chosen_at: new Date().toISOString(),
      },
    });
    vi.mocked(fetchFileContent).mockResolvedValue('full file text');
    const url = await makeServer({ review, state });
    await get(url, '/api/claude?chunk_id=c1');
    expect(vi.mocked(fetchFileContent)).toHaveBeenCalledWith(pr, chunk.file, meta.head_sha);
    const { buildPrompt } = await import('../src/claude');
    const lastCall = vi.mocked(buildPrompt).mock.calls.at(-1)!;
    expect(lastCall[3]).toEqual(new Map([[chunk.file, 'full file text']]));
  });

  it('mode api: skips files fetchFileContent returns null for', async () => {
    await saveInvestigationConfigs({
      [configKey(pr)]: {
        platform: pr.platform,
        owner: pr.owner,
        repo: pr.repo,
        mode: 'api',
        chosen_at: new Date().toISOString(),
      },
    });
    vi.mocked(fetchFileContent).mockResolvedValue(null);
    const url = await makeServer({ review, state });
    await get(url, '/api/claude?chunk_id=c1');
    const { buildPrompt } = await import('../src/claude');
    const lastCall = vi.mocked(buildPrompt).mock.calls.at(-1)!;
    expect(lastCall[3]).toEqual(new Map());
  });

  it('mode temp-clone: passes cwd/allowRepoRead pointing at the clone_path', async () => {
    await saveInvestigationConfigs({
      [configKey(pr)]: {
        platform: pr.platform,
        owner: pr.owner,
        repo: pr.repo,
        mode: 'temp-clone',
        clone_path: '/x/repos/tmp-abc',
        chosen_at: new Date().toISOString(),
      },
    });
    const url = await makeServer({ review, state });
    await get(url, '/api/claude?chunk_id=c1');
    const lastCall = vi.mocked(streamClaude).mock.calls.at(-1)!;
    expect(lastCall[2]).toEqual({ cwd: '/x/repos/tmp-abc', allowRepoRead: true });
  });

  it('mode always-clone: refreshes the clone before passing cwd/allowRepoRead', async () => {
    await saveInvestigationConfigs({
      [configKey(pr)]: {
        platform: pr.platform,
        owner: pr.owner,
        repo: pr.repo,
        mode: 'always-clone',
        clone_path: '/x/repos/github-alice-proj',
        chosen_at: new Date().toISOString(),
      },
    });
    const { refreshCloneIfStale } = await import('../src/investigation');
    vi.mocked(refreshCloneIfStale).mockClear();
    const url = await makeServer({ review, state });
    await get(url, '/api/claude?chunk_id=c1');
    expect(vi.mocked(refreshCloneIfStale)).toHaveBeenCalled();
    const lastCall = vi.mocked(streamClaude).mock.calls.at(-1)!;
    expect(lastCall[2]).toEqual({ cwd: '/x/repos/github-alice-proj', allowRepoRead: true });
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

  it('cancels a still-running stream when a second request starts', async () => {
    const url = await makeServer({ review, state });
    const cancel1 = vi.fn();
    let handlers1: { onDelta: (text: string) => void; onDone: (full: string) => void } | undefined;
    vi.mocked(streamClaude).mockImplementationOnce((_prompt, handlers) => {
      handlers1 = handlers as typeof handlers1;
      // Node only flushes SSE headers once the first byte is written — emit
      // one delta so the fetch() below actually resolves, without calling
      // onDone, so the stream is still "in flight" for the second request.
      handlers1?.onDelta('partial');
      return cancel1;
    });

    const res1 = await get(url, '/api/claude?chunk_id=c1');
    expect(res1.status).toBe(200);
    expect(cancel1).not.toHaveBeenCalled();

    const res2 = await get(url, '/api/claude?chunk_id=c1');
    expect(res2.status).toBe(200);

    expect(cancel1).toHaveBeenCalledTimes(1);

    // Let the intentionally-unfinished first stream close cleanly.
    handlers1?.onDone('unused');
  });
});

describe('unknown routes in api-only mode', () => {
  it('returns 404 for unrecognized paths', async () => {
    const url = await makeServer({ review: null, state: null });
    const res = await get(url, '/api/totally-unknown');
    expect(res.status).toBe(404);
  });
});
