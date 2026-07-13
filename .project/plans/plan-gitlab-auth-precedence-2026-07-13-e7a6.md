---
status: approved
branch: gitlab-auth-precedence
created: 2026-07-13
features: []
surfaced-defects: []
---

# Plan: GitLab auth transport precedence

## Goal

Make a browser-entered GitLab token take priority over the `glab` CLI when
choosing which GitLab transport to use, so a reviewer's explicit auth choice
in the UI isn't silently overridden by `glab` happening to be installed and
authenticated.

## Scope

**In scope**: transport-selection logic in `src/fetch.ts` and
`src/gitlab-rest.ts` (the four call sites currently gated on
`glabAvailable()` alone), a small addition to `src/gitlab-token.ts` to
expose whether the active token came from the browser, and the
`infrastructure.md` artifact text describing this precedence.

**Out of scope**: the token storage/persistence mechanism itself (unchanged
— still `STATE_DIR/gitlab-token`, `0o600`, atomic write), the
`GitLabAuthModal` UI, `api.md`'s endpoint contracts (no route/shape
changes — only the prose in its "Auth" section describing the precedence
needs a matching update), and GitHub's transport (unaffected, no REST
fallback exists there).

## Technical Approach

Today, four call sites independently gate on `glabAvailable()` to decide
`glab` CLI vs. REST fallback (`src/fetch.ts:158,169,217`,
`src/gitlab-rest.ts:159,186`) — `glab`, if installed, always wins
regardless of whether a browser token exists. `src/gitlab-token.ts`
already tracks token provenance via `gitLabTokenSource()` (`'browser' |
'env' | null`), so no new state is needed — just a new decision function
combining the two signals, and every `glabAvailable()` call-site gate
switched to it.

Add `shouldUseGlab(): Promise<boolean>` to `src/gitlab-rest.ts` (co-located
with `glabAvailable()`, which it wraps):

```ts
export async function shouldUseGlab(): Promise<boolean> {
  if (gitLabTokenSource() === 'browser') return false;
  return glabAvailable();
}
```

Replace the four `if (await glabAvailable())` / `if (!await
glabAvailable())` gates with `shouldUseGlab()` (inverted as needed). No
other behavior changes: when there's no browser token, `shouldUseGlab()`
is identical to today's `glabAvailable()` check, so `glab`-only and
env-var-only setups are unaffected.

Then update `infrastructure.md`'s "Transport selection" bullet (GitLab
section) to describe the new precedence — browser token first, then
`glab`, then `GITLAB_TOKEN` — replacing the current text that documents
`glab`-always-wins as intentional. `api.md`'s "Auth" section (the prose
noting the browser token "taking priority over `GITLAB_TOKEN`") gets a
one-line update to also say it takes priority over `glab`.

## Phase Breakdown

### Phase 1: Transport-selection logic
- [ ] T001 [artifacts: infrastructure] Add `shouldUseGlab()` to
  `src/gitlab-rest.ts`, returning `false` immediately if
  `gitLabTokenSource() === 'browser'`, else delegating to
  `glabAvailable()`. Export it alongside `glabAvailable()`. Addresses
  feedback F001 (`feedback-docs-rewrite-from-scratch-3ac1.md`).
- [ ] T002 [artifacts: infrastructure] Replace the two `glabAvailable()`
  gates in `src/gitlab-rest.ts` (lines 159, 186 — MR-diff and MR-view
  transport selection) with `shouldUseGlab()`.
- [ ] T003 [artifacts: infrastructure] Replace the three `glabAvailable()`
  gates in `src/fetch.ts` (lines 158, 169, 217 — diff fetch, meta fetch,
  file-contents fetch) with `shouldUseGlab()`.
- [ ] T004 [artifacts: infrastructure] Unit tests in `tests/gitlab-rest.test.ts`
  and `tests/fetch.test.ts` (or wherever the existing `glabAvailable()`
  mocks live) covering: browser token + `glab` available → REST path used;
  no browser token + `glab` available → `glab` path used (existing
  behavior, regression-guard); no browser token + `glab` unavailable →
  REST with `GITLAB_TOKEN` (existing behavior, regression-guard). Maintain
  the >90% backend coverage threshold.

### Phase 2: Artifact + docs updates
- [ ] T005 [artifacts: infrastructure] Rewrite the "Transport selection"
  bullet in `infrastructure.md`'s GitLab integration section to state the
  new precedence (browser token → `glab` → `GITLAB_TOKEN`) and reference
  `shouldUseGlab()`. Stamp `last_updated` via `ardd-state.sh stamp`.
- [ ] T006 [artifacts: api] Update the one sentence in `api.md`'s Auth
  section noting browser-token priority to also cover `glab`. Stamp
  `last_updated`.
- [ ] T007 Update `README.md`'s "GitLab (optional)" priority-order list
  (currently: `glab` → browser token → `GITLAB_TOKEN`, corrected in the
  docs-rewrite PR to match *today's* behavior) to reflect the new order
  this plan implements: browser token → `glab` → `GITLAB_TOKEN`.

## Open Questions

None — this is a self-contained precedence reordering with no new
entities, routes, or UI surface.

## Production Annotation Summary

N/A — no production shortcut introduced; this corrects an existing
documented-as-intentional precedence to match user intent.
