## Project Layout

```
src/        Backend TypeScript (CommonJS, compiled to build/)
web/        Frontend — Vite + React 19 + Tailwind v4
tests/      Jest suite (covers src/ and web/src/)
```

Dev: backend via ts-node; Vite dev server proxies `/api` to `http://127.0.0.1:4319`.

## TypeScript

- `strict: true` everywhere. No `any`.
- Backend (`src/`): CommonJS, no file extensions on imports.
- Frontend (`web/src/`): all imports must use explicit `.ts`/`.tsx` extensions — required by tsconfig and Vite.
- Use `node:` prefix for Node built-ins.

## State (`src/state.ts`)

`applyAction` must be pure: takes state + action, returns new state, never mutates.

`saveState` must use an atomic write: write to `.tmp` then `rename()` onto the target. State files live in `~/.assisted-review/` (or `ASSISTED_REVIEW_STATE_DIR`), named `{owner}-{repo}-{number}.json`.

## Server

Binds to `127.0.0.1` only — never expose off-machine. All CLI output goes to `console.error`; `stdout` is reserved for piped data.

## Frontend

No `tailwind.config.js` — do not create one. Theming uses CSS custom properties defined in `web/src/index.css`; Tailwind utilities map them via `@theme inline`.

`dangerouslySetInnerHTML` is permitted only for sanitized hljs output or strings processed by `escapeHtml`. Never pass raw user or API content.

## External Dependencies

`gh` and `claude` CLIs are required at runtime as subprocesses (not importable packages). Surface clear errors if either is absent.

## Domain Concepts

- **chunk** — Adjacent hunks from one file, the primary review unit. Has sequential id (`c1`, `c2`, …), merged diff, and `members` array.
- **OVERVIEW_ID** — Sentinel `'__overview__'` used as `chunk_id` for the overview page. Defined in `src/types.ts`, re-exported from `web/src/api.ts`.
- **AiNote** — In-memory AI commentary: `kind`, `body`, optional `prompt`/`suggested_action`. No `id` or timestamps.
- **StoredNote** — Persisted in `ReviewState.notes`. Adds `id` (UUID), `chunk_id`, `created_at`. Created by `add_note` action.
- **AiNoteKind** — `'initial'` | `'investigation'` | `'context'` | `'error'`.
