---
status: approved
branch: multi-palette-theming
created: 2026-07-13
features: [multi-palette-theming, custom-typeface-set, ui-elevation-and-focus-polish]
surfaced-defects: []
---

# Plan — Multi-palette theming (consolidated restyle)

## Goal

Give the reviewer a two-axis appearance system — five curated color palettes
(`blueprint` default) × light/dark mode — plus a distinctive self-hosted
typeface set and a three-plane depth/focus polish, all landing in one PR
because all three touch `web/src/index.css`.

## Scope

**In scope** (three consolidated backlog features):
- `custom-typeface-set` — Figtree (sans), Tinos (serif), Space Mono (mono),
  self-hosted via `@fontsource`, wired through `--font-*`.
- `ui-elevation-and-focus-polish` — rail-shadow depth system, a single accent
  `:focus-visible` ring, accent `::selection`.
- `multi-palette-theming` — `data-palette` × `data-theme` on the root, five
  palettes each defined for both modes, persisted to `localStorage`
  (`ar-palette` / `ar-theme`), with a Palette picker in `SettingsPanel`.

**Out of scope** (deliberate boundaries):
- Tick-strip semantic state colors (flagged=orange / commented=violet /
  viewed=emerald) stay palette-independent literal Tailwind classes in
  `TopNav`. Harmonizing them per-palette belongs to `colorblind-safe-tick-states`.
- Decoupling syntax colors from the palette (`customizable-syntax-themes`) and
  user-authored custom palettes/fonts (`customizable-fonts-colors`) — each
  palette bundles its own `--tok-*` set here; those are later follow-ons.
- No server/API/datamodel changes — appearance is client-only `localStorage`.

## Technical Approach

Per `ui.md`, appearance runs entirely through CSS custom properties (no
`tailwind.config.js`; `@theme inline` maps utilities to the vars). The
canonical token values for all five palettes × both modes are the previewer
artifact's `PALETTES` object:
https://claude.ai/code/artifact/29b5d5fc-b5ca-42e5-9733-803c37bde36a — its
27-key token order (`bg, surface, surface-2, edge, edge-strong, fg, muted,
faint, accent, accent-soft, add-bg, add-fg, add-gutter, del-bg, del-fg,
del-gutter, hunk-bg, rail-shadow, tok-comment, tok-keyword, tok-string,
tok-number, tok-title, tok-type, tok-attr, tok-var, tok-meta`) is the source
of truth. **Do not** reuse the rejected green/gold hunk in
`.project/scratch/restyle-2026-07-13/restyle.patch`; that scratch is reusable
only for the font and depth/focus hunks (see its README).

Token cascade in `index.css`: `:root` holds `blueprint`/dark as the pre-JS
fallback; each of the 10 combinations gets an explicit
`:root[data-palette='<p>'][data-theme='<m>']` block (specificity 0,2,0) so
there is no source-order ambiguity, given `theme.tsx` always writes both
attributes. The existing `.hljs-*` → `--tok-*` mapping and `@theme inline`
block are unchanged.

`theme.tsx` gains a second axis while preserving its current public API
(`{ theme, toggle }` — `Logo.tsx` and `SettingsPanel.test.tsx` depend on it):
add `palette` / `setPalette`, persist `ar-palette`, and in `getInitial` write
**both** `data-palette` and `data-theme` synchronously to avoid a flash.
`SettingsPanel` gains a Palette row next to the Theme toggle, reusing the
existing `ChipGroup` pattern.

## Phase Breakdown

Ordered so the shared `index.css` is edited in three non-overlapping regions,
lowest-risk first. Each phase is independently verifiable.

### Phase 1 — Typefaces (`custom-typeface-set`)
- **T001** Add `@fontsource/figtree`, `@fontsource/tinos`, `@fontsource/space-mono`;
  remove the three `@fontsource/ibm-plex-*` packages. Swap the imports in
  `web/src/main.tsx` (Figtree 400/500/600; Tinos 400 + 400-italic; Space Mono
  400/700) and point `--font-sans`/`--font-serif`/`--font-mono` in
  `index.css` at Figtree/Tinos/Space Mono with sensible fallbacks. Font hunks
  in the scratch patch are directly reusable. Note: Space Mono has no 500
  weight — `font-medium` mono spots fall back to 400 by design.

### Phase 2 — Depth + focus polish (`ui-elevation-and-focus-polish`)
- **T002** In `index.css`: add the `--rail-shadow` token (per palette later),
  `@utility rail-top` / `rail-bottom` (one-directional shadow), a global
  `:focus-visible` accent ring with `input`/`textarea` opted out, and an
  accent `::selection`. Reusable from the scratch patch.
- **T003** Apply `rail-bottom` to `TopNav`'s header and `rail-top` to
  `AiCommentary`'s section and `OverviewView`'s footer (the console rails), so
  nav / stage / command-bar read as three planes. No behavior change.

### Phase 3 — Palette token system (`multi-palette-theming`, foundation)
- **T004** Restructure the `index.css` palette blocks: `:root` = `blueprint`
  dark fallback, plus ten `:root[data-palette='<p>'][data-theme='<m>']`
  blocks (blueprint/paper/neon/mono/aubergine × dark/light) transcribing the
  artifact `PALETTES` token values exactly (all 27 keys, including
  `--rail-shadow` per palette/mode). Leave `.hljs-*` mapping and `@theme
  inline` untouched. Verify light and dark both render for every palette.

### Phase 4 — Two-axis theme state (`multi-palette-theming`)
- **T005** [artifacts: ui] Extend `web/src/theme.tsx`: add `Palette` type
  (`blueprint|paper|neon|mono|aubergine`), `palette`/`setPalette`, persist
  `ar-palette`; keep `{ theme, toggle }` intact. `getInitial` sets both
  `data-palette` (default `blueprint`) and `data-theme` synchronously. Strict
  TS, no `any`.

### Phase 5 — Palette picker UI (`multi-palette-theming`)
- **T006** [artifacts: ui] Add a **Palette** row to `SettingsPanel`'s
  Appearance section beside the Theme toggle, selecting among the five
  palettes (reuse `ChipGroup` or an equivalent labeled control), wired to
  `useTheme().setPalette`.

### Phase 6 — Tests + verify
- **T007** Extend `tests/components/SettingsPanel.test.tsx`: the five palette
  controls render; selecting a non-active palette sets
  `document.documentElement.dataset.palette` and persists `ar-palette`. Keep
  the existing dark/light theme-toggle test green. Confirm `Logo.tsx` (mode
  axis) is unaffected.
- **T008** Full check: `pnpm lint`, `pnpm build`, `npx vitest run`, and the
  Playwright e2e smoke. Then drive the real app (`/run` or the mock-stub
  server) to confirm switching palette + mode re-themes the diff, Claude
  panel, and chrome, in every combination, with no flash on reload.

## Open Questions

- **Picker affordance for five options.** The existing `ChipGroup` is fine for
  2–4 short chips; five palette names may be wide. Acceptable to ship as chips
  (possibly wrapping) or switch to a small `<select>` / radio list — a
  presentation call for Phase 5, no data-model impact.
- **Default-palette attribute writing.** `:root` already encodes `blueprint`
  dark, so strictly only non-blueprint / light need an explicit attribute;
  the plan writes both attributes always for simplicity and no-flash
  correctness. Confirm no perf concern (negligible — two `dataset` writes).

## Production Annotation Summary

None — this plan introduces no production shortcut or deliberate gap. (The
pre-existing "Load error has no in-place retry" annotation in `ui.md` is
untouched and unrelated.)
