---
name: datamodel
render_target: docs/ARCHITECTURE.md
render_section: Datamodel
status: stable
last_updated: 2026-07-10
diagram_status: current
---

# Data Model

## Overview

Types are defined once in `src/types.ts` and shared with the frontend via
`import type` (re-exported from `web/src/api.ts`) — a single canonical source
of truth for the review/state/action model. `NotePreview` (see `StoredNote`
below) is the one legitimate frontend-only projection, with no backend type
to share in the first place — it exists only because a live-streaming note
preview has no `id` yet, not because of any mock-vs-real distinction.

Two families of entities exist:

- **Fetched/derived, in-memory only** (`Review`, `Chunk`, `PrMeta`,
  `JiraContext`, …) — rebuilt on every PR open, never persisted directly.
- **Persisted** (`ReviewState` and its nested `DraftComment`/`StoredNote`) —
  one JSON file per PR/MR under `~/.assisted-review/` (see
  `infrastructure.md`), survives restarts, mutated only through the
  `applyAction` reducer.

`Review` and `ReviewState` are related but distinct: `Review` is what was
fetched this session (diff, metadata, Jira context); `ReviewState` is what
the reviewer has done (drafts, flags, notes). They're joined at read time by
`chunk_id`, not stored together.

## Entities

### PrRef

Identifies a PR (GitHub) or MR (GitLab). Used as the key for state file
naming (`infrastructure.md`) and as the join key across `Review`/`ReviewState`.

| Field | Type | Notes |
|-------|------|-------|
| owner | string | GitHub: repo owner. GitLab: full namespace, e.g. `"group/subgroup"` (may contain slashes) |
| repo | string | |
| number | number | PR/MR number |
| platform | 'github' \| 'gitlab' | Determines which fetch/submit code path runs |

### PrMeta

PR/MR metadata, normalized to one shape across GitHub (`gh pr view`) and
GitLab (`glab mr view` or REST) — see `infrastructure.md`'s Integration
Components section.

| Field | Type | Notes |
|-------|------|-------|
| title | string | |
| author | string | Username; `'unknown'` if the API omitted it |
| base_ref | string | Target branch |
| head_ref | string | Source branch |
| is_draft | boolean | GitLab: `draft \|\| work_in_progress` |
| url | string | Web URL |
| head_sha | string | Used for stale-SHA detection on submit |
| body | string | PR/MR description; source for Jira key extraction and the AI overview prompt |

### RawHunk

A single parsed diff hunk, before grouping into `Chunk`s. Produced by
`parseDiff()` (`src/parse-diff.ts`).

| Field | Type | Notes |
|-------|------|-------|
| id | string | `c1`, `c2`, … sequential across the whole diff |
| file | string | Resolved from `diff --git` / `---` / `+++` markers |
| hunk_header | string | Raw `@@ -a,b +c,d @@ context` line |
| old_range | LineRange | `[start, end]` tuple, old-side line numbers |
| new_range | LineRange | `[start, end]` tuple, new-side line numbers |
| context | string | Trailing text on the `@@` line (usually a function/class name) |
| diff | string | The hunk's own text, header + body lines |

### HunkMember

A `RawHunk`'s header/ranges, retained inside a `Chunk` after grouping (so a
chunk can report which original hunks it merged).

| Field | Type | Notes |
|-------|------|-------|
| hunk_header | string | |
| old_range | LineRange | |
| new_range | LineRange | |

### Chunk

The primary review unit — adjacent hunks in the same file, merged when the
unchanged gap between them is small (`groupChunks`, default gap 20 new-file
lines; `gap <= 0` disables merging). Extends `RawHunk`.

| Field | Type | Notes |
|-------|------|-------|
| *(RawHunk fields)* | | id/file/hunk_header/old_range/new_range/context/diff, but ranges and diff span the whole merged group |
| members | HunkMember[] | The original hunks that were merged into this chunk (always ≥1) |
| ai_notes | StoredNote[] \| undefined | Only set by `--mock-ai` (`attachMockNotes`), which fills fake `id`/`chunk_id`/`created_at` values rather than using a separate in-memory-only shape — these mock notes are never written to `ReviewState.notes`, so the fake ids never collide with real ones. See `StoredNote` below. |

### JiraIssue

| Field | Type | Notes |
|-------|------|-------|
| key | string | e.g. `FEN-2622` |
| summary | string | |
| status | string | |
| type | string | Issue type name |
| description | string | Flattened from Atlassian Document Format to plain text (`adfToText`) |
| url | string | `{baseUrl}/browse/{key}` |
| epic_key | string? | From the configurable epic-link custom field, or `fields.parent.key` |

### JiraContext

Overview-page Jira background, or the reason it's unavailable.

| Field | Type | Notes |
|-------|------|-------|
| available | boolean | |
| reason | string? | Why unavailable (missing creds, fetch failure, timeout) |
| setup_hint | string? | Shown in the UI's setup banner |
| keys | string[] | Issue keys extracted from PR title/branch/body via regex `\b[A-Z][A-Z0-9]+-\d+\b` |
| issues | JiraIssue[] | Up to 4 keys fetched (`keys.slice(0, 4)`) |
| epic | JiraIssue \| null? | Epic of the first issue that has one |

### Overview

| Field | Type | Notes |
|-------|------|-------|
| jira | JiraContext | Only Jira context today; the shape leaves room for future overview-page enrichments |

### Review

The full payload served at `GET /api/review` and consumed by the UI as a unit.

| Field | Type | Notes |
|-------|------|-------|
| pr | PrRef | |
| meta | PrMeta | |
| chunks | Chunk[] | |
| overview | Overview | |
| generated_at | string | ISO timestamp, set when `loadReview()` builds this payload |

### DraftComment

A reviewer's in-progress inline comment. `line: null` means "comment on the
whole chunk" (anchored at submit time — see `submit.ts`'s `commentAnchor`).

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| chunk_id | string | When `displaced` is true, this is the *last-known* chunk id — no longer trustworthy for lookup, kept only as a hint |
| side | Side \| null | `'RIGHT' \| 'LEFT'`; null for whole-chunk comments |
| line | number \| null | null for whole-chunk comments |
| body | string | |
| file | string | Snapshot of the anchored chunk's `file` at anchor time — see Anchor Reconciliation below |
| hunk_header | string | Snapshot of the anchored chunk's `hunk_header` at anchor time |
| displaced | boolean | Set by reconciliation on load when the snapshot no longer matches any current chunk; cleared by `reanchor_comment` |
| created_at | string | ISO |
| updated_at | string | ISO; bumped by `update_comment` and by `reanchor_comment` |

### StoredNote

The single note shape for AI commentary — real notes written by the
`add_note` action when a Claude SSE stream completes, *and* mock-AI notes
(`chunk.ai_notes`, see `Chunk` above, filled with fake `id`/`chunk_id`/
`created_at`). There is no separate mock-only note type: the mock path fakes
values rather than reinventing the shape.

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID for real notes; `mock-{chunk_id}-{n}` for mock notes |
| chunk_id | string | Or `OVERVIEW_ID` for the overview page's note. When `displaced` is true, this is the *last-known* chunk id, kept only as a hint |
| kind | AiNoteKind | |
| prompt | string? | |
| body | string | |
| suggested_action | string? | |
| file | string? | Snapshot of the anchored chunk's `file` at creation time. Unset for overview notes (`chunk_id === OVERVIEW_ID`), which are never subject to reconciliation |
| hunk_header | string? | Snapshot of the anchored chunk's `hunk_header` at creation time. Unset for overview notes |
| displaced | boolean? | Set by reconciliation on load when the snapshot no longer matches any current chunk. Unlike `DraftComment`, notes have no re-anchor action (see Anchor Reconciliation below) — a displaced note can only be shown as displaced or deleted |
| created_at | string | ISO; a fixed placeholder for mock notes (unused by rendering) |

Frontend note: `AiCommentary.tsx`'s live-streaming preview (the in-progress
buffer shown while a Claude request is in flight) is a `NotePreview` —
`Pick<StoredNote, 'kind' | 'body' | 'prompt' | 'suggested_action'>` — since a
not-yet-persisted stream has no `id`/`chunk_id`/`created_at` yet. The
`Note` component renders `StoredNote | NotePreview` and only shows a delete
affordance when a `deletableNoteIds` set (built from `ReviewState.notes`,
not `chunk.ai_notes`) actually contains the note's id — this is what stops
a mock note's fake id from offering a delete button that would silently
no-op. `NotePreview` is the *only* other note-shaped type in the frontend —
there is no separate `DisplayNote` type; `AiCommentary.tsx` renders
`StoredNote | NotePreview` directly.

### FlaggedEntry

A flagged chunk, with the same anchor-snapshot fields as `DraftComment`/
`StoredNote` so flags participate in the same reconciliation pass. Replaces
the earlier bare `chunk_id` string — a plain string can't carry a snapshot.

| Field | Type | Notes |
|-------|------|-------|
| chunk_id | string | When `displaced` is true, this is the *last-known* chunk id, kept only as a hint |
| file | string | Snapshot of the flagged chunk's `file` at flag time |
| hunk_header | string | Snapshot of the flagged chunk's `hunk_header` at flag time |
| displaced | boolean | Set by reconciliation on load. Like `StoredNote`, a flag has no re-anchor action — a displaced flag can only be shown as displaced or unflagged |

### ReviewState

Persisted review state — one JSON file per `PrRef` (see `infrastructure.md`).
Resumed on next open of the same PR/MR.

| Field | Type | Notes |
|-------|------|-------|
| version | number | `STATE_VERSION = 2`; drives `migrate()` |
| pr | PrRef | |
| meta | PrMeta? | Cached so `listReviews()` can show titles without re-fetching |
| head_sha | string | Refreshed to the latest fetched SHA on every load (staleness handling is otherwise deferred — see `state.ts` comment) |
| started_at | string | ISO, set once on first load |
| comments | DraftComment[] | |
| flagged | FlaggedEntry[] | |
| viewed | string[] | Chunk ids. Deliberately *not* reconciled like the fields above — a stale "viewed" marker pointing at the wrong chunk has no submission-time consequence and no meaningful "re-view" UI, so it's out of scope for Anchor Reconciliation, not an oversight |
| notes | StoredNote[] | |
| submitted | `{ at: string; verdict: string; url?: string }`? | Set once the review has been published; blocks a second submit (`410` response) |
| gitlab_submit_progress | `{ posted_comment_ids: string[]; note_posted: boolean; approved: boolean }`? | GitLab only — tracks exactly which parts of a submission already succeeded, so a retry after partial failure skips them instead of reposting duplicates. Cleared the moment a submission fully succeeds (same time `submitted` is stamped). GitHub's single-POST review is atomic and never uses this field. |

### ReviewSummary

Slimmer projection of `ReviewState` for the review-picker menu
(`GET /api/reviews`) — avoids shipping full `comments`/`notes` arrays to list
all saved reviews.

| Field | Type | Notes |
|-------|------|-------|
| pr | PrRef | |
| meta | PrMeta? | |
| head_sha | string | |
| started_at | string | |
| comment_count | number | |
| flagged_count | number | |
| viewed_count | number | |
| submitted | same shape as `ReviewState.submitted` | |

### InvestigationConfig

Per-repo (not per-PR) choice of how much filesystem/repo access the headless
Claude investigation gets — see `infrastructure.md`'s "Repo Investigation
Access" section. Persisted once chosen so the same repo isn't re-prompted on
every review; keyed by `platform:owner/repo` in a single
`investigation-config.json` (`infrastructure.md`), not one file per entry
like `ReviewState`, since this is a small, infrequently-written map rather
than per-review data.

| Field | Type | Notes |
|-------|------|-------|
| platform | 'github' \| 'gitlab' | Part of the lookup key, alongside `owner`/`repo` |
| owner | string | |
| repo | string | |
| mode | `'none' \| 'local-path' \| 'api' \| 'temp-clone' \| 'always-clone'` | `'none'` (today's diff-only behavior) until the reviewer explicitly chooses otherwise via the modal |
| local_path | string? | Only set (and only meaningful) when `mode` is `'local-path'` — reviewer-supplied directory, validated to exist on save |
| clone_path | string? | Only set for `'temp-clone'`/`'always-clone'` — computed deterministically (`STATE_DIR/repos/<platform>-<owner>-<repo>`) once cloned, not reviewer-supplied |
| chosen_at | string | ISO, set when the mode is first chosen |
| last_used | string? | ISO, updated each time an investigation call actually uses this config — the input to `always-clone` pruning (idle TTL) |

### SubmitResult

The `POST /api/submit` response shape (`api.md`), produced by the submit
adapter (`src/submit.ts`). The route handler adds a `state` field to the
wire response after calling the adapter (see `api.md`).

| Field | Type | Notes |
|-------|------|-------|
| ok | boolean | |
| html_url | string? | Review permalink on success |
| stale | `{ old, new_head, inline_count }`? | Set when the drafted-against head SHA is gone |
| comment_errors | `Array<{ path, line, error }>`? | Partial GitLab discussion-post failures |
| error | string? | `gh`/`glab` stderr or synthesized message |
| payload | ReviewPayload? | Echoed on failure server-side only, for a future manual-submit fallback; never reaches the client |
| state | ReviewState | Added by the `/api/submit` route handler, not the submit adapter itself |

The GitLab adapter (`submitGitLabReview`) actually returns `SubmitResult &
{ progress: GitLabSubmitProgress }` — a `progress` member carrying which
comments/note/approve already landed. Like `payload`, it is server-side-only:
the `/api/submit` route strips it before replying (`api.md`), and the client
receives the same information via `state.gitlab_submit_progress` instead. The
GitHub adapter's return is a plain `SubmitResult` (no `progress`).

### Action

Discriminated union of all mutations the UI POSTs to `/api/action` (and that
the Claude SSE route applies internally for `add_note`). See
`applyAction()` in `src/state.ts` for the full reducer.

| Variant | Fields |
|---|---|
| `add_comment` | chunk_id, side, line, body, file, hunk_header |
| `update_comment` | id, body |
| `delete_comment` | id |
| `reanchor_comment` | id, chunk_id, side, line, file, hunk_header |
| `toggle_flag` | chunk_id, file, hunk_header |
| `set_viewed` | chunk_id, viewed |
| `add_note` | chunk_id, kind, prompt?, body, suggested_action?, file?, hunk_header? |
| `delete_note` | id |

## Normalization Rules

- **Chunk ids** (`c1`, `c2`, …) are assigned sequentially across the entire
  diff by `parseDiff()`, before grouping — grouping does not renumber, it
  just merges members under the first hunk's id.
- **`OVERVIEW_ID`** (`'__overview__'`) is the sentinel `chunk_id` used for
  notes attached to the overview page rather than a specific chunk. Defined
  once in `src/types.ts`, re-exported from `web/src/api.ts`.
- **Jira keys** are extracted with a single regex (`\b[A-Z][A-Z0-9]+-\d+\b`)
  applied across PR title, head branch name, and PR body; deduplicated via a
  `Set`.
- **Line ranges** (`LineRange = [number, number]`) always use inclusive
  `[start, end]`; a hunk with `count === 0` (pure insertion/deletion on one
  side) collapses to `[start, start]`.
- **State file naming** doubles as normalization of `PrRef` into a filesystem
  key — see `infrastructure.md` for the exact scheme (differs between GitHub
  and GitLab because GitLab's `owner` can contain `/`).
- **Anchor Reconciliation** runs once per `loadState()` call (see
  `infrastructure.md`), after `migrate()`, using the freshly-parsed `Chunk[]`
  from the same `loadReview()` call. For every `DraftComment`, `StoredNote`
  (excluding overview notes), and `FlaggedEntry`: look up a chunk with an
  exact `file` + `hunk_header` match in the new chunk list. Match found →
  resync `chunk_id` to that chunk's (possibly renumbered) id, `displaced:
  false`. No match → `displaced: true`, `chunk_id`/`file`/`hunk_header` left
  as the last-known snapshot rather than cleared, so the reviewer can still
  see what a displaced comment used to be about. The match is exact, not
  fuzzy (e.g. overlapping line ranges) — a hunk whose content changed at all
  displaces anything anchored to it, which is intentional: `chunk_id`s
  themselves stay unstable sequential ids (no id-scheme change), so this
  reconciliation is the accepted remediation rather than content-derived
  stable ids. `add_comment`/`toggle_flag`/`add_note` populate `file`/
  `hunk_header` from the chunk the reviewer was actually looking at when the
  entry was created (resolved by the caller, not `applyAction` itself, which
  stays a pure `(state, action) → state` reducer per `constitution.md`
  Principle II with no chunk data as an implicit input).
- **`migrate()`** applies an ordered list of migration steps on load, rather
  than one-off `if` checks accumulated in the function body — new gaps are
  added as a new list entry. Two step shapes: a **version step** runs only
  when the stored state predates a given `version` and then bumps it (e.g.
  v0 → v1: guarantee a `notes` array); a **backfill step** runs
  unconditionally, gated on its own field-presence check rather than
  `version` — for schema additions that shipped without a `STATE_VERSION`
  bump (missing `pr.platform` on pre-GitLab state files, backfilled to
  `'github'`).

## Indexes

Not applicable today — `ReviewState` is a single JSON document per PR/MR with
no query surface; lookups within it (`comments.filter(c => c.chunk_id ===
id)`, etc.) are done by linear scan in the frontend against small in-memory
arrays. `listReviews()` scans all files in the state directory on every call
— no separate index file.

**Future scaling note**: confirmed fine for now, but flagged for future work
— if saved-review count grows large enough that a full-directory scan per
`GET /api/reviews` call becomes noticeably slow, add a lightweight index
(e.g., a manifest file updated alongside each state-file write) rather than
changing the per-file storage model itself.
