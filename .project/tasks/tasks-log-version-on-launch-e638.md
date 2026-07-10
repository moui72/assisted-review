---
plan: plan-log-version-on-launch-2026-07-10.md
generated: 2026-07-10
status: in-progress
---

# Tasks

## Phase 1: CLI startup log

- [x] T001 [artifacts: infrastructure] In `src/cli.ts`, add an unconditional
  `console.error` line printed at the top of `main()` stating the resolved
  `name`/`version` (e.g. `assisted-review v1.11.0`), printed every launch
  regardless of `reportIfOutdated()`'s outcome. Reuse the same
  `package.json`-resolution approach `reportIfOutdated()` already uses
  (`dirname(fileURLToPath(import.meta.url))` + `readFile(join(here, '..',
  'package.json'), 'utf8')`) — either factor a tiny shared `resolvePkg()`
  helper both call, or inline the same two lines again; either is fine, this
  isn't complex enough to need an abstraction beyond avoiding a copy-paste
  bug. Print this line before `reportIfOutdated()`'s conditional notice, not
  replacing it.
- [ ] T002 [artifacts: infrastructure] Update `infrastructure.md`'s "npm
  Registry (update check)" section: note the new unconditional startup
  version line is a *separate* behavior from the existing conditional
  outdated-version notice — keep the two clearly distinguished so a future
  reader doesn't conflate "always prints current version" with "only prints
  when outdated." Stamp `last_updated` and set `diagram_status: stale`
  (unless already `unrendered`).

Deliverable: running `assisted-review <ref>` prints its version on every
launch, whether or not an update is available.

## Phase 2: API + UI version display

- [x] T003 [artifacts: api] In `src/server.ts`, add `appVersion?: string` to
  `StartOptions` (destructured with a sensible default, matching the
  existing `preloadChunks`/`preloadOverview` pattern) and include
  `app_version: appVersion` in the `GET /api/config` handler's response
  object, alongside the existing `preload_chunks`/`preload_overview` fields.
- [x] T004 [artifacts: api] In `src/cli.ts`, resolve the version once (the
  same resolution added/reused in T001) and pass it as `appVersion` into
  `startServer()`'s options object in `main()`.
- [x] T005 [parallel] [artifacts: api] In `web/src/api.ts`, add `app_version:
  string` to the `PreloadConfig` interface (fetched via the existing
  `fetchConfig()` — despite the interface's preload-specific name, it's the
  one place the frontend already fetches server config).
- [x] T006 [artifacts: ui] In `web/src/components/SettingsPanel.tsx`, add a
  new read-only row rendering `preloadConfig?.app_version` using the
  existing `Row` component (matching the pattern used for the
  theme/preload/investigation-access rows).
- [ ] T007 [parallel] [artifacts: api] Document the new `app_version` field
  on `GET /api/config` in `api.md`. Stamp `last_updated`.
- [ ] T008 [parallel] [artifacts: ui] Document the new version row in
  `SettingsPanel.tsx`'s component description in `ui.md`. Stamp
  `last_updated` and set `diagram_status: stale` (unless already
  `unrendered`).

Deliverable: opening Settings shows the running version, sourced from
`GET /api/config`.

## Phase 3: Tests

- [ ] T009 [artifacts: infrastructure] `src/cli.ts` is excluded from the
  90% backend coverage gate (constitution: "untestable entry points"), and
  no `tests/cli.test.ts` currently exists — don't create test scaffolding
  around `main()`'s process-exit/browser-open side effects just for this.
  Instead, if T001 factored a shared `resolvePkg()`-style helper, add a
  small focused unit test for that helper alone (it's pure and testable in
  isolation); if T001 inlined the resolution instead, skip this task and
  verify the startup line manually (`node build/cli.js --help` or similar)
  before marking Phase 1 done.
- [ ] T010 [artifacts: api] In `tests/server.test.ts`, extend (or add
  alongside) the existing `GET /api/config` test: assert the response
  includes `app_version` matching the value passed via `StartOptions`
  when starting the test server instance.
- [ ] T011 [artifacts: ui] In `tests/components/SettingsPanel.test.tsx`, add
  a test asserting the new version row renders `app_version` from a mocked
  `fetchConfig()` result.

Deliverable: `npx vitest run --coverage` green; backend statement/line
coverage still above the 90% gate.
