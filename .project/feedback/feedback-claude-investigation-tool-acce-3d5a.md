---
status: planned
created: 2026-07-07
plan: plan-claude-investigation-tool-access-2026-07-08.md
---

# Feedback

## Reconsidered
- [x] F001 The current no-tools restriction on the headless `claude` invocation
  (`--disallowed-tools Bash Edit Write Read Grep Glob WebFetch WebSearch Task
  NotebookEdit`, `cwd: tmpdir()`, `src/claude.ts`) is too strict. Claude
  should be able to read the full contents of files touched by the diff (not
  just the clipped diff hunks), and should be able to explore the rest of the
  repo when answering a reviewer's follow-up question, instead of being
  strictly diff-grounded with zero filesystem/repo access. [artifacts:
  infrastructure]
  Note: `infrastructure.md`'s Claude section frames today's restriction as a
  deliberate default, with `repo-aware-investigation-mode`
  (`.project/features/repo-aware-investigation-mode.md`, backlogged) as an
  explicit *opt-in* `--repo <path>` escape hatch from it. This feedback asks
  whether that should instead become the default (or a much wider default
  capability) rather than an opt-in flag — a genuine reversal of the
  constitution-referenced "diff-grounded by default" decision, not just
  exercising the already-planned opt-in.
