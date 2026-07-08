# assisted-review — Project Status

_Updated: 2026-07-08 (merged #67/#68 into claude-investigation-tool-access ahead of #63's merge). Keep this current as artifacts are refined and open questions are resolved._

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

None found this pass. `claude-investigation-tool-access` (#63) is fully
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
modal/banner/Settings entry all match the shipped implementation. This
branch has also picked up #67 (shieldcn badge row redesign) and #68 (ARDD
updated to `9189817`) via merge from `main`, resolving the resulting
`STATUS.md` conflict by hand.

## Constitution Compliance

No violations. The three Complexity Tracking deviations recorded in the
plan (new per-repo persisted config, `git`-via-`gh`/`glab repo clone`
dependency, clone lifecycle/pruning machinery) all shipped as designed —
opt-in, off by default, reusing existing auth and atomic-write patterns.

## Diagrams

- datamodel.md — stale ⚠️ (run /ardd-render datamodel — InvestigationConfig
  added 2026-07-08)
- infrastructure.md — stale ⚠️ (run /ardd-render infrastructure — npm
  registry update-check and Repo Investigation Access sections added since
  last render)
- ui.md — stale ⚠️ (run /ardd-render ui — preload busy-state narrowing plus
  InvestigationModal/banner/Settings entry added since last render)

## Code-vs-Artifact Defects

0 known defects — see `DEFECTS.md`, last checked 2026-07-03. Worth a fresh
`/ardd-verify` pass given the volume of recent changes (update-check,
claude-investigation-tool-access) — not urgent, but due.

## Feedback

0 open feedback files. `feedback-claude-investigation-tool-acce-3d5a.md`
and `feedback-inline-comment-editing-ui-7382.md` are both `planned`.

## Feature Backlog

12 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`. `repo-aware-investigation-mode` is now `implemented`
(marked superseded by `claude-investigation-tool-access` — its
`local-path` mode delivers the `--repo`-equivalent capability and more;
noted in the register entry rather than built independently).

## In Flight

- PR #63 `claude-investigation-tool-access` (current checkout) — fully
  implemented and tested, now includes #67/#68 via merge; ready to merge
  once CI is green on the merge commit.
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — stale, unrelated to current work.

## Recommended Next Step

Push the resolved merge commit, confirm CI is green, then merge PR #63.
Three diagrams (`datamodel`, `infrastructure`, `ui`) are outstanding
(non-blocking); consider `/ardd-verify` given the volume of recent changes.
