---
slug: customizable-syntax-themes
status: backlogged
logged: 2026-07-02
---

Let the reviewer pick a syntax-highlighting color theme that is independent of the selected UI palette/mode — the way an editor (e.g. VS Code) lets you choose a code color theme separately from the app chrome — instead of syntax colors being fixed to the chosen palette.
Issue: moui72/assisted-review#22

Re-scoped 2026-07-13 (not superseded). `multi-palette-theming` bundles a
syntax-token set into each curated palette, so syntax colors switch *with*
the palette/mode. This entry is the orthogonal capability: decoupling the
`--tok-*` layer so a reviewer can pair any palette/mode with any syntax theme.
Very low priority, possibly won't-do — recorded so the coupling is a known,
deliberate default rather than an accident. (The GitHub issue text still
carries the older "pick a token theme paired with light/dark" framing;
reconcile on next tracker sync.)
