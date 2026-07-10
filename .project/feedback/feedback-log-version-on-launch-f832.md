---
status: planned
created: 2026-07-10
plan: plan-log-version-on-launch-2026-07-10.md
---

# Feedback

## UX
- [x] F001 `assisted-review` should log which version is in use when launched.
  Today `src/update-check.ts`'s update-check only emits a `console.error` line
  when a *newer* version is available (see `infrastructure.md` "npm Registry
  (update check)" section) — there's no message telling the user what version
  they're currently running when nothing is outdated. Add a startup line
  (`console.error`, per the CLI-output convention) stating the current
  version regardless of update-check outcome. [artifacts: infrastructure]
- [x] F002 The running version should also be displayed in the UI, not just
  logged to the console at CLI startup. `ui.md` has no existing mention of a
  version display (no header/footer element carries it today) — this is new
  surface area, not a tweak to an existing one. [artifacts: ui]
