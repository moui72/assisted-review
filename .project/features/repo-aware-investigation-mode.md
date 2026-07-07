---
slug: repo-aware-investigation-mode
status: backlogged
logged: 2026-07-02
---

An optional `--repo <path>` mode that enables read-only Read/Grep/Glob tools so Claude can investigate cross-file context, instead of being strictly diff-grounded with all built-in tools disabled.
Why: current design (`infrastructure.md`'s Claude section) deliberately disables all built-in tools so Claude answers only from the diff text — this is an explicit, opt-in escape hatch from that default, not a reversal of it.
Issue: moui72/assisted-review#31
