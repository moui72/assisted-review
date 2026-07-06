---
plan: plan-inline-comment-editing-ui-2026-07-05.md
generated: 2026-07-05
status: in-progress
---

# Tasks

## Phase 1: Edit affordance and wiring

- [ ] T001 [artifacts: ui] In `web/src/components/DiffPane.tsx`, give `CommentCard`
  card-local editing state (`useState` for `isEditing` and a draft body string,
  seeded from `comment.body` on entering edit mode). Add an **Edit** button next
  to the existing delete button. When editing, replace the body `<div>` with a
  `<textarea>` prefilled with the draft body, plus **Save** and **Cancel**
  buttons. Save is `disabled` when the trimmed draft body is empty (mirror the
  `hasDraft = draft.trim().length > 0` pattern from
  `web/src/components/ResponseBar.tsx:58`). Pressing `Escape` while the
  textarea is focused cancels (discards the local draft, no call) — this piggybacks
  on the existing global `TEXTAREA`-focus-suppresses-shortcuts rule
  (`web/src/App.tsx:289`), so no new keydown listener is needed at the
  `App.tsx` level; wire the `onKeyDown` directly on the textarea instead. Add
  a new `onUpdateComment: (id: string, body: string) => void` prop to
  `CommentCard`, and thread it through as a new `onUpdateComment` prop on the
  exported `DiffPane` component (alongside the existing `onDeleteComment`),
  passed to both `CommentCard` call sites (inline, `indented`, and whole-chunk).
  On Save, call `onUpdateComment(comment.id, draftBody)` and exit edit mode.

- [ ] T002 [artifacts: ui] In `web/src/components/ChunkView.tsx`, add an
  `onUpdateComment: (id: string, body: string) => void` prop to `ChunkView`'s
  props (alongside `onDeleteComment`) and pass it through to the nested
  `DiffPane` (`web/src/components/ChunkView.tsx:57-63`).

- [ ] T003 [artifacts: ui, datamodel] In `web/src/App.tsx`, implement the
  `onUpdateComment` handler passed to `ChunkView` (near the existing
  `onDeleteComment={(id) => void dispatch({ type: 'delete_comment', id })}`
  at `web/src/App.tsx:468`): `onUpdateComment={(id, body) => void
  dispatch({ type: 'update_comment', id, body })}`. This reuses the existing
  `dispatch` helper (`web/src/App.tsx:152`, `async (action: Action) => ...`)
  and the already-implemented `update_comment` reducer case
  (`src/state.ts:224`) — no backend change. `dispatch` already adopts the
  server-returned `ReviewState` on success, matching every other mutation.

- [ ] T004 [artifacts: ui] Manual verification (no automated test): run the
  app, open a chunk, add a comment, click Edit, change the body, Save — confirm
  the updated body renders and persists across a page reload (i.e.
  `updated_at` bump round-trips through `POST /api/action`). Repeat for a
  whole-chunk comment (the "on this chunk" section). Confirm Cancel and
  `Escape` both discard the edit with no visible change and no network call
  (check via browser devtools network tab or `read_network_requests` if using
  Chrome automation).

## Phase 2: Component tests

- [ ] T005 [artifacts: ui] Create `tests/components/DiffPane.test.tsx`
  (`// @vitest-environment jsdom` docblock, matching the convention in
  `tests/components/OverviewView.test.tsx` / `SubmitModal.test.tsx`). Render
  `DiffPane` with a stub `DraftComment` and cover:
  - clicking Edit enters edit mode and shows a textarea prefilled with the
    comment body
  - clicking Save calls `onUpdateComment` with the comment's `id` and the
    (possibly edited) body, and the card exits edit mode afterward
  - clicking Cancel discards the change (no `onUpdateComment` call) and exits
    edit mode, restoring the original body
  - pressing `Escape` in the textarea behaves the same as Cancel (no call)
  - Save is `disabled` when the textarea is cleared to empty/whitespace-only
  Run `npx vitest run` to confirm the full suite (including these new tests)
  passes green. Frontend coverage is measured but not gated
  (`CLAUDE.md`/`constitution.md` Quality Standards) — no coverage threshold to
  hit, just exercise the new branches.
