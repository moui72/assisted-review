---
slug: os-aware-keyboard-hints
status: implemented
logged: 2026-07-01
plan: plan-refactpr-2026-07-02.md
tasks: tasks-refactpr-779d.md
---

Replace `navigator.userAgent` sniffing for Mac/Windows keyboard-hint glyphs (⌘ vs Ctrl, in the Help overlay and response bar) with a more robust OS-detection mechanism (e.g. `navigator.userAgentData` where available, with graceful fallback), so labels are less likely to mislabel on spoofed/frozen UA strings.
Why: flagged as a low-stakes but fragile pattern during `/ardd-critique` (`critique.md`) — worth fixing properly rather than leaving as an accepted risk indefinitely.
