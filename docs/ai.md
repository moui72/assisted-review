# AI commentary

Each chunk (and the PR overview) gets AI commentary streamed live into a
sidebar. The AI is an assistant only — it never decides anything and never
posts anything on your behalf.

## Providers and models

Settings lets you choose the AI provider — **Claude**
([`claude`](https://claude.com/claude-code) CLI) or **Codex** (`codex` CLI) —
and an optional provider-specific model. A missing model value uses that
CLI's default model; existing installs continue to default to Claude until
changed. Either CLI just needs to be on `PATH`; the absence of one disables
only that provider.

The provider runs as a **headless local subprocess with write and network
access disabled** — by default it sees only the diff text.

Offline or CLI-less? `assisted-review --mock-ai` fills chunks with
placeholder commentary so the rest of the UI still works.

## Asking follow-up questions

Press ++a++ on any chunk to ask a question. The conversation threads: prior
notes for the same chunk are passed back as context. One stream runs at a
time; you can stop a stream mid-flight and regenerate a chunk's initial note
if you want a fresh take.

Notes come in four kinds — `initial` (the automatic commentary),
`investigation` (answers to your questions), `context`, and `error` — and
all of them persist with the review state, so they're still there when you
resume.

## Preloading

Upcoming chunks are preloaded quietly in the background so commentary is
usually already there when you arrive. Tune it in Settings (0–3 chunks
ahead, plus whether to preload the overview summary) or via environment
variables:

| Variable | Default | Effect |
|---|---|---|
| `PRELOAD_CHUNKS` | `1` | How many upcoming chunks to preload |
| `PRELOAD_OVERVIEW` | `true` | Preload the overview's AI summary |

## Investigation access

By default the AI sees only the diff text and has no tools. If you want
deeper answers, Settings offers a per-repo **investigation access** choice
(persisted, asked at most once per repo):

| Mode | What the AI provider can see |
|---|---|
| **None** (default) | The diff text only; no tools |
| **Local path** | Read-only `Read`/`Grep`/`Glob` in a checkout you point it at |
| **API** | Full contents of files touched by the diff, fetched at the PR's head SHA — changed files only, not the whole repo |
| **Temp clone** | A fresh clone (via `gh`/`glab`), read-only, deleted when the review closes |
| **Always clone** | A persistent clone kept in the state dir, refreshed to the PR's head SHA per use and pruned after 30 idle days |

Every mode is strictly read-only — `Bash`, `Edit`, `Write`, and web tools
are always disallowed.

!!! info "Privacy"
    Nothing leaves your machine except whatever your selected provider CLI
    sends to its own backend, and the comments you explicitly submit.
