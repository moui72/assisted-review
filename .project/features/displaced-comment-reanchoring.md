---
slug: displaced-comment-reanchoring
status: implemented
logged: 2026-07-02
plan: plan-refactpr-2026-07-03.md
tasks: tasks-refactpr-7f00.md
---

On reopening a review whose diff has changed shape, detect drafted comments/notes/flags whose `chunk_id` no longer resolves to a recognizably-similar chunk, de-anchor them instead of silently keeping a stale/wrong `chunk_id` or dropping them, warn the reviewer that comments were displaced, and let the reviewer pick a new anchor point (chunk + line) for each one.
Why: `chunk_id`s remain unstable sequential ids (no id-scheme change) — flagged by `/ardd-critique` (`critique.md`) as a silent comment-drop/misattribution risk on reopen; this is the accepted remediation (de-anchor + warn + manual re-anchor) rather than content-derived stable ids.
