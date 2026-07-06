---
status: approved
branch: inline-comment-editing-ui
created: 2026-07-05
features: [inline-comment-editing-ui]
---

# Plan: Inline Comment Editing UI

## Goal

Surface the existing `update_comment` backend action in the UI so a reviewer
can edit a drafted comment in place instead of only add/delete
(`inline-comment-editing-ui`, moui72/assisted-review#29).

## Scope

**In scope**
- An Edit affordance on each saved-comment `CommentCard` in `DiffPane`
  (inline and whole-chunk comments alike): textarea prefilled with the body,
  Save/Cancel, Save dispatches `update_comment` via `POST /api/action`.
- Wiring the update handler from `App.tsx` down through `ChunkView` →
  `DiffPane` → `CommentCard`, following the existing `onDeleteComment` path.
- Component tests for the edit flow.

**Out of scope**
- Editing displaced comments in the Overview's Displaced Comments section —
  explicit scope decision recorded in `ui.md`: displaced bodies stay
  read-only; edit after re-anchoring.
- Any backend change — `update_comment` (reducer, `Action` union,
  `updated_at` bump) already exists and is tested (`tests/state.test.ts`).
- New keyboard bindings / `HelpOverlay` changes — the textarea participates
  in the existing focus-suppresses-global-keys rule automatically.

## Technical Approach

Pure frontend change per the updated `ui.md` (DiffPane section and the new
"Comment editing" state). Editing state is card-local React state inside
`CommentCard` (`web/src/components/DiffPane.tsx`) — not lifted to `App.tsx`,
matching `ui.md`'s "local React state for UI-only concerns" rule. Save calls
a new `onUpdateComment(id, body)` prop threaded alongside the existing
`onDeleteComment`; `App.tsx` implements it by POSTing
`{ type: 'update_comment', id, body }` through the same action helper every
other mutation uses, then adopting the returned `ReviewState`
(server-authoritative state per `ui.md`/`api.md`). Save disabled on
empty/whitespace-only body (matching add-comment); Escape cancels.

## Phase Breakdown

### Phase 1 — Edit affordance and wiring (feature: `inline-comment-editing-ui`)

1. Add editing state + Edit/Save/Cancel UI to `CommentCard` in
   `web/src/components/DiffPane.tsx`; thread `onUpdateComment` through
   `DiffPane` props.
2. Thread `onUpdateComment` through `ChunkView.tsx` and implement the
   handler in `App.tsx` (dispatch `update_comment`, adopt returned state).
3. Manual verification: edit an inline and a whole-chunk comment; confirm
   `updated_at` bump persists across reload.

Deliverable: working end-to-end edit flow in the running app.

### Phase 2 — Component tests (depends on Phase 1)

1. Add `tests/components/` coverage (jsdom docblock) for: entering edit
   mode, save dispatches `update_comment` with the right id/body, cancel and
   Escape discard without a call, Save disabled on empty body, card exits
   edit mode after save.

Deliverable: green `npx vitest run`; frontend coverage is measured, not
gated, but the new branch paths are exercised.

## Complexity Tracking

None — no deviations from the simplicity principle. Reuses the existing
action union, reducer, mutation endpoint, and prop-threading pattern.

## Open Questions

None.

## Production Annotation Summary

- `ui.md` — "Load error has no in-place retry": pre-existing, untouched by
  this plan. No new annotations introduced.
