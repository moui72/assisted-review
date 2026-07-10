---
name: api
status: stable
last_updated: 2026-07-10
---

# API

## Overview

REST + one SSE endpoint, served by a single Node `http` server
(`src/server.ts`) bound to `127.0.0.1:4319` (default; `--port` overrides).
No auth — protected only by binding to loopback (`constitution.md` Principle
I). All responses are JSON except `/api/claude` (SSE) and the static UI. The
API surface is small and mirrors the `Action` union in `datamodel.md` almost
exactly — most mutation goes through one generic endpoint
(`POST /api/action`) rather than one route per operation.

There is exactly one "active review" at a time, held in server memory
(`AppContext { review, state }`) — not per-request/per-session. Opening a
different PR/MR replaces it; there is no concept of multiple simultaneously
open reviews server-side (only multiple *saved* ones, listed via
`/api/reviews`).

## Endpoints

### `GET /api/config`

Returns preload behavior config: `{ preload_chunks: number, preload_overview:
boolean, app_version: string }`, sourced from `StartOptions` (in turn from
`PRELOAD_CHUNKS` / `PRELOAD_OVERVIEW` env vars, and — for `app_version` —
the running package's resolved version, the same value `src/cli.ts` prints
at startup; see `infrastructure.md`'s npm Registry section for how it's
distinguished from the update-check notice). Used by the frontend to decide
how aggressively to prefetch AI commentary, and to display the running
version (`ui.md` — Settings panel).

### `GET /api/review`

Returns the active `Review` (`datamodel.md`), or `204 No Content` if none is
open. No shape change for Anchor Reconciliation — it's a `ReviewState`
concern (see `GET /api/state`), not part of `Review` itself.

### `DELETE /api/review`

Clears the active review: cancels any in-flight Claude SSE stream, deletes
the review's state file on disk (best-effort — errors swallowed), and nulls
out `ctx.review`/`ctx.state`. Returns `{ ok: true }`.

### `GET /api/state`

Returns the active `ReviewState`, or `204` if none. `comments`/`notes`/
`flagged` entries may carry `displaced: true` (set by the Anchor
Reconciliation pass that already ran during the `loadReview()` call behind
`GET /api/review` / `POST /api/reviews/open` — reconciliation happens once,
at load time, not on every `GET /api/state` poll).

### `POST /api/action`

Body: an `Action` (see `datamodel.md`). Requires an active review/state
(`503` otherwise). Applies `applyAction(state, action)`, persists via
`saveState()`, returns the new `ReviewState`. This is the single mutation
endpoint for comments/flags/viewed — the frontend never manipulates state
directly, always round-trips through here so the server remains the source
of truth for what's persisted.

`add_comment`/`toggle_flag`/`add_note` carry `file`/`hunk_header` snapshot
fields (see `datamodel.md`'s Anchor Reconciliation) resolved by the frontend
from the chunk it's currently viewing — `applyAction` itself has no access
to `Chunk` data and stays a pure `(state, action) → state` reducer.
`reanchor_comment` (id, chunk_id, side, line, file, hunk_header) is the only
re-anchor action: only comments get a re-anchor UI/action (notes and flags
can only be shown as displaced or deleted/unflagged — see `ui.md`).

The read-`ctx.state` → `applyAction` → write-`ctx.state` → `saveState()`
sequence runs inside `withStateLock` (`src/mutex.ts`), a small in-process
FIFO mutex — see Production Annotations below for why.

### `POST /api/submit`

Body: `{ verdict: string, body?: string }`. Requires an active review/state
(`503`); rejects an already-submitted review (`410`); validates `verdict`
against `VERDICTS` (GitHub) or `GITLAB_VERDICTS` (GitLab), keyed off
`review.pr.platform` (`400` on invalid verdict).

Dispatches to `submitReview()` (GitHub) or `submitGitLabReview()` (GitLab) —
see `infrastructure.md` for what each does. On success, stamps
`state.submitted = { at, verdict, url }` and persists it. Response status:
`200` on success, `409` if the head SHA went stale, `502` on any other
failure. Response body is the submit adapter's `SubmitResult` (`datamodel.md`),
transformed by this route handler before it reaches the client: `payload` is
stripped (server-side-only, per `datamodel.md`'s note — never serialized to
the client) and a `state: ReviewState` field is added. The frontend's
`SubmitResponse` (`web/src/api.ts`) is `Omit<SubmitResult, 'payload'> &
{ state: ReviewState }` — sharing `SubmitResult` via `import type` rather than
a parallel hand-declared interface, per `datamodel.md`'s
single-canonical-source-of-truth principle.

GitLab-specific resilience: `submitGitLabReview()` withholds the summary-note
and approve calls entirely if any inline comment discussion fails to post
(after its own retry — see `infrastructure.md`) — the whole request comes
back `ok: false` with `comment_errors` rather than partially continuing.
`state.submitted` is only stamped once the *entire* submission succeeds.
Whatever already succeeded (which comments posted, whether the note/approve
landed) is persisted in `state.gitlab_submit_progress` (`datamodel.md`)
alongside the rest of `ReviewState` on every attempt, success or failure — a
subsequent `POST /api/submit` for the same review reuses it to skip
already-completed steps rather than reposting duplicates. Not applicable to
GitHub: its single-POST review has no partial-failure case to track.

### `GET /api/reviews`

Returns `ReviewSummary[]` (`datamodel.md`) — every saved review found by
scanning the state directory, sorted by `started_at` descending. Backs the
review-picker menu; does not touch the active review.

### `DELETE /api/reviews/:platform/:encodedOwner/:repo/:number`

Path params reconstruct a `PrRef` (`owner` is `decodeURIComponent`'d since
GitLab namespaces can contain `/`). Deletes that review's state file
(regardless of whether it's the active one). `200 { ok: true }` on success,
`404` if the file didn't exist / delete failed.

### `POST /api/reviews/open`

Body: `{ ref: string }` — a PR/MR reference in any format `parseRef()`
accepts (`owner/repo#N`, `namespace/repo!N`, or a GitHub/GitLab URL; see
`datamodel.md`'s `PrRef`). `400` if `ref` is missing/invalid JSON or
unparseable. Cancels any in-flight Claude stream (same reasoning as
`DELETE /api/review` — never let a stale stream write into the new review's
state), then fetches + loads the review via `loadReview()`
(`infrastructure.md`), replaces `ctx.review`/`ctx.state`, persists the
(possibly freshly-migrated) state, and returns `{ review, state }`. `502` on
fetch failure (bad ref resolves, but `gh`/`glab` fails — e.g. not found, not
authenticated). `401 { error, auth_required: 'gitlab' }` specifically when
`loadReview()` throws `GitLabAuthError` — no GitLab token available via
either the browser-entered store or `GITLAB_TOKEN` (see `GET`/`POST`/`DELETE
/api/auth/gitlab` and the Auth section below). The frontend's `Splash.tsx`
handles this by opening `GitLabAuthModal` (`ui.md`) and retrying the same
`ref` on successful token save; `ReviewsMenu.tsx`'s in-app "Open a review"
form does the same.

### `GET /api/auth/gitlab`

Returns `{ authenticated: boolean, source: 'browser' | 'env' | null }` —
whether a GitLab token is currently available and where it came from
(`gitLabTokenSource()`, `infrastructure.md`). No active review required.

### `POST /api/auth/gitlab`

Body: `{ token: string }`. `400` if `token` is missing/blank. Persists the
token via `setGitLabToken()` (`infrastructure.md`) — in-memory immediately,
and to disk so it survives a server restart. Returns `{ ok: true }`. This is
what `GitLabAuthModal` (`ui.md`) calls on save.

### `DELETE /api/auth/gitlab`

Clears the browser-stored token (`clearGitLabToken()`, `infrastructure.md`)
from memory and disk. Falls back to `GITLAB_TOKEN` (if set) on the next
GitLab call, same as if a browser token had never been stored. Returns
`{ ok: true }`.

### `GET /api/investigation-config`

Returns the `InvestigationConfig` (`datamodel.md`) for the active review's
repo — `{ mode: 'none', platform, owner, repo }` (unpersisted default shape)
if none has been chosen yet. `503` if no active review.

### `POST /api/investigation-config`

Body: `{ mode: InvestigationConfig['mode'], local_path?: string }`. Requires
an active review (`503`). Validates `mode` against the five allowed values
(`400` otherwise); for `local-path`, validates `local_path` is an existing
directory (`400` with a clear message if not — no clone/network fallback,
the reviewer must supply a real path). For `temp-clone`/`always-clone`,
kicks off the clone (`gh repo clone`/`glab repo clone` into
`STATE_DIR/repos/...`, see `infrastructure.md`) synchronously before
responding — the request is slower for these two modes (a real network
clone), but the client only calls this once per repo (`chosen_at`) or when
the reviewer changes their mind, not on every review open. `502` if the
clone itself fails (`git`/`gh`/`glab` error), and the mode is not persisted
in that case — same "don't record success that didn't happen" convention as
`POST /api/submit`. On success, persists `InvestigationConfig` and returns
it.

### `GET /api/claude` (Server-Sent Events)

Query params: `chunk_id` (required — a real chunk id or `OVERVIEW_ID`), `q`
(optional question; empty means "explain/summarize"). Requires an active
review/state (`503`); `404` if `chunk_id` doesn't resolve to a real chunk
(and isn't the overview sentinel).

Streams three possible SSE event types:
- `delta` — `{ text: string }`, one per incremental chunk of Claude's output.
- `done` — `{ state: ReviewState }`, sent once the note has been persisted
  (`add_note` applied + saved) — the frontend gets the authoritative
  post-save state back, not just the raw note text.
- `error` — `{ message: string }`.

Only one Claude stream may be in flight globally at a time — a new
`/api/claude` request, a new `/api/reviews/open`, or a client disconnect
(`req.on('close')`) all cancel whatever stream is currently running
(`currentCancel` in `server.ts`). See `infrastructure.md` for what's actually
inside the stream.

Before spawning, this route consults the active repo's `InvestigationConfig`
(above): `mode: 'none'` (or unset) behaves exactly as today (diff-only,
`tmpdir()` cwd, all tools disallowed); `local-path`/`temp-clone`/
`always-clone` pass a resolved repo path and relax `Read`/`Grep`/`Glob` into
`streamClaude`'s allowed set (`infrastructure.md`); `api` instead augments
the prompt with full file contents for files touched by the diff, with no
tool/cwd change. See `infrastructure.md`'s "Repo Investigation Access"
section for the full mode-by-mode behavior.

The stream's terminal `add_note` mutation also runs inside `withStateLock` —
the same lock `POST /api/action` uses — so a note landing here can't race a
concurrent manual action (see Production Annotations below).

### Static UI

Any path not matching the above (and not in `--api-only` mode) is served
from `dist/` via `serveStatic()`: exact file match by extension → MIME lookup
table (`.html`/`.js`/`.css`/`.json`/`.svg`/`.ico`/`.woff2`); if no extension
and the file isn't found, falls back to `index.html` (SPA client-side
routing support). Path traversal is blocked by normalizing and checking the
resolved path still starts with `DIST_DIR`. In `--api-only` mode, unmatched
paths return `404 { error: 'not found (api-only mode)' }` instead — pairs
with `pnpm dev:web`'s separate Vite dev server proxying `/api` here.

## Error Handling

Any unhandled exception inside a route handler is caught at the top level
(`handle(...).catch(...)`) and returned as `500 { error: message }` — routes
themselves don't need their own generic try/catch.

## Auth

None at the API layer, by design. See `constitution.md` Principle I — the
server binds to `127.0.0.1` only; there is no session/token concept
protecting these routes themselves, and anyone with access to the local
machine can call any of them.

Authorization for the *external* operations (submitting a review, fetching
a private repo) is delegated to whatever credentials are available — for
GitHub, entirely to `gh auth`; for Jira, to the configured env vars; for
GitLab, primarily to `glab auth`/`GITLAB_TOKEN`, but **not exclusively** —
a GitLab token can also be entered through the browser UI
(`GitLabAuthModal`, `ui.md`) and persisted server-side at
`STATE_DIR/gitlab-token` (`infrastructure.md`), taking priority over
`GITLAB_TOKEN` when both are present. This is the one place this server
manages a credential itself rather than fully deferring to the local
environment — a deliberate exception (GitLab has no CLI-auth equivalent as
frictionless as `gh auth login` for a quick one-off review), not an
oversight, but worth being precise about rather than folding it into "fully
delegated to the local environment."

A future hosted/multi-user direction would need a session/auth layer here
plus per-user scoping of the single global `AppContext` (see
`infrastructure.md`), but that's not planned work — see `CLAUDE.md` for the
standing guideline on not gratuitously foreclosing it in new code.

## Production Annotations

- **State-mutation race, resolved**: `POST /api/action` and the Claude SSE
  stream's terminal `add_note` write both used to read `ctx.state`, compute,
  and write it back without any serialization. Node's single-threaded event
  loop still lets two overlapping requests interleave at each `await` point,
  so a slower mutation's write could land after (and silently clobber) a
  faster one's — a lost update, not merely a theoretical one. Fixed by
  routing both mutation sites through `withStateLock` (`src/mutex.ts`), a
  small FIFO in-process mutex: each request's read-modify-write-persist
  cycle now runs to completion before the next one starts touching
  `ctx.state`. This is a different race than `infrastructure.md`'s "no file
  locking on state files" annotation, which is about separate *processes*
  racing on disk — this one was purely in-memory, within one running server.
  Not covered by the same fix: `POST /api/submit` reads `state` before its
  (potentially slow) network round-trip to GitHub/GitLab and only writes
  `ctx.state` after — the same class of race, left as-is since submit is a
  rare, terminal, user-initiated action rather than a rapid-fire one.
