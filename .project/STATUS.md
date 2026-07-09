# assisted-review — Project Status

_Updated: 2026-07-09 (approved plan and generated tasks for the /ardd-verify defect fixes). Keep this current as artifacts are refined and open questions are resolved._

ARDD update available: installed `9189817`, source at `8c7a8db` — run
`/ardd-update`.

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

None found this pass. `api.md`, `infrastructure.md`, and `ui.md`
consistently document the GitLab browser-auth flow (`GET`/`POST`/`DELETE
/api/auth/gitlab` in `api.md`, `src/gitlab-token.ts` storage in
`infrastructure.md`, `GitLabAuthModal.tsx` in `ui.md`), now merged to
`main` via PR #69 (diagrams) and PR #71 (this doc work), which both
merged since this plan was drafted.

## Constitution Compliance

No violations.

## Diagrams

- datamodel.md — current ✅ (via PR #69)
- infrastructure.md — stale ⚠️ (GitLab browser-token entry added
  2026-07-09, after #69's render)
- ui.md — stale ⚠️ (`GitLabAuthModal` component entry added 2026-07-09,
  after #69's render)

## Code-vs-Artifact Defects

6 known defects — see `DEFECTS.md`, last checked 2026-07-08. 3 of the 4
machine-surfaced ones (GitLab browser-auth documentation gap) are resolved
by the artifact updates merged in PR #71, pending a fresh `/ardd-verify`
pass to confirm. The 4th (`InvestigationModal` keyboard short-circuit bug)
and the `ReviewsMenu` auth-prompt-parity gap are now tasked
(`tasks-ardd-verify-pass-a17e.md`, Phases 2–3) but not yet implemented.

## Feedback

0 open feedback files. `feedback-claude-investigation-tool-acce-3d5a.md`
and `feedback-inline-comment-editing-ui-7382.md` are both `planned`.

## Feature Backlog

12 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`. This plan targets no feature slugs (`features: []`)
— it's defect-driven, not feature-driven.

## In Flight

- Branch `ardd-verify-defect-fixes` (current checkout), open as PR #71 —
  plan approved, tasks `ready` (0/6 complete): `ReviewsMenu` auth-prompt
  parity (T001-T002), `InvestigationModal` keyboard short-circuit fix
  (T003-T005), full-suite verification (T006). Implementing these will
  update PR #71.
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — stale, unrelated to current work.

## Recommended Next Step

Implement `tasks-ardd-verify-pass-a17e.md` (T001 first — `ReviewsMenu` auth
parity has no dependencies). After implementing, re-run `/ardd-verify` to
confirm all four machine-surfaced defects and the `ReviewsMenu` UX
asymmetry are resolved. Consider `/ardd-update` (source has moved to
`8c7a8db`).
