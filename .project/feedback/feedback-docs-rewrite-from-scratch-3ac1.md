---
status: open
created: 2026-07-13
plan: null
---

# Feedback

## Reconsidered
- [ ] F001 GitLab auth transport/credential precedence should put the browser-entered token first, ahead of `glab` CLI availability. Today (`infrastructure.md` "Transport selection") `glabAvailable()` is checked first and, if present, every GitLab call always shells out to `glab` — the browser-entered token (`gitlab-token.ts`) only gets consulted within the REST-fallback path, i.e. only when `glab` is absent. A naive-reader doc review of the just-rewritten README/ARCHITECTURE surfaced that the README's stated priority order (browser token → `glab` → env var) doesn't match this actual code behavior. Beyond just fixing the docs to describe current behavior, the reporter's judgment is that the *behavior itself* should change: a reviewer who has explicitly entered a browser token (an active, deliberate choice) should have it take priority even when `glab` happens to be installed and authenticated — `glab` and `GITLAB_TOKEN` should fall in below it, not above. [artifacts: infrastructure, api]
