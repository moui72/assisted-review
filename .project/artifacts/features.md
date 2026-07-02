---
last_updated: 2026-07-01
---

# Features

## Fetch & Parse GitHub PRs
_Added 2026-06-10 · infrastructure, datamodel_
Fetches a GitHub PR's diff and metadata via the `gh` CLI and parses the unified diff into sequentially-numbered hunks (`RawHunk`), the foundation for everything else in the tool.

## Chunking (Adjacent-Hunk Grouping)
_Added 2026-06-10 · infrastructure, datamodel_
Groups adjacent hunks from the same file (separated by a small unchanged-line gap) into `Chunk`s, the primary reviewable unit the rest of the app operates on, instead of forcing the reviewer through one hunk at a time.

## Paginated Hunk-by-Hunk Review UI
_Added 2026-06-10 · ui_
A single-page React app that walks the reviewer through one chunk (or an overview page) at a time with slide transitions, syntax-highlighted diff rendering, and a keyboard-first navigation model.

## AI Commentary via Headless Claude
_Added 2026-06-10 · infrastructure, api_
Streams AI-generated explanations and suggested actions for each chunk (and the overview) from a headless `claude -p --output-format stream-json` subprocess over SSE, with the reviewer able to ask follow-up questions.

## Line-Anchored Draft Comments
_Added 2026-06-10 · datamodel, api_
Lets the reviewer click a diff line to anchor a comment, then add/update/delete draft comments before submission — the core "review as you read" workflow.

## Persisted Review State (Resume on Reopen)
_Added 2026-06-10 · datamodel, infrastructure_
Persists comments, flags, viewed markers, and AI notes to a JSON file per PR/MR under `~/.assisted-review/`, so reopening the same PR resumes exactly where the reviewer left off.

## Chunk Flagging & Viewed Tracking
_Added 2026-06-10 · datamodel, ui_
Lets a reviewer flag a chunk for follow-up and marks chunks viewed as they're read, surfaced as a progress strip in `TopNav`.

## Overview Page with Jira Context
_Added 2026-06-10 · ui, infrastructure_
A dedicated overview screen showing the PR title/description plus any linked Jira issue(s) and epic (extracted from title/branch/body via regex), with a setup banner shown instead of an error when Jira isn't configured.

## `.env`-Based Configuration
_Added 2026-06-10 · infrastructure_
Loads configuration (Jira/GitLab credentials, state dir override, preload tuning) from `.env` files with a defined precedence (real env > `$DOTENV_CONFIG_PATH` > `./.env` > `~/.assisted-review/.env`), via `dotenv`.

## Publish Review to GitHub
_Added 2026-06-10 · api, infrastructure_
Submits all drafted inline comments plus a verdict (approve/comment/request-changes) and summary body as a single GitHub PR review via `gh api`, with a stale-head-SHA check before posting.

## Mock AI Mode
_Added 2026-06-10 · infrastructure_
`--mock-ai` flag attaches placeholder lorem-ipsum AI commentary directly to chunks at load time, bypassing the `claude` subprocess — used for offline development and the e2e test suite.

## State Schema Versioning & Migration
_Added 2026-06-10 · datamodel_
`STATE_VERSION` plus a `migrate()` step backfills gaps in older state files (missing version, missing `pr.platform`) on load, so persisted state survives schema changes across upgrades.

## Global CLI Packaging
_Added 2026-06-10 · infrastructure_
Packaged and installable as a global CLI (`npm i -g assisted-review`), with `bin` pointing at the compiled backend and `files` shipping only compiled `build/`/`dist/` output.

## Response Status Code Correctness (410 vs 409 for Resubmission)
_Added 2026-06-12 · api_
Returns `410 Gone` (not `409`) when a `POST /api/submit` targets a review that has already been published, distinguishing "already done" from "conflict."

## Cross-Platform Browser Auto-Open
_Added 2026-06-12 · infrastructure_
Opens the default browser to the running server's URL on start (`open`/`start`/`xdg-open` per OS), with a `--no-open` flag to suppress it; fixed for correct Windows behavior.

## Platform-Aware Keyboard Hints
_Added 2026-06-12 · ui_
Keyboard shortcut labels in the UI (Help overlay, response bar) switch between Mac (⌘) and Windows/Linux (Ctrl) glyphs based on `navigator.userAgent` detection.

## Review Picker & In-App Review Launch
_Added 2026-06-16 · ui, api, datamodel_
Lets the reviewer browse all saved reviews (`GET /api/reviews`), switch between them, delete one, or open a new PR/MR by reference — all from within the running UI instead of only via CLI args.

## Confirm Before Deleting Active Review
_Added 2026-06-16 · ui, api_
Requires an explicit confirmation before dismissing/deleting the currently active review from the UI, and falls back to the splash screen (rather than an error state) once cleared.

## CI: Lint, Test, and Coverage Reporting on PRs
_Added 2026-06-16 · infrastructure_
GitHub Actions workflow runs lint, build, and unit tests with coverage on every PR, reporting coverage results back to the PR.

## Automatic Semantic Versioning & npm Publish
_Added 2026-06-16 · infrastructure_
`semantic-release`, driven by conventional commit messages, cuts versions and publishes to npm automatically on merge to `main`, using npm trusted publishing (OIDC) rather than a static token.

## Light/Dark Theme
_Added 2026-06-22 · ui_
Persisted dark/light theme toggle implemented entirely via CSS custom properties (no `tailwind.config.js`), with theme-aware logo/icon assets.

## Jira Configuration Wizard
_Added 2026-06-22 · infrastructure, ui_
Interactive `assisted-review configure` CLI wizard (`src/setup-jira.ts`) populates Jira env vars, paired with a `GET /api/config` preload-behavior endpoint so the frontend can pick up config without a restart.

## Secret Resolution via 1Password / Env / Command Reference
_Added 2026-06-22 · infrastructure_
`JIRA_TOKEN` (and potentially other secrets) can be specified as an `op://vault/item/field` reference (via the `op` CLI), an `env:VAR_NAME` indirection, or a `cmd:<shell command>`, rather than only a raw value.

## Settings Panel (Theme & Preload Tuning)
_Added 2026-06-23 · ui, api_
In-app settings panel exposing the theme toggle and preload behavior (chunk count, overview on/off), persisted to `localStorage` layered over the server-provided default.

## Background Chunk/Overview Preloading
_Added 2026-06-23 · ui, infrastructure_
Silently preloads AI commentary for upcoming chunks (and optionally the overview) ahead of the reviewer reaching them, configurable via `PRELOAD_CHUNKS`/`PRELOAD_OVERVIEW` and the Settings panel, without surfacing preload errors to the user.

## Playwright E2E Smoke Tests in CI
_Added 2026-06-24 · infrastructure_
A separate CI job builds the app and runs a Playwright browser smoke test against it on every PR, in addition to the unit-test suite.

## Husky Pre-Commit Hook (Lint + Test)
_Added 2026-06-26 · infrastructure_
A local pre-commit git hook runs lint and tests before allowing a commit, catching failures before they reach CI.

## GitLab MR Review Support
_Added 2026-06-26 · infrastructure, api, datamodel_
Extends the whole review workflow (fetch, diff parsing, comment/discussion posting, verdict submission) to GitLab merge requests, parallel to the existing GitHub path, identified by a `platform` field on `PrRef`.

## GitLab `glab`-vs-REST Transport with Automatic Fallback
_Added 2026-06-26 · infrastructure_
Detects whether the `glab` CLI is available and transparently falls back to calling the GitLab REST API directly (via `GITLAB_TOKEN`/`GITLAB_HOST`) when it isn't — both paths normalize to the same shape, invisible to callers.

## GitLab Diff Reconstruction (REST Fallback)
_Added 2026-06-26 · infrastructure_
Synthesizes the `---`/`+++` marker lines the shared diff parser expects from GitLab's REST `/diffs` response (which omits them), so the REST fallback path can reuse the same `parse-diff.ts` as every other source.

## Empty-State Message for Zero-Chunk Reviews
_Added 2026-07-01 · ui_
When a PR/MR has no reviewable chunks (e.g. a diff-less or fully-binary-file change), the overview page shows a "No reviewable changes" message instead of a dead "Begin Review" button that would silently no-op.

## OS-Aware Keyboard Hints
_Slug: `os-aware-keyboard-hints` · Status: implemented · Logged 2026-07-01 · Plan: plan-refactpr-2026-07-02.md · Tasks: tasks-refactpr-779d.md_
Replace `navigator.userAgent` sniffing for Mac/Windows keyboard-hint glyphs (⌘ vs Ctrl, in the Help overlay and response bar) with a more robust OS-detection mechanism (e.g. `navigator.userAgentData` where available, with graceful fallback), so labels are less likely to mislabel on spoofed/frozen UA strings.
Why: flagged as a low-stakes but fragile pattern during `/ardd-critique` (`critique.md`) — worth fixing properly rather than leaving as an accepted risk indefinitely.
