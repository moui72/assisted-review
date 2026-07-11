---
status: planned
created: 2026-07-10
plan: plan-readme-and-ux-fixes-2026-07-11.md
---

# Feedback

## UX
- [x] F001 The Overview page's footer button always reads "Begin review →", even after the reviewer has already viewed one or more chunks and returned to the Overview. It should read something like "Resume review" once any chunk has been viewed — i.e. the state becomes "dirty" as soon as `state.viewed` is non-empty, not only once every chunk is viewed. [artifacts: ui]
