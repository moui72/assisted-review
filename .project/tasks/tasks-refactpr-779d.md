---
plan: plan-refactpr-2026-07-02.md
generated: 2026-07-02
status: completed
---

# Tasks

## Phase 1: `detectMac()` helper and wiring

- [x] T001 [artifacts: ui] Create `web/src/os.ts` exporting `detectMac(nav: Navigator = navigator): boolean`. Implementation: define a local `interface UADataLike { platform?: string }`; if `(nav as Navigator & { userAgentData?: UADataLike }).userAgentData?.platform` is present, return `/mac/i.test(...)` against it; otherwise fall back to `/mac|iphone|ipad/i.test(nav.userAgent)` (the exact regex currently inlined at `web/src/App.tsx:37`). No `any` — use the narrow local interface per `CLAUDE.md`'s strict-TypeScript rule. Do not touch `App.tsx` in this task.

- [x] T002 [artifacts: ui] [parallel] Add `tests/components/os.test.ts` (jsdom docblock per `CLAUDE.md`'s frontend testing convention) covering `detectMac()`'s three branches by passing a fake `nav` object into the function: (1) `userAgentData.platform` present and matches `mac` → `true`; (2) `userAgentData.platform` present and non-Mac (e.g. `'Windows'`) → `false`; (3) `userAgentData` absent, `userAgent` falls back to the Mac/iPhone/iPad regex → verify both a match (`true`) and non-match (`false`) case. Depends on T001 (imports `detectMac` from `web/src/os.ts`), otherwise touches no other file — safe to write in parallel with T003.

- [x] T003 [artifacts: ui] In `web/src/App.tsx`, replace the module-level `const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgent);` (line 37) with an import of `detectMac` from `./os.ts` and `const IS_MAC = detectMac();`. Do not change any of the three existing consumption sites (`App.tsx:254`'s `const mod = IS_MAC ? e.metaKey : e.ctrlKey;`, and the `isMac={IS_MAC}` props passed to `HelpOverlay`/`ResponseBar` around lines 454/461) — this task only changes how `IS_MAC` is derived, not how it's used. Depends on T001 (the `detectMac` export must exist).

## Phase 2: Verify

- [x] T004 [artifacts: ui] Run the full test suite (`npx vitest run`) and confirm `os.test.ts` passes and nothing else regresses. Manually verify in the browser (per the plan's demonstrable-increment criterion): keyboard-hint glyphs (Help overlay, response bar) and the ⌘/Ctrl+→/← skip-to-unviewed shortcut behave identically to before the change, on whatever platform/browser is available for testing. Depends on T002 and T003.
