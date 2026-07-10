# assisted-review — Project Status

_Updated: 2026-07-10 (approved `plan-log-version-on-launch-2026-07-10.md`
and generated its 11-task list via `/ardd-tasks`). Keep this current as
artifacts are refined and open questions are resolved._

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

None remain within any single artifact.

## Cross-Artifact Issues

None found this pass. `api.md`, `infrastructure.md`, and `ui.md` all
document the GitLab browser-auth flow consistently — cross-links between
the three (`GET`/`POST`/`DELETE /api/auth/gitlab` in `api.md`,
`src/gitlab-token.ts` storage in `infrastructure.md`, `GitLabAuthModal.tsx`
in `ui.md`) all resolve to matching descriptions.

## Constitution Compliance

No violations.

## Diagrams

- datamodel.md — current ✅
- infrastructure.md — stale ⚠️ (run `/ardd-render infrastructure`)
- ui.md — stale ⚠️ (run `/ardd-render ui`)

## Code-vs-Artifact Defects

6 known defects — see `DEFECTS.md`, last checked 2026-07-08 (stale relative
to current `main`). All 4 machine-surfaced ones are believed resolved in
code: GitLab browser-auth flow documented (`api.md`/`infrastructure.md`/
`ui.md`, PR #71), `ReviewsMenu` auth-prompt parity with `Splash`
implemented, and the `InvestigationModal` keyboard short-circuit bug fixed
— all merged via PR #72. A fresh `/ardd-verify` pass would confirm and
refresh `DEFECTS.md`.

## Feedback

2 open feedback files, to be picked up by a future `/ardd-plan`:
- `feedback-ai-note-followup-rendering-3deb.md` (F001: Ask-Claude
  follow-up notes render as flat unformatted text instead of parsing
  markdown — bold, code fences, bullet lists).
- `feedback-ask-ai-conversation-context-6109.md` (F001: Ask Claude
  follow-up questions don't include prior turns/initial analysis in the
  prompt — each question is answered cold, with no conversational memory).

`feedback-claude-investigation-tool-acce-3d5a.md`,
`feedback-inline-comment-editing-ui-7382.md`, and
`feedback-log-version-on-launch-f832.md` are all `planned`.

## Feature Backlog

12 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`.

## In Flight

- Branch `log-version-on-launch` (current checkout) — plan approved,
  `tasks-log-version-on-launch-e638.md` ready, 0/11 complete. Run
  `/ardd-implement` to execute.
- Draft plan `plan-ardd-verify-pass-2026-07-09.md` (branch `ardd-verify-pass`,
  not yet approved/tasked) — targets the 4 machine-surfaced `DEFECTS.md`
  entries. Believed already resolved in code via PR #72 (per this file's
  Code-vs-Artifact Defects section below); a fresh `/ardd-verify` pass should
  confirm before deciding whether this plan is still needed or should be
  superseded.
- Worktree `.claude/worktrees/polished-juggling-curry` (branch
  `worktree-polished-juggling-curry`, locked) — no tasks file
  (`tasks=none`); purpose unclear from this branch, not investigated this
  pass.

## Recommended Next Step

Run `/ardd-implement` to execute `tasks-log-version-on-launch-e638.md`'s 11
tasks (CLI startup version log, `GET /api/config` + `SettingsPanel.tsx`
version display, tests) on this branch. Separately, a fresh `/ardd-verify`
pass is overdue to confirm the 6 known `DEFECTS.md` entries are resolved
(stale since 2026-07-08), refresh the two stale diagrams
(`infrastructure.md`/`ui.md`), and settle whether `plan-ardd-verify-pass-
2026-07-09.md` is still needed.
