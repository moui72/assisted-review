---
status: approved
branch: ardd-verify-pass
created: 2026-07-09
features: []
surfaced-defects: [2c7929b5, e1c63afa, 0c265570, c5de09b4]
---

# Plan: Resolve /ardd-verify findings

## Goal

Close the four unsurfaced defects from the 2026-07-08 `/ardd-verify` pass:
document the GitLab browser-auth flow accurately (three related findings),
give `ReviewsMenu`'s in-app "Open a review" path the same auth-prompt
handling `Splash` already has, and fix `App.tsx`'s global keydown handler
so `InvestigationModal` gets the same Escape/short-circuit treatment every
other modal already gets.

## Scope

**In scope**
- `api.md`, `infrastructure.md`, `ui.md` updated to accurately describe the
  existing GitLab browser-token mechanism (`src/gitlab-token.ts`,
  `GET`/`POST`/`DELETE /api/auth/gitlab`, `GitLabAuthModal.tsx`) — already
  applied as part of this planning pass (defects `2c7929b5`, `e1c63afa`,
  `0c265570`).
- `ReviewsMenu.tsx`'s `handleOpen` gains the same `auth_required: 'gitlab'`
  handling `Splash.tsx` already has — opens `GitLabAuthModal`, retries the
  same ref on successful save.
- `App.tsx`'s global `onKey` handler adds `investigationModalOpen` to the
  existing Submit/Reviews/Settings/Help short-circuit list (defect
  `c5de09b4`).

**Out of scope**
- Any change to the GitLab browser-auth *design* itself (only documenting
  and completing it, not reconsidering whether it should exist) — the
  `api.md` Auth section now explicitly calls it out as a deliberate
  exception rather than folding it into "fully delegated," but the
  mechanism itself is unchanged.
- The fifth (unscored, not machine-surfaced) `DEFECTS.md` note about
  `GitLabAuthModal` missing from `ui.md`'s Components list — resolved as a
  side effect of the artifact updates above, not tracked as its own task.

## Technical Approach

Per the updated `api.md`/`infrastructure.md`/`ui.md` (already applied):
`ReviewsMenu.tsx` gets the same two pieces of state `Splash.tsx` already
has (`gitlabAuthOpen`, and reuse of the ref just attempted) plus a check on
`openReview()`'s result for `auth_required === 'gitlab'`, rendering
`GitLabAuthModal` with an `onSuccess` that retries `handleOpen` with the
same ref — mirroring `Splash.tsx`'s existing pattern exactly rather than
inventing a new one. `handleConfirmDismiss`'s separate `openReview()` call
(switching to another saved review) is left alone — a saved review that
was previously opened successfully already has whatever credentials it
needed; the auth-prompt path only matters for a fresh ref the user is
typing in.

`App.tsx`'s fix is a one-line addition to the existing `if (submitOpen)
{...} if (reviewsOpen) {...}` chain — `investigationModalOpen` slots in the
same way, before the un-modal'd navigation shortcuts.

## Phase Breakdown

### Phase 1 — Document the GitLab browser-auth flow [artifacts: api, infrastructure, ui] [defect: 2c7929b5] [defect: e1c63afa] [defect: 0c265570]

Already applied during this planning session:
1. `api.md`: rewrote the Auth section to state the GitLab browser-token
   exception explicitly rather than claiming auth is "entirely delegated"
   to the local environment; documented `GET`/`POST`/`DELETE
   /api/auth/gitlab`; documented `POST /api/reviews/open`'s `401 {
   auth_required: 'gitlab' }` response.
2. `infrastructure.md`: added the browser-entered-token mechanism to the
   GitLab Integration Components entry (resolution order, persistence,
   `0o600` file, `loadGitLabToken()` startup call) and to the Storage
   section (`STATE_DIR/gitlab-token`).
3. `ui.md`: added `GitLabAuthModal.tsx` to the Components list; documented
   its trigger in `Splash.tsx`; noted `ReviewsMenu.tsx` will get the same
   handling in Phase 2.

Deliverable: artifacts accurately describe the shipped GitLab auth flow —
verifiable by re-running `/ardd-verify` and confirming these three defects
no longer reproduce.

### Phase 2 — `ReviewsMenu` auth-prompt parity (depends on Phase 1) [artifacts: ui, api]

1. In `web/src/components/ReviewsMenu.tsx`: add `gitlabAuthOpen` state and
   a `pendingRef` (or reuse the ref string already passed into `handleOpen`)
   so the retry knows what to reopen. In `handleOpen`, check
   `result.auth_required === 'gitlab'` before falling into the generic
   error branch — on match, set `gitlabAuthOpen: true` and return (mirror
   `Splash.tsx:23-26` exactly). Render `GitLabAuthModal` (already imported
   pattern from `Splash.tsx`) with `onSuccess` that closes the modal and
   calls `handleOpen` again with the same ref.
2. Tests (`tests/components/ReviewsMenu.test.tsx` if it exists, else a new
   file following the existing component-test conventions —
   `// @vitest-environment jsdom`, mock `../../web/src/api.ts`): opening a
   ref that returns `auth_required: 'gitlab'` opens `GitLabAuthModal`
   instead of showing the generic error; saving a token in the modal
   retries the same ref and, on success, closes both the modal and (via
   `onSwitched`) the menu.

Deliverable: opening a GitLab MR without a stored token from the in-app
"Open a review" form now prompts for a token instead of dead-ending on a
generic error message, verified manually in the running app and via the
new component test.

### Phase 3 — Fix `InvestigationModal`'s missing keyboard short-circuit [artifacts: ui] [defect: c5de09b4]

1. In `web/src/App.tsx`'s `onKey` handler: add `if (investigationModalOpen)
   { if (e.key === 'Escape') setInvestigationModalOpen(false); return; }`
   alongside the existing `submitOpen`/`reviewsOpen`/`settingsOpen`/
   `helpOpen` checks (and add `investigationModalOpen` to the effect's
   dependency array alongside the other modal-open flags).
2. Tests: extend the existing `tests/components/App.test.tsx` (or
   `InvestigationModal.test.tsx`) coverage — with the investigation banner
   open and the modal showing, pressing `f`/arrow-keys does not
   flag/navigate the underlying chunk, and pressing `Escape` closes the
   modal via the global handler.

Deliverable: `InvestigationModal` behaves identically to every other modal
for keyboard handling — verified via test and a quick manual check in the
running app (open the banner's modal, confirm arrow keys/`f`/`c` do
nothing to the chunk underneath, confirm `Escape` closes it).

## Complexity Tracking

None — both code fixes reuse an existing pattern exactly (the
`Splash.tsx` auth-prompt flow, the existing modal-short-circuit chain in
`App.tsx`) rather than introducing anything new.

## Open Questions

None.

## Production Annotation Summary

None new. The GitLab browser-auth exception is now documented as a
deliberate design choice (`api.md`'s Auth section), not a gap requiring a
Production Annotation.
