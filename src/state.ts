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
  Chunk,
  DraftComment,
  FlaggedEntry,
  PrRef,
  ReviewState,
  ReviewSummary,
  StoredNote,
} from './types.js';
import { OVERVIEW_ID, STATE_VERSION } from './types.js';

export const STATE_DIR =
  process.env.ASSISTED_REVIEW_STATE_DIR || join(homedir(), '.assisted-review');

function statePath(pr: PrRef): string {
  if (pr.platform === 'gitlab') {
    const encodedOwner = pr.owner.replace(/\//g, '%2F');
    return join(STATE_DIR, `gitlab~${encodedOwner}~${pr.repo}~${pr.number}.json`);
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

// Ordered migration steps applied to raw persisted state on load, so old
// state files keep working across schema changes. Two step shapes:
//  - `sinceVersion`: runs only if the stored state predates that version,
//    then bumps `version` to it — for genuine STATE_VERSION increments.
//  - `backfill`: runs unconditionally, gated on its own field-presence
//    check rather than `version` — for schema additions that shipped
//    without a STATE_VERSION bump (e.g. GitLab support adding `pr.platform`).
// Add new gaps as a new entry here, in order, rather than growing migrate()'s
// body with another one-off `if`.
type VersionStep = { sinceVersion: number; apply: (s: Record<string, unknown>) => void };
type BackfillStep = { backfill: (s: Record<string, unknown>) => void };
type MigrationStep = VersionStep | BackfillStep;

const MIGRATIONS: MigrationStep[] = [
  {
    // v0 (no version field) -> v1: guarantee a notes array.
    sinceVersion: 1,
    apply: (s) => {
      if (!Array.isArray(s.notes)) s.notes = [];
    },
  },
  {
    // Backfill platform: 'github' on pr (state files predating GitLab support).
    backfill: (s) => {
      const pr = s.pr as Record<string, unknown> | undefined;
      if (pr && typeof pr.platform !== 'string') {
        s.pr = { ...pr, platform: 'github' };
      }
    },
  },
  {
    // v1 -> v2: DraftComment/StoredNote/flagged gained anchor-snapshot fields
    // (file, hunk_header, displaced) for Anchor Reconciliation. There's no way
    // to know what a pre-existing entry used to be anchored to, so legacy
    // entries get an empty-string snapshot (which can never match a real
    // chunk) and displaced: true — they surface in the Displaced Comments
    // section immediately rather than silently reconciling against the wrong
    // chunk. `flagged` also converts from a bare chunk-id string[] to
    // FlaggedEntry[] in this same step.
    sinceVersion: 2,
    apply: (s) => {
      const comments = Array.isArray(s.comments)
        ? (s.comments as Record<string, unknown>[])
        : [];
      s.comments = comments.map((c) =>
        typeof c.file === 'string'
          ? c
          : { ...c, file: '', hunk_header: '', displaced: true },
      );

      const notes = Array.isArray(s.notes) ? (s.notes as Record<string, unknown>[]) : [];
      s.notes = notes.map((n) =>
        n.chunk_id === OVERVIEW_ID || typeof n.file === 'string'
          ? n
          : { ...n, file: '', hunk_header: '', displaced: true },
      );

      const flagged = Array.isArray(s.flagged) ? (s.flagged as unknown[]) : [];
      s.flagged = flagged.map((f) =>
        typeof f === 'string'
          ? { chunk_id: f, file: '', hunk_header: '', displaced: true }
          : f,
      );
    },
  },
];

export function migrate(raw: unknown): ReviewState {
  const s = { ...(raw as Record<string, unknown>) };
  const currentVersion = typeof s.version === 'number' ? s.version : 0;

  for (const step of MIGRATIONS) {
    if ('sinceVersion' in step) {
      if (currentVersion < step.sinceVersion) {
        step.apply(s);
        s.version = step.sinceVersion;
      }
    } else {
      step.backfill(s);
    }
  }

  if (typeof s.version !== 'number') s.version = STATE_VERSION;
  return s as unknown as ReviewState;
}

// Anchor Reconciliation: for every chunk-anchored entry, resync chunk_id
// against the freshly-parsed chunk list by exact file + hunk_header match
// (not fuzzy — a hunk whose content changed at all displaces anything
// anchored to it). No match retains the last-known snapshot and sets
// displaced: true rather than clearing it, so the reviewer can still see
// what a displaced entry used to be about. Overview notes (no file/
// hunk_header) are never subject to this — they have no chunk to reconcile
// against in the first place.
export function reconcileAnchors(state: ReviewState, chunks: Chunk[]): ReviewState {
  const findChunkId = (file: string, hunkHeader: string): string | undefined =>
    chunks.find((c) => c.file === file && c.hunk_header === hunkHeader)?.id;

  const comments: DraftComment[] = state.comments.map((c) => {
    const matchId = findChunkId(c.file, c.hunk_header);
    return matchId
      ? { ...c, chunk_id: matchId, displaced: false }
      : { ...c, displaced: true };
  });

  const notes: StoredNote[] = state.notes.map((n) => {
    if (n.chunk_id === OVERVIEW_ID) return n;
    const matchId = findChunkId(n.file ?? '', n.hunk_header ?? '');
    return matchId
      ? { ...n, chunk_id: matchId, displaced: false }
      : { ...n, displaced: true };
  });

  const flagged: FlaggedEntry[] = state.flagged.map((f) => {
    const matchId = findChunkId(f.file, f.hunk_header);
    return matchId
      ? { ...f, chunk_id: matchId, displaced: false }
      : { ...f, displaced: true };
  });

  return { ...state, comments, notes, flagged };
}

// `chunks` is the freshly-parsed chunk list from the same loadReview() call,
// used to run Anchor Reconciliation. Omitted by lower-level callers (tests,
// anything not going through a real diff fetch) to skip reconciliation
// entirely rather than treating "no chunks given" as "no chunks exist" (which
// would incorrectly displace every existing entry).
export async function loadState(
  pr: PrRef,
  headSha: string,
  chunks?: Chunk[],
): Promise<ReviewState> {
  try {
    const raw = await readFile(statePath(pr), 'utf8');
    let state = migrate(JSON.parse(raw));
    // Keep the persisted state; just refresh head_sha (staleness handling is a
    // later slice — for now we surface the latest sha we fetched).
    state.head_sha = headSha;
    if (chunks) state = reconcileAnchors(state, chunks);
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
        file: action.file,
        hunk_header: action.hunk_header,
        displaced: false,
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
        flagged: state.flagged.some((f) => f.chunk_id === action.chunk_id)
          ? state.flagged.filter((f) => f.chunk_id !== action.chunk_id)
          : [
              ...state.flagged,
              {
                chunk_id: action.chunk_id,
                file: action.file,
                hunk_header: action.hunk_header,
                displaced: false,
              },
            ],
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
        file: action.file,
        hunk_header: action.hunk_header,
        displaced: action.file !== undefined ? false : undefined,
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
