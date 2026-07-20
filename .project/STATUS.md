# assisted-review — Project Status

_Updated: 2026-07-20 (ArDD toolchain v0.10.0 → v1.0.2; cross-artifact pass surfaced 8 issues, `/ardd-refine datamodel` closed 4; CodeRabbit review of PR #105 produced fixes and one new feedback item). Keep this current as artifacts are refined and open questions are resolved._

_Note: the Feedback section below is a delta update from `/ardd-feedback`, not
a fresh full pass. The last full `/ardd-status` ran earlier on 2026-07-20; the
only artifact change since is datamodel.md's corrected `head_sha` production
annotation. Re-run `/ardd-status` for a clean regeneration._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | 1 (see below) |
| datamodel.md | stable ✅ (refined 2026-07-20) | — |
| infrastructure.md | stable ✅ | 2 (see below) |
| api.md | stable ✅ | 2 (see below) |
| ui.md | stable ✅ | — |
| features.md | register (per-feature files, no status field on index) | — |

No `[OPEN: ...]` markers in any artifact; the counts above are issues found
by the 2026-07-20 consistency pass, not authored placeholders.

## Cross-Artifact Issues

- **[CONFLICT] Unamended GitLab-credential exception** — api.md:250-261
  self-declares a "deliberate exception" where the server manages a GitLab PAT
  (`STATE_DIR/gitlab-token`, infrastructure.md:80-98). That cuts against
  constitution.md Principle I (:98-103) and Principle IV's rationale (:158,
  "delegates auth/session handling to tools the user already has configured").
  Principle IV's *normative* clause (subprocesses, not SDKs) is intact — the
  gap is that Governance (:229-236) requires an amendment and none happened.
  api.md is dated 2026-07-13; the constitution is still 2026-07-02.
- **[CONFLICT] `app_version` optionality** — api.md:29-30 types it required in
  `StartOptions`; ui.md:200 renders the About row "only when present", and the
  code agrees (`web/src/api.ts:111` `app_version?: string`,
  `src/server.ts:151` defaults to `''`). api.md should mark it optional.
- **[GAP, minor] Named-but-undefined types** — `StartOptions` (api.md:30),
  `PreloadConfig` (ui.md:202), `Anchor { side, line }` (ui.md:120),
  `GitLabSubmitProgress` (api.md:94) are named but defined only inline or not
  at all.

## Within-Artifact Issues

### infrastructure.md
- **[VAGUE]** :282 defers the `always-clone` 30-day TTL's configurability to
  "Open Questions" — no such section exists in any artifact. Dangling pointer
  over a genuinely undecided knob.
- **[VAGUE]** :250-251 — `'api'` mode clips each file "the same way the diff
  itself is (`MAX_DIFF_CHARS`-style cap per file)" with no *total* prompt
  budget stated, despite fetching every file the diff touches.

## Constitution Compliance

No outstanding annotation gaps — datamodel.md gained its `## Production
Annotations` section on 2026-07-20, so all four artifacts now comply with
constitution.md:212-216. The unamended GitLab-credential exception is tracked
above as a cross-artifact conflict; it needs a governance decision (amend the
constitution, or narrow api.md's claim), not an artifact edit.

## Diagrams

- datamodel.md — **stale ⚠️** (`diagram_type: erDiagram`; the 2026-07-20
  refine added the `ReviewPayload` entity — run `/ardd-diagram datamodel`)
- infrastructure.md — current ✅ (`diagram_type: graph TD`)
- ui.md — **stale ⚠️** (run `/ardd-diagram ui`)

Rendered to `docs/ARCHITECTURE.md`.

## Code-vs-Artifact Defects

None — `DEFECTS.md` all-clear, last checked 2026-07-11. Refresh with
`/ardd-defects`.

## Feedback

1 open feedback file — `feedback-head-sha-drafted-vs-fetched-co-a9d9.md`
(F001: `head_sha` conflates drafted-against and latest-fetched SHAs, leaving
the pre-submit stale guard largely inert). Will be picked up by the next
`/ardd-plan`.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 9 implemented — see `.project/features/`.
Target a backlogged slug with `/ardd-plan <slug>`.

Register-coverage note: the GitLab browser-token auth capability has no entry
in `.project/features/` at all, though it is fully implemented
(`src/gitlab-token.ts`). Not a "documented but untracked" finding (that test
requires no code either), but the register under-describes shipped work.

## Documented but Untracked

None. Every capability described in the stable artifacts has an implementation
— verified against `src/` and `web/src/`.

## ArDD Toolchain

Installed **v1.0.2** (`33ac9ae`, source `~/.ardd/source`, channel `stable`) —
up to date, updated from v0.10.0 (`a7165c4`) on 2026-07-20. No migrations
pending. The `ours` merge driver is enabled in this clone
(`git config merge.ours.driver true`, set 2026-07-20), so `.project/`'s
generated reports auto-resolve on merge.

## In Flight

- Worktree `.claude/worktrees/ardd-codify-trial` (branch `ardd-codify-trial`)
  — `tasks=none`, unmerged.
- Worktree `.claude/worktrees/docs-update-readme-changelog` (branch
  `docs/update-readme-changelog`) — `tasks=none`, unmerged.

Neither is reapable (`worktree-reap.sh --dry-run` found no candidates). No
open draft PRs. Branch `gitlab-auth-precedence`
(`tasks-gitlab-auth-precedence-b659.md`, completed 7/7) is checked out here
and not yet pushed.

## Recommended Next Step

Push `gitlab-auth-precedence` and open a PR to land the auth-precedence fix on
`main` — collaborative mode, so nothing lands locally.

Then decide the api.md-vs-constitution credential exception: either amend the
constitution to sanction server-managed GitLab PATs, or narrow api.md's claim.
That is a deliberate governance call, not a drive-by edit.

Lower priority: `/ardd-refine api` to mark `app_version` optional and define
the four named-but-undefined types; `/ardd-diagram datamodel` and
`/ardd-diagram ui` to clear both stale diagrams.
