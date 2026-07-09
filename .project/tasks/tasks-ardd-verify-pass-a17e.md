---
plan: plan-ardd-verify-pass-2026-07-09.md
generated: 2026-07-09
status: in-progress
---

# Tasks

## Phase 2: `ReviewsMenu` auth-prompt parity

- [x] T001 [artifacts: ui, api] In `web/src/components/ReviewsMenu.tsx`,
  add `gitlabAuthOpen` state (`useState(false)`) and a `pendingRef` state
  (`useState('')`) to remember which ref to retry. In `handleOpen`
  (currently: awaits `openReview(refToOpen.trim())`, then checks
  `result.review && result.state`, else falls into the generic
  `setOpenError(result.error ?? 'Failed to open review')` branch): before
  that generic-error fallback, add a check for `result.auth_required ===
  'gitlab'` — on match, `setPendingRef(refToOpen.trim())`,
  `setGitlabAuthOpen(true)`, and return (mirror
  `web/src/components/Splash.tsx:23-26`'s exact same check, which already
  exists and works for the Splash-screen path). Import `GitLabAuthModal`
  from `./GitLabAuthModal.tsx` (already used the same way in `Splash.tsx`)
  and render it in `ReviewsMenu`'s JSX with `open={gitlabAuthOpen}`,
  `onClose={() => setGitlabAuthOpen(false)}`, and `onSuccess={() => {
  setGitlabAuthOpen(false); void handleOpen(pendingRef); }}`. Do not touch
  `handleConfirmDismiss`'s separate `openReview()` call (switching to
  another already-saved review) — per the plan, a previously-opened saved
  review doesn't need this prompt.

- [x] T002 [artifacts: ui] Tests for T001. If `tests/components/
  ReviewsMenu.test.tsx` doesn't exist yet, create it following the existing
  component-test conventions (`// @vitest-environment jsdom` docblock,
  `vi.mock('../../web/src/api.ts', ...)` pattern — see
  `tests/components/InvestigationModal.test.tsx` or
  `tests/components/SettingsPanel.test.tsx` for the shape). Cover: opening
  a ref via `OpenReviewForm` that resolves with `{ auth_required: 'gitlab'
  }` opens `GitLabAuthModal` instead of showing the generic error banner;
  saving a token in that modal (mock `authenticateGitLab`/
  `saveInvestigationConfig`-style resolved promise) closes the modal and
  re-calls `openReview` with the same ref; on a successful retry, the menu
  closes via `onSwitched`/`onClose` same as the normal open-review path.
  Run `npx vitest run --coverage` to confirm the new tests pass (frontend
  coverage is measured but not gated, per `CLAUDE.md`/`constitution.md`
  Quality Standards — no threshold to hit, just exercise the new branches).

## Phase 3: Fix `InvestigationModal`'s missing keyboard short-circuit

- [ ] T003 [artifacts: ui] In `web/src/App.tsx`'s `onKey` handler (the
  function containing the existing `if (submitOpen) {...}`, `if
  (reviewsOpen) {...}`, `if (settingsOpen) {...}`, `if (helpOpen) {...}`
  checks around line 313-333), add an equivalent block for
  `investigationModalOpen` (state already declared at line 72, modal
  already rendered at line 585): `if (investigationModalOpen) { if
  (e.key === 'Escape') setInvestigationModalOpen(false); return; }` —
  match the existing checks' exact style and placement in the chain (add
  it alongside the other four, order doesn't matter functionally but keep
  it grouped with them for readability). Also add
  `investigationModalOpen` to the `useEffect`'s dependency array (existing
  deps around line 369-372: `helpOpen, submitOpen, reviewsOpen,
  settingsOpen`) so the handler closure captures the current value —
  without this the check would silently use a stale value.

- [ ] T004 [artifacts: ui] Tests for T003. Extend
  `tests/components/App.test.tsx`'s existing "investigation access banner"
  describe block (or add a new one) to cover: with the investigation modal
  open (click the banner to open it), pressing a navigation/action key
  (e.g. `f` for flag, or an arrow key) does not trigger the underlying
  chunk's flag/navigation action (assert `postAction`/navigation state is
  unaffected); pressing `Escape` while the modal is open closes it (assert
  the modal's content is no longer in the document) via the global
  handler, not just the modal's own internal `onKeyDown`. Run `npx vitest
  run --coverage` to confirm.

- [ ] T005 [artifacts: ui] Manual verification (no automated test): run the
  app (`pnpm dev`), open a review, click the investigation-access banner
  to open `InvestigationModal`, and confirm pressing `f`/`c`/arrow keys
  does nothing to the chunk underneath and `Escape` closes the modal —
  matching every other modal's (Submit/Reviews/Settings/Help) existing
  behavior.

## Phase 4: Full-suite verification

- [ ] T006 Run `npx vitest run --coverage` (full suite green, `src/**/*.ts`
  above the 90% statements/lines gate per `constitution.md`'s Quality
  Standards), `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p
  web/tsconfig.json --noEmit`, and `npx eslint .` — all clean. Then
  re-run `/ardd-verify` (or at minimum manually re-check defect
  `c5de09b4` and the `ReviewsMenu` auth-parity gap noted in `DEFECTS.md`)
  to confirm both are resolved.
