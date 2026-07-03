---
plan: plan-refactpr-resilient-gitlab-submit-2026-07-03.md
generated: 2026-07-03
status: in-progress
---

# Tasks

## Phase 1: Data Model, Error Classification & Retry Helper

- [x] T001 [artifacts: datamodel] [parallel] Add an optional
  `gitlab_submit_progress` field to `ReviewState` in `src/types.ts`:
  `{ posted_comment_ids: string[]; note_posted: boolean; approved: boolean }`.
  GitHub reviews never set it. No migration needed — it's simply absent
  (`undefined`) for any review that hasn't attempted a GitLab submit yet,
  not a backfill case. No standalone test for this type-only change;
  verified via typecheck and exercised by T004/T005's tests.

- [x] T002 [artifacts: infrastructure] [parallel] In `src/gitlab-rest.ts`,
  add `class GitLabApiError extends Error { status?: number }`. Update
  `restFetch` to throw `new GitLabApiError(message, res.status)` instead of
  a plain `Error` (the `glab` CLI path in `glabApiJson`/`glabApiPaginatedJson`
  keeps throwing plain `Error` — no HTTP status is available there). Add an
  `isRetryable(err: unknown): boolean` helper: `false` when `err` is a
  `GitLabApiError` with `status` in `{400, 401, 403, 404, 422}`; `true` for
  everything else (status `429`, `5xx`, a `GitLabApiError` with `status:
  undefined`, or any non-`GitLabApiError` thrown value — e.g. the `glab`
  CLI path's plain `Error`). Test: unit tests covering each status bucket
  (each of the 5 non-retryable codes → `false`; `429`, `500`, `undefined`
  status, and a plain `Error` → `true`).

- [x] T003 [artifacts: infrastructure] Depends on T002. Add
  `withRetry<T>(fn: () => Promise<T>, delaysMs = [50, 100, 150]):
  Promise<T>` to `src/gitlab-rest.ts`: calls `fn()`; on failure, calls
  `isRetryable(err)` — if `false`, rethrow immediately with no further
  attempts; if `true` and delays remain, `await` the next delay and retry;
  once `delaysMs` is exhausted, rethrow the last error. Test: unit tests
  (fake timers) covering: succeeds on the first try (no delay elapses);
  succeeds on the 2nd/3rd/4th attempt with the delay before each retry
  matching `50`/`100`/`150`ms respectively; fails after exhausting all 3
  retries (4 total calls); stops immediately (1 call, no delay, no further
  attempts) when the thrown error is non-retryable.

## Phase 2: Resilient `submitGitLabReview`

- [x] T004 [artifacts: infrastructure] Depends on T001, T003. In
  `src/submit.ts`, give `submitGitLabReview` a new `priorProgress?:
  { posted_comment_ids: string[]; note_posted: boolean; approved: boolean }`
  parameter. Skip posting a discussion for any comment whose id is already
  in `priorProgress.posted_comment_ids`. Wrap each discussion POST, the note
  POST, and the approve POST in `withRetry()`. If any comment discussion
  still fails after its retries are exhausted, withhold the note and approve
  calls entirely (don't attempt them this call) and return `ok: false` with
  `comment_errors`. Return value gains a server-side-only `progress` field
  (`{ posted_comment_ids, note_posted, approved }`, reflecting this attempt's
  outcome merged with `priorProgress`) — not part of the client-facing
  `SubmitResult` shape (mirrors how `payload` is already stripped before the
  client sees it, per `api.md`). Test: unit tests covering (a) full success:
  all comments post, note posts, approves if requested — `ok: true`,
  `progress.note_posted`/`approved` both `true`, `comment_errors` undefined;
  (b) one comment fails all retries — note/approve calls are never made
  (assert the mocked `glabApiJson` wasn't called for them), `ok: false`,
  `progress.posted_comment_ids` contains only the succeeded ones; (c) a
  second call passing the progress from (b) as `priorProgress` does not
  repost the already-succeeded comment (assert `glabApiJson` isn't called
  for that comment's discussion again) and completes successfully.

## Phase 3: Wire Into `POST /api/submit`

- [ ] T005 [artifacts: api] Depends on T004. In `src/server.ts`'s
  `POST /api/submit` GitLab branch: pass `ctx.state.gitlab_submit_progress`
  as `submitGitLabReview`'s `priorProgress` argument. Merge the returned
  `progress` into `nextState.gitlab_submit_progress` and persist via
  `saveState()` on *every* attempt, success or failure (a failed attempt's
  partial progress is what the next retry needs). Strip the `progress`
  field from the client-facing response the same way `payload` is already
  stripped. Only stamp `state.submitted` and clear
  `nextState.gitlab_submit_progress` when the submission fully succeeds
  (`result.ok === true`). Test: API test simulating a two-call retry
  sequence against the same active review — first `POST /api/submit` call
  returns a partial failure (mock `submitGitLabReview` to fail one comment)
  and asserts `saveState` was called with `gitlab_submit_progress` set and
  `submitted` still absent; second call (mock `submitGitLabReview` to
  succeed, given the persisted progress) asserts `submitted` is now stamped
  and `gitlab_submit_progress` is cleared.

## Phase 4: UI — Partial-Failure Retry State

- [ ] T006 [artifacts: ui] Depends on T005 (needs the real response shape,
  though its test can mock `submitReview()` independently of the backend
  work). In `web/src/components/SubmitModal.tsx`'s `submit()` handler: read
  `res.comment_errors` in the failure branch too (today only the
  `if (res.ok)` branch does, since a partial GitLab failure used to still
  return `ok: true`). When `!res.ok && res.comment_errors` is non-empty,
  render a dedicated banner (parallel to the existing stale-SHA banner)
  listing which comments failed, distinct from the generic `res.error`
  message, and relabel the submit button "Retry submission" instead of
  "Submit as …" while that banner is showing. Test: component test mocking
  `submitReview()` to resolve `{ ok: false, comment_errors: [{ path, line,
  error }] }`, asserting the dedicated banner and relabeled button render,
  and that clicking the button calls `submitReview()` again.
