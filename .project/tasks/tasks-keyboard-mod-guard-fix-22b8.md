---
plan: plan-keyboard-mod-guard-fix-2026-07-11.md
generated: 2026-07-11
status: completed
---

# Tasks

## Phase 1: Guard single-letter shortcuts

- [x] T001 [artifacts: ui] In `web/src/App.tsx`'s global keydown `onKey`
  handler, add `&& !mod` to the single-letter shortcut branches — `n`/`p`
  (and the `j`/`k` nav aliases), `f` (flag), and `a` (ask) — mirroring the
  already-guarded `c` branch. A held `⌘`/`Ctrl` then falls through to the
  browser's native handler (`⌘F` find, `⌘A` select-all, `⌘N`/`⌘P` etc.). Do
  not touch the `ArrowRight`/`ArrowLeft` branches — they intentionally use
  `mod` for unviewed-jump. Test: extend `tests/components/App.test.tsx`
  (reuse the `createEvent`/`fireEvent` pattern from the existing `c`
  passthrough test) to assert `⌘/Ctrl+F` and `⌘/Ctrl+A` do NOT `preventDefault`
  (and don't flag/focus-ask), while bare `f`/`a` still act.
  (feedback: feedback-keyboard-mod-guard-f-and-a-sho F001)

- [x] T002 [artifacts: ui] Update `ui.md`'s Keyboard Model to state that the
  single-letter shortcuts (`f`/`c`/`a`/`n`/`p`/`j`/`k`) fire only without a
  modifier, so browser `⌘`/`Ctrl` combos pass through — generalizing the
  existing `c`-only note. Documentation only; stamp `last_updated` to today.
