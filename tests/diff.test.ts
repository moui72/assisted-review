import { diffRows, lineSpan } from '../web/src/diff.ts';
import type { Chunk } from '../web/src/api.ts';

describe('diffRows', () => {
  it('types rows and computes line numbers for a small diff', () => {
    const diff = [
      '@@ -1,3 +1,4 @@ ctx',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      '+const c = 4;',
      '\\ No newline at end of file',
    ].join('\n');
    const rows = diffRows(diff);

    expect(rows[0].type).toBe('hunk');
    expect(rows[0].text).toBe('@@ -1,3 +1,4 @@ ctx');

    // context line: increments both, starts at the header values.
    expect(rows[1]).toMatchObject({ type: 'ctx', oldLn: 1, newLn: 1, text: 'const a = 1;', sign: ' ' });

    // deletion: oldLn then increments old.
    expect(rows[2]).toMatchObject({ type: 'del', oldLn: 2, text: 'const b = 2;', sign: '-' });

    // additions: newLn increments (header new start was 1, ctx consumed line 1).
    expect(rows[3]).toMatchObject({ type: 'add', newLn: 2, text: 'const b = 3;', sign: '+' });
    expect(rows[4]).toMatchObject({ type: 'add', newLn: 3, text: 'const c = 4;', sign: '+' });

    // "\ No newline" -> meta.
    expect(rows[5].type).toBe('meta');
    expect(rows[5].text).toBe('\\ No newline at end of file');
  });

  it('resets the line counters at each @@ header in a grouped diff', () => {
    const diff = [
      '@@ -1,1 +1,1 @@',
      '+first',
      '@@ -50,1 +60,1 @@',
      '+second',
    ].join('\n');
    const rows = diffRows(diff);
    const adds = rows.filter((r) => r.type === 'add');
    expect(adds).toHaveLength(2);
    expect(adds[0].newLn).toBe(1);
    // counter reset to the second header's new start (60).
    expect(adds[1].newLn).toBe(60);
  });
});

describe('lineSpan', () => {
  const chunkWithRange = (range: [number, number]): Chunk =>
    ({ new_range: range }) as Chunk;

  it('single-line range (a === b) renders +N', () => {
    expect(lineSpan(chunkWithRange([7, 7]))).toBe('+7');
  });

  it('a multi-line range renders +a–b with an en-dash', () => {
    expect(lineSpan(chunkWithRange([3, 9]))).toBe('+3–9');
  });
});
