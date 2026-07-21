# assisted-review — Project Status

_Updated: 2026-07-21 (full `/ardd-status` pass after the ArDD toolchain update v1.0.2 → v1.0.3; `/ardd-refine datamodel` then closed 5 of the 20 issues). Keep this current as artifacts are refined and open questions are resolved._

## Artifact Status

| Artifact | Status | Open questions |
|---|---|---|
| constitution.md | stable ✅ (v3.2.0) | 3 (see below) |
| datamodel.md | stable ✅ (refined 2026-07-21) | 3 (see below) |
| infrastructure.md | stable ✅ | 3 (see below) |
| api.md | stable ✅ | 2 (see below) |
| ui.md | stable ✅ | 2 (see below) |

No `[OPEN: ...]` or `TODO` markers in any artifact; the counts above are issues
found by this consistency pass, not authored placeholders.

## Cross-Artifact Issues

- ~~**[CONFLICT] `temp-clone` clone location**~~ — **resolved 2026-07-21.**
  datamodel.md claimed the deterministic
  `STATE_DIR/repos/<platform>-<owner>-<repo>` path for *both* clone modes;
  `src/investigation.ts:66` uses `tmp-<uuid>` for `temp-clone`. `clone_path`'s
  row now states both schemes and why each exists.
- **[CONFLICT] Constitution names a `features.md` backlog file and stale slash
  commands** — the actual register is the per-feature directory
  `.project/features/*.md`, and the named commands (`/ardd-analyze`,
  `/ardd-tasks`, `/ardd-feature`, `/ardd-critique`, `/ardd-verify`) no longer
  exist; the installed set is `/ardd-status`, `/ardd-audit`, `/ardd-defects`,
  `/ardd-backlog`, `/ardd-plan`.
- **[CONFLICT] Unamended GitLab-credential exception** (carried forward) —
  api.md self-declares a "deliberate exception" where the server manages a
  GitLab PAT (`STATE_DIR/gitlab-token`). Principle IV's *normative* clause
  (subprocesses, not SDKs) is intact; the gap is that Governance requires an
  amendment and none happened.
- **[CONFLICT] Principle I's "no data leaves the machine" is now factually
  narrower than behavior** — `api` investigation mode fetches file contents,
  and the npm update check calls `registry.npmjs.org`. Neither is a comment the
  reviewer explicitly submits.
- **[CONFLICT] `app_version` optionality** (carried forward) — api.md types it
  required in `StartOptions`; ui.md renders the About row "only when present",
  and the code agrees (`web/src/api.ts` `app_version?: string`,
  `src/server.ts` defaults to `''`). api.md should mark it optional.
- **[GAP] Principle IV's subprocess enumeration is stale** — it lists `gh`,
  `glab`, `claude`, optionally `op`; infrastructure.md's clone modes add a hard
  `git` dependency (its own Production Annotation admits it).
- ~~**[GAP] `Anchor`, `PreloadConfig`, `GitLabSubmitProgress` undefined**~~ —
  **resolved 2026-07-21.** All three now have their own datamodel.md entity
  sections with field tables. The Overview's "one legitimate frontend-only
  projection" claim was corrected to name all three frontend-only shapes.
- ~~**[GAP] Client-persisted preferences unowned**~~ — **resolved 2026-07-21.**
  datamodel.md gained a `Client-Persisted Preferences` section covering
  `ar-palette`, `ar-theme`, `ar-preload-chunks`, `ar-preload-overview`, and
  why they live in `localStorage` rather than `ReviewState`.
- **[GAP] Stale-SHA "offers re-fetch"** — ui.md says so, but no artifact defines
  a re-fetch action or endpoint, and `SubmitModal.tsx` only renders
  instructional text. Either an undefined capability or ui.md overstating it.

## Within-Artifact Issues

### infrastructure.md
- **[GAP]** the `always-clone` 30-day TTL is "flagged as a tunable in **Open
  Questions**" — no such section exists. Dangling pointer.
- **[VAGUE]** the same TTL's configurability is deferred with no criterion for
  revisiting.
- **[VAGUE]** `'api'` mode clips each file `MAX_DIFF_CHARS`-style with no
  *total* prompt budget stated, despite fetching every file the diff touches.

### datamodel.md
- **[VAGUE]** `Overview.jira` — "leaves room for future overview-page
  enrichments" with no decision on what else; `Overview` is a one-field wrapper.
- **[VAGUE]** the drafted-SHA annotation describes the fix ("persisting the
  drafted SHA separately") but leaves whether/when undecided. Tracked as open
  feedback F001.
- **[VAGUE]** `ReviewPayload.payload` is echoed "for a future manual-submit
  fallback" — motivation stated, feature never specified anywhere.

### api.md
- **[VAGUE]** `POST /api/investigation-config` clones synchronously with no
  timeout, cancel, or progress contract beyond the UI's "Cloning…" label.
  Behavior on a multi-minute clone is undefined.

### ui.md
- **[VAGUE]** Displaced Comments — notes and flags are "read-only there
  (delete/unflag only)", but delete/unflag *is* a mutation, and the Overview
  view section and States section state it two different ways.

## Constitution Compliance

- **[ANNOTATION PLACEMENT]** infrastructure.md carries three shortcut/failure-
  mode annotations as inline prose rather than under its `## Production
  Annotations` heading: the `api`-mode "explicit scope limit", the parse-diff
  "two behaviors changed as a result", and — most clearly an unintentional
  failure mode — suggested-action parsing being "inherently best-effort and
  could silently fail to split if Claude's phrasing drifts". These are
  workflow-rule violations of the 3.1.0 amendment.
- No other violations. api.md's submit-race shortcut is correctly annotated;
  datamodel, api, and ui all use the required heading. The unamended
  GitLab-credential exception is tracked above as a cross-artifact conflict —
  it needs a governance decision, not an artifact edit.

## Diagrams

- datamodel.md — **stale ⚠️** (`erDiagram` — run `/ardd-diagram datamodel`)
- infrastructure.md — current ✅ (`graph TD`)
- ui.md — **stale ⚠️** (`graph TD` — run `/ardd-diagram ui`)

Rendered to `docs/ARCHITECTURE.md`.

## Code-vs-Artifact Defects

None — `DEFECTS.md` all-clear, last checked 2026-07-11. Refresh with
`/ardd-defects` (that survey predates several merged PRs).

## Feedback

1 open feedback file — `feedback-head-sha-drafted-vs-fetched-co-a9d9.md`
(F001: `head_sha` conflates drafted-against and latest-fetched SHAs, leaving
the pre-submit stale guard largely inert). Will be picked up by the next
`/ardd-plan`.

## Feature Backlog

13 backlogged · 0 planned · 0 tasked · 9 implemented — see `.project/features/`.
Target a backlogged slug with `/ardd-plan <slug>`.

Register-coverage note (unchanged): the GitLab browser-token auth capability
(`src/gitlab-token.ts`, PR #50) has no entry in `.project/features/` though it
is fully implemented. Not a "documented but untracked" finding — that test
requires no code either — but the register under-describes shipped work.

## Documented but Untracked

None. Every capability described in the stable artifacts is implemented and
verified against `src/` and `web/src/`. The two unimplemented items — the
manual-submit fallback and the in-place load-error retry — are both framed as
future work rather than described as existing behavior.

## Work Queue

No tasks file at `ready` — all 16 are `completed`. No orphaned completion
flips.

## ArDD Toolchain

Installed **v1.0.3** (`0fc43f6`, source `~/.ardd/source`, channel `stable`) —
up to date, updated from v1.0.2 (`33ac9ae`) on 2026-07-21. No new migrations
(all eight already applied). This run rewrote the recorded `Source-Path` to
the portable `~/` form and added `.project/README.md` (reviewer guide).

## In Flight

- Worktree `.claude/worktrees/ardd-codify-trial` (branch `ardd-codify-trial`)
  — `tasks=none`, unmerged, not reapable.

No open draft PRs. `gitlab-auth-precedence` has landed on `main` (#105).

## Recommended Next Step

`/ardd-refine api` — mark `app_version` optional (datamodel.md's new
`PreloadConfig` section now types it correctly, so api.md is the last place
that disagrees with the code); specify the synchronous clone's
timeout/cancel contract.

Then, in rough priority order:
- `/ardd-refine infrastructure` — move the three inline annotations under
  `## Production Annotations`; fix the dangling "Open Questions" pointer.
- `/ardd-diagram datamodel` and `/ardd-diagram ui` — clear both stale diagrams.
- `/ardd-defects` — the last code-vs-artifact survey is ten days and several
  merged PRs old.

Deliberate governance calls, not drive-by edits: the api.md-vs-constitution
credential exception, Principle I's "no data leaves the machine" wording versus
`api` mode and the npm update check, and the constitution's stale `features.md`
/ slash-command references. All three want a constitution amendment.
