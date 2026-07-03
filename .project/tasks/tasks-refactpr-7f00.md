---
plan: plan-refactpr-2026-07-03.md
generated: 2026-07-03
status: in-progress
---

# Tasks

## Phase 1: Data Model & Migration

- [x] T001 [artifacts: datamodel] Add `file: string`, `hunk_header: string`,
  `displaced: boolean` fields to the `DraftComment` type in `src/types.ts`.
  Update the `add_comment` case in `applyAction` (`src/state.ts`) to accept
  `file`/`hunk_header` from the action payload and set `displaced: false`.
  Test: extend `tests/state.test.ts`'s `add_comment` coverage to assert the
  new fields are stored as given.

- [x] T002 [artifacts: datamodel] Add optional `file?: string`,
  `hunk_header?: string`, `displaced?: boolean` fields to `StoredNote` in
  `src/types.ts`. Update the `add_note` case in `applyAction` to set them
  from the action payload for chunk-scoped notes, and explicitly omit them
  (leave `undefined`) when `chunk_id === OVERVIEW_ID`. Test: unit test
  asserting a chunk note carries the fields and an overview note doesn't.

- [x] T003 [artifacts: datamodel] Introduce a `FlaggedEntry` type
  (`chunk_id: string, file: string, hunk_header: string, displaced: boolean`)
  in `src/types.ts`. Change `ReviewState.flagged` from `string[]` to
  `FlaggedEntry[]`. Update the `toggle_flag` case in `applyAction` to accept
  `file`/`hunk_header` in the action payload, add/remove `FlaggedEntry`
  objects (matching existing entries by `chunk_id`), and set
  `displaced: false` on add. Test: unit test covering toggle-on (adds entry
  with given snapshot) and toggle-off (removes by `chunk_id`) with the new
  shape.

- [x] T004 [artifacts: datamodel, infrastructure] Bump `STATE_VERSION` in
  `src/state.ts` and add a new step to the `MIGRATIONS` list: for state at
  the prior version, convert `flagged` from `string[]` to `FlaggedEntry[]`
  using empty-string `file`/`hunk_header` and `displaced: true` per entry;
  backfill missing `file`/`hunk_header` on every existing `comments`/`notes`
  entry (non-overview) with empty strings and `displaced: true`. Empty-string
  snapshots can never match a real chunk, so legacy entries surface as
  displaced immediately rather than silently reconciling against the wrong
  chunk. Test: `tests/state.test.ts` migration test loading a pre-migration
  fixture (old-shape `flagged: string[]`, comments/notes without the new
  fields) and asserting every legacy entry ends up `displaced: true` with the
  converted shapes.

## Phase 2: Reconciliation Pass

- [x] T005 [artifacts: infrastructure, datamodel] Depends on T001-T004.
  Implement an Anchor Reconciliation pass — a function (e.g.
  `reconcileAnchors(state, chunks)` in `src/state.ts`) called from
  `loadState()`'s load path immediately after `migrate()`, using the
  `Chunk[]` already available from the same `loadReview()` call
  (`src/review.ts`). For every `comments`/`notes` (excluding
  `chunk_id === OVERVIEW_ID`) and `flagged` entry: look up a chunk in the
  freshly-parsed list with an exact `file` + `hunk_header` match. Match found
  → resync `chunk_id` to that chunk's (possibly renumbered) id, set
  `displaced: false`. No match → set `displaced: true`, leave
  `chunk_id`/`file`/`hunk_header` as the last-known snapshot (don't clear
  them). Test: unit test with two `Chunk[]` fixtures (before/after a diff
  change) — assert an entry whose hunk changed ends up `displaced: true`
  with its original snapshot retained, and an untouched entry gets
  `displaced: false` with `chunk_id` resynced to its new position.

## Phase 3: Re-anchor Action

- [x] T006 [artifacts: api, datamodel] Depends on T001-T004 (not on T005 —
  can be done in either order relative to Phase 2, but touches
  `src/state.ts`'s `applyAction` switch alongside T005, so do them
  sequentially rather than concurrently to avoid editing the same function
  at once). Add a `reanchor_comment` variant to the `Action` union in
  `src/types.ts`: `{ type: 'reanchor_comment', id: string, chunk_id: string,
  side: Side | null, line: number | null, file: string, hunk_header: string
  }`. Implement it in `applyAction`: find the `DraftComment` by `id`, update
  `chunk_id`/`side`/`line`/`file`/`hunk_header`, set `displaced: false`, bump
  `updated_at`. No new route needed — flows through the existing
  `POST /api/action`. Test: unit test asserting `reanchor_comment` clears
  `displaced` and updates all anchor fields on the matching comment, leaves
  other comments untouched.

## Phase 4: UI

- [x] T007 [artifacts: ui] [parallel] Can start once T001-T004 land (needs
  the `displaced`/`FlaggedEntry` types) — doesn't need T005/T006 implemented
  to build the display, only a fixture with `displaced: true` data. Add a
  "Displaced Comments" section to `OverviewView.tsx`, rendered when
  `state.comments`/`notes`/`flagged` contains any `displaced: true` entry.
  Comments render body + last-known `file`/`hunk_header` snapshot + a
  "Re-anchor" button (no handler wiring yet — stub `onClick`). Notes/flags
  render read-only in the same section (existing delete/unflag affordances
  only). Test: component test (`tests/components/`, jsdom) rendering
  `OverviewView` with a displaced-comment fixture, asserting the section and
  Re-anchor button appear, and that a non-displaced fixture renders nothing
  extra.

- [ ] T008 [artifacts: ui, api] Depends on T006 and T007. Wire the
  "Re-anchor" button from T007: clicking it enters `ChunkView` in
  anchor-picking mode (navigate to a chunk, arm a "picking anchor for
  comment `<id>`" state in `App.tsx`). Selecting a line via `DiffPane`'s
  existing `Anchor { side, line }` selection dispatches `reanchor_comment`
  (via `POST /api/action`) for that comment id instead of `add_comment`.
  `ResponseBar` suppresses its comment textarea while in this mode (the
  comment body already exists) and shows which comment is being re-anchored.
  Test: integration/component test simulating the full flow — click
  Re-anchor, pick a line in a chunk, assert `reanchor_comment` was
  dispatched and the comment no longer appears in the Displaced Comments
  section afterward.
