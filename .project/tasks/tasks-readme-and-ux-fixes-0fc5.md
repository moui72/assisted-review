---
plan: plan-readme-and-ux-fixes-2026-07-11.md
generated: 2026-07-11
status: in-progress
---

# Tasks

## Phase 1: Overview & keyboard UX fixes

- [x] T001 [artifacts: ui] [parallel] In `web/src/App.tsx`'s global keydown
  `useEffect`, guard the `e.key === 'c'` "focus comment box" branch with
  `!mod` (the `mod` = ⌘/Ctrl flag already computed near the top of the
  handler), mirroring how the `ArrowRight`/`ArrowLeft` branches already check
  `mod`. This lets `Cmd+C`/`Ctrl+C` fall through to the browser's native copy
  instead of calling `preventDefault()` + focusing the textarea. Add/extend a
  jsdom component test (`tests/components/App.test.tsx`, `// @vitest-environment
  jsdom`) asserting a `keydown` with `metaKey`/`ctrlKey` + `c` does NOT focus
  the comment textarea and does NOT `preventDefault`, while a bare `c` still
  does. (feedback: feedback-cmd-c-copy-broken F001)

- [x] T002 [artifacts: ui] [parallel] In `OverviewView`, make the footer
  "Begin review →" button read "Resume review" when `state.viewed` is
  non-empty, keeping "Begin review →" when it is empty. Preserve the existing
  zero-chunk branch (`chunkCount === 0` → "No reviewable changes…", no button).
  Add a component test asserting the label is "Begin review →" with no viewed
  chunks and flips to "Resume review" once `state.viewed` contains a chunk id.
  (feedback: feedback-overview-resume-review F001)

- [x] T003 [artifacts: ui] Update `ui.md` to match T001/T002: in the Keyboard
  Model, note the bare-`c` comment shortcut is mod-guarded so `Cmd/Ctrl+C`
  passes through to native copy; in the Overview/States description, note the
  footer button reads "Begin review →" vs "Resume review" based on whether
  `state.viewed` is non-empty (distinct from the zero-chunk branch).
  Documentation only — no code. Stamp `last_updated` to today.

## Phase 2: Relocate architecture diagrams off README

- [x] T004 [artifacts: datamodel, infrastructure, ui] Add
  `render_target: docs/ARCHITECTURE.md` and a `render_section` (`Datamodel` /
  `Infrastructure` / `UI` respectively) to the frontmatter of
  `.project/artifacts/datamodel.md`, `infrastructure.md`, and `ui.md`, using
  the `render_target`/`render_section` fields supported by the installed
  `ardd-render`. Frontmatter only — no diagram or README change in this task.
  (feedback: feedback-readme-rewrite-move-mermaid-di F002)

- [x] T005 [artifacts: datamodel, infrastructure, ui] Depends on T004. Run
  `/ardd-render datamodel`, `/ardd-render infrastructure`, `/ardd-render ui` so
  each diagram is upserted into `docs/ARCHITECTURE.md` (created if absent) at
  its `render_section`, then remove the `## Datamodel`, `## Infrastructure`,
  and `## UI` Mermaid sections from `README.md`. Verify: `docs/ARCHITECTURE.md`
  contains all three `mermaid` blocks and `README.md` contains no `mermaid`
  fences. (feedback: feedback-readme-rewrite-move-mermaid-di F002)

## Phase 3: README rewrite for npm

- [ ] T006 Depends on Phase 2 (README diagram sections already removed).
  Rewrite `README.md` for npm publication: a concise description of what
  assisted-review is, install (`npm i -g assisted-review`), a quickstart
  (open a PR/MR for review), key configuration/env vars (Jira, GitLab, preload,
  investigation modes — cross-reference `infrastructure.md`'s env list), and a
  link to `docs/ARCHITECTURE.md` for the architecture diagrams. Keep it free of
  raw Mermaid so it renders cleanly on npmjs.com.
  (feedback: feedback-readme-rewrite-move-mermaid-di F001)
