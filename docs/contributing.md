# Contributing

PRs welcome — open one against `main`. CI runs lint, build, tests (backend
coverage is gated at 90%), and a Playwright smoke test on every PR; releases
are cut automatically by semantic-release from
[conventional commits](#conventional-commits). Please keep commits focused
and include tests for new behavior where applicable.

## Conventional commits

Every commit message (or at least every PR title, since PRs are
squash-merged) must follow the
[Conventional Commits](https://www.conventionalcommits.org/) format —
releases are **fully automated** from them, so the commit type is what
decides whether a release happens and what version it gets:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

Real examples from this repo's history:

```
fix(gitlab): browser token outranks glab CLI in transport selection
feat(ai): add codex provider support
docs: consolidate badges, 6 to 3
chore(deps-dev): bump eslint from 9.39.4 to 10.7.0
```

### How types map to releases

semantic-release (Angular preset) analyzes the commits since the last
release and picks the **highest** bump among them:

| Type | Release | Example |
|---|---|---|
| `fix:` | **Patch** (`1.12.2` → `1.12.3`) | `fix(gitlab): retry transient submit failures` |
| `feat:` | **Minor** (`1.12.2` → `1.13.0`) | `feat(ui): side-by-side diff view` |
| `BREAKING CHANGE:` footer, or `!` after the type (`feat!:`) | **Major** (`1.12.2` → `2.0.0`) | `feat(cli)!: drop Node 18 support` |
| `perf:` | **Patch** | `perf(diff): memoize chunk highlighting` |
| `docs:`, `chore:`, `ci:`, `test:`, `style:`, `refactor:`, `build:` | **No release** | `chore(deps): bump actions/checkout` |

Notes:

- The **scope** is free-form but should name the area touched — existing
  scopes include `gitlab`, `ai`, `ui`, `cli`, `deps`, `deps-dev`, `lint`,
  `badge`, `ardd`.
- Use the imperative mood, lower-case, no trailing period: "add", "fix",
  "bump" — not "added" or "Fixes".
- A breaking change must be flagged even on a `fix:` — either
  `fix(api)!: …` or a `BREAKING CHANGE: <explanation>` footer. Both force a
  major bump.
- `refactor:` and `test:` don't release on their own; if a refactor changes
  observable behavior, it isn't a refactor — use `fix:` or `feat:`.

### Release channels

Releases flow through two npm dist-tags:

- **`beta`** — every push to `main` containing at least one releasing
  commit (`fix`/`feat`/`perf`/breaking) publishes a prerelease
  (`x.y.z-beta.N`) to the `beta` dist-tag. Non-releasing types (`chore`,
  `docs`, `ci`, …) publish nothing.
- **`latest`** — the **Promote to stable** workflow (manually dispatched
  from the Actions tab) fast-forwards the `release` branch to `main`; the
  publish workflow then collapses the accumulated betas into a single
  stable version on `latest`.

```
main:     feat ──▶ 1.13.0-beta.1 ──▶ fix ──▶ 1.13.0-beta.2   (npm tag: beta)
                                                  │
release:                     Promote to stable ──▶ 1.13.0     (npm tag: latest)
```

Try the beta channel with `npm i -g assisted-review@beta`.

Version history lives in git tags and
[GitHub Releases](https://github.com/moui72/assisted-review/releases) —
which also feed the [release notes](release-notes.md) page. `CHANGELOG.md`
in the repo is frozen at v1.12.2.

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
