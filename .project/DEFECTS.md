# Defects

_Last verified: 2026-07-03_

No defects found — artifacts match the codebase as of this run.

`ui.md`'s prior defect (Displaced Comments' exclusivity mechanism
undocumented) is resolved: it now explicitly documents that `App.tsx`'s
`chunkComments`/`isFlagged`/`storedNotes`/`commentedIds`/`TopNav`'s `flagged`
prop filter out `displaced: true` entries, and why (a displaced entry's
retained last-known `chunk_id` could otherwise coincidentally match a
renumbered chunk). Matches `web/src/App.tsx:358,398,401,406,438` exactly.

No code changes since the prior full pass otherwise — `constitution.md`,
`datamodel.md`, `infrastructure.md`, `api.md` re-confirmed clean.
