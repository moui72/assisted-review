<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="web/public/logo-dark.svg" />
    <img alt="assisted-review" src="web/public/logo.svg" width="440" />
  </picture>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/assisted-review">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/npm/assisted-review.svg?variant=secondary&mode=dark" />
      <img alt="npm version" src="https://shieldcn.dev/npm/assisted-review.svg?variant=secondary&mode=light" />
    </picture>
  </a>
  <a href="https://www.npmjs.com/package/assisted-review">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/npm/dt/assisted-review.svg?variant=secondary&mode=dark" />
      <img alt="npm downloads" src="https://shieldcn.dev/npm/dt/assisted-review.svg?variant=secondary&mode=light" />
    </picture>
  </a>
  <a href="https://github.com/moui72/assisted-review/releases">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/release/moui72/assisted-review.svg?variant=secondary&mode=dark" />
      <img alt="latest release" src="https://shieldcn.dev/github/release/moui72/assisted-review.svg?variant=secondary&mode=light" />
    </picture>
  </a>
  <!-- ardd-badge-start -->
  <a href="https://github.com/moui72/artifact-driven-dev"><img alt="built with ARDD" src="https://shieldcn.dev/badge/built%20with-ARDD-blue.svg?variant=branded" /></a>
  <!-- ardd-badge-end -->
</p>

## What is assisted-review?

Reviewing a large pull request in the standard GitHub or GitLab UI means
scrolling one enormous wall of diff: no focus, no pacing, and nothing tracking
what you've actually looked at. Context gets lost, subtle bugs slip through,
and the temptation to skim grows with every file.

assisted-review is a standalone CLI that fetches a GitHub PR or GitLab MR and
serves a focused, keyboard-driven browser UI for walking it **one chunk at a
time**. Each chunk — adjacent hunks from the same file, merged when the gap
between them is small — gets its own page, with Claude-generated commentary
alongside it. You can ask Claude follow-up questions, flag chunks, draft
inline comments, and finally publish everything back to GitHub/GitLab as a
real review. Progress persists to disk, so a half-finished review resumes
exactly where you left off.

You stay in control. Claude assists — it never decides or auto-posts anything.

Everything runs on your machine: the diff is fetched with `gh`/`glab`, the
server binds to `127.0.0.1` only, and AI commentary streams from a headless
`claude` subprocess. No hosted backend, no account. Nothing leaves your
machine except the comments you explicitly choose to submit.

> Status: young but moving fast — see the [changelog](./CHANGELOG.md) for
> what's shipped and the [roadmap](./ROADMAP.md) for what's planned.

## Requirements

- Node >= 20.18
- [`gh`](https://cli.github.com/) authenticated (`gh auth status`) — for GitHub PRs
- [`claude`](https://claude.com/claude-code) CLI on `PATH` — for AI commentary (optional; its absence disables only that feature)
- For GitLab MRs (optional): [`glab`](https://gitlab.com/gitlab-org/cli) authenticated, **or** a GitLab personal access token — assisted-review falls back to the GitLab REST API when `glab` isn't available, using `GITLAB_TOKEN` or a token entered in the browser UI
- [pnpm](https://pnpm.io) — only for working on the project, not for the global install

## Install

### Global install

Install from npm. No clone or pnpm required.

```bash
npm i -g assisted-review
assisted-review <owner/repo#N | PR URL>
```

To update: `npm update -g assisted-review`. To remove:
`npm uninstall -g assisted-review`. The CLI also checks the npm registry in
the background on startup (at most once per 24h) and prints a one-line notice
when a newer version is out — disable with `ASSISTED_REVIEW_NO_UPDATE_CHECK`.

### From a checkout

```bash
pnpm install
pnpm build                            # compile server + bundle UI
pnpm cli <owner/repo#N | PR URL>      # fetch, serve, open the browser
```

## Usage

```bash
assisted-review [<ref>]
```

With no ref, the server starts on a splash screen where you can type or paste
one. Accepted ref formats:

- `owner/repo#123` or a full GitHub PR URL
- `namespace/repo!123` or a full GitLab MR URL (`namespace` may contain
  slashes for subgroups)

You can also open and switch reviews from inside the UI — the Reviews menu
lists every saved review with its progress, and lets you open a new ref
without restarting the CLI.

### Flags

| Flag | Effect |
|---|---|
| `--no-open` | Don't open the browser automatically |
| `--api-only` | Serve only the API (pair with `pnpm dev:web`) |
| `--port <n>` | Listen port (default 4319) |
| `--mock-ai` | Fill chunks with placeholder commentary (offline use) |

There is also a subcommand: `assisted-review configure` runs an interactive
wizard that writes the Jira credentials described below.

### Keyboard shortcuts

The UI is built keyboard-first. Press `?` in the app for the same reference.

| Key | Action |
|---|---|
| `→` / `j` / `n` | Next chunk |
| `←` / `k` / `p` | Previous chunk |
| `⌘→` / `⌘←` (Ctrl on Win/Linux) | Next / previous unviewed chunk |
| `↵` | Mark viewed and advance |
| `esc` | Mark unread |
| `f` | Flag chunk |
| `c` | Comment |
| `a` | Ask Claude |
| `?` | Show help |

Plain letters only fire without a modifier, so browser combos like `⌘C`,
`⌘F`, and `⌘A` keep working.

## AI commentary

Each chunk (and the PR overview) gets Claude commentary streamed live into a
sidebar. Ask follow-up questions and the conversation threads — prior notes
for the same chunk are passed back as context. Upcoming chunks are preloaded
quietly in the background (`PRELOAD_CHUNKS`, default 1) so commentary is
usually already there when you arrive.

Claude runs as a headless subprocess with shell, write, and web access
disabled — by default it sees only the diff text. If you want deeper answers,
Settings offers a per-repo **investigation access** choice (persisted, asked
at most once per repo):

| Mode | What Claude can see |
|---|---|
| None (default) | The diff text only; no tools |
| Local path | Read-only `Read`/`Grep`/`Glob` in a checkout you point it at |
| API | Full contents of files touched by the diff, fetched at the PR's head SHA — changed files only, not the whole repo |
| Temp clone | A fresh clone (via `gh`/`glab`), read-only, deleted when the review closes |
| Always clone | A persistent clone kept in the state dir, refreshed to the PR's head SHA per use and pruned after 30 idle days |

Every mode is strictly read-only — `Bash`, `Edit`, `Write`, and web tools are
always disallowed.

## Submitting

When you're done, hit **Submit** in the top bar: pick a verdict, add an
optional summary, and your drafted line comments go out with it. Whole-chunk
comments anchor to the chunk's last changed line.

- **GitHub**: the entire review (verdict, summary, inline comments) posts as
  a single PR review via `gh api` — atomic, one request.
- **GitLab**: there's no single-request review, so each inline comment posts
  as its own discussion, then a summary note, then an optional approve.
  Transient failures are retried; if a comment still fails, the note/approve
  are withheld, the partial progress is persisted, and retrying the
  submission skips whatever already posted instead of duplicating it.

If the PR/MR was force-pushed since you started, submission is blocked with a
stale-SHA warning rather than posting mis-anchored comments — re-fetch to
re-anchor. Relatedly, reopening a review whose diff changed shape marks any
now-orphaned comments as **displaced** (surfaced on the overview page) so you
can re-anchor them by hand instead of losing them or having them silently
attach to the wrong chunk.

## Configuration

Variables are read from the environment with the first match winning:

1. Real environment variables (always win)
2. `$DOTENV_CONFIG_PATH`, if set
3. `./.env` in the current directory (useful in a checkout — copy `.env.example`)
4. `~/.assisted-review/.env` (user-global; use this for a global install)

All `.env` files are gitignored. You can also pass values inline for a
one-off run: `GITLAB_TOKEN=<token> assisted-review namespace/repo!123`.

### GitLab (optional)

GitHub PRs work out of the box via `gh`. For GitLab MRs, any one of these
works, in priority order:

1. `glab` authenticated (`glab auth status`) — if installed, every GitLab
   call goes through it and takes precedence over a stored token
2. A token entered in the browser — when a GitLab ref needs auth and `glab`
   isn't available, the UI prompts for a personal access token and persists
   it (mode `0600`) in the state directory
3. `GITLAB_TOKEN` in the environment — used by the REST fallback when
   neither of the above is available

| Variable | Description |
|---|---|
| `GITLAB_TOKEN` | Personal/project access token with API scope, used by the REST fallback when `glab` isn't available |
| `GITLAB_HOST` | Self-hosted GitLab instance (default: `gitlab.com`) |

### Jira (optional)

With Jira credentials configured, the overview page pulls the PR's referenced
story and epic (issue keys are detected in the title, branch name, and
description). Without them, it shows a setup banner instead — Jira is an
enrichment, never a blocker. `assisted-review configure` sets these up
interactively.

| Variable | Required | Description |
|---|---|---|
| `JIRA_BASE_URL` | Yes | Base URL of your Jira instance, e.g. `https://your-org.atlassian.net` |
| `JIRA_USER` | Yes | Your Jira account email |
| `JIRA_TOKEN` | Yes | Jira API token — a raw value, or a reference: `op://vault/item/field` (1Password CLI), `env:VAR_NAME`, or `cmd:<command>` |
| `JIRA_EPIC_FIELD` | No | Epic-Link custom field ID (default: `customfield_10008`) |

**Example `~/.assisted-review/.env`:**

```ini
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_USER=you@example.com
JIRA_TOKEN=op://Private/Jira/api-token
# JIRA_EPIC_FIELD=customfield_10008
```

### State directory

Review state (comments, flags, viewed markers, AI notes — one JSON file per
PR/MR) lives in `~/.assisted-review/` by default. Override with:

```bash
ASSISTED_REVIEW_STATE_DIR=/path/to/state
```

### Other environment variables

| Variable | Description |
|---|---|
| `PR_REF` | Default ref to open, used by `pnpm dev` |
| `PRELOAD_CHUNKS` | How many upcoming chunks to silently preload AI commentary for (default: `1`) |
| `PRELOAD_OVERVIEW` | Preload the overview's AI summary too (default: `true`) |
| `ASSISTED_REVIEW_NO_UPDATE_CHECK` | Skip the background npm-registry version check on startup |

## Appearance

Settings offers two independent appearance axes, both persisted in the
browser: a **palette** (Blueprint, Paper & Ink, Neon Noir, Mono Brutalist,
Aubergine) and a light/dark **mode** — every palette defines both modes, so
they compose freely. Syntax-highlighting colors travel with the palette.

## Architecture

The short version: `src/` is a strict-TypeScript ESM backend — a CLI that
fetches and chunks the diff, then a localhost-only Node `http` server exposing
a small REST + SSE API; `web/` is a Vite + React 19 + Tailwind v4 single-page
app served by that same server. External tools (`gh`, `glab`, `claude`, `op`)
are always subprocesses, never vendored SDKs.

The full write-up — module map, data model, infrastructure, and UI diagrams —
lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (kept out of this
README so it renders cleanly on npm).

## Contributing

### Dev setup

```bash
pnpm install
pnpm dev        # API server on :4319 + Vite HMR on :5173
```

Open `http://localhost:5173` for the live-reloading UI. Set a default PR with
`PR_REF=owner/repo#N` in `.env` (copy `.env.example`).

### Scripts

| Script | What it does |
|---|---|
| `dev` | Starts the API server and Vite HMR server concurrently |
| `dev:web` | Starts only the Vite HMR server — pair with `--api-only` (below) |
| `build` | Compiles TypeScript (server → `build/`) and bundles the UI (→ `dist/`) |
| `build:web` | Builds only the React UI with Vite |
| `test` | Runs Vitest unit tests |
| `test:e2e` | Runs the Playwright end-to-end smoke test (requires a prior `pnpm build`) |
| `test:watch` | Runs Vitest in watch mode |
| `lint` | Runs ESLint |
| `format` | Runs Prettier |

### Adding a language

Syntax highlighting is registered in `web/src/highlight.ts`. Import the
language grammar from `highlight.js` there and add it to the
`hljs.registerLanguage` calls.

### PRs welcome

Open a PR against `main`. CI runs lint, build, tests (backend coverage is
gated at 90%), and a Playwright smoke test on every PR; releases are cut
automatically by semantic-release from conventional commits. Please keep
commits focused and include tests for new behavior where applicable.
