---
status: planned
created: 2026-07-10
plan: plan-readme-and-ux-fixes-2026-07-11.md
---

# Feedback

## Bugs
- [x] F001 Cmd+C (copy) doesn't work anywhere in the app outside a focused textarea/input. Root cause: the global keydown handler in `App.tsx`'s keyboard-navigation `useEffect` (`web/src/App.tsx:358-360`) matches on `e.key === 'c'` alone, without checking the `mod` (⌘/Ctrl) flag it computes at line 312 — so Cmd+C triggers the same branch as a bare `c` keypress, calling `e.preventDefault()` and shifting focus into the comment textarea via `textareaRef.current?.focus()`. This both blocks the native copy (via preventDefault) and steals focus away from whatever the user was trying to copy from. Fix: guard the `c` branch with `!mod` (matching how `ArrowRight`/`ArrowLeft` already branch on `mod` at lines 340-347), so Cmd+C/Ctrl+C passes through untouched. [artifacts: ui]
