---
status: open
created: 2026-07-10
plan: null
---

# Feedback

## UX
- [ ] F001 README.md needs a complete rewrite — current content is stale/thin
  relative to what a published npm package's README should cover (install,
  usage, config, links to deeper docs).
- [ ] F002 The Mermaid diagrams currently living in README.md (Datamodel,
  Infrastructure, UI — see `## Datamodel`, `## Infrastructure`, `## UI`
  sections) don't render on npmjs.com's package page (npm's markdown
  renderer strips/ignores Mermaid code fences), so they should be moved out
  of README.md into a location that still renders on GitHub (e.g. a `docs/`
  page) rather than shown broken to npm consumers.

## Reconsidered
- [ ] F003 `/ardd-render`'s render config (`.claude/skills/ardd-render/SKILL.md`)
  hardcodes `README.md` as the only upsert target for all three diagram
  types (datamodel/infrastructure/ui) — confirmed by reading the skill
  source at `/Users/tyler.peckenpaugh/dev/artifact-driven-dev/skills/ardd-render/SKILL.md`,
  which has no config knob for an alternate destination file/section. This
  project needs diagrams rendered somewhere other than README.md (see F002),
  which ARDD doesn't currently support. A feature request should be filed
  upstream against `moui72/artifact-driven-dev` to make the render
  destination configurable per-project (e.g. a `docs/ARCHITECTURE.md` target
  instead of/in addition to README.md), rather than working around it
  locally by hand-editing rendered output outside the ARDD-managed
  workflow.

  **Filed**: https://github.com/moui72/artifact-driven-dev/issues/2
