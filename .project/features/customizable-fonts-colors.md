---
slug: customizable-fonts-colors
status: backlogged
logged: 2026-07-02
---

Let the reviewer define their own theme (colors) and font set — bring-your-own values written into the CSS-custom-property layer — rather than only choosing from the built-in presets.
Issue: moui72/assisted-review#21

Re-scoped 2026-07-13 (not superseded). `multi-palette-theming` delivers the
curated *presets* (five palettes x light/dark) and `custom-typeface-set`
picks the default faces; this entry sits on top of both as the freeform,
user-authored escape hatch — supply your own token values and/or typefaces
instead of selecting a preset. Depends on the preset plumbing landing first.
(The GitHub issue text predates the preset/custom split; reconcile on next
tracker sync.)
