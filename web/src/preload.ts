import { OVERVIEW_ID } from '../../src/types.ts';
import type { Review, ReviewState } from '../../src/types.ts';
import type { PreloadConfig } from './api.ts';

export function findNextPreload(
  review: Review,
  state: ReviewState,
  index: number,
  config: PreloadConfig,
  attempted: Set<string>,
): string | null {
  const hasNote = (id: string) => {
    if (state.notes.some((n) => n.chunk_id === id)) return true;
    if (id !== OVERVIEW_ID) {
      const c = review.chunks.find((c) => c.id === id);
      if (c?.ai_notes?.length) return true;
    }
    return false;
  };

  const candidates: string[] = [];
  if (index < 0 && config.preload_overview) candidates.push(OVERVIEW_ID);
  for (let i = 1; i <= config.preload_chunks; i++) {
    const ni = index + i;
    if (ni >= 0 && ni < review.chunks.length) candidates.push(review.chunks[ni].id);
  }

  return candidates.find((id) => !attempted.has(id) && !hasNote(id)) ?? null;
}
