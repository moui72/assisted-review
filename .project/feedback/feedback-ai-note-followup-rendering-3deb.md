---
status: open
created: 2026-07-10
plan: null
---

# Feedback

## Bugs
- [ ] F001 The Ask Claude follow-up note ("asked · ...") in the chunk panel
  renders as one unbroken block of plain text — the raw markdown from the
  agent's response (bold `**...**`, code fences, bullet lists) is not being
  parsed/rendered, so headers, code blocks, and list items all run together
  on top of each other instead of being formatted. Screenshot shows a
  concrete example: a follow-up note with a "**The issue:**" bold lead-in,
  a fenced ```ts``` code block, and a bullet list, all displayed as flat
  unformatted text. Compare against how the `initial`/`investigation` note
  bodies are rendered elsewhere (likely markdown-to-HTML via existing
  hljs/escapeHtml pipeline per CLAUDE.md) to see whether follow-up notes are
  using a different, unformatted rendering path. [artifacts: ui]
