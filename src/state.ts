// Persistent review state: load on start (resume), mutate via actions, save
// after every mutation. One file per PR under ~/.assisted-review (override with
// ASSISTED_REVIEW_STATE_DIR). Single local user/process, so no locking needed.

import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
  readdir,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type {
  Action,
  DraftComment,
  PrRef,
  ReviewState,
  ReviewSummary,
  StoredNote,
} from './types.js';
import { STATE_VERSION } from './types.js';

const STATE_DIR =
  process.env.ASSISTED_REVIEW_STATE_DIR || join(homedir(), '.assisted-review');

function statePath(pr: PrRef): string {
  if (pr.platform === 'gitlab') {
    const encodedOwner = pr.owner.replace(/\//g, '%2F');
    return join(STATE_DIR, `gitlab-${encodedOwner}-${pr.repo}-${pr.number}.json`);
  }
  return join(STATE_DIR, `${pr.owner}-${pr.repo}-${pr.number}.json`);
}

function emptyState(pr: PrRef, headSha: string): ReviewState {
  return {
    version: STATE_VERSION,
    pr,
    head_sha: headSha,
    started_at: new Date().toISOString(),
    comments: [],
    flagged: [],
    viewed: [],
    notes: [],
  };
}

// Migrate raw parsed JSON from any prior version to the current ReviewState shape.
// v0 (no version field): original format, notes array may be absent
// v1: added version + guaranteed notes array
// (unversioned): backfill platform: 'github' on pr field (added for GitLab support)
export function migrate(raw: unknown): ReviewState {
  const s = { ...(raw as Record<string, unknown>) };
  if (typeof s.version !== 'number') {
    if (!Array.isArray(s.notes)) s.notes = [];
    s.version = STATE_VERSION;
  }
  // Backfill platform on existing GitHub state files (which predate this field).
  if (s.pr && typeof (s.pr as Record<string, unknown>).platform !== 'string') {
    s.pr = { ...(s.pr as Record<string, unknown>), platform: 'github' };
  }
  return s as unknown as ReviewState;
}

export async function loadState(
  pr: PrRef,
  headSha: string,
): Promise<ReviewState> {
  try {
    const raw = await readFile(statePath(pr), 'utf8');
    const state = migrate(JSON.parse(raw));
    // Keep the persisted state; just refresh head_sha (staleness handling is a
    // later slice — for now we surface the latest sha we fetched).
    state.head_sha = headSha;
    return state;
  } catch {
    return emptyState(pr, headSha);
  }
}

export async function saveState(state: ReviewState): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const path = statePath(state.pr);
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, path); // atomic replace
}

export function applyAction(state: ReviewState, action: Action): ReviewState {
  const now = new Date().toISOString();
  switch (action.type) {
    case 'add_comment': {
      const comment: DraftComment = {
        id: randomUUID(),
        chunk_id: action.chunk_id,
        side: action.side,
        line: action.line,
        body: action.body,
        created_at: now,
        updated_at: now,
      };
      return { ...state, comments: [...state.comments, comment] };
    }
    case 'update_comment':
      return {
        ...state,
        comments: state.comments.map((c) =>
          c.id === action.id ? { ...c, body: action.body, updated_at: now } : c,
        ),
      };
    case 'delete_comment':
      return {
        ...state,
        comments: state.comments.filter((c) => c.id !== action.id),
      };
    case 'toggle_flag':
      return {
        ...state,
        flagged: state.flagged.includes(action.chunk_id)
          ? state.flagged.filter((id) => id !== action.chunk_id)
          : [...state.flagged, action.chunk_id],
      };
    case 'set_viewed':
      return {
        ...state,
        viewed: action.viewed
          ? [...new Set([...state.viewed, action.chunk_id])]
          : state.viewed.filter((id) => id !== action.chunk_id),
      };
    case 'add_note': {
      const note: StoredNote = {
        id: randomUUID(),
        chunk_id: action.chunk_id,
        kind: action.kind,
        prompt: action.prompt,
        body: action.body,
        suggested_action: action.suggested_action,
        created_at: now,
      };
      return { ...state, notes: [...state.notes, note] };
    }
    case 'delete_note':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    default:
      return state;
  }
}

export async function listReviews(): Promise<ReviewSummary[]> {
  try {
    const files = await readdir(STATE_DIR);
    const summaries: ReviewSummary[] = [];
    for (const f of files) {
      if (!f.endsWith('.json') || f.endsWith('.tmp.json')) continue;
      try {
        const raw = await readFile(join(STATE_DIR, f), 'utf8');
        const state = migrate(JSON.parse(raw) as unknown) as ReviewState;
        if (!state.pr) continue;
        summaries.push({
          pr: state.pr,
          meta: state.meta,
          head_sha: state.head_sha,
          started_at: state.started_at,
          comment_count: state.comments.length,
          flagged_count: state.flagged.length,
          viewed_count: state.viewed.length,
          submitted: state.submitted,
        });
      } catch {
        // Skip unparseable or malformed files
      }
    }
    return summaries.sort((a, b) => b.started_at.localeCompare(a.started_at));
  } catch {
    return [];
  }
}

export async function deleteReview(pr: PrRef): Promise<void> {
  await unlink(statePath(pr));
}

export { statePath };
