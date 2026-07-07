---
slug: resilient-gitlab-submit
status: implemented
logged: 2026-07-02
plan: plan-refactpr-resilient-gitlab-submit-2026-07-03.md
tasks: tasks-refactpr-resilient-gitlab-submit-a396.md
---

Make GitLab review submission resilient to partial failure: withhold the summary-note/approve call until every inline comment discussion has posted successfully, retry each request on transient failure, and — if a submission still ends up partial — persist which comments succeeded and which failed in `ReviewState` so the reviewer can retry later without reposting duplicates; the review is only marked `submitted` once the whole submission actually succeeds.
Why: GitLab has no atomic "review" object like GitHub's single-POST review — each inline comment, the summary note, and the approve call are separate, independently-failing requests — flagged by `/ardd-critique` (`critique.md`) since today's behavior stamps `submitted` (blocking retry) even when some comments failed to post.
