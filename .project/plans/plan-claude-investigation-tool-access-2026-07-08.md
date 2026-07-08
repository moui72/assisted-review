---
status: approved
branch: claude-investigation-tool-access
created: 2026-07-08
features: []
surfaced-defects: []
---

# Plan: Claude Investigation Tool Access

## Goal

Let a reviewer opt a repo into deeper Claude investigation access — full
content of diff-touched files, or full repo exploration — replacing the
strictly diff-only default with a reviewer-chosen, per-repo, persisted mode
(`feedback-claude-investigation-tool-acce-3d5a.md` F001).

## Scope

**In scope**
- Five investigation modes (`InvestigationConfig.mode`, `datamodel.md`):
  `none` (today's behavior, still the default until chosen), `local-path`,
  `api`, `temp-clone`, `always-clone` — per `infrastructure.md`'s Repo
  Investigation Access section.
- Persisted per-`owner/repo` choice (`investigation-config.json` in
  `STATE_DIR`), so a repo is prompted once, not every review.
- `GET`/`POST /api/investigation-config` (`api.md`).
- `src/claude.ts` changes: `streamClaude` gains optional `cwd` +
  relaxed-tools support; `buildPrompt`/`buildOverviewPrompt` gain an
  `api`-mode full-file-content augmentation path.
- Clone lifecycle: `gh repo clone`/`glab repo clone` into `STATE_DIR/repos/`,
  freshness fetch+checkout for `always-clone`, temp-clone cleanup on review
  close, a 30-day-idle-TTL prune sweep on startup for `always-clone`, and an
  orphaned-temp-clone sweep (>24h old) on startup.
- UI: `InvestigationModal.tsx` (five choices, tradeoffs spelled out
  including `api` mode's explicit scope limit), a dismissible banner that
  opens it the first time a repo has no config, and a Settings panel entry
  to revisit the choice.

**Out of scope**
- Any change to the `'none'` mode's behavior or its prompts — it's
  byte-for-byte the pre-existing diff-only path.
- A configurable pruning TTL (env var) — the 30-day default ships as a fixed
  constant; see Open Questions.
- An explicit "`git` not installed" actionable error for clone modes beyond
  whatever `gh repo clone`/`glab repo clone` themselves surface — see
  Production Annotation Summary.
- Disk-usage caps/quotas on `always-clone` storage — TTL-only pruning for
  now (`infrastructure.md` Production Annotations).

## Technical Approach

Per the updated `datamodel.md` (`InvestigationConfig`), `api.md`
(`GET`/`POST /api/investigation-config`, and the note on `GET /api/claude`
consulting it), `infrastructure.md` (Repo Investigation Access section), and
`ui.md` (`InvestigationModal`, the investigation-access banner, and the
Settings panel entry).

The core mechanism is a single new lookup consulted right before every
`streamClaude()` call in the `GET /api/claude` route handler
(`src/server.ts`): resolve the active review's `InvestigationConfig` (new
`src/investigation.ts` module, mirroring `src/state.ts`'s
read/atomic-write/lookup shape but keyed by `platform:owner/repo` in one
JSON map file rather than one file per entry), then branch:

- `none` → today's call, unchanged (`cwd: tmpdir()`, all tools disallowed).
- `local-path`/`temp-clone`/`always-clone` → same call, but `cwd` becomes
  the resolved path and `Read`/`Grep`/`Glob` are dropped from
  `NO_TOOLS`/`--disallowed-tools`. `temp-clone`/`always-clone` first ensure
  the clone exists/is fresh (clone-if-missing, fetch+checkout-if-stale for
  `always-clone`).
- `api` → no `cwd`/tools change; instead `buildPrompt`/`buildOverviewPrompt`
  receive an extra parameter (fetched file contents, keyed by path) and
  append a "Full file contents" block per diff-touched file.

`InvestigationConfig` writes only ever happen from
`POST /api/investigation-config` (validate → clone-if-needed → persist),
never implicitly from the `GET /api/claude` path, keeping "choosing a mode"
and "using a mode" cleanly separated — the same separation `state.ts`/
`update-check.ts` already use between config and its consumption.

## Phase Breakdown

### Phase 1 — Data model, storage, and config API [artifacts: datamodel, infrastructure, api]

1. Add `InvestigationConfig` to `src/types.ts` (mirroring `datamodel.md`'s
   table), re-exported for the frontend per the existing `web/src/api.ts`
   re-export convention.
2. Create `src/investigation.ts`: `loadInvestigationConfig(pr)` /
   `saveInvestigationConfig(config)` against a single
   `investigation-config.json` map in `STATE_DIR`, atomic tmp-then-`rename()`
   write (same pattern as `state.ts`/`update-check.ts`); missing/corrupt
   file treated as "no configs yet," not an error.
3. Add `GET`/`POST /api/investigation-config` to `src/server.ts`: `GET`
   returns the resolved config (or the default `{ mode: 'none', ... }`
   shape) for the active review's repo; `POST` validates the mode enum and
   (`local-path`-only) that `local_path` exists as a directory (`400`
   otherwise), persists, and returns the config. Clone-triggering logic
   (Phase 4) is stubbed as a TODO comment here, wired in later.
4. Tests: `src/investigation.ts` (load/save/missing-file/corrupt-file), the
   two new routes (`400`s, `503` with no active review, success cases) —
   module-mock `node:fs/promises` per `CLAUDE.md`'s testing convention.

Deliverable: config persists and round-trips through the API; `local-path`
validation works end-to-end. No `claude.ts`/UI changes yet.

### Phase 2 — `local-path` and `api` modes in Claude invocation (depends on Phase 1) [artifacts: infrastructure]

1. `src/claude.ts`: `streamClaude(prompt, handlers, opts?)` — `opts.cwd`
   (default `tmpdir()`) and `opts.allowRepoRead` (default `false`, meaning
   today's full `NO_TOOLS` list; `true` drops `Read`/`Grep`/`Glob` from it).
2. Add `fetchFileContent(pr, path, sha)` to `src/fetch.ts` (GitHub: `gh api
   repos/{owner}/{repo}/contents/{path}?ref={sha}`, base64-decoded; GitLab:
   `glab api projects/:id/repository/files/{encoded path}/raw?ref={sha}` via
   `glab`, REST-fallback equivalent via `restFetch` when `glab` is
   unavailable — same dispatch pattern as every other GitLab call in
   `src/fetch.ts`).
3. `src/claude.ts`: `buildPrompt`/`buildOverviewPrompt` accept an optional
   `fileContents: Map<string, string>` param; when non-empty, append a "Full
   file contents" block per file (clipped like the diff itself).
4. `src/server.ts`'s `GET /api/claude` handler: resolve
   `InvestigationConfig`, branch on `mode` — `local-path` passes `cwd:
   config.local_path, allowRepoRead: true`; `api` pre-fetches content for
   every unique file in the chunk(s) covered by this call and passes
   `fileContents`.
5. Tests: `streamClaude` opts (spawn args reflect `cwd`/tools correctly, via
   the existing `child_process` mock convention), `fetchFileContent` for
   both platforms (mocked `execFile`/`fetch`), prompt-builder augmentation
   output, and the route branching (mocked `InvestigationConfig` lookups).

Deliverable: choosing `local-path` or `api` (once `InvestigationConfig` is
manually written to disk — no UI yet) visibly changes what Claude can see,
verified via a manual run against a real local checkout.

### Phase 3 — Clone machinery: `temp-clone`/`always-clone` (depends on Phase 1) [artifacts: infrastructure]

1. `src/investigation.ts`: `ensureClone(config)` — `gh repo clone
   <owner>/<repo> <dest>` (GitHub) or `glab repo clone <owner/repo> <dest>`
   (GitLab, reusing `glabAvailable()`), into `STATE_DIR/repos/tmp-<random>`
   (`temp-clone`) or `STATE_DIR/repos/<platform>-<owner>-<repo>`
   (`always-clone`) — computed path stored back into `clone_path`.
2. `src/investigation.ts`: `refreshCloneIfStale(config, headSha)` —
   `always-clone` only: if the config's last-known sha ≠ `headSha`, runs
   `git fetch` + `git checkout <headSha>` (detached) in `clone_path`, then
   updates the recorded sha.
3. Wire `POST /api/investigation-config` (Phase 1, previously stubbed) to
   call `ensureClone` synchronously for `temp-clone`/`always-clone` before
   persisting; `502` with the clone error if it fails, config not persisted.
4. Wire `GET /api/claude`'s mode branch (Phase 2) to pass `cwd:
   config.clone_path, allowRepoRead: true` for both clone modes, calling
   `refreshCloneIfStale` first for `always-clone`.
5. Cleanup: `DELETE /api/review` and `POST /api/reviews/open` (when
   switching away from a repo with an active `temp-clone`) remove that
   repo's temp clone directory (best-effort, errors swallowed). CLI startup
   (`src/cli.ts`) sweeps `STATE_DIR/repos/tmp-*` older than 24h.
6. Pruning: on CLI startup, sweep `investigation-config.json` for
   `always-clone` entries with `last_used` older than 30 days — delete the
   clone directory, reset that entry to `mode: 'none'`.
7. Tests: `ensureClone`/`refreshCloneIfStale`/prune sweep (mocked
   `execFile`), cleanup-on-close/switch, startup sweeps.

Deliverable: `temp-clone`/`always-clone` work end-to-end via direct API
calls (`curl`/manual `POST /api/investigation-config`); clones appear under
`STATE_DIR/repos/`, get cleaned up/pruned as designed.

### Phase 4 — UI: modal, banner, Settings entry (depends on Phases 1–3) [artifacts: ui]

1. `web/src/components/InvestigationModal.tsx` (modeled on
   `GitLabAuthModal.tsx`'s structure): five-choice picker with tradeoff copy
   per mode (`api` mode's scope limit stated explicitly), a text input for
   `local-path`'s directory, Save → `POST /api/investigation-config`, a
   "Cloning…" busy state for the two clone modes.
2. Investigation-access banner (`ErrorBanner`-styled) in the AI panel,
   shown when `GET /api/investigation-config` returns the unset-default
   shape; opens `InvestigationModal` on click; dismissing it (local state,
   not persisted) hides it for that session only — it reappears next time
   the repo is opened until a mode is explicitly chosen.
3. `SettingsPanel.tsx`: new "Investigation access" row showing the current
   mode with a button reopening `InvestigationModal`.
4. `web/src/api.ts`: `fetchInvestigationConfig()` /
   `saveInvestigationConfig()` thin wrappers, following the existing
   fetch-helper convention.
5. Tests (`tests/components/`, jsdom): modal renders all five choices,
   `local-path` reveals the path input, Save calls the right endpoint with
   the right body, banner shows/hides correctly, Settings row reflects the
   current mode.

Deliverable: full end-to-end flow through the running app — open a review
for a repo with no config, see the banner, choose a mode, confirm Claude's
answers reflect the new access level.

### Phase 5 — Manual verification and full-suite check (depends on Phase 4)

1. Manual: for a repo with a local checkout available, verify `local-path`
   lets Claude answer a "what does this function do elsewhere in the repo"
   follow-up question it couldn't answer under `none`. Verify `api` mode
   answers correctly from full file content but explicitly declines/can't
   answer questions about files outside the diff. Verify `temp-clone`
   cleans up after closing the review (dir gone from `STATE_DIR/repos/`).
2. `npx vitest run --coverage` — full suite green, `src/**/*.ts` above the
   90% statements/lines gate.
3. `npx tsc -p tsconfig.json --noEmit` and `npx eslint .` clean.

Deliverable: shippable end-to-end feature, green suite.

## Complexity Tracking

| Deviation | Justification |
|---|---|
| New persisted config type (`InvestigationConfig`), first entity keyed per-repo rather than per-PR | Required to avoid re-prompting every review session (explicit product requirement from the feedback item) — reuses the existing atomic-write JSON-file pattern rather than inventing new storage machinery |
| New external dependency on `git` (via `gh repo clone`/`glab repo clone`) | Only invoked for two of five modes, both opt-in and off by default (`mode: 'none'`); reuses existing `gh`/`glab` auth rather than adding new credential handling |
| Clone lifecycle/pruning machinery (freshness check, temp cleanup, TTL sweep) | Unavoidable once persistent local clones exist — a stale or ever-growing clone directory is a correctness/disk-usage bug, not a nice-to-have. Kept intentionally simple: fixed TTL, no LRU/quota logic |

## Open Questions

- Is the fixed 30-day `always-clone` idle TTL the right default, or should
  it be configurable via an env var from the start? Shipping fixed for now;
  revisit if it proves wrong in practice (`infrastructure.md`'s Repo
  Investigation Access section already documents this as a tunable-if-needed
  default, not a permanent decision).
- Should there be a repo-size or total-clone-count warning before a
  reviewer opts into `always-clone` on a very large repo? Not addressed
  this pass — flagged in `infrastructure.md`'s Production Annotations.

## Production Annotation Summary

- `infrastructure.md` — "`always-clone` has no total disk-usage cap": TTL
  pruning only, no size/count ceiling.
- `infrastructure.md` — "Clone-mode reviewers implicitly need `git` on
  PATH": no explicit absence check/actionable hint before attempting a
  clone-mode clone, unlike this codebase's usual "is X installed?" pattern.
