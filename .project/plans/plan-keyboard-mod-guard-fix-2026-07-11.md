---
status: approved
branch: keyboard-mod-guard-fix
created: 2026-07-11
features: []
surfaced-defects: []
---

# Plan: guard remaining single-letter shortcuts with !mod

## Goal

Stop the remaining bare-key global shortcuts from hijacking browser
`⌘`/`Ctrl` combos, completing the fix landed for `c` in #83.

## Scope

**In:**
- Guard the single-letter shortcut branches in `App.tsx`'s `onKey` handler —
  `f` (flag), `a` (ask), `n`/`p` and their `j`/`k` nav aliases — with `!mod`,
  so `⌘F`/`⌘A` (find, select-all), `⌘N`/`⌘P` (new window, print), etc. pass
  through to the browser. `c` is already guarded.
- Extend the App keydown test to cover the modifier passthrough.
- Update `ui.md`'s Keyboard Model to state the single-letter shortcuts are
  `!mod`-guarded.
- Addresses `feedback-keyboard-mod-guard-f-and-a-sho` F001.

**Out:**
- The `⌘→`/`⌘←` behavior (deliberately uses `mod` for unviewed-navigation) —
  unchanged.
- Any new shortcuts or rebinding.

## Technical Approach

In `web/src/App.tsx`'s `onKey` handler, the arrow-key branches already
distinguish `mod` (they do unviewed-jump on `mod`), but the single-letter
branches fire on the bare key regardless of modifier. Add `&& !mod` to each
of the `n`/`p`/`j`/`k`/`f`/`a` branches (mirroring the merged `c` guard) so a
held `⌘`/`Ctrl` lets the event fall through to the browser's native handler.
This is the same one-line-per-branch shape as T001's `c` fix, applied to its
siblings — no structural change.

## Phase Breakdown

### Phase 1 — Guard the shortcuts
- Add `&& !mod` to the `n`/`p`/`j`/`k`/`f`/`a` branches of the global keydown
  handler in `web/src/App.tsx`, so modifier combinations pass through to the
  browser (`feedback-keyboard-mod-guard-f-and-a-sho` F001) `[artifacts: ui]`.
  Test: extend `tests/components/App.test.tsx` to assert `⌘/Ctrl+F` and
  `⌘/Ctrl+A` do not `preventDefault` (and don't trigger flag/ask), while the
  bare keys still do — reusing the `createEvent`/`fireEvent` pattern the
  `c`-passthrough test already uses.
- Update `ui.md`'s Keyboard Model to note the single-letter shortcuts
  (`f`/`c`/`a`/`n`/`p`/`j`/`k`) fire only without a modifier, so browser
  combos pass through `[artifacts: ui]`.

## Open Questions

None — the fix pattern is established by the merged `c` fix.

## Production Annotation Summary

None — a bug fix; no new production shortcut or deliberate gap introduced.
