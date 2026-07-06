---
plan: plan-feedback-preload-loading-state-2026-07-06.md
generated: 2026-07-06
status: ready
---

# Tasks

## Phase 1: Preload target tracking and busy wiring

- [ ] T001 [artifacts: ui] In `web/src/App.tsx`, add a new
  `preloadTargetId` state (`useState<string | null>(null)`), declared
  alongside the existing `streaming` state. In the background-preloading
  `useEffect` (~line 107-135, the one that calls
  `findNextPreload(review, state, index, preloadConfig,
  preloadAttemptedRef.current)` and then `streamClaude(...)` for the
  resulting `next` id): set `preloadTargetId` to `next` immediately before
  the `streamClaude` call, and clear it back to `null` in that call's
  `onDone` callback, its `onError` callback, and in the effect's cleanup
  function (the `return () => { cancel(); preloadCancelRef.current = null;
  }` block) — the cleanup case covers cancellation from navigation
  (`index` change) or a preload-config change, so `preloadTargetId` never
  stays stuck pointing at an abandoned target.

- [ ] T002 [artifacts: ui] In `web/src/App.tsx`, extend the `aiPanel.busy`
  derivation (~line 423, currently `busy: streaming?.chunkId ===
  activeId`) to `busy: streaming?.chunkId === activeId || preloadTargetId
  === activeId`. Leave `aiPanel.streaming` (~line 422) unchanged — it
  should continue to reflect only genuine foreground streaming text, not
  the silent preload. No changes needed in `AiCommentary.tsx` or
  `OverviewView.tsx`: both already render their busy/loading state
  (pulsing cursor, disabled Ask/Explain/Summarize/regenerate controls,
  button label switching to `…`) purely off the `busy` prop, and
  `OverviewView`'s `Summary` component shows its pulsing cursor
  unconditionally inside the `ai.busy` branch even when `ai.streaming` is
  `null`.

- [ ] T003 [artifacts: ui] Manual verification (no automated test): with a
  live dev server (`pnpm dev`), open the Settings panel and enable preload
  (`preload_overview: true`, `preload_chunks` ≥ 1) if not already the
  default. Reload landing on the Overview page: confirm the "Summarize this
  PR" control area shows the busy/pulsing-cursor treatment and the ask
  input/button are disabled while the automatic overview-summary preload
  is in flight, then confirm it re-enables and shows the generated summary
  once the preload completes. Repeat by navigating to an unread chunk that
  has its own upcoming-chunk preload in flight and confirm the same busy
  treatment appears in `AiCommentary` for that chunk.

## Phase 2: Prevent duplicate same-target requests (depends on Phase 1)

- [ ] T004 [artifacts: ui] In `web/src/App.tsx`'s `askClaude` callback
  (~line 251-278): keep the existing early return `if (!activeId ||
  streaming) return;` unchanged. Replace the unconditional
  `preloadCancelRef.current?.(); preloadCancelRef.current = null;` cancel
  call with a branch: if `preloadTargetId === activeId`, `return` (no-op —
  an in-flight preload already covers this exact ask; do not cancel it and
  do not start a new request). Otherwise (a preload is in flight for a
  *different* target, or none at all), keep cancelling
  `preloadCancelRef.current` and proceed to start the new stream exactly as
  today.

- [ ] T005 [artifacts: ui] Manual verification (no automated test): with
  preload enabled, navigate to a chunk whose own background preload is
  currently in flight (its Explain/Ask controls should already show
  disabled per T003). Confirm no duplicate `/api/claude` request appears in
  the browser devtools network tab (or `read_network_requests` if using
  Chrome automation) for that same chunk while its preload is still
  running. Then navigate to a *different* chunk that has its own separate
  in-flight preload target, and immediately ask a question there: confirm
  that chunk's preload is cancelled and the foreground ask's request
  proceeds normally — this is a regression check that the different-target
  cancel-and-proceed behavior from before this plan is unchanged.

## Phase 3: Component tests (depends on Phase 1 & 2)

- [ ] T006 [artifacts: ui] Create `tests/components/App.preload.test.tsx`
  (`// @vitest-environment jsdom` docblock, mirroring the mock/fixture
  structure in `tests/components/App.test.tsx` — same `review`/`meta`/
  `chunk` fixtures and the `vi.mock('../../web/src/api.ts', ...)` pattern —
  but with its own `vi.mock` block that additionally mocks
  `streamClaude: vi.fn()` alongside `fetchConfig`, `fetchReview`,
  `fetchState`, and `postAction`; `streamClaude` isn't mocked in the
  existing `App.test.tsx` mock block, so it needs adding here). Set
  `fetchConfig` to resolve `{ preload_chunks: 1,
  preload_overview: true }` so the background-preload effect actually
  fires in these tests. For each test, capture the `onDelta`/`onDone`/
  `onError` callbacks passed into the mocked `streamClaude` calls (via
  `vi.mocked(streamClaude).mock.calls`) so the test can manually invoke
  them to simulate a preload completing, matching the
  manual-callback-driving style used for `postAction` in the existing
  `App.test.tsx` re-anchoring test. Cover:
  - On initial render (landing on Overview, preload enabled), `streamClaude`
    is called once for the overview target before any user action, and
    while its callbacks haven't fired yet, the "Summarize this PR"
    button/input reflect the busy state (disabled, per T002's `busy` wiring)
    even though no foreground `streaming` state exists.
  - Manually invoking that call's captured `onDone` with a `ReviewState`
    containing the new summary note re-enables the controls and renders the
    summary body.
  - While the overview preload's `onDone`/`onError` has not yet been
    invoked (i.e., `preloadTargetId` still equals the overview target),
    triggering the "Summarize this PR" action again does not cause a second
    `streamClaude` call — assert `streamClaude`'s call count stays at 1.
  - Navigating to a chunk with its own separate in-flight preload target
    and asking a question there causes a *new* `streamClaude` call (for the
    foreground ask) and cancels the previous (different-target) preload's
    stream — asserting the earlier preload call's returned cancel function
    was invoked and a new call was made — as a regression check against
    over-blocking.
  Run `npx vitest run` to confirm the full suite (including these new
  tests) passes green. Frontend coverage is measured but not gated
  (`CLAUDE.md`/`constitution.md` Quality Standards) — no coverage
  threshold to hit, just exercise the new branch paths.
