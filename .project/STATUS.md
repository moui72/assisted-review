# assisted-review — Project Status

_Updated: 2026-07-10 (verify + refine — `last_used` broken-contract fixed in #80; the 4 remaining doc-drift findings resolved on branch `docs/ardd-refine-verify-drift`; DEFECTS.md now all-clear). Keep this current as artifacts are refined and open questions are resolved._

ARDD source checkout not found at its recorded path — run `/ardd-update` to
re-record it.

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | — |
| datamodel.md | stable ✅ | — |
| infrastructure.md | stable ✅ | — |
| api.md | stable ✅ | — |
| ui.md | stable ✅ | — |
| features.md | register (per-feature files, no status field on index) | — |

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

None — `DEFECTS.md` all-clear, last checked 2026-07-10. The 4 doc-drift
findings from this pass (the #79 prompt behaviors + always-clone refresh
wording in `infrastructure.md`, and the `progress` field in
`api.md`/`datamodel.md`) were fixed on `docs/ardd-refine-verify-drift`; the
two prior `last_used` broken-contracts remain resolved via #80.

## Feedback

3 open feedback file(s) — see `.project/feedback/`, will be picked up by the
next `/ardd-plan`:
- `feedback-cmd-c-copy-broken-7a77.md`
- `feedback-overview-resume-review-41d6.md`
- `feedback-readme-rewrite-move-mermaid-di-6e04.md`

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 6 implemented — see
`.project/features/`. Target a backlogged slug with `/ardd-plan <slug>`.

## In Flight

Two sibling worktrees exist but neither has an active tasks file, and there
are no open draft PRs (collaborative mode) — nothing unmerged in flight:
- `.claude/worktrees/ardd-codify-trial` (branch `ardd-codify-trial`) — clean.
- `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — clean, stale/unrelated.

## Recommended Next Step

Push `docs/ardd-refine-verify-drift` and open a PR — it carries the four
artifact fixes plus the refreshed DEFECTS.md/STATUS.md. After it merges,
re-render the two stale diagrams (`/ardd-render infrastructure`,
`/ardd-render ui`) and run `/ardd-update` to re-record the moved ARDD source
path. New feature work: `/ardd-plan <slug>` against a backlogged feature, or
`/ardd-plan` to consume the 3 open feedback items (Cmd+C copy, Overview
resume-review label, README/Mermaid rewrite).
