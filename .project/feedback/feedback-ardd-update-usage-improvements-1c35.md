---
status: open
created: 2026-07-22
plan: null
---

# Feedback

## UX
- [ ] F001 `$ardd-update` should make Codex harness sandbox behavior explicit: `source-resolve.sh` can write to the recorded source checkout (`~/.ardd/source`) and `install.sh` rewrites `.agents/skills`, so the skill should tell Codex agents to rerun those commands with escalation when sandboxed writes fail instead of treating the first failure as a user-facing update failure.
- [ ] F002 `$ardd-update` should streamline installer suggestions after relaying output: when the user approves a `.gitignore` suggestion, apply only missing patterns, preserve existing related patterns, show the diff, and report already-present entries.
- [ ] F003 `$ardd-update` should clarify the "up-to-date but reinstall anyway" branch for explicit user invocations. In non-headless Codex use, a direct `$ardd-update` command is already intent to reinstall/repair/see suggestions, so the skill should either continue without an extra confirmation or define a non-blocking confirmation fallback.
