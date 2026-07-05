## Project Layout

```
src/        Backend TypeScript (ESM, compiled to build/)
web/        Frontend — Vite + React 19 + Tailwind v4
tests/      Vitest suite (covers src/ and web/src/)
```

Dev: backend via tsx; Vite dev server proxies `/api` to `http://127.0.0.1:4319`.

## TypeScript

- `strict: true` everywhere. No `any`.
- Backend (`src/`): ESM (`package.json`'s `"type": "module"`, `tsconfig.json`'s `NodeNext` resolution) — relative imports must use explicit `.js` extensions (e.g. `from './types.js'`), even though the source files are `.ts`.
- Frontend (`web/src/`): all imports must use explicit `.ts`/`.tsx` extensions — required by tsconfig and Vite.
- Use `node:` prefix for Node built-ins.

## State (`src/state.ts`)

`applyAction` must be pure: takes state + action, returns new state, never mutates.

`saveState` must use an atomic write: write to `.tmp` then `rename()` onto the target. State files live in `~/.assisted-review/` (or `ASSISTED_REVIEW_STATE_DIR`), named `{owner}-{repo}-{number}.json`.

## Server

Binds to `127.0.0.1` only — never expose off-machine. All CLI output goes to `console.error`; `stdout` is reserved for piped data.

Hosted, multi-user deployment is a possible future direction, not a current requirement — don't build it now. But when writing new server-side code, avoid decisions that would make that transition harder than it needs to be: e.g. don't deepen the single global `AppContext { review, state }` singleton (`src/server.ts`) with more state that assumes exactly one active review process-wide if a per-request/per-session shape would be just as simple today. When the two are equally simple, prefer the one that doesn't need to be ripped out later. This is a tiebreaker for otherwise-equivalent choices, not a mandate to add abstraction for a use case that doesn't exist yet.

## Frontend

No `tailwind.config.js` — do not create one. Theming uses CSS custom properties defined in `web/src/index.css`; Tailwind utilities map them via `@theme inline`.

`dangerouslySetInnerHTML` is permitted only for sanitized hljs output or strings processed by `escapeHtml`. Never pass raw user or API content.

## External Dependencies

`gh` and `claude` CLIs are required at runtime as subprocesses (not importable packages). Surface clear errors if either is absent.

## Testing

Backend (`src/**/*.ts`) statement and line coverage must stay above **90%** (per-glob threshold enforced in `vitest.config.ts`). Run `npx vitest run --coverage` to check. `src/cli.ts`, `src/setup-jira.ts`, and `src/env.ts` are excluded (untestable entry points / interactive).

Frontend components (`web/src/`) are measured but not gated — coverage is a work in progress there. Component tests live in `tests/components/` and use `// @vitest-environment jsdom` docblocks (not `environmentMatchGlobs`).

Use module mocks for external CLIs (`gh`, `op`, `claude`) and `node:child_process`; use `vi.spyOn(globalThis, 'fetch')` for HTTP calls.

## Domain Concepts

- **chunk** — Adjacent hunks from one file, the primary review unit. Has sequential id (`c1`, `c2`, …), merged diff, and `members` array.
- **OVERVIEW_ID** — Sentinel `'__overview__'` used as `chunk_id` for the overview page. Defined in `src/types.ts`, re-exported from `web/src/api.ts`.
- **StoredNote** — the one AI-note shape, real and mock alike: `id`, `chunk_id`, `kind`, `body`, optional `prompt`/`suggested_action`, `created_at`. Real notes are created by the `add_note` action and persisted in `ReviewState.notes`; mock notes (`--mock-ai`) use this same shape with fake `id`/`chunk_id`/`created_at` values rather than a separate in-memory type — don't reintroduce a mock-only note type.
- **AiNoteKind** — `'initial'` | `'investigation'` | `'context'` | `'error'`.
