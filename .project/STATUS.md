# assisted-review — Project Status

_Updated: 2026-07-08 (claude-investigation-tool-access implementation complete). Keep this current as artifacts are refined and open questions are resolved._

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

None remain within any single artifact. The plan's two Open Questions
(whether the 30-day `always-clone` idle TTL should be env-configurable,
whether a repo-size/clone-count warning is needed) remain unresolved but
non-blocking — documented as tunable-if-needed in `infrastructure.md`.

## Cross-Artifact Issues

None found this pass. `claude-investigation-tool-access` is fully
implemented: all 26 tasks complete
(`tasks-claude-investigation-tool-access-60c7.md`), full test suite green
(478 tests), both typechecks and lint clean. Manual verification against a
real PR (moui72/assisted-review#62) confirmed all three testable modes
end-to-end: `local-path` let Claude grep the repo and correctly answer a
question about code outside the diff; `api` mode answered correctly from
full diff-touched-file content but explicitly declined to answer about a
file outside the diff (confirming the documented scope limit);
`temp-clone`'s directory was removed after closing the review. `none` mode
was reconfirmed unchanged (still correctly reports having no tools).
`datamodel.md`'s `InvestigationConfig`, `api.md`'s two new endpoints,
`infrastructure.md`'s Repo Investigation Access section, and `ui.md`'s
modal/banner/Settings entry all match the shipped implementation.

## Constitution Compliance

No violations. The three Complexity Tracking deviations recorded in the
plan (new per-repo persisted config, `git`-via-`gh`/`glab repo clone`
dependency, clone lifecycle/pruning machinery) all shipped as designed —
opt-in, off by default, reusing existing auth and atomic-write patterns.

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

0 known defects — see `DEFECTS.md`, last checked 2026-07-03. This branch's
work is now fully implemented and verified — worth a fresh `/ardd-verify`
pass at some point given the size of this change, though not urgent (manual
verification already exercised the real code paths).

## Feedback

0 open feedback files. `feedback-claude-investigation-tool-acce-3d5a.md`
and `feedback-inline-comment-editing-ui-7382.md` are both `planned`.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 5 implemented — see
`.project/features/`. `repo-aware-investigation-mode` (backlogged) is now
functionally superseded by the broader `claude-investigation-tool-access`
work — still worth an explicit reconciliation (decline or close out) since
it wasn't itself touched by this plan (which came from feedback, not the
feature register).

## In Flight

- Branch `claude-investigation-tool-access` (current checkout) — fully
  implemented and tested; not yet pushed to a PR.
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — no tasks file.

## Recommended Next Step

Push `claude-investigation-tool-access` and open a PR. Consider
reconciling the now-redundant `repo-aware-investigation-mode` backlog
entry first. Three diagrams (`datamodel`, `infrastructure`, `ui`) are
outstanding (non-blocking).
