# [1.3.0](https://github.com/moui72/assisted-review/compare/v1.2.1...v1.3.0) (2026-06-24)


### Features

* add Playwright e2e smoke test and build check to CI ([#45](https://github.com/moui72/assisted-review/issues/45)) ([a808730](https://github.com/moui72/assisted-review/commit/a808730c9dccac5c21b5f846c0c4d93d1879a338))

## [1.2.1](https://github.com/moui72/assisted-review/compare/v1.2.0...v1.2.1) (2026-06-24)


### Bug Fixes

* destructure onOpenSettings prop in TopNav ([#44](https://github.com/moui72/assisted-review/issues/44)) ([f375f10](https://github.com/moui72/assisted-review/commit/f375f10e13b65b4ea761df838fd4a4116e5d061a))

# [1.2.0](https://github.com/moui72/assisted-review/compare/v1.1.0...v1.2.0) (2026-06-23)


### Features

* TopNav logo fix, settings panel, Jira config, and test coverage ([#42](https://github.com/moui72/assisted-review/issues/42)) ([3104b4a](https://github.com/moui72/assisted-review/commit/3104b4a3609f05e17ff3fd79310f8add17e03101))

# [1.1.0](https://github.com/moui72/assisted-review/compare/v1.0.1...v1.1.0) (2026-06-22)


### Features

* Jira configure wizard + preload config endpoint ([#41](https://github.com/moui72/assisted-review/issues/41)) ([87cfcdd](https://github.com/moui72/assisted-review/commit/87cfcdd84fa310febb3948b22caeee90493e7cfc))

## [1.0.1](https://github.com/moui72/assisted-review/compare/v1.0.0...v1.0.1) (2026-06-22)


### Bug Fixes

* use icon variant of logo in TopNav for legibility ([#40](https://github.com/moui72/assisted-review/issues/40)) ([e1e1524](https://github.com/moui72/assisted-review/commit/e1e15242f859fbad4cf8dde97600b036e9f5b80a))

# 1.0.0 (2026-06-22)


### Bug Fixes

* address review feedback on PR [#11](https://github.com/moui72/assisted-review/issues/11) ([089afe1](https://github.com/moui72/assisted-review/commit/089afe14a1c88042b1288bed372189deb23cc7b7))
* invoke tsc and vite via node path, not bin symlinks ([d40801f](https://github.com/moui72/assisted-review/commit/d40801f2770f9f30217d82440775c2d09c3e78f3))
* replace `as any` casts with typed mock helpers ([d58373d](https://github.com/moui72/assisted-review/commit/d58373db74bb7a9120c68e3f03d05da1de97889b))
* switch-then-delete when dismissing the active review ([5849aaf](https://github.com/moui72/assisted-review/commit/5849aaf662b8d6fa76ce92e38689d91585787c57))
* use npm trusted publishing (OIDC, no token) ([4aa1ef8](https://github.com/moui72/assisted-review/commit/4aa1ef82a7ab91848407a12b2de9e0b6d07fbbe8))
* use npx --no-install in build scripts so npm git-URL installs work ([ab6a3a5](https://github.com/moui72/assisted-review/commit/ab6a3a57a32baf51422bb6ec46c078b69c87a50f))


### Features

* automatic semantic versioning via semantic-release ([fa7d6bc](https://github.com/moui72/assisted-review/commit/fa7d6bce6aca6e9b5c14d1d055f824b8aa72dd0a))
* confirm before deleting active review, allow clearing to splash ([8335dfa](https://github.com/moui72/assisted-review/commit/8335dfa69d37f5a0ce463beeaafef8e4d10b952f))
* new readme logo ([25d77db](https://github.com/moui72/assisted-review/commit/25d77dbf166f8036ad4773015d6bdf72c83c49c8))
* pixel-art logo + light mode ([#37](https://github.com/moui72/assisted-review/issues/37)) ([e8629b2](https://github.com/moui72/assisted-review/commit/e8629b257d20c1a954ec4dab1c1b979edcaf164c)), closes [#f5f1e6](https://github.com/moui72/assisted-review/issues/f5f1e6) [#39454f](https://github.com/moui72/assisted-review/issues/39454f)
* publish to npm on merge to main ([af306b5](https://github.com/moui72/assisted-review/commit/af306b5e5047d8c60ca1f572f4a04d6527d9013e))
* review picker + launch new reviews from UI ([c30b308](https://github.com/moui72/assisted-review/commit/c30b308e887f0b2354a4569d658705e8bc2291ee)), closes [owner/repo#N](https://github.com/owner/repo/issues/N)

# Changelog

All notable changes to this project are recorded here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/). The project is pre-1.0 and has not
been released, so everything currently lives under _Unreleased_.

See [ROADMAP.md](./ROADMAP.md) for what's planned next.

## [Unreleased]

### Added

- **Review picker & launch from UI.** A "Reviews" button in the top-nav opens a
  modal that lists all saved reviews (showing PR title, ref, and progress at a
  glance), lets you switch to any of them without restarting the server, dismiss
  (delete) ones you no longer want, and open a brand-new review by pasting an
  `owner/repo#N` ref or PR URL. PR metadata is now cached in the state file so
  titles are available without re-fetching. Switching cancels any in-flight Claude
  stream to prevent stale notes from landing in the wrong review's state.
- **Global install.** Packaged for `npm i -g github:moui72/assisted-review`: a
  `prepare` hook builds the server + UI on install, `files` ships `build/` + `dist/`,
  and the `build` script is package-manager-agnostic so the install doesn't require
  pnpm. `npm pack --dry-run` confirms `.env` never enters the tarball.
- **Core viewer.** Fetch a PR with `gh`, parse the diff into grouped hunks, and serve
  a focused, paginated localhost UI — one chunk per page (less scrolling), with
  syntax highlighting (highlight.js, including a custom Terraform/HCL grammar).
- **Inline commenting + persisted state.** Click a line to anchor a draft comment;
  flagged / viewed / comment state persists to `~/.assisted-review/<owner>-<repo>-<n>.json`
  via `POST /api/action` and resumes on restart. Whole-chunk comments are supported
  when no line is anchored.
- **Claude bridge.** `GET /api/claude` (SSE) spawns headless
  `claude -p --output-format stream-json` and streams token deltas to the AI panel,
  persisting the note to state on completion. Ask a free-text question (investigation)
  or leave it empty to get an "explain this chunk" summary; each initial chunk note
  also surfaces a **suggested action**. Diff-grounded with tools disabled.
- **Overview page.** A first page before the chunks: a streamed whole-PR AI summary,
  the GH PR description (collapsible, rendered as markdown), and Jira story + epic
  context pulled straight from the REST API. Jira is configured purely via env vars
  (`JIRA_BASE_URL` / `JIRA_USER` / `JIRA_TOKEN`); a setup-hint banner shows when it's
  unconfigured.
- **Submit to GitHub.** `POST /api/submit` assembles the drafted comments into a
  single PR review and posts it via `gh api`. Includes verdict selection
  (Approve / Comment / Request changes), an optional summary, a stale-SHA pre-flight
  (blocks rather than mis-anchoring after a force-push), and a submit modal that
  reports success / stale / error states.
- **Keyboard-driven navigation.** Paginated next/prev, jump to next/prev _unread_
  (skipping viewed), mark viewed-and-advance, mark unread, flag, focus comment, ask
  Claude, and a help overlay (`?`). Top-strip ticks are colored by state
  (unviewed / viewed / commented / flagged) and clickable.

### Changed

- **Overview layout polish.** Renamed the description section to "GH PR description",
  enlarged the disclosure chevron, made the Jira section collapsible (open by
  default), and dropped the ticket body from Jira story cards (key/type/status +
  summary only).
- **`.env` loading via dotenv.** Replaced a hand-rolled parser with `dotenv` so the
  `.env` file is honored whether the tool runs from source, a build, or an installed
  `bin`. Inline `FOO=bar` still wins; a missing `.env` is a no-op.
- **Cwd-independent config discovery.** `.env` is now resolved from a precedence
  chain (`$DOTENV_CONFIG_PATH` → `./.env` → `~/.assisted-review/.env`) instead of the
  current directory only, so a global install finds credentials regardless of where
  `assisted-review` is invoked.
- **Dependency diet.** Only `dotenv` remains a runtime dependency; the web libraries
  (react, motion, highlight.js, react-markdown, remark-gfm, @fontsource) moved to
  `devDependencies` since vite bundles them into `dist/` at build time.
