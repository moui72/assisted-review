# assisted-review — Project Status

_Updated: 2026-07-08 (refreshed datamodel/infrastructure/UI diagrams via /ardd-render). Keep this current as artifacts are refined and open questions are resolved._

ARDD update available: installed `9189817`, source at `f39d348` — run
`/ardd-update`.

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | — |
| datamodel.md | stable ✅ | — |
| infrastructure.md | stable ✅ | — |
| api.md | stable ✅ | — |
| ui.md | stable ✅ | — |
| features.md | register (no status field, by design) | — |

## Open Questions

None remain within any single artifact. The plan's two Open Questions
(whether the 30-day `always-clone` idle TTL should be env-configurable,
whether a repo-size/clone-count warning is needed) remain unresolved but
non-blocking — documented as tunable-if-needed in `infrastructure.md`.

## Cross-Artifact Issues

None found this pass. All three renderable artifacts (`datamodel`,
`infrastructure`, `ui`) had their README diagrams refreshed to match the
`claude-investigation-tool-access` work: `InvestigationConfig` added to the
datamodel ERD; npm registry, repo-clone storage, and clone/fetch/checkout
flows added to the infrastructure diagram; `InvestigationModal` wired into
the UI component hierarchy.

## Constitution Compliance

No violations.

## Diagrams

- datamodel.md — current ✅
- infrastructure.md — current ✅
- ui.md — current ✅

## Code-vs-Artifact Defects

0 known defects — see `DEFECTS.md`, last checked 2026-07-03. Worth a fresh
`/ardd-verify` pass given the volume of changes since then (update-check,
claude-investigation-tool-access) — not urgent, but due.

## Feedback

0 open feedback files. `feedback-claude-investigation-tool-acce-3d5a.md`
and `feedback-inline-comment-editing-ui-7382.md` are both `planned`.

## Feature Backlog

12 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`.

## In Flight

- Branch `ardd-render-diagrams` (current checkout) — all three diagrams
  refreshed and committed; not yet pushed to a PR.
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — stale, unrelated to current work.

## Recommended Next Step

Push `ardd-render-diagrams` and open a PR. Consider `/ardd-update` (source
has moved to `f39d348`) and a fresh `/ardd-verify` pass given the volume of
recent changes.
