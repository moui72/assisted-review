# Roadmap

assisted-review releases continuously — small features ship as soon as they
land on `main` (see [CHANGELOG.md](./CHANGELOG.md) for the release history).
So this roadmap is a statement of direction, not a schedule: nothing below
has a date, and order within a section is not priority order.

Ideas are tracked in the per-feature register at
[`.project/features/`](./.project/features/) (the source of truth, mirrored
to GitHub issues) and move through statuses: `backlogged` → `planned` →
`tasked` → `implemented`.

## Planned

Accepted onto the roadmap, not yet scheduled or committed to.

### Review workflow

- **Comment ranges & thread replies** — multi-line comment anchors and
  replying to existing review threads on submit, instead of today's
  single-line-only drafts with no threading.
  ([#30](https://github.com/moui72/assisted-review/issues/30))
- **Split chunk on demand** — break an already-grouped chunk into smaller
  chunks at unchanged-line boundaries while reviewing, migrating existing
  comments/state to the right sub-chunk — the inverse of the parser's
  adjacency grouping.
  ([#27](https://github.com/moui72/assisted-review/issues/27))
- **Smart chunk clustering** — use AI to group related code from across
  different files into one chunk view, the cross-file counterpart to today's
  adjacency-only grouping.
  ([#28](https://github.com/moui72/assisted-review/issues/28))

### Navigation & layout

- **File-tree navigation view** — a toggleable overview of chunks grouped
  under their file paths for jump-to navigation, without a permanent sidebar
  cluttering the focused single-chunk view.
  ([#24](https://github.com/moui72/assisted-review/issues/24))
- **Collapse/expand by file** — collapse or expand all chunks belonging to a
  single file at once.
  ([#26](https://github.com/moui72/assisted-review/issues/26))
- **Side-by-side diff view** — an alternative rendering mode with old/new
  columns, instead of today's single unified view.
  ([#25](https://github.com/moui72/assisted-review/issues/25))
- **Linkified PR header and diff file names** — make the PR title link out to
  the PR, and each chunk's file name link to that file in the platform's
  Files-changed view.

### Claude / AI

- **Stop & regenerate** — stop an in-flight Claude stream and regenerate a
  note, rather than only waiting or navigating away.
  ([#35](https://github.com/moui72/assisted-review/issues/35))
- **Model selection** — choose which Claude model generates commentary,
  rather than a fixed model baked into the invocation.
  ([#34](https://github.com/moui72/assisted-review/issues/34))
- **Smarter primary-issue selection** — when a PR references multiple Jira
  issues, pick the most relevant as the overview's primary issue instead of
  the first key found.
  ([#36](https://github.com/moui72/assisted-review/issues/36))

### Theming & appearance

- **Custom themes and fonts** — bring-your-own colors and typefaces written
  into the CSS-custom-property layer, on top of the built-in palette presets.
  ([#21](https://github.com/moui72/assisted-review/issues/21))
- **Independent syntax themes** — pick a syntax-highlighting theme separately
  from the UI palette (today each palette bundles its own syntax colors — a
  deliberate coupling this would make optional). Low priority.
  ([#22](https://github.com/moui72/assisted-review/issues/22))
- **Colorblind-safe progress ticks** — encode viewed/commented/flagged state
  in the top-strip ticks with texture as well as color, plus a tooltip
  explaining the encoding.
  ([#23](https://github.com/moui72/assisted-review/issues/23))

## Recently shipped

Highlights already in released versions (full detail in the
[changelog](./CHANGELOG.md)):

- **Repo investigation access** — five per-repo modes controlling how much of
  the actual repo Claude can see beyond the diff (none / local path /
  API-fetched changed files / temp clone / persistent clone), chosen once per
  repo from the UI.
- **Displaced-comment re-anchoring** — reopening a review whose diff changed
  shape detects comments/notes/flags whose chunk no longer exists, surfaces
  them instead of dropping or misattaching them, and lets you re-anchor
  comments by hand.
- **Resilient GitLab submit** — retries transient failures, withholds the
  summary note/approve until every inline comment posts, and persists partial
  progress so a retry never posts duplicates.
- **Multi-palette theming** — five curated palettes × light/dark, plus a new
  self-hosted typeface set (Figtree / Tinos / Space Mono) and an
  elevation/focus polish pass.
- **Inline comment editing** — edit drafted comments in place.
- **Update-check notice** — a non-intrusive startup notice when a newer
  version is on npm.

## Requesting a feature

Open a [GitHub issue](https://github.com/moui72/assisted-review/issues) with
the `enhancement` label describing what you want and why. Accepted ideas get
logged into the feature register, which is what actually drives planning —
acceptance means it's on the roadmap, not that it's scheduled.
