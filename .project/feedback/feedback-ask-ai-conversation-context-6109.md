---
status: open
created: 2026-07-10
plan: null
---

# Feedback

## Bugs
- [ ] F001 The "Ask Claude" follow-up input doesn't behave like an
  interactive/conversational session — each question is answered from a
  freshly built prompt containing only the diff hunk and the new question
  text (`buildPrompt()`/`buildOverviewPrompt()` in `src/claude.ts`), with no
  prior turns included. The initial AI analysis (the `initial`-kind note)
  and any earlier `investigation`-kind follow-up notes for the same chunk
  are not passed into the prompt for a subsequent follow-up question, so
  Claude has no memory of what it already said or what the reviewer asked
  before — each turn is effectively a cold restart rather than a
  continuation. Fix should thread prior `StoredNote`s for the same
  `chunk_id` (or overview, via `OVERVIEW_ID`) into the prompt as
  conversation history before appending the new question.
  [artifacts: ui, api]
