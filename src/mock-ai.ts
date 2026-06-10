// Placeholder AI commentary for UI development. Deterministic per chunk so the
// layout is stable across reloads. Swap this for the headless-Claude bridge
// (slice 3) without touching the UI — it reads `chunk.ai_notes` either way.

import type { AiNote, Chunk } from './types';

const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
  'Deserunt mollit anim id est laborum, quis aute iure reprehenderit.',
  'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil.',
  'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus.',
];

// Tiny deterministic string hash (djb2-ish).
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function sentences(seed: number, count: number): string {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(LOREM[(seed + i) % LOREM.length]);
  return out.join(' ');
}

function mockNotesForChunk(chunk: Chunk, index: number): AiNote[] {
  const h = hash(chunk.id);
  const notes: AiNote[] = [
    {
      kind: 'initial',
      body: sentences(h, 2 + (h % 3)), // 2–4 sentences
      suggested_action: sentences(h + 1, 1),
    },
  ];
  // Sprinkle an extra "context" note on some chunks to exercise the stacked
  // multi-note layout.
  if (index % 3 === 1) {
    notes.push({ kind: 'context', body: sentences(h + 3, 1 + (h % 2)) });
  }
  return notes;
}

/** Return a copy of the chunks with placeholder `ai_notes` attached. */
export function attachMockNotes(chunks: Chunk[]): Chunk[] {
  return chunks.map((c, i) => ({ ...c, ai_notes: mockNotesForChunk(c, i) }));
}
