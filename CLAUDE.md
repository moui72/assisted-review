# CLAUDE.md

Project conventions and architecture guide for contributors and AI agents.

## 1. Project Layout

```
src/        Backend TypeScript — compiled as CommonJS (tsc → build/)
web/        Frontend — Vite + React 19 + Tailwind v4, targets ESNext
build/      tsc output (Node server, served via `node build/cli.js`)
dist/       Vite output (static assets served by the Node server)
tests/      Jest test suite (covers both src/ and web/src/)
```

`pnpm build` runs both compilers in sequence: `tsc -p tsconfig.json && vite build web`.

In dev, `pnpm dev` runs the backend via ts-node and Vite dev server concurrently. The
Vite dev server proxies `/api` to `http://127.0.0.1:4319`.

## 2. TypeScript Rules

- `strict: true` is enabled in all tsconfigs. Do not introduce `any`.
- Use the `node:` prefix for Node built-ins (e.g. `node:fs/promises`, `node:path`).
- Backend (`src/`): CommonJS module resolution. Import paths have no file extensions.
- Frontend (`web/src/`): Bundler module resolution with `allowImportingTsExtensions`.
  All imports must use explicit `.ts` or `.tsx` extensions (e.g. `'./api.ts'`). This
  is enforced by the tsconfig and required for Vite to resolve modules correctly.

## 3. Code Style

Prettier is the formatter; run it with `pnpm format`. ESLint runs with `pnpm lint`.
Prettier config: single quotes, trailing commas, 2-space indent.

Comment rules:
- No comments unless the *why* is non-obvious.
- Never explain what the code does — the code explains itself.
- No docstrings or multi-line comment blocks.

## 4. State Conventions

`applyAction` in `src/state.ts` must remain a pure function: it takes a state and
an action and returns a new state object. It must never mutate its input.

`saveState` must use an atomic write-then-rename pattern:
1. Write to a `.tmp` file alongside the target.
2. `rename()` the `.tmp` onto the target path.

State files live in `~/.assisted-review/` (or the path in `ASSISTED_REVIEW_STATE_DIR`).
One file per PR, named `{owner}-{repo}-{number}.json`. Never commit state files.

## 5. Server Rules

The server binds to `127.0.0.1` only. Do not change this — it must never be exposed
off-machine.

All CLI output (progress, errors, informational messages) goes to `console.error`.
`stdout` is reserved for piped data.

## 6. Frontend Conventions

Use React 19 functional components only. No class components.

Tailwind v4 is wired in via the `@tailwindcss/vite` plugin. There is no
`tailwind.config.js`. Do not create one.

Theming is done exclusively through CSS custom properties. The canonical set is
defined in `web/src/index.css`:

| Variable | Purpose |
|---|---|
| `--bg` | page background |
| `--surface`, `--surface-2` | elevated surfaces |
| `--fg` | primary text |
| `--muted`, `--faint` | secondary / tertiary text |
| `--edge`, `--edge-strong` | borders and dividers |
| `--accent` | signal gold (focus, progress, links) |
| `--add-bg`, `--add-fg`, `--add-gutter` | diff addition rows |
| `--del-bg`, `--del-fg`, `--del-gutter` | diff deletion rows |
| `--hunk-bg` | diff hunk header rows |
| `--tok-*` | syntax highlight tokens |

Tailwind utilities for colors reference these vars via `@theme inline` mappings
(e.g. `bg-bg`, `text-fg`, `text-muted`, `text-accent`).

`dangerouslySetInnerHTML` is permitted only for sanitized hljs output or strings
processed by `escapeHtml`. Never pass raw user or API content.

## 7. Adding Syntax Highlighting

All language registration happens in `web/src/highlight.ts`.

To add a language:
1. Import the language module from `highlight.js/lib/languages/<name>` — never
   import the full hljs bundle.
2. Call `hljs.registerLanguage('<name>', <module>)`.
3. Add entries to `EXT_LANG` mapping file extensions to the registered language name.

Custom grammars (like the inline Terraform/HCL grammar) are defined as functions
returning an `HLJSApi → Language` result.

## 8. Tests

Tests live in `tests/` and run with Jest + ts-jest.

- `tsconfig.jest.json` extends the root tsconfig and adds `web/src` and `tests` to
  `include`, so web components are testable from the same runner.
- `moduleNameMapper` in `jest.config.js` strips `.ts`/`.tsx` extensions from imports
  so the Jest resolver finds modules whose paths use Vite-style explicit extensions.
- `tests/setup-env.cjs` is the `setupFiles` entry — put any env vars that must be set
  before module load here (not in `beforeEach`).

Run tests: `pnpm test`. Watch mode: `pnpm test:watch`.

## 9. External Dependencies

`gh` (GitHub CLI) and `claude` (Claude CLI) are required at runtime. Both are invoked
as subprocesses; they are not importable packages.

When either is absent or misconfigured, surface a clear, actionable error message.
Do not silently swallow the failure or present a cryptic subprocess error.

## 10. Domain Concepts

**chunk** — A group of one or more adjacent hunks from the same file. This is the
primary unit of review. Each chunk has a sequential string id (`c1`, `c2`, ...) and
carries the merged diff plus a `members` array listing the individual hunks.

**OVERVIEW_ID** — The string sentinel `'__overview__'`. Used as the `chunk_id` for
notes and state attached to the overview page (not to any real chunk). Defined in
`src/types.ts` and re-exported from `web/src/api.ts`.

**AiNote** — The in-memory/mock shape for AI commentary on a chunk. Fields: `kind`,
`body`, optional `prompt`, optional `suggested_action`. No `id` or timestamps.
Chunks in the review payload may carry pre-generated `ai_notes: AiNote[]`.

**StoredNote** — The persisted shape saved in `ReviewState.notes`. Adds `id` (UUID),
`chunk_id`, and `created_at` to the `AiNote` fields. Created by the `add_note` action
in `applyAction`.

**AiNoteKind** — `'initial'` (explain/summarize, generated on demand), `'investigation'`
(user asked a follow-up question), `'context'` (pre-loaded context note), `'error'`
(streaming failure).
