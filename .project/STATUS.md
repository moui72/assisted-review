# assisted-review — Project Status

_Updated: 2026-07-10 (`tasks-ai-prompt-fixes-17b2.md` completed — all 8
tasks across 3 phases: tool-refusal fix, Ask-Claude conversation context,
and markdown rendering for chunk-panel follow-up notes. Plan had no bound
features, so no backlog flips. Work is on branch `ai-prompt-fixes`, not yet
pushed — `workflow_mode: collaborative` means it needs a pushed branch/PR
to merge.) Keep this current as artifacts are refined and open questions
are resolved._

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

None found this pass.

## Constitution Compliance

No violations.

## Diagrams

- datamodel.md — current ✅
- infrastructure.md — stale ⚠️ (run `/ardd-render infrastructure`)
- ui.md — stale ⚠️ (run `/ardd-render ui`)

## Code-vs-Artifact Defects

`.project/DEFECTS.md` still lists entries but is stale — last checked
2026-07-08. Run `/ardd-verify` to confirm and regenerate the file fresh.

## Feedback

3 open feedback file(s) — see `.project/feedback/`:
- `feedback-cmd-c-copy-broken-7a77.md` (open — bug: Cmd+C doesn't copy
  anywhere in the app outside a focused textarea/input, because the global
  keydown handler's `c` branch in `App.tsx:358-360` isn't guarded by the
  `mod` flag the way `ArrowRight`/`ArrowLeft` already are, so Cmd+C matches
  the bare-`c` "focus comment box" shortcut, calls `preventDefault()`, and
  steals focus).
- `feedback-overview-resume-review-41d6.md` (open — Overview page's
  footer button always reads "Begin review →" even after chunks have
  already been viewed; should read "Resume review" once `state.viewed` is
  non-empty).
- `feedback-readme-rewrite-move-mermaid-di-6e04.md` (open — README needs a
  rewrite for npm publication (F001); Mermaid diagrams currently in
  README.md don't render on npmjs.com and should move elsewhere (F002); a
  Reconsidered item (F003) notes `/ardd-render`'s hardcoded README-only
  target can't support F002 and has already been filed upstream as
  `moui72/artifact-driven-dev#2` — not resolvable in this repo alone).

`feedback-ai-note-followup-rendering-3deb.md`,
`feedback-ask-ai-conversation-context-6109.md`, and
`feedback-investigation-mode-tool-refusal-4e7d.md` were fully addressed by
`tasks-ai-prompt-fixes-17b2.md`, now `status: completed`.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`. Newest: `linkify-pr-header-and-diff-fil` (make the
PR title link out to the PR on GitHub, and each diff chunk's file name
link to that file in the PR's GitHub diff view). Target with
`/ardd-plan linkify-pr-header-and-diff-fil`.

## In Flight

- Branch `ai-prompt-fixes` — `tasks-ai-prompt-fixes-17b2.md` is
  `status: completed` (8/8), bound to `plan-ai-prompt-fixes-2026-07-10.md`
  (`status: approved`, `features: []`). Not yet pushed — `workflow_mode:
  collaborative` means this needs to reach `origin/main` (push + PR) to
  land.

## Recommended Next Step

Push branch `ai-prompt-fixes` and open a draft PR for
`tasks-ai-prompt-fixes-17b2.md`'s completed work (tool-refusal fix,
Ask-Claude conversation context, markdown-rendered chunk-panel notes).
Separately, a fresh `/ardd-verify` pass is overdue (stale since
2026-07-08), and three small open feedback items (Cmd+C copy, Overview
resume-review label, README/Mermaid rewrite) are ready for a future
`/ardd-plan`.
