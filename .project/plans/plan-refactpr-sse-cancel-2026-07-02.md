---
status: approved
branch: refactpr
created: 2026-07-02
---

# Plan: Enforce Single In-Flight Claude Stream Server-Side

## Goal

Make `GET /api/claude` cancel any currently-running Claude SSE stream before
starting a new one, so the server actually enforces the "only one stream in
flight" invariant `api.md` already documents — closing the defect recorded
in `DEFECTS.md` (confirmed via `/ardd-refine api`: the invariant text is the
intended design; the code is what's wrong).

## Scope

**In scope:**
- `src/server.ts`'s `/api/claude` route handler: call `currentCancel?.()`
  before starting the new `streamClaude()` call, mirroring the existing
  pattern already used at `POST /api/reviews/open` (`server.ts:298-299`) and
  `DELETE /api/review` (`server.ts:163-164`).
- A regression test in `tests/server.test.ts` proving a second `/api/claude`
  request cancels the first one's stream.

**Out of scope:**
- `POST /api/reviews/open` and `DELETE /api/review`'s existing cancel calls
  — already correct, no change needed.
- `POST /api/submit`'s known, separately-documented state-mutation race
  (`api.md` Production Annotations) — unrelated race, explicitly left as-is
  there already.
- Any change to `api.md` itself — its wording was confirmed correct via
  `/ardd-refine api`; this plan is a pure code fix bringing the
  implementation in line with the already-accurate doc.

## Technical Approach

Per `api.md`'s `GET /api/claude` section and `src/server.ts`'s existing
`currentCancel` variable (module-scoped inside `startServer`, holding the
active stream's kill function): two of the three places that should cancel
a running stream already do (`server.ts:163-164`, `:298-299`), but the
`/api/claude` handler itself (`server.ts:311-393`) only *sets*
`currentCancel = cancel` (`:388`) without first calling the *previous*
value. A second concurrent `/api/claude` request today silently orphans the
first stream's cancel handle — the first stream keeps running server-side
until it finishes or the original client disconnects, even though the
second request has already taken over `currentCancel`.

Fix: add `currentCancel?.();` as the first statement inside the `/api/claude`
block (immediately after the existing `503`/`404` guards, before
`res.writeHead(...)` starts the new SSE response) — same one-line pattern as
the other two call sites. No other logic changes; the existing
`onDone`/`onError`/`req.on('close')` handlers' `if (currentCancel === cancel)
currentCancel = null` guards already correctly avoid a finishing *old*
stream from clobbering a newer stream's `currentCancel`, so this fix doesn't
need to touch that logic.

**Test approach:** `tests/server.test.ts`'s existing `streamClaude` mock
(`vi.mock('../src/claude', ...)`) auto-resolves via `onDone` on
`process.nextTick`, which doesn't leave a stream "in flight" long enough to
start a second request against it. The new test needs a per-test override
(`vi.mocked(streamClaude).mockImplementationOnce(...)`) that returns a
distinct `vi.fn()` cancel spy and does *not* call `onDone`/`onError`
synchronously, so the first stream is still "in flight" when the second
`GET /api/claude` request fires. Assert the first call's returned cancel spy
was invoked once the second request starts.

## Phase Breakdown

1. **Fix and test** *(single phase — one file, one behavior)*
   - Add the `currentCancel?.()` call to the `/api/claude` handler.
   - Add the regression test described above.
   - Run the full suite + coverage to confirm no regressions and the
     backend coverage gate (90%) still holds.
   - Demonstrable increment: the new test fails against pre-fix code (red),
     passes after the one-line fix (green); manually confirmed via two
     rapid `/api/claude` requests in a running instance (or trusted via the
     unit test, if manual repro is impractical to time precisely).

2. **No further phases.**

## Complexity Tracking

No deviations from the simplicity principle — one-line fix, mirrors an
existing pattern already used twice in the same file.

## Open Questions

None. The design decision (server-side enforcement is intended; `api.md`'s
wording is correct) was already resolved via `/ardd-refine api` before this
plan was drafted.

## Production Annotation Summary

None introduced. This plan closes an existing defect (`DEFECTS.md`); it does
not create a new documented shortcut. After implementation, run
`/ardd-verify` to confirm the `api.md` defect clears.
