import type {
  Action,
  PrRef,
  Review,
  ReviewState,
  ReviewSummary,
  Verdict,
} from '../../src/types.ts';

export async function fetchReview(): Promise<Review | null> {
  const res = await fetch('/api/review');
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`/api/review returned ${res.status}`);
  return (await res.json()) as Review;
}

export async function fetchState(): Promise<ReviewState | null> {
  const res = await fetch('/api/state');
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`/api/state returned ${res.status}`);
  return (await res.json()) as ReviewState;
}

export async function clearActiveReview(): Promise<void> {
  const res = await fetch('/api/review', { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE /api/review returned ${res.status}`);
}

export async function postAction(action: Action): Promise<ReviewState> {
  const res = await fetch('/api/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error(`/api/action returned ${res.status}`);
  return (await res.json()) as ReviewState;
}

export interface SubmitResponse {
  ok: boolean;
  html_url?: string;
  stale?: { old: string; new_head: string; inline_count: number };
  error?: string;
  state: ReviewState;
}

/** Publish the drafted comments as a real GitHub PR review. */
export async function submitReview(
  verdict: Verdict,
  body: string,
): Promise<SubmitResponse> {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verdict, body }),
  });
  return (await res.json()) as SubmitResponse;
}

export interface ClaudeStreamHandlers {
  onDelta: (text: string) => void;
  onDone: (state: ReviewState) => void;
  onError: (message: string) => void;
}

/** Stream a Claude note over SSE. Returns a cancel function. */
export function streamClaude(
  params: { chunkId: string; question: string },
  handlers: ClaudeStreamHandlers,
): () => void {
  const u = new URL('/api/claude', location.origin);
  u.searchParams.set('chunk_id', params.chunkId);
  if (params.question.trim()) u.searchParams.set('q', params.question.trim());

  const es = new EventSource(u.toString());
  let settled = false;
  const close = () => {
    settled = true;
    es.close();
  };

  es.addEventListener('delta', (e) => {
    if (!settled) handlers.onDelta(JSON.parse((e as MessageEvent).data).text);
  });
  es.addEventListener('done', (e) => {
    if (settled) return;
    handlers.onDone(JSON.parse((e as MessageEvent).data).state as ReviewState);
    close();
  });
  es.addEventListener('error', (e) => {
    if (settled) return;
    const data = (e as MessageEvent).data as string | undefined;
    let message = 'Claude request failed (connection lost)';
    if (data) {
      try {
        message = JSON.parse(data).message;
      } catch {
        /* keep default */
      }
    }
    handlers.onError(message);
    close();
  });

  return close;
}

export interface PreloadConfig {
  preload_chunks: number;
  preload_overview: boolean;
}

export async function fetchConfig(): Promise<PreloadConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(`/api/config returned ${res.status}`);
  return (await res.json()) as PreloadConfig;
}

export async function fetchReviews(): Promise<ReviewSummary[]> {
  const res = await fetch('/api/reviews');
  if (!res.ok) throw new Error(`/api/reviews returned ${res.status}`);
  return (await res.json()) as ReviewSummary[];
}

export async function deleteReview(pr: PrRef): Promise<void> {
  const res = await fetch(`/api/reviews/${pr.owner}/${pr.repo}/${pr.number}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`DELETE /api/reviews returned ${res.status}`);
}

export interface OpenReviewResponse {
  review?: Review;
  state?: ReviewState;
  error?: string;
}

export async function openReview(ref: string): Promise<OpenReviewResponse> {
  const res = await fetch('/api/reviews/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ref }),
  });
  const data = (await res.json()) as OpenReviewResponse;
  if (!res.ok) throw new Error(data.error ?? `/api/reviews/open returned ${res.status}`);
  return data;
}

export { OVERVIEW_ID, VERDICTS } from '../../src/types.ts';
export type { Verdict, ReviewSummary } from '../../src/types.ts';
export type { Review };
export type {
  Chunk,
  AiNote,
  AiNoteKind,
  PrRef,
  PrMeta,
  Side,
  DraftComment,
  StoredNote,
  ReviewState,
  Action,
  Overview,
  JiraContext,
  JiraIssue,
} from '../../src/types.ts';
