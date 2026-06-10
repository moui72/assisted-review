# Changelog

All notable changes to this project are recorded here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/). The project is pre-1.0 and has not
been released, so everything currently lives under _Unreleased_.

See [ROADMAP.md](./ROADMAP.md) for what's planned next.

## [Unreleased]

### Added

- **Core viewer.** Fetch a PR with `gh`, parse the diff into grouped hunks, and serve
  a focused, paginated localhost UI — one chunk per page (less scrolling), with
  syntax highlighting (highlight.js, including a custom Terraform/HCL grammar).
- **Inline commenting + persisted state.** Click a line to anchor a draft comment;
  flagged / viewed / comment state persists to `~/.pr-review/<owner>-<repo>-<n>.json`
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
