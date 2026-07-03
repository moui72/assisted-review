---
status: approved
branch: refactpr
created: 2026-07-03
features: [resilient-gitlab-submit]
---

# Plan: Resilient GitLab Submit

## Goal

Make GitLab review submission resilient to partial failure: don't mark a
review `submitted` until every part of it actually succeeds, retry
transient failures on individual GitLab API calls, and let a reviewer retry
a failed submission without reposting comments that already landed.

## Scope

**In scope:**
- A small retry helper (up to 3 retries, linear 50ms/100ms/150ms backoff,
  300ms max added latency) wrapping each GitLab submit call (discussion
  POST, note POST, approve POST) — error-aware: a classified non-transient
  failure (bad auth, a validation error) fails immediately instead of
  burning through all 3 retries.
- Threading prior submit progress through `submitGitLabReview` so a retry
  skips already-posted comments/note/approve.
- Withholding the note/approve calls entirely when any comment discussion
  still fails after retry.
- Persisting progress in `ReviewState.gitlab_submit_progress`, cleared on
  full success (same moment `submitted` is stamped).
- `SubmitModal.tsx` surfacing a partial-failure retry state (today it only
  reads `comment_errors` on the success branch, since partial failure used
  to still return `ok: true`).

**Non-goals:**
- GitHub's submit path is untouched — `POST /pulls/{n}/reviews` is already
  atomic (one document, one call), so it has no partial-failure case to
  track or retry.
- No retry for fetch/Jira/Claude — `infrastructure.md`'s existing
  "no adapter-level retry policy" annotation stays open for those three;
  this plan only closes it for GitLab submit specifically.
- No change to the stale-head-SHA check or `comment_errors` shape itself —
  only when/whether the note/approve calls run and how progress persists.

## Technical Approach

- **Error classification**: `glabApiJson`'s two transports have asymmetric
  error information. The REST fallback path (`restFetch`) gets a real HTTP
  status from `fetch()`'s `Response`; the `glab` CLI path only has an exit
  code and stderr text, with no reliable structured status across glab
  versions. Both paths throw a new `GitLabApiError extends Error { status?:
  number }` — REST always sets `status` from `res.status`; the CLI path
  throws with `status: undefined` since it can't determine one. A status of
  `400`/`401`/`403`/`404`/`422` is non-retryable (retrying can't fix a bad
  request, missing auth, or a validation failure); everything else — `429`,
  `5xx`, a network-level failure, or `status: undefined` (the CLI path, or
  any REST failure before a response arrives) — is treated as retryable,
  since retrying costs only latency and we can't confidently rule those out
  as transient.
- **Retry helper**: a small `withRetry(fn, delaysMs=[50, 100, 150])` in
  `src/gitlab-rest.ts` — up to 3 retries with linear backoff between
  attempts (300ms max added latency), used by each of `submitGitLabReview`'s
  three call kinds. Stops immediately (no further retries) the moment a
  `GitLabApiError` classifies as non-retryable. Proportionate to the actual
  gap — not a general backoff framework or a full circuit breaker.
- **Progress threading**: `submitGitLabReview` gains a `priorProgress?:
  { posted_comment_ids: string[]; note_posted: boolean; approved: boolean }`
  parameter — comments whose id is already in `posted_comment_ids` are
  skipped on retry. Its return value gains a server-side-only `progress`
  field (mirroring how `SubmitResult.payload` is already stripped before
  reaching the client, per `api.md`) carrying the updated progress after
  this attempt.
- **Route wiring**: `POST /api/submit`'s GitLab branch (`src/server.ts`)
  passes `ctx.state.gitlab_submit_progress` in, merges the returned
  `progress` into `nextState.gitlab_submit_progress`, and persists it via
  `saveState()` on *every* attempt (success or failure) — not just on
  success, since a failed attempt's partial progress is exactly what the
  next retry needs. `submitted` is stamped and `gitlab_submit_progress`
  cleared only once nothing is left to retry (all comments posted, note
  posted if a body was given, approved if requested).
- **UI**: `SubmitModal.tsx`'s `submit()` handler currently only reads
  `res.comment_errors` inside the `if (res.ok)` branch. It needs to also
  read it in the failure branch (`!res.ok && res.comment_errors`), render a
  dedicated banner (parallel to the existing stale-SHA banner) rather than
  the generic error message, and relabel the submit button "Retry
  submission" instead of "Submit as …" while that banner is showing.

## Phase Breakdown

1. **Data model, error classification & retry helper** — add
   `gitlab_submit_progress` to `ReviewState` (`src/types.ts`); add
   `GitLabApiError` (with optional `status`) and update `restFetch` to set
   it from `res.status`; add `withRetry()` to `src/gitlab-rest.ts`.
   Testable increment: unit tests for `withRetry` (succeeds first try,
   succeeds on the 2nd/3rd/4th attempt, fails after exhausting all 3
   retries with correct 50ms/100ms/150ms delays, stops immediately on a
   non-retryable `GitLabApiError` status) and for the classification logic
   itself (400/401/403/404/422 → non-retryable; 429/5xx/undefined →
   retryable).
   `[artifacts: datamodel, infrastructure]`

2. **Resilient `submitGitLabReview`** — thread `priorProgress` through;
   wrap each discussion/note/approve POST in `withRetry()`; skip
   already-posted comment ids; withhold note/approve if any comment
   discussion still fails; return updated `progress`. Depends on phase 1.
   Testable increment: unit tests covering (a) full success clears
   progress, (b) one comment fails after retry → note/approve withheld,
   `ok: false`, progress recorded with the succeeded ids, (c) a second call
   passing that progress skips the already-posted comment and completes.
   `[artifacts: infrastructure]` — feature: `resilient-gitlab-submit`

3. **Wire into `POST /api/submit`** — `server.ts`'s GitLab branch passes
   `ctx.state.gitlab_submit_progress` in, persists the returned progress on
   every attempt, strips it from the client response (like `payload`),
   stamps `submitted` and clears progress only on full success. Depends on
   phase 2. Testable increment: API test simulating a two-call retry
   sequence — first call partial failure persists progress and returns
   `ok: false`; second call (same review) succeeds and stamps `submitted`.
   `[artifacts: api]` — feature: `resilient-gitlab-submit`

4. **UI: partial-failure retry state** — `SubmitModal.tsx` reads
   `comment_errors` on the failure branch too, renders the dedicated
   banner, relabels the submit button. Depends on phase 3 (needs the real
   response shape, though its test can mock `submitReview()` independently).
   Testable increment: component test mocking `submitReview()` to return
   `{ ok: false, comment_errors: [...] }`, asserting the banner + relabeled
   button render and that clicking it calls `submitReview()` again.
   `[artifacts: ui]` — feature: `resilient-gitlab-submit`

## Complexity Tracking

None. The retry helper and progress field are proportionate to the gap
being closed — no new abstraction layer beyond what's needed.

## Open Questions

None remaining — progress storage (persisted `ReviewState` field) and
retry parameters (up to 3 retries, linear 50ms/100ms/150ms backoff, 300ms
max added latency) were both resolved during planning.

## Production Annotation Summary

None anticipated. If implementation surfaces a case retry can't cleanly
handle (e.g., the MR's diff version changes between retry attempts,
invalidating previously-fetched position SHAs), annotate it under
`infrastructure.md`'s Production Annotations per `constitution.md`'s
Development Workflow convention.
