---
status: planned
created: 2026-07-11
plan: plan-keyboard-mod-guard-fix-2026-07-11.md
---

# Feedback

## Bugs
- [x] F001 The bare-key shortcuts `f` (flag chunk) and `a` (focus Ask
  Claude) in `App.tsx`'s global `keydown` handler (`web/src/App.tsx`, the
  `onKey` function) are not guarded by the `mod` flag, so `⌘F`/`Ctrl+F`
  (browser find) and `⌘A`/`Ctrl+A` (select all) get hijacked — the same
  class of bug T001 fixed for `c` (`feedback-cmd-c-copy-broken`). Guard both
  the `f` and `a` branches with `&& !mod` so the browser's native
  `⌘`/`Ctrl` combos pass through, matching the `c` fix. Worth checking `n`
  (`⌘N` new window) and `p` (`⌘P` print) in the same handler while there —
  they share the same unguarded shape. [artifacts: ui]
