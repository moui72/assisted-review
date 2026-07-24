# CLI & environment configuration

## Where settings come from

Variables are read from the environment with the first match winning:

1. Real environment variables (always win)
2. `$DOTENV_CONFIG_PATH`, if set
3. `./.env` in the current directory (useful in a checkout — copy `.env.example`)
4. `~/.assisted-review/.env` (user-global; use this for a global install)

All `.env` files are gitignored. You can also pass values inline for a
one-off run:

```bash
GITLAB_TOKEN=<token> assisted-review namespace/repo!123
```

## Environment variables

| Variable | Description |
|---|---|
| `PR_REF` | Default ref to open, used by `pnpm dev` |
| `PRELOAD_CHUNKS` | Upcoming chunks to silently preload AI commentary for (default: `1`) |
| `PRELOAD_OVERVIEW` | Preload the overview's AI summary too (default: `true`) |
| `ASSISTED_REVIEW_STATE_DIR` | Override the state directory (default: `~/.assisted-review/`) |
| `ASSISTED_REVIEW_NO_UPDATE_CHECK` | Skip the background npm-registry version check on startup |
| `GITLAB_TOKEN` / `GITLAB_HOST` | See [GitLab](gitlab.md) |
| `JIRA_BASE_URL` / `JIRA_USER` / `JIRA_TOKEN` / `JIRA_EPIC_FIELD` | See [Jira](jira.md) |
| `DOTENV_CONFIG_PATH` | Explicit path to a `.env` file |

## State directory

Review state — comments, flags, viewed markers, AI notes; one JSON file per
PR/MR — lives in `~/.assisted-review/` by default:

```bash
ASSISTED_REVIEW_STATE_DIR=/path/to/state
```

The state dir also holds the user-global `.env`, the GitLab browser token
(mode `0600`), the per-repo investigation-access config, and any persistent
"always clone" checkouts.

## Appearance

Settings offers two independent appearance axes, both persisted in the
browser:

- A **palette**: Blueprint, Paper & Ink, Neon Noir, Mono Brutalist, or
  Aubergine
- A light/dark **mode**

Every palette defines both modes, so they compose freely.
Syntax-highlighting colors travel with the palette.
