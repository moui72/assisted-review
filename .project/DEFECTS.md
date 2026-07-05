# Defects

_Last verified: 2026-07-03_

No defects found — artifacts match the codebase as of this run.

`resilient-gitlab-submit`'s implementation matches its design exactly:
- `datamodel.md`'s `ReviewState.gitlab_submit_progress` shape matches
  `GitLabSubmitProgress` in `src/types.ts`.
- `infrastructure.md`'s retry policy (linear 50ms/100ms/150ms backoff,
  scoped to only the discussion/note/approve calls — not the stale check or
  version fetch) and error classification (400/401/403/404/422
  non-retryable, everything else retryable) match `withRetry`/`isRetryable`
  in `src/gitlab-rest.ts` exactly, including the mid-session revisions
  (flat → linear backoff, then error-aware classification added).
- `api.md`'s claims — note/approve withheld entirely on any remaining
  comment failure, `submitted` stamped only on full success, progress
  persisted on every attempt and stripped from the client response — all
  confirmed in `src/server.ts`'s `POST /api/submit` handler.
- `ui.md`'s `SubmitModal.tsx` claims (partial-failure banner distinct from
  the generic error, "Retry submission" label, retry just re-dispatches
  `POST /api/submit`) confirmed against the component directly.

No code changes since the prior full pass otherwise — `constitution.md` and
`ui.md`'s previously-fixed Displaced Comments note re-confirmed clean.
