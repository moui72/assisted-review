---
slug: repo-aware-investigation-mode
status: implemented
logged: 2026-07-02
---

An optional `--repo <path>` mode that enables read-only Read/Grep/Glob tools so Claude can investigate cross-file context, instead of being strictly diff-grounded with all built-in tools disabled.
Why: current design (`infrastructure.md`'s Claude section) deliberately disables all built-in tools so Claude answers only from the diff text — this is an explicit, opt-in escape hatch from that default, not a reversal of it.
Issue: moui72/assisted-review#31

Superseded by `claude-investigation-tool-access` (feedback-driven,
`plan-claude-investigation-tool-access-2026-07-08.md`): a broader
per-repo, persisted `InvestigationConfig` with five modes
(`none`/`local-path`/`api`/`temp-clone`/`always-clone`), surfaced via a UI
modal rather than a CLI `--repo <path>` flag. `local-path` mode delivers
this feature's `--repo`-equivalent capability (read-only repo access from
a given directory) and more — marked `implemented` via that work rather
than built independently.
