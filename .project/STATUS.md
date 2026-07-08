# assisted-review — Project Status

_Updated: 2026-07-08 (approved plan and generated tasks for claude-investigation-tool-access). Keep this current as artifacts are refined and open questions are resolved._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | — |
| datamodel.md | stable ✅ (diagram stale) | — |
| infrastructure.md | stable ✅ (diagram stale) | — |
| api.md | stable ✅ | — |
| ui.md | stable ✅ (diagram stale) | — |
| features.md | register (no status field, by design) | — |

## Open Questions

None remain within any single artifact. The plan itself carries two Open
Questions (not artifact gaps): whether the 30-day `always-clone` idle TTL
should be env-configurable, and whether a repo-size/clone-count warning is
needed before opting into `always-clone`.

## Cross-Artifact Issues

None found this pass. `feedback-claude-investigation-tool-acce-3d5a.md`
(F001, Reconsidered) is now `planned`, consumed into
`plan-claude-investigation-tool-access-2026-07-08.md`: `datamodel.md` gained
`InvestigationConfig`, `api.md` gained `GET`/`POST
/api/investigation-config` plus a note on `GET /api/claude` consulting it,
`infrastructure.md` gained a full "Repo Investigation Access" section
(five modes: `none`/`local-path`/`api`/`temp-clone`/`always-clone`) plus two
new Production Annotations, and `ui.md` gained `InvestigationModal`, an
investigation-access banner, and a Settings panel entry. All four
cross-reference consistently (`InvestigationConfig`/`investigation-config`
terms checked, no orphaned references).

## Constitution Compliance

No violations. Three Complexity Tracking entries recorded in the plan (new
per-repo persisted config type, new `git`-via-`gh`/`glab repo clone`
dependency, clone lifecycle/pruning machinery), each justified against the
simplicity principle — all opt-in, off by default (`mode: 'none'`).

## Diagrams

- datamodel.md — stale ⚠️ (run /ardd-render datamodel — InvestigationConfig
  added 2026-07-08)
- infrastructure.md — stale ⚠️ (run /ardd-render infrastructure — Repo
  Investigation Access section added 2026-07-08, on top of the still-stale
  npm registry update-check integration from 2026-07-07)
- ui.md — stale ⚠️ (run /ardd-render ui — InvestigationModal/banner/Settings
  entry added 2026-07-08, on top of the still-stale preload busy-state
  narrowing from 2026-07-06)

## Code-vs-Artifact Defects

0 known defects — see `DEFECTS.md`, last checked 2026-07-03. Note: this plan
is approved and tasked (26 tasks across 5 phases,
`tasks-claude-investigation-tool-access-60c7.md`, all unchecked) but nothing
implemented yet — artifacts-ahead-of-code by design at this stage, not a
defect.

## Feedback

0 open feedback files. `feedback-claude-investigation-tool-acce-3d5a.md` and
`feedback-inline-comment-editing-ui-7382.md` are both `planned`.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 5 implemented — see
`.project/features/`. No feature slugs were targeted by this plan (it
originated from feedback, not the feature register); the backlogged
`repo-aware-investigation-mode` entry is effectively superseded in spirit by
this plan's broader design but was not itself touched — worth reconciling
(e.g. marking it declined/merged) once this plan ships.

## In Flight

- Branch `claude-investigation-tool-access` (current checkout, freshly
  branched off `main` post `cli-update-check-notice` merge) — plan
  `approved`, tasks `ready` (0/26 complete, none implemented yet).
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — no tasks file.

## Recommended Next Step

Implement `tasks-claude-investigation-tool-access-60c7.md` (`/ardd-implement`
or manually, phase by phase — Phase 1 has no dependencies and unblocks
everything else). Also consider reconciling the now-redundant
`repo-aware-investigation-mode` backlog entry. Three diagrams are
outstanding (non-blocking): `/ardd-render datamodel`, `/ardd-render
infrastructure`, `/ardd-render ui`.
