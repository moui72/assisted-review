// Publish drafted comments as a real GitHub/GitLab review.
//
// GitHub: assembles a single review payload {event, body, commit_id, comments}
//   and POSTs it as one document via `gh api`.
// GitLab: posts each inline comment as a separate discussion via the unified
//   glab-or-REST transport (see gitlab-rest.ts), then posts the whole-MR note
//   and optionally approves.

import { spawn } from 'node:child_process';
import type { Chunk, DraftComment, GitLabVerdict, PrRef, Side } from './types.js';
import { glabApiJson, glabApiPaginatedJson, glProjectId } from './gitlab-rest.js';

export { VERDICTS, GITLAB_VERDICTS } from './types.js';
export type { Verdict, GitLabVerdict } from './types.js';
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
  /** Review permalink on success. */
  html_url?: string;
  /** Set when the head SHA the comments were drafted against is gone. */
  stale?: { old: string; new_head: string; inline_count: number };
  /** Errors from individual GitLab discussion POSTs (partial success). */
  comment_errors?: Array<{ path: string; line: number | null; error: string }>;
  /** gh/glab stderr (or a synthesized message) on a non-stale failure. */
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

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function spawnCli(bin: string, args: string[], input?: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
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

function gh(args: string[], input?: string): Promise<CliResult> {
  return spawnCli('gh', args, input);
}

// ---- GitHub ----------------------------------------------------------------

function repoPath({ owner, repo }: PrRef): string {
  return `repos/${owner}/${repo}`;
}

async function currentHeadSha(ref: PrRef): Promise<string> {
  const { code, stdout } = await gh(['api', `${repoPath(ref)}/pulls/${ref.number}`, '-q', '.head.sha']);
  return code === 0 ? stdout.trim() : 'unknown';
}

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

export async function submitReview(ref: PrRef, payload: ReviewPayload): Promise<SubmitResult> {
  if (payload.event === 'COMMENT' && !payload.body.trim() && payload.comments.length === 0) {
    return { ok: false, error: 'nothing to submit: provide a body or at least one comment' };
  }

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

// ---- GitLab ----------------------------------------------------------------

interface GitLabVersion {
  base_commit_sha: string;
  start_commit_sha: string;
  head_commit_sha: string;
}

async function fetchGitLabVersions(ref: PrRef): Promise<GitLabVersion> {
  const versions = await glabApiJson<GitLabVersion[]>(
    `projects/${glProjectId(ref)}/merge_requests/${ref.number}/versions`,
  );
  if (!versions.length) throw new Error('no MR diff versions found');
  return versions[0];
}

async function glabCurrentHeadSha(ref: PrRef): Promise<string> {
  try {
    const mr = await glabApiJson<{ sha?: string }>(
      `projects/${glProjectId(ref)}/merge_requests/${ref.number}`,
    );
    return mr.sha ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function glabShaOnMr(ref: PrRef, sha: string): Promise<boolean | null> {
  try {
    const commits = await glabApiPaginatedJson<{ id: string }>(
      `projects/${glProjectId(ref)}/merge_requests/${ref.number}/commits`,
    );
    return commits.some((c) => c.id === sha);
  } catch {
    return null;
  }
}

export async function submitGitLabReview(
  ref: PrRef,
  chunks: Chunk[],
  comments: DraftComment[],
  verdict: GitLabVerdict,
  body: string,
  headSha: string,
): Promise<SubmitResult> {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const inlineComments = comments
    .map((c) => ({ draft: c, chunk: byId.get(c.chunk_id) }))
    .filter((x): x is { draft: DraftComment; chunk: Chunk } => x.chunk !== undefined);

  if (verdict === 'comment' && !body.trim() && inlineComments.length === 0) {
    return { ok: false, error: 'nothing to submit: provide a body or at least one comment' };
  }

  // Stale SHA check when there are inline comments.
  if (inlineComments.length > 0) {
    const present = await glabShaOnMr(ref, headSha);
    if (present === false) {
      return {
        ok: false,
        stale: {
          old: headSha,
          new_head: await glabCurrentHeadSha(ref),
          inline_count: inlineComments.length,
        },
      };
    }
  }

  // Fetch diff version SHAs needed for position objects.
  let version: GitLabVersion | undefined;
  if (inlineComments.length > 0) {
    try {
      version = await fetchGitLabVersions(ref);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  const commentErrors: SubmitResult['comment_errors'] = [];

  // Post each inline comment as a separate discussion.
  for (const { draft, chunk } of inlineComments) {
    const { side, line } = commentAnchor(draft, chunk);
    const position = {
      base_sha: version!.base_commit_sha,
      start_sha: version!.start_commit_sha,
      head_sha: version!.head_commit_sha,
      position_type: 'text' as const,
      old_path: chunk.file,
      new_path: chunk.file,
      ...(side === 'LEFT'  ? { old_line: line } : {}),
      ...(side === 'RIGHT' ? { new_line: line } : {}),
    };
    try {
      await glabApiJson(
        `projects/${glProjectId(ref)}/merge_requests/${ref.number}/discussions`,
        { method: 'POST', body: { body: draft.body, position } },
      );
    } catch (err) {
      commentErrors.push({ path: chunk.file, line, error: (err as Error).message });
    }
  }

  // Post the whole-MR summary note.
  if (body.trim()) {
    try {
      await glabApiJson(
        `projects/${glProjectId(ref)}/merge_requests/${ref.number}/notes`,
        { method: 'POST', body: { body } },
      );
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
        comment_errors: commentErrors.length > 0 ? commentErrors : undefined,
      };
    }
  }

  // Approve if requested.
  if (verdict === 'approve') {
    try {
      await glabApiJson(
        `projects/${glProjectId(ref)}/merge_requests/${ref.number}/approve`,
        { method: 'POST' },
      );
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
        comment_errors: commentErrors.length > 0 ? commentErrors : undefined,
      };
    }
  }

  return {
    ok: true,
    comment_errors: commentErrors.length > 0 ? commentErrors : undefined,
  };
}
