---
slug: ui-elevation-and-focus-polish
status: tasked
logged: 2026-07-13
plan: plan-multi-palette-theming-2026-07-13-4693.md
tasks: tasks-multi-palette-theming-3161.md
---

Give the review UI a depth system so the top nav, review stage, and command bar read as three distinct planes (one-directional rail shadows), plus a single consistent accent focus-visible ring across all controls and an accent-tinted text-selection color.
Why: the flat single-plane layout reads soft; elevation + a real keyboard-focus floor is an accessibility and polish win. Partial implementation captured at .project/scratch/restyle-2026-07-13/ (restyle.patch) — the rail-shadow utilities, focus ring, and component framing are directly reusable.
