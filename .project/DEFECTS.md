# Defects

_Last verified: 2026-07-08_

## api.md

- **Claim:** "## Auth — None, by design... Authorization for the *external*
  operations (submitting a review, fetching a private repo) is entirely
  delegated to whatever `gh auth` / `glab auth` / Jira credentials the local
  environment already has configured."
  **Actual:** GitLab auth is *not* entirely delegated to `glab auth`/env
  vars — there's a separate browser-entered-token mechanism. `GET/POST/DELETE
  /api/auth/gitlab` (`src/server.ts:541-563`) let the UI submit a GitLab PAT
  that's persisted server-side to `STATE_DIR/gitlab-token` (mode `0o600`,
  `src/gitlab-token.ts:11,33-39`) and takes priority over `GITLAB_TOKEN` in
  `getGitLabToken()`'s resolution order (`src/gitlab-token.ts:20-23`:
  browser-stored token first, `GITLAB_TOKEN` env var second). None of these
  three routes appear in `api.md`'s Endpoints list at all.
  **Location:** `src/server.ts:541-563`, `src/gitlab-token.ts` (whole file)
  **Severity:** broken-contract — the "Auth" section's central claim
  (external auth is fully delegated to the local environment, no
  server-managed credential) is factually wrong for GitLab.

- **Claim:** (implicit — `POST /api/reviews/open`'s documented response
  shapes are `{ review, state }` on success or `{ error }` on `400`/`502`;
  no other outcome is described)
  **Actual:** the route also returns `401 { error, auth_required: 'gitlab' }`
  when `loadReview()` throws `GitLabAuthError` (`src/server.ts:359-362`) —
  this third response shape and status code aren't documented anywhere in
  `api.md`.
  **Location:** `src/server.ts:359-362`
  **Severity:** drift — an undocumented response shape a client integration
  would need to know about.

## infrastructure.md

- **Claim:** the GitLab Integration Components entry describes only
  `GITLAB_TOKEN`/`GITLAB_HOST` env-var auth and the `glab`-vs-REST transport
  selection; no mention of any server-persisted credential.
  **Actual:** `src/gitlab-token.ts` implements a full secondary credential
  store — an in-memory token plus an atomic-write persisted copy at
  `STATE_DIR/gitlab-token` (`0o600`), loaded once at startup
  (`loadGitLabToken()`, correctly called fire-and-forget at
  `src/server.ts:151` inside `startServer()`), with its own resolution
  precedence over the env var. This entire mechanism is absent from the
  artifact's Storage and Integration Components sections.
  **Location:** `src/gitlab-token.ts` (whole file), `src/server.ts:151`
  **Severity:** drift — a real, non-trivial storage/auth mechanism with no
  documentation footprint.

## ui.md

- **Claim:** "## Keyboard Model — Global `keydown` listener in `App.tsx`,
  disabled while focus is in a `TEXTAREA`/`INPUT`, with modal-specific
  short-circuits (Submit/Reviews/Settings/Help each only listen for `Escape`
  while open)."
  **Actual:** `InvestigationModal` is missing from that short-circuit list.
  `App.tsx`'s `onKey` handler (`web/src/App.tsx:307-333`) checks
  `submitOpen`/`reviewsOpen`/`settingsOpen`/`helpOpen` but never
  `investigationModalOpen` (state declared at `web/src/App.tsx:72`, modal
  rendered at `web/src/App.tsx:585`). Global shortcuts (arrow-key
  navigation, `f` flag, `c` comment, `↵` mark-viewed-and-advance) keep
  firing while `InvestigationModal` is open, and the global handler won't
  close it on `Escape` — only the modal's own internal `onKeyDown`
  (`InvestigationModal.tsx:74,81`) does, which only fires if focus is
  actually inside the modal's DOM subtree (not guaranteed — e.g. right
  after opening it from the banner button, focus is still on that button,
  outside the modal).
  **Location:** `web/src/App.tsx:307-333`
  **Severity:** broken-contract for the stated pattern, and a real UX bug —
  a reviewer typing in the modal or navigating focus around it can
  accidentally flag/comment/navigate the chunk underneath, or find Escape
  doesn't close the modal depending on what has focus.

- **Missing component:** `GitLabAuthModal.tsx` (`web/src/components/
  GitLabAuthModal.tsx`) is not listed in the `## Components` section at all
  — it's mentioned only in passing inside `InvestigationModal`'s bullet
  ("matching `GitLabAuthModal.tsx`'s existing `saving` pattern"), as a
  style reference, not as a documented component in its own right. It's
  wired into `Splash.tsx` only (`web/src/components/Splash.tsx:5,71-78`) —
  opened when `POST /api/reviews/open` returns `auth_required: 'gitlab'`,
  closing and retrying the open on successful token save.
  **Location:** `web/src/components/GitLabAuthModal.tsx`,
  `web/src/components/Splash.tsx:15-37,71-78`
  **Severity:** drift — an entire component and its trigger flow undocumented.

- **Behavioral asymmetry (not a false claim, but relevant to any future
  documentation of the auth flow):** `OpenReviewForm.tsx`/`ReviewsMenu.tsx`'s
  `handleOpen` (`web/src/components/ReviewsMenu.tsx:57-74`) does not check
  for `auth_required: 'gitlab'` the way `Splash.tsx` does — opening a
  GitLab MR without a stored token from the in-app "Open a review" menu
  (as opposed to the initial Splash screen) falls through to the generic
  `setOpenError(result.error ?? 'Failed to open review')` branch with no
  path to enter a token, unlike the Splash-screen flow. Worth a decision
  (fix the asymmetry, or document it as intentional) rather than leaving it
  implicit.
  **Location:** `web/src/components/ReviewsMenu.tsx:57-74`
  **Severity:** cosmetic-to-drift (UX inconsistency; not contradicting any
  existing artifact claim since none currently describes this flow).

## Other artifacts checked, no defects found

- `datamodel.md` — every entity in `src/types.ts` (including
  `InvestigationConfig`) matches its documented shape field-for-field.
- `constitution.md` — spot-checked; no violations found this pass.
- Previously-verified areas re-confirmed clean, no regressions: GitLab
  submit retry/error-classification (`src/gitlab-rest.ts`,
  `src/submit.ts`), Jira fetch/timeout/epic-resolution
  (`src/jira.ts`, `src/review.ts`), token-reference resolution
  (`src/resolve-token.ts`), unified-diff parsing and chunk grouping
  (`src/parse-diff.ts`), `SubmitModal.tsx`'s partial-failure UI.
