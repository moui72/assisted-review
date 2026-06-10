# Roadmap

Future ideas — no commitment implied. Add freely. For what's already shipped, see
[CHANGELOG.md](./CHANGELOG.md).

Each item is a one-line summary followed by detail. Roughly grouped by area.

## Theming & appearance

- **Light / dark mode.** A configurable theme toggle that also respects
  `prefers-color-scheme`.
- **Customizable fonts & colors.** User-configurable typography (the three Plex
  "voices") and the full color palette. Theme values already flow through CSS vars
  (`@theme inline` + `:root`), so this is a settings UI / config file, not a refactor.
- **Customizable syntax-highlighting themes.** A selectable highlight theme (picker
  or config), ideally pairing with the light/dark setting. Token colors are part of
  the broader theming work above.

## Navigation & layout

- **Colorblind-safe tick states.** Encode each top-strip tick with both color _and_
  texture so state is legible without relying on hue, plus a hover tooltip explaining
  the grammar:
  - grey / solid → unviewed
  - green / vertical lines → viewed
  - purple / angled lines (hatched) → commented
  - orange / checkered → flagged
- **Hamburger → file-tree view.** A toggle that opens a file-tree overview (chunks
  grouped under their file paths) for jump-to navigation, without a permanent sidebar
  cluttering the focused view.
- **Side-by-side diff view.** An alternative to the current unified view.
- **Collapse / expand by file.**

## Review workflow

- **Split chunk on demand (à la `git add -p` `s`).** While viewing a chunk, let the
  user break it into smaller chunks at unchanged-line boundaries — the inverse of the
  parser's adjacency grouping (`--group-gap`). Useful when a grouped chunk bundles
  unrelated changes. Re-splits the queue in place; existing comments/state should
  migrate to the right sub-chunk.
- **Smart chunk clustering.** Bring related code from across different files together
  into one chunk view — the cross-file counterpart to splitting. Needs AI to decide
  how to group things.
- **Inline comment editing UI.** Surface the existing `update_comment` backend action
  in the UI.
- **Comment ranges & thread replies.** Multi-line comment anchors, and replying to
  existing review threads on submit.

## Claude / AI

- **Repo-aware investigation mode.** An optional `--repo <path>` mode that enables
  read-only Read/Grep/Glob so Claude can investigate cross-file context (currently
  diff-grounded with tools disabled).
- **Preload AI commentary.** Generate the overview summary on startup and the next
  chunk or two ahead of the reviewer (and on focus when they jump), so commentary is
  already waiting instead of streaming on arrival.
- **Configurable preloading.** How far to preload — N chunks ahead, or always
  on-demand (N=0) — and, separately, whether to preload the overview summary at all.
- **Model selection.** Choose the Claude model used for commentary.
- **Regenerate / stop controls.** Stop a stream in flight; regenerate a note.
- **Smarter primary-issue selection.** When a PR references multiple Jira issues,
  pick the most relevant one as primary for the overview.

## Backlog / ideas

- Smart chunk clustering -- bring related code from across different files together into one chunk view (needs AI to decide how to group things)
- Preload ai commentary -- summary on initial startup, chunks 1 or 2 ahead (and when focused if jumped to)
- Make preload configurable -- N chunks ahead, or always on-demand (N=0). Separately, whether to preload summary or not

