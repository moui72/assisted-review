---
status: open
created: 2026-07-24
plan: null
---

# Feedback

## Bugs
- [ ] F001 Upstream ArDD `install.sh` records a stable `Source-Ref` on a beta-channel install. A `/ardd-update` run on `Channel: beta` resolved `v1.2.1-beta.1` via `source-resolve.sh`, but `install.sh` wrote `Source-Ref: v1.2.0` into `.project/ardd-version.md` (both tags point at commit `20d8960`, and `install.sh` appears to pick the stable tag when describing the commit). This propagates: `.github/workflows/ardd-badge.yml`'s `Regenerate badge JSON` step reads `Source-Ref` verbatim into the badge's `message`, so a beta-channel install publicly advertises a stable version string. `install.sh` should record the tag the resolved channel actually selected.
- [ ] F002 Upstream ArDD `templates/badge-shieldcn.md`'s `PLACEHOLDER` caveat is stale. Its header and "Renderer caveat" comment both assert (verified upstream 2026-07-21) that shieldcn.dev's `dynamic/json` `logo=` param silently ignores a `data:image/svg+xml;base64,...` URI, and ship `PLACEHOLDER` in the shape-2/shape-3 snippets for that reason. Re-running the same A/B byte-comparison on 2026-07-24 against this repo's live badge URL shows the opposite: with the data-URI logo the SVG grows 3929 → 4133 bytes, width 190 → 212, and the added `<path d="M12 2 22.5 21H1.5ZM12 8.2 17.4 18H6.6Z">` is the ArDD mark from `.github/badges/ardd-icon.svg` itself. shieldcn.dev added data-URI support since that verification; the template should drop `PLACEHOLDER` and inline the real base64 icon.

## UX
- [ ] F003 Upstream ArDD's shieldcn badge templates should not suggest a `mode=light`/`mode=dark` `<picture>` wrapper. shieldcn.dev ignores `mode=` entirely — fetching this repo's badge URL with `mode=dark`, `mode=light`, and no `mode` at all returns three byte-identical SVGs (as does the sponsor badge and the npm group badge) — so the `<source media="(prefers-color-scheme: dark)">` branch is dead weight that reads as intentional theme support. This repo's README was simplified to a plain `<img>` accordingly.
