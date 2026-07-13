# assisted-review — Project Status

_Updated: 2026-07-13 (implemented the GitLab auth-precedence fix from feedback F001 — shouldUseGlab(), 7/7 tasks — on branch `gitlab-auth-precedence`, not yet merged). Keep this current as artifacts are refined and open questions are resolved._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | — |
| datamodel.md | stable ✅ | — |
| infrastructure.md | stable ✅ (updated 2026-07-13: transport-selection precedence) | — |
| api.md | stable ✅ (updated 2026-07-13: Auth section precedence) | — |
| ui.md | stable ✅ | — |
| features.md | register (per-feature files, no status field on index) | — |

## Open Questions

None within any single artifact.

## Cross-Artifact Issues

None.

## Constitution Compliance

No violations. No new production shortcuts.

## Diagrams

- datamodel.md — current ✅ (`diagram_type: erDiagram`)
- infrastructure.md — current ✅ (`diagram_type: graph TD`; transport-selection
  prose change didn't touch diagram nodes/edges)
- ui.md — **stale ⚠️** (re-render to confirm: `/ardd-diagram ui`)

Rendered to `docs/ARCHITECTURE.md`.

## Code-vs-Artifact Defects

None — `DEFECTS.md` all-clear, last checked 2026-07-11. Refresh with
`/ardd-defects`.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 9 implemented — see `.project/features/`.

## ARDD Toolchain

Installed **v0.10.0** (`a7165c4`, source `~/.ardd/source`) — up to date.
No migrations pending.

## In Flight

- Branch `gitlab-auth-precedence` — `tasks-gitlab-auth-precedence-b659.md`
  `completed` (7/7). Plan `plan-gitlab-auth-precedence-2026-07-13-e7a6.md`
  approved, `features: []` (no register flip applicable). Not yet pushed —
  code + tests + artifact/README updates for `shouldUseGlab()` (browser
  token now outranks `glab` CLI in GitLab transport selection).
- Two clean sibling worktrees (`ardd-codify-trial`, `docs/update-readme-changelog`)
  — `tasks=none`.

## Recommended Next Step

Push `gitlab-auth-precedence` and open a PR to land the auth-precedence fix
on `main`. Optionally run `/ardd-diagram ui` to clear the stale UI-diagram
flag (unrelated, carried over from the docs-rewrite PR).
