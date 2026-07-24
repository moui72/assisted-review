# Contributing

PRs welcome — open one against `main`. CI runs lint, build, tests (backend
coverage is gated at 90%), and a Playwright smoke test on every PR; releases
are cut automatically by semantic-release from conventional commits. Please
keep commits focused and include tests for new behavior where applicable.

## Dev setup

```bash
pnpm install
pnpm dev        # API server on :4319 + Vite HMR on :5173
```

Open `http://localhost:5173` for the live-reloading UI. Set a default PR
with `PR_REF=owner/repo#N` in `.env` (copy `.env.example`).

## Scripts

| Script | What it does |
|---|---|
| `dev` | Starts the API server and Vite HMR server concurrently |
| `dev:web` | Starts only the Vite HMR server — pair with `--api-only` |
| `build` | Compiles TypeScript (server → `build/`) and bundles the UI (→ `dist/`) |
| `build:web` | Builds only the React UI with Vite |
| `test` | Runs Vitest unit tests |
| `test:e2e` | Runs the Playwright end-to-end smoke test (requires a prior `pnpm build`) |
| `test:watch` | Runs Vitest in watch mode |
| `lint` | Runs ESLint |
| `format` | Runs Prettier |

## Adding a language

Syntax highlighting is registered in `web/src/highlight.ts`. Import the
language grammar from `highlight.js` there and add it to the
`hljs.registerLanguage` calls.

## Docs

This site is built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
from `docs/` + `mkdocs.yml` and deployed to GitHub Pages by
`.github/workflows/docs.yml` on every push to `main` that touches the docs,
and on every release. The [release notes](release-notes.md) page is
generated at build time from GitHub Releases by
`scripts/generate-release-notes.mjs`. To preview locally:

```bash
node scripts/generate-release-notes.mjs   # optional; needs network
pip install mkdocs-material
mkdocs serve
```

See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for the module map and design
write-up.
