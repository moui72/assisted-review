// Persistent review state: load on start (resume), mutate via actions, save
// after every mutation. One file per PR under ~/.pr-review (override with
// PR_REVIEW_STATE_DIR). Single local user/process, so no locking needed.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Action, DraftComment, PrRef, ReviewState, StoredNote } from './types';

const STATE_DIR = process.env.PR_REVIEW_STATE_DIR || join(homedir(), '.pr-review');

function statePath(pr: PrRef): string {
  return join(STATE_DIR, `${pr.owner}-${pr.repo}-${pr.number}.json`);
}

function emptyState(pr: PrRef, headSha: string): ReviewState {
  return {
    pr,
    head_sha: headSha,
    started_at: new Date().toISOString(),
    comments: [],
    flagged: [],
    viewed: [],
    notes: [],
  };
}

export async function loadState(pr: PrRef, headSha: string): Promise<ReviewState> {
  try {
    const raw = await readFile(statePath(pr), 'utf8');
    const state = JSON.parse(raw) as ReviewState;
    // Keep the persisted state; just refresh head_sha (staleness handling is a
    // later slice — for now we surface the latest sha we fetched).
    state.head_sha = headSha;
    if (!Array.isArray(state.notes)) state.notes = []; // backfill older files
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
      return { ...state, comments: state.comments.filter((c) => c.id !== action.id) };
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

export { statePath };
