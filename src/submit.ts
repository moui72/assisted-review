// Publish drafted comments as a real GitHub PR review via `gh api`.
//
// Ports the essential behavior of the assisted-review `submit-review.sh`:
//   - assemble a single review payload {event, body, commit_id, comments}
//   - pre-flight stale-SHA detection (head_sha must still be on the PR's
//     commit list; a force-push orphans it and inline anchors 422)
//   - catch the "Path could not be resolved" 422 the pre-flight can miss
//   - POST the whole payload as one JSON document on stdin (`--input -`);
//     gh's -f/--raw-field would encode `comments` as a string and the API
//     rejects that with "not an array".
//
// Our model has no replies (every draft is a new inline comment) and no
// start/end ranges, so the reply pass and multi-line shaping are dropped.

import { spawn } from 'node:child_process';
import type { Chunk, DraftComment, PrRef, Side } from './types.js';

export { VERDICTS } from './types.js';
export type { Verdict } from './types.js';
import type { Verdict } from './types.js';

export interface ReviewComment {
  path: string;
  body: string;
  side: Side;
  line: number;
}

export interface ReviewPayload {
  event: Verdict;
  body: string;
  commit_id: string;
  comments: ReviewComment[];
}

export interface SubmitResult {
  ok: boolean;
  /** PR review permalink on success. */
  html_url?: string;
  /** Set when the head SHA the comments were drafted against is gone. */
  stale?: { old: string; new_head: string; inline_count: number };
  /** gh stderr (or a synthesized message) on a non-stale failure. */
  error?: string;
  /** Echoed on failure so the UI can offer a manual-submit fallback. */
  payload?: ReviewPayload;
}

/**
 * Resolve a draft comment's GitHub anchor. A line-anchored comment uses its own
 * side/line; a whole-chunk comment (line null) anchors to the chunk's last
 * line — RIGHT if the hunk has any new-side content, else LEFT (pure deletion).
 */
export function commentAnchor(c: DraftComment, chunk: Chunk): { side: Side; line: number } {
  if (c.line != null && c.side != null) return { side: c.side, line: c.line };
  const hasNewSide = chunk.diff.split('\n').some((l) => l.startsWith('+') || l.startsWith(' '));
  return hasNewSide
    ? { side: 'RIGHT', line: chunk.new_range[1] }
    : { side: 'LEFT', line: chunk.old_range[1] };
}

/** Assemble the GitHub review payload from drafts. Orphaned drafts (whose chunk
 *  is no longer present) are skipped. */
export function buildReviewPayload(
  chunks: Chunk[],
  comments: DraftComment[],
  verdict: Verdict,
  body: string,
  headSha: string,
): ReviewPayload {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const reviewComments: ReviewComment[] = [];
  for (const c of comments) {
    const chunk = byId.get(c.chunk_id);
    if (!chunk) continue;
    const { side, line } = commentAnchor(c, chunk);
    reviewComments.push({ path: chunk.file, body: c.body, side, line });
  }
  return { event: verdict, body, commit_id: headSha, comments: reviewComments };
}

interface GhResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run `gh` with optional stdin (execFile drops `input`, so we spawn). */
function gh(args: string[], input?: string): Promise<GhResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
    if (input != null) child.stdin.write(input);
    child.stdin.end();
  });
}

function repoPath({ owner, repo }: PrRef): string {
  return `repos/${owner}/${repo}`;
}

/** Fetch the PR's current head SHA (for stale-SHA reporting). */
async function currentHeadSha(ref: PrRef): Promise<string> {
  const { code, stdout } = await gh(['api', `${repoPath(ref)}/pulls/${ref.number}`, '-q', '.head.sha']);
  return code === 0 ? stdout.trim() : 'unknown';
}

/**
 * Is `sha` still on the PR's commit list? Returns null if the lookup itself
 * failed (network/permissions) — caller should not block submission on null.
 */
async function shaOnPr(ref: PrRef, sha: string): Promise<boolean | null> {
  const { code, stdout } = await gh([
    'api',
    '--paginate',
    `${repoPath(ref)}/pulls/${ref.number}/commits`,
    '-q',
    '.[].sha',
  ]);
  if (code !== 0) return null;
  const shas = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  return shas.includes(sha);
}

const STALE_RE = /Path could not be resolved/i;

/** Submit the assembled review. Posts the whole payload as one document. */
export async function submitReview(ref: PrRef, payload: ReviewPayload): Promise<SubmitResult> {
  // Pre-flight: a stale head SHA only matters when we have inline anchors.
  if (payload.comments.length > 0) {
    const present = await shaOnPr(ref, payload.commit_id);
    if (present === false) {
      return {
        ok: false,
        stale: {
          old: payload.commit_id,
          new_head: await currentHeadSha(ref),
          inline_count: payload.comments.length,
        },
      };
    }
  }

  const { code, stdout, stderr } = await gh(
    ['api', `${repoPath(ref)}/pulls/${ref.number}/reviews`, '-X', 'POST', '--input', '-'],
    JSON.stringify(payload),
  );

  if (code !== 0) {
    if (STALE_RE.test(stderr)) {
      return {
        ok: false,
        stale: {
          old: payload.commit_id,
          new_head: await currentHeadSha(ref),
          inline_count: payload.comments.length,
        },
      };
    }
    return { ok: false, error: stderr.trim() || `gh exited with code ${code}`, payload };
  }

  let html_url: string | undefined;
  try {
    html_url = (JSON.parse(stdout) as { html_url?: string }).html_url;
  } catch {
    /* response wasn't JSON; success without a URL */
  }
  return { ok: true, html_url };
}
