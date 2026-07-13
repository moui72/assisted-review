---
slug: multi-palette-theming
status: implemented
logged: 2026-07-13
plan: plan-multi-palette-theming-2026-07-13-4693.md
tasks: tasks-multi-palette-theming-3161.md
---

Let the reviewer switch between five curated color palettes (Blueprint default, Paper & Ink, Neon Noir, Mono Brutalist, Aubergine), each defined for both light and dark mode, from Settings — a palette axis added alongside the existing light/dark toggle, driven entirely by the existing CSS-custom-property theming in web/src/index.css.
Why: ships the curated *preset* set (data-palette + data-theme on root, persisted as ar-palette/ar-theme). Distinct from — not a replacement for — two adjacent backlog items that build on it: customizable-fonts-colors (#21, user-authored custom themes/fonts on top of the presets) and customizable-syntax-themes (#22, decoupling syntax colors from the UI palette). This feature deliberately bundles a syntax-token set into each palette; #22 is the later opt-out of that coupling. Token values already worked out in the previewer artifact: https://claude.ai/code/artifact/29b5d5fc-b5ca-42e5-9733-803c37bde36a
