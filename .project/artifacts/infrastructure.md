---
name: infrastructure
status: stable
last_updated: 2026-07-03
diagram_status: stale
---

# Infrastructure

## Overview

No database, no hosted backend. Storage is flat JSON files on the local
filesystem (`~/.assisted-review/`); "sync" is a manual, on-demand refetch of
a PR/MR's diff and metadata, not a scheduled job. The server
(`src/server.ts`) is a single Node `http` process bound to `127.0.0.1`,
started by the CLI (`src/cli.ts`) and serving both the API and the pre-built
React UI (`dist/`) from one process (or API-only, paired with Vite's dev
server, during development).

Every external integration is optional except `gh`/`glab` (required to fetch
a PR/MR at all): Jira enrichment degrades to a setup banner, AI commentary
requires the `claude` CLI but its absence only disables that one feature.

This artifact covers both the transport mechanics (auth, retries, pagination,
fallback selection) and the shape-mapping/normalization layer (how each
source's raw response becomes `PrMeta` / `RawHunk` / `JiraIssue` / a note)
for every external integration, side by side per source — merged from a
former separate `adapters.md` so the two halves of each source's story can't
drift out of sync with each other.

## Integration Components

### GitHub (`gh` CLI) — `src/fetch.ts`, `src/submit.ts`

- **Fetch**: `gh pr diff <n> --repo <owner>/<repo>` for the raw unified diff;
  `gh pr view <n> --repo ... --json <fields>` for metadata. Both run via
  `execFile`, 64MB/8MB `maxBuffer` respectively.
- **Auth**: delegated entirely to `gh auth status` — no token handling in
  this codebase for GitHub.
- **Submit**: a single POST to `repos/{owner}/{repo}/pulls/{n}/reviews` via
  `gh api ... --input -`, carrying the whole review (event, body, commit_id,
  inline comments) as one document. No pagination (a review is one call).
- **Staleness check**: before submitting inline comments, verifies the
  drafted-against `head_sha` is still `repos/.../pulls/{n}/commits` (a
  `gh api --paginate` call); also matches on GitHub's own
  `Path could not be resolved` error string as a fallback stale signal.
- **Shape mapping** (`fetchGitHubMeta`): raw `GhPrView` → `PrMeta`:

  | Raw (`GhPrView`) | → | `PrMeta` |
  |---|---|---|
  | `title` | | `title` |
  | `author?.login` | falls back to `'unknown'` | `author` |
  | `baseRefName` | | `base_ref` |
  | `headRefName` | | `head_ref` |
  | `isDraft` | | `is_draft` |
  | `url` | | `url` |
  | `headRefOid` | | `head_sha` |
  | `body` | falls back to `''` | `body` |

  Diff comes from a separate call (`gh pr diff`), raw unified diff text, fed
  straight into the shared `parse-diff.ts` (see below) — no GitHub-specific
  transformation needed on the diff itself.

### GitLab (`glab` CLI, REST fallback) — `src/gitlab-rest.ts`, `src/fetch.ts`, `src/submit.ts`

- **Transport selection**: `glabAvailable()` probes `glab --version` once per
  process (cached; `_setGlabAvailable()` overrides it in tests). If present,
  every GitLab call shells out to `glab api <path>` (or `glab mr diff` /
  `glab mr view --output json`). If absent, falls back to the GitLab REST API
  v4 directly via `fetch()`, authenticated with `GITLAB_TOKEN` and pointed at
  `GITLAB_HOST` (default `gitlab.com`; supports `http://` for self-hosted).
- **Pagination**: `glabApiPaginatedJson` — `glab api --paginate` on the CLI
  path, or manual `x-next-page` header following on the REST path. Same
  pattern reused for GitLab MR diffs (`fetchGitLabDiffREST`) and commit lists
  (`glabShaOnMr`).
- **Diff reconstruction (REST fallback only)**: GitLab's `/diffs` endpoint
  returns per-file hunk bodies without the `---`/`+++` markers `parse-diff.ts`
  expects; `fetchGitLabDiffREST` synthesizes them (`/dev/null` for
  added/deleted files) before handing off to the shared diff parser. This is
  the one place GitLab's raw shape actively diverges from what the shared
  parser expects, rather than just being differently transported.
- **Submit**: unlike GitHub's single-document review, GitLab has no
  equivalent — each inline comment is posted as its own "discussion"
  (`POST .../discussions` with a `position` object referencing the MR's
  latest diff version's base/start/head SHAs), then one summary note, then
  an optional approve call. Each of those three call kinds gets up to 3
  retries with linear 50ms/100ms/150ms backoff (300ms max added latency)
  before being counted as failed — but only for errors classified as
  retryable (see Error Classification below); a non-retryable error fails
  immediately. If any comment discussion still fails, the note and approve
  calls are withheld entirely — the whole request returns `ok: false` with
  `comment_errors` rather than partially continuing. Progress
  (`posted_comment_ids`/`note_posted`/`approved`) is persisted in
  `ReviewState.gitlab_submit_progress` (`datamodel.md`), so a later
  `POST /api/submit` retry skips whatever already succeeded instead of
  reposting duplicates; it's cleared once a submission fully succeeds,
  the same moment `submitted` is stamped.
- **Error classification**: `glabApiJson`'s two transports have asymmetric
  error information — the REST fallback (`restFetch`) gets a real HTTP
  status from `fetch()`'s `Response`; the `glab` CLI path only has an exit
  code and stderr text, with no status reliably parseable across glab
  versions. Both throw a `GitLabApiError extends Error { status?: number }`
  (`src/gitlab-rest.ts`) — REST always sets `status` from `res.status`; the
  CLI path leaves it `undefined`. `withRetry` treats `400`/`401`/`403`/
  `404`/`422` as non-retryable (a retry can't fix a bad request, missing
  auth, or a validation failure) and everything else — `429`, `5xx`, a
  network-level failure, or `status: undefined` — as retryable, since
  retrying only costs latency and none of those can be confidently ruled
  out as transient.
- **Staleness check**: same shape as GitHub — verifies `headSha` is still
  present in `.../merge_requests/{n}/commits` before posting.
- **Shape mapping** (`mapGlabMrView` — shared by both the CLI and REST
  paths, so responses normalize identically): raw `GlabMrView` → `PrMeta`:

  | Raw (`GlabMrView`) | → | `PrMeta` |
  |---|---|---|
  | `title` | | `title` |
  | `author?.username` | falls back to `'unknown'` | `author` |
  | `target_branch` | | `base_ref` |
  | `source_branch` | | `head_ref` |
  | `draft \|\| work_in_progress` | either flag true → draft | `is_draft` |
  | `web_url` | | `url` |
  | `sha` | | `head_sha` |
  | `description` | falls back to `''` | `body` |

  Diff, CLI path: `glab mr diff` returns a ready unified diff — same shape
  as GitHub's, fed directly to `parse-diff.ts`. Diff, REST path: see Diff
  reconstruction above.

### Unified diff → `RawHunk` / `Chunk` — `src/parse-diff.ts` (via `parse-diff` npm package)

Platform-agnostic; both GitHub and GitLab diffs (real or REST-reconstructed)
converge here.

Uses the `parse-diff` npm package to split `diff --git` / `---` / `+++` /
`@@ ... @@` sections into files/chunks (binary files, renames, and git
metadata lines fall out naturally — they never match a hunk header, so they
contribute no chunks). A thin adapter in `parse-diff.ts` maps the library's
`File`/`Chunk` shape onto this codebase's `RawHunk[]` (resolving `file` from
`to`, falling back to `from`, treating `/dev/null` as absent; extracting
`context` from the header line via a small regex, since the library doesn't
expose it separately; stripping any trailing `\r` for CRLF input).
`groupChunks()` then merges adjacent same-file hunks separated by a small
unchanged gap (default 20 lines) into `Chunk`s — this grouping step, not the
parsing step, is what defines "the reviewable unit" the rest of the app
operates on.

Previously a hand-rolled, line-oriented parser (a direct TS port of an
earlier Python `parse-diff.py`); replaced with the library to stop
reinventing unified-diff parsing. Two behaviors changed as a result, both
low-impact since real `gh`/`glab` diffs (and this codebase's own GitLab REST
reconstruction) never produce the malformed input that triggers them: a
non-standard line inside a hunk is now treated as a context line rather than
ending the hunk, and unrecognized lines outside a hunk are silently ignored
rather than logged as a warning (a still-unresolvable hunk — no file path at
all — is still warned about, since that's this codebase's own adapter logic,
not the library's).

### Jira REST API — `src/jira.ts`

- **Auth**: HTTP Basic (`user:token` base64), read from `JIRA_BASE_URL` /
  `JIRA_USER` / `JIRA_TOKEN` env vars (`JIRA_TOKEN` may itself be a reference
  — see Token Resolution below).
- **Fetch strategy**: one GET per issue key
  (`/rest/api/3/issue/{key}?fields=...`), up to 4 keys per PR
  (`keys.slice(0, 4)`) fetched in parallel via `Promise.all`; each request has
  its own 8s `AbortController` timeout. The whole Jira lookup is additionally
  wrapped in a 12s race-timeout at the call site (`src/review.ts`,
  `jiraWithTimeout`) so a slow/hanging Jira never blocks opening a PR.
- **Epic resolution**: after fetching linked issues, finds the first with an
  `epic_key` (from a configurable custom field, default `customfield_10008`,
  or `fields.parent.key`) and fetches that issue too.
- **Degradation**: missing/invalid credentials, a fetch failure, or zero
  successfully-fetched issues all resolve to `{ available: false, reason,
  setup_hint }` — never a thrown error that would block the overview page.
- **Shape mapping — ADF → plain text** (`adfToText()`): Jira descriptions are
  Atlassian Document Format (ADF, a nested JSON node tree), not plain text or
  markdown. `adfToText()` recursively flattens it: `text` nodes emit their
  string; `paragraph`/`listItem`/`blockquote`/`heading` emit their flattened
  children plus a trailing newline; `bulletList`/`orderedList` emit each
  child prefixed with `"  - "`; unknown node types just flatten children (no
  special handling). This is a lossy, display-oriented flattening — no
  attempt to preserve ADF formatting (bold, links, etc.) as markdown. Same
  function normalizes both the linked issue(s) and the epic — both go
  through `fetchIssue()` → `adfToText()` uniformly.

### Claude (headless `claude` CLI) — `src/claude.ts`

- **Invocation**: `claude -p --output-format stream-json
  --include-partial-messages --verbose --disallowed-tools Bash Edit Write
  Read Grep Glob WebFetch WebSearch Task NotebookEdit`, spawned with `cwd:
  tmpdir()` so it can't see this project's own files, and all built-in tools
  disabled so it answers only from the prompt text (the diff / combined
  diff), not by reading the filesystem or the web.
- **Streaming protocol**: reads newline-delimited JSON events from stdout.
  `stream_event` / `content_block_delta` / `text_delta` events feed
  `onDelta`; a terminal `result` event (with `is_error`) resolves via
  `onDone`/`onError`. Malformed lines are silently skipped. Only two event
  types matter — `content_block_delta`/`text_delta` (incremental text,
  forwarded via `onDelta` and SSE'd to the browser as-is) and the terminal
  `result` event (`is_error` + `result` string) — the adapter is deliberately
  narrow, not a general stream-json consumer.
- **Prompt construction**: two builders — `buildPrompt()` (per-chunk: explain
  or answer a follow-up question, diff clipped to the chunk) and
  `buildOverviewPrompt()` (whole-PR: title, description, Jira context if
  available, combined diff clipped to `MAX_DIFF_CHARS = 12000` chars).
  "Initial" per-chunk notes ask for a trailing `Suggested action: …` line,
  parsed back out by `splitSuggestedAction()` — a trailing line matching
  `/\n+\s*\*{0,2}\s*suggested\s+action\s*\*{0,2}\s*:\s*\*{0,2}\s*/i` (tolerant
  of markdown bold and a numbered-list prefix Claude sometimes adds), split
  into `{ body, suggestedAction }`. This is prompt-contract parsing, not a
  structured API response — inherently best-effort and could silently fail
  to split if Claude's phrasing drifts from the expected format.
- **Cancellation**: `streamClaude()` returns a kill function. The server
  tracks one in-flight stream at a time (`currentCancel` in `server.ts`) and
  cancels it whenever a new review is opened or the SSE connection closes —
  guards against a finishing stream writing a note into the wrong review's
  state after the user has switched PRs.
- **Mock mode** (`src/mock-ai.ts`, `--mock-ai` flag / `mockAi` option):
  attaches lorem-ipsum-style placeholder `StoredNote`-shaped notes (with
  fake `id`/`chunk_id`/`created_at`, see `datamodel.md`) directly onto
  chunks at load time, bypassing the subprocess entirely — for offline use
  and in the Playwright e2e suite.
- **Absence handling**: `child.on('error')` catches `ENOENT` and produces an
  actionable "is the `claude` CLI installed and on PATH?" message rather than
  an opaque spawn failure.

### 1Password CLI (`op`) — `src/resolve-token.ts` (optional, for `JIRA_TOKEN`)

Not a fetch integration in its own right — a secret-resolution indirection.
`JIRA_TOKEN` may be a raw value or a reference: `op://vault/item/field`
(shells out to `op read`), `env:VAR_NAME` (reads another env var), or
`cmd:<shell command>` (runs a shell command, "safe" because `.env` files are
expected to be `0600`). Anything not matching those prefixes is treated as a
raw token.

## Normalization Rules

- Every adapter that can fail (Jira, GitLab REST, Claude) resolves to a
  well-typed "unavailable"/error shape rather than throwing past its own
  boundary — enforced convention (`constitution.md` Principle V), not a
  shared abstraction; each integration implements its own degrade path.
- `PrMeta.author` and `.body` both have source-specific fallback defaults
  (`'unknown'`, `''`) applied at the mapping boundary so downstream code
  never has to null-check them.
- Jira description flattening and Claude suggested-action parsing are both
  intentionally lossy/best-effort text transforms — neither round-trips.

## Storage — Local State Files

- **Location**: `~/.assisted-review/` by default, overridable via
  `ASSISTED_REVIEW_STATE_DIR`.
- **Key scheme** (`statePath()` in `src/state.ts`):
  - GitHub: `{owner}-{repo}-{number}.json`
  - GitLab: `gitlab~{owner-with-/-replaced-by-%2F}~{repo}~{number}.json`
    (GitLab's `owner`/namespace may itself contain `/`, so it's URL-encoded
    before being used as a filename segment)
- **Write path**: `saveState()` always writes to `{path}.tmp` then
  `rename()`s onto the target — atomic replace, avoids torn writes if the
  process is killed mid-save. No file locking — single local user/process is
  assumed (explicit comment in `state.ts`).
- **Read path / resume**: `loadState()` reads and `migrate()`s the JSON,
  refreshes `head_sha` to the just-fetched value, and falls back to a fresh
  empty state on any read/parse error (missing file, corrupt JSON, etc.) —
  never throws on load.
- **Anchor reconciliation**: immediately after `migrate()`, `loadReview()`
  runs a reconciliation pass (see `datamodel.md`'s Normalization Rules) over
  `comments`/`notes`/`flagged` against the diff just re-fetched and
  re-parsed in the same call. Chunk data itself is never persisted — only
  `chunk_id` references are — so this is the only point where a
  now-mismatched anchor can be detected; it can't be checked lazily at
  render or submit time without re-fetching the diff. Runs on every reopen
  of a PR/MR, whether or not the diff actually changed (an unchanged diff
  reconciles as a no-op — every snapshot still matches).
- **Listing**: `listReviews()` (backing `GET /api/reviews`, the review-picker
  menu) does a full `readdir` + read + parse of every `*.json` file in the
  state dir on each call — no cached index.

## Configuration / Environment

Loaded once, first thing, by `src/env.ts` (imported before anything else
reads `process.env` in `cli.ts`), via `dotenv`, in this precedence order
(first file to set a key wins; real env vars always win over any file):

1. Real environment variables
2. `$DOTENV_CONFIG_PATH` (explicit override)
3. `./.env` (current directory — checkout/dev)
4. `~/.assisted-review/.env` (user-global default — matches the state dir
   root, lets a global npm install pick up credentials regardless of cwd)

Known variables: `JIRA_BASE_URL`, `JIRA_USER`, `JIRA_TOKEN`,
`JIRA_EPIC_FIELD`, `GITLAB_TOKEN`, `GITLAB_HOST`, `ASSISTED_REVIEW_STATE_DIR`,
`PR_REF` (default ref for `pnpm dev`), `PRELOAD_CHUNKS`, `PRELOAD_OVERVIEW`.
`assisted-review configure` (`src/setup-jira.ts`) runs an interactive wizard
to populate the Jira vars.

## Deploy / Distribution

- **Package**: published to npm as `assisted-review`, installed globally
  (`npm i -g assisted-review`); `bin` points at `build/cli.js`. `files` in
  `package.json` ships only `build/` and `dist/` (compiled backend + built
  UI), not `src/`/`web/src/`.
- **Build**: `tsc -p tsconfig.json` compiles `src/` → `build/`;
  `vite build web` bundles the UI → `dist/`. Both run on `prepack` (so `npm
  publish` always ships fresh artifacts) and in CI's `build` step.
- **Release**: `semantic-release` on push to `main`
  (`.github/workflows/publish.yml`), driven by conventional commit messages.
  Uses npm trusted publishing (OIDC, `id-token: write`) rather than a static
  npm token; a GitHub PAT (`GH_PAT`) is used only for the release commit push
  and GitHub Releases API, since branch protection blocks the default
  `GITHUB_TOKEN`.
- **CI**: `.github/workflows/ci.yml` runs on every PR — lint, build, unit
  tests with coverage (asserts the coverage JSON files exist, then reports
  via `davelosert/vitest-coverage-report-action`), and a separate Playwright
  e2e smoke-test job (installs Chromium, builds, runs `pnpm test:e2e`).

## Production Annotations

- **No auth, no rate limiting, no multi-user support** — required by
  `constitution.md` Principle I as today's design, not an oversight. A future
  hosted/multi-user direction is possible but not planned; it would need to
  address auth, per-user state isolation (today's single global
  `AppContext { review, state }` in `src/server.ts` assumes exactly one
  active review process-wide — see `api.md`), and network exposure as
  first-class concerns. `CLAUDE.md` carries the standing guideline to avoid
  new code that makes that transition harder than necessary, without
  building any of it now.
- **No locking on state files** — concurrent CLI processes against the same
  `ASSISTED_REVIEW_STATE_DIR` (or the same PR open twice) could race on
  `saveState()`. Comment in `state.ts` explicitly accepts this for the
  single-process-per-user case.
- **`listReviews()` is O(all state files) on every call** — fine at the
  scale of one person's saved reviews; would need an index if that stopped
  being true.
- **Jira token via `cmd:` reference executes an arbitrary shell command**
  read from `.env` — documented as safe "since .env is 0600", i.e. trusts the
  local file permission model rather than sandboxing the resolution.
- **GitLab REST fallback re-derives pagination/position math** that the
  `glab` CLI otherwise hides (diff version SHAs, `x-next-page` following) —
  more surface area for GitLab-specific bugs than the GitHub path, which has
  no REST fallback at all (GitHub always requires `gh`).
- **No adapter-level retry policy (partially addressed)** — no retry exists
  for fetch/Jira/Claude today; a transient failure there surfaces immediately
  as an error or unavailable state rather than being retried. The *absence of
  retry* is not intentional there — a single dropped network call currently
  has the same user-visible effect as a genuinely unreachable service.
  GitLab's submit path (`submitGitLabReview`, `src/submit.ts`) is the one
  exception: each individual discussion/note/approve POST gets up to 3
  retries with linear 50ms/100ms/150ms backoff (300ms max added latency)
  before being counted as failed — see the GitLab source's Submit entry
  below. Future work should extend the same pattern to the other three
  integrations' transport layer.
