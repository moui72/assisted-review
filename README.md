# code-review-assistant

A local, browser-based tool for working through a GitHub pull request **one hunk at a time** — with Claude commentary, line-anchored draft comments, and Jira context. You are the reviewer; Claude assists.

It's a standalone CLI: it fetches a PR with `gh`, parses the diff into chunks, and serves a focused, paginated React UI from a localhost-only server. AI commentary streams from headless **Claude Code**; review state persists to disk so you can resume.

> Status: early/in-progress. See [ROADMAP.md](./ROADMAP.md).

## Requirements

- Node ≥ 20.18, [pnpm](https://pnpm.io)
- [`gh`](https://cli.github.com/) authenticated (`gh auth status`)
- [`claude`](https://claude.com/claude-code) CLI on `PATH` (for AI commentary)

## Quick start

```bash
pnpm install
pnpm build:web                       # build the UI once (or use `pnpm dev` for HMR)
pnpm cli <owner/repo#N | PR URL>      # fetch, serve, open the browser
```

Example:

```bash
pnpm cli https://github.com/owner/repo/pull/123
```

### Flags

| Flag | Effect |
|---|---|
| `--no-open` | Don't open the browser |
| `--api-only` | Serve only the API (pair with `pnpm dev:web`) |
| `--mock-ai` | Fill chunks with placeholder commentary (offline) |
| `--port <n>` | Listen port (default 4319) |

## Jira context (optional)

The overview page pulls the referenced story + epic from the Jira REST API when these env vars are set; otherwise it shows a setup banner. Copy `.env.example` to `.env` (auto-loaded, gitignored) or pass them inline:

```bash
JIRA_BASE_URL=https://your-org.atlassian.net \
JIRA_USER=you@example.com \
JIRA_TOKEN=<api-token> \
  pnpm cli <PR>
```

Optional: `JIRA_EPIC_FIELD` (Epic-Link custom field; default `customfield_10008`).

## Submitting

When you're done, hit **Submit** in the top bar to publish to GitHub: pick a verdict
(Approve / Comment / Request changes), add an optional summary, and the drafted line
comments are posted as a single PR review via `gh api`. Whole-chunk comments anchor to
the chunk's last changed line. If the PR was force-pushed since you started (the head SHA
the comments were drafted against is gone), submission is blocked with a stale-SHA warning
rather than posting mis-anchored comments — re-fetch the PR to re-anchor.

## Keyboard shortcuts

`→`/`j` next · `←`/`k` prev · `⌘→`/`⌘←` (Ctrl on Win/Linux) next/prev **unread** · `↵` mark viewed + advance · `esc` mark unread · `f` flag · `c` comment · `a` ask Claude · `?` help

## Development

> **For live UI work, run `pnpm dev` and open the Vite server at `http://localhost:5173`** — it has hot-reload and proxies `/api` to the backend. `pnpm cli`/`pnpm start` serve the prebuilt `dist/` on `:4319` instead (no HMR; run `pnpm build:web` to pick up changes).

```bash
pnpm dev          # API server (:4319) + Vite HMR (:5173) — view :5173; set PR via PR_REF=owner/repo#N
pnpm test         # Jest unit tests
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm build        # tsc (server → build/) + vite (UI → dist/)
```

## Architecture

```
src/         TypeScript backend (CommonJS, ts-node)
  cli.ts        entry: parse ref → gh fetch → chunks → Jira → serve
  fetch.ts · parse-ref.ts · parse-diff.ts   diff/PR ingestion
  server.ts     localhost server: /api/review, /api/state, /api/action, /api/claude (SSE), /api/submit
  state.ts      persisted review state (~/.pr-review/<owner>-<repo>-<n>.json)
  claude.ts     headless Claude bridge (stream-json)
  submit.ts     publish drafted comments as a real PR review via `gh api`
  jira.ts       Jira REST fetch (env-configured)
web/         Vite + React + Tailwind UI → builds into dist/, served by the server
```

State lives in `~/.pr-review/` (override with `PR_REVIEW_STATE_DIR`).
