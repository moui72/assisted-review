---
name: ui
status: stable
last_updated: 2026-07-01
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

## Components

Shared across views, listed by concern:

- **`TopNav.tsx`** — PR/MR identity (`prKey`), chunk position indicator
  (viewed/flagged/commented state per chunk, rendered as a mini progress
  strip), and entry points to Help, Reviews menu, Settings, and Submit.
- **`ResponseBar.tsx`** — bottom action bar on chunk pages: comment textarea,
  anchor display/clear, flag/mark-viewed/mark-unread/ask-AI/next/prev
  buttons, each annotated with its keyboard shortcut (`Kbd`). Mac vs.
  Ctrl-key labels driven by `isMac` passed down from `App.tsx`'s
  `IS_MAC` (`navigator.userAgent` sniff).
- **`AiCommentary.tsx`** — renders the note list (`DisplayNote[]`) for
  whichever id is active (chunk or `OVERVIEW_ID`), the ask-AI input, the
  live streaming buffer while a request is in flight, and per-note delete.
  Distinguishes `initial`/`context`/`investigation`/`error` note kinds
  visually.
- **`SubmitModal.tsx`** — verdict picker (GitHub `VERDICTS` vs. GitLab
  `GITLAB_VERDICTS`, chosen by `review.pr.platform`), summary body, and the
  submit action; surfaces `SubmitResponse` outcomes including the stale-SHA
  warning and per-comment `comment_errors` from a partial GitLab failure.
- **`ReviewsMenu.tsx`** — lists saved reviews (`ReviewSummary[]` via
  `fetchReviews()`), lets the user switch to or delete one, or open a new
  ref. Largest component by line count — combines list, open-by-ref input,
  and delete confirmation in one panel.
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
  affordance beyond reloading. **Confirmed gap** (not intentional): this is
  inconsistent with every other degrade path (Jira, Claude, submit), which
  are all recoverable-in-place banners. Future work should replace this
  terminal state with an in-place retry affordance (re-run
  `fetchReview()`/`fetchState()`) rather than requiring a manual page reload.
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
  stale-SHA warning (offers re-fetch), and partial-failure
  (`comment_errors` list) — all handled inside `SubmitModal`, not lifted to
  `App.tsx`.
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
