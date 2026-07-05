---
status: approved
branch: refactpr
created: 2026-07-01
---

# Plan: Zero-Chunk PR Empty State

## Goal

Give the Overview page a real empty state for a PR/MR with zero reviewable
chunks, so "Begin review" is never a silent no-op.

## Scope

**In scope:**
- `OverviewView.tsx`'s footer (the `chunkCount === 0` case) and its `onBegin`
  affordance.
- A component test covering the zero-chunk render.
- Correcting `ui.md`'s "Empty/zero-chunk PR" description, which currently
  misstates *why* this is a gap (see `DEFECTS.md`).

**Out of scope:**
- Any change to `App.tsx`'s `jump()` clamp logic or navigation model — it
  already behaves correctly (early-returns on `!total`); the bug is purely
  that the UI offers a control that does nothing when `total === 0`, not
  that the underlying guard is wrong.
- `ChunkView.tsx` — unreachable when `total === 0` (App.tsx never selects a
  chunk index when `chunks` is empty), no change needed.
- Any other confirmed-gap/future-work item flagged elsewhere in the artifacts
  (adapter retry/backoff, `listReviews()` indexing, hosted/multi-user design)
  — explicitly out of scope for this plan, tracked separately.

## Technical Approach

Per `ui.md`'s Views section, `OverviewView` is the `index === -1` page and is
the only view rendered when a PR has zero chunks (`ChunkView` requires a
`chunk`, which is `undefined` when `total === 0` — see `App.tsx:93`,
`App.tsx:422-443`). The existing footer unconditionally renders "Review
{chunkCount} chunks one at a time." plus a "Begin review →" button wired to
`onBegin={() => jump(0)}`. `jump()` early-returns when `!total`
(`App.tsx:154`), so on a zero-chunk PR the button click has zero observable
effect — no error, no navigation, nothing.

The fix is presentation-only, following the existing pattern of in-place
banners for degrade states (`ErrorBanner`, used for Jira/Claude/submit
failures per `ui.md`'s States section) rather than introducing a new full
route/screen:

- In `OverviewView.tsx`, branch the footer on `chunkCount === 0`:
  - Replace the "Review N chunks one at a time." / "Begin review →" pair
    with a single message, e.g. "No reviewable changes in this PR." (or
    MR, keyed off `pr.platform` the same way the description Collapsible
    label already does).
  - Omit the button entirely rather than rendering it disabled — there is
    nothing for it to do, and a disabled button invites a "why is this
    disabled?" support question a plain message avoids.
- No change to the `onBegin`/`jump` prop contract — `OverviewView` still
  receives `onBegin`/`chunkCount` from `App.tsx` unchanged; this is a
  render-branch inside the existing component, not a new prop or API.

## Phase Breakdown

### Phase 1 — Fix the empty state
- Update `OverviewView.tsx`'s footer to branch on `chunkCount === 0`.
- Add `tests/components/OverviewView.test.tsx` (`// @vitest-environment
  jsdom`, following the existing pattern in `tests/components/*.test.tsx`)
  covering: zero-chunk render shows the empty message and no button;
  non-zero-chunk render still shows the existing button/count text.
- Demonstrable increment: run the new test file, then `pnpm dev` and open a
  PR with no diff (or mock one) to visually confirm.

### Phase 2 — Reconcile artifacts
- Run `/ardd-refine ui` to correct the "Empty/zero-chunk PR" description in
  `ui.md` (it currently claims no view renders at all; actually
  `OverviewView` renders correctly and only the "Begin Review" affordance
  was non-functional — already diagnosed in `DEFECTS.md`).
- Remove the resolved entry from `DEFECTS.md` (or re-run `/ardd-verify` to
  refresh it) once the fix lands.
- Depends on Phase 1 landing first, so the artifact describes the
  *implemented* behavior rather than a still-open gap.

## Complexity Tracking

None — this is a same-component, presentation-only branch with no new
abstractions, dependencies, or state.

## Open Questions

None. The fix, its scope, and its test are fully determined by the existing
`ui.md`/`DEFECTS.md` diagnosis.

## Production Annotation Summary

None — this closes an existing gap rather than introducing a new shortcut.
