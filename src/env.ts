// Load a .env file into process.env before any other module reads it. Import
// this FIRST in the CLI entrypoint.
//
// dotenv never overrides a variable already present in the environment, and for
// any given key the FIRST file that sets it wins. The list below is therefore in
// precedence order, and a missing file is a no-op. This lets a global install
// pick up credentials (e.g. Jira) from ~/.assisted-review/.env no matter which
// directory `assisted-review` is run from, while a checkout's own .env still wins
// during development.
//
//   1. real environment variables          (always win — dotenv won't override)
//   2. $DOTENV_CONFIG_PATH                  (explicit override)
//   3. ./.env                               (current dir — local / dev)
//   4. ~/.assisted-review/.env              (user-global default; matches state root)

import { homedir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';

const candidates = [
  process.env.DOTENV_CONFIG_PATH,
  '.env',
  join(homedir(), '.assisted-review', '.env'),
].filter((p): p is string => Boolean(p));

for (const path of candidates) {
  config({ path, quiet: true });
}
