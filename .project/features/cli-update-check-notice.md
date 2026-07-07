---
slug: cli-update-check-notice
status: implemented
logged: 2026-07-07
plan: plan-cli-update-check-notice-2026-07-07.md
tasks: tasks-cli-update-check-notice-bb83.md
---

On startup, the CLI checks the npm registry in the background for a newer published version and prints a single non-intrusive notice line if the installed version is out of date.
Why: users on remote/phone sessions or long-lived installs have no signal they're behind; the check must never block startup or nag on every run.
