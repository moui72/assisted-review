---
status: approved
branch: cli-update-check-notice
created: 2026-07-07
features: [cli-update-check-notice]
---

# Plan: CLI Update Check Notice

## Goal

On CLI startup, non-intrusively tell the user when a newer version of
`assisted-review` is published, without ever blocking or delaying startup
(`cli-update-check-notice`).

## Scope

**In scope**
- A background check against the npm registry for the latest published
  version of the package, compared against the running install's own
  `package.json` version.
- A 24h on-disk cache (`update-check.json` in `STATE_DIR`) so normal usage
  doesn't hit the registry on every invocation.
- A single dim `console.error` notice line, printed only when the installed
  version is behind — silent otherwise.
- An `ASSISTED_REVIEW_NO_UPDATE_CHECK` opt-out env var.

**Out of scope**
- Any UI-surfaced notice (browser splash/banner) — CLI-only, matching how
  the rest of startup diagnostics (`Fetching ...`, `Parsed N chunk(s) ...`)
  already report via `console.error`.
- Auto-update / self-upgrade — this only informs, never acts.
- Prerelease/tag-aware comparison (`beta`, `next`, etc.) — registry `latest`
  and the local `package.json` version are both always plain `x.y.z`.

## Technical Approach

Per the updated `infrastructure.md` ("npm Registry (update check)" section):
`src/update-check.ts` exports `checkForUpdate(pkgName, currentVersion)`,
called from a new `reportIfOutdated()` helper in `src/cli.ts`. The call is
fire-and-forget (`void reportIfOutdated()`) at the top of `main()` — it runs
concurrently with PR fetch/server startup rather than gating either, and
since the server stays running until `Ctrl+C`, the notice (if any) has ample
time to print after the "serving at ..." banner.

`checkForUpdate` reads/writes a small JSON cache (`checked_at`,
`latest_version`) under `STATE_DIR`, reusing `state.ts`'s
atomic-tmp-then-`rename()` write pattern. A stale (>24h) or missing cache
triggers one `fetch()` against `registry.npmjs.org/<pkg>/latest`, bounded by
a 1.5s `AbortController` timeout. Version comparison is a simple
`^(\d+)\.(\d+)\.(\d+)` regex parse, compared component-by-component — no
external semver dependency needed for this shape. Any failure at any stage
(network, non-2xx, timeout, unparseable version, cache read/write error)
resolves to "no message," following the same silent-degrade convention as
every other optional integration in `infrastructure.md`.

## Phase Breakdown

### Phase 1 — Update-check module and CLI wiring (feature: `cli-update-check-notice`)

1. `src/update-check.ts`: `checkForUpdate()`, cache read/write, registry
   fetch with timeout, semver-prefix comparison, `ASSISTED_REVIEW_NO_UPDATE_CHECK`
   opt-out.
2. `src/cli.ts`: `reportIfOutdated()` resolves the running package's
   name/version via `import.meta.url` + `package.json` (works both under
   `tsx src/cli.ts` in dev and compiled `build/cli.js`), calls
   `checkForUpdate`, prints the notice if present. Wired as
   `void reportIfOutdated()` at the top of `main()`.

Deliverable: running `assisted-review <ref>` against an out-of-date local
`package.json` version prints the notice line without delaying the
"Fetching ..." / "serving at ..." output.

### Phase 2 — Tests (depends on Phase 1)

1. `tests/update-check.test.ts`: opt-out env var skips the network call;
   newer/equal/ahead-of-registry version comparisons; registry failure
   (non-ok, thrown/rejected fetch, unparseable version, missing version
   field) all resolve to `null`; cache hit skips a second network call
   within the interval; cache staleness triggers a re-check; an unparseable
   cache file is treated as absent rather than thrown.

Deliverable: `npx vitest run --coverage` green, `src/**/*.ts` statement/line
coverage for the new file at 100%, overall backend coverage still above the
90% gate.

## Complexity Tracking

None — no deviations from the simplicity principle. No new dependency (uses
built-in `fetch`/`AbortController`), no new abstraction beyond the existing
`STATE_DIR` cache-file pattern already used by `saveState()`.

## Open Questions

None.

## Production Annotation Summary

None new. This feature's own failure modes (registry unreachable, cache
unwritable) are handled by design (silent degrade), not deferred as gaps.
