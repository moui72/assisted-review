---
name: api
status: stable
last_updated: 2026-07-01
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
boolean }`, sourced from `StartOptions` (in turn from `PRELOAD_CHUNKS` /
`PRELOAD_OVERVIEW` env vars). Used by the frontend to decide how aggressively
to prefetch AI commentary.

### `GET /api/review`

Returns the active `Review` (`datamodel.md`), or `204 No Content` if none is
open.

### `DELETE /api/review`

Clears the active review: cancels any in-flight Claude SSE stream, deletes
the review's state file on disk (best-effort — errors swallowed), and nulls
out `ctx.review`/`ctx.state`. Returns `{ ok: true }`.

### `GET /api/state`

Returns the active `ReviewState`, or `204` if none.

### `POST /api/action`

Body: an `Action` (see `datamodel.md`). Requires an active review/state
(`503` otherwise). Applies `applyAction(state, action)`, persists via
`saveState()`, returns the new `ReviewState`. This is the single mutation
endpoint for comments/flags/viewed — the frontend never manipulates state
directly, always round-trips through here so the server remains the source
of truth for what's persisted.

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
authenticated).

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

None, by design. See `constitution.md` Principle I — the server binds to
`127.0.0.1` only; there is no session/token concept at the API layer.
Authorization for the *external* operations (submitting a review, fetching a
private repo) is entirely delegated to whatever `gh auth` / `glab auth` /
Jira credentials the local environment already has configured. A future
hosted/multi-user direction would need a session/auth layer here plus
per-user scoping of the single global `AppContext` (see `infrastructure.md`),
but that's not planned work — see `CLAUDE.md` for the standing guideline on
not gratuitously foreclosing it in new code.

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
