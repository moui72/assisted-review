---
status: approved
branch: ai-prompt-fixes
created: 2026-07-10
features: []
surfaced-defects: []
---

# Plan: AI/prompt fixes

## Goal

Fix three bugs in the Claude-commentary path: investigation-mode tool
refusal, missing conversational context on follow-up questions, and
unformatted markdown in chunk-panel follow-up notes.

## Scope

**In scope:**
- `src/claude.ts`'s `buildPrompt`/`buildOverviewPrompt` — stop hard-coding
  "do not use tools" when repo access is actually granted.
- Threading prior `StoredNote`s for the same `chunk_id`/`OVERVIEW_ID` into
  the prompt as conversation history before a follow-up question.
- `web/src/components/AiCommentary.tsx`'s `Note` component — render
  `note.body` through the existing `Markdown` component instead of as raw
  text, matching `OverviewView.tsx`'s existing pattern.

**Out of scope:** Cmd+C fix, Overview "Resume review" button, README
rewrite — separate feedback files, deliberately left for other plans.

## Technical Approach

- **Tool-refusal fix**: `buildPrompt`/`buildOverviewPrompt` currently take no
  signal about repo-read access; the caller (`src/server.ts`'s `/api/claude`
  handler) already computes this (`allowRepoRead: true` for
  `local-path`/`temp-clone`/`always-clone` modes, passed to `streamClaude`'s
  `opts`, but never to the prompt builders). Add an `allowRepoRead: boolean`
  parameter to both builders; when true, swap the intro line from "Answer
  only from the diff shown; do not use tools" to text inviting Read/Grep/Glob
  investigation of the repo at `cwd`. Thread the same boolean the server
  already derives (`streamOpts !== undefined`, or expose it explicitly)
  through to both builder call sites.
- **Conversation context**: both builders gain an optional
  `history?: StoredNote[]` parameter — prior notes for the same
  `chunk_id`/`OVERVIEW_ID`, passed from `server.ts` (`review.notes.filter(n
  => n.chunk_id === chunkId)` before calling `applyAction`, so the new
  question isn't yet in that list). Render history as a labeled transcript
  block ("Reviewer asked: ... / You answered: ...") ahead of the new
  question, using the same kind labels the UI already shows (`initial`,
  `investigation`). Skip `error`-kind notes — nothing useful to replay.
  Only applies when there's at least one prior note; unchanged (cold-start)
  prompt otherwise.
- **Markdown rendering**: `AiCommentary.tsx`'s `Note` renders `{note.body}`
  as a plain text child at line 36; swap for
  `<Markdown className="...">{note.body}</Markdown>` (reusing
  `web/src/components/Markdown.tsx`, already used identically in
  `OverviewView.tsx`), matching existing styling classes as closely as
  possible via the `className` prop.

## Phase Breakdown

### Phase 1 — Tool-refusal fix
1. Add `allowRepoRead` param to `buildPrompt`/`buildOverviewPrompt`
   (`src/claude.ts`); branch the intro text on it.
   `[artifacts: infrastructure] [feedback:
   feedback-investigation-mode-tool-refusal-4e7d F001]`
2. Pass the resolved repo-access boolean from `server.ts`'s `/api/claude`
   handler into both builder call sites.
   `[feedback: feedback-investigation-mode-tool-refusal-4e7d F001]`
3. Unit tests: `buildPrompt`/`buildOverviewPrompt` produce the
   investigation-inviting intro when `allowRepoRead` is true, and the
   original diff-only intro when false/omitted.

### Phase 2 — Conversation context (depends on Phase 1's signature changes landing first, same functions)
4. Add `history?: StoredNote[]` param to `buildPrompt`/`buildOverviewPrompt`;
   render prior non-error notes as a transcript block before the new
   question.
   `[artifacts: ui, api] [feedback:
   feedback-ask-ai-conversation-context-6109 F001]`
5. In `server.ts`'s `/api/claude` handler, gather prior notes for the target
   `chunk_id`/`OVERVIEW_ID` from `review.notes` (before the new question's
   note is added) and pass them through.
   `[feedback: feedback-ask-ai-conversation-context-6109 F001]`
6. Unit tests: a follow-up question's prompt includes prior turns when they
   exist; unchanged when there are none; `error`-kind notes excluded.

### Phase 3 — Markdown rendering for chunk-panel notes
7. `AiCommentary.tsx`'s `Note`: replace the plain-text `note.body` render
   with `<Markdown>`, matching `OverviewView.tsx`'s existing usage.
   `[artifacts: ui] [feedback: feedback-ai-note-followup-rendering-3deb
   F001]`
8. Component test (`tests/components/`) confirming a note body containing
   markdown (bold, code fence, bullet list) renders as formatted HTML
   elements, not raw text.

## Complexity Tracking

None — all three fixes are localized, no new abstractions introduced.

## Open Questions

None.

## Production Annotation Summary

None introduced by this plan.
