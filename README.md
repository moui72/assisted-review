<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="web/public/logo-dark.svg" />
    <img alt="assisted-review" src="web/public/logo.svg" width="440" />
  </picture>
</p>

A local, browser-based tool for working through a GitHub pull request **one hunk at a time** — with Claude commentary, line-anchored draft comments, and Jira context. You are the reviewer; Claude assists.

It's a standalone CLI: it fetches a PR with `gh`, parses the diff into chunks, and serves a focused, paginated React UI from a localhost-only server. AI commentary streams from headless **Claude Code**; review state persists to disk so you can resume.

> Status: early / in-progress — see the [changelog](./CHANGELOG.md) for what's shipped and the [roadmap](./ROADMAP.md) for what's planned.

## Requirements

- Node ≥ 20.18
- [`gh`](https://cli.github.com/) authenticated (`gh auth status`)
- [`claude`](https://claude.com/claude-code) CLI on `PATH` (for AI commentary)
- [pnpm](https://pnpm.io) — only for working on the project (not for the global install)

## Install

Install it globally straight from GitHub (builds on install — no clone, no pnpm needed):

```bash
npm i -g github:moui72/assisted-review
assisted-review <owner/repo#N | PR URL>     # fetch, serve, open the browser
```

Drop your Jira credentials once in `~/.assisted-review/.env` (see [Jira context](#jira-context-optional))
and they're picked up no matter which directory you run `assisted-review` from. To update later,
re-run the same `npm i -g …`; to remove, `npm uninstall -g assisted-review`.

> The install builds itself from source, which needs the dev toolchain (`vite`, `tsc`)
> — npm installs those automatically for the build and prunes them afterward. If you've
> globally set `npm config set omit=dev`, that build step can't fetch them and the
> install fails with e.g. `vite: not found`; install with `npm i -g --include=dev github:…`
> in that case.

## Quick start (from a checkout)

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

The overview page pulls the referenced story + epic from the Jira REST API when these env vars are set; otherwise it shows a setup banner.

These three keys are read from the environment, with the first match winning:

1. real environment variables (always win)
2. `$DOTENV_CONFIG_PATH`, if set
3. `./.env` in the current directory (handy in a checkout — copy `.env.example`)
4. `~/.assisted-review/.env` (user-global; **use this for a global install**)

```ini
# ~/.assisted-review/.env  (or ./.env in a checkout)
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_USER=you@example.com
JIRA_TOKEN=<api-token>
```

…or pass them inline: `JIRA_BASE_URL=… JIRA_USER=… JIRA_TOKEN=… assisted-review <PR>`.

Optional: `JIRA_EPIC_FIELD` (Epic-Link custom field; default `customfield_10008`). All
`.env` files are gitignored.

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
  state.ts      persisted review state (~/.assisted-review/<owner>-<repo>-<n>.json)
  claude.ts     headless Claude bridge (stream-json)
  submit.ts     publish drafted comments as a real PR review via `gh api`
  jira.ts       Jira REST fetch (env-configured)
web/         Vite + React + Tailwind UI → builds into dist/, served by the server
```

State lives in `~/.assisted-review/` (override with `ASSISTED_REVIEW_STATE_DIR`).
