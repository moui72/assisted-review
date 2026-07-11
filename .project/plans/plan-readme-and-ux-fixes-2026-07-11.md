---
status: approved
branch: readme-and-ux-fixes
created: 2026-07-11
features: []
surfaced-defects: []
---

# Plan: README & UX feedback fixes

## Goal

Clear the three open feedback items: fix two Overview/keyboard UX bugs, and
make the package npm-ready by rewriting `README.md` and relocating the Mermaid
architecture diagrams to a GitHub-rendered docs page.

## Scope

**In:**
- Fix `Cmd+C`/`Ctrl+C` being swallowed by the bare-`c` "focus comment box"
  shortcut (`feedback-cmd-c-copy-broken` F001).
- Overview footer button reads "Resume review" once any chunk has been viewed
  (`feedback-overview-resume-review` F001).
- Relocate the three Mermaid diagrams (Datamodel/Infrastructure/UI) out of
  `README.md` into `docs/ARCHITECTURE.md`, using `ardd-render`'s new
  per-artifact `render_target`/`render_section` support; remove the Mermaid
  sections from `README.md` (`feedback-readme-rewrite-move-mermaid-di` F002).
- Rewrite `README.md` for npm publication — install, usage, configuration,
  links to deeper docs (`feedback-readme-rewrite-move-mermaid-di` F001).
- Reflect the two UI behavior changes in `ui.md`.

**Out:**
- Any product/feature change beyond the two bug fixes.
- The upstream ARDD render-destination request (`...-mermaid-di` F003): it was
  filed as `moui72/artifact-driven-dev#2` and is **already resolved** in the
  ARDD version installed this session (`f68208f` — `render_target`/
  `render_section` now exist). No local work; the upstream issue can be closed.

## Technical Approach

- **Cmd+C passthrough** — in `web/src/App.tsx`'s global keydown handler, guard
  the `e.key === 'c'` branch with `!mod` (the `mod` flag it already computes),
  mirroring how `ArrowRight`/`ArrowLeft` branch on `mod`. `Cmd/Ctrl+C` then
  falls through to the browser's native copy. `ui.md`'s Keyboard Model gains a
  note that the bare-`c` comment shortcut is mod-guarded.
- **Resume-review label** — `OverviewView`'s footer button branches on
  `state.viewed.length > 0`: "Resume review" when any chunk has been viewed,
  else the existing "Begin review →". `ui.md`'s Overview/States description is
  updated to match. (Distinct from the existing zero-chunk footer branch.)
- **Diagram relocation** — add `render_target: docs/ARCHITECTURE.md` (and a
  `render_section` per diagram) to the frontmatter of `datamodel.md`,
  `infrastructure.md`, and `ui.md`; run `/ardd-render` for each to write
  `docs/ARCHITECTURE.md`; then remove the `## Datamodel` / `## Infrastructure`
  / `## UI` Mermaid sections from `README.md`. Keeps the diagrams GitHub-
  rendered while leaving `README.md` clean for npm's renderer.
- **README rewrite** — author an npm-appropriate `README.md`: what it is,
  install (`npm i -g assisted-review`), quickstart, key config/env vars, and a
  link to `docs/ARCHITECTURE.md` for the diagrams.

## Phase Breakdown

### Phase 1 — Overview & keyboard UX fixes
_No dependencies. Code + `ui.md`, independently testable._
- Guard the `c` shortcut with `!mod` in `web/src/App.tsx` so `Cmd/Ctrl+C`
  copies natively (`feedback-cmd-c-copy-broken` F001) `[artifacts: ui]`
- Overview footer reads "Resume review" when `state.viewed` is non-empty, in
  `OverviewView` (`feedback-overview-resume-review` F001) `[artifacts: ui]`
- Update `ui.md` — Keyboard Model (bare-`c` is mod-guarded) and Overview
  states (Begin vs Resume footer label) `[artifacts: ui]`
- Tests: a keydown test asserting `Cmd+C` does not focus the comment textarea
  / does not `preventDefault`; a component test asserting the footer label
  flips once a chunk is viewed.

### Phase 2 — Relocate architecture diagrams off README
_No code dependency; must land before Phase 3 rewrites README around them._
- Add `render_target: docs/ARCHITECTURE.md` + `render_section` frontmatter to
  `datamodel.md` / `infrastructure.md` / `ui.md`
  (`feedback-readme-rewrite-move-mermaid-di` F002)
- Run `/ardd-render` for each artifact to generate `docs/ARCHITECTURE.md`, and
  remove the three Mermaid sections from `README.md`
  (`feedback-readme-rewrite-move-mermaid-di` F002)

### Phase 3 — README rewrite for npm
_Depends on Phase 2 (README's diagram sections removed first)._
- Rewrite `README.md` for npm: install/usage/config + link to
  `docs/ARCHITECTURE.md` (`feedback-readme-rewrite-move-mermaid-di` F001)

## Open Questions

- `docs/ARCHITECTURE.md` shape — assume a single page holding all three
  diagrams with brief connective prose, linked from the README. Confirm during
  implementation if a different structure is wanted.
- README depth — how much usage/example detail beyond install + quickstart +
  config. Defer to implementation, guided by npm-package norms.

## Production Annotation Summary

None — these are bug fixes plus documentation/tooling changes; no new
production shortcut or deliberate gap is introduced.
