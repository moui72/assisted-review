# Jira

With Jira credentials configured, the overview page pulls the PR's
referenced **story and epic** — issue keys are detected in the title, branch
name, and description. Without them, the overview shows a setup banner
instead: Jira is an enrichment, never a blocker.

## Interactive setup

```bash
assisted-review configure
```

The wizard prompts for the values below, tests the connection, and writes
them to `~/.assisted-review/.env` (mode `0600`).

## Variables

| Variable | Required | Description |
|---|---|---|
| `JIRA_BASE_URL` | Yes | Base URL of your Jira instance, e.g. `https://your-org.atlassian.net` |
| `JIRA_USER` | Yes | Your Jira account email |
| `JIRA_TOKEN` | Yes | Jira API token — a raw value, or a reference (below) |
| `JIRA_EPIC_FIELD` | No | Epic-Link custom field ID (default: `customfield_10008`) |

`JIRA_TOKEN` doesn't have to be a plaintext secret — it also accepts:

- `op://vault/item/field` — resolved via the 1Password CLI (`op`)
- `env:VAR_NAME` — read from another environment variable
- `cmd:<command>` — the output of a shell command

**Example `~/.assisted-review/.env`:**

```ini
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_USER=you@example.com
JIRA_TOKEN=op://Private/Jira/api-token
# JIRA_EPIC_FIELD=customfield_10008
```
