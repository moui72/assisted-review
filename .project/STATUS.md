# assisted-review — Project Status

_Updated: 2026-07-10 (both `log-version-on-launch` and the
`ardd-verify-pass` defect fixes have merged to `main`; new UX and bug
feedback captured via `/ardd-feedback`, including a real root-cause finding
in `src/claude.ts`'s prompt-building and a Cmd+C-hijack bug in the global
keyboard handler; new feature idea `linkify-pr-header-and-diff-fil` logged
to the backlog). Keep this current as artifacts are refined and open
questions are resolved._

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

8 feedback file(s) — see `.project/feedback/`:
- `feedback-cmd-c-copy-broken-7a77.md` (open — bug: Cmd+C doesn't copy
  anywhere in the app outside a focused textarea/input, because the global
  keydown handler's `c` branch in `App.tsx:358-360` isn't guarded by the
  `mod` flag the way `ArrowRight`/`ArrowLeft` already are, so Cmd+C matches
  the bare-`c` "focus comment box" shortcut, calls `preventDefault()`, and
  steals focus).
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
- `feedback-investigation-mode-tool-refusal-4e7d.md` (open — bug: in
  clone/local-path investigation modes the agent still refuses to
  investigate the repo even when explicitly told it has permission,
  because `buildPrompt`/`buildOverviewPrompt` in `src/claude.ts:50-52,86-91`
  hard-code "do not use tools" regardless of the `allowRepoRead` grant
  `server.ts` actually gives it — the prompt text contradicts the real
  tool grant).

`feedback-claude-investigation-tool-acce-3d5a.md`,
`feedback-inline-comment-editing-ui-7382.md`, and
`feedback-log-version-on-launch-f832.md` are all `planned`.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`. Newest: `linkify-pr-header-and-diff-fil` (make the
PR title link out to the PR on GitHub, and each diff chunk's file name
link to that file in the PR's GitHub diff view). Target with
`/ardd-plan linkify-pr-header-and-diff-fil`.

## In Flight

None — no other worktrees, no draft plans/PRs pending.

## Recommended Next Step

A fresh `/ardd-verify` pass is overdue (stale since 2026-07-08) to confirm
the 4 current `DEFECTS.md` entries are resolved and regenerate the file,
and to refresh the two stale diagrams (`infrastructure.md`/`ui.md`) via
`/ardd-render`. Separately, three open bug/UX feedback items are ready to
be picked up by the next `/ardd-plan`:
`feedback-cmd-c-copy-broken-7a77.md` (trivial one-line fix, but breaks a
basic OS-level expectation everywhere in the app — worth prioritizing
alongside or ahead of the investigation-mode bug),
`feedback-investigation-mode-tool-refusal-4e7d.md` (defeats the point of
choosing a clone/local-path investigation mode), and
`feedback-overview-resume-review-41d6.md` (lower-priority UX polish).
