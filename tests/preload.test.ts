import { findNextPreload } from '../web/src/preload.ts';
import { OVERVIEW_ID, STATE_VERSION } from '../src/types.ts';
import type { Chunk, PrRef, Review, ReviewState, StoredNote } from '../src/types.ts';
import type { PreloadConfig } from '../web/src/api.ts';

const pr: PrRef = { owner: 'o', repo: 'r', number: 1, platform: 'github' };

function makeChunk(id: string, hasAiNote = false): Chunk {
  return {
    id,
    file: `${id}.ts`,
    hunk_header: '',
    old_range: [1, 1],
    new_range: [1, 1],
    context: '',
    diff: '',
    members: [],
    ...(hasAiNote
      ? {
          ai_notes: [
            { id: `mock-${id}-0`, chunk_id: id, kind: 'initial', body: 'mock', created_at: '' },
          ] satisfies StoredNote[],
        }
      : {}),
  };
}

function makeReview(chunks: Chunk[]): Review {
  return {
    pr,
    meta: { title: '', author: '', base_ref: '', head_ref: '', is_draft: false, url: '', head_sha: '', body: '' },
    chunks,
    overview: { jira: { available: false, keys: [], issues: [] } },
    generated_at: '',
  };
}

function makeState(notes: Pick<StoredNote, 'chunk_id'>[] = []): ReviewState {
  return {
    version: STATE_VERSION,
    pr,
    head_sha: 'sha',
    started_at: '',
    comments: [],
    flagged: [],
    viewed: [],
    notes: notes.map((n, i) => ({
      id: String(i),
      chunk_id: n.chunk_id,
      kind: 'initial',
      body: '',
      created_at: '',
    })),
  };
}

const ON: PreloadConfig = { preload_chunks: 1, preload_overview: true };
const OFF: PreloadConfig = { preload_chunks: 0, preload_overview: false };

describe('findNextPreload', () => {
  describe('on overview page (index = -1)', () => {
    it('returns OVERVIEW_ID when preload_overview is true and no note exists', () => {
      const review = makeReview([makeChunk('c1')]);
      expect(findNextPreload(review, makeState(), -1, ON, new Set())).toBe(OVERVIEW_ID);
    });

    it('returns null when preload_overview is false', () => {
      const review = makeReview([makeChunk('c1')]);
      expect(findNextPreload(review, makeState(), -1, OFF, new Set())).toBeNull();
    });

    it('skips OVERVIEW_ID if already attempted', () => {
      const review = makeReview([makeChunk('c1')]);
      expect(findNextPreload(review, makeState(), -1, ON, new Set([OVERVIEW_ID]))).toBe('c1');
    });

    it('skips OVERVIEW_ID if a stored note already exists for it', () => {
      const review = makeReview([makeChunk('c1')]);
      const state = makeState([{ chunk_id: OVERVIEW_ID }]);
      expect(findNextPreload(review, state, -1, ON, new Set())).toBe('c1');
    });

    it('returns chunk[0] after OVERVIEW_ID is attempted, given preload_chunks=1', () => {
      const review = makeReview([makeChunk('c1')]);
      expect(findNextPreload(review, makeState(), -1, ON, new Set([OVERVIEW_ID]))).toBe('c1');
    });
  });

  describe('on a chunk page (index >= 0)', () => {
    it('does not include OVERVIEW_ID even when preload_overview is true', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2')]);
      const result = findNextPreload(review, makeState(), 0, ON, new Set());
      expect(result).toBe('c2');
      expect(result).not.toBe(OVERVIEW_ID);
    });

    it('returns the next chunk when it has no note', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2'), makeChunk('c3')]);
      expect(findNextPreload(review, makeState(), 0, ON, new Set())).toBe('c2');
    });

    it('skips a chunk that is already attempted', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2'), makeChunk('c3')]);
      const cfg: PreloadConfig = { preload_chunks: 2, preload_overview: false };
      expect(findNextPreload(review, makeState(), 0, cfg, new Set(['c2']))).toBe('c3');
    });

    it('skips a chunk that already has a stored note', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2'), makeChunk('c3')]);
      const cfg: PreloadConfig = { preload_chunks: 2, preload_overview: false };
      const state = makeState([{ chunk_id: 'c2' }]);
      expect(findNextPreload(review, state, 0, cfg, new Set())).toBe('c3');
    });

    it('skips a chunk that already has ai_notes (mock notes)', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2', true), makeChunk('c3')]);
      const cfg: PreloadConfig = { preload_chunks: 2, preload_overview: false };
      expect(findNextPreload(review, makeState(), 0, cfg, new Set())).toBe('c3');
    });

    it('returns null when all candidates in range are accounted for', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2'), makeChunk('c3')]);
      const state = makeState([{ chunk_id: 'c2' }]);
      expect(findNextPreload(review, state, 0, ON, new Set())).toBeNull();
    });

    it('returns null at the last chunk (nothing ahead)', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2')]);
      expect(findNextPreload(review, makeState(), 1, ON, new Set())).toBeNull();
    });

    it('returns null when preload_chunks is 0', () => {
      const review = makeReview([makeChunk('c1'), makeChunk('c2')]);
      expect(findNextPreload(review, makeState(), 0, OFF, new Set())).toBeNull();
    });
  });
});
