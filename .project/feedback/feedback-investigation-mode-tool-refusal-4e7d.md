---
status: planned
created: 2026-07-10
plan: plan-ai-prompt-fixes-2026-07-10.md
---

# Feedback

## Bugs
- [x] F001 With investigation mode set to a clone mode (`temp-clone`/`always-clone`, and likely `local-path` too), the agent still refuses to investigate the actual repo — it stays diff-only even when explicitly told "I am asking you to do the investigation" / "you have permission to view the whole repo." Root cause: `buildPrompt`/`buildOverviewPrompt` (`src/claude.ts:50-52,86-91`) hard-code the intro text "Answer only from the diff shown; do not use tools" unconditionally, regardless of which investigation mode is active — even though `server.ts`'s `/api/claude` handler (`src/server.ts:451-459`) correctly resolves `allowRepoRead: true` and a `cwd` for `local-path`/`temp-clone`/`always-clone` modes, which does grant Read/Grep/Glob at the CLI-flag level (`src/claude.ts:138-140`). The prompt text directly contradicts the actual tool grant, so the model treats the instruction as authoritative and declines to use the tools it was in fact given. Fix: `buildPrompt`/`buildOverviewPrompt` need to know whether repo access is available (mirroring `allowRepoRead`) and adjust the intro accordingly — e.g. dropping/replacing the "do not use tools" line and instead inviting investigation via Read/Grep/Glob when repo access is granted. [artifacts: infrastructure]
