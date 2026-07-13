---
slug: custom-typeface-set
status: tasked
logged: 2026-07-13
plan: plan-multi-palette-theming-2026-07-13-4693.md
tasks: tasks-multi-palette-theming-3161.md
---

Replace the IBM Plex family with a distinctive self-hosted typeface set: Figtree (sans / UI), Tinos (serif / Claude's voice), and Space Mono (mono / code and meta), wired through the existing --font-sans/--font-serif/--font-mono custom properties and @fontsource imports in main.tsx.
Why: gives the tool its own type identity instead of the default IBM Plex. Partial implementation captured at .project/scratch/restyle-2026-07-13/ (restyle.patch) — the font hunks are directly reusable.
