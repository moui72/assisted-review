---
status: draft
branch: feedback-preload-loading-state
created: 2026-07-06
features: []
surfaced-defects: []
---

# Plan: Preload Loading State

## Goal

When a background AI preload targets the chunk or overview the user is
currently viewing, show the same loading indication used for a foreground
ask and disable the redundant new-request controls, instead of preloading
silently and letting a duplicate request cancel it.

## Scope

**In scope**
- Track which target (a chunk id, or `OVERVIEW_ID`) a background preload is
  currently fetching, via a new `preloadTargetId` state in `App.tsx`.
- Extend the shared `aiPanel.busy` derivation (currently
  `streaming?.chunkId === activeId`) to also cover
  `preloadTargetId === activeId`, so `AiCommentary` and `OverviewView`'s
  `Summary` disable their Ask/Explain/Summarize/regenerate controls and show
  the existing pulsing-cursor busy treatment while a same-target preload is
  in flight — no new component-level plumbing, since both already derive
  their loading UI from `busy`/`streaming`.
- Change `askClaude`'s current unconditional "cancel any in-flight preload,
  then start a fresh request" behavior to a same-target no-op: if
  `preloadTargetId === activeId`, do nothing (the preload already satisfies
  this request); if a preload is in flight for a *different* target, keep
  cancelling it and proceeding, exactly as today.
- Component tests for both of the above.

**Out of scope**
- Any UI change for preloads of chunks/views the user isn't currently
  looking at — those stay fully silent, per `ui.md`'s narrowed (not
  reversed) decision.
- Streaming live partial text during a preload — `onDelta` stays a no-op;
  the loading indicator is a static busy/pulsing state, not a token-by-token
  preview, matching the "swallow preload errors, don't surface partial
  work" design already in place.
- Any backend/API change — this is client-side state wiring only.

## Technical Approach

Add `preloadTargetId: string | null` state in `web/src/App.tsx`, parallel to
the existing `streaming` state. Set it to `next` immediately before the
preload effect's `streamClaude(...)` call (`App.tsx`'s background-preloading
`useEffect`, ~line 107-135); clear it to `null` in that call's `onDone`,
`onError`, and the effect's cleanup function (covers cancellation from
navigation or a preload-config change).

`aiPanel.busy` (currently `streaming?.chunkId === activeId`, ~line 423)
becomes `streaming?.chunkId === activeId || preloadTargetId === activeId`.
`aiPanel.streaming` is left unchanged — it still only reflects genuine
foreground text, since preloads never populate live text. The busy-but-no-
streaming-text case already renders acceptably with no component changes:
`OverviewView`'s `Summary` shows its pulsing cursor unconditionally inside
the `ai.busy` branch even when `ai.streaming` is null, and
`AiCommentary`'s Ask/Explain button already switches to `…` and disables via
the existing `busy` prop.

`askClaude`'s guard (~line 251-278) currently does: bail if `!activeId` or a
foreground `streaming` is active; otherwise unconditionally call
`preloadCancelRef.current?.()` to cancel any in-flight preload before
starting. Change this to: if `preloadTargetId === activeId`, return (no-op —
the in-flight preload already covers this exact ask); otherwise keep
cancelling an unrelated in-flight preload and proceeding, unchanged from
today.

## Phase Breakdown

### Phase 1 — Preload target tracking and busy wiring (feedback: reconsidered `ui.md` decision, bug investigation folded in)

1. Add `preloadTargetId` state in `App.tsx`; set/clear it around the preload
   effect's `streamClaude` call as described above.
2. Extend the `aiPanel.busy` derivation to include
   `preloadTargetId === activeId`.
3. Manual verification: reload the app landing on the Overview page: observe
   the Summarize input/button disable and the pulsing-cursor indicator
   appear while the automatic overview-summary preload is in flight, then
   watch it re-enable and show the summary once the preload completes.
   Repeat by navigating to an unread chunk with `preload_chunks > 0` and
   confirming the same busy treatment appears for that chunk's own
   background preload.

Deliverable: a same-view in-flight preload is now visibly loading and its
controls are disabled — closes the feedback's Reconsidered item and
explains the Bugs item (preload was already firing; it just wasn't visible).

### Phase 2 — Prevent duplicate same-target requests (depends on Phase 1)

1. Change `askClaude`'s preload-interaction guard to the same-id no-op /
   different-id cancel-and-proceed split described in Technical Approach.
2. Manual verification: while a chunk's background preload is in flight and
   you're viewing that same chunk, confirm the Explain button/`a` shortcut
   does nothing extra (already disabled per Phase 1, and a direct call would
   no-op) — no duplicate `POST` fires. Navigate to a *different* chunk that
   also has its own in-flight preload target and confirm asking there still
   cancels that chunk's preload and proceeds with the foreground ask,
   preserving today's intentional behavior for the non-same-target case.

Deliverable: no duplicate Claude requests for a target already being
preloaded; unrelated-preload-interrupts-foreground-ask behavior unchanged.

### Phase 3 — Component tests (depends on Phase 1 & 2)

1. Add or extend component tests (jsdom) covering:
   - `busy` derives `true` when `preloadTargetId === activeId`, even with
     `streaming` null, and disables the Ask/Explain button and the
     Summarize/regenerate controls.
   - Submitting an ask while the same-target preload is in flight does not
     invoke `onAsk`/fire a duplicate request.
   - Submitting an ask for a *different*, non-preloading target proceeds
     normally (regression check — no accidental over-blocking).
   Run `npx vitest run` to confirm the full suite stays green.

Deliverable: green suite with coverage for the new branch paths (frontend
coverage measured but not gated, per `constitution.md` Quality Standards).

## Complexity Tracking

None — reuses the existing `streaming`/`busy` derivation pattern already in
place for foreground asks; no new abstractions or dependencies.

## Open Questions

None.

## Production Annotation Summary

None — no new production shortcuts introduced. This closes an existing UX
gap rather than creating one.
