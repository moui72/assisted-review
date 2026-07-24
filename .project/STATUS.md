# assisted-review — Project Status

_Updated: 2026-07-24 (post-`/ardd-update` status pass)._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.4.0, refined 2026-07-22) | — |
| datamodel.md | stable ✅ (refined 2026-07-22) | — |
| infrastructure.md | stable ✅ (refined 2026-07-22) | — |
| api.md | stable ✅ (refined 2026-07-22) | — |
| ui.md | stable ✅ (refined 2026-07-22) | — |

No `[OPEN: ...]`, `TODO`, or `TBD` markers in any artifact. Artifacts are
unchanged since the 2026-07-23 pass (last artifact commit: `fc3fac2`).

## Cross-Artifact Issues

None.

## Within-Artifact Issues

None.

## Constitution Compliance

No violations found in this pass.

## Diagrams

- datamodel.md — stale ⚠️ (`erDiagram` — run `/ardd-diagram datamodel`)
- infrastructure.md — stale ⚠️ (`graph TD` — run `/ardd-diagram infrastructure`)
- ui.md — stale ⚠️ (`graph TD` — run `/ardd-diagram ui`)

Rendered to `docs/ARCHITECTURE.md`.

## Code-vs-Artifact Defects

None — `DEFECTS.md` all-clear, last checked 2026-07-11. Refresh with
`/ardd-defects`; that survey now predates several merged PRs (#112, #113,
#114, #115).

## Feedback

2 open feedback files — `feedback-ardd-update-usage-improvements-1c35.md`
and `feedback-ardd-badge-toolchain-defects-dbbf.md` (six upstream ArDD
toolchain defects found while auditing the version badge). Both will be
picked up by the next `/ardd-plan`.

## Feature Backlog

11 backlogged · 0 planned · 0 tasked · 12 implemented — see
`.project/features/`. Target a backlogged slug with `/ardd-plan <slug>`.

The three formerly-`tasked` entries bound to `plan-1a23-2026-07-22-7942.md`
were flipped to `implemented` in this pass (see Orphaned Completion Flips).

## Documented but Untracked

None. Every capability described in the stable artifacts is implemented,
already represented by an active feature/task, or documented as future work.

## Orphaned Completion Flips

- Slugs `codex-ai-provider-support`, `claude-model-selection`, and
  `ai-stream-stop-regenerate` — tasks file `tasks-1a23-cc11.md` is
  `status: completed` and its work merged into `main` via PR #112
  (`fc3fac2`), but the register still says `status: tasked`.
  `completion-flip-check.sh` does not catch this one: the plan does record
  `branch: 1a23`, but that branch was deleted when the PR merged, so the
  script's `git merge-base --is-ancestor` gate errors, is swallowed by
  `2>/dev/null`, and exits 0 indistinguishably from "nothing orphaned".
  Detection was manual this pass. Logged upstream as F003 in
  `feedback-ardd-badge-toolchain-defects-dbbf.md`. **Resolved in this pass** — all three were
  flipped to `implemented` with `ardd-state.sh feature-flip`.

## Work Queue

No ready task files.

## In Flight

- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — `tasks=none`, unmerged, not reapable.

No open draft PRs were found in this pass.

## ArDD Toolchain

Installed ArDD is up to date on the beta channel
(`20d896018b04891ce17a0221824635222ce6817f`, `v1.2.1-beta.1`), updated this
run from `9bc9b38` / `v1.1.1-beta.3`.

## Summary

4 issues found: the three stale diagrams plus the orphaned completion flip
for the `1a23` feature set. Safe to `/ardd-plan`: yes; no ready task files
remain.

## Recommended Next Step

`/ardd-defects` — the last code-vs-artifact survey (2026-07-11) predates four
merged PRs. After that, clear the stale diagrams with `/ardd-diagram
datamodel`, `/ardd-diagram infrastructure`, and `/ardd-diagram ui`.

---

_Updated: 2026-07-23 (post-`/ardd-update` status pass)._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.4.0, refined 2026-07-22) | — |
| datamodel.md | stable ✅ (refined 2026-07-22) | — |
| infrastructure.md | stable ✅ (refined 2026-07-22) | — |
| api.md | stable ✅ (refined 2026-07-22) | — |
| ui.md | stable ✅ (refined 2026-07-22) | — |

No `[OPEN: ...]` or `TODO` markers in any artifact.

## Cross-Artifact Issues

None.

## Within-Artifact Issues

None.

## Constitution Compliance

No violations found in this pass.

## Diagrams

- datamodel.md — stale ⚠️ (`erDiagram` — run `/ardd-diagram datamodel`)
- infrastructure.md — stale ⚠️ (`graph TD` — run `/ardd-diagram infrastructure`)
- ui.md — stale ⚠️ (`graph TD` — run `/ardd-diagram ui`)

Rendered to `docs/ARCHITECTURE.md`.

## Code-vs-Artifact Defects

None — `DEFECTS.md` all-clear, last checked 2026-07-11. Refresh with
`/ardd-defects` because that survey predates several merged PRs.

## Feedback

1 open feedback file — `feedback-ardd-update-usage-improvements-1c35.md`.
Will be picked up by the next `/ardd-plan`.

## Feature Backlog

11 backlogged · 0 planned · 3 tasked · 9 implemented — see
`.project/features/`. Target a backlogged slug with `/ardd-plan <slug>`.

The three tasked entries are the feature set implemented on branch `1a23`
(`codex-ai-provider-support`, `claude-model-selection`,
`ai-stream-stop-regenerate`); they remain `tasked` until that PR lands and the
register is flipped.

## Documented but Untracked

None. Every capability described in the stable artifacts is implemented,
already represented by an active feature/task, or documented as future work.

## Work Queue

No ready task files.

## In Flight

- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — `tasks=none`, unmerged, not reapable.

No open draft PRs were found in this pass.

## ArDD Toolchain

Installed ArDD is up to date on the beta channel
(`9bc9b38fa85cb21afa2f4108b8b6a6b9f2dea0d2`, `v1.1.1-beta.3`).

## Summary

3 issues found: the stale datamodel, infrastructure, and UI diagrams. Safe
to `/ardd-plan`: yes; no ready task files remain.

## Recommended Next Step

Review/merge PR #112 for branch `1a23`, then run `/ardd-status` on the default
branch to catch any completion flips. Separately, run `/ardd-diagram
datamodel`, `/ardd-diagram infrastructure`, and `/ardd-diagram ui` to clear
the stale diagrams.

_Updated: 2026-07-22 (full `/ardd-status` pass)._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.4.0, refined 2026-07-22) | — |
| datamodel.md | stable ✅ (refined 2026-07-22) | — |
| infrastructure.md | stable ✅ (refined 2026-07-22) | — |
| api.md | stable ✅ (refined 2026-07-22) | — |
| ui.md | stable ✅ (refined 2026-07-22) | — |

No `[OPEN: ...]` or `TODO` markers in any artifact.

## Cross-Artifact Issues

None.

## Within-Artifact Issues

None.

## Constitution Compliance

No violations found in this pass.

## Diagrams

- datamodel.md — stale ⚠️ (`erDiagram` — run `/ardd-diagram datamodel`)
- infrastructure.md — stale ⚠️ (`graph TD` — run `/ardd-diagram infrastructure`)
- ui.md — stale ⚠️ (`graph TD` — run `/ardd-diagram ui`)

Rendered to `docs/ARCHITECTURE.md`.

## Code-vs-Artifact Defects

None — `DEFECTS.md` all-clear, last checked 2026-07-11. Refresh with
`/ardd-defects` because that survey predates several merged PRs.

## Feedback

1 open feedback file — `feedback-ardd-update-usage-improvements-1c35.md`
(F001-F003: `$ardd-update` Codex-sandbox guidance, installer-suggestion
application flow, and up-to-date reinstall confirmation behavior). Will be
picked up by the next `/ardd-plan`.

## Feature Backlog

11 backlogged · 0 planned · 3 tasked · 9 implemented — see
`.project/features/`. Target a backlogged slug with `/ardd-plan <slug>`.

Register-coverage note: the GitLab browser-token auth capability
(`src/gitlab-token.ts`, PR #50) has no entry in `.project/features/` though it
is fully implemented. Not a "Documented but untracked" finding because that
test requires no code implementation either; the register under-describes
shipped work.

## Documented but Untracked

None. Every capability described in the stable artifacts is implemented,
already represented by an active feature/task, or documented as future work.

## Work Queue

- `tasks-1a23-cc11.md` — ready, 0/20, plan
  `plan-1a23-2026-07-22-7942.md`, features
  `codex-ai-provider-support`, `claude-model-selection`,
  `ai-stream-stop-regenerate`.

Only one ready tasks file exists, so there are no pairwise ready-task overlap
verdicts. `independent` verdicts, when present, mean no declared overlap only;
`merge_policy` still governs merge-time conflicts.

## In Flight

- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — `tasks=none`, unmerged, not reapable.

No open draft PRs were checked in this pass.

## ArDD Toolchain

Installed ArDD is up to date on the beta channel
(`997e7d28878ffed151091206c14f4bc485f2e28c`, `v1.1.1-beta.2`).

## Summary

3 issues found: the stale datamodel, infrastructure, and UI diagrams. Safe
to `/ardd-plan`: yes; current implementation queue is ready.

## Recommended Next Step

`/ardd-implement` — execute the ready task file
`tasks-1a23-cc11.md`.

Then:

- `/ardd-diagram datamodel`, `/ardd-diagram infrastructure`, and
  `/ardd-diagram ui` — clear stale diagrams.
- `/ardd-defects` — the last code-vs-artifact survey is eleven days and
  several merged PRs old.
