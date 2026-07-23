---
name: ui
render_target: docs/ARCHITECTURE.md
render_section: UI
status: stable
last_updated: 2026-07-22
diagram_type: graph TD
diagram_status: stale
---

# UI

## Overview

A single-page React 19 + Tailwind v4 app (`web/src/`) rendering exactly one
review at a time, paginated one chunk (or the overview) per screen with
slide transitions (`motion`/framer-motion-style `AnimatePresence`). Target
user: a single reviewer working through one PR/MR end-to-end, primarily via
keyboard, with the mouse/trackpad as a secondary input for text entry and
menus.

Appearance is a first-class, persisted user preference along **two
independent axes**, both driven entirely through CSS custom properties (no
`tailwind.config.js`; utilities map to the variables via `@theme inline` —
see `CLAUDE.md`):

- **Palette** — a curated set (`blueprint` (default), `paper`, `neon`,
  `mono`, `aubergine`), each a full token set (surfaces, edges, foreground,
  accent, diff add/del, and the `--tok-*` syntax colors). Selected via a
  `data-palette` attribute on the root element, persisted to `localStorage`
  under `ar-palette`.
- **Mode** — light/dark, selected via a `data-theme` attribute on the root,
  persisted under `ar-theme`. Every palette defines a complete token set for
  both modes, so palette × mode composes freely.

`web/src/theme.tsx` owns both axes (`palette`/`setPalette` alongside the
existing `theme`/`toggle`) and writes both attributes synchronously on load
to avoid a flash. Each palette bundles its own syntax-highlight colors, so
syntax re-themes with the palette; decoupling that layer is a separate,
deferred backlog item (`customizable-syntax-themes`), and user-authored
custom palettes/fonts beyond the presets are another (`customizable-fonts-colors`).

The visual identity uses a self-hosted typeface set (`@fontsource`): Figtree
(sans / UI), Tinos (serif — AI commentary voice in `AiCommentary`), and Space
Mono (mono — diff, code, and meta), wired through the `--font-sans`/
`--font-serif`/`--font-mono` custom properties. The three primary regions — top nav (`TopNav`),
the scrolling review stage, and the command bar (`ResponseBar`) — read as
distinct planes via one-directional "rail" shadows; a single accent
`:focus-visible` ring applies to all controls (keyboard-only) and text
selection uses an accent tint.

The app is a thin client over the API in `api.md` — almost all state (`state:
ReviewState`) is server-authoritative and re-fetched/re-set after every
mutating call; local React state exists mainly for UI-only concerns
(navigation index, draft text before submission, streaming buffer, which
modal is open).

## Views

All views are orchestrated by `App.tsx`, which owns navigation (`index`:
`-1` = overview, `0..N-1` = chunk), the active AI stream, and drafts.

### Splash (`Splash.tsx`)

Shown when the server has no active review and hasn't finished its initial
load-attempt failure state. Lets the user type/paste a ref and open it
(`POST /api/reviews/open`). Distinct from the plain "Loading…" state shown
before the first `fetchReview()`/`fetchState()` resolves.

If opening returns `auth_required: 'gitlab'` (`api.md`), opens
`GitLabAuthModal` instead of showing a generic error; on successful token
save, closes the modal and retries the same ref automatically. See
`GitLabAuthModal.tsx` below and `infrastructure.md`'s GitLab entry for the
token this saves.

### Overview (`OverviewView.tsx`)

The `index === -1` page. Shows PR/MR title, description (rendered as
markdown), and Jira context (linked issue(s) + epic, or a setup banner via
`ErrorBanner` if Jira is unavailable — see `datamodel.md`'s `JiraContext`).
Hosts the AI panel scoped to `OVERVIEW_ID` — ask the configured AI provider
to summarize the whole PR or answer a question about it. `onBegin` jumps to chunk 0; its
footer button reads "Begin review →" until any chunk has been viewed
(`state.viewed` non-empty), then "Resume review →" — a resume affordance
distinct from the zero-chunk empty state below.

When `state.comments` contains any `displaced: true` entries (see
`datamodel.md`'s Anchor Reconciliation), a **Displaced Comments** section
renders here — the only place they're shown, since a displaced comment has
no current chunk to attach to. Each entry shows the comment body plus its
last-known `file`/`hunk_header` snapshot, with a "Re-anchor" button that
jumps into `ChunkView` in anchor-picking mode (see `ResponseBar.tsx` below).
Displaced notes and flags are surfaced in the same section for visibility,
but their content/anchor is read-only — no re-anchor affordance for them
(see `api.md`'s `reanchor_comment`). Their only available action is removal:
a note can be deleted and a flag can be cleared.

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
  (a `NotePreview`), Stop while the current target is streaming, Regenerate
  on persisted initial notes, and per-note delete (gated by a
  `deletableNoteIds` set so a mock note's fake id can't offer a no-op delete button).
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
  Opening a ref (via `OpenReviewForm` or `ReviewsList`'s switch action) that
  returns `auth_required: 'gitlab'` opens `GitLabAuthModal` the same way
  `Splash.tsx` does, retrying the same ref on successful save — this
  in-app "Open a review" path and the initial Splash screen both handle the
  GitLab auth prompt identically.
- **`GitLabAuthModal.tsx`** — a Personal Access Token entry form (`open`/
  `onClose`/`onSuccess` props, matching every other modal's shape). Save
  calls `POST /api/auth/gitlab` (`api.md`); on success, calls `onSuccess`
  so the caller (`Splash.tsx` or `ReviewsMenu.tsx`) can close it and retry
  whatever ref triggered the `401`. Not tied to any specific PR/MR — it's
  purely "give the server a GitLab token," reusable from any auth-required
  moment.
- **`SettingsPanel.tsx`** — appearance controls (delegating to `useTheme()`):
  a **Palette** picker (the curated set — see Overview) and a light/dark
  **Theme** toggle, the two Appearance axes; plus
  preload behavior (`preload_chunks` count, `preload_overview` on/off,
  persisted to `localStorage` (`ar-preload-chunks`, `ar-preload-overview`)
  layered over the server default from `GET /api/config`), AI controls backed
  by `GET`/`POST /api/ai-config` (provider selector: Claude/Codex, plus a
  provider-specific model field where blank means provider default), and an
  "Investigation access" row showing the active repo's current
  `InvestigationConfig.mode` (`datamodel.md`) with a button that reopens
  `InvestigationModal` to change it. A read-only "About" section (rendered
  only when present) shows the running `app_version` (`api.md`'s
  `GET /api/config`), sourced from `PreloadConfig.app_version` — the same
  value `src/cli.ts` logs to the console at startup.
- **`InvestigationModal.tsx`** — presents the five investigation-access
  choices (`none`/`local-path`/`api`/`temp-clone`/`always-clone`, see
  `infrastructure.md`'s Repo Investigation Access) with a short
  tradeoff description each — notably, `api` mode's copy states its scope
  limit explicitly ("full contents of changed files only, not the whole
  repo") so the reviewer isn't surprised later. Copy refers to "AI" rather
  than "Claude" except where a provider-specific caveat is needed. `local-path` reveals a text
  input for the directory. Save calls `POST /api/investigation-config`
  (`api.md`); a clone-mode save can take a few seconds (real `git clone`)
  so the button shows a "Cloning…" busy state, matching
  `GitLabAuthModal.tsx`'s existing `saving` pattern.
- **`HelpOverlay.tsx`** — static keyboard-shortcut reference (`Row`/`Binding`
  list), toggled by `?`.
- **`ErrorBanner.tsx`** — generic inline error/warning banner, reused for
  Jira setup hints, AI provider errors, and submit failures.
- **`Markdown.tsx`** — thin `react-markdown` + `remark-gfm` wrapper; all
  element styling lives in a single `.md` CSS class so markdown content
  themes with the rest of the app rather than carrying its own styles.
- **`Logo.tsx`** — mode-aware logo/icon swap (separate light/dark SVG
  assets in `web/public/`), keyed off the light/dark axis only — palette
  choice does not change the logo asset.

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
  non-blocking for navigation. A Stop control is visible for the active
  target while streaming; clicking it closes the current stream, clears the
  live preview, and does not persist a partial note.
- **AI regenerate**: persisted initial notes for a chunk or overview expose
  Regenerate. Regenerate deletes that note through `delete_note`, then starts
  a fresh empty-question AI request for the same target. If the replacement
  stream is stopped or errors before `done`, no partial replacement is
  persisted.
- **AI error**: `aiError` rendered via `ErrorBanner` in the AI panel;
  cleared automatically on navigation (`activeId` change) or on starting a
  new ask.
- **Background preload**: silent for targets other than the currently
  viewed chunk/overview — no dedicated UI state. Preloading walks upcoming
  chunks (per `findNextPreload()` in `web/src/preload.ts`) one at a time,
  only when nothing else is streaming, and swallows errors for
  not-currently-viewed targets by simply advancing its attempt-tracking set
  (`preloadAttemptedRef`) rather than surfacing them to the user. When the
  in-flight preload target *is* the currently viewed chunk or the overview
  (`activeId`), the shared `aiPanel.busy` reflects it — same `busy` prop
  `AiCommentary`/`OverviewView`'s `Summary` already use for a foreground
  ask, so the Ask/Explain/Summarize/Regenerate controls disable and a
  loading indicator (the same pulsing-cursor treatment used for a live
  foreground stream) shows automatically, with no separate loading-state
  plumbing per view. This prevents a same-target duplicate request — e.g.
  clicking "Summarize" while its own preload is still in flight — without
  changing the always-silent, non-blocking treatment for preloads of chunks
  the user isn't currently looking at.
- **Submit**: modal-local states for in-flight, success (with permalink),
  stale-SHA warning, and GitLab partial-failure (`comment_errors` list,
  retry-available — see `SubmitModal.tsx` above) — all handled inside
  `SubmitModal`, not lifted to `App.tsx`. The stale-SHA warning is
  instructional only: it tells the reviewer to re-fetch the PR/MR before
  submitting inline comments, but there is no in-modal re-fetch button or
  route wired to that state today.
- **Displaced comments** (Overview page only): rendered whenever
  `state.comments`/`notes`/`flagged` contains any `displaced: true` entry
  (see `datamodel.md`'s Anchor Reconciliation) — a dedicated section, not a
  dismissible banner, since these need an actual action (re-anchor, delete,
  or unflag) rather than just acknowledgment. Comments show "Re-anchor" and
  "delete" actions. Notes and flags do not expose re-anchor/edit controls in
  this section; they can only be removed (`delete_note` for notes, clearing
  the flag for flags). Displaced comment *bodies* are also read-only — no
  Edit affordance in this section (a deliberate scope decision, not an
  omission): editing happens after re-anchoring, keeping the displaced
  section single-purpose.
- **Comment editing** (`DiffPane`'s `CommentCard`): card-local editing state
  — textarea prefilled with the body, Save/Cancel. Save is disabled on an
  empty/whitespace-only body (matching the add-comment rule); Escape cancels.
  Multiple cards *can* technically enter editing independently (state is
  per-card), which is acceptable — no global "one edit at a time" lock.
  While a card's textarea has focus, global keyboard shortcuts are suppressed
  by the existing focus-in-`TEXTAREA` rule — no new bindings.
- **Investigation access prompt**: the first time a review opens for a repo
  with no `InvestigationConfig` yet (`mode` unset — `GET
  /api/investigation-config` returns the default `'none'` shape), a
  dismissible `ErrorBanner`-style banner appears in the AI panel inviting
  the reviewer to "Enable deeper investigation," opening
  `InvestigationModal` on click. Purely opt-in and non-blocking — dismissing
  it (or never clicking it) leaves the repo at `'none'` and the configured AI
  provider behaves exactly as before; the banner doesn't reappear for that repo once a mode
  is explicitly chosen (including re-choosing `'none'` from the modal,
  which also counts as "chosen" and suppresses the banner).
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
Settings/Help/Investigation each only listen for `Escape` while open). Full binding table
is in `README.md` and mirrored in `HelpOverlay.tsx`; notably `→`/`←` (or
`j`/`k`/`n`/`p`) navigate without side effects, `⌘→`/`⌘←` (Ctrl on
Win/Linux) skip to the next/previous *unviewed* chunk, and `↵` both marks
viewed and advances (the only navigation key with a persistence side
effect). The single-letter shortcuts (`f`/`c`/`a` and the `n`/`p`/`j`/`k`
navigation aliases) all fire only on *no modifier* (`!mod`), so browser
combos — `⌘C`/`Ctrl+C` (copy), `⌘F` (find), `⌘A` (select-all), `⌘N`/`⌘P`,
etc. — fall through to their native handlers instead of being hijacked (or,
for `c`/`a`, `preventDefault`'d). The `⌘→`/`⌘←` unviewed-jump bindings are the
deliberate exception that *does* key off the modifier.

## Production Annotations

- **Load error has no in-place retry** — the full-screen `Error: {message}`
  state (see States above) is inconsistent with every other degrade path
  (Jira, AI provider, submit), which are all recoverable-in-place banners. Not
  intentional. Future work should replace this terminal state with an
  in-place retry affordance (re-run `fetchReview()`/`fetchState()`) rather
  than requiring a manual page reload.
