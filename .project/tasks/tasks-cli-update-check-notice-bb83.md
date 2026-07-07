---
plan: plan-cli-update-check-notice-2026-07-07.md
generated: 2026-07-07
status: completed
---

# Tasks

## Phase 1: Update-check module and CLI wiring

- [x] T001 [artifacts: infrastructure] Create `src/update-check.ts` exporting
  `checkForUpdate(pkgName: string, currentVersion: string): Promise<string |
  null>`. Reads/writes a JSON cache (`{ checked_at, latest_version }`) at
  `update-check.json` in `STATE_DIR` (imported from `./state.js`), using the
  same atomic tmp-then-`rename()` write as `saveState()`. Re-checks only when
  the cache is missing or older than 24h (`CHECK_INTERVAL_MS`). The registry
  call is `GET https://registry.npmjs.org/<pkg>/latest` via `fetch()`,
  wrapped in an `AbortController` with a 1.5s timeout. Version comparison
  parses both strings with `^(\d+)\.(\d+)\.(\d+)` and compares
  component-by-component — unparseable versions, a non-ok response, a
  thrown/rejected fetch, or a missing `version` field on the response all
  resolve to `null` rather than throwing. Skip entirely (return `null`,
  no network call) when `ASSISTED_REVIEW_NO_UPDATE_CHECK` is set. On a real
  update, return `` `Update available: ${current} → ${latest}  (npm i -g
  ${pkgName})` ``.

- [x] T002 [artifacts: infrastructure] In `src/cli.ts`, add
  `reportIfOutdated()`: resolve the running package's `name`/`version` by
  reading `package.json` relative to `import.meta.url`
  (`dirname(fileURLToPath(import.meta.url))` + `'../package.json'` — resolves
  correctly both under `tsx src/cli.ts` in dev and compiled `build/cli.js`),
  call `checkForUpdate`, and `console.error` the returned message (padded
  with blank lines) if non-null. Wrap the whole body in try/catch so any
  failure here can never disrupt startup. Call it as `void
  reportIfOutdated()` at the very top of `main()`, before the `configure`
  branch and before PR fetch/server startup — fire-and-forget, never
  awaited.

- [x] T003 [artifacts: infrastructure] Manual verification (no automated
  test): temporarily lower `package.json`'s `version` below the currently
  published npm version, run `pnpm cli <ref>`, and confirm the update notice
  prints without delaying the `Fetching ...` / `serving at ...` output.
  Confirm `ASSISTED_REVIEW_NO_UPDATE_CHECK=1 pnpm cli <ref>` suppresses it.
  Revert the version bump afterward.

## Phase 2: Tests

- [x] T004 [artifacts: infrastructure] Create `tests/update-check.test.ts`
  covering `checkForUpdate`: `ASSISTED_REVIEW_NO_UPDATE_CHECK` skips the
  network call entirely; a newer registry version returns a message
  containing both versions and the package name; equal or
  ahead-of-registry local versions return `null`; a non-ok response, a
  rejected/thrown `fetch`, an unparseable registry version string, and a
  response missing the `version` field all return `null`; a cache hit
  within 24h skips a second `fetch` call (assert call count); a cache older
  than 24h triggers a re-check; an unparseable cache file on disk is
  treated as absent rather than thrown. Mock `globalThis.fetch` via
  `vi.spyOn` per `CLAUDE.md`'s HTTP-mocking convention; rely on
  `tests/setup-env.ts`'s per-run `ASSISTED_REVIEW_STATE_DIR` for cache-file
  isolation between test runs. Run `npx vitest run --coverage` to confirm
  `src/update-check.ts` sits at 100% branch/line coverage and the overall
  `src/**/*.ts` gate (90% statements/lines, `vitest.config.ts`) still
  passes.
