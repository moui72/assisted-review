# assisted-review — Project Status

_Updated: 2026-07-09 (drafted plan for /ardd-verify defect fixes; documented GitLab browser-auth flow). Keep this current as artifacts are refined and open questions are resolved._

ARDD update available: installed `9189817`, source at `5fba0e5` — run
`/ardd-update`.

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | — |
| datamodel.md | stable ✅ (diagram stale on this branch, current on `main` pending #69) | — |
| infrastructure.md | stable ✅ (diagram stale) | — |
| api.md | stable ✅ | — |
| ui.md | stable ✅ (diagram stale) | — |
| features.md | register (no status field, by design) | — |

## Open Questions

None remain within any single artifact.

## Cross-Artifact Issues

None found this pass. `api.md`, `infrastructure.md`, and `ui.md` were
updated to document the GitLab browser-auth flow consistently — cross-links
between the three (`GET`/`POST`/`DELETE /api/auth/gitlab` in `api.md`,
`src/gitlab-token.ts` storage in `infrastructure.md`, `GitLabAuthModal.tsx`
in `ui.md`) all resolve to matching descriptions.

## Constitution Compliance

No violations.

## Diagrams

- datamodel.md — stale ⚠️ on this branch (current on `main`, pending PR #69)
- infrastructure.md — stale ⚠️ (GitLab browser-token entry added
  2026-07-09, on top of the pending #69 render)
- ui.md — stale ⚠️ (`GitLabAuthModal` component entry added 2026-07-09, on
  top of the pending #69 render)

## Code-vs-Artifact Defects

6 known defects — see `DEFECTS.md`, last checked 2026-07-08. 3 of the 4
machine-surfaced ones (`2c7929b5`, `e1c63afa`, `0c265570` — the GitLab
browser-auth documentation gap) are resolved by this session's artifact
updates, pending a fresh `/ardd-verify` pass to confirm. The 4th
(`c5de09b4`, `InvestigationModal` keyboard short-circuit bug) and the
`ReviewsMenu` auth-prompt-parity gap are planned
(`plan-ardd-verify-pass-2026-07-09.md`, Phases 2–3) but not yet
implemented.

## Feedback

0 open feedback files. `feedback-claude-investigation-tool-acce-3d5a.md`
and `feedback-inline-comment-editing-ui-7382.md` are both `planned`.

## Feature Backlog

12 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`. This plan targets no feature slugs (`features: []`)
— it's defect-driven, not feature-driven.

## In Flight

- Branch `ardd-verify-pass` (current checkout), open as PR #70 —
  `plan-ardd-verify-pass-2026-07-09.md` drafted (`status: draft`); Phase 1
  (artifact documentation) already applied and pushed, Phases 2–3 (code
  fixes) not yet started. Implementing them here will update PR #70 rather
  than open a new one.
- PR #69 `ardd-render-diagrams` — Mermaid diagrams refreshed for
  datamodel/infrastructure/UI; open, not yet merged; independent of #70.
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — stale, unrelated to current work.

## Recommended Next Step

Run `/ardd-tasks` to select `plan-ardd-verify-pass-2026-07-09.md` (approves
it, generates its task list), then implement Phases 2–3 (`ReviewsMenu` auth
parity, `InvestigationModal` keyboard fix) on this same branch — it already
has an open PR (#70), so this becomes an update to that PR rather than a
new one. After implementing, re-run `/ardd-verify` to confirm the
documentation-only defects are resolved. Merge PR #69 whenever convenient
(independent of this work). Consider `/ardd-update` (source has moved to
`5fba0e5`).
