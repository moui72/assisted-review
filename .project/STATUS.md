# assisted-review — Project Status

_Updated: 2026-07-08 (ARDD updated to artifact-driven-dev @ 9189817). Keep this current as artifacts are refined and open questions are resolved._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | — |
| datamodel.md | stable ✅ | — |
| infrastructure.md | stable ✅ (diagram stale) | — |
| api.md | stable ✅ | — |
| ui.md | stable ✅ (diagram stale) | — |
| features.md | register (no status field, by design) | — |

## Open Questions

None remain within any single artifact.

## Cross-Artifact Issues

None found this pass.

## Constitution Compliance

No violations.

## Diagrams

- datamodel.md — current ✅
- infrastructure.md — stale ⚠️ (run /ardd-render infrastructure — npm
  registry update-check and Repo Investigation Access sections added since
  last render)
- ui.md — stale ⚠️ (run /ardd-render ui — preload busy-state narrowing plus
  InvestigationModal/banner/Settings entry added since last render)

## Code-vs-Artifact Defects

0 known defects — see `DEFECTS.md`, last checked 2026-07-03. Worth a fresh
`/ardd-verify` pass given how much has landed since (update-check,
claude-investigation-tool-access) — not urgent, but due.

## Feedback

0 open feedback files on `main`. `feedback-inline-comment-editing-ui-7382.md`
is `planned`. Note: `feedback-claude-investigation-tool-acce-3d5a.md` is
`planned` on the still-open `claude-investigation-tool-access` branch (#63)
but hasn't reached `main` yet.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 5 implemented on `main` — see
`.project/features/`. Note: `repo-aware-investigation-mode` is marked
`implemented` (superseded) on the still-open `claude-investigation-tool-access`
branch (#63) but that flip hasn't reached `main` yet — counts here will shift
to 12/0/0/6 once #63 merges.

## In Flight

- PR #63 `claude-investigation-tool-access` — fully implemented, tested,
  and manually verified against a real PR; open, awaiting review/merge.
- PR #67 `readme-badges-redesign` — README badge row rebuilt with shieldcn
  (npm version, npm downloads, latest release, ARDD), gitignores the
  shieldcn-badges skill; open.
- PR #68 `ardd-update-9189817` (this branch) — ARDD skills updated from
  `cd7dbbe` to `9189817`, no pending migrations; open.
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — stale, unrelated to current work.

## Recommended Next Step

Review and merge the three open PRs (#63, #67, #68) — none conflict with
each other. After #63 merges, re-run `/ardd-analyze` to pick up the
feature-backlog and feedback shifts it carries. `/ardd-render infrastructure`
and `/ardd-render ui` are both outstanding (non-blocking). Consider
`/ardd-verify` given the volume of recent changes.
