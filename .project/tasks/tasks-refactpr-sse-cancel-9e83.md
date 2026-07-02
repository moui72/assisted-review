---
plan: plan-refactpr-sse-cancel-2026-07-02.md
generated: 2026-07-02
status: completed
---

# Tasks

## Phase 1: Fix and test

- [x] T001 [artifacts: api] Add a regression test to `tests/server.test.ts` (inside or near the existing `describe('GET /api/claude', ...)` block) proving a second `/api/claude` request cancels the first one's still-running stream. The existing `vi.mock('../src/claude', ...)` mock auto-resolves via `onDone` on `process.nextTick`, which doesn't leave a stream "in flight" long enough to test this — override it per-test with `vi.mocked(streamClaude).mockImplementationOnce(...)` (import `streamClaude` from `../src/claude` at the top if not already imported) that returns a distinct `vi.fn()` cancel spy and does NOT call `onDone`/`onError` synchronously (so the stream stays open). Fire a first `GET /api/claude?chunk_id=c1` request (don't await its body, just start it), then fire a second `GET /api/claude?chunk_id=c1` request, and assert the first request's cancel spy was called once. Run this test and confirm it FAILS against the current code (red state) before proceeding — this proves the test actually exercises the bug. Do not modify `src/server.ts` in this task.

- [x] T002 [artifacts: api] In `src/server.ts`, inside the `/api/claude` route handler (the `if (url.pathname === '/api/claude')` block, currently starting around line 311), add `currentCancel?.();` as the first statement immediately after the existing `503`/`404` guard checks (i.e. after confirming `review`/`initialState` exist and the `chunk_id` resolves) and before `res.writeHead(...)` starts the new SSE response — mirroring the exact same one-line pattern already used at `POST /api/reviews/open` (`server.ts:298-299`) and `DELETE /api/review` (`server.ts:163-164`). Do not set `currentCancel = null` here (unlike those two call sites) — the very next lines already reassign `currentCancel = cancel` to the new stream's cancel function once `streamClaude()` is called, so an intermediate `null` isn't needed. After this change, run the T001 test and confirm it now PASSES (green state).

- [x] T003 [artifacts: api] Run the full test suite with coverage (`npx vitest run --coverage`) and confirm: all tests pass (no regressions in the existing `GET /api/claude` tests — 503/404/200/overview-chunk cases — or any other suite), and backend (`src/**/*.ts`) statement/line coverage stays above the 90% gate. Depends on T001 and T002.
