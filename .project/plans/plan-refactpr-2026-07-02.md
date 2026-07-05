---
status: approved
branch: refactpr
created: 2026-07-02
features: [os-aware-keyboard-hints]
---

# Plan: OS-Aware Keyboard Hints (`detectMac()`)

## Goal

Replace `App.tsx`'s `navigator.userAgent` regex sniff for Mac/Windows
detection with a more robust mechanism that prefers `navigator.userAgentData`
where available, fixing both the cosmetic `⌘`/Ctrl glyph labels and the
actual keyboard-shortcut modifier dispatch.

## Scope

**In scope:**
- A new `detectMac()` helper (location: `web/src/` — e.g. `web/src/os.ts`)
  that:
  1. Prefers `navigator.userAgentData.platform` when present (Chromium
     browsers), matching against `mac`.
  2. Falls back to the existing `/mac|iphone|ipad/i.test(navigator.userAgent)`
     regex when `userAgentData` is unavailable (Safari, Firefox, older
     Chromium).
  - A narrow local TypeScript interface for the relevant slice of
    `NavigatorUAData` (just `{ platform?: string }`) — `CLAUDE.md` bans
    `any`, and `userAgentData` isn't in TS's default lib types.
- Replacing `App.tsx`'s module-level `IS_MAC` constant with a call to
  `detectMac()`, used identically at all three existing call sites
  (`App.tsx:254` modifier check, `App.tsx:454`/`461` `isMac` props into
  `HelpOverlay`/`ResponseBar`) — no change to how `isMac` flows into those
  components.
- Correcting `ui.md`'s Components entry for `ResponseBar.tsx` and removing
  its Production Annotation that mischaracterizes this as a purely cosmetic
  gap (see Technical Approach — already applied as part of this plan's
  artifact step).

**Out of scope:**
- Any other keyboard-shortcut behavior change. This plan only changes *how*
  Mac is detected, not what any shortcut does.
- A full `NavigatorUAData` type/polyfill package — a local minimal interface
  is sufficient for the one field used.
- Any other backlogged/confirmed-gap item tracked elsewhere in the
  artifacts.

## Technical Approach

Per `ui.md`'s (now-updated) Components section, `ResponseBar.tsx` and
`HelpOverlay.tsx` both receive `isMac: boolean` as a prop from `App.tsx`,
which currently derives it once at module scope via UA regex
(`App.tsx:37`). That same flag is also read directly inside `App.tsx`'s
keyboard handler (`App.tsx:254`: `const mod = IS_MAC ? e.metaKey :
e.ctrlKey;`) to decide which physical modifier key actually triggers
skip-to-next/prev-unviewed (⌘→/⌘← vs Ctrl+→/Ctrl+←). This means a
misdetection isn't just a wrong glyph — on a Mac wrongly detected as
non-Mac, the shortcut would require Ctrl+→, which collides with macOS's
built-in desktop-switching shortcut, silently breaking the feature for that
user. (`ui.md`'s prior Production Annotation described this as "low
stakes... only decides which glyph," which was incorrect; that annotation
is removed rather than reworded, since the fix here closes the gap
entirely rather than leaving a corrected-but-still-open risk.)

The fix keeps the existing single-detection-point architecture (one boolean,
computed once, threaded through as a prop) — no new state, no per-component
detection. Only the detection function itself changes:

```ts
// web/src/os.ts
interface UADataLike { platform?: string }

export function detectMac(nav: Navigator = navigator): boolean {
  const uaData = (nav as Navigator & { userAgentData?: UADataLike }).userAgentData;
  if (uaData?.platform) return /mac/i.test(uaData.platform);
  return /mac|iphone|ipad/i.test(nav.userAgent);
}
```

`App.tsx` replaces `const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgent);`
with `const IS_MAC = detectMac();`, imported from the new module. All three
existing consumption sites (`App.tsx:254`, `:454`, `:461`) are unchanged
otherwise.

**Coverage note:** `web/src/` is measured but not gated (per `CLAUDE.md`'s
Testing section), so a unit test for `detectMac()` is not strictly required
by the coverage gate — but it's cheap and worth adding given the function
takes an injectable `nav` parameter specifically to make it testable
(covering: `userAgentData` present + Mac, `userAgentData` present +
non-Mac, `userAgentData` absent falling back to UA regex).

**Known limitation (not a defect):** `navigator.userAgentData` is a
Chromium-only API — Safari and Firefox will always fall through to the UA
regex. This is the "graceful fallback" the feature description already
calls for, not a gap to annotate; framing it as complete would overstate
what ships (Chromium detection gets more robust, non-Chromium is unchanged
from today).

## Phase Breakdown

1. **Add `detectMac()` and wire it in** *(implements `os-aware-keyboard-hints`)*
   - Add `web/src/os.ts` with `detectMac()` as specified above.
   - Replace `App.tsx`'s `IS_MAC` derivation to call it.
   - Add `tests/components/os.test.ts` (or similar) covering the three
     branches above via the injectable `nav` param.
   - Demonstrable increment: keyboard-hint glyphs and shortcut dispatch
     behave identically to today on a real Mac/Chromium and Windows/Chromium
     browser, verified by running the app; unit tests pass.

2. **No further phases** — this is a single-file-surface swap with no
   dependent follow-on work.

## Complexity Tracking

No deviations from the simplicity principle — this plan adds one small,
directly-motivated helper function and no new abstraction layers.

## Open Questions

None — the feature's own description already specifies the fallback
strategy (`navigator.userAgentData` where available, graceful fallback),
and the plan resolves the one open design question (where to put the
narrow UA-data type) inline above.

## Production Annotation Summary

- None introduced. The one annotation this plan touches (`ui.md`'s
  Mac/Windows UA-sniffing risk) is removed as resolved, not replaced with a
  new one — see Technical Approach's "Known limitation" note for the
  Chromium-only caveat, which is documented as accepted scope rather than a
  gap.
