---
plan: plan-multi-palette-theming-2026-07-13-4693.md
generated: 2026-07-13
status: in-progress
---

# Tasks

Consolidated restyle: typefaces + depth/focus polish + five-palette theming,
one PR. `web/src/index.css` is edited in three non-overlapping regions
(fonts → depth utilities → palette token blocks), so the phases run
sequentially rather than in parallel despite touching one shared file.

Reference material: `.project/scratch/restyle-2026-07-13/` (README + patch) —
font and depth/focus hunks are directly reusable. Palette token values come
from the previewer artifact's `PALETTES` object
(https://claude.ai/code/artifact/29b5d5fc-b5ca-42e5-9733-803c37bde36a), NOT
the patch's rejected green/gold hunk.

## Phase 1: Typefaces (feature: custom-typeface-set)

- [x] T001 Swap the app's typefaces to a self-hosted set. `pnpm add
  @fontsource/figtree @fontsource/tinos @fontsource/space-mono`; `pnpm remove
  @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono @fontsource/ibm-plex-serif`.
  In `web/src/main.tsx` replace the IBM Plex CSS imports with Figtree
  400/500/600, Tinos 400 + 400-italic, Space Mono 400/700. In
  `web/src/index.css` point `--font-sans` at Figtree, `--font-serif` at Tinos
  (Georgia/Times fallback), `--font-mono` at Space Mono (ui-monospace/Menlo
  fallback). Font hunks in the scratch patch are directly reusable. Space Mono
  has no 500 weight — `font-medium` mono spots fall back to 400 by design;
  don't try to import a 500. Verify `pnpm build` succeeds.

## Phase 2: Depth + focus polish (feature: ui-elevation-and-focus-polish)

- [x] T002 In `web/src/index.css` add: a `--rail-shadow` token (a per-palette
  value follows in Phase 3 — for now define it once), `@utility rail-top` and
  `@utility rail-bottom` (one-directional box-shadow lifting a rail off the
  stage), a global `:focus-visible` accent outline ring with `input` and
  `textarea` opted out (they keep their own accent border), and an accent
  `::selection` wash. These hunks are reusable from the scratch patch.
- [x] T003 Apply the rails: `rail-bottom` on `TopNav`'s `<header>`, `rail-top`
  on `AiCommentary`'s `<section>` and `OverviewView`'s `<footer>`, so top nav /
  review stage / command bar read as three distinct planes. Purely
  presentational — no behavior or prop changes. Confirm the existing 77
  component tests still pass.

## Phase 3: Palette token system (feature: multi-palette-theming)

- [x] T004 [artifacts: ui] Restructure the palette blocks in
  `web/src/index.css`. Keep `:root` as the `blueprint` **dark** fallback, then
  add ten explicit `:root[data-palette='<p>'][data-theme='<m>']` blocks for
  blueprint/paper/neon/mono/aubergine × dark/light, transcribing the artifact
  `PALETTES` values exactly for all 27 tokens (`--bg … --tok-meta`, including
  a per-palette/mode `--rail-shadow` and `--accent-soft`). Leave the
  `.hljs-* → --tok-*` mapping and the `@theme inline` block unchanged. Build
  and spot-check that every palette renders in both modes.

## Phase 4: Two-axis theme state (feature: multi-palette-theming)

- [x] T005 [artifacts: ui] Extend `web/src/theme.tsx` to a second axis without
  breaking its public API. Add `type Palette = 'blueprint'|'paper'|'neon'|
  'mono'|'aubergine'`; expose `palette` and `setPalette` alongside the existing
  `theme` and `toggle`; persist to `localStorage` key `ar-palette` (default
  `blueprint`). In `getInitial`, write BOTH `document.documentElement.dataset
  .palette` and `.theme` synchronously to avoid a flash on load. Strict TS, no
  `any`. `Logo.tsx` and `SettingsPanel.test.tsx` rely on `{ theme, toggle }` —
  keep them working.

## Phase 5: Palette picker UI (feature: multi-palette-theming)

- [x] T006 [artifacts: ui] In `web/src/components/SettingsPanel.tsx` add a
  **Palette** row to the Appearance section, beside the existing Theme toggle,
  offering the five palettes and wired to `useTheme().setPalette`. Reuse the
  `ChipGroup` pattern, or a small labeled `<select>`/radio list if five chips
  are too wide (presentation call — see plan Open Questions). Keep the Theme
  toggle unchanged.

## Phase 6: Tests + verify

- [x] T007 Extend `tests/components/SettingsPanel.test.tsx`: assert the five
  palette controls render, and that selecting a non-active palette sets
  `document.documentElement.dataset.palette` and persists `ar-palette` (mirror
  the existing dark/light theme-toggle test). Keep that theme test green and
  confirm `Logo.tsx` behavior is unaffected (mode axis only).
- [ ] T008 Full verification: `pnpm lint`, `pnpm build`, `npx vitest run`
  (backend coverage stays >90%), and the Playwright e2e smoke
  (`pnpm test:e2e`). Then drive the real app (the mock-stub server:
  `PATH="$(pwd)/tests/e2e/stubs:$PATH" node build/cli.js --mock-ai`, open
  `testowner/testrepo#42`) and confirm switching palette and mode re-themes the
  diff, Claude panel, and chrome across all combinations, with no flash on
  reload.
