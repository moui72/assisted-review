# Architecture

Diagrams generated from the ARDD artifacts in [`.project/artifacts/`](../.project/artifacts) via `/ardd-render`. See the [Architecture](../README.md#architecture) section of the README for the prose overview.

## Datamodel

```mermaid
erDiagram
    PrRef {
        string owner
        string repo
        number number
        string platform
    }
    PrMeta {
        string title
        string author
        string base_ref
        string head_ref
        boolean is_draft
        string url
        string head_sha
        string body
    }
    RawHunk {
        string id
        string file
        string hunk_header
        LineRange old_range
        LineRange new_range
        string context
        string diff
    }
    HunkMember {
        string hunk_header
        LineRange old_range
        LineRange new_range
    }
    Chunk {
        string id
        string file
        string diff
        HunkMember_array members
        StoredNote_array ai_notes
    }
    JiraIssue {
        string key
        string summary
        string status
        string type
        string description
        string url
        string epic_key
    }
    JiraContext {
        boolean available
        string reason
        string setup_hint
        string_array keys
    }
    Overview {
        JiraContext jira
    }
    Review {
        string generated_at
    }
    DraftComment {
        string id
        string chunk_id
        Side side
        number line
        string body
        string file
        string hunk_header
        boolean displaced
        string created_at
        string updated_at
    }
    StoredNote {
        string id
        string chunk_id
        AiNoteKind kind
        string prompt
        string body
        string suggested_action
        string file
        string hunk_header
        boolean displaced
        string created_at
    }
    FlaggedEntry {
        string chunk_id
        string file
        string hunk_header
        boolean displaced
    }
    ReviewState {
        number version
        string head_sha
        string started_at
        GitLabSubmitProgress gitlab_submit_progress
    }
    GitLabSubmitProgress {
        string_array posted_comment_ids
        boolean note_posted
        boolean approved
    }
    ReviewSummary {
        string head_sha
        string started_at
        number comment_count
        number flagged_count
        number viewed_count
    }
    InvestigationConfig {
        string platform
        string owner
        string repo
        string mode
        string local_path
        string clone_path
        string chosen_at
        string last_used
    }
    SubmitResult {
        boolean ok
        string html_url
        string error
    }

    RawHunk ||--o{ HunkMember : "retained on grouping"
    Chunk ||--o{ HunkMember : "members"
    Chunk ||--o{ StoredNote : "ai_notes (mock, fake ids)"
    JiraContext ||--o{ JiraIssue : "issues"
    JiraContext ||--o| JiraIssue : "epic"
    Overview ||--|| JiraContext : "jira"
    Review ||--|| PrRef : "pr"
    Review ||--|| PrMeta : "meta"
    Review ||--o{ Chunk : "chunks"
    Review ||--|| Overview : "overview"
    ReviewState ||--|| PrRef : "pr"
    ReviewState ||--o| PrMeta : "meta (cached)"
    ReviewState ||--o{ DraftComment : "comments"
    ReviewState ||--o{ StoredNote : "notes"
    ReviewState ||--o{ FlaggedEntry : "flagged"
    ReviewState ||--o| GitLabSubmitProgress : "gitlab_submit_progress"
    ReviewSummary ||--|| PrRef : "pr"
    ReviewSummary ||--o| PrMeta : "meta"
```

## Infrastructure

```mermaid
graph TD
    subgraph local["Local machine — 127.0.0.1 only"]
        CLI["CLI (src/cli.ts)"]
        Browser["React UI (dist/) in browser"]
        Server["HTTP server (src/server.ts)<br/>REST + one SSE endpoint, :4319"]
        subgraph state["State dir (~/.assisted-review/)"]
            StateFiles["Review state JSON<br/>one file per PR/MR"]
            InvCfg["investigation-config.json"]
            Clones["repos/ — temp &amp; always clones"]
            GLToken["gitlab-token (0o600)"]
            UpdCache["update-check.json"]
        end
    end

    subgraph ext["External tools &amp; services (subprocesses / HTTP)"]
        GH["gh CLI → GitHub"]
        GLAB["glab CLI / REST → GitLab"]
        Jira["Jira REST API"]
        Claude["claude CLI — headless, read-only"]
        NPM["npm registry"]
        OP["op — 1Password, optional"]
    end

    CLI -->|starts| Server
    Browser <-->|"REST + SSE (/api/*)"| Server
    Server -->|"fetch diff/meta, submit review"| GH
    Server -->|"fetch diff/meta, submit, clone"| GLAB
    Server -->|"issue + epic context"| Jira
    Server -->|"stream commentary"| Claude
    Server -->|"load / atomic save"| StateFiles
    Server -->|"read/write chosen mode"| InvCfg
    Server -->|"clone / refresh / prune"| Clones
    Server -->|"read/write browser token"| GLToken
    Server -->|"once-per-24h check"| NPM
    Server -.->|"resolve JIRA_TOKEN reference"| OP
    Claude -.->|"Read/Grep/Glob in repo-access modes"| Clones
```

## UI

```mermaid
graph TD
    App["App.tsx<br/>navigation · active Claude stream · drafts"]

    App -->|"index -1"| Overview["OverviewView.tsx"]
    App -->|"index 0..N-1"| Chunk["ChunkView.tsx"]
    App --> Splash["Splash.tsx"]
    App -->|"per-chunk viewed/flagged/commented"| TopNav["TopNav.tsx"]
    App -->|"isMac · re-anchor mode"| ResponseBar["ResponseBar.tsx"]
    App --> SubmitModal["SubmitModal.tsx"]
    App --> ReviewsMenu["ReviewsMenu.tsx"]
    App --> SettingsPanel["SettingsPanel.tsx"]
    App --> HelpOverlay["HelpOverlay.tsx"]

    Splash --> GLAuth["GitLabAuthModal.tsx"]

    Overview --> MD1["Markdown.tsx"]
    Overview --> EB["ErrorBanner.tsx"]
    Overview -->|"scoped OVERVIEW_ID"| AiC["AiCommentary.tsx"]

    Chunk --> DiffPane["DiffPane.tsx"]
    Chunk -->|"scoped chunk id"| AiC
    DiffPane --> CommentCard["CommentCard — inline, edit/delete"]

    AiC -->|"StoredNote[] · deletableNoteIds"| Note["Note (StoredNote | NotePreview)"]
    Note --> MD2["Markdown.tsx"]

    ReviewsMenu --> OpenForm["OpenReviewForm.tsx"]
    ReviewsMenu --> ReviewsList["ReviewsList.tsx"]
    ReviewsMenu --> DelConfirm["DeleteReviewConfirm.tsx"]
    ReviewsMenu --> GLAuth

    SettingsPanel --> InvModal["InvestigationModal.tsx"]
```


## Backend modules

```
src/         TypeScript backend (ESM, compiled to build/)
  cli.ts        entry: parse ref → fetch → chunks → Jira → serve
  fetch.ts · parse-ref.ts · parse-diff.ts   diff/PR ingestion (GitHub + GitLab)
  gitlab-rest.ts · gitlab-token.ts          GitLab glab-CLI-or-REST transport, token resolution
  server.ts     localhost HTTP server
  state.ts      persisted review state (~/.assisted-review/<key>.json)
  investigation.ts   per-repo Claude investigation-access config + clone lifecycle
  claude.ts     headless Claude bridge (stream-json)
  submit.ts     publish drafted comments as a real PR/MR review
  jira.ts       Jira REST fetch (env-configured)
  update-check.ts    background npm-registry version check
web/         Vite + React + Tailwind UI → builds into dist/, served by the server
```

- **`cli.ts`** — entry point; parses the PR/MR ref, fetches the diff and metadata, extracts Jira keys, and hands off to the server. Starts in splash-screen mode when no ref is given.
- **`fetch.ts` / `parse-ref.ts` / `parse-diff.ts`** — fetch the raw diff and PR/MR metadata via `gh`/`glab`, parse the ref format, and slice the unified diff into reviewable chunks.
- **`gitlab-rest.ts` / `gitlab-token.ts`** — GitLab transport (prefers the `glab` CLI, falls back to the REST API v4 via `GITLAB_TOKEN`) and token resolution (raw value, `op://`, `env:`, or `cmd:` reference).
- **`server.ts`** — Node.js HTTP server providing the REST and SSE API (`/api/review`, `/api/state`, `/api/action`, `/api/claude` (SSE), `/api/submit`, `/api/reviews`, `/api/reviews/open`, `/api/auth/gitlab`, `/api/investigation-config`, `/api/config`). Serves the pre-built React UI from `dist/` unless `--api-only` is set.
- **`state.ts`** — loads and persists review state (viewed, flagged, comments, AI notes) as JSON in `~/.assisted-review/`.
- **`investigation.ts`** — per-repo config for how much repo access Claude gets during investigation (diff-only, a local checkout, full-file API reads, or a managed clone), plus clone lifecycle (cloning, refresh, pruning).
- **`claude.ts`** — spawns headless `claude` as a subprocess and streams JSON-formatted commentary back to the server.
- **`submit.ts`** — assembles drafted comments into a review payload and posts it via `gh api` (GitHub) or the GitLab discussions/notes/approve endpoints (GitLab).
- **`jira.ts`** — fetches issue and epic data from the Jira REST API using env-configured credentials.
- **`update-check.ts`** — checks the npm registry for a newer published version in the background and prints a notice on startup if out of date.
