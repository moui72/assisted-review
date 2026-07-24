# Getting started

## Requirements

- **Node >= 20.18**
- [`gh`](https://cli.github.com/) authenticated (`gh auth status`) — for
  GitHub PRs
- A local AI provider CLI on `PATH` for AI commentary:
  [`claude`](https://claude.com/claude-code) or `codex`. Optional — the
  absence of one disables only that provider
- For GitLab MRs (optional): [`glab`](https://gitlab.com/gitlab-org/cli)
  authenticated, **or** a GitLab personal access token — assisted-review
  falls back to the GitLab REST API when `glab` isn't available, using
  `GITLAB_TOKEN` or a token entered in the browser UI. See
  [GitLab configuration](gitlab.md)
- [pnpm](https://pnpm.io) — only for working on the project, not for the
  global install

## Install

### Global install (recommended)

Install from npm. No clone or pnpm required.

```bash
npm i -g assisted-review
assisted-review <owner/repo#N | PR URL>
```

- **Update:** `npm update -g assisted-review`
- **Remove:** `npm uninstall -g assisted-review`

Two release channels are published: `latest` (stable, the default) and
`beta` (prereleases cut from every push to `main`) — opt in with
`npm i -g assisted-review@beta`. See
[release channels](contributing.md#release-channels).

The CLI checks the npm registry in the background on startup (at most once
per 24h) and prints a one-line notice when a newer version is out — disable
with `ASSISTED_REVIEW_NO_UPDATE_CHECK`.

### From a checkout

```bash
pnpm install
pnpm build                            # compile server + bundle UI
pnpm cli <owner/repo#N | PR URL>      # fetch, serve, open the browser
```

## First run

```bash
assisted-review [<ref>]
```

With no ref, the server starts on a splash screen where you can type or paste
one. Accepted ref formats:

- `owner/repo#123` or a full GitHub PR URL
- `namespace/repo!123` or a full GitLab MR URL (`namespace` may contain
  slashes for subgroups)

You can also open and switch reviews from inside the UI — the **Reviews**
menu lists every saved review with its progress, and lets you open a new ref
without restarting the CLI.

## CLI flags

| Flag | Effect |
|---|---|
| `--no-open` | Don't open the browser automatically |
| `--api-only` | Serve only the API (pair with `pnpm dev:web`) |
| `--port <n>` | Listen port (default 4319) |
| `--mock-ai` | Fill chunks with placeholder commentary (offline use) |

There is also a subcommand: `assisted-review configure` runs an interactive
wizard that sets up the [Jira integration](jira.md).
