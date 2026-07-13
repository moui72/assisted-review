---
plan: plan-gitlab-auth-precedence-2026-07-13-e7a6.md
generated: 2026-07-13
status: completed
---

# Tasks

## Phase 1: Transport-selection logic
- [x] T001 [artifacts: infrastructure] Add `shouldUseGlab(): Promise<boolean>` to `src/gitlab-rest.ts`, co-located with `glabAvailable()`. It returns `false` immediately if `gitLabTokenSource() === 'browser'` (import from `./gitlab-token.js`); otherwise delegates to `glabAvailable()`. Export it alongside `glabAvailable()`. Addresses feedback F001 (`.project/feedback/feedback-docs-rewrite-from-scratch-3ac1.md`).
- [x] T002 [artifacts: infrastructure] In `src/gitlab-rest.ts`, replace the two `if (await glabAvailable())` gates (currently at lines 159 and 186 — MR-diff and MR-view transport selection) with `if (await shouldUseGlab())`.
- [x] T003 [artifacts: infrastructure] In `src/fetch.ts`, replace the three `glabAvailable()` gates (currently at lines 158, 169, 217 — diff fetch, meta fetch, file-contents fetch) with `shouldUseGlab()` (imported from `./gitlab-rest.js`), preserving each site's existing polarity (`if (!await glabAvailable())` becomes `if (!await shouldUseGlab())`, etc.).
- [x] T004 [artifacts: infrastructure] Add/extend unit tests (in the existing test files covering `gitlab-rest.ts` and `fetch.ts` — locate via `grep -rl glabAvailable tests/`) covering three cases: (a) browser token present + `glab` available → REST path used; (b) no browser token + `glab` available → `glab` path used (regression guard for existing behavior); (c) no browser token + `glab` unavailable → REST path with `GITLAB_TOKEN` (regression guard). Use `_setGlabAvailable()` and `_setBrowserToken()` test overrides already exported for this purpose. Run `npx vitest run --coverage` and confirm backend statement/line coverage stays above 90%.

## Phase 2: Artifact + docs updates
- [x] T005 [artifacts: infrastructure] Rewrite the "Transport selection" bullet in `.project/artifacts/infrastructure.md`'s GitLab integration section (currently lines 69–74) to state the new precedence — browser-entered token first, then `glab` CLI, then `GITLAB_TOKEN` env var — referencing `shouldUseGlab()` by name. Fold in the adjacent "Browser-entered token" bullet's now-outdated "second, higher-priority... for the REST-fallback path specifically" framing to match (it's no longer scoped to REST-fallback only — it now decides whether REST-fallback is used at all). Stamp frontmatter: `.claude/skills/ardd-scripts/ardd-state.sh stamp .project/artifacts/infrastructure.md last_updated 2026-07-13` and set `diagram_status` to `stale` if not already.
- [x] T006 [artifacts: api] In `.project/artifacts/api.md`'s Auth section (the paragraph noting the browser token "taking priority over `GITLAB_TOKEN` when both are present"), update it to also state priority over `glab` auth. Stamp `last_updated` via `ardd-state.sh stamp .project/artifacts/api.md last_updated 2026-07-13`.
- [x] T007 [parallel] Update `README.md`'s "GitLab (optional)" priority-order list (the numbered list currently reading `glab` → browser token → `GITLAB_TOKEN`) to the new order: browser token → `glab` → `GITLAB_TOKEN`, with brief updated rationale in each line matching the artifact wording from T005.
