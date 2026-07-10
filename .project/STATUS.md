# assisted-review — Project Status

_Updated: 2026-07-10 (both `log-version-on-launch` and the
`ardd-verify-pass` defect fixes have merged to `main`; new UX feedback
captured via `/ardd-feedback`). Keep this current as artifacts are refined
and open questions are resolved._

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
document the new `app_version` field consistently, and all three
cross-reference the shipped code (`src/pkg-info.ts`, `src/cli.ts`,
`src/server.ts`'s `GET /api/config` handler, `SettingsPanel.tsx`).

## Constitution Compliance

No violations.

## Diagrams

- datamodel.md — current ✅
- infrastructure.md — stale ⚠️ (run `/ardd-render infrastructure`)
- ui.md — stale ⚠️ (run `/ardd-render ui`)

## Code-vs-Artifact Defects

`.project/DEFECTS.md` still lists 4 entries but is stale — last checked
2026-07-08, before the `ReviewsMenu.tsx`/`App.tsx` GitLab-auth and
keyboard-shortcut fixes merged to `main` (PR #72). Those 4 entries should
now reproduce as resolved; run `/ardd-verify` to confirm and regenerate the
file fresh.

## Feedback

6 feedback file(s) — see `.project/feedback/`:
- `feedback-ai-note-followup-rendering-3deb.md` (open — Ask Claude
  follow-up notes render as flat unformatted text instead of parsing
  markdown — bold, code fences, bullet lists).
- `feedback-ask-ai-conversation-context-6109.md` (open — Ask Claude
  follow-up questions don't include prior turns/initial analysis in the
  prompt — each question is answered cold, with no conversational memory).
- `feedback-overview-resume-review-41d6.md` (open — Overview page's
  footer button always reads "Begin review →" even after chunks have
  already been viewed; should read "Resume review" once `state.viewed` is
  non-empty).

`feedback-claude-investigation-tool-acce-3d5a.md`,
`feedback-inline-comment-editing-ui-7382.md`, and
`feedback-log-version-on-launch-f832.md` are all `planned`.

## Feature Backlog

12 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`.

## In Flight

None — no other worktrees, no draft plans/PRs pending.

## Recommended Next Step

A fresh `/ardd-verify` pass is overdue (stale since 2026-07-08) to confirm
the 4 current `DEFECTS.md` entries are resolved and regenerate the file,
and to refresh the two stale diagrams (`infrastructure.md`/`ui.md`) via
`/ardd-render`. Separately, `feedback-overview-resume-review-41d6.md` is
ready to be picked up by the next `/ardd-plan`.
