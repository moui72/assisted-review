# Defects

_Last verified: 2026-07-10_

No defects found — artifacts match the codebase as of this run.

The four documentation-drift findings from the 2026-07-10 verify pass were
resolved in the same change that records this all-clear
(`docs/ardd-refine-verify-drift`):

- `infrastructure.md` — Prompt-construction section now documents the
  `allowRepoRead`-conditional intro and `history`/prior-conversation
  threading added to `buildPrompt`/`buildOverviewPrompt` in #79.
- `infrastructure.md` — always-clone refresh is now described as comparing
  the clone's actual `git rev-parse HEAD` to `head_sha` (not `last_used`'s
  "recorded sha"), and clarifies `last_used` is an ISO timestamp bumped per
  call.
- `api.md` — `POST /api/submit` now notes both server-side-only members
  (`payload` and `progress`) are stripped before the response.
- `datamodel.md` — `SubmitResult` now documents the GitLab adapter's
  `SubmitResult & { progress }` return member.

The two `last_used` broken-contracts from the 2026-07-08/earlier passes
remain resolved (fixed in #80).
