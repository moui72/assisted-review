import { attachMockNotes } from '../src/mock-ai';
import type { Chunk } from '../src/types';

function makeChunk(id: string): Chunk {
  return {
    id,
    file: `${id}.ts`,
    hunk_header: '@@ -1,1 +1,1 @@',
    old_range: [1, 1],
    new_range: [1, 1],
    context: '',
    diff: '@@ -1,1 +1,1 @@\n-a\n+b',
    members: [],
  };
}

describe('attachMockNotes', () => {
  const chunks = Array.from({ length: 6 }, (_, i) => makeChunk(`c${i + 1}`));

  it('returns the same number of chunks', () => {
    const out = attachMockNotes(chunks);
    expect(out).toHaveLength(chunks.length);
  });

  it('each chunk gets a non-empty initial ai_note', () => {
    const out = attachMockNotes(chunks);
    for (const c of out) {
      expect(c.ai_notes).toBeDefined();
      expect(c.ai_notes!.length).toBeGreaterThanOrEqual(1);
      expect(c.ai_notes![0].kind).toBe('initial');
      expect(c.ai_notes![0].body.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic — two calls produce identical bodies', () => {
    const a = attachMockNotes(chunks);
    const b = attachMockNotes(chunks);
    expect(a.map((c) => c.ai_notes)).toEqual(b.map((c) => c.ai_notes));
  });

  it('chunks at index % 3 === 1 get an extra context note (length 2), others length 1', () => {
    const out = attachMockNotes(chunks);
    out.forEach((c, i) => {
      if (i % 3 === 1) {
        expect(c.ai_notes).toHaveLength(2);
        expect(c.ai_notes![1].kind).toBe('context');
        expect(c.ai_notes![1].body.length).toBeGreaterThan(0);
      } else {
        expect(c.ai_notes).toHaveLength(1);
      }
    });
  });

  it('does not mutate the original chunk objects (returns copies)', () => {
    const input = [makeChunk('x1')];
    const out = attachMockNotes(input);
    expect(input[0].ai_notes).toBeUndefined();
    expect(out[0]).not.toBe(input[0]);
  });
});
