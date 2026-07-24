# Submitting a review

When you're done, hit **Submit** in the top bar: pick a verdict, add an
optional summary, and your drafted line comments go out with it.

Verdicts map to the platform's native concepts:

- **GitHub:** Approve, Comment, or Request changes
- **GitLab:** Approve or Comment

## How it posts

**GitHub** — the entire review (verdict, summary, inline comments) posts as a
single PR review via `gh api`: atomic, one request.

**GitLab** — there's no single-request review, so each inline comment posts
as its own discussion, then a summary note, then an optional approve.
Transient failures are retried; if a comment still fails, the note/approve
are withheld, the partial progress is persisted, and retrying the submission
skips whatever already posted instead of duplicating it.

## Stale-diff protection

If the PR/MR was force-pushed since you started, submission is **blocked
with a stale-SHA warning** rather than posting mis-anchored comments —
re-fetch the review to re-anchor first. Reopening a review whose diff
changed shape marks now-orphaned comments as
[displaced](reviewing.md#displaced-comments) so you can re-anchor them by
hand.
