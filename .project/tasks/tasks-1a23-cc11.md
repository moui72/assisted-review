---
plan: plan-1a23-2026-07-22-7942.md
generated: 2026-07-22
status: in-progress
---

# Tasks

## Phase 1: Data and API contracts
- [x] T001 [artifacts: datamodel] Add an `AiProviderConfig` domain type and persistence helpers for `STATE_DIR/ai-config.json`, with defaults that preserve current behavior: missing config selects `provider: 'claude'`, blank/missing provider-specific model fields omit the subprocess model argument, and saving one provider's model preserves the inactive provider's model field.
- [x] T002 [artifacts: api] Add backend coverage for AI config persistence: default read with no file, valid updates for `claude` and `codex`, model-field preservation across provider switches, invalid provider rejection, and malformed/corrupt config recovery or clear error behavior matching the existing state-file test style.
- [x] T003 [artifacts: api] Add `GET /api/ai-config` and `POST /api/ai-config` routes using the new persistence helpers, returning normalized config JSON and rejecting invalid payloads without mutating the saved config.
- [x] T004 [artifacts: datamodel] Split review draft state so the submitted note payload is guarded by the SHA it was drafted against, not only the latest fetched `ReviewState.head_sha`. Preserve existing load/save compatibility for older state files while introducing the new drafted-against field.
- [x] T005 [artifacts: api, datamodel] Update note submission validation to reject stale drafted-against SHAs and add regression coverage for feedback F001 (`.project/feedback/feedback-head-sha-drafted-vs-fetched-co-a9d9.md`): fetch newer MR metadata after drafting a note, then confirm submitting the old draft is blocked.

## Phase 2: Provider-neutral stream boundary
- [x] T006 [artifacts: infrastructure] Inspect the installed `codex exec` CLI help/version and codify the exact non-interactive invocation in tests or adapter constants: model flag behavior, prompt/stdin handling, output streaming shape, and the closest available read-only/no-shell/no-web controls.
- [x] T007 [artifacts: infrastructure] Introduce an AI provider adapter boundary shared by Claude and Codex streams. The boundary should accept the built prompt, normalized `AiProviderConfig`, repo-investigation access options, SSE handlers, and cancellation signal while preserving the existing streamed event contract.
- [x] T008 [artifacts: infrastructure] Move current Claude subprocess streaming behind the provider adapter without changing default behavior, including optional `claude_model` argument handling, current prompt contract parsing, `onMessage`/`onAction`/`onError` events, and process cancellation.
- [x] T009 [artifacts: infrastructure] Add the Codex subprocess adapter using `codex exec`, optional `codex_model` argument handling, output normalization into the existing AI event contract, cancellation behavior, and clear adapter errors when the executable or required access constraints are unavailable.
- [x] T010 [artifacts: api, infrastructure] Add the canonical `GET /api/ai` SSE route that loads `AiProviderConfig`, dispatches to the selected adapter, preserves investigation modes and repo-access limits, and keeps `GET /api/claude` as a compatibility alias over the same implementation.
- [ ] T011 [artifacts: api, infrastructure] Add backend route/adapter tests for `/api/ai` and `/api/claude`: default Claude dispatch, Codex dispatch, provider-specific model argument forwarding, missing executable errors, cancellation cleanup, SSE event compatibility, and alias parity.

## Phase 3: Settings and stream controls
- [ ] T012 [artifacts: ui, api] Add frontend API helpers and client state for loading/saving AI config via `/api/ai-config`, including validation/error display consistent with existing settings controls.
- [ ] T013 [artifacts: ui] Extend Settings with AI provider and model controls: provider selection for Claude/Codex, provider-specific model inputs, persistence through the new API, defaults that show existing Claude behavior, and no loss of inactive provider model values when switching.
- [ ] T014 [artifacts: ui] Replace user-visible Claude-only commentary labels with provider-neutral AI language except where an explicit provider choice is being shown, preserving existing layout density and accessibility.
- [ ] T015 [artifacts: ui] Add Stop behavior for active AI streams: expose a Stop control while streaming, close the EventSource/request, call any backend cancellation path already used for review resets where appropriate, reset streaming UI state, and do not persist partial notes.
- [ ] T016 [artifacts: ui] Add Regenerate behavior for existing AI notes: remove the current generated note from local state, start a fresh empty-question AI request for the same chunk, show streaming/progress state, and handle failure without losing manually authored notes.
- [ ] T017 [artifacts: ui] Add frontend tests for AI settings, provider-neutral labels, Stop state reset, Regenerate replacement flow, and stale drafted-against SHA submit protection surfacing to the reviewer.

## Phase 4: Verification and compatibility
- [ ] T018 [artifacts: api, infrastructure, ui] Run the existing backend and frontend test suites, update snapshots only when behavior intentionally changed, and confirm legacy Claude commentary still works through `/api/claude`.
- [ ] T019 [artifacts: constitution, datamodel, api, infrastructure, ui] Run the project lint/build/e2e verification commands used by this repo, then update any artifact text or task references only for drift discovered during verification.
- [ ] T020 [parallel] Update user-facing docs or README references that still describe the commentary system as Claude-only, keeping provider-specific mentions only for installation/configuration details.
