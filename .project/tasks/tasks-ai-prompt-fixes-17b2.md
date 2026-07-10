---
plan: plan-ai-prompt-fixes-2026-07-10.md
generated: 2026-07-10
status: in-progress
---

# Tasks

## Phase 1: Tool-refusal fix

- [x] T001 [artifacts: infrastructure] Add an `allowRepoRead: boolean`
  parameter to `buildPrompt` and `buildOverviewPrompt` in `src/claude.ts`.
  When `true`, replace the intro sentence "Answer only from the diff shown;
  do not use tools." with text that invites the model to use Read/Grep/Glob
  to investigate the repo (available at the process's `cwd`) in addition to
  the diff shown. When `false`/omitted, keep the existing diff-only intro
  unchanged. [feedback: feedback-investigation-mode-tool-refusal-4e7d F001]
- [x] T002 In `src/server.ts`'s `/api/claude` handler, derive a boolean from
  the existing `streamOpts` computation (non-`undefined` means repo access
  was granted — `local-path`/`temp-clone`/`always-clone` modes) and pass it
  as `allowRepoRead` to both `buildOverviewPrompt(...)` and `buildPrompt(...)`
  call sites. [feedback: feedback-investigation-mode-tool-refusal-4e7d F001]
- [x] T003 [parallel] Add unit tests in `tests/claude.test.ts` (or the
  existing test file covering `buildPrompt`/`buildOverviewPrompt`) asserting:
  `allowRepoRead: true` produces the investigation-inviting intro sentence
  and omits "do not use tools"; `allowRepoRead: false`/omitted produces the
  original diff-only intro, for both builder functions.

## Phase 2: Conversation context

- [ ] T004 [artifacts: ui, api] Add an optional `history?: StoredNote[]`
  parameter to `buildPrompt` and `buildOverviewPrompt` in `src/claude.ts`.
  When non-empty, render prior notes (excluding `kind: 'error'`) as a
  transcript block ahead of the new question/instruction — one entry per
  note using its existing kind label convention (`initial` → "You
  summarized:", `investigation` → "Reviewer asked: \"<prompt>\" / You
  answered:"), followed by each note's `body`. When `history` is
  empty/omitted, prompt output is unchanged (byte-identical to before this
  task). [feedback: feedback-ask-ai-conversation-context-6109 F001]
- [ ] T005 In `src/server.ts`'s `/api/claude` handler, before invoking the
  builders, gather prior notes for the target `chunk_id` (or `OVERVIEW_ID`
  for the overview) from `review.notes` — i.e. `review.notes.filter(n =>
  n.chunk_id === (isOverview ? OVERVIEW_ID : chunk!.id))` — and pass them as
  `history` to `buildPrompt`/`buildOverviewPrompt`. This must run before the
  new question's own note is added to state, so the new question is never
  included in its own history. [feedback: feedback-ask-ai-conversation-context-6109 F001]
- [ ] T006 [parallel] Add unit tests in `tests/claude.test.ts` asserting: a
  follow-up call with non-empty `history` includes prior turns' prompts and
  bodies in the built prompt; a call with empty/omitted `history` produces
  output identical to the pre-existing (no-history) behavior; a `history`
  entry with `kind: 'error'` is excluded from the rendered transcript.

## Phase 3: Markdown rendering for chunk-panel notes

- [ ] T007 [artifacts: ui] In `web/src/components/AiCommentary.tsx`'s `Note`
  component, replace the plain-text `{note.body}` render (currently inline
  inside the `<p>` at the component's body) with
  `<Markdown className="...">{note.body}</Markdown>`, importing `Markdown`
  from `./Markdown.tsx` (already used identically in `OverviewView.tsx`).
  Preserve existing typography as closely as possible via the `className`
  prop and any surrounding markup adjustments needed since `Markdown`
  renders a block-level `<div>`, not inline text — adjust the `live`
  streaming-cursor placement and the `suggested_action` block if their
  layout assumptions (e.g. cursor appended inline after `{note.body}`)
  no longer hold once `note.body` is block-level.
  [feedback: feedback-ai-note-followup-rendering-3deb F001]
- [ ] T008 [parallel] Add a component test under `tests/components/`
  (`// @vitest-environment jsdom` docblock, matching this project's existing
  component-test convention) rendering `AiCommentary` with a `StoredNote`
  whose `body` contains markdown (bold text, a fenced code block, and a
  bullet list) and asserting the rendered output contains actual formatted
  elements (e.g. a `<strong>`, a `<code>`/`<pre>`, and `<li>` elements) —
  not the raw markdown source text.
