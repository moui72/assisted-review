# assisted-review — Project Status

_Updated: 2026-07-08 (completed a full /ardd-verify pass). Keep this current as artifacts are refined and open questions are resolved._

ARDD update available: installed `9189817`, source at `5fba0e5` — run
`/ardd-update`.

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | — |
| datamodel.md | stable ✅ (diagram stale on this branch — current on `main` via #69, pending merge) | — |
| infrastructure.md | stable ✅ (diagram stale on this branch — current on `main` via #69, pending merge) | — |
| api.md | stable ✅ | — |
| ui.md | stable ✅ (diagram stale on this branch — current on `main` via #69, pending merge) | — |
| features.md | register (no status field, by design) | — |

## Open Questions

None remain within any single artifact. The plan's two Open Questions
(whether the 30-day `always-clone` idle TTL should be env-configurable,
whether a repo-size/clone-count warning is needed) remain unresolved but
non-blocking — documented as tunable-if-needed in `infrastructure.md`.

## Cross-Artifact Issues

None found this pass beyond what's tracked as code-vs-artifact defects below
(a full `/ardd-verify` survey, not an inter-artifact consistency issue).

## Constitution Compliance

No violations found this pass (spot-checked during `/ardd-verify`).

## Diagrams

- datamodel.md — stale ⚠️ on this branch (already `current` on `main` via
  PR #69, which branched separately and hasn't merged into this branch's
  base yet — no action needed once #69 merges)
- infrastructure.md — stale ⚠️ on this branch, same as above
- ui.md — stale ⚠️ on this branch, same as above

## Code-vs-Artifact Defects

6 known defects — see `DEFECTS.md`, last checked 2026-07-08. Two
substantive: (1) the GitLab browser-entered-token flow
(`src/gitlab-token.ts`, `GET/POST/DELETE /api/auth/gitlab`,
`GitLabAuthModal.tsx`) is undocumented across `api.md`/`infrastructure.md`/
`ui.md` and directly contradicts `api.md`'s "Auth: None, by design...
entirely delegated to gh auth/glab auth" claim; (2) `App.tsx`'s global
keydown handler is missing `InvestigationModal` from its modal
short-circuit list — a real bug (global shortcuts leak through, Escape
doesn't reliably close it), not just a doc gap. Four smaller findings
(undocumented `401 auth_required` response shape, missing `GitLabAuthModal`
component entry, a GitLab-auth UX asymmetry between `Splash`/`ReviewsMenu`)
are detailed in `DEFECTS.md`.

## Feedback

0 open feedback files. `feedback-claude-investigation-tool-acce-3d5a.md`
and `feedback-inline-comment-editing-ui-7382.md` are both `planned`.

## Feature Backlog

12 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`.

## In Flight

- Branch `ardd-verify-pass` (current checkout) — `DEFECTS.md` refreshed;
  committed **unsigned** (1Password unavailable both times it was tried) —
  needs re-signing before push per the standing signing convention, then
  push + PR.
- PR #69 `ardd-render-diagrams` — Mermaid diagrams refreshed for
  datamodel/infrastructure/UI; open, not yet merged.
- Worktree `.claude/worktrees/ardd-codify-trial` (branch
  `ardd-codify-trial`) — no tasks file.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — stale, unrelated to current work.

## Recommended Next Step

Re-sign the `ardd-verify-pass` commit once 1Password is available, push,
and open a PR. Then decide on the two substantive defects: fix the
`InvestigationModal` keyboard short-circuit bug (small, clear fix), and
decide whether to document the GitLab browser-auth flow as-is or reconsider
it (it contradicts `api.md`'s stated Auth model). Merge PR #69 whenever
convenient — independent of this work. Consider `/ardd-update` (source has
moved to `5fba0e5`).
