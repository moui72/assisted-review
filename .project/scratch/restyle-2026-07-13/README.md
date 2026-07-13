# Restyle — partial implementation (scratch reference)

_Captured 2026-07-13 from an exploratory restyling session, then reverted from
the working tree so nothing ships to `main` outside the ARDD flow._

This directory is **reference material for implementing agents**, not tracked
app state. `restyle.patch` is a `git diff` (against the pre-session `main`) of
an in-progress restyle. Three separable concerns are interleaved in it — two
are wanted and backlogged, one is rejected. Read this before applying anything.

## What's in `restyle.patch`

| Concern | Files / hunks | Status | Backlog entry |
|---|---|---|---|
| **Typefaces** | `main.tsx` (@fontsource imports), `index.css` `--font-*` vars, `package.json` deps | ✅ Wanted — **reuse directly** | `custom-typeface-set` |
| **Depth + focus polish** | `index.css` (`rail-top`/`rail-bottom` utilities, `:focus-visible` ring, `::selection`), `TopNav.tsx`, `AiCommentary.tsx`, `OverviewView.tsx` | ✅ Wanted — **reuse directly** | `ui-elevation-and-focus-polish` |
| **Green/gold palette rewrite** | `index.css` `:root` + `[data-theme='light']` token blocks | ❌ **Rejected — do NOT reuse** | superseded by `multi-palette-theming` |

## Guidance per feature

### `custom-typeface-set`
The font hunks are complete and correct. Figtree 400/500/600, Tinos 400 +
400-italic, Space Mono 400/700, all self-hosted via `@fontsource`. Note Space
Mono has no 500 weight — the few `font-medium` mono spots fall back to 400 by
design. IBM Plex packages were removed.

### `ui-elevation-and-focus-polish`
The `rail-top` / `rail-bottom` `@utility` rules and the `--rail-shadow` token,
the global `:focus-visible` accent ring (with inputs/textareas opted out), and
the `::selection` accent wash are all reusable as-is. Component changes just add
`rail-*` classes to the three chrome surfaces.

### `multi-palette-theming` — ignore the patch's palette hunk
The palette hunk in `restyle.patch` is the **rejected** green-black/gold attempt.
Do **not** copy those token values. The real source of truth for this feature is
the **previewer artifact**, which has all five directions fully worked out for
both light and dark:

- Previewer: https://claude.ai/code/artifact/29b5d5fc-b5ca-42e5-9733-803c37bde36a
- Default palette: **Blueprint**. Others: Paper & Ink, Neon Noir, Mono
  Brutalist, Aubergine.
- Each direction is defined as the same CSS custom properties the app already
  uses (`--bg`, `--surface`, `--edge`, `--fg`, `--accent`, `--accent-soft`,
  `--add-*`/`--del-*`/`--hunk-bg`, `--tok-*`, `--rail-shadow`), so a chosen set
  drops straight into `web/src/index.css`. The artifact's `PALETTES` object (view
  source) is the canonical token table for all 10 combinations.

## Applying the wanted parts

`restyle.patch` won't apply cleanly hunk-by-hunk if `index.css` has already been
restructured for palettes, since all three concerns touch that file. Treat the
patch as a **guide**, not a `git apply` target: lift the font + depth/focus
hunks, and take palette tokens from the artifact.
