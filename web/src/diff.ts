import type { Chunk, Side } from './api.ts';

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** A selected line to anchor a comment to. */
export interface Anchor {
  side: Side;
  line: number;
}

export type DiffRowType = 'hunk' | 'add' | 'del' | 'ctx' | 'meta';

export interface DiffRow {
  type: DiffRowType;
  text: string;
  sign?: string;
  oldLn?: number;
  newLn?: number;
}

// Turn a chunk's raw diff text into typed rows with computed line numbers.
// A grouped chunk concatenates multiple `@@` headers, so we reset the
// counters whenever a new header appears.
export function diffRows(diff: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLn = 0;
  let newLn = 0;
  for (const line of diff.split('\n')) {
    const m = line.match(HUNK_RE);
    if (m) {
      oldLn = Number(m[1]);
      newLn = Number(m[2]);
      rows.push({ type: 'hunk', text: line });
      continue;
    }
    const sign = line[0];
    const body = line.slice(1);
    if (sign === '+') {
      rows.push({ type: 'add', newLn, text: body, sign: '+' });
      newLn++;
    } else if (sign === '-') {
      rows.push({ type: 'del', oldLn, text: body, sign: '-' });
      oldLn++;
    } else if (sign === '\\') {
      rows.push({ type: 'meta', text: line }); // "\ No newline at end of file"
    } else {
      rows.push({ type: 'ctx', oldLn, newLn, text: body, sign: ' ' });
      oldLn++;
      newLn++;
    }
  }
  return rows;
}

export function lineSpan(chunk: Chunk): string {
  const [a, b] = chunk.new_range;
  return a === b ? `+${a}` : `+${a}–${b}`;
}
