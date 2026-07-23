---
plan: plan-refactpr-2026-07-01.md
generated: 2026-07-01
status: completed
---

# Tasks

## Phase 1: Fix the empty state

- [x] T001 [artifacts: ui] In `web/src/components/OverviewView.tsx`, branch
  the `<footer>` block (currently unconditionally renders "Review
  {chunkCount} chunks one at a time." + a "Begin review →" button wired to
  `onBegin`) on `chunkCount === 0`:
  - When `chunkCount === 0`: render a single message instead — e.g. `No
    reviewable changes in this {pr.platform === 'gitlab' ? 'MR' : 'PR'}.`
    (mirror the existing `pr.platform === 'gitlab' ? 'MR' : 'PR'` ternary
    already used for the description `Collapsible` label above it) — and
    render no button at all (not a disabled one).
  - When `chunkCount > 0`: keep the existing "Review {chunkCount} chunks one
    at a time." text and "Begin review →" button unchanged.
  - Do not touch `onBegin`/`jump`/`App.tsx` — the prop contract and
    navigation guard (`jump()`'s `if (!total) return` at `App.tsx:154`) are
    correct as-is; this task is presentation-only.

- [x] T002 [artifacts: ui] Add `tests/components/OverviewView.test.tsx`
  (`// @vitest-environment jsdom` docblock, following the existing pattern in
  `tests/components/ErrorBanner.test.tsx`/`Splash.test.tsx`). Cover:
  - `chunkCount: 0` → renders the new empty-state message, does not render a
    "Begin review" button (`screen.queryByRole('button', { name: /begin
    review/i })` is `null`).
  - `chunkCount: 3` (or any `> 0`) → still renders "Review 3 chunks one at a
    time." and a "Begin review →" button that calls the `onBegin` prop when
    clicked.
  Construct minimal `pr`/`meta`/`jira`/`ai` props matching `OverviewView`'s
  existing prop types (see `web/src/components/OverviewView.tsx`'s prop
  destructure and `web/src/api.ts`'s `PrRef`/`PrMeta`/`JiraContext` types);
  reuse/adapt fixture-building patterns already present in
  `tests/components/SubmitModal.test.tsx` if one exists for building a
  minimal `Review`-shaped object.
  Run `npx vitest run tests/components/OverviewView.test.tsx` to confirm both
  cases pass before moving on.

## Phase 2: Reconcile artifacts

- [x] T003 [artifacts: ui] Depends on T001/T002 landing. Run `/ardd-refine ui`
  to correct `ui.md`'s "Empty/zero-chunk PR" entry under States: it currently
  claims `jump()`'s clamp leaves "no view to render," which was already known
  to be inaccurate (`OverviewView` does render) — update it to describe the
  *implemented* empty-state message instead of the old "Confirmed gap, needs
  an explicit empty state" framing.

- [x] T004 Depends on T003. Remove the resolved
  "Empty/zero-chunk PR" entry from `.project/DEFECTS.md` (it will no longer
  be accurate once `ui.md` and the code agree), or run `/ardd-verify` to
  regenerate `DEFECTS.md` from scratch and confirm it comes back empty.
