# Roadmap

A scratch list of future dev ideas. Throw anything here — no commitment implied.

## Planned slices

- ~~**Slice 2 — commenting + state.**~~ ✅ Done. Click a line to anchor an inline
  comment; flag/viewed/comments persist to `~/.pr-review/<owner>-<repo>-<n>.json` via
  `POST /api/action` and resume on restart. _Later:_ inline comment editing UI
  (`update_comment` already exists on the backend), comment ranges, reply to threads.
- ~~**Slice 3 — Claude bridge.**~~ ✅ Done. `GET /api/claude` (SSE) spawns headless
  `claude -p --output-format stream-json`, streams token deltas to the AI panel, and
  persists the note to state on completion. Ask a free-text question (investigation)
  or empty = "explain this chunk" (initial). _Currently diff-grounded with tools
  disabled; later:_ optional `--repo <path>` mode to enable read-only Read/Grep/Glob
  for cross-file investigation; model selection; regenerate/stop controls.
- **Slice 4 — submit.** Publish the review to GitHub (replies-first + review payload),
  wrapping the existing `submit-review.sh` flow. `POST /api/submit`.

## Done (not originally numbered)

- ~~**Overview page.**~~ ✅ A first page before the chunks: whole-PR AI summary
  (streamed via `__overview__`), the PR description, and Jira story + epic context
  pulled straight from the REST API via env vars (`JIRA_BASE_URL`/`JIRA_USER`/`JIRA_TOKEN`);
  shows a setup-hint banner when unconfigured. _Later:_ richer markdown rendering of
  the PR description; smarter selection of which referenced issue is "primary".

## UI / UX

- **Light / dark mode** — configurable theme toggle (and respect `prefers-color-scheme`).
- **Customizable fonts & colors** — user-configurable typography (the three Plex
  "voices") and the full color palette. All theme values already flow through CSS
  vars (`@theme inline` + `:root`), so this is wiring up a settings UI / config file,
  not a refactor. Syntax-highlight token colors are part of this.
- **Meaningful tick states (colorblind-safe).** Encode each top-strip tick with
  both color AND texture so state is legible without relying on hue, plus a hover
  tooltip explaining the grammar:
  - grey / solid → unviewed (no response)
  - green / vertical lines → viewed
  - purple / angled lines (hatched) → commented
  - orange / checkered → flagged
- Customizable syntax highlighting styles — selectable themes (e.g. a theme
  picker / config), ideally pairing with the light/dark mode setting.
- **Split chunk on demand (à la `git add -p` `s`).** While viewing a chunk, let the
  user break it into smaller chunks at unchanged-line boundaries — the inverse of the
  parser's adjacency grouping (`--group-gap`). Useful when a grouped chunk bundles
  unrelated changes the reviewer wants to respond to separately. Re-splits the queue
  in place; comments/state already taken on the chunk should migrate to the right
  sub-chunk.
- Side-by-side diff view option (currently unified).
- Keyboard navigation (next/prev chunk, jump to file).
- Collapse/expand by file.
- **Hamburger → file-tree view of chunks.** A toggle that opens a file-tree
  overview (chunks grouped under their file paths) for jump-to navigation, without
  a permanent sidebar cluttering the focused view.

## Ideas / backlog

- Smart chunk clustering -- bring related code from across different files together into one chunk view (needs AI to decide how to group things)
- Preload ai commentary -- summary on initial startup, chunks 1 or 2 ahead (and when focused if jumped to)
- Make preload configurable -- N chunks ahead, or always on-demand (N=0). Separately, whether to preload summary or not

