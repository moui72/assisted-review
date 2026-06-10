import { buildReviewPayload, commentAnchor, VERDICTS } from '../src/submit';
import type { Chunk, DraftComment } from '../src/types';

const chunk = (over: Partial<Chunk> = {}): Chunk => ({
  id: 'c1',
  file: 'src/app.ts',
  hunk_header: '@@ -10,3 +10,4 @@',
  old_range: [10, 12],
  new_range: [10, 13],
  context: '',
  diff: '@@ -10,3 +10,4 @@\n ctx\n-old\n+new1\n+new2\n ctx2',
  members: [],
  ...over,
});

const draft = (over: Partial<DraftComment> = {}): DraftComment => ({
  id: 'd1',
  chunk_id: 'c1',
  side: 'RIGHT',
  line: 11,
  body: 'a note',
  created_at: '2020-01-01T00:00:00.000Z',
  updated_at: '2020-01-01T00:00:00.000Z',
  ...over,
});

describe('commentAnchor', () => {
  it('uses the comment’s own side/line when both are set', () => {
    expect(commentAnchor(draft({ side: 'LEFT', line: 11 }), chunk())).toEqual({
      side: 'LEFT',
      line: 11,
    });
  });

  it('anchors a whole-chunk comment to the last new-side line (RIGHT)', () => {
    expect(commentAnchor(draft({ side: null, line: null }), chunk())).toEqual({
      side: 'RIGHT',
      line: 13,
    });
  });

  it('anchors a whole-chunk comment on a pure deletion to LEFT', () => {
    const deletion = chunk({
      old_range: [10, 12],
      new_range: [9, 9],
      diff: '@@ -10,3 +9,0 @@\n-old1\n-old2\n-old3',
    });
    expect(commentAnchor(draft({ side: null, line: null }), deletion)).toEqual({
      side: 'LEFT',
      line: 12,
    });
  });

  it('falls back to chunk anchoring when only one of side/line is set', () => {
    expect(commentAnchor(draft({ side: 'RIGHT', line: null }), chunk())).toEqual({
      side: 'RIGHT',
      line: 13,
    });
  });
});

describe('buildReviewPayload', () => {
  const chunks = [chunk(), chunk({ id: 'c2', file: 'src/other.ts' })];

  it('assembles event, body, commit_id and mapped comments', () => {
    const payload = buildReviewPayload(
      chunks,
      [draft(), draft({ id: 'd2', chunk_id: 'c2', side: 'RIGHT', line: 12, body: 'two' })],
      'REQUEST_CHANGES',
      'overall summary',
      'headsha',
    );
    expect(payload.event).toBe('REQUEST_CHANGES');
    expect(payload.body).toBe('overall summary');
    expect(payload.commit_id).toBe('headsha');
    expect(payload.comments).toEqual([
      { path: 'src/app.ts', body: 'a note', side: 'RIGHT', line: 11 },
      { path: 'src/other.ts', body: 'two', side: 'RIGHT', line: 12 },
    ]);
  });

  it('resolves the path from the comment’s chunk', () => {
    const payload = buildReviewPayload(chunks, [draft({ chunk_id: 'c2' })], 'COMMENT', '', 'sha');
    expect(payload.comments[0].path).toBe('src/other.ts');
  });

  it('skips drafts whose chunk is missing', () => {
    const payload = buildReviewPayload(chunks, [draft({ chunk_id: 'gone' })], 'COMMENT', '', 'sha');
    expect(payload.comments).toHaveLength(0);
  });

  it('produces an empty comments array for an approval with no drafts', () => {
    const payload = buildReviewPayload(chunks, [], 'APPROVE', 'LGTM', 'sha');
    expect(payload).toEqual({ event: 'APPROVE', body: 'LGTM', commit_id: 'sha', comments: [] });
  });
});

describe('VERDICTS', () => {
  it('contains exactly the three GitHub review events', () => {
    expect([...VERDICTS]).toEqual(['APPROVE', 'COMMENT', 'REQUEST_CHANGES']);
  });
});
