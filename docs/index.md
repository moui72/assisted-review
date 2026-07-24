# assisted-review

<p align="center">
  <img alt="assisted-review" src="assets/logo.svg#only-light" width="440" />
  <img alt="assisted-review" src="assets/logo-dark.svg#only-dark" width="440" />
</p>

Reviewing a large pull request in the standard GitHub or GitLab UI means
scrolling one enormous wall of diff: no focus, no pacing, and nothing tracking
what you've actually looked at. Context gets lost, subtle bugs slip through,
and the temptation to skim grows with every file.

**assisted-review** is a standalone CLI that fetches a GitHub PR or GitLab MR
and serves a focused, keyboard-driven browser UI for walking it **one chunk at
a time**. Each chunk — adjacent hunks from the same file, merged when the gap
between them is small — gets its own page, with AI-generated commentary
alongside it. You can ask follow-up questions, flag chunks, draft inline
comments, and finally publish everything back to GitHub/GitLab as a real
review. Progress persists to disk, so a half-finished review resumes exactly
where you left off.

**You stay in control.** The configured AI provider assists — it never decides
or auto-posts anything.

## Local-first by design

Everything runs on your machine:

- The diff is fetched with `gh` / `glab`
- The server binds to `127.0.0.1` only
- AI commentary streams from a headless local provider subprocess
  ([`claude`](https://claude.com/claude-code) or `codex`)
- No hosted backend, no account

Nothing leaves your machine except whatever your selected provider CLI sends
and the comments you explicitly choose to submit.

## Quick start

```bash
npm i -g assisted-review
assisted-review owner/repo#123     # or paste a PR/MR URL
```

Head to [Getting started](getting-started.md) for prerequisites and details,
or the [review workflow](reviewing.md) to see what a session looks like.

!!! note "Status"
    Young but moving fast — see the [release notes](release-notes.md) for
    what's shipped and the
    [roadmap](https://github.com/moui72/assisted-review/blob/main/ROADMAP.md)
    for what's planned.
