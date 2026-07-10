---
status: approved
branch: log-version-on-launch
created: 2026-07-10
features: []
surfaced-defects: []
---

# Plan: Log & Display Running Version

## Goal

Tell the user what version of `assisted-review` they're running, both at CLI
launch (console) and in the UI, regardless of whether a newer version is
available (feedback `feedback-log-version-on-launch-f832.md`, F001/F002).

## Scope

**In scope**
- A `console.error` line at CLI startup stating the current version,
  printed unconditionally — independent of `src/update-check.ts`'s
  newer-version notice, which only fires when outdated.
- Exposing the running version to the frontend via `GET /api/config`
  (already the one existing config-fetch endpoint) and rendering it
  somewhere in the UI (Settings panel, alongside the existing
  `SettingsPanel.tsx` rows).

**Out of scope**
- Any change to `src/update-check.ts`'s existing outdated-version notice
  logic — this adds an unconditional line alongside it, doesn't touch it.
- Version history/changelog display — just the current version string.

## Technical Approach

Both the CLI and the server already resolve `package.json`'s `name`/`version`
independently: `src/cli.ts`'s `reportIfOutdated()` reads it via
`import.meta.url` + `readFile` for the update-check call. Reuse that same
resolution (factor into a small shared helper, or duplicate the two-line
read — package.json resolution isn't complex enough to need a shared
abstraction beyond avoiding a copy-paste bug) for the new unconditional
startup line in `src/cli.ts`.

Server-side, `GET /api/config` (`src/server.ts`) already returns a small
config object (`preload_chunks`, `preload_overview`) sourced from
`StartOptions`; extend both the response and `StartOptions` with an
`app_version` field, threaded from `main()`'s already-resolved
`package.json` version the same way `port`/`mockAi`/etc. are threaded today.
`web/src/api.ts`'s `PreloadConfig` interface (fetched once via
`fetchConfig()`) gains the same field — despite the interface's name being
preload-specific, it's the one place the frontend already fetches
server config, so extending it is simpler than adding a second endpoint
for one string field.

`SettingsPanel.tsx` (already reads `fetchConfig()`'s result for the preload
row) renders the version string in a new row, matching the existing
label/value row pattern (`Row` component already used for theme/preload/
investigation-access).

## Phase Breakdown

### Phase 1 — CLI startup log (feedback: F001) [artifacts: infrastructure]

1. `src/cli.ts`: print an unconditional `console.error` line with the
   resolved `name`/`version` at startup, alongside (not replacing)
   `reportIfOutdated()`'s existing conditional notice.
2. `infrastructure.md`: update the "npm Registry (update check)" section's
   Purpose bullet to note the *separate*, always-on version line is now
   printed at startup independent of the update-check outcome — keep the
   two behaviors (unconditional version line vs. conditional outdated
   notice) clearly distinguished so a future reader doesn't conflate them.

Deliverable: `assisted-review <ref>` prints its version on every launch,
whether or not an update is available.

### Phase 2 — API + UI version display (feedback: F002, depends on Phase 1 for the resolved version value) [artifacts: api, ui]

1. `src/server.ts`: add `appVersion` to `StartOptions`, include
   `app_version` in `GET /api/config`'s response.
2. `src/cli.ts`: pass the resolved version into `startServer()`'s options.
3. `web/src/api.ts`: add `app_version: string` to `PreloadConfig`.
4. `web/src/components/SettingsPanel.tsx`: render a new row showing
   `app_version` (read-only, no interaction — matches how e.g. a static
   label would look; reuses the existing `Row` component).
5. `api.md`: document the new `app_version` field on `GET /api/config`.
6. `ui.md`: document the new version row in `SettingsPanel.tsx`'s component
   description.

Deliverable: opening Settings shows the running version; confirmed via a
component test asserting the row renders the value from a mocked
`fetchConfig()`.

### Phase 3 — Tests (depends on Phases 1–2)

1. `tests/cli.test.ts` (or wherever CLI startup is currently covered):
   assert the unconditional version line is printed regardless of
   update-check outcome.
2. `tests/server.test.ts` (or equivalent): `GET /api/config` includes
   `app_version` matching the value passed via `StartOptions`.
3. `tests/components/SettingsPanel.test.tsx`: version row renders the
   value from a mocked config fetch.

Deliverable: `npx vitest run --coverage` green, backend coverage still
above the 90% gate.

## Complexity Tracking

None — no new dependency, no new abstraction. Reuses the existing
`package.json`-resolution pattern, the existing `GET /api/config` endpoint,
and the existing `SettingsPanel.tsx` row pattern.

## Open Questions

None.

## Production Annotation Summary

None new.
