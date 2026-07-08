---
plan: plan-claude-investigation-tool-access-2026-07-08.md
generated: 2026-07-08
status: in-progress
---

# Tasks

## Phase 1: Data model, storage, and config API

- [x] T001 [artifacts: datamodel] Add `InvestigationConfig` to `src/types.ts`
  matching `datamodel.md`'s table: `platform: 'github' | 'gitlab'`, `owner:
  string`, `repo: string`, `mode: 'none' | 'local-path' | 'api' |
  'temp-clone' | 'always-clone'`, `local_path?: string`, `clone_path?:
  string`, `chosen_at: string`, `last_used?: string`. Re-export it from
  `web/src/api.ts` alongside the existing re-exported types (`import type`
  convention, `CLAUDE.md`).

- [ ] T002 [artifacts: infrastructure] Create `src/investigation.ts` with
  `loadInvestigationConfigs(): Promise<Record<string, InvestigationConfig>>`
  and `saveInvestigationConfigs(configs): Promise<void>` against a single
  `investigation-config.json` file in `STATE_DIR` (import from `./state.js`),
  keyed by `` `${platform}:${owner}/${repo}` ``. Use the same atomic
  tmp-then-`rename()` write as `saveState()`/`update-check.ts`. On
  missing/corrupt file, `loadInvestigationConfigs` returns `{}` rather than
  throwing (same "never block on a broken cache" convention as
  `update-check.ts`). Add `getInvestigationConfig(pr: PrRef):
  Promise<InvestigationConfig>` returning the stored entry, or a default
  `{ mode: 'none', platform, owner, repo, chosen_at: '' }` shape if unset.

- [ ] T003 [artifacts: infrastructure] Tests for `src/investigation.ts`:
  load with no file (empty map), load with a valid file, load with corrupt
  JSON (treated as empty, not thrown), save-then-load round-trip,
  `getInvestigationConfig` returns the default shape for an unconfigured
  repo and the stored entry for a configured one. Mock
  `node:fs/promises` per `CLAUDE.md`'s module-mock convention.

- [ ] T004 [artifacts: api, infrastructure] Add `GET`/`POST
  /api/investigation-config` routes to `src/server.ts`. `GET`: `503` if no
  active review; otherwise returns `getInvestigationConfig(ctx.review.pr)`.
  `POST`: `503` if no active review; body `{ mode, local_path? }`; `400` if
  `mode` isn't one of the five valid values; `400` if `mode === 'local-path'`
  and `local_path` is missing or (via `fs.stat`) not an existing directory.
  For `mode` in `{'temp-clone', 'always-clone'}`, leave a `// TODO(Phase 3):
  call ensureClone here` comment — clone-triggering isn't wired yet. On
  validation success, persist via `saveInvestigationConfigs` (merging into
  the existing map) with `chosen_at: new Date().toISOString()`, return the
  saved config.

- [ ] T005 [artifacts: api] [parallel] Tests for the two new routes in
  `src/server.ts`'s existing test file: `GET` returns default shape for an
  unconfigured repo and the stored one after a `POST`; `GET`/`POST` both
  `503` with no active review; `POST` `400` on invalid `mode`; `POST` `400`
  on `local-path` with a missing/non-directory `local_path`; `POST` success
  persists and is retrievable via a subsequent `GET`.

## Phase 2: `local-path` and `api` modes in Claude invocation

- [ ] T006 [artifacts: infrastructure] In `src/claude.ts`, give
  `streamClaude` a third optional parameter `opts?: { cwd?: string;
  allowRepoRead?: boolean }`. `cwd` defaults to `tmpdir()` as today.
  `allowRepoRead` (default `false`) controls whether `Read`/`Grep`/`Glob`
  are included in `--disallowed-tools`: build the list as `NO_TOOLS` (today's
  constant, keep `Bash Edit Write WebFetch WebSearch Task NotebookEdit`
  always) plus `Read Grep Glob` only when `allowRepoRead` is falsy. Pass
  `spawn`'s `cwd` from `opts.cwd`.

- [ ] T007 [artifacts: infrastructure] [parallel] Add
  `fetchFileContent(pr: PrRef, path: string, sha: string): Promise<string |
  null>` to `src/fetch.ts`. GitHub: `gh api
  repos/{owner}/{repo}/contents/{path}?ref={sha}` via `execFileAsync`,
  base64-decode the `.content` field of the parsed JSON stdout. GitLab: via
  `glabAvailable()` dispatch — `glab api
  projects/:id/repository/files/{encodeURIComponent(path)}/raw?ref={sha}`
  when `glab` is present, else the REST-fallback equivalent
  (`{gitlabBaseUrl()}/api/v4/projects/{id}/repository/files/{encoded
  path}/raw?ref={sha}` via `restFetch`-style `fetch()` with the
  `PRIVATE-TOKEN` header, same pattern as `fetchGitLabDiffREST`). Return
  `null` on any failure (404, auth failure, network error) — callers treat a
  missing file as "skip it," not a hard error, matching every other
  optional-integration degrade path in `infrastructure.md`.

- [ ] T008 [artifacts: infrastructure] In `src/claude.ts`, add an optional
  `fileContents?: Map<string, string>` parameter to `buildPrompt` and
  `buildOverviewPrompt`. When non-empty, append one "Full file contents:
  {path}" block per entry to the prompt, each clipped via the existing
  `clip()` helper to the same `MAX_DIFF_CHARS` bound used for the diff
  itself (prevents one huge file from blowing out the whole prompt).
  Depends on T006 (same file, sequential).

- [ ] T009 [artifacts: infrastructure, api] In `src/server.ts`'s `GET
  /api/claude` handler, before calling `streamClaude`: resolve
  `getInvestigationConfig(ctx.review.pr)`. Branch on `mode`: `'none'` (or
  unset) → call as today; `'local-path'` → pass `opts: { cwd:
  config.local_path, allowRepoRead: true }`; `'api'` → for every unique
  `file` among the chunk(s) this call covers, call `fetchFileContent`
  (skip `null` results), pass the resulting `Map` into
  `buildPrompt`/`buildOverviewPrompt`. `'temp-clone'`/`'always-clone'` are
  left as a `// TODO(Phase 3)` fall-through to `'none'`'s behavior for now.
  Depends on T004, T006, T007, T008.

- [ ] T010 [artifacts: infrastructure] Tests for `streamClaude`'s new
  `opts` — assert the spawned `child_process.spawn` call's `cwd` and
  `--disallowed-tools` args reflect `allowRepoRead`/`cwd` correctly in both
  the default and repo-read-enabled cases (existing `child_process` mock
  convention). Depends on T006.

- [ ] T011 [artifacts: infrastructure] [parallel] Tests for
  `fetchFileContent`: GitHub success/`404`-as-null, GitLab via `glab`
  success/failure-as-null, GitLab REST-fallback success/failure-as-null
  (mock `execFile`/`fetch` per existing `fetch.test.ts` conventions). Also
  test `buildPrompt`/`buildOverviewPrompt`'s `fileContents` augmentation
  (block present when non-empty, clipped at the char bound, absent when the
  map is empty/omitted). Depends on T007, T008.

- [ ] T012 [artifacts: infrastructure, api] Tests for the `GET
  /api/claude` mode-branching logic: `'none'` unchanged behavior,
  `'local-path'` passes the right `opts` to a mocked `streamClaude`, `'api'`
  fetches content for the right file set and passes it through. Depends on
  T009.

## Phase 3: Clone machinery — `temp-clone`/`always-clone`

- [ ] T013 [artifacts: infrastructure] In `src/investigation.ts`, add
  `ensureClone(config: InvestigationConfig): Promise<string>` (returns the
  clone path). For `mode === 'temp-clone'`: destination
  `STATE_DIR/repos/tmp-{randomUUID()}`. For `mode === 'always-clone'`:
  destination `STATE_DIR/repos/{platform}-{owner}-{repo}` (deterministic —
  reused across calls instead of re-cloning if it already exists). Clone via
  `execFileAsync('gh', ['repo', 'clone', '{owner}/{repo}', dest])` for
  GitHub, or (via `glabAvailable()`) `execFileAsync('glab', ['repo',
  'clone', '{owner}/{repo}', dest])` for GitLab — both reuse existing
  `gh`/`glab` auth, no new credential handling. Throws (caller's job to turn
  into `502`) if the clone command fails. Depends on T002 (same file).

- [ ] T014 [artifacts: infrastructure] In `src/investigation.ts`, add
  `refreshCloneIfStale(config: InvestigationConfig, headSha: string):
  Promise<void>` — no-op unless `config.mode === 'always-clone'` and
  `config.last_used`'s recorded sha (store it as part of the config write,
  reusing the existing `InvestigationConfig` shape's implicit "last sha
  used" via a comparison against the clone's current `git rev-parse HEAD`)
  differs from `headSha`. When stale: `execFileAsync('git', ['fetch'], {cwd:
  config.clone_path})` then `execFileAsync('git', ['checkout', headSha],
  {cwd: config.clone_path})`. Depends on T013 (same file, sequential).

- [ ] T015 [artifacts: api, infrastructure] Wire `POST
  /api/investigation-config` (`src/server.ts`, T004's stub) to call
  `ensureClone` for `'temp-clone'`/`'always-clone'` before persisting.
  `502 { error: <clone error message> }` if it throws, and do **not**
  persist the config in that case (same "don't record success that didn't
  happen" convention as `POST /api/submit`). On success, store the returned
  path in `clone_path` before saving. Depends on T004, T013.

- [ ] T016 [artifacts: api, infrastructure] Wire `GET /api/claude`'s mode
  branch (T009's `'temp-clone'`/`'always-clone'` TODO) to pass `opts: {
  cwd: config.clone_path, allowRepoRead: true }`, calling
  `refreshCloneIfStale` first when `mode === 'always-clone'`. Depends on
  T009, T014.

- [ ] T017 [artifacts: infrastructure] Cleanup: in `src/server.ts`,
  `DELETE /api/review` and `POST /api/reviews/open` (when the review being
  replaced had `mode: 'temp-clone'`) delete that repo's temp clone
  directory (best-effort — wrap in try/catch, swallow errors, same pattern
  as the existing state-file-delete best-effort comment). In `src/cli.ts`,
  on startup, sweep `STATE_DIR/repos/tmp-*` directories older than 24h
  (mtime-based) and remove them — orphan cleanup for a crashed/kill-9'd
  process that never got to clean up its own temp clone. Depends on T013.

- [ ] T018 [artifacts: infrastructure] Pruning: in `src/investigation.ts`,
  add `pruneStaleClones(): Promise<void>` — for every `'always-clone'`
  entry in `investigation-config.json` whose `last_used` is more than 30
  days old, delete `clone_path` and reset that entry's `mode` to `'none'`
  (clearing `clone_path`/`local_path`), then save. Call it once from
  `src/cli.ts` on startup, fire-and-forget (`void pruneStaleClones()`,
  matching `update-check.ts`'s non-blocking-startup convention — never
  delay CLI startup on this). Depends on T014.

- [ ] T019 [artifacts: infrastructure] Tests: `ensureClone` (GitHub/GitLab
  success, clone-command failure throws, `always-clone` reuses an existing
  `clone_path` without re-cloning), `refreshCloneIfStale` (no-op when sha
  matches, fetch+checkout when stale, no-op for non-`always-clone` modes),
  `pruneStaleClones` (prunes entries older than 30 days, leaves recent ones,
  resets `mode` correctly), the `DELETE /api/review`/`POST
  /api/reviews/open` temp-clone cleanup, and the startup orphan-tmp-sweep.
  Mock `execFile`/`fs` per existing conventions. Depends on T013–T018.

## Phase 4: UI — modal, banner, Settings entry

- [ ] T020 [artifacts: ui] Create `web/src/components/InvestigationModal.tsx`,
  modeled on the structure of `GitLabAuthModal.tsx` (fixed-overlay container,
  header/body/footer, `open`/`onClose`/`onSuccess` props). Body: five
  radio-style choices (`none`/`local-path`/`api`/`temp-clone`/
  `always-clone`) each with a one-to-two-sentence tradeoff description
  matching `ui.md`'s copy (notably `api` mode's explicit "changed files
  only, not the whole repo" limit). Selecting `local-path` reveals a text
  input for the directory. Save button calls the new
  `saveInvestigationConfig()` API wrapper (T023); disabled while saving,
  showing "Cloning…" as the busy label specifically for the two clone modes
  (vs. "Saving…" for the other three) since those calls are slower.
  `ErrorBanner` on failure, matching `GitLabAuthModal.tsx`'s error-display
  pattern.

- [ ] T021 [artifacts: ui] Add the investigation-access banner: in the AI
  panel area shared by `OverviewView`/`ChunkView` (wherever `ErrorBanner` is
  already used for the Jira setup hint, per `ui.md`), show a dismissible
  banner when `fetchInvestigationConfig()` (T023) returns the unset-default
  shape (`chosen_at === ''`). Clicking it opens `InvestigationModal`
  (T020). Dismissal is local component state only (not persisted) — the
  banner reappears next time the repo is opened until a mode is actually
  chosen. Depends on T020.

- [ ] T022 [artifacts: ui] [parallel] Add an "Investigation access" row to
  `web/src/components/SettingsPanel.tsx` showing the current
  `InvestigationConfig.mode` (fetched via T023) with a button that opens
  `InvestigationModal` (T020) to change it. Depends on T020.

- [ ] T023 [artifacts: api, ui] [parallel] Add `fetchInvestigationConfig()`
  / `saveInvestigationConfig(mode, local_path?)` thin wrappers to
  `web/src/api.ts`, following the existing fetch-helper convention (see
  `fetchReviews`/`authenticateGitLab` for the pattern — JSON body, throw on
  non-ok with the parsed `{ error }` message).

- [ ] T024 [artifacts: ui] Component tests (`tests/components/`, jsdom
  docblock): `InvestigationModal` renders all five choices, selecting
  `local-path` reveals the path input, Save calls
  `saveInvestigationConfig` with the right args and calls `onSuccess` on
  completion, error response renders via `ErrorBanner`; the banner
  shows/hides based on the fetched config and opens the modal on click;
  `SettingsPanel`'s new row reflects the current mode and opens the modal.
  Depends on T020–T023.

## Phase 5: Manual verification and full-suite check

- [ ] T025 [artifacts: infrastructure, ui] Manual verification, run against
  the real app: for a repo with a local checkout available, set `mode:
  'local-path'` and confirm Claude can answer a follow-up question about
  code outside the diff that it couldn't answer under `'none'`. Set `mode:
  'api'` and confirm it answers correctly from full file content for a
  diff-touched file, but is unable to answer about a file outside the diff
  (confirms the documented scope limit holds in practice). Set `mode:
  'temp-clone'`, confirm the clone appears under `STATE_DIR/repos/`, then
  close the review (`DELETE /api/review`) and confirm the clone directory
  is gone.

- [ ] T026 Run `npx vitest run --coverage` (full suite green, `src/**/*.ts`
  above the 90% statements/lines gate per `constitution.md`'s Quality
  Standards), `npx tsc -p tsconfig.json --noEmit`, and `npx eslint .` — all
  clean.
