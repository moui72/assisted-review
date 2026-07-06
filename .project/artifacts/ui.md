---
name: ui
status: stable
last_updated: 2026-07-05
diagram_status: stale
---

# UI

## Overview

A single-page React 19 + Tailwind v4 app (`web/src/`) rendering exactly one
review at a time, paginated one chunk (or the overview) per screen with
slide transitions (`motion`/framer-motion-style `AnimatePresence`). Target
user: a single reviewer working through one PR/MR end-to-end, primarily via
keyboard, with the mouse/trackpad as a secondary input for text entry and
menus. Dark/light theme is a first-class, persisted user preference, not an
afterthought — theming runs entirely through CSS custom properties (no
`tailwind.config.js`; utilities map to the variables via `@theme inline` —
see `CLAUDE.md`).

The app is a thin client over the API in `api.md` — almost all state (`state:
ReviewState`) is server-authoritative and re-fetched/re-set after every
mutating call; local React state exists mainly for UI-only concerns
(navigation index, draft text before submission, streaming buffer, which
modal is open).

## Views

All views are orchestrated by `App.tsx`, which owns navigation (`index`:
`-1` = overview, `0..N-1` = chunk), the active Claude stream, and drafts.

### Splash (`Splash.tsx`)

Shown when the server has no active review and hasn't finished its initial
load-attempt failure state. Lets the user type/paste a ref and open it
(`POST /api/reviews/open`). Distinct from the plain "Loading…" state shown
before the first `fetchReview()`/`fetchState()` resolves.

### Overview (`OverviewView.tsx`)

The `index === -1` page. Shows PR/MR title, description (rendered as
markdown), and Jira context (linked issue(s) + epic, or a setup banner via
`ErrorBanner` if Jira is unavailable — see `datamodel.md`'s `JiraContext`).
Hosts the AI panel scoped to `OVERVIEW_ID` — ask Claude to summarize the
whole PR or answer a question about it. `onBegin` jumps to chunk 0.

When `state.comments` contains any `displaced: true` entries (see
`datamodel.md`'s Anchor Reconciliation), a **Displaced Comments** section
renders here — the only place they're shown, since a displaced comment has
no current chunk to attach to. Each entry shows the comment body plus its
last-known `file`/`hunk_header` snapshot, with a "Re-anchor" button that
jumps into `ChunkView` in anchor-picking mode (see `ResponseBar.tsx` below).
Displaced notes and flags are surfaced in the same section for visibility,
but read-only — no re-anchor affordance for them (see `api.md`'s
`reanchor_comment`); a note can only be deleted and a flag only cleared.

This exclusivity isn't just a byproduct of a displaced entry's `chunk_id` no
longer resolving — Anchor Reconciliation retains the *last-known* `chunk_id`
rather than clearing it (see `datamodel.md`), so after chunks are renumbered
that stale id could coincidentally match a real (but unrelated) chunk.
`App.tsx` enforces the exclusion explicitly: `chunkComments`, `isFlagged`,
`storedNotes`, `commentedIds`, and the `flagged` array passed to `TopNav`
all filter out `displaced: true` entries before doing any chunk-id lookup.
Without this filter, a displaced comment/flag could silently reappear
anchored to the wrong chunk in `ChunkView` or as the wrong tick in `TopNav`'s
progress strip, instead of surfacing in Displaced Comments.

### Chunk (`ChunkView.tsx`)

The primary review screen — one per `Chunk`. Composes `DiffPane` (the actual
diff rendering) and the AI panel (`AiCommentary`) scoped to that chunk's id.
Shows existing draft/persisted comments for the chunk and lets the user
select a line to anchor a new one.

### Diff rendering (`DiffPane.tsx`)

Renders a `Chunk`'s merged diff as a two-column-aware row list (`diffRows()`
in `web/src/diff.ts`), with per-line-type background coloring (`ROW_BG`
lookup) and syntax highlighting via `highlight.js` (`highlightLine`/`langFor`
in `web/src/highlight.ts` — languages registered manually there; adding a new
language is a documented one-line change per `README.md`). Clicking a line
sets the comment anchor (`Anchor { side, line }`).

Saved comments render inline beneath their anchored line (or in a
whole-chunk section) as `CommentCard`s. Each card offers **Edit** and
**Delete**: Edit swaps the card body into an editing state — a textarea
prefilled with the comment body plus Save/Cancel — and Save dispatches the
existing `update_comment` action (`api.md`'s `POST /api/action`), re-syncing
server-authoritative state as with every other mutation. Cancel (button or
Escape) discards the local draft with no round-trip. Editing state is
card-local React state, not lifted to `App.tsx`.

## Components

Shared across views, listed by concern:

- **`TopNav.tsx`** — PR/MR identity (`prKey`), chunk position indicator
  (viewed/flagged/commented state per chunk, rendered as a mini progress
  strip), and entry points to Help, Reviews menu, Settings, and Submit.
- **`ResponseBar.tsx`** — bottom action bar on chunk pages: comment textarea,
  anchor display/clear, flag/mark-viewed/mark-unread/ask-AI/next/prev
  buttons, each annotated with its keyboard shortcut (`Kbd`). Mac vs.
  Ctrl-key labels driven by `isMac` passed down from `App.tsx`'s
  `detectMac()` helper (prefers `navigator.userAgentData.platform` where
  available — Chromium browsers — falling back to the `navigator.userAgent`
  regex elsewhere). When entered in re-anchor mode (from a displaced
  comment's "Re-anchor" button on the Overview page), it reuses the existing
  line-click-to-anchor flow (`DiffPane`'s `Anchor { side, line }` selection)
  instead of the normal "new comment" flow — selecting a line dispatches
  `reanchor_comment` for that specific comment id rather than `add_comment`,
  and there's no textarea shown since the comment body already exists.
- **`AiCommentary.tsx`** — renders the note list (`StoredNote[]`, see
  `datamodel.md`) for whichever id is active (chunk or `OVERVIEW_ID`), the
  ask-AI input, the live streaming buffer while a request is in flight
  (a `NotePreview`), and per-note delete (gated by a `deletableNoteIds` set
  so a mock note's fake id can't offer a no-op delete button).
  Distinguishes `initial`/`context`/`investigation`/`error` note kinds
  visually.
- **`SubmitModal.tsx`** — verdict picker (GitHub `VERDICTS` vs. GitLab
  `GITLAB_VERDICTS`, chosen by `review.pr.platform`), summary body, and the
  submit action; surfaces `SubmitResponse` outcomes including the stale-SHA
  warning. A GitLab partial failure (`ok: false` with `comment_errors` — see
  `api.md`) renders a dedicated banner listing which comments failed,
  distinct from the generic error message, and keeps the submit button
  available labeled "Retry submission" rather than "Submit as …" — clicking
  it dispatches another `POST /api/submit`, which skips whatever already
  posted (`state.gitlab_submit_progress`, `datamodel.md`) instead of
  reposting duplicates.
- **`ReviewsMenu.tsx`** — modal container: fetches `ReviewSummary[]` via
  `fetchReviews()`, owns open/switch/dismiss/confirm state, and composes
  three focused subcomponents rather than rendering everything itself:
  - **`OpenReviewForm.tsx`** — the ref input + "Open" button for launching a
    review by reference.
  - **`ReviewsList.tsx`** — the saved-reviews list (per-item switch/dismiss
    buttons, progress summary via its `Progress`/`prLabel` helpers).
  - **`DeleteReviewConfirm.tsx`** — the confirmation footer shown when
    dismissing the currently active review, including the
    switch-vs-clear-session messaging.
- **`SettingsPanel.tsx`** — theme toggle (delegates to `useTheme()`) and
  preload behavior (`preload_chunks` count, `preload_overview` on/off),
  persisted to `localStorage` (`ar-preload-chunks`, `ar-preload-overview`)
  layered over the server default from `GET /api/config`.
- **`HelpOverlay.tsx`** — static keyboard-shortcut reference (`Row`/`Binding`
  list), toggled by `?`.
- **`ErrorBanner.tsx`** — generic inline error/warning banner, reused for
  Jira setup hints, Claude errors, and submit failures.
- **`Markdown.tsx`** — thin `react-markdown` + `remark-gfm` wrapper; all
  element styling lives in a single `.md` CSS class so markdown content
  themes with the rest of the app rather than carrying its own styles.
- **`Logo.tsx`** — theme-aware logo/icon swap (separate light/dark SVG
  assets in `web/public/`).

## States

- **Initial load**: `Logo` + pulsing "Loading…" until `fetchReview()` +
  `fetchState()` both resolve (parallel `Promise.all`).
- **No active review, load succeeded**: `Splash` (ref entry).
- **Load error**: full-screen `Error: {message}` (red-on-bg), no retry
  affordance beyond reloading — see Production Annotations below.
- **Streaming AI response**: `AiCommentary` shows the in-progress buffer
  (`streaming.text`, growing via `onDelta`) with a busy indicator; the ask
  input is disabled (`busy: streaming?.chunkId === activeId`) while a
  request for *that* id is in flight, but streaming is otherwise
  non-blocking for navigation.
- **AI error**: `claudeError` rendered via `ErrorBanner` in the AI panel;
  cleared automatically on navigation (`activeId` change) or on starting a
  new ask.
- **Background preload**: silent — no dedicated UI state. Preloading walks
  upcoming chunks (per `findNextPreload()` in `web/src/preload.ts`) one at a
  time, only when nothing else is streaming, and swallows errors by simply
  advancing its attempt-tracking set (`preloadAttemptedRef`) rather than
  surfacing them to the user.
- **Submit**: modal-local states for in-flight, success (with permalink),
  stale-SHA warning (offers re-fetch), and GitLab partial-failure
  (`comment_errors` list, retry-available — see `SubmitModal.tsx` above) —
  all handled inside `SubmitModal`, not lifted to `App.tsx`.
- **Displaced comments** (Overview page only): rendered whenever
  `state.comments`/`notes`/`flagged` contains any `displaced: true` entry
  (see `datamodel.md`'s Anchor Reconciliation) — a dedicated section, not a
  dismissible banner, since these need an actual action (re-anchor, delete,
  or unflag) rather than just acknowledgment. Comments show a "Re-anchor"
  button; notes and flags are read-only there (delete/unflag only).
  Displaced comment *bodies* are also read-only — no Edit affordance in this
  section (a deliberate scope decision, not an omission): editing happens
  after re-anchoring, keeping the displaced section single-purpose.
- **Comment editing** (`DiffPane`'s `CommentCard`): card-local editing state
  — textarea prefilled with the body, Save/Cancel. Save is disabled on an
  empty/whitespace-only body (matching the add-comment rule); Escape cancels.
  Multiple cards *can* technically enter editing independently (state is
  per-card), which is acceptable — no global "one edit at a time" lock.
  While a card's textarea has focus, global keyboard shortcuts are suppressed
  by the existing focus-in-`TEXTAREA` rule — no new bindings.
- **Empty/zero-chunk PR**: A PR/MR with zero chunks (e.g., a diff-less or
  fully-binary-file PR) still renders `OverviewView` — `index` defaults to
  `-1`, so there is always a view to render; `jump()`'s `!total` guard only
  prevents navigating *into* a chunk, it doesn't affect which view shows.
  `OverviewView`'s footer branches on `chunkCount === 0`: instead of "Review
  N chunks one at a time." plus a "Begin review →" button (which would
  otherwise be wired to a `jump(0)` that silently no-ops), it renders a
  single "No reviewable changes in this PR/MR." message and omits the button
  entirely — distinct from `Splash`, which is "no review open" rather than
  "review open but has nothing to show."

## Keyboard Model

Global `keydown` listener in `App.tsx`, disabled while focus is in a
`TEXTAREA`/`INPUT`, with modal-specific short-circuits (Submit/Reviews/
Settings/Help each only listen for `Escape` while open). Full binding table
is in `README.md` and mirrored in `HelpOverlay.tsx`; notably `→`/`←` (or
`j`/`k`/`n`/`p`) navigate without side effects, `⌘→`/`⌘←` (Ctrl on
Win/Linux) skip to the next/previous *unviewed* chunk, and `↵` both marks
viewed and advances (the only navigation key with a persistence side
effect).

## Production Annotations

- **Load error has no in-place retry** — the full-screen `Error: {message}`
  state (see States above) is inconsistent with every other degrade path
  (Jira, Claude, submit), which are all recoverable-in-place banners. Not
  intentional. Future work should replace this terminal state with an
  in-place retry affordance (re-run `fetchReview()`/`fetchState()`) rather
  than requiring a manual page reload.
