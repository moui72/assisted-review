---
status: approved
branch: refactpr
created: 2026-07-03
features: [displaced-comment-reanchoring]
---

# Plan: Displaced Comment Re-Anchoring

## Goal

When a reopened PR/MR's diff has changed shape, detect drafted comments,
notes, and flags whose anchor no longer matches any current chunk, mark them
`displaced` instead of silently keeping a stale/wrong `chunk_id` or dropping
them, and let the reviewer re-anchor displaced comments to a new chunk/line.

## Scope

**In scope:**
- Anchor-snapshot fields (`file`, `hunk_header`) on `DraftComment`,
  `StoredNote` (non-overview), and the new `FlaggedEntry` shape.
- A reconciliation pass in `loadState()`'s load path that sets `displaced`
  by exact snapshot match against the freshly-parsed chunk list.
- A `reanchor_comment` action (comments only — see Non-Goals).
- A one-time state migration marking all pre-existing comments/flags
  `displaced: true` by default (no historical snapshot to reconcile against).
- UI: a "Displaced Comments" section on the Overview page (comments get a
  re-anchor button; displaced notes/flags are read-only there — delete or
  unflag only), and a re-anchor entry into `ChunkView`'s existing
  line-click-to-anchor flow.

**Non-goals** (per decisions made during planning):
- No `reanchor_note` / `reanchor_flag` actions — notes and flags are shown as
  displaced but only deletable/unflaggable, not relocatable.
- No change to the `chunk_id` scheme itself — ids remain unstable sequential
  positions; this feature is the accepted remediation, not a stability fix.
- No change to `viewed` tracking — explicitly out of scope (see
  `datamodel.md`).
- No fuzzy/overlapping-range matching — reconciliation is exact
  `file` + `hunk_header` match only.

## Technical Approach

- **Anchor snapshot fields** are populated by the caller (frontend, via the
  `POST /api/action` request body), not derived server-side inside
  `applyAction` — keeps `applyAction(state, action) → state` a pure reducer
  with no implicit `Chunk[]` input, per Constitution Principle II.
- **Reconciliation** runs once per `loadReview()` call, in `loadState()`
  right after `migrate()` (see `infrastructure.md`), using the chunk list
  from the same fetch — no extra diff fetch needed. Exact match on
  `file` + `hunk_header`; a match resyncs `chunk_id` (which may have been
  renumbered) and clears `displaced`; no match sets `displaced: true` and
  retains the last-known snapshot.
- **Legacy data migration**: bump `STATE_VERSION`; add a version-gated
  migration step that backfills missing `file`/`hunk_header` on existing
  `DraftComment`/`StoredNote`/flag entries with empty-string placeholders and
  `displaced: true` — an empty-string snapshot can never match a real chunk,
  so legacy entries surface immediately in the Displaced Comments section
  rather than silently reconciling against the wrong chunk by accident.
  `flagged` converts from `string[]` to `FlaggedEntry[]` in the same step.
- **`reanchor_comment`** carries a fully-resolved `file`/`hunk_header`
  snapshot in the request body (the frontend already has the target chunk in
  hand when the reviewer picks a new line), mirroring how `add_comment`
  already works today.

## Phase Breakdown

1. **Data model & migration** — add `file`/`hunk_header`/`displaced` fields
   to `DraftComment`/`StoredNote`; introduce `FlaggedEntry`; bump
   `STATE_VERSION` and add the backfill migration step (converts `flagged`
   shape, marks legacy entries displaced). Testable increment: `migrate()`
   unit tests covering old-shape → new-shape conversion.
   `[artifacts: datamodel]`
2. **Reconciliation pass** — implement the exact-match reconciliation in
   `loadState()`'s load path; unit tests covering match/no-match/renumbered-id
   cases. Testable increment: reopening a review with a changed diff produces
   correctly-flagged `displaced` entries in `ReviewState`.
   `[artifacts: infrastructure]`
3. **`reanchor_comment` action** — add the action variant to `applyAction`,
   wire `POST /api/action` (no route/shape change, just a new variant).
   Testable increment: API test posting `reanchor_comment` clears `displaced`
   and updates the anchor.
   `[artifacts: api]` — feature: `displaced-comment-reanchoring`
4. **UI: Displaced Comments section + re-anchor flow** — Overview page
   section, re-anchor button entering `ChunkView`'s existing anchor-picking
   flow, read-only display for displaced notes/flags. Testable increment:
   manual walkthrough — reopen a review with a modified diff, see displaced
   comments, re-anchor one, confirm it moves back to normal display.
   `[artifacts: ui]` — feature: `displaced-comment-reanchoring`

Phases are sequential — 2 depends on 1 (needs the new fields to reconcile
into), 3 depends on 1 (needs `FlaggedEntry`/fields to mutate), 4 depends on
2 and 3 (needs both reconciliation output and the action to act on it).

## Complexity Tracking

None. The added fields and single new action variant are proportional to
the feature — no new abstraction layer introduced beyond what reconciliation
requires.

## Open Questions

None remaining — all design decisions (reanchor scope, displaced-comment UI
location, legacy-data handling) were resolved during planning.

## Production Annotation Summary

None anticipated — this feature resolves an existing gap rather than
introducing a new shortcut. If implementation reveals a corner case that
can't be cleanly handled (e.g. a chunk match that's ambiguous due to
duplicate `file`+`hunk_header` pairs in the same diff), annotate it in
`datamodel.md` under Production Annotations per `constitution.md`'s
Development Workflow convention.
