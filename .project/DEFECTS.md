# Defects

_Last verified: 2026-07-11_

No defects found — artifacts match the codebase as of this run.

Survey against `main` at `994d8c1` (PRs #80–#83 merged). Confirmed
code-side:

- **ui.md** — the bare-`c` shortcut is guarded on `!mod`
  (`web/src/App.tsx:358`) and the Overview footer flips to "Resume review"
  via `hasViewed` (`web/src/components/OverviewView.tsx`), matching the
  Keyboard Model and Overview descriptions.
- **infrastructure.md** — `buildPrompt`/`buildOverviewPrompt` take
  `allowRepoRead` (intro swaps on repo access) and `history` (prior-turn
  transcript) (`src/claude.ts`); the always-clone refresh compares
  `git rev-parse HEAD` to `head_sha` (`src/investigation.ts:97`) and
  `markConfigUsed` bumps the `last_used` ISO timestamp the 30-day prune
  reads — all as documented.
- **api.md / datamodel.md** — the GitLab submit adapter returns
  `SubmitResult & { progress }` (`src/submit.ts:179`) and the `/api/submit`
  route strips both `payload` and `progress` (`src/server.ts:306`).
- **datamodel.md** — `src/types.ts` entities (including
  `InvestigationConfig.last_used`) still match field-for-field.

The `f`/`a` (and `n`/`p`) unguarded-modifier keyboard bug noted this session
is a **code bug**, not a code-vs-artifact drift — no artifact claims those
keys are mod-guarded — so it is tracked as open feedback
(`feedback-keyboard-mod-guard-f-and-a-sho-17aa.md`), not here.

All prior findings (the `last_used` broken-contract and four documentation
drifts) remain resolved.
