<!--
SYNC IMPACT REPORT
==================
Version change: 3.1.1 → 3.2.0
Modified sections:
- Development Workflow — added a rule that Production Annotations stay as
  inline prose by default and are only promoted to a `features.md` backlog
  entry when an `/ardd-critique` pass specifically flags one as worth acting
  on now — codifying the pattern already followed by `os-aware-keyboard-hints`,
  `displaced-comment-reanchoring`, and `resilient-gitlab-submit`, rather than
  leaving the promotion decision as an unstated convention. Resolves the
  `/ardd-critique` finding (`critique.md`) about inconsistent annotation-to-
  backlog treatment. MINOR change (new workflow requirement, no principle
  redefinition).

--- Prior report (3.1.0 → 3.1.1) ---
Modified sections:
- Principle III — corrected a factual error: the backend was described as
  "CommonJS with extensionless imports"; it is actually ESM
  (`package.json`'s `"type": "module"`, `tsconfig.json`'s `NodeNext`
  resolution), which is what *requires* the explicit `.js` extensions on
  relative imports every backend file already uses — the opposite of what
  was claimed. Found via `/ardd-verify` (see `DEFECTS.md`). PATCH change
  (factual correction, not a redefinition — the underlying intent, "don't
  mix import-extension conventions between the two halves," is unchanged).
  `CLAUDE.md` carried the identical error and was corrected alongside this.

--- Prior report (3.0.0 → 3.1.0) ---
Modified sections:
- Development Workflow — added a requirement that production
  shortcuts/gaps be documented under a `## Production Annotations` heading
  in whichever artifact they belong to, rather than inline prose, so
  `/ardd-plan`'s Production Annotation Summary step and `/ardd-critique` have
  one consistent place to find them. `adapters.md` and `ui.md` converted
  their existing inline "Confirmed gap" notes to match `infrastructure.md`'s
  existing section. MINOR change (new workflow requirement, no principle
  redefinition).

--- Prior report (2.0.0 → 3.0.0) ---
Modified sections:
- Project Scope & Intent — removed the "future direction" framing around
  hosted/multi-user deployment; that concern now lives in CLAUDE.md as a
  standing code-writing guideline rather than constitutional scope language,
  since it's about how to write new code today, not a governed decision this
  document needs to version.
- Principle I — redefined back from a "current-state, not a permanent
  boundary" description to a hard, testable constraint: the server binds to
  127.0.0.1 only, no auth layer exists, no off-machine exposure. A principle
  that permits its own violation pending an unscheduled future redesign
  wasn't actually constraining anything. This is a MAJOR change (principle
  redefinition) per the versioning rule below.
Principles II–V unchanged.

--- Prior report (1.0.0 → 2.0.0) ---
- Project Scope & Intent — resolved OPEN question: hosted/multi-user
  deployment is planned, not a permanent local-only constraint.
- Principle I — redefined from a hard governing constraint ("Local-Only, No
  Off-Machine Exposure") to a description of current-state architecture that
  a future design pass will revisit for hosted/multi-user deployment. This is
  a MAJOR change per the versioning rule below (principle redefinition).
- Development Workflow — resolved OPEN question: ARDD now governs how work
  proceeds, supplementing ROADMAP.md.
- Governance — Ratified date set to 2026-06-30 (previously open).
Principles II–V remain as originally inferred by /ardd-codify; confirmed
during this refine pass along with the rest of the document.
-->

---
name: constitution
status: stable
last_updated: 2026-07-02
---

# assisted-review Constitution

## Project Scope & Intent

A standalone CLI that serves a localhost browser UI for walking a GitHub PR
(or GitLab MR) hunk-by-hunk. It fetches the diff and metadata via `gh`/`glab`,
groups hunks into reviewable chunks, optionally pulls Jira context, streams
AI commentary from a headless `claude` subprocess, persists reviewer state
(comments, flags, viewed, AI notes) to disk, and publishes drafted comments
back to GitHub/GitLab as a single review on submit. The human reviewer stays
in control — Claude assists, it does not decide or auto-post anything.

The current implementation targets a single local reviewer running the CLI
on their own machine. This is today's real architecture, not a placeholder —
see `CLAUDE.md` for the standing guideline on writing new code in a way that
doesn't needlessly foreclose a possible future hosted/multi-user direction.

## Core Principles

### I. Local-Only, No Off-Machine Exposure

The HTTP server binds to `127.0.0.1` only (`src/server.ts`); this is called
out explicitly in `CLAUDE.md` ("never expose off-machine"). No data leaves
the machine except the comments the reviewer explicitly chooses to submit
via `gh api` / `glab api`. There is no auth layer, no rate limiting, and no
network-facing API surface beyond what `gh`/`glab`/Jira/Claude subprocess
calls require.

*Rationale*: a single local reviewer on their own machine, authenticated via
tools they've already configured (`gh auth`, `glab auth`), needs no
additional auth layer of its own — adding one would be complexity without a
corresponding threat model. This holds as long as the tool runs this way; it
is not a statement about what the tool could become. A future hosted/
multi-user direction is possible but not planned work, and would require
amending this principle (see Governance) rather than treating it as already
half-adopted. See `CLAUDE.md` for the separate, non-governing guideline about
writing new code that doesn't gratuitously foreclose that possibility.

### II. State Mutation Is a Pure Reducer Over Persisted JSON

`applyAction(state, action)` in `src/state.ts` takes state and an action and
returns new state without mutating its input. Persistence (`saveState`) is a
separate concern: write to a `.tmp` file, then atomically `rename()` onto the
target. State files live under `~/.assisted-review/` (or
`ASSISTED_REVIEW_STATE_DIR`), one JSON file per PR/MR.

*Rationale*: review state (drafted comments, flags, viewed markers, AI notes)
is precious and must survive crashes/restarts; a torn write would corrupt a
reviewer's in-progress work. The pure-reducer shape also makes every mutation
independently testable (see `tests/state.test.ts`).

### III. Strict TypeScript, No `any`, Explicit Module Conventions

`tsconfig.json` / `web/tsconfig.json` run with `strict: true`. Backend code
(`src/`) is ESM — `package.json` sets `"type": "module"`, and
`tsconfig.json` sets `module`/`moduleResolution: "NodeNext"` — which
requires explicit `.js` extensions on relative imports (e.g.
`from './types.js'`) even though the source files are `.ts`; NodeNext
resolution needs the extension to match the compiled output, so this is a
requirement of the toolchain, not a style choice. Frontend code
(`web/src/`) instead requires explicit `.ts`/`.tsx` extensions on imports
(required by the Vite/tsconfig setup). Node built-ins are imported with the
`node:` prefix throughout (`node:fs/promises`, `node:http`, etc.).

*Rationale*: the two halves of the codebase both need explicit import
extensions, but different ones — backend imports point at the compiled
`.js` output NodeNext resolution expects, frontend imports point at the
actual `.ts`/`.tsx` source files Vite resolves directly. Mixing these
conventions between the two halves causes real build breakage, not just
style inconsistency.

### IV. External Tools Are Subprocesses, Not Vendored SDKs

`gh`, `glab`, `claude`, and optionally `op` (1Password CLI) are invoked as
child processes (`node:child_process` `execFile`/`spawn`), never as imported
API client libraries. `src/gitlab-rest.ts` centralizes a single glab-CLI +
REST-fallback transport used by both `fetch.ts` and `submit.ts`, rather than
each call site reimplementing the choice. Missing binaries surface as clear,
actionable errors (see `src/claude.ts`'s `ENOENT` handling and `cli.ts`'s
auth hints).

*Rationale*: this keeps the tool thin and delegates auth/session handling to
tools the user already has configured (`gh auth status`, `glab auth status`),
at the cost of a hard runtime dependency on those CLIs being on `PATH`.

### V. Every Adapter Degrades to a Clear "Unavailable" State, Never a Crash

Jira (`src/jira.ts`) returns `{ available: false, reason, setup_hint }`
rather than throwing when credentials are missing or a fetch fails; the UI
renders a setup banner instead of erroring. The Claude bridge similarly
surfaces `onError` with an actionable message instead of letting the SSE
stream hang. GitLab's `glab`-vs-REST fallback (`gitlab-rest.ts`) is invisible
to callers — both paths return the same shape.

*Rationale*: Jira and AI commentary are optional enrichments to the core
review workflow (viewing a diff and drafting comments), not blocking
dependencies. A misconfigured Jira token should never prevent someone from
reviewing a PR.

## Quality Standards

- Backend (`src/**/*.ts`) statement and line coverage must stay above **90%**
  (per-glob threshold in `vitest.config.ts`), excluding `cli.ts`,
  `setup-jira.ts`, and `env.ts` (untestable entry points / interactive).
  Enforced in CI (`.github/workflows/ci.yml`), not just locally.
- Frontend (`web/src/`) coverage is measured but not gated — explicitly
  called out in `CLAUDE.md` as "a work in progress."
- External CLIs (`gh`, `op`, `claude`) and `node:child_process` are mocked in
  tests via module mocks; HTTP calls are mocked via `vi.spyOn(globalThis,
  'fetch')` — no tests hit real network/subprocess dependencies.
- `dangerouslySetInnerHTML` is permitted only for sanitized `hljs` output or
  strings processed by `escapeHtml`; never raw user or API content
  (`CLAUDE.md`).
- CI (`ci.yml`) runs lint, build, unit tests with coverage, and a Playwright
  e2e smoke test on every PR. Releases (`publish.yml`) run via
  `semantic-release` on push to `main`, driven by conventional commits.

## Development Workflow

ARDD (`/ardd-refine`, `/ardd-analyze`, `/ardd-plan`, `/ardd-tasks`,
`/ardd-implement`, `/ardd-critique`, `/ardd-feature`, etc.) governs how new
work proceeds on this project, supplementing the existing
conventions-driven mechanics (conventional commits → `semantic-release`,
PR-gated CI, husky pre-commit hook), which remain the release/CI plumbing.
Concretely:

- New features or scope changes are proposed against the artifacts first
  (`/ardd-feature`, `/ardd-refine <artifact>`), not directly as code.
- `/ardd-analyze` is run after artifact changes to catch cross-artifact
  drift before planning.
- `/ardd-plan` and `/ardd-tasks` generate the implementation plan and task
  list from stable artifacts; `/ardd-implement` executes them.
- `ROADMAP.md` continues to track higher-level milestone sequencing; it is
  not replaced, but artifact refinement is now the mechanism by which
  ROADMAP items get scoped into concrete, implementable decisions.
- Any artifact documenting a known production shortcut or gap (a deliberate
  simplification, an unintentional gap awaiting future work, etc.) does so
  under a `## Production Annotations` heading — not inline prose elsewhere in
  the artifact — so `/ardd-plan`'s Production Annotation Summary and
  `/ardd-critique` can rely on a single, consistent place to find them.
- A Production Annotation stays as inline prose by default — it does not need
  its own `features.md` backlog entry just for being written down. It is only
  promoted to a backlog entry (cross-referencing back to the annotation) when
  an `/ardd-critique` pass specifically flags it as worth acting on now,
  rather than left as an accepted, indefinitely-deferred limitation. This is
  the pattern `os-aware-keyboard-hints`, `displaced-comment-reanchoring`, and
  `resilient-gitlab-submit` already followed; this bullet makes it a rule
  rather than an implicit convention.

## Governance

This constitution supersedes all other practices documented in the
repository once confirmed. Amendments require:

1. A written rationale explaining why the current principle is insufficient.
2. An updated Sync Impact Report (prepended as an HTML comment).
3. Version increment per semantic versioning: MAJOR for principle removal or
   redefinition; MINOR for new principle or material expansion; PATCH for
   clarifications or wording fixes.
4. `last_updated` date updated in frontmatter.

**Version**: 3.2.0 | **Ratified**: 2026-06-30 | **Last Amended**: 2026-07-02
