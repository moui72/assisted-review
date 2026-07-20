---
status: open
created: 2026-07-20
plan: null
---

# Feedback

## Bugs

- [ ] F001 `ReviewState.head_sha` conflates two different SHAs, which makes the
  pre-submit stale guard largely inert. `loadState()` overwrites `head_sha`
  with the freshly-fetched SHA on every load (`src/state.ts:190`), so the SHA
  the comments were actually drafted against is lost. The submit route passes
  that refreshed value into `buildReviewPayload()` (call site
  `src/server.ts:285`; defined at `src/submit.ts:31`), which sets it as
  `commit_id` (`src/submit.ts:46`), and
  `submitReview()` checks it via `shaOnPr()` (`src/submit.ts:85`) — i.e. it
  asks "is the latest SHA on this PR?", which is nearly always yes. The
  `SubmitResult.stale` 409 path therefore fires mainly through the GitHub
  error fallback (`STALE_RE` against `gh` stderr), not the explicit pre-check
  that exists to catch this. Fix means persisting the drafted SHA separately
  from the latest-fetched one — one new field plus a `migrate()` step, rather
  than a redesign. Note Anchor Reconciliation independently handles the
  *chunk*-shaped consequences of a moved head, so drafted comments are not
  silently mis-anchored; it is specifically the commit-level guard that is
  weak. [artifacts: datamodel]

<!--
Surfaced 2026-07-20 by CodeRabbit on PR #105 and verified against the code.
Pre-existing and unrelated to that PR's GitLab auth work, so not fixed there.
datamodel.md's Production Annotations section was corrected in that PR to
describe the gap accurately rather than claiming the check works — this
feedback item tracks closing the gap itself.
-->
