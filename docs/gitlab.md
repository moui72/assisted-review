# GitLab

GitHub PRs work out of the box via `gh`. GitLab MRs
(`namespace/repo!123` or an MR URL; `namespace` may contain slashes for
subgroups) need one of the following, in priority order:

1. **A token entered in the browser** — when a GitLab ref needs auth, the UI
   prompts for a personal access token and persists it (mode `0600`) in the
   state directory. Since this is an explicit, deliberate choice, it takes
   precedence even if `glab` is also installed and authenticated.
2. **`glab` installed** — used when no browser token is set; if the binary
   is present, every GitLab call goes through it.

    !!! warning
        This is a presence check (`glab --version`), not an auth check: an
        installed-but-unauthenticated `glab` is still selected, so
        `GITLAB_TOKEN` below is **not** reached as a fallback in that case.
        Enter a browser token to override.

3. **`GITLAB_TOKEN`** in the environment — used by the built-in REST
   fallback when neither of the above is available.

| Variable | Description |
|---|---|
| `GITLAB_TOKEN` | Personal/project access token with API scope, used by the REST fallback when `glab` isn't available |
| `GITLAB_HOST` | Self-hosted GitLab instance (default: `gitlab.com`) |

See [Submitting a review](submitting.md) for how GitLab submission differs
from GitHub (per-comment discussions with retry and resume, instead of one
atomic review).
