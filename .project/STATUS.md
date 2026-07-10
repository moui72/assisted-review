# assisted-review — Project Status

_Updated: 2026-07-10 (drafted `plan-ai-prompt-fixes-2026-07-10.md` on branch
`ai-prompt-fixes`, covering three AI/prompt-path feedback items:
investigation-mode tool refusal, missing Ask-Claude conversation context,
and unformatted markdown in chunk-panel follow-up notes. Those three
feedback files flipped `open` → `planned`. A new, unrelated
README/Mermaid-diagrams feedback file also arrived this pass — not part of
this plan). Keep this current as artifacts are refined and open questions
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

`.project/DEFECTS.md` still lists 4 entries but is stale — last checked
2026-07-08. Run `/ardd-verify` to confirm and regenerate the file fresh.

## Feedback

6 feedback file(s) — see `.project/feedback/`:
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
`feedback-ask-ai-conversation-context-6109.md`,
`feedback-investigation-mode-tool-refusal-4e7d.md`,
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

- Branch `ai-prompt-fixes` — `plan-ai-prompt-fixes-2026-07-10.md`
  (`status: draft`), not yet pushed. Run `/ardd-tasks` to approve the plan
  and generate its task list.

## Recommended Next Step

Run `/ardd-tasks` to select `plan-ai-prompt-fixes-2026-07-10.md`, approve
it, and generate its task breakdown (tool-refusal fix, conversation
context, and markdown rendering for chunk-panel notes). Separately, a
fresh `/ardd-verify` pass is overdue (stale since 2026-07-08), and two
small open UI feedback items (`feedback-cmd-c-copy-broken-7a77.md`,
`feedback-overview-resume-review-41d6.md`) plus the new README/Mermaid
feedback are ready to be picked up by a future `/ardd-plan`.
