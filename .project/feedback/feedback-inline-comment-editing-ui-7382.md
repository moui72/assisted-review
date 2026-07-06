---
status: open
created: 2026-07-06
plan: null
---

# Feedback

## Bugs
- [ ] Verify whether the Overview page's AI summary preload is actually
  running/completing — user observed it appearing not to work, though
  considers this less likely than the UI simply not indicating the loading
  state (see Reconsidered below). Check `findNextPreload()`/preload
  triggering in `web/src/preload.ts` and whether the overview summary
  request actually fires and populates on load without user action.
  [artifacts: ui]

## Reconsidered
- [ ] `ui.md`'s "Background preload: silent — no dedicated UI state" decision
  (see `ui.md` "Background preload" bullet, and `web/src/preload.ts`'s
  `findNextPreload()`/`preloadAttemptedRef`) should be reversed for the case
  where an in-flight preload is relevant to the *currently viewed* chunk or
  the overview: the UI should show a loading indicator and discourage (e.g.
  disable) the user from triggering a redundant new analysis request
  (regenerate/summarize/ask) while that preload is still in flight. Applies
  to both the Overview's AI summary and per-chunk `AiCommentary`. Preloading
  for chunks/views the user isn't currently looking at can likely remain
  silent as today — this is specifically about the current-view case.
  [artifacts: ui]
