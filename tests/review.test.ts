import { vi } from 'vitest';

vi.mock('../src/fetch', () => ({
  fetchDiff: vi.fn(),
  fetchMeta: vi.fn(),
}));

vi.mock('../src/jira', () => ({
  buildJiraContext: vi.fn(),
  extractIssueKeys: vi.fn(),
}));

vi.mock('../src/state', () => ({
  loadState: vi.fn(),
}));

vi.mock('../src/mock-ai', () => ({
  attachMockNotes: vi.fn(),
}));

import { fetchDiff, fetchMeta } from '../src/fetch';
import { buildJiraContext, extractIssueKeys } from '../src/jira';
import { loadState } from '../src/state';
import { attachMockNotes } from '../src/mock-ai';
import { loadReview } from '../src/review';
import type { Chunk, PrMeta, ReviewState } from '../src/types';
import { STATE_VERSION } from '../src/types';

const pr = { owner: 'alice', repo: 'proj', number: 1, platform: 'github' as const };

const meta: PrMeta = {
  title: 'Add feature',
  author: 'alice',
  base_ref: 'main',
  head_ref: 'feat/x',
  is_draft: false,
  url: 'https://github.com/alice/proj/pull/1',
  head_sha: 'abc123',
  body: '',
};

// Minimal valid diff that chunksFromDiff can parse.
const MINIMAL_DIFF = [
  'diff --git a/src/foo.ts b/src/foo.ts',
  '--- a/src/foo.ts',
  '+++ b/src/foo.ts',
  '@@ -1,1 +1,1 @@',
  '-old',
  '+new',
].join('\n');

const baseState: ReviewState = {
  version: STATE_VERSION,
  pr,
  head_sha: 'abc123',
  started_at: '2020-01-01T00:00:00.000Z',
  comments: [],
  flagged: [],
  viewed: [],
  notes: [],
};

beforeEach(() => {
  vi.mocked(fetchDiff).mockResolvedValue(MINIMAL_DIFF);
  vi.mocked(fetchMeta).mockResolvedValue(meta);
  vi.mocked(extractIssueKeys).mockReturnValue([]);
  vi.mocked(buildJiraContext).mockResolvedValue({ available: false, keys: [], issues: [] });
  vi.mocked(loadState).mockResolvedValue({ ...baseState });
});

afterEach(() => vi.resetAllMocks());

describe('loadReview', () => {
  it('returns review with pr, meta, chunks, and state', async () => {
    const { review, state } = await loadReview(pr);
    expect(review.pr).toEqual(pr);
    expect(review.meta).toEqual(meta);
    expect(review.chunks.length).toBeGreaterThan(0);
    expect(state).toBeDefined();
  });

  it('caches meta in state so listings can show titles', async () => {
    const { state } = await loadReview(pr);
    expect(state.meta).toEqual(meta);
  });

  it('calls fetchDiff and fetchMeta with the given pr ref', async () => {
    await loadReview(pr);
    expect(vi.mocked(fetchDiff)).toHaveBeenCalledWith(pr);
    expect(vi.mocked(fetchMeta)).toHaveBeenCalledWith(pr);
  });

  it('calls extractIssueKeys with title, head_ref, and body', async () => {
    await loadReview(pr);
    expect(vi.mocked(extractIssueKeys)).toHaveBeenCalledWith(
      meta.title,
      meta.head_ref,
      meta.body,
    );
  });

  it('passes extracted keys to buildJiraContext', async () => {
    vi.mocked(extractIssueKeys).mockReturnValue(['PROJ-1']);
    await loadReview(pr);
    expect(vi.mocked(buildJiraContext)).toHaveBeenCalledWith(['PROJ-1']);
  });

  it('attaches mock notes when mockAi is true', async () => {
    const withNotes: Chunk[] = [
      {
        id: 'c1',
        file: 'src/foo.ts',
        hunk_header: '@@ -1,1 +1,1 @@',
        old_range: [1, 1],
        new_range: [1, 1],
        context: '',
        diff: '@@ -1,1 +1,1 @@\n-old\n+new',
        members: [],
        ai_notes: [{ kind: 'initial', body: 'mock note' }],
      },
    ];
    vi.mocked(attachMockNotes).mockReturnValue(withNotes);

    const { review } = await loadReview(pr, { mockAi: true });
    expect(vi.mocked(attachMockNotes)).toHaveBeenCalled();
    expect(review.chunks).toBe(withNotes);
  });

  it('does not call attachMockNotes when mockAi is false', async () => {
    await loadReview(pr, { mockAi: false });
    expect(vi.mocked(attachMockNotes)).not.toHaveBeenCalled();
  });

  it('returns generated_at as a valid ISO string', async () => {
    const { review } = await loadReview(pr);
    expect(Number.isNaN(Date.parse(review.generated_at))).toBe(false);
  });

  it('times out jiraContext after 12 seconds and returns unavailable', async () => {
    vi.useFakeTimers();
    vi.mocked(buildJiraContext).mockImplementation(() => new Promise(() => {})); // never resolves

    const promise = loadReview(pr);
    await vi.advanceTimersByTimeAsync(12001);
    const { review } = await promise;

    expect(review.overview.jira.available).toBe(false);
    expect(review.overview.jira.reason).toMatch(/timed out/);

    vi.useRealTimers();
  });
});
